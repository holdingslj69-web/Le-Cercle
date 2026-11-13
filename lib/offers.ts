import type { SupabaseClient } from "@supabase/supabase-js";
import { priceLevel, type PriceLevel } from "./rules";

export type Offer = {
  id: string; seller_id: string; category: string; name: string; producer: string; appellation: string | null; spirit_type: string | null;
  vintage: string | null; abv: number | null; grapes: string | null; bottled_year: string | null; format: string; qty: number;
  purchase_price: number | null; price: number; carton_price: number | null; carton_size: number | null; has_invoice: boolean;
  condition: string; storage: string | null; description: string | null; pickup_city: string; photos: { k: string; path: string }[];
  status: string; created_at: string; seller?: { pseudo: string; kind: string } | null; demo?: boolean;
};

export const OFFER_SELECT = "*, seller:members!offers_seller_id_fkey(pseudo,kind)";

/** Indicateur de prix pour une liste de lots (une requête par vin distinct). */
export async function withPriceLevels(supabase: SupabaseClient, offers: Offer[]) {
  const keys = new Map<string, Offer>();
  offers.forEach((o) => keys.set([o.producer, o.name, o.vintage ?? "", o.format].join("|").toLowerCase(), o));
  const refs = new Map<string, { median: number | null; n: number }>();
  await Promise.all([...keys.entries()].map(async ([k, o]) => {
    const { data } = await supabase.rpc("price_reference", { p_producer: o.producer, p_name: o.name, p_vintage: o.vintage ?? "", p_format: o.format });
    const row = Array.isArray(data) ? data[0] : data;
    refs.set(k, { median: row?.median ? Number(row.median) : null, n: row?.n ?? 0 });
  }));
  return offers.map((o) => {
    const ref = refs.get([o.producer, o.name, o.vintage ?? "", o.format].join("|").toLowerCase()) ?? null;
    return { ...o, ...priceLevel(Number(o.price), ref, o.purchase_price, o.vintage, o.category) } as Offer & { level: PriceLevel; note: string };
  });
}

export const DEMO: Offer[] = [
  { id: "demo-1", demo: true, seller_id: "", category: "Vin", name: "Cornas Chaillot", producer: "Domaine exemple", appellation: "Cornas", spirit_type: null, vintage: "2019", abv: 13.5, grapes: "Syrah", bottled_year: null, format: "75 cl", qty: 2, purchase_price: null, price: 78, carton_price: null, carton_size: null, has_invoice: true, condition: "Parfait état", storage: "Cave enterrée à 13 °C", description: null, pickup_city: "Lyon", photos: [], status: "dispo", created_at: "" },
  { id: "demo-2", demo: true, seller_id: "", category: "Spiritueux", name: "Chartreuse V.E.P. verte", producer: "Maison exemple", appellation: null, spirit_type: "Chartreuse", vintage: null, abv: 54, grapes: null, bottled_year: "2014", format: "1 L", qty: 1, purchase_price: null, price: 190, carton_price: null, carton_size: null, has_invoice: false, condition: "Parfait état", storage: null, description: null, pickup_city: "Lyon", photos: [], status: "dispo", created_at: "" },
  { id: "demo-3", demo: true, seller_id: "", category: "Vin", name: "Morgon Côte du Py", producer: "Vigneron exemple", appellation: "Morgon", spirit_type: null, vintage: "2022", abv: 13, grapes: "Gamay", bottled_year: null, format: "75 cl", qty: 24, purchase_price: null, price: 19, carton_price: 17, carton_size: 6, has_invoice: false, condition: "Parfait état", storage: null, description: null, pickup_city: "Villié-Morgon", photos: [], status: "dispo", created_at: "" },
];
