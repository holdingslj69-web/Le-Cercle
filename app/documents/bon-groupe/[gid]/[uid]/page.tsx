import { notFound } from "next/navigation";
import { requireActive } from "@/lib/session";
import Party from "@/components/Party";
import PrintButton from "@/components/PrintButton";
import { eur } from "@/lib/rules";

/** Bon de livraison d'un participant à un achat groupé validé. */
export default async function BonGroupe({ params }: { params: { gid: string; uid: string } }) {
  const { supabase, user, admin } = await requireActive();
  const { data: g } = await supabase.from("group_buys").select("*, seller:members!group_buys_seller_id_fkey(pseudo,city)").eq("id", params.gid).maybeSingle();
  if (!g) notFound();
  if (g.seller_id !== user.id && params.uid !== user.id && !admin) notFound();
  const [{ data: pl }, { data: sp }, { data: bp }, { data: bm }] = await Promise.all([
    supabase.from("pledges").select("*").eq("group_id", g.id).eq("member_id", params.uid).maybeSingle(),
    supabase.from("members_private").select("*").eq("id", g.seller_id).maybeSingle(),
    supabase.from("members_private").select("*").eq("id", params.uid).maybeSingle(),
    supabase.from("members").select("pseudo,city").eq("id", params.uid).maybeSingle(),
  ]);
  if (!pl) notFound();
  return (
    <>
      {g.status !== "valide" && <div className="notice noprint">L&apos;achat groupé n&apos;est pas encore validé.</div>}
      <PrintButton />
      <article className="doc">
        <div className="row between"><h1>Bon de livraison · achat groupé</h1><div style={{ textAlign: "right" }}><b>{g.ref ?? g.id.slice(0, 8).toUpperCase()}</b><br />{new Date(g.validated_at ?? g.deadline).toLocaleDateString("fr-FR")}</div></div>
        <div className="parties"><Party label="Expéditeur" p={sp} pseudo={g.seller?.pseudo} city={g.seller?.city} /><Party label="Destinataire" p={bp} pseudo={bm?.pseudo} city={bm?.city} /></div>
        <table className="t"><thead><tr><th>Désignation</th><th>Format</th><th>Quantité</th><th>Prix HT</th><th>Total HT</th></tr></thead>
          <tbody><tr><td>{g.name}{g.vintage ? ` ${g.vintage}` : ""}<br /><span className="fine">{g.producer}{g.appellation ? ` · ${g.appellation}` : ""}</span></td>
            <td>{g.format}</td><td>{pl.qty}</td><td>{eur(g.price)}</td><td>{eur(pl.qty * Number(g.price))}</td></tr></tbody></table>
        {g.delivery && <div className="box"><b className="l">Livraison</b><span>{g.delivery}</span></div>}
        <div className="sign"><div>Remis par l&apos;expéditeur, le</div><div>Reçu en bon état par le destinataire, le</div></div>
        <p className="fine">Vente entre professionnels via Le Cercle des Allocations. L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération.</p>
      </article>
    </>
  );
}
