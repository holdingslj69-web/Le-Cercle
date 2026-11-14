export const metadata = { title: "Le Cercle des Allocations · Bientôt" };

export default function Bientot() {
  return (
    <section className="card" style={{ textAlign: "center", gap: 14, padding: 28 }}>
      <p className="pill accent" style={{ justifySelf: "center" }}>Club privé entre professionnels</p>
      <h1>Le vin se partage.</h1>
      <p className="muted">Le Cercle des Allocations ouvre très bientôt : des restaurateurs, cavistes et vignerons qui se cèdent allocations et vieux millésimes au prix juste, entre pros.</p>
      <p>Les inscriptions ouvriront dans quelques jours.</p>
      <p className="hint">L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération.</p>
    </section>
  );
}
