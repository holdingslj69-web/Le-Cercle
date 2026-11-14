"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { lookupSiret } from "@/lib/siret";
import { KINDS, isProducer } from "@/lib/rules";

export async function saveProfile(_: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée : reconnectez-vous." };
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const kind = v("kind");
  if (!(KINDS as readonly string[]).includes(kind)) return { error: "Choisissez votre activité." };
  for (const k of ["pseudo", "siret", "phone", "licence"]) if (!v(k)) return { error: "Tous les champs marqués sont obligatoires." };
  if (isProducer(kind) && !v("excise")) return { error: "Indiquez votre numéro d'accise." };
  if (!v("kbis")) return { error: "Joignez votre extrait Kbis." };
  if (fd.get("cgu") !== "on") return { error: "Acceptez les conditions générales pour continuer." };

  // Contrôle officiel du SIRET : entreprise active et code NAF autorisé
  const info = await lookupSiret(v("siret"));
  if (!info.ok) return { error: info.error };
  if (!info.active) return { error: "Cet établissement n'est pas actif au registre des entreprises." };
  // L'administrateur du Cercle peut s'inscrire avec sa société (holding) : le contrôle d'activité ne s'applique pas à lui
  const { data: isAdmin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!info.nafAllowed && !isAdmin) return { error: `Le code d'activité ${info.naf} (${info.nafLabel}) ne permet pas l'accès au Cercle, réservé aux métiers de la restauration, du vin et des spiritueux.` };

  const { data: existing } = await supabase.from("members").select("id,status").eq("id", user.id).maybeSingle();
  const member = { id: user.id, pseudo: v("pseudo"), kind, plan: v("plan") === "pro" ? "pro" : "occasionnel", city: info.city };
  const res1 = existing
    ? await supabase.from("members").update({ ...member, ...(existing.status === "rejected" ? { status: "pending", status_reason: null } : {}) }).eq("id", user.id)
    : await supabase.from("members").insert(member);
  if (res1.error) return { error: "Enregistrement impossible : " + res1.error.message };

  const priv = {
    id: user.id, legal_name: info.name, siret: info.siret, vat_number: info.vat, naf: info.naf, excise_number: v("excise") || null,
    licence: v("licence"), address: info.address, postcode: info.postcode, phone: v("phone"), kbis_path: v("kbis"),
  };
  const res2 = await supabase.from("members_private").upsert(priv);
  if (res2.error) return { error: res2.error.message.includes("siret") ? "Ce SIRET est déjà inscrit au Cercle." : "Enregistrement impossible : " + res2.error.message };

  const h = headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  await supabase.from("cgu_acceptances").upsert(
    { member_id: user.id, version: process.env.NEXT_PUBLIC_CGU_VERSION ?? "2026-11-13", ip, user_agent: h.get("user-agent") },
    { onConflict: "member_id,version", ignoreDuplicates: true });
  revalidatePath("/", "layout");
  return { ok: true };
}
