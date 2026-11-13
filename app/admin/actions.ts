"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

async function setStatus(fd: FormData, status: "active" | "rejected" | "suspended") {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
  const id = String(fd.get("id")), reason = String(fd.get("reason") || "").trim() || null;
  await supabase.from("members").update({ status, status_reason: status === "active" ? null : reason }).eq("id", id);
  if (status === "active") await supabase.from("members_private").update({ verified_at: new Date().toISOString(), verified_by: user.id }).eq("id", id);
  revalidatePath("/admin");
}
export async function approve(fd: FormData) { await setStatus(fd, "active"); }
export async function reject(fd: FormData) { await setStatus(fd, "rejected"); }
export async function suspend(fd: FormData) { await setStatus(fd, "suspended"); }
