import Link from "next/link";
import { session } from "@/lib/session";
import { OFFER_SELECT, withPriceLevels, DEMO, type Offer } from "@/lib/offers";
import OfferCard, { Tile } from "@/components/OfferCard";
import { eur, isProducer } from "@/lib/rules";

const CHIPS: [string, string][] = [["all", "Tous"], ["groupes", "Achats groupés"], ["direct", "Direct producteur"], ["recherches", "Je cherche"], ["Vin", "Vins"], ["Champagne", "Champagnes"], ["Spiritueux", "Spiritueux"], ["big", "Grands formats"]];

export default async function Catalogue({ searchParams }: { searchParams: { f?: string; q?: string; tri?: string } }) {
  const { supabase, member, admin } = await session();
  const active = member?.status === "active" || admin;
  const f = searchParams.f ?? "all", q = (searchParams.q ?? "").trim();
  if (active) await supabase.rpc("release_expired_reservations");

  const href = (patch: Record<string, string>) => "/catalogue?" + new URLSearchParams({ ...(q ? { q } : {}), f, ...(searchParams.tri ? { tri: searchParams.tri } : {}), ...patch }).toString();
  const header = (
    <>
      <h1>Catalogue</h1>
      <form action="/catalogue" className="row" style={{ flexWrap: "nowrap" }}>
        <input type="hidden" name="f" value={f} />
        <input name="q" type="search" defaultValue={q} placeholder="Domaine, cuvée, whisky, millésime…" aria-label="Rechercher" />
        <button className="btn sm" type="submit">Chercher</button>
      </form>
      <div className="chips">
        {CHIPS.map(([k, l]) => <Link key={k} className={`chip ${f === k ? "on" : ""}`} href={href({ f: k })}>{l}</Link>)}
        <Link className={`chip ${searchParams.tri === "prix" ? "on" : ""}`} href={href({ tri: searchParams.tri === "prix" ? "" : "prix" })}>Prix croissant</Link>
      </div>
    </>
  );

  if (f === "recherches") {
    let rq = supabase.from("wanted").select("*, member:members!wanted_member_id_fkey(pseudo,kind)").eq("closed", false).order("created_at", { ascending: false }).limit(100);
    if (q) rq = rq.ilike("query", `%${q}%`);
    const { data: wanted } = await rq;
    return (
      <>{header}
        <div className="list">
          {(wanted ?? []).map((w: any) => (
            <article key={w.id} className="card">
              <div className="row between"><span className="pill accent">Je cherche</span><span className="hint">{new Date(w.created_at).toLocaleDateString("fr-FR")}</span></div>
              <div className="o-name">{w.query}</div>
              <p className="hint">{w.member?.pseudo} · {w.member?.kind}{w.max_price ? ` · jusqu'à ${eur(w.max_price)} HT / bt` : ""}</p>
              {active && w.member_id !== member?.id && <div className="row"><Link className="btn sm primary" href={`/messages?w=${w.id}&avec=${w.member_id}`}>J&apos;ai ce vin</Link><Link className="btn sm" href="/publier">Publier un lot</Link></div>}
            </article>
          ))}
          {!wanted?.length && <div className="card"><p className="muted">Aucune recherche publiée. Créez la vôtre depuis l&apos;onglet Alertes.</p><Link className="btn sm" href="/alertes">Créer une recherche</Link></div>}
        </div>
      </>
    );
  }

  let query = supabase.from("offers").select(OFFER_SELECT).eq("status", "dispo").gt("qty", 0).limit(200);
  if (["Vin", "Champagne", "Spiritueux"].includes(f)) query = query.eq("category", f);
  if (f === "big") query = query.in("format", ["Magnum 150 cl", "Jéroboam 300 cl", "1,5 L"]);
  if (q) query = query.or(`name.ilike.%${q}%,producer.ilike.%${q}%,appellation.ilike.%${q}%,vintage.ilike.%${q}%,spirit_type.ilike.%${q}%`);
  query = searchParams.tri === "prix" ? query.order("price") : query.order("created_at", { ascending: false });
  const [{ data: offers }, { data: groups }] = await Promise.all([
    f === "groupes" ? Promise.resolve({ data: [] as Offer[] }) : query,
    ["all", "groupes", "Vin", "Champagne", "Spiritueux"].includes(f)
      ? supabase.from("group_buys").select("*, seller:members!group_buys_seller_id_fkey(pseudo,kind), pledges(qty)").eq("status", "ouvert").gt("deadline", new Date().toISOString()).order("deadline")
      : Promise.resolve({ data: [] as any[] }),
  ]);
  let list = (offers ?? []) as Offer[];
  if (f === "direct") list = list.filter((o) => isProducer(o.seller?.kind));
  const demo = !active || (f === "all" && !q && list.length === 0);
  if (demo) list = [...list, ...DEMO];
  const priced = await withPriceLevels(supabase, list.filter((o) => !o.demo));
  const shown = [...priced, ...list.filter((o) => o.demo)];

  return (
    <>{header}
      {demo && <div className="notice">Mode démo : les lots « Exemple » montrent le fonctionnement du Cercle. {active ? "Ils disparaissent dès que de vrais lots sont publiés." : "Vous verrez les vrais lots dès la validation de votre compte."}</div>}
      <div className="list">
        {(groups ?? []).filter((g: any) => !q || `${g.name} ${g.producer}`.toLowerCase().includes(q.toLowerCase())).map((g: any) => {
          const total = (g.pledges ?? []).reduce((a: number, p: { qty: number }) => a + p.qty, 0);
          return (
            <Link key={g.id} className="offer" href={`/achats-groupes/${g.id}`}>
              <Tile o={g} />
              <div style={{ display: "grid", gap: 4 }}>
                <div className="o-name"><span className="pill accent">Achat groupé</span> {g.name}</div>
                <div className="o-dom">{g.producer}{g.appellation ? ` · ${g.appellation}` : ""}</div>
                <div className="track"><i style={{ width: `${Math.min(100, (total / g.min_bottles) * 100)}%` }} /></div>
                <div className="row between"><span className="hint">{total} / {g.min_bottles} bouteilles · jusqu&apos;au {new Date(g.deadline).toLocaleDateString("fr-FR")}</span><span className="price">{eur(g.price)}<small> HT</small></span></div>
              </div>
            </Link>
          );
        })}
        {shown.map((o) => <OfferCard key={o.id} o={o} />)}
        {!shown.length && !(groups ?? []).length && <div className="card"><p className="muted">Aucun lot ne correspond.</p><Link className="btn sm" href="/catalogue">Effacer les filtres</Link></div>}
      </div>
    </>
  );
}
