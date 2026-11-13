import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActive, photoUrl } from "@/lib/session";
import { Tile } from "@/components/OfferCard";
import { eur } from "@/lib/rules";
import { pledge, leave } from "../actions";

export default async function Groupe({ params }: { params: { id: string } }) {
  const { supabase, user } = await requireActive();
  const { data: g } = await supabase.from("group_buys").select("*, seller:members!group_buys_seller_id_fkey(pseudo,kind), pledges(qty, member_id)").eq("id", params.id).maybeSingle();
  if (!g) notFound();
  const pl: { qty: number; member_id: string }[] = g.pledges ?? [];
  const total = pl.reduce((a, p) => a + p.qty, 0), mine = pl.find((p) => p.member_id === user.id)?.qty ?? 0;
  const open = g.status === "ouvert" && new Date(g.deadline) > new Date(), seller = g.seller_id === user.id;
  const saving = g.usual_price && g.usual_price > g.price ? Math.round((1 - g.price / g.usual_price) * 100) : 0;
  let parts: any[] = [];
  if (seller && g.status === "valide" && pl.length) {
    const { data } = await supabase.from("members_private").select("id,legal_name,address,phone,siret").in("id", pl.map((p) => p.member_id));
    parts = (data ?? []).map((d) => ({ ...d, qty: pl.find((p) => p.member_id === d.id)?.qty ?? 0 }));
  }
  const { data: sellerPriv } = !seller && g.status === "valide" && mine ? await supabase.from("members_private").select("legal_name,address,phone").eq("id", g.seller_id).maybeSingle() : { data: null };
  return (
    <>
      {g.photos?.length ? <div className="gal">{g.photos.map((p: any) => <img key={p.path} src={photoUrl(p.path)} alt={p.k} />)}</div> : <Tile o={g} size={140} />}
      <div><span className="pill accent">Achat groupé</span><h1>{g.name} {g.vintage}</h1><p className="muted">{g.producer}{g.appellation ? ` · ${g.appellation}` : ""} · {g.format}</p></div>
      <div className="card">
        <div className="price" style={{ fontSize: 28, textAlign: "left" }}>{eur(g.price)} <small>HT / bouteille</small></div>
        {saving > 0 && <span className="hint">au lieu de {eur(g.usual_price)}, soit −{saving} %</span>}
        <div className="track"><i style={{ width: `${Math.min(100, (total / g.min_bottles) * 100)}%` }} /></div>
        <span className="hint">{total} / {g.min_bottles} bouteilles · {pl.length} participant{pl.length > 1 ? "s" : ""} · jusqu&apos;au {new Date(g.deadline).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
      </div>
      <dl className="card kv"><dt>Producteur</dt><dd><Link href={`/vendeur/${g.seller_id}`}>{g.seller?.pseudo}</Link></dd><dt>Livraison</dt><dd>{g.delivery || "À convenir"}</dd>{g.description && <><dt>Description</dt><dd>{g.description}</dd></>}</dl>
      {!seller && open && (
        <form action={pledge} className="group">
          <input type="hidden" name="id" value={g.id} />
          <div className="field"><label htmlFor="qty">Ma quantité</label><input id="qty" name="qty" type="number" min={1} max={600} defaultValue={mine || 6} /></div>
          <button className="btn primary" type="submit">{mine ? "Modifier ma participation" : "Je participe"}</button>
          <p className="hint">Rien à payer maintenant. Si le minimum est atteint, le producteur valide et vous facture votre part.</p>
        </form>
      )}
      {!seller && open && mine > 0 && <form action={leave}><input type="hidden" name="id" value={g.id} /><button className="btn quiet sm">Me retirer</button></form>}
      {!seller && <Link className="btn" href={`/messages?g=${g.id}&avec=${g.seller_id}`}>Poser une question</Link>}
      {sellerPriv && <div className="card"><b>Commande validée</b><span>{sellerPriv.legal_name} · {sellerPriv.address} · {sellerPriv.phone}</span><span className="hint">Le producteur vous facture {mine} bt · {eur(mine * g.price)} HT.</span></div>}
      {parts.length > 0 && <><h2>Participants</h2>{parts.map((p) => (
        <div key={p.id} className="card"><b>{p.legal_name} · {p.qty} bt · {eur(p.qty * g.price)} HT</b><span className="hint">{p.address} · {p.phone} · SIRET {p.siret}</span>
          <Link className="btn sm" href={`/documents/bon-groupe/${g.id}/${p.id}`}>Bon de livraison</Link></div>))}</>}
    </>
  );
}
