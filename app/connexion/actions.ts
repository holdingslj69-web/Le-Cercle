"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function signIn(fd: FormData) {
  const email = String(fd.get("email") || "").trim();
  const suite = String(fd.get("suite") || "/catalogue");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabaseServer().auth.signInWithOtp({
    email, options: { emailRedirectTo: `${site}/auth/callback?suite=${encodeURIComponent(suite)}` },
  });
  if (error) redirect(`/connexion?erreur=${encodeURIComponent("L'envoi a échoué. Vérifiez l'adresse et réessayez.")}`);
  redirect("/connexion?envoye=1");
}

export async function signOut() {
  await supabaseServer().auth.signOut();
  redirect("/");
}
