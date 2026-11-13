// Règles métier du Cercle, sans dépendance : utilisées par le site et par les tests.

export const COMMISSION = { occasionnel: 0.08, pro: 0.02 } as const;
export const PRO_MONTHLY_FEE = 29;
export const RESERVATION_HOURS = 48;
export const INSURANCE_THRESHOLD = 150;

export const KINDS = [
  "Restaurant", "Bar / bar à vin", "Hôtel", "Traiteur", "Caviste / épicerie fine",
  "Grossiste / distributeur", "Vigneron / domaine", "Négociant", "Distillerie",
] as const;
export type Kind = (typeof KINDS)[number];
export const PRODUCER_KINDS: readonly string[] = ["Vigneron / domaine", "Négociant", "Distillerie", "Grossiste / distributeur"];
export const isProducer = (kind?: string | null) => !!kind && PRODUCER_KINDS.includes(kind);

export const NAF: Record<string, string> = {
  "56.10A": "Restauration traditionnelle",
  "56.10B": "Cafétérias et autres libres-services",
  "56.10C": "Restauration de type rapide",
  "56.21Z": "Services des traiteurs",
  "56.29B": "Autres services de restauration",
  "56.30Z": "Débits de boissons",
  "55.10Z": "Hôtels et hébergement similaire",
  "47.25Z": "Commerce de détail de boissons",
  "47.29Z": "Autres commerces de détail alimentaires spécialisés",
  "46.34Z": "Commerce de gros de boissons",
  "01.21Z": "Culture de la vigne",
  "11.02A": "Fabrication de vins effervescents",
  "11.02B": "Vinification",
  "11.03Z": "Fabrication de cidre et de vins de fruits",
  "11.01Z": "Production de boissons alcooliques distillées",
};
/** L'INSEE écrit parfois "5610A" : on normalise en "56.10A". */
export const normalizeNaf = (code: string) => {
  const c = code.replace(/\s/g, "").toUpperCase();
  return /^\d{4}[A-Z]$/.test(c) ? `${c.slice(0, 2)}.${c.slice(2)}` : c;
};
export const nafAllowed = (code: string) => normalizeNaf(code) in NAF;

/** Contrôle de Luhn du SIRET (La Poste, SIREN 356000000, fait exception). */
export function siretValid(raw: string): boolean {
  const s = raw.replace(/\s/g, "");
  if (!/^\d{14}$/.test(s)) return false;
  if (s.startsWith("356000000")) return true;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(s[13 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
/** Numéro de TVA intracommunautaire français déduit du SIREN. */
export const vatFromSiren = (siren: string) =>
  "FR" + String((12 + 3 * (Number(siren) % 97)) % 97).padStart(2, "0") + siren;

export const CATEGORIES = ["Vin", "Champagne", "Spiritueux"] as const;
export const FORMATS_WINE = ["37,5 cl", "75 cl", "Magnum 150 cl", "Jéroboam 300 cl"];
export const FORMATS_SPIRIT = ["35 cl", "50 cl", "70 cl", "1 L", "1,5 L"];
export const SPIRIT_TYPES = ["Whisky", "Chartreuse", "Cognac", "Armagnac", "Rhum", "Calvados", "Liqueur", "Eau-de-vie", "Autre"];
export const CONDITIONS = ["Parfait état", "Niveau légèrement bas", "Étiquette abîmée", "Capsule abîmée", "Étui abîmé ou absent"];

export const PHOTO_SLOTS: Record<string, [string, string, boolean][]> = {
  Vin: [["general", "Vue générale", true], ["face", "Étiquette", true], ["dos", "Contre-étiquette", true], ["capsule", "Capsule et bouchon", true], ["niveau", "Niveau", true]],
  Champagne: [["general", "Vue générale", true], ["face", "Étiquette", true], ["dos", "Contre-étiquette", true], ["capsule", "Coiffe et muselet", true], ["niveau", "Niveau", true]],
  Spiritueux: [["general", "Vue générale", true], ["face", "Étiquette", true], ["dos", "Contre-étiquette", true], ["capsule", "Bouchon et scellé", true], ["niveau", "Niveau", true], ["etui", "Étui ou coffret", false]],
};
/** Photos demandées : un producteur fournit vue générale + étiquette ; sinon toutes, + le lot complet si plusieurs bouteilles. */
export function requiredPhotos(category: string, qty: number, producer: boolean): [string, string, boolean][] {
  const base = PHOTO_SLOTS[category] ?? PHOTO_SLOTS.Vin;
  if (producer) return base.slice(0, 2);
  return qty > 1 ? [...base, ["lot", "Le lot complet", true]] : base;
}

// ---- Loi Évin : seules les informations objectives sont permises
const EVIN = /ivresse|\bivre\b|s['’]enivrer|euphori|festif|faire la f[eê]te|succ[eè]s|r[ée]ussite|s[ée]duction|s[ée]duis|sexy|aphrodisi|viril|bien[- ]?[eê]tre|d[ée]tente|relaxant|anti[- ]?stress|d[ée]compresser|[ée]nergisant|tonique|bon pour la sant|bienfait|gu[ée]ri|rem[eè]de|sans mod[ée]ration|[àa] volont[ée]|cul sec|oublier vos soucis|addictif/gi;
export function evinTerms(text: string): string[] {
  const out = new Set<string>();
  for (const m of String(text || "").matchAll(EVIN)) out.add(m[0].toLowerCase());
  return [...out];
}

// ---- Masquage des coordonnées avant confirmation d'une vente
export function maskContacts(t: string): string {
  return t
    .replace(/https?:\/\/\S+|www\.\S+/gi, "•••")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "•••")
    .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/gi, "•••")
    .replace(/\+?\d[\d .\-()\/]{6,}\d/g, (m) => (m.replace(/\D/g, "").length >= 9 ? "•••" : m));
}

// ---- Frais d'envoi partagés (estimation Colissimo 2026 + emballage + assurance)
const WEIGHT: Record<string, number> = { "37,5 cl": 0.8, "75 cl": 1.5, "Magnum 150 cl": 3, "Jéroboam 300 cl": 6, "35 cl": 0.7, "50 cl": 1, "70 cl": 1.4, "1 L": 1.8, "1,5 L": 2.8 };
const COLISSIMO: [number, number][] = [[1, 9.59], [2, 11.19], [5, 17.39], [10, 25.29], [15, 31.99], [30, 39.59]];
const PACKING = 3;
const r2 = (x: number) => Math.round(x * 100) / 100;
export function postageEstimate(format: string, qty: number): number {
  const w = WEIGHT[format] ?? 1.5;
  const perBox = Math.max(1, Math.min(6, Math.floor(12 / w)));
  let left = Math.max(1, qty), total = 0;
  while (left > 0) {
    const n = Math.min(perBox, left); left -= n;
    const kg = n * w + 0.6;
    total += (COLISSIMO.find(([k]) => kg <= k) ?? COLISSIMO[COLISSIMO.length - 1])[1] + PACKING;
  }
  return r2(total);
}
export const insuranceFee = (goods: number) => (goods > INSURANCE_THRESHOLD ? Math.max(2, r2(goods * 0.015)) : 0);
export const shippingEstimate = (format: string, qty: number, goods: number) => r2(postageEstimate(format, qty) + insuranceFee(goods));
export const half = (x: number) => r2(x / 2);

// ---- Prix au carton
export const unitPriceFor = (price: number, qty: number, cartonPrice?: number | null, cartonSize?: number | null) =>
  cartonPrice && cartonSize && qty >= cartonSize ? Number(cartonPrice) : Number(price);

// ---- Indicateur de prix
export type PriceLevel = "ok" | "warn" | "high" | null;
export function priceLevel(price: number, ref: { median: number | null; n: number } | null, purchase?: number | null, vintage?: string | null, category?: string): { level: PriceLevel; note: string } {
  if (ref && ref.n > 0 && ref.median) {
    const r = price / ref.median;
    const level: PriceLevel = r <= 1.1 ? "ok" : r <= 1.3 ? "warn" : "high";
    const d = Math.round((r - 1) * 100);
    return { level, note: `Médiane des ${ref.n} dernière${ref.n > 1 ? "s" : ""} vente${ref.n > 1 ? "s" : ""} : ${eur(ref.median)}${d ? ` (${d > 0 ? "+" : ""}${d} %)` : ""}` };
  }
  const yr = parseInt(String(vintage || ""), 10);
  const recent = category !== "Spiritueux" && yr > 1900 && new Date().getFullYear() - yr <= 6;
  if (purchase && purchase > 0 && recent) {
    const r = price / purchase;
    return { level: r <= 1.5 ? "ok" : r <= 2.5 ? "warn" : "high", note: `Aucune vente de référence. Prix d'achat × ${r.toFixed(1).replace(".", ",")}` };
  }
  return { level: null, note: "Pas encore de vente de référence pour ce vin." };
}
export const PRICE_LABEL = { ok: "Prix cohérent", warn: "Un peu élevé", high: "Très au-dessus du marché" } as const;

export const eur = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export const DOUANE_DOCS = {
  crd: "Capsules CRD (droits acquittés)",
  bl: "Bon de livraison valant document d'accompagnement",
  dsa: "DSA (document simplifié d'accompagnement)",
  dae: "DAE émis sur GAMMA (droits suspendus)",
} as const;

export const CARRIERS = ["Colissimo", "Chronopost", "Mondial Relay", "DPD", "UPS", "Autre"];
export function trackingUrl(carrier: string, n: string): string | null {
  const x = encodeURIComponent((n || "").trim());
  const map: Record<string, string> = {
    Colissimo: `https://www.laposte.fr/outils/suivre-vos-envois?code=${x}`,
    Chronopost: `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${x}`,
    "Mondial Relay": `https://www.mondialrelay.fr/suivi-de-colis/?NumeroExpedition=${x}`,
    DPD: `https://trace.dpd.fr/fr/trace/${x}`,
    UPS: `https://www.ups.com/track?loc=fr_FR&tracknum=${x}`,
  };
  return map[carrier] ?? null;
}

export const CLAIM_LABEL = { casse: "Bouteille cassée ou abîmée", incomplet: "Colis incomplet ou non conforme", nonrecu: "Colis non reçu" } as const;
export const LOST_AFTER_DAYS = 5;
