import { redirect } from "next/navigation";
import { session } from "@/lib/session";
import ProfileForm from "./ProfileForm";
import { signOut } from "../connexion/actions";

export default async function Inscription() {
  const { supabase, user, member } = await session();
  if (!user) redirect("/connexion?suite=/inscription");
  const { data: priv } = await supabase.from("members_private").select("*").eq("id", user.id).maybeSingle();
  const cguVersion = process.env.NEXT_PUBLIC_CGU_VERSION ?? "2026-11-13";
  const { data: cgu } = await supabase.from("cgu_acceptances").select("accepted_at").eq("member_id", user.id).eq("version", cguVersion).maybeSingle();
  const status = member?.status;
  return (
    <>
      <h1>{member ? "Mon établissement" : "Rejoindre le Cercle"}</h1>
      {status === "active" && <div className="notice ok">Compte validé. Bienvenue au Cercle.</div>}
      {status === "pending" && <div className="notice">Fiche reçue. Vérification sous 72 h ouvrées.</div>}
      {status === "rejected" && <div className="notice">Votre demande n&apos;a pas été acceptée{member?.status_reason ? ` : ${member.status_reason}` : ""}. Corrigez votre fiche pour une nouvelle vérification.</div>}
      {status === "suspended" && <div className="notice">Compte suspendu{member?.status_reason ? ` : ${member.status_reason}` : ""}.</div>}
      <ProfileForm uid={user.id} member={member} priv={priv} cguAccepted={cgu?.accepted_at ?? null}
        cguUrl={process.env.NEXT_PUBLIC_CGU_URL ?? "/cgu"} cguVersion={cguVersion} />
      <form action={signOut}><button className="btn quiet" type="submit">Se déconnecter</button></form>
    </>
  );
}
