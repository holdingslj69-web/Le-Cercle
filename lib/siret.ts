import { nafAllowed, normalizeNaf, siretValid, vatFromSiren, NAF } from "./rules";

export type SiretInfo = {
  ok: true; siret: string; siren: string; vat: string; name: string; address: string; postcode: string; city: string;
  naf: string; nafLabel: string; nafAllowed: boolean; active: boolean;
} | { ok: false; error: string; status: number };

/** Interroge l'API publique Recherche d'entreprises (data.gouv.fr, gratuite, sans clé). */
export async function lookupSiret(raw: string): Promise<SiretInfo> {
  const siret = raw.replace(/\s/g, "");
  if (!siretValid(siret)) return { ok: false, error: "Ce numéro SIRET n'est pas valide.", status: 400 };
  try {
    const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    const ent = data?.results?.[0];
    const etab = ent?.matching_etablissements?.find((e: { siret?: string }) => e.siret === siret) ?? (ent?.siege?.siret === siret ? ent.siege : null);
    if (!ent || !etab) return { ok: false, error: "Aucun établissement trouvé pour ce SIRET.", status: 404 };
    const naf = normalizeNaf(etab.activite_principale ?? ent.activite_principale ?? "");
    return {
      ok: true, siret, siren: siret.slice(0, 9), vat: vatFromSiren(siret.slice(0, 9)),
      name: ent.nom_complet ?? ent.nom_raison_sociale ?? "", address: etab.adresse ?? "", postcode: etab.code_postal ?? "",
      city: etab.libelle_commune ?? "", naf, nafLabel: NAF[naf] ?? etab.libelle_activite_principale ?? "",
      nafAllowed: nafAllowed(naf), active: (etab.etat_administratif ?? ent.etat_administratif) === "A",
    };
  } catch {
    return { ok: false, error: "Le registre des entreprises ne répond pas. Réessayez dans un instant.", status: 502 };
  }
}
