import { requireActive } from "@/lib/session";
import { OFFER_SELECT, withPriceLevels, type Offer } from "@/lib/offers";
import OfferCard from "@/components/OfferCard";
import { eur, CATEGORIES } from "@/lib/rules";
import { addAlert, deleteAlert, closeWanted } from "./actions";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function Alertes() {
  const { supabase, user } = await requireActive();
  const [{ data: alerts }, { data: wanted }, { data: offers }] = await Promise.all([
    supabase.from("alerts").select("*").eq("member_id", user.id).order("created_at", { ascending: false }),
    supabase.from("wanted").select("*").eq("member_id", user.id).eq("closed", false),
    supabase.from("offers").select(OFFER_SELECT).eq("status", "dispo").gt("qty", 0).neq("seller_id", user.id).order("created_at", { ascending: false }).limit(300),
  ]);
  const hits = ((offers ?? []) as Offer[]).filter((o) => (alerts ?? []).some((a) => {
    if (a.category && o.category !== a.category) return false;
    if (a.max_price && Number(o.price) > Number(a.max_price)) return false;
    const hay = norm([o.name, o.producer, o.appellation, o.spirit_type, o.vintage].join(" "));
    return a.query.split(",").map((x: string) => norm(x).trim()).filter(Boolean).some((g: string) => g.split(/\s+/).every((w) => hay.includes(w)));
  }));
  const priced = await withPriceLevels(supabase, hits);
  return (
    <>
      <h1>Alertes</h1>
      <p className="muted">Notez ce que vous cherchez : les lots correspondants apparaissent ici.</p>
      <form action={addAlert} className="group">
        <div className="field"><label htmlFor="query">Je cherche</label><input id="query" name="query" required placeholder="Chartreuse V.E.P., Cornas, Port Ellen" /><span className="hint">Séparez plusieurs recherches par une virgule.</span></div>
        <div className="grid2"><div className="field"><label htmlFor="category">Catégorie</label><select id="category" name="category"><option value="">Toutes</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label htmlFor="max">Prix max HT / bt</label><input id="max" name="max" inputMode="decimal" /></div></div>
        <label className="check"><input type="checkbox" name="publish" defaultChecked /> Publier aussi ma recherche dans « Je cherche » : les confrères qui ont ce vin pourront me proposer un lot.</label>
        <button className="btn primary" type="submit">Créer l&apos;alerte</button>
      </form>
      <h2>Mes alertes</h2>
      <div className="list">{(alerts ?? []).map((a) => (
        <div key={a.id} className="card"><div className="row between"><div><b>{a.query}</b><br /><span className="hint">{a.category ?? "Toutes catégories"}{a.max_price ? ` · max ${eur(a.max_price)}` : ""}</span></div>
          <form action={deleteAlert}><input type="hidden" name="id" value={a.id} /><button className="btn quiet sm">Supprimer</button></form></div></div>))}
        {!alerts?.length && <p className="muted">Aucune alerte pour l&apos;instant.</p>}</div>
      {!!wanted?.length && <><h2>Mes recherches publiées</h2>{wanted.map((w) => (
        <div key={w.id} className="card"><div className="row between"><b>{w.query}</b><form action={closeWanted}><input type="hidden" name="id" value={w.id} /><button className="btn quiet sm">Retirer</button></form></div></div>))}</>}
      {!!alerts?.length && <><h2>Correspondances</h2><div className="list">{priced.map((o) => <OfferCard key={o.id} o={o} />)}{!priced.length && <p className="muted">Aucun lot ne correspond pour l&apos;instant.</p>}</div></>}
    </>
  );
}
