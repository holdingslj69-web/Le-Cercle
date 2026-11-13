import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Arrivée depuis le lien de l'e-mail. Deux formats acceptés :
 *  - ?token_hash=…&type=email : fonctionne même si le lien est ouvert dans un autre navigateur ou appareil
 *    (modèle d'e-mail à régler dans Supabase, voir README) ;
 *  - ?code=… : format par défaut de Supabase, valable seulement dans le navigateur qui a demandé le lien.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams;
  const raw = q.get("suite") || "/catalogue";
  const suite = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/catalogue";
  const supabase = supabaseServer();
  let error: unknown = q.get("error_description");

  const tokenHash = q.get("token_hash"), type = q.get("type") as EmailOtpType | null;
  const code = q.get("code");
  if (!error && tokenHash && type) ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  else if (!error && code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  else if (!error) error = "lien incomplet";

  if (error) {
    const msg = "Ce lien n'a pas fonctionné : il a expiré, a déjà servi, ou a été ouvert dans un autre navigateur que celui de la demande. Entrez plutôt le code à 6 chiffres de l'e-mail, ou redemandez un lien.";
    return NextResponse.redirect(new URL(`/connexion?erreur=${encodeURIComponent(msg)}&suite=${encodeURIComponent(suite)}`, url.origin));
  }
  return NextResponse.redirect(new URL(suite, url.origin));
}
