import Link from "next/link";
import { requireActive } from "@/lib/session";
import { Tile } from "@/components/OfferCard";
import { eur, trackingUrl, DOUANE_DOCS, CLAIM_LABEL } from "@/lib/rules";
import { confirmOrder, cancelOrder, received, settleClaim, review, withdrawOffer } from "./actions";
import { ShipForm, ClaimForm } from "./Forms";
import { validateGroup, cancelGroup } from "../achats-groupes/actions";

const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);

function steps(o: any) {
  const colis = o.mode === "colis";
  const list = colis ? ["Réservé", "Confirmé", "Expédié", "Reçu"] : ["Réservé", "Confirmé", "Remis", "Reçu"];
  const i = o.received_at ? 4 : o.shipped_at ? 3 : o.confirmed_at ? 2 : 1;
  return <div className="grid2" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>{list.map((t, k) => <span key={t} className="hint" style={{ borderTop: `4px solid ${k < i ? "var(--accent)" : "var(--line)"}`, paddingTop: 4, fontWeight: 700 }}>{t}</span>)}</div>;
}

export default async function Echanges({ searchParams }: { searchParams: { vue?: string } }) {
  const { supabase, user, member } = await requireActive();
  const vue = searchParams.vue === "achats" ? "achats" : searchParams.vue === "lots" ? "lots" : "ventes";
  await supabase.rpc("release_expired_reservations");
  const sel = "*, offer:offers(name,producer,vintage,format,photos,category), shipment:shipments(*), claim:claims(*)";
  const [{ data: orders }, { data: myOffers }, { data: myGroups }, { data: myPledges }, { data: myReviews }] = await Promise.all([
    supabase.from("orders").select(sel).eq(vue === "achats" ? "buyer_id" : "seller_id", user.id).is("cancelled_at", null).order("reserved_at", { ascending: false }),
    supabase.from("offers").select("id,name,vintage,format,qty,price,status,photos,category").eq("seller_id", user.id).eq("status", "dispo").order("created_at", { ascending: false }),
    supabase.from("group_buys").select("*, pledges(qty, member_id)").eq("seller_id", user.id).order("created_at", { ascending: false }),
    supabase.from("pledges").select("qty, group:group_buys(*, seller:members!group_buys_seller_id_fkey(pseudo))").eq("member_id", user.id),
    supabase.from("reviews").select("order_id").eq("author_id", user.id),
  ]);
  const others = [...new Set((orders ?? []).filter((o: any) => o.confirmed_at).map((o: any) => (vue === "achats" ? o.seller_id : o.buyer_id)))];
  const [{ data: privs }, { data: pubs }] = await Promise.all([
    others.length ? supabase.from("members_private").select("id,legal_name,address,postcode,phone,siret,vat_number").in("id", others) : Promise.resolve({ data: [] as any[] }),
    supabase.from("members").select("id,pseudo").in("id", (orders ?? []).map((o: any) => (vue === "achats" ? o.seller_id : o.buyer_id))),
  ]);
  const priv = new Map((privs ?? []).map((p: any) => [p.id, p]));
  const pseudo = new Map((pubs ?? []).map((p: any) => [p.id, p.pseudo]));
  const reviewed = new Set((myReviews ?? []).map((r) => r.order_id));

  return (
    <>
      <h1>Échanges</h1>
      <div className="chips">
        <Link className={`chip ${vue === "ventes" ? "on" : ""}`} href="/echanges">Mes ventes</Link>
        <Link className={`chip ${vue === "achats" ? "on" : ""}`} href="/echanges?vue=achats">Mes achats</Link>
        <Link className={`chip ${vue === "lots" ? "on" : ""}`} href="/echanges?vue=lots">Mes lots en ligne</Link>
        <Link className="chip" href="/messages">Messages</Link>
      </div>

      {vue === "lots" && <div className="list">
        {(myOffers ?? []).map((o: any) => (
          <div key={o.id} className="card"><div className="row" style={{ flexWrap: "nowrap" }}><Tile o={o} size={52} /><div><b>{o.name} {o.vintage}</b><br /><span className="hint">{o.qty} × {o.format} · {eur(o.price)} HT</span></div></div>
            <form action={withdrawOffer}><input type="hidden" name="id" value={o.id} /><button className="btn quiet sm">Retirer du catalogue</button></form></div>
        ))}
        {!myOffers?.length && <div className="card"><p className="muted">Aucun lot en ligne.</p><Link className="btn sm primary" href="/publier">Publier un lot</Link></div>}
      </div>}

      {vue !== "lots" && <div className="list">
        {vue === "ventes" && (myGroups ?? []).map((g: any) => {
          const total = (g.pledges ?? []).reduce((a: number, p: any) => a + p.qty, 0);
          return (
            <article key={g.id} className="card">
              <div className="row between"><b>Achat groupé · {g.name}</b><span className="pill accent">{g.status === "valide" ? "Validé" : g.status === "annule" ? "Annulé" : total >= g.min_bottles ? "Minimum atteint" : "En cours"}</span></div>
              <div className="track"><i style={{ width: `${Math.min(100, (total / g.min_bottles) * 100)}%` }} /></div>
              <span className="hint">{total} / {g.min_bottles} bouteilles · {(g.pledges ?? []).length} participants · commission {member.plan === "pro" ? "2" : "8"} % : {eur(total * g.price * (member.plan === "pro" ? 0.02 : 0.08))} HT</span>
              {g.status === "ouvert" && <div className="row">
                {total >= g.min_bottles && <form action={validateGroup}><input type="hidden" name="id" value={g.id} /><button className="btn primary sm">Valider la commande groupée</button></form>}
                <form action={cancelGroup}><input type="hidden" name="id" value={g.id} /><button className="btn quiet sm">Annuler</button></form></div>}
              {g.status === "valide" && <Link className="btn sm" href={`/achats-groupes/${g.id}`}>Voir les participants et bons de livraison</Link>}
            </article>
          );
        })}
        {vue === "achats" && (myPledges ?? []).map((p: any) => p.group && (
          <Link key={p.group.id} className="card" href={`/achats-groupes/${p.group.id}`}><b>Achat groupé · {p.group.name}</b><span className="hint">Votre participation : {p.qty} bt · {eur(p.qty * p.group.price)} HT · {p.group.status === "valide" ? "commande validée" : p.group.status === "annule" ? "annulé" : "en cours"}</span></Link>
        ))}

        {(orders ?? []).map((o: any) => {
          const off = one(o.offer), sh = one(o.shipment), cl = one(o.claim);
          const other = vue === "achats" ? o.seller_id : o.buyer_id, pv: any = priv.get(other);
          const total = Number(o.goods_ht), share = Number(o.shipping_buyer_share);
          const url = sh?.carrier && sh?.tracking ? trackingUrl(sh.carrier, sh.tracking) : null;
          return (
            <article key={o.id} className="card">
              <div className="row" style={{ flexWrap: "nowrap" }}>{off && <Tile o={off} size={52} />}<div><b>{off?.name} {off?.vintage}</b><br /><span className="hint">{o.qty} × {off?.format} · {eur(total)} HT · {o.mode}</span></div></div>
              {steps(o)}
              {!o.confirmed_at && (vue === "ventes" ? (
                <><div className="notice">{pseudo.get(other)} a réservé ce lot. Confirmez avant le {new Date(new Date(o.reserved_at).getTime() + 48 * 3600e3).toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}.</div>
                  <div className="row"><form action={confirmOrder}><input type="hidden" name="id" value={o.id} /><button className="btn primary sm">Confirmer la vente</button></form>
                    <form action={cancelOrder}><input type="hidden" name="id" value={o.id} /><button className="btn sm">Refuser</button></form></div></>
              ) : (
                <div className="row"><span className="hint">En attente de confirmation du vendeur.</span><form action={cancelOrder}><input type="hidden" name="id" value={o.id} /><button className="btn sm">Annuler</button></form></div>
              ))}
              {o.confirmed_at && pv && (
                <dl className="kv"><dt>{vue === "achats" ? "Vendeur" : "Acheteur"}</dt><dd>{pv.legal_name}</dd><dt>Adresse</dt><dd>{pv.address}</dd><dt>Téléphone</dt><dd>{pv.phone}</dd><dt>SIRET</dt><dd>{pv.siret}</dd></dl>
              )}
              {o.confirmed_at && <p className="small">{vue === "ventes"
                ? `Facture à émettre : ${eur(total)} HT${share ? ` + ${eur(share)} de participation à l'envoi` : ""}. Commission du Cercle (${Math.round(o.commission_rate * 100)} %) : ${eur(o.commission_ht)} HT.`
                : `${eur(total + share)} HT à régler à réception de la facture${share ? `, dont ${eur(share)} de participation à l'envoi` : ""}.`}</p>}
              {sh && <p className="small">Document : {DOUANE_DOCS[sh.douane as keyof typeof DOUANE_DOCS]}{sh.douane_ref ? ` n° ${sh.douane_ref}` : ""}{sh.carrier ? ` · ${sh.carrier} ${sh.tracking ?? ""}${sh.insured ? " · assuré" : ""}` : ""}</p>}
              {url && <a className="btn sm block" href={url} target="_blank" rel="noopener">Suivre le colis sur le site {sh.carrier}</a>}
              {vue === "ventes" && o.confirmed_at && !o.shipped_at && <ShipForm id={o.id} colis={o.mode === "colis"} goods={total} />}
              {o.confirmed_at && <div className="row">
                <Link className="btn sm" href={`/documents/bon/${o.id}`}>Bon de livraison</Link>
                {vue === "ventes" && <Link className="btn sm" href={`/documents/facture/${o.id}`}>Facture</Link>}
                <Link className="btn sm" href={`/messages?o=${o.offer_id}&avec=${other}`}>Messages</Link></div>}
              {vue === "achats" && o.shipped_at && !o.received_at && !cl && <>
                <form action={received}><input type="hidden" name="id" value={o.id} /><button className="btn primary sm">J&apos;ai reçu, tout est conforme</button></form>
                <ClaimForm id={o.id} uid={user.id} shippedAt={o.shipped_at} /></>}
              {cl && <div className={cl.status === "regle" ? "notice ok" : "notice"}><b>{cl.status === "regle" ? "Litige réglé" : "Litige ouvert"} : {CLAIM_LABEL[cl.type as keyof typeof CLAIM_LABEL]}</b><br />{cl.details}
                {vue === "ventes" && cl.status === "ouvert" && <form action={settleClaim} style={{ marginTop: 8 }}><input type="hidden" name="id" value={o.id} /><button className="btn primary sm">J&apos;ai remboursé ou remplacé</button></form>}</div>}
              {o.received_at && !reviewed.has(o.id) && (
                <form action={review} className="group" style={{ background: "var(--bg)" }}><input type="hidden" name="id" value={o.id} />
                  <b>Notez cet échange</b>
                  <select name="stars" defaultValue="5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select>
                  <textarea name="comment" placeholder="Un commentaire (facultatif)" /><button className="btn sm">Publier l&apos;avis</button></form>
              )}
            </article>
          );
        })}
        {!orders?.length && !(vue === "ventes" ? myGroups?.length : myPledges?.length) && <div className="card"><p className="muted">{vue === "ventes" ? "Aucune vente pour l'instant." : "Aucun achat pour l'instant."}</p><Link className="btn sm" href={vue === "ventes" ? "/publier" : "/catalogue"}>{vue === "ventes" ? "Publier un lot" : "Parcourir le catalogue"}</Link></div>}
      </div>}
    </>
  );
}
