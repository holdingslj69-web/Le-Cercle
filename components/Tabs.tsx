"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Tabs({ admin }: { admin: boolean }) {
  const p = usePathname();
  const items: [string, string, string][] = [
    ["/catalogue", "Catalogue", "≡"], ["/alertes", "Alertes", "◔"], ["/publier", "Publier", "+"],
    ["/echanges", "Échanges", "⇄"], admin ? ["/admin", "Membres", "✓"] : ["/messages", "Messages", "✉"],
  ];
  return (
    <nav className="tabs" aria-label="Navigation"><div className="in">
      {items.map(([href, label, icon]) => (
        <Link key={href} href={href} className={p.startsWith(href) ? "on" : ""}><b aria-hidden>{icon}</b>{label}</Link>
      ))}
    </div></nav>
  );
}
