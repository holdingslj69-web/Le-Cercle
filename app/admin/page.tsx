import Link from "next/link";
import { redirect } from "next/navigation";
import { session } from "@/lib/session";
import { eur, NAF, CLAIM_LABEL, PRO_MONTHLY_FEE } from "@/lib/rules";
import { approve, reject, suspend } from "./actions";

export default async function Admin() {
  const { supabase, admin } = await session();
  if (!admin) redirect("/catalogue");
  const [{ data: members }, { data: privs }, { data: comm }, { data: watch }, { data: claims }] = await Promise.all([
    supabase.from("members").select("*").order("created_at", { ascending: false }),
    supabase.from("members_private").select("*"),
    supabase.from("admin_commissions_month").select("*"),
    supabase.from("admin_watchlist").select("*").gt("signalements", 0),
    supabase.from("claims").select("*, order:orders(ref, offer:offers(name,vintage))").eq("status", "ouvert"),
  ]);
  const pv = new Map((privs ?? []).map((p) => [p.id, p]));
  const kbisUrls = new Map<string, string>();
  await Promise.all((privs ?? []).filter((p) => p.kbis_path).map(async (p) => {
    const { data } = await supabase.storage.from("kbis").createSignedUrl(p.kbis_path, 3600);
    if (data?.signedUrl) kbisUrls.set(p.id, data.signedUrl);
  }));
  const pending = (members ?? []).filter((m) => m.status === "pending"), active = (members ?? []).filter((m) => m.status === "active");
  const totalComm = (comm ?? []).reduce((a, c) => a + Number(c.commission_ht), 0), nPro = active.filter((m) => m.plan === "pro").length;

  const card = (m: any) => {
    const p: any = pv.get(m.id) ?? {};
    return (
      <article key={m.id} className="card">
        <div className="row between"><b>{p.legal_name ?? m.pseudo}</b><span className={`pill ${m.status === "active" ? "ok" : "warn"}`}>{m.status}</span></div>
        <dl className="kv"><dt>Pseudo</dt><dd>{m.pseudo}</dd><dt>Activité</dt><dd>{m.kind} · formule {m.plan}</dd>
          <dt>NAF</dt><dd>{p.naf} {NAF[p.naf] ?? <span className="pill warn">hors liste</span>}</dd>
          <dt>SIRET</dt><dd>{p.siret} · <a href={`https://annuaire-entreprises.data.gouv.fr/etablissement/${p.siret}`} target="_blank" rel="noopener">vérifier</a></dd>
          <dt>TVA</dt><dd>{p.vat_number}</dd><dt>Licence</dt><dd>{p.licence}</dd><dt>Accises</dt><dd>{p.excise_number ?? "—"}</dd>
          <dt>Adresse</dt><dd>{p.address}</dd><dt>Téléphone</dt><dd>{p.phone}</dd></dl>
        <div className="row">{kbisUrls.get(m.id) ? <a className="btn sm" href={kbisUrls.get(m.id)} target="_blank" rel="noopener">Voir le Kbis</a> : <span className="pill warn">Kbis manquant</span>}</div>
        <div className="row">
          {m.status !== "active" && <form action={approve}><input type="hidden" name="id" value={m.id} /><button className="btn primary sm">Valider</button></form>}
          {m.status === "pending" && <form action={reject} className="row" style={{ flexWrap: "nowrap" }}><input type="hidden" name="id" value={m.id} /><input name="reason" placeholder="Motif du refus" /><button className="btn sm">Refuser</button></form>}
          {m.status === "active" && <form action={suspend} className="row" style={{ flexWrap: "nowrap" }}><input type="hidden" name="id" value={m.id} /><input name="reason" placeholder="Motif" /><button className="btn quiet sm">Suspendre</button></form>}
        </div>
      </article>
    );
  };

  return (
    <>
      <h1>Membres</h1>
      <div className="grid2">
        <div className="card"><b style={{ fontSize: 22 }}>{active.length}</b><span className="hint">membres validés</span></div>
        <div className="card"><b style={{ fontSize: 22 }}>{eur(totalComm)}</b><span className="hint">commissions du mois</span></div>
        <div className="card"><b style={{ fontSize: 22 }}>{eur(nPro * PRO_MONTHLY_FEE)}</b><span className="hint">abonnements Pro ({nPro})</span></div>
      </div>
      <div className="row"><Link className="btn sm" href="/api/admin/export?type=commissions">Commissions du mois (CSV)</Link><Link className="btn sm" href="/api/admin/export?type=dac7">Export DAC7 (CSV)</Link></div>
      {!!claims?.length && <><h2>Litiges en cours</h2>{claims.map((c: any) => <div key={c.order_id} className="card"><b>{c.order?.offer?.name} · {c.order?.ref}</b><span>{CLAIM_LABEL[c.type as keyof typeof CLAIM_LABEL]} · {c.details}</span></div>)}</>}
      {!!watch?.length && <><h2>Vendeurs signalés (6 mois)</h2><table className="t"><thead><tr><th>Vendeur</th><th>Signalements</th><th>dont producteurs</th></tr></thead><tbody>{watch.map((w: any) => <tr key={w.seller_id}><td>{w.pseudo}</td><td>{w.signalements}</td><td>{w.signalements_producteurs}</td></tr>)}</tbody></table></>}
      <h2>À vérifier ({pending.length})</h2><div className="list">{pending.map(card)}{!pending.length && <p className="muted">Aucune demande en attente.</p>}</div>
      <h2>Tous les membres</h2><div className="list">{(members ?? []).filter((m) => m.status !== "pending").map(card)}</div>
    </>
  );
}
