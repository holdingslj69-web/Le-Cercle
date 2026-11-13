"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

async function ctx() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Session expirée");
  return { supabase, uid: user.id };
}

export async function pledge(fd: FormData) {
  const { supabase, uid } = await ctx();
  const id = String(fd.get("id")), qty = Math.max(1, Math.min(600, Number(fd.get("qty")) || 1));
  await supabase.from("pledges").upsert({ group_id: id, member_id: uid, qty, updated_at: new Date().toISOString() });
  revalidatePath(`/achats-groupes/${id}`);
}
export async function leave(fd: FormData) {
  const { supabase, uid } = await ctx(); const id = String(fd.get("id"));
  await supabase.from("pledges").delete().eq("group_id", id).eq("member_id", uid);
  revalidatePath(`/achats-groupes/${id}`);
}
export async function validateGroup(fd: FormData) {
  const { supabase } = await ctx(); const id = String(fd.get("id")); const d = new Date();
  const { data: g } = await supabase.from("group_buys").select("min_bottles, pledges(qty)").eq("id", id).single();
  const total = (g?.pledges ?? []).reduce((a: number, p: { qty: number }) => a + p.qty, 0);
  if (!g || total < g.min_bottles) return;
  await supabase.from("group_buys").update({ status: "valide", validated_at: d.toISOString(),
    ref: `CG-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${id.slice(0, 4).toUpperCase()}` }).eq("id", id);
  revalidatePath("/echanges"); revalidatePath(`/achats-groupes/${id}`);
}
export async function cancelGroup(fd: FormData) {
  const { supabase } = await ctx(); const id = String(fd.get("id"));
  await supabase.from("group_buys").update({ status: "annule" }).eq("id", id).eq("status", "ouvert");
  revalidatePath("/echanges");
}
