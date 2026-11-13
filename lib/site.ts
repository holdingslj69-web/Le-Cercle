import { headers } from "next/headers";

/** Adresse publique du site, déduite de la requête (fonctionne sur Netlify, Vercel et en local). */
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && !env.includes("localhost")) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
