import { loadOrder } from "@/lib/orders";
import Party from "@/components/Party";
import PrintButton from "@/components/PrintButton";
import { eur } from "@/lib/rules";

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Facture du vendeur à l'acheteur. Le vendeur la numérote dans sa propre série de factures. */
export default async function Facture({ params, searchParams }: { params: { id: string }; searchParams: { num?: string; tva?: string; date?: string } }) {
  const { o, sp, bp, isSeller, admin } = await loadOrder(params.id);
  if (!isSeller && !admin) return <div className="notice">La facture est émise par le vendeur : demandez-la-lui dans la messagerie de la commande.</div>;
  if (!o.confirmed_at) return <div className="notice">Confirmez d&apos;abord la vente pour émettre la facture.</div>;
  const f = o.offer;
  const num = (searchParams.num ?? "").slice(0, 30), franchise = searchParams.tva === "0";
  const date = searchParams.date || new Date(o.confirmed_at).toISOString().slice(0, 10);
  const due = new Date(date); due.setDate(due.getDate() + 30);
  const lines: [string, number, number][] = [[`${f.name}${f.vintage ? ` ${f.vintage}` : ""} · ${f.producer} · ${f.format}`, o.qty, Number(o.unit_price)]];
  if (o.mode === "colis" && Number(o.shipping_buyer_share) > 0) lines.push(["Participation aux frais d'envoi (moitié du port, de l'emballage et de l'assurance)", 1, Number(o.shipping_buyer_share)]);
  const ht = r2(lines.reduce((a, [, q, p]) => a + q * p, 0)), tva = franchise ? 0 : r2(ht * 0.2);

  return (
    <>
      <form className="card noprint" method="get">
        <b>Avant d&apos;imprimer</b>
        <div className="grid2">
          <div className="field"><label htmlFor="num">Numéro de facture *</label><input id="num" name="num" defaultValue={num} placeholder="ex. 2026-0042" /><span className="hint">Suite chronologique de vos propres factures, sans trou.</span></div>
          <div className="field"><label htmlFor="date">Date de facture</label><input id="date" name="date" type="date" defaultValue={date} /></div>
        </div>
        <label className="check"><input type="checkbox" name="tva" value="0" defaultChecked={franchise} /> Je suis en franchise en base de TVA</label>
        <button className="btn sm">Mettre à jour</button>
      </form>
      {num ? <PrintButton /> : <div className="notice noprint">Indiquez le numéro de facture pour l&apos;imprimer.</div>}
      <article className="doc">
        <div className="row between"><h1>Facture {num || "—"}</h1><div style={{ textAlign: "right" }}>Date : {new Date(date).toLocaleDateString("fr-FR")}<br />Commande {o.ref}</div></div>
        <div className="parties"><Party label="Vendeur" p={sp} pseudo={o.seller?.pseudo} city={o.seller?.city} /><Party label="Client" p={bp} pseudo={o.buyer?.pseudo} city={o.buyer?.city} /></div>
        <table className="t"><thead><tr><th>Désignation</th><th>Qté</th><th>Prix unitaire HT</th><th>Total HT</th></tr></thead>
          <tbody>{lines.map(([d, q, p]) => <tr key={d}><td>{d}</td><td>{q}</td><td>{eur(p)}</td><td>{eur(r2(q * p))}</td></tr>)}</tbody></table>
        <div className="tot"><span>Total HT</span><b>{eur(ht)}</b><span>TVA {franchise ? "" : "20 %"}</span><b>{eur(tva)}</b><span className="g">Total TTC</span><span className="g">{eur(ht + tva)}</span></div>
        <div className="fine" style={{ display: "grid", gap: 4 }}>
          {franchise && <p>TVA non applicable, article 293 B du CGI.</p>}
          <p>Droits d&apos;accises acquittés{f.category === "Spiritueux" ? ", cotisation sécurité sociale incluse" : ""}, sauf mention d&apos;un DAE sur le bon de livraison.</p>
          <p>Paiement encaissé via Le Cercle des Allocations. Échéance : {due.toLocaleDateString("fr-FR")}. Pas d&apos;escompte pour paiement anticipé.</p>
          <p>En cas de retard de paiement : pénalités au taux de trois fois le taux d&apos;intérêt légal et indemnité forfaitaire pour frais de recouvrement de 40 € (articles L441-10 et D441-5 du Code de commerce).</p>
          <p>Vente entre professionnels. Revente aux particuliers interdite par les conditions générales du Cercle.</p>
        </div>
      </article>
    </>
  );
}
