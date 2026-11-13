import { loadOrder } from "@/lib/orders";
import Party from "@/components/Party";
import PrintButton from "@/components/PrintButton";
import { DOUANE_DOCS, trackingUrl } from "@/lib/rules";

export default async function Bon({ params }: { params: { id: string } }) {
  const { o, sp, bp, shipment } = await loadOrder(params.id);
  const f = o.offer;
  const date = new Date(o.shipped_at ?? o.confirmed_at ?? o.reserved_at).toLocaleDateString("fr-FR");
  const track = shipment?.carrier && shipment?.tracking ? trackingUrl(shipment.carrier, shipment.tracking) : null;
  return (
    <>
      {!o.confirmed_at && <div className="notice noprint">La vente n&apos;est pas encore confirmée : les adresses apparaîtront ensuite.</div>}
      <PrintButton />
      <article className="doc">
        <div className="row between"><h1>Bon de livraison</h1><div style={{ textAlign: "right" }}><b>{o.ref}</b><br />{date}</div></div>
        <div className="parties"><Party label="Expéditeur" p={sp} pseudo={o.seller?.pseudo} city={o.seller?.city} /><Party label="Destinataire" p={bp} pseudo={o.buyer?.pseudo} city={o.buyer?.city} /></div>
        <table className="t"><thead><tr><th>Désignation</th><th>Format</th><th>Degré</th><th>Quantité</th><th>Volume total</th></tr></thead>
          <tbody><tr><td>{f.name}{f.vintage ? ` ${f.vintage}` : ""}<br /><span className="fine">{f.producer}{f.appellation ? ` · ${f.appellation}` : ""}{f.spirit_type ? ` · ${f.spirit_type}` : ""}</span></td>
            <td>{f.format}</td><td>{f.abv ? `${String(f.abv).replace(".", ",")} % vol` : "—"}</td><td>{o.qty}</td><td>{volume(f.format, o.qty)}</td></tr></tbody></table>
        <div className="box"><b className="l">Circulation des alcools</b>
          {shipment ? <span>{DOUANE_DOCS[shipment.douane as keyof typeof DOUANE_DOCS]}{shipment.douane_ref ? ` · réf. ${shipment.douane_ref}` : ""}</span> : <span>Document à indiquer par l&apos;expéditeur avant l&apos;envoi.</span>}
          <span>Mode : {o.mode === "colis" ? "colis" : o.mode === "coursier" ? "coursier" : "retrait sur place"}{shipment?.carrier ? ` · ${shipment.carrier} ${shipment.tracking ?? ""}` : ""}{shipment?.insured ? " · envoi assuré" : ""}</span>
          {track && <a className="noprint" href={track} target="_blank" rel="noopener">Suivre le colis</a>}
        </div>
        {o.mode === "colis" && (
          <div className="box"><b className="l">Emballage</b>
            <ol>
              <li>Une bouteille par alvéole : carton à croisillons ou coque en polystyrène ou pulpe moulée. Jamais de bouteilles qui se touchent.</li>
              <li>Bouteilles debout, ou couchées pour les vins à bouchon liège si le trajet dépasse 2 jours.</li>
              <li>Calez pour que rien ne bouge en secouant le carton ; 3 cm de calage au minimum contre chaque paroi.</li>
              <li>Fermez en H avec un adhésif solide ; collez « Fragile » et « Haut » sur deux faces.</li>
              <li>Photographiez le colis fermé et le bordereau avant le dépôt : ces photos servent en cas de litige.</li>
              <li>Glissez ce bon et le document de circulation dans une pochette collée sur le carton.</li>
            </ol></div>
        )}
        <div className="sign"><div>Remis par l&apos;expéditeur, le</div><div>Reçu en bon état par le destinataire, le<br /><span className="fine">Réserves éventuelles (à signaler aussi sur le site sous 48 h)</span></div></div>
        <p className="fine">Vente entre professionnels via Le Cercle des Allocations. Revente aux particuliers interdite par les conditions générales. L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération.</p>
      </article>
    </>
  );
}

function volume(format: string, qty: number) {
  const m = format.match(/([\d,]+)\s*(cl|L)/i);
  if (!m) return "—";
  const litres = (parseFloat(m[1].replace(",", ".")) * (m[2].toLowerCase() === "cl" ? 0.01 : 1)) * qty;
  return `${litres.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} L`;
}
