import Link from "next/link";
import { session } from "@/lib/session";

export default async function Home() {
  const { user, member } = await session();
  const cta = !user ? ["/connexion", "Rejoindre le Cercle"] : member?.status === "active" ? ["/catalogue", "Voir le catalogue"] : ["/inscription", "Compléter mon inscription"];
  return (
    <>
      <section className="card">
        <span className="pill accent" style={{ justifySelf: "start" }}>Club privé entre professionnels</span>
        <h1>Le vin se partage.</h1>
        <p className="muted">Des restaurateurs qui gardent leurs allocations et en cèdent une ou deux bouteilles, au prix juste, à ceux qui n&apos;y ont pas accès. Des vignerons qui vendent en direct et lancent des achats groupés. Entre pros, sans spéculation.</p>
        <Link className="btn primary" style={{ justifySelf: "start" }} href={cta[0]}>{cta[1]}</Link>
      </section>
      <section className="card">
        <h2>Trois règles simples</h2>
        <p><b>Le prix juste.</b> Chaque prix est comparé aux ventes passées, en vert, orange ou rouge.</p>
        <p><b>La confiance.</b> Chaque membre est un professionnel vérifié (SIRET, code NAF, Kbis) et chaque bouteille est photographiée.</p>
        <p><b>L&apos;entraide.</b> Acheter est gratuit. Seuls les vendeurs et les vignerons contribuent.</p>
      </section>
    </>
  );
}
