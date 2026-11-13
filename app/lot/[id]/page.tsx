import Link from "next/link";
import { notFound } from "next/navigation";
import { session, photoUrl } from "@/lib/session";
import { OFFER_SELECT, withPriceLevels, DEMO, type Offer } from "@/lib/offers";
import { Tile, PriceBadge } from "@/components/OfferCard";
import { eur, isProducer } from "@/lib/rules";
import ReserveBox from "./ReserveBox";
import { report } from "./actions";

export default async function Lot({ params, searchParams }: { params: { id: string }; searchParams: { signale?: string } }) {
  const { supabase, user, member, admin } = await session();
  let o: Offer | null = DEMO.find((d) => d.id === params.id) ?? null;
  if (!o) {
    const { data } = await supabase.from("offers").select(OFFER_SELECT).eq("id", params.id).maybeSingle();
    if (!data) notFound();
    o = (await withPriceLevels(supabase, [data as Offer]))[0];
  }
  const lv = o as Offer & { level?: "ok" | "warn" | "high" | null; note?: string };
  const active = member?.status === "active" || admin;
  const mine = o.seller_id === user?.id;
  const producer = isProducer(o.seller?.kind);
  const { data: reviews } = o.demo ? { data: [] } : await supabase.from("reviews").select("stars").eq("target_id", o.seller_id);
  const avg = reviews?.length ? reviews.reduce((a: number, r: { stars: number }) => a + r.stars, 0) / reviews.length : null;

  return (
    <>
      {o.photos?.length ? <div className="gal">{o.photos.map((p) => <img key={p.path} src={photoUrl(p.path)} alt={p.k} />)}</div> : <Tile o={o} size={140} />}
      <div>
        {o.demo && <span className="pill">Exemple</span>}
        <h1>{o.name} {o.vintage}</h1>
        <p className="muted">{[o.producer, o.appellation, o.spirit_type].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="card">
        <div className="row between"><div className={`price ${lv.level ?? ""}`} style={{ fontSize: 28, textAlign: "left" }}>{eur(o.price)} <small>HT / bouteille</small></div><span className="hint">{o.qty} × {o.format}</span></div>
        {o.carton_price && <p className="small">{eur(o.carton_price)} HT / bouteille par carton de {o.carton_size}</p>}
        {!o.demo && <p className="small"><PriceBadge level={lv.level ?? null} long /> <span className="hint">{lv.note}</span></p>}
      </div>
      {!o.demo && (
        <Link className="card" href={`/vendeur/${o.seller_id}`} style={{ textDecoration: "none" }}>
          <div><b>{o.seller?.pseudo}</b> <span className="hint">{o.seller?.kind}</span></div>
          <span className="hint">Établissement vérifié · {avg ? `${"★".repeat(Math.round(avg))} ${avg.toFixed(1)} (${reviews?.length} avis)` : "pas encore d'avis"} · voir toute son offre</span>
        </Link>
      )}
      <dl className="card kv">
        {producer ? <><dt>Vente</dt><dd>Directe du producteur{producer && o.qty > 1 ? " · quantité au choix" : ""}</dd></> : o.purchase_price ? <><dt>Prix d&apos;achat</dt><dd>{eur(o.purchase_price)} HT</dd></> : null}
        {o.abv ? <><dt>Degré</dt><dd>{o.abv} % vol</dd></> : null}
        {o.grapes ? <><dt>Cépages</dt><dd>{o.grapes}</dd></> : null}
        {o.bottled_year ? <><dt>Embouteillage</dt><dd>{o.bottled_year}</dd></> : null}
        <dt>État</dt><dd>{o.condition}</dd>
        <dt>Conservation</dt><dd>{o.storage || "Non précisée"}</dd>
        {o.description ? <><dt>Description</dt><dd>{o.description}</dd></> : null}
        <dt>Retrait</dt><dd>{o.pickup_city}</dd>
        {o.has_invoice ? <><dt>Facture</dt><dd>Facture d&apos;origine disponible</dd></> : null}
      </dl>

      {o.demo ? <p className="muted">Lot d&apos;exemple : il montre à quoi ressemble une fiche, il n&apos;est pas à vendre.</p>
        : mine ? <Link className="btn block" href="/echanges">Gérer dans Échanges</Link>
        : !active ? <Link className="btn primary block" href="/inscription">{member ? "Compte en cours de vérification" : "Créer un compte pour réserver"}</Link>
        : o.status !== "dispo" || o.qty < 1 ? <p className="muted">Ce lot n&apos;est plus disponible.</p>
        : <>
            <ReserveBox offer={{ id: o.id, price: Number(o.price), qty: o.qty, format: o.format, carton_price: o.carton_price, carton_size: o.carton_size, split: producer && o.qty > 1 }} />
            <Link className="btn block" href={`/messages?o=${o.id}&avec=${o.seller_id}`}>Poser une question au vendeur</Link>
            {searchParams.signale ? <div className="notice ok">Signalement envoyé. Merci.</div> : (
              <details className="card"><summary className="small">Signaler ce lot</summary>
                <form action={report}>
                  <input type="hidden" name="offer" value={o.id} />
                  <select name="reason" defaultValue="prix_abusif"><option value="prix_abusif">Prix abusif</option><option value="description_trompeuse">Description trompeuse</option><option value="comportement">Comportement du vendeur</option></select>
                  {isProducer(member?.kind) && <label className="check"><input type="checkbox" name="producer" /> Je suis le producteur de ce vin</label>}
                  <textarea name="details" placeholder="Précisions (facultatif)" />
                  <button className="btn sm" type="submit">Envoyer le signalement</button>
                </form>
              </details>
            )}
          </>}
    </>
  );
}
