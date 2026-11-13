import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActive } from "@/lib/session";
import { OFFER_SELECT, withPriceLevels, type Offer } from "@/lib/offers";
import OfferCard from "@/components/OfferCard";
import { eur } from "@/lib/rules";

export default async function Vendeur({ params }: { params: { id: string } }) {
  const { supabase, user } = await requireActive();
  const { data: m } = await supabase.from("members").select("*").eq("id", params.id).maybeSingle();
  if (!m) notFound();
  const [{ data: offers }, { data: groups }, { data: reviews }] = await Promise.all([
    supabase.from("offers").select(OFFER_SELECT).eq("seller_id", params.id).eq("status", "dispo").gt("qty", 0).order("created_at", { ascending: false }),
    supabase.from("group_buys").select("id,name,producer,price,min_bottles,deadline").eq("seller_id", params.id).eq("status", "ouvert"),
    supabase.from("reviews").select("stars,comment,created_at").eq("target_id", params.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const priced = await withPriceLevels(supabase, (offers ?? []) as Offer[]);
  const avg = reviews?.length ? reviews.reduce((a, r) => a + r.stars, 0) / reviews.length : null;
  return (
    <>
      <div><h1>{m.pseudo}</h1><p className="muted">{m.kind} · {m.city}</p>
        <p className="small">{avg ? `${"★".repeat(Math.round(avg))} ${avg.toFixed(1)} · ${reviews!.length} avis` : "Pas encore d'avis"}</p></div>
      {params.id !== user.id && priced[0] && <Link className="btn" href={`/messages?o=${priced[0].id}&avec=${params.id}`}>Écrire à {m.pseudo}</Link>}
      {!!groups?.length && <><h2>Achats groupés en cours</h2>{groups.map((g) => <Link key={g.id} className="card" href={`/achats-groupes/${g.id}`}><b>{g.name}</b><span className="hint">{eur(g.price)} HT / bt · minimum {g.min_bottles} bouteilles</span></Link>)}</>}
      <h2>{priced.length} lot{priced.length > 1 ? "s" : ""} disponible{priced.length > 1 ? "s" : ""}</h2>
      <div className="list">{priced.map((o) => <OfferCard key={o.id} o={o} />)}</div>
      {!!reviews?.length && <><h2>Avis</h2>{reviews.map((r, i) => <div key={i} className="card small">{"★".repeat(r.stars)} {r.comment}</div>)}</>}
    </>
  );
}
