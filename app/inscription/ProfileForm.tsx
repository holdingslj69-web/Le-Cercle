"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveProfile } from "./actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { KINDS, isProducer } from "@/lib/rules";
import type { Member } from "@/lib/session";

type Priv = { siret?: string; phone?: string; licence?: string; excise_number?: string | null; kbis_path?: string; legal_name?: string; naf?: string; vat_number?: string } | null;
type Lookup = { ok: boolean; error?: string; name?: string; address?: string; postcode?: string; city?: string; naf?: string; nafLabel?: string; nafAllowed?: boolean; active?: boolean; vat?: string };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn primary block" type="submit" disabled={pending}>{pending ? "Vérification…" : label}</button>;
}

export default function ProfileForm({ admin = false, uid, member, priv, cguAccepted, cguUrl, cguVersion }:
  { admin?: boolean; uid: string; member: Member | null; priv: Priv; cguAccepted: string | null; cguUrl: string; cguVersion: string }) {
  const [state, action] = useFormState(saveProfile, {} as { error?: string; ok?: boolean });
  const [kind, setKind] = useState(member?.kind ?? "");
  const [plan, setPlan] = useState<string>(member?.plan ?? "occasionnel");
  const [siret, setSiret] = useState(priv?.siret ?? "");
  const [info, setInfo] = useState<Lookup | null>(priv?.legal_name ? { ok: true, name: priv.legal_name, naf: priv.naf, nafAllowed: true, active: true, vat: priv.vat_number } : null);
  const [kbis, setKbis] = useState(priv?.kbis_path ?? "");
  const [kbisMsg, setKbisMsg] = useState(priv?.kbis_path ? "Kbis déjà joint." : "Obligatoire pour valider votre compte.");

  async function check() {
    setInfo({ ok: false, error: "Vérification au registre des entreprises…" });
    const r = await fetch(`/api/siret?siret=${encodeURIComponent(siret)}`);
    setInfo(await r.json());
  }
  async function uploadKbis(f: File) {
    setKbisMsg("Envoi en cours…");
    const ext = f.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${uid}/kbis-${Date.now()}.${ext}`;
    const { error } = await supabaseBrowser().storage.from("kbis").upload(path, f, { upsert: true });
    if (error) { setKbisMsg("L'envoi a échoué. Réessayez."); return; }
    setKbis(path); setKbisMsg("Kbis joint. Enregistrez votre fiche.");
  }

  return (
    <form action={action}>
      <div className="group">
        <h3>Votre établissement</h3>
        <div className="field">
          <label htmlFor="siret">SIRET de l&apos;établissement *</label>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <input id="siret" name="siret" inputMode="numeric" value={siret} onChange={(e) => setSiret(e.target.value.replace(/[^\d ]/g, ""))} placeholder="14 chiffres" />
            <button type="button" className="btn sm" onClick={check}>Vérifier</button>
          </div>
          {info && !info.ok && <p className="hint">{info.error}</p>}
          {info?.ok && (
            <div className={(info.nafAllowed || admin) && info.active ? "notice ok" : "notice"}>
              <b>{info.name}</b><br />{info.address}<br />
              Code NAF {info.naf} {info.nafLabel ? `· ${info.nafLabel}` : ""} · TVA {info.vat}<br />
              {!info.active ? "Établissement fermé au registre : inscription impossible." : info.nafAllowed ? "Activité autorisée au Cercle." : admin ? "Compte administrateur : votre société est acceptée." : "Ce code d'activité ne permet pas l'accès au Cercle, réservé aux métiers de la restauration, du vin et des spiritueux."}
            </div>
          )}
        </div>
        <div className="field"><label htmlFor="pseudo">Pseudo public *</label><input id="pseudo" name="pseudo" defaultValue={member?.pseudo} placeholder="ex. Cave du 6e" /><span className="hint">Le seul nom visible avant une vente.</span></div>
        <div className="field"><label htmlFor="kind">Vous êtes *</label>
          <select id="kind" name="kind" value={kind} onChange={(e) => { setKind(e.target.value); if (isProducer(e.target.value)) setPlan("pro"); }}>
            <option value="">Choisir…</option>{KINDS.map((k) => <option key={k}>{k}</option>)}
          </select></div>
        <div className="field"><label htmlFor="phone">Téléphone *</label><input id="phone" name="phone" type="tel" defaultValue={priv?.phone} /><span className="hint">Montré uniquement à votre contrepartie, après confirmation d&apos;une vente.</span></div>
      </div>

      <div className="group">
        <h3>Justificatifs</h3>
        <div className="field"><label htmlFor="licence">Licence de débit de boissons, de restaurant ou de vente à emporter *</label><input id="licence" name="licence" defaultValue={priv?.licence} /></div>
        <div className="field"><label htmlFor="excise">Numéro d&apos;accise {isProducer(kind) ? "*" : "(facultatif)"}</label><input id="excise" name="excise" defaultValue={priv?.excise_number ?? ""} placeholder="ex. FR0…" /><span className="hint">Obligatoire pour les vignerons, négociants, distilleries et grossistes.</span></div>
        <div className="field"><span className="lbl">Extrait Kbis de moins de 3 mois *</span>
          <label className="btn sm" style={{ justifySelf: "start" }}>{kbis ? "Remplacer le Kbis" : "Joindre le Kbis (PDF ou photo)"}
            <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => e.target.files?.[0] && uploadKbis(e.target.files[0])} /></label>
          <span className="hint">{kbisMsg}</span><input type="hidden" name="kbis" value={kbis} /></div>
      </div>

      <div className="group">
        <h3>Formule vendeur</h3>
        <p className="hint">Acheter est toujours gratuit. Vous ne payez que si vous vendez.</p>
        <label className="check"><input type="radio" name="plan" value="occasionnel" checked={plan === "occasionnel"} onChange={() => setPlan("occasionnel")} /><span><b>Occasionnel</b> · aucun abonnement, 8 % HT par vente</span></label>
        <label className="check"><input type="radio" name="plan" value="pro" checked={plan === "pro"} onChange={() => setPlan("pro")} /><span><b>Pro</b> · 29 € HT par mois + 2 % par vente, plus avantageux au-delà d&apos;environ 480 € de ventes par mois</span></label>
      </div>

      <div className="group">
        <label className="check"><input type="checkbox" name="cgu" defaultChecked={!!cguAccepted} />
          <span>J&apos;accepte les <a href={cguUrl} target="_blank" rel="noopener">conditions générales</a> (version du {cguVersion}) : aucune transaction hors plateforme, aucune revente aux particuliers.</span></label>
        {cguAccepted && <p className="hint">Acceptées le {new Date(cguAccepted).toLocaleString("fr-FR")}.</p>}
      </div>

      {state?.error && <div className="notice">{state.error}</div>}
      {state?.ok && <div className="notice ok">Fiche enregistrée. {member?.status === "active" ? "" : "Vérification sous 72 h ouvrées."}</div>}
      <Submit label={member ? "Enregistrer" : "Envoyer ma demande"} />
    </form>
  );
}
