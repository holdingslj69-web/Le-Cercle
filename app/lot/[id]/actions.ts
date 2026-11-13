"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { shippingEstimate, unitPriceFor } from "@/lib/rules";

export async function reserve(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée : reconnectez-vous." };
  const id = String(fd.get("offer")), mode = String(fd.get("mode")), qty = Number(fd.get("qty"));
  if (!["retrait", "coursier", "colis"].includes(mode)) return { error: "Choisissez un mode de remise." };
  const { data: o } = await supabase.from("offers").select("price,format,carton_price,carton_size,qty").eq("id", id).maybeSingle();
  if (!o) return { error: "Ce lot n'est plus disponible." };
  const unit = unitPriceFor(o.price, qty, o.carton_price, o.carton_size);
  // seller_id, prix unitaire et commission sont recalculés par la base (déclencheur on_order_insert)
  const { error } = await supabase.from("orders").insert({
    offer_id: id, buyer_id: user.id, seller_id: user.id, qty, unit_price: unit, commission_rate: 0, mode,
    shipping_est: mode === "colis" ? shippingEstimate(o.format, qty, unit * qty) : 0,
  });
  if (error) return { error: error.message.includes("disponible") || error.message.includes("Quantité") ? "Ce lot vient d'être réservé ou la quantité n'est plus disponible." : "Réservation impossible : " + error.message };
  redirect("/echanges?vue=achats");
}

export async function report(fd: FormData) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const offer = String(fd.get("offer"));
  await supabase.from("reports").insert({
    offer_id: offer, reporter_id: user.id, reason: String(fd.get("reason")), is_producer: fd.get("producer") === "on",
    details: String(fd.get("details") || "").slice(0, 1000) || null,
  });
  redirect(`/lot/${offer}?signale=1`);
}
