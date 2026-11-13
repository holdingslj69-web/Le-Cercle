"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { maskContacts } from "@/lib/rules";

export async function send(fd: FormData) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const to = String(fd.get("avec")), key = String(fd.get("key")), id = String(fd.get("id"));
  let body = String(fd.get("body") || "").trim().slice(0, 2000);
  if (!body || !["o", "g", "w"].includes(key)) redirect(`/messages?${key}=${id}&avec=${to}`);
  const { data: unlocked } = await supabase.rpc("is_counterparty", { other: to });
  if (!unlocked) body = maskContacts(body);
  const col = key === "o" ? "offer_id" : key === "g" ? "group_id" : "wanted_id";
  await supabase.from("messages").insert({ [col]: id, sender_id: user.id, recipient_id: to, body });
  redirect(`/messages?${key}=${id}&avec=${to}`);
}
