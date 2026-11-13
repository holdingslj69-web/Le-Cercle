"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function addAlert(fd: FormData) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  const query = String(fd.get("query") || "").trim(); if (!query) return;
  const category = String(fd.get("category") || "") || null, max = Number(String(fd.get("max") || "").replace(",", ".")) || null;
  await supabase.from("alerts").insert({ member_id: user.id, query, category, max_price: max });
  if (fd.get("publish") === "on") await supabase.from("wanted").insert({ member_id: user.id, query, category, max_price: max });
  revalidatePath("/alertes");
}
export async function deleteAlert(fd: FormData) {
  const supabase = supabaseServer();
  await supabase.from("alerts").delete().eq("id", String(fd.get("id")));
  revalidatePath("/alertes");
}
export async function closeWanted(fd: FormData) {
  const supabase = supabaseServer();
  await supabase.from("wanted").update({ closed: true }).eq("id", String(fd.get("id")));
  revalidatePath("/alertes");
}
