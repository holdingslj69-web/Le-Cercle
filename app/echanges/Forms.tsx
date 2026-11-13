"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { ship, openClaim } from "./actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CARRIERS, DOUANE_DOCS, INSURANCE_THRESHOLD, LOST_AFTER_DAYS, CLAIM_LABEL } from "@/lib/rules";

export function ShipForm({ id, colis, goods }: { id: string; colis: boolean; goods: number }) {
  const [st, act] = useFormState(ship, {});
  return (
    <form action={act} className="group" style={{ background: "var(--bg)" }}>
      <input type="hidden" name="id" value={id} />
      <h3>{colis ? "Expédier" : "Remettre le lot"}</h3>
      <div className="field"><label>Document de circulation *</label>
        <select name="douane" defaultValue=""><option value="" disabled>Choisir…</option>{Object.entries(DOUANE_DOCS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input name="douane_ref" placeholder="Numéro du DSA ou ARC du DAE (si concerné)" /></div>
      {colis && <>
        <div className="grid2"><div className="field"><label>Transporteur *</label><select name="carrier" defaultValue="Colissimo">{CARRIERS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label>N° de suivi *</label><input name="tracking" /></div></div>
        <label className="check"><input type="checkbox" name="insured" defaultChecked={goods > INSURANCE_THRESHOLD} /> Colis assuré à sa valeur réelle{goods > INSURANCE_THRESHOLD ? " (obligatoire)" : ""}</label>
      </>}
      {st.error && <div className="notice">{st.error}</div>}{st.ok && <div className="notice ok">{st.ok}</div>}
      <button className="btn primary sm" type="submit">{colis ? "Enregistrer l'expédition" : "Marquer comme remis"}</button>
    </form>
  );
}

export function ClaimForm({ id, uid, shippedAt }: { id: string; uid: string; shippedAt: string }) {
  const [st, act] = useFormState(openClaim, {});
  const [photos, setPhotos] = useState<string[]>([]);
  const lost = Date.now() - new Date(shippedAt).getTime() > LOST_AFTER_DAYS * 864e5;
  async function add(files: FileList) {
    for (const f of Array.from(files).slice(0, 6)) {
      const path = `${uid}/${id}-${Date.now()}-${f.name.replace(/[^\w.]/g, "_")}`;
      const { error } = await supabaseBrowser().storage.from("litiges").upload(path, f);
      if (!error) setPhotos((p) => [...p, path]);
    }
  }
  return (
    <details className="group" style={{ background: "var(--bg)" }}><summary className="small"><b>Signaler un problème</b></summary>
      <form action={act}>
        <input type="hidden" name="id" value={id} /><input type="hidden" name="photos" value={JSON.stringify(photos)} />
        <select name="type"><option value="casse">{CLAIM_LABEL.casse}</option><option value="incomplet">{CLAIM_LABEL.incomplet}</option>{lost && <option value="nonrecu">{CLAIM_LABEL.nonrecu}</option>}</select>
        <textarea name="details" placeholder="Bouteilles touchées, état du carton, réserves notées au livreur" />
        <label className="btn sm" style={{ justifySelf: "start" }}>Ajouter des photos ({photos.length})<input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && add(e.target.files)} /></label>
        <p className="hint">Dans les 48 h suivant la réception, photos à l&apos;appui.</p>
        {st.error && <div className="notice">{st.error}</div>}{st.ok && <div className="notice ok">{st.ok}</div>}
        <button className="btn primary sm" type="submit">Envoyer le signalement</button>
      </form>
    </details>
  );
}
