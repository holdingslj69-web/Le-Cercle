"use client";
export default function PrintButton({ label = "Imprimer ou enregistrer en PDF" }: { label?: string }) {
  return <button type="button" className="btn primary noprint" onClick={() => window.print()}>{label}</button>;
}
