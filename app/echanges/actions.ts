"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { DOUANE_DOCS, CARRIERS, INSURANCE_THRESHOLD } from "@/lib/rules";

async function ctx() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Session expirée");
  return { supabase, uid: user.id };
}
const done = () => revalidatePath("/echanges");
export type R = { error?: string; ok?: string };

export async function confirmOrder(fd: FormData) {
  const { supabase } = await ctx(); const id = String(fd.get("id"));
  const d = new Date(), ref = `CA-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${id.slice(0, 5).toUpperCase()}`;
  await supabase.from("orders").update({ confirmed_at: d.toISOString(), ref }).eq("id", id).is("confirmed_at", null);
  done();
}
export async function cancelOrder(fd: FormData) {
  const { supabase } = await ctx();
  await supabase.from("orders").update({ cancelled_at: new Date().toISOString() }).eq("id", String(fd.get("id"))).is("confirmed_at", null);
  done();
}

export async function ship(_: unknown, fd: FormData): Promise<R> {
  const { supabase } = await ctx();
  const id = String(fd.get("id")), douane = String(fd.get("douane")), douaneRef = String(fd.get("douane_ref") || "").trim();
  const { data: o } = await supabase.from("orders").select("mode,goods_ht,confirmed_at").eq("id", id).single();
  if (!o?.confirmed_at) return { error: "Confirmez d'abord la vente." };
  if (!(douane in DOUANE_DOCS)) return { error: "Choisissez le document de circulation." };
  if ((douane === "dsa" || douane === "dae") && !douaneRef) return { error: douane === "dae" ? "Indiquez le numéro ARC du DAE." : "Indiquez le numéro du DSA." };
  const colis = o.mode === "colis";
  const carrier = String(fd.get("carrier") || "").trim() || null, tracking = String(fd.get("tracking") || "").trim() || null;
  const insured = fd.get("insured") === "on";
  if (colis && (!carrier || !CARRIERS.includes(carrier))) return { error: "Choisissez le transporteur." };
  if (colis && !tracking) return { error: "Le numéro de suivi est obligatoire pour un colis." };
  if (colis && Number(o.goods_ht) > INSURANCE_THRESHOLD && !insured) return { error: `Au-dessus de ${INSURANCE_THRESHOLD} €, le colis doit être assuré à sa valeur.` };
  const s = await supabase.from("shipments").upsert({ order_id: id, douane, douane_ref: douaneRef || null, carrier, tracking, insured });
  if (s.error) return { error: s.error.message };
  const u = await supabase.from("orders").update({ shipped_at: new Date().toISOString() }).eq("id", id);
  if (u.error) return { error: u.error.message };
  done(); return { ok: colis ? "Expédition enregistrée : l'acheteur peut suivre son colis." : "Remise enregistrée." };
}

export async function received(fd: FormData) {
  const { supabase } = await ctx();
  await supabase.from("orders").update({ received_at: new Date().toISOString() }).eq("id", String(fd.get("id")));
  done();
}

export async function openClaim(_: unknown, fd: FormData): Promise<R> {
  const { supabase } = await ctx();
  const type = String(fd.get("type")); let photos: string[] = [];
  try { photos = JSON.parse(String(fd.get("photos") || "[]")); } catch { /* vide */ }
  if (type !== "nonrecu" && !photos.length) return { error: "Ajoutez au moins une photo du colis ou des bouteilles." };
  const { error } = await supabase.from("claims").insert({ order_id: String(fd.get("id")), type, details: String(fd.get("details") || "").slice(0, 1000), photos });
  if (error) return { error: error.message };
  done(); return { ok: "Signalement envoyé au vendeur et au Cercle." };
}
export async function settleClaim(fd: FormData) {
  const { supabase } = await ctx();
  await supabase.from("claims").update({ status: "regle", settled_at: new Date().toISOString() }).eq("order_id", String(fd.get("id")));
  done();
}

export async function review(fd: FormData) {
  const { supabase, uid } = await ctx();
  const id = String(fd.get("id")), stars = Number(fd.get("stars"));
  const { data: o } = await supabase.from("orders").select("seller_id,buyer_id").eq("id", id).single();
  if (!o || !(stars >= 1 && stars <= 5)) return;
  await supabase.from("reviews").insert({ order_id: id, author_id: uid, target_id: uid === o.seller_id ? o.buyer_id : o.seller_id, stars, comment: String(fd.get("comment") || "").slice(0, 600) || null });
  done();
}

export async function withdrawOffer(fd: FormData) {
  const { supabase } = await ctx();
  await supabase.from("offers").update({ status: "retire" }).eq("id", String(fd.get("id")));
  done();
}
