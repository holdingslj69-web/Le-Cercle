"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { evinTerms, isProducer, requiredPhotos, CATEGORIES } from "@/lib/rules";

type R = { error?: string };

async function common(fd: FormData) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée : reconnectez-vous." } as const;
  const { data: m } = await supabase.from("members").select("kind,status").eq("id", user.id).single();
  if (m?.status !== "active") return { error: "Votre compte doit être validé pour publier." } as const;
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const n = (k: string) => (v(k) ? Number(v(k).replace(",", ".")) : null);
  const category = v("category");
  if (!(CATEGORIES as readonly string[]).includes(category)) return { error: "Choisissez une catégorie." } as const;
  if (!v("name") || !v("producer")) return { error: "Indiquez le nom et le producteur." } as const;
  const evin = evinTerms([v("name"), v("storage"), v("description"), v("delivery")].join(" "));
  if (evin.length) return { error: `Loi Évin : retirez « ${evin.join(" », « ")} » de votre texte. Seules les informations objectives sont permises.` } as const;
  let photos: { k: string; path: string }[] = [];
  try { photos = JSON.parse(v("photos") || "[]"); } catch { /* vide */ }
  photos = photos.filter((p) => typeof p.path === "string" && p.path.startsWith(user.id + "/"));
  return { supabase, user, kind: m.kind as string, v, n, category, photos } as const;
}

export async function publishOffer(_: unknown, fd: FormData): Promise<R> {
  const c = await common(fd); if ("error" in c) return { error: c.error };
  const { supabase, user, kind, v, n, category, photos } = c;
  const producer = isProducer(kind), qty = Number(v("qty")) || 1, price = n("price");
  if (!price || price <= 0) return { error: "Indiquez votre prix de vente." };
  const missing = requiredPhotos(category, qty, producer).filter(([k, , req]) => req && !photos.some((p) => p.k === k));
  if (missing.length) return { error: `Photo manquante : ${missing.map((m) => m[1]).join(", ")}.` };
  if (fd.get("engage") !== "on") return { error: "Cochez l'engagement sur les photos." };
  const { error } = await supabase.from("offers").insert({
    seller_id: user.id, category, name: v("name"), producer: v("producer"), appellation: v("appellation") || null,
    spirit_type: v("spirit_type") || null, vintage: v("vintage") || null, abv: n("abv"), grapes: v("grapes") || null,
    bottled_year: v("bottled_year") || null, format: v("format"), qty, purchase_price: producer ? null : n("purchase_price"), price,
    carton_price: producer ? n("carton_price") : null, carton_size: producer && n("carton_price") ? Number(v("carton_size") || 6) : null,
    has_invoice: fd.get("invoice") === "on", condition: v("condition"), storage: v("storage") || null, description: v("description") || null,
    pickup_city: v("city"), photos,
  });
  if (error) return { error: "Publication impossible : " + error.message };
  redirect("/catalogue");
}

export async function publishGroup(_: unknown, fd: FormData): Promise<R> {
  const c = await common(fd); if ("error" in c) return { error: c.error };
  const { supabase, user, kind, v, n, category, photos } = c;
  if (!isProducer(kind)) return { error: "Seuls les producteurs peuvent lancer un achat groupé." };
  const price = n("price"), min = Number(v("min_bottles")), deadline = v("deadline");
  if (!price || price <= 0) return { error: "Indiquez le prix groupé." };
  if (!(min >= 2)) return { error: "Indiquez le minimum de bouteilles." };
  const dl = new Date(deadline + "T23:59:59");
  if (!deadline || dl.getTime() <= Date.now()) return { error: "La date limite doit être dans le futur." };
  if (!photos.some((p) => p.k === "general") || !photos.some((p) => p.k === "face")) return { error: "Ajoutez la vue générale et l'étiquette." };
  const { error } = await supabase.from("group_buys").insert({
    seller_id: user.id, category, name: v("name"), producer: v("producer"), appellation: v("appellation") || null, vintage: v("vintage") || null,
    abv: n("abv"), format: v("format"), price, usual_price: n("usual_price"), min_bottles: min, deadline: dl.toISOString(),
    delivery: v("delivery") || null, photos, description: v("description") || null,
  });
  if (error) return { error: "Publication impossible : " + error.message };
  redirect("/catalogue?f=groupes");
}
