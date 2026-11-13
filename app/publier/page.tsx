import { requireActive } from "@/lib/session";
import { isProducer } from "@/lib/rules";
import PublishForm from "./PublishForm";

export default async function Publier() {
  const { user, member } = await requireActive();
  return (
    <>
      <h1>Publier</h1>
      <p className="muted">Visible par tous les membres vérifiés, sous votre pseudo.</p>
      <PublishForm uid={user.id} producer={isProducer(member.kind)} city={member.city} labelReader={!!process.env.ANTHROPIC_API_KEY} />
    </>
  );
}
