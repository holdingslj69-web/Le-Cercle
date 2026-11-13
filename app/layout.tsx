import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { session } from "@/lib/session";
import Tabs from "@/components/Tabs";

export const metadata: Metadata = { title: "Le Cercle des Allocations", description: "Le vin se partage : allocations, vins rares et achats groupés entre professionnels." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#8A2846" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, member, admin } = await session();
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>
        <div className="app">
          <header className="top">
            <Link className="logo" href="/"><i aria-hidden /> Le Cercle</Link>
            {user ? <Link className="small" href="/inscription">{member?.pseudo ?? "Mon compte"}</Link> : <Link className="btn sm" href="/connexion">Se connecter</Link>}
          </header>
          <main>{children}</main>
          <footer className="legal">
            <p>Gratuit pour les acheteurs. Vendeurs : Occasionnel (8 % par vente) ou Pro (29 € HT/mois + 2 %).</p>
            <p><a href={process.env.NEXT_PUBLIC_CGU_URL ?? "/cgu"}>Mentions légales, CGU et confidentialité</a></p>
            <p><b>L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération.</b></p>
            <p>Vente strictement réservée aux professionnels majeurs.</p>
          </footer>
        </div>
        {user && <Tabs admin={admin} />}
      </body>
    </html>
  );
}
