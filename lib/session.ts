import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export type Member = {
  id: string; pseudo: string; kind: string; plan: "occasionnel" | "pro"; city: string;
  status: "pending" | "active" | "rejected" | "suspended"; status_reason: string | null;
};

/** Utilisateur connecté, sa fiche et ses droits. */
export async function session() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, member: null as Member | null, admin: false };
  const [{ data: member }, { data: admin }] = await Promise.all([
    supabase.from("members").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  return { supabase, user, member: member as Member | null, admin: !!admin };
}

/** Exige un compte validé ; sinon renvoie vers l'inscription. */
export async function requireActive() {
  const s = await session();
  if (!s.user) redirect("/connexion");
  if (!s.member) redirect("/inscription");
  if (s.member.status !== "active" && !s.admin) redirect("/inscription");
  return s as typeof s & { user: NonNullable<typeof s.user>; member: Member };
}

export const photoUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
