import Link from "next/link";
import { requireActive } from "@/lib/session";
import { send } from "./actions";

type Msg = { id: number; offer_id: string | null; group_id: string | null; wanted_id: string | null; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null };
const keyOf = (m: Msg): [string, string] => (m.offer_id ? ["o", m.offer_id] : m.group_id ? ["g", m.group_id] : ["w", m.wanted_id!]);

export default async function Messages({ searchParams }: { searchParams: { o?: string; g?: string; w?: string; avec?: string } }) {
  const { supabase, user } = await requireActive();
  const key = searchParams.o ? "o" : searchParams.g ? "g" : searchParams.w ? "w" : null;
  const id = key ? (searchParams as Record<string, string>)[key] : null;
  const other = searchParams.avec;

  if (key && id && other && other !== user.id) {
    const col = key === "o" ? "offer_id" : key === "g" ? "group_id" : "wanted_id";
    const [{ data: msgs }, { data: who }, { data: unlocked }] = await Promise.all([
      supabase.from("messages").select("*").eq(col, id).or(`and(sender_id.eq.${user.id},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${user.id})`).order("created_at"),
      supabase.from("members").select("pseudo,kind").eq("id", other).maybeSingle(),
      supabase.rpc("is_counterparty", { other }),
    ]);
    await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq(col, id).eq("sender_id", other).eq("recipient_id", user.id).is("read_at", null);
    const subject = key === "o" ? await supabase.from("offers").select("name,vintage").eq("id", id).maybeSingle()
      : key === "g" ? await supabase.from("group_buys").select("name,vintage").eq("id", id).maybeSingle()
      : await supabase.from("wanted").select("name:query").eq("id", id).maybeSingle();
    return (
      <>
        <Link className="small" href="/messages">← Toutes les conversations</Link>
        <div><h1>{who?.pseudo ?? "Membre"}</h1><p className="muted">À propos de : {(subject.data as any)?.name} {(subject.data as any)?.vintage ?? ""}</p></div>
        {!unlocked && <p className="hint">Téléphones, e-mails, liens et IBAN sont masqués jusqu&apos;à la confirmation d&apos;une vente.</p>}
        <div className="list">
          {(msgs as Msg[] ?? []).map((m) => (
            <div key={m.id} className={`bub ${m.sender_id === user.id ? "me" : ""}`}><p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p><span className="hint" style={{ color: "inherit", opacity: .7 }}>{new Date(m.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
          ))}
          {!msgs?.length && <p className="hint" style={{ textAlign: "center" }}>Écrivez votre premier message.</p>}
        </div>
        <form action={send} className="group">
          <input type="hidden" name="key" value={key} /><input type="hidden" name="id" value={id} /><input type="hidden" name="avec" value={other} />
          <textarea name="body" required placeholder="Votre message…" /><button className="btn primary" type="submit">Envoyer</button>
        </form>
      </>
    );
  }

  const { data: all } = await supabase.from("messages").select("*").or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(500);
  const threads = new Map<string, { m: Msg; unread: number; other: string }>();
  for (const m of (all as Msg[]) ?? []) {
    const o = m.sender_id === user.id ? m.recipient_id : m.sender_id, [k, v] = keyOf(m), t = `${k}|${v}|${o}`;
    const cur = threads.get(t) ?? { m, unread: 0, other: o };
    if (m.recipient_id === user.id && !m.read_at) cur.unread++;
    threads.set(t, cur);
  }
  const ids = [...new Set([...threads.values()].map((t) => t.other))];
  const { data: names } = ids.length ? await supabase.from("members").select("id,pseudo").in("id", ids) : { data: [] as { id: string; pseudo: string }[] };
  const nm = new Map((names ?? []).map((n) => [n.id, n.pseudo]));
  return (
    <>
      <h1>Messages</h1>
      <div className="list">
        {[...threads.entries()].map(([t, { m, unread, other: o }]) => {
          const [k, v] = keyOf(m);
          return (
            <Link key={t} className="card" href={`/messages?${k}=${v}&avec=${o}`} style={{ textDecoration: "none" }}>
              <div className="row between"><b>{nm.get(o) ?? "Membre"}</b>{unread > 0 && <span className="pill accent">{unread} non lu{unread > 1 ? "s" : ""}</span>}</div>
              <span className="hint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.sender_id === user.id ? "Vous : " : ""}{m.body}</span>
            </Link>
          );
        })}
        {!threads.size && <div className="card"><p className="muted">Aucune conversation. Posez une question depuis la fiche d&apos;un lot.</p></div>}
      </div>
    </>
  );
}
