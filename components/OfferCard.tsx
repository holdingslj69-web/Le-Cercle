import Link from "next/link";
import { eur, PRICE_LABEL, half, shippingEstimate, type PriceLevel } from "@/lib/rules";
import { photoUrl } from "@/lib/session";
import type { Offer } from "@/lib/offers";

export function Tile({ o, size = 76 }: { o: Pick<Offer, "photos" | "vintage" | "category">; size?: number }) {
  const ph = o.photos?.find((p) => p.k === "general") ?? o.photos?.[0];
  return (
    <div className="tile" style={{ width: size, height: size * 1.2 }}>
      {ph ? <img src={photoUrl(ph.path)} alt="" loading="lazy" /> : <span>{o.vintage || (o.category === "Spiritueux" ? "✦" : "NM")}</span>}
    </div>
  );
}

export function PriceBadge({ level, long }: { level: PriceLevel; long?: boolean }) {
  if (!level) return long ? <span className="pp none">Sans référence</span> : null;
  return <span className={`pp ${level}`}>{PRICE_LABEL[level]}</span>;
}

export default function OfferCard({ o }: { o: Offer & { level?: PriceLevel } }) {
  const sub = o.category === "Spiritueux" ? [o.producer, o.spirit_type, o.abv ? `${o.abv} % vol` : ""] : [o.producer, o.appellation];
  const delivered = Number(o.price) + half(shippingEstimate(o.format, o.qty, o.price * o.qty)) / o.qty;
  return (
    <Link className="offer" href={o.demo ? `/lot/${o.id}` : `/lot/${o.id}`}>
      <Tile o={o} />
      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <div className="o-name">
          {o.demo && <span className="pill">Exemple</span>} {o.seller && ["Vigneron / domaine", "Négociant", "Distillerie", "Grossiste / distributeur"].includes(o.seller.kind) && <span className="pill ok">Producteur</span>} {o.name}
        </div>
        <div className="o-dom">{sub.filter(Boolean).join(" · ")}</div>
        <div className="row between" style={{ alignItems: "flex-end" }}>
          <span className="hint">{o.qty} × {o.format} · {o.pickup_city}{o.photos?.length ? ` · ${o.photos.length} photos` : ""}</span>
          <div className={`price ${o.level ?? ""}`}>{eur(o.price)}<small> HT</small><br /><PriceBadge level={o.level ?? null} /><br /><small>livré {eur(delivered)} / bt</small></div>
        </div>
      </div>
    </Link>
  );
}
