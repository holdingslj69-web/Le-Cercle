type P = { legal_name?: string; address?: string; postcode?: string; siret?: string; vat_number?: string; excise_number?: string | null; phone?: string; licence?: string } | null;
export default function Party({ label, p, pseudo, city }: { label: string; p: P; pseudo?: string; city?: string }) {
  return (
    <div className="box">
      <b className="l">{label}</b>
      <b>{p?.legal_name ?? pseudo ?? "—"}</b>
      {p?.address && <span>{p.address}</span>}
      {(p?.postcode || city) && <span>{p?.postcode} {city}</span>}
      {p?.siret && <span>SIRET {p.siret}</span>}
      {p?.vat_number && <span>TVA {p.vat_number}</span>}
      {p?.excise_number && <span>N° d&apos;accise {p.excise_number}</span>}
      {p?.phone && <span>Tél. {p.phone}</span>}
      {!p && <span className="fine">Coordonnées visibles après confirmation de la vente.</span>}
    </div>
  );
}
