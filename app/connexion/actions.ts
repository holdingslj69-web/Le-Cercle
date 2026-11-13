"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";

const safe = (s: string) => (s.startsWith("/") && !s.startsWith("//") ? s : "/catalogue");

export async function signIn(fd: FormData) {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const suite = safe(String(fd.get("suite") || "/catalogue"));
  const { error } = await supabaseServer().auth.signInWithOtp({
    email, options: { emailRedirectTo: `${siteUrl()}/auth/callback?suite=${encodeURIComponent(suite)}` },
  });
  if (error) {
    const msg = /rate|seconds/i.test(error.message)
      ? "Trop de demandes rapprochées : patientez une minute avant de redemander un lien."
      : "L'envoi a échoué. Vérifiez l'adresse et réessayez.";
    redirect(`/connexion?erreur=${encodeURIComponent(msg)}&suite=${encodeURIComponent(suite)}`);
  }
  redirect(`/connexion?envoye=1&email=${encodeURIComponent(email)}&suite=${encodeURIComponent(suite)}`);
}

/** Connexion avec le code à 6 chiffres reçu par e-mail : marche sur n'importe quel appareil. */
export async function verifyCode(fd: FormData) {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const token = String(fd.get("code") || "").replace(/\D/g, "");
  const suite = safe(String(fd.get("suite") || "/catalogue"));
  const { error } = await supabaseServer().auth.verifyOtp({ email, token, type: "email" });
  if (error) redirect(`/connexion?envoye=1&email=${encodeURIComponent(email)}&suite=${encodeURIComponent(suite)}&erreur=${encodeURIComponent("Code incorrect ou expiré. Redemandez un e-mail si besoin.")}`);
  redirect(suite);
}

export async function signOut() {
  await supabaseServer().auth.signOut();
  redirect("/");
}
