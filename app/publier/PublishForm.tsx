"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { publishOffer, publishGroup } from "./actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { photoUrlClient } from "./photo";
import { CATEGORIES, CONDITIONS, FORMATS_SPIRIT, FORMATS_WINE, SPIRIT_TYPES, evinTerms, requiredPhotos, eur, half, shippingEstimate } from "@/lib/rules";

type Photo = { k: string; path: string };

/** Réduit une photo à 1600 px en JPEG avant l'envoi. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob((b) => r(b ?? file), "image/jpeg", 0.82));
  } catch { return file; }
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn primary block" type="submit" disabled={pending}>{pending ? "Publication…" : label}</button>;
}

export default function PublishForm({ uid, producer, city, labelReader }: { uid: string; producer: boolean; city: string; labelReader: boolean }) {
  const [kind, setKind] = useState<"lot" | "group">("lot");
  const group = producer && kind === "group";
  const [stOffer, actOffer] = useFormState(publishOffer, {} as { error?: string });
  const [stGroup, actGroup] = useFormState(publishGroup, {} as { error?: string });
  const [f, setF] = useState<Record<string, string>>({ category: "Vin", format: "75 cl", qty: "6", condition: "Parfait état", city, carton_size: "6" });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [labelMsg, setLabelMsg] = useState("");
  const sp = f.category === "Spiritueux";
  const formats = sp ? FORMATS_SPIRIT : FORMATS_WINE;
  const qty = Number(f.qty) || 1;
  const slots = group ? requiredPhotos(f.category, 1, true) : requiredPhotos(f.category, qty, producer);
  const evin = useMemo(() => evinTerms([f.name, f.storage, f.description, f.delivery].join(" ")), [f.name, f.storage, f.description, f.delivery]);
  const price = Number((f.price || "").replace(",", ".")) || 0;

  async function upload(k: string, file: File) {
    setBusy(k);
    const blob = await shrink(file);
    const path = `${uid}/${Date.now()}-${k}.jpg`;
    const { error } = await supabaseBrowser().storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
    setBusy(null);
    if (!error) setPhotos((p) => [...p.filter((x) => x.k !== k), { k, path }]);
  }

  async function readLabel(file: File) {
    setLabelMsg("Lecture de l'étiquette…");
    upload("face", file);
    const blob = await shrink(file);
    const b64 = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
    const res = await fetch("/api/etiquette", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: b64, mediaType: "image/jpeg" }) });
    const r = await res.json();
    if (!res.ok) { setLabelMsg(r.error ?? "L'étiquette n'a pas pu être lue. Remplissez les champs."); return; }
    setF((x) => ({
      ...x,
      ...(CATEGORIES.includes(r.category) ? { category: r.category } : {}),
      ...(r.name ? { name: r.name } : {}), ...(r.producer ? { producer: r.producer } : {}), ...(r.appellation ? { appellation: r.appellation } : {}),
      ...(r.vintage ? { vintage: r.vintage } : {}), ...(r.abv ? { abv: String(r.abv).replace(",", ".") } : {}), ...(r.grapes ? { grapes: r.grapes } : {}),
      ...(r.bottled ? { bottled_year: r.bottled } : {}), ...(SPIRIT_TYPES.includes(r.spirit_type) ? { spirit_type: r.spirit_type } : {}),
      ...([...FORMATS_WINE, ...FORMATS_SPIRIT].includes(r.volume) ? { format: r.volume } : {}),
    }));
    setLabelMsg("Champs remplis depuis l'étiquette. Vérifiez-les avant de publier.");
  }

  const inp = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field"><label htmlFor={k}>{label}</label><input id={k} name={k} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} {...props} /></div>
  );

  return (
    <form action={group ? actGroup : actOffer}>
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      {producer && (
        <div className="group"><h3>Type d&apos;annonce</h3>
          <div className="row"><button type="button" className={`btn sm ${!group ? "primary" : ""}`} onClick={() => setKind("lot")}>Lot à vendre</button><button type="button" className={`btn sm ${group ? "primary" : ""}`} onClick={() => setKind("group")}>Achat groupé</button></div>
          <p className="hint">{group ? "Le prix ne s'applique que si le minimum de bouteilles est atteint avant la date limite. Chaque participant est facturé pour sa part." : "Vente directe : les acheteurs choisissent leur quantité dans votre lot."}</p></div>
      )}
      {labelReader && (
        <div className="group" style={{ background: "var(--accent-soft)" }}><h3>Remplir depuis une photo d&apos;étiquette</h3>
          <label className="btn primary sm" style={{ justifySelf: "start" }}>Photographier l&apos;étiquette<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && readLabel(e.target.files[0])} /></label>
          {labelMsg && <p className="hint">{labelMsg}</p>}</div>
      )}
      <div className="group"><h3>Catégorie</h3>
        <input type="hidden" name="category" value={f.category} />
        <div className="row">{CATEGORIES.map((c) => <button key={c} type="button" className={`btn sm ${f.category === c ? "primary" : ""}`} onClick={() => { set("category", c); set("format", c === "Spiritueux" ? "70 cl" : "75 cl"); }}>{c}</button>)}</div>
      </div>
      <div className="group"><h3>{sp ? "Le spiritueux" : "Le vin"}</h3>
        {inp("name", sp ? "Nom ou édition *" : "Cuvée *")}
        <div className="grid2">{inp("producer", sp ? "Distillerie ou maison *" : "Domaine ou maison *")}
          {sp ? <div className="field"><label htmlFor="spirit_type">Type</label><select id="spirit_type" name="spirit_type" value={f.spirit_type ?? ""} onChange={(e) => set("spirit_type", e.target.value)}><option value="">—</option>{SPIRIT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div> : inp("appellation", "Appellation")}</div>
        <div className="grid2">{inp("vintage", sp ? "Âge ou année de distillation" : "Millésime", { placeholder: sp ? "18 ans · 1985" : "2022 ou NM" })}{inp("abv", "Degré (% vol)", { inputMode: "decimal" })}</div>
        {sp ? inp("bottled_year", "Année d'embouteillage") : inp("grapes", "Cépages")}
      </div>
      <div className="group"><h3>{group ? "L'offre" : "Le lot"}</h3>
        <div className="field"><label htmlFor="format">Format</label><select id="format" name="format" value={f.format} onChange={(e) => set("format", e.target.value)}>{formats.map((x) => <option key={x}>{x}</option>)}</select></div>
        {group ? (<>
          <div className="grid2">{inp("min_bottles", "Minimum de bouteilles *", { type: "number", min: 2 })}{inp("deadline", "Date limite *", { type: "date" })}</div>
          {inp("delivery", "Livraison ou retrait", { placeholder: "ex. livraison groupée à Lyon le 15" })}
        </>) : (<>
          {inp("qty", "Quantité *", { type: "number", min: 1, max: 600 })}
          <div className="field"><label htmlFor="condition">État</label><select id="condition" name="condition" value={f.condition} onChange={(e) => set("condition", e.target.value)}>{CONDITIONS.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="field"><label htmlFor="storage">Conservation</label><textarea id="storage" name="storage" value={f.storage ?? ""} onChange={(e) => set("storage", e.target.value)} placeholder="ex. cave enterrée à 13 °C" /></div>
        </>)}
        <div className="field"><label htmlFor="description">Description (facultative)</label><textarea id="description" name="description" value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Terroir, élevage, robe, nez, bouche" />
          <span className="hint">Informations objectives uniquement (loi Évin).</span>
          {!!evin.length && <div className="notice">Termes interdits par la loi Évin : {evin.join(", ")}. Reformulez de façon objective.</div>}</div>
      </div>
      <div className="group"><h3>Photos {group ? "" : "obligatoires"}</h3>
        <p className="hint">Une bouteille du lot, à la lumière du jour, sur fond neutre. Touchez une case pour prendre la photo.</p>
        <div className="photos">{slots.map(([k, label, req]) => {
          const p = photos.find((x) => x.k === k);
          return (
            <label key={k} className={`slot ${p ? "done" : ""}`}>
              {p && <img src={photoUrlClient(p.path)} alt="" />}
              <span style={{ position: "relative" }}>{busy === k ? "Envoi…" : label}{req ? " *" : ""}</span>
              <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && upload(k, e.target.files[0])} />
            </label>
          );
        })}</div>
      </div>
      <div className="group"><h3>Prix (HT, par bouteille)</h3>
        <div className="grid2">
          {!producer && !group && inp("purchase_price", "Prix d'achat (facultatif)", { inputMode: "decimal" })}
          {inp("price", group ? "Prix groupé *" : producer ? "Prix pro *" : "Prix de vente *", { inputMode: "decimal" })}
          {group && inp("usual_price", "Prix pro habituel", { inputMode: "decimal" })}
        </div>
        {producer && !group && (<div className="grid2">{inp("carton_price", "Prix au carton (facultatif)", { inputMode: "decimal" })}
          <div className="field"><label htmlFor="carton_size">Carton de</label><select id="carton_size" name="carton_size" value={f.carton_size} onChange={(e) => set("carton_size", e.target.value)}><option value="3">3</option><option value="6">6</option><option value="12">12</option></select></div></div>)}
        {!group && price > 0 && <p className="hint">Si l&apos;acheteur choisit le colis, l&apos;envoi estimé à {eur(shippingEstimate(f.format, qty, price * qty))} se partage : {eur(half(shippingEstimate(f.format, qty, price * qty)))} chacun. Votre prix est libre : un indicateur le compare aux ventes passées.</p>}
      </div>
      <div className="group">
        {inp("city", "Ville de retrait")}
        {!producer && !group && <label className="check"><input type="checkbox" name="invoice" /> Je peux présenter la facture d&apos;origine (facultatif)</label>}
        {!group && <label className="check"><input type="checkbox" name="engage" /> Les photos montrent une bouteille de ce lot.</label>}
      </div>
      {(group ? stGroup : stOffer)?.error && <div className="notice">{(group ? stGroup : stOffer).error}</div>}
      <Submit label={group ? "Lancer l'achat groupé" : "Publier le lot"} />
    </form>
  );
}
