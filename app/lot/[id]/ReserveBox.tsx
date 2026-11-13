"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { reserve } from "./actions";
import { eur, half, shippingEstimate, unitPriceFor } from "@/lib/rules";

type O = { id: string; price: number; qty: number; format: string; carton_price: number | null; carton_size: number | null; split: boolean };
const MODES: [string, string][] = [["retrait", "Retrait"], ["coursier", "Coursier"], ["colis", "Colis"]];

function Btn({ total }: { total: number }) {
  const { pending } = useFormStatus();
  return <button className="btn primary block" type="submit" disabled={pending}>{pending ? "Réservation…" : `Réserver · ${eur(total)} HT`}</button>;
}

export default function ReserveBox({ offer }: { offer: O }) {
  const [mode, setMode] = useState("retrait");
  const [qty, setQty] = useState(offer.split ? Math.min(offer.qty, offer.carton_size ?? 6) : offer.qty);
  const [state, action] = useFormState(reserve, {} as { error?: string });
  const unit = unitPriceFor(offer.price, qty, offer.carton_price, offer.carton_size);
  const goods = unit * qty, ship = mode === "colis" ? shippingEstimate(offer.format, qty, goods) : 0, share = half(ship);
  return (
    <form action={action} className="group">
      <input type="hidden" name="offer" value={offer.id} /><input type="hidden" name="mode" value={mode} /><input type="hidden" name="qty" value={qty} />
      {offer.split && (
        <div className="row between"><span className="lbl">Quantité (sur {offer.qty})</span>
          <div className="row"><button type="button" className="btn sm" onClick={() => setQty(Math.max(1, qty - 1))}>−</button><b>{qty}</b><button type="button" className="btn sm" onClick={() => setQty(Math.min(offer.qty, qty + 1))}>+</button></div></div>
      )}
      <div className="row">{MODES.map(([k, l]) => <button key={k} type="button" className={`btn sm ${mode === k ? "primary" : ""}`} onClick={() => setMode(k)}>{l}</button>)}</div>
      <dl className="kv">
        <dt>Vin</dt><dd>{qty} × {eur(unit)} = {eur(goods)} HT</dd>
        {mode === "colis" && <><dt>Envoi estimé</dt><dd>{eur(ship)}, partagé avec le vendeur</dd><dt>Votre part</dt><dd>{eur(share)}</dd></>}
        {mode === "coursier" && <><dt>Coursier</dt><dd>Prix partagé moitié-moitié avec le vendeur</dd></>}
      </dl>
      {state?.error && <div className="notice">{state.error}</div>}
      <Btn total={goods + share} />
      <p className="hint" style={{ textAlign: "center" }}>Le vendeur a 48 h pour confirmer. Rien à payer avant sa facture.</p>
    </form>
  );
}
