import { notFound } from "next/navigation";
import { requireActive } from "./session";

/** Commande complète, visible uniquement par le vendeur, l'acheteur ou l'administrateur. */
export async function loadOrder(id: string) {
  const s = await requireActive();
  const { data: o } = await s.supabase.from("orders")
    .select("*, offer:offers(*), seller:members!orders_seller_id_fkey(pseudo,city,kind), buyer:members!orders_buyer_id_fkey(pseudo,city,kind), shipment:shipments(*)")
    .eq("id", id).maybeSingle();
  if (!o) notFound();
  const [{ data: sp }, { data: bp }] = await Promise.all([
    s.supabase.from("members_private").select("*").eq("id", o.seller_id).maybeSingle(),
    s.supabase.from("members_private").select("*").eq("id", o.buyer_id).maybeSingle(),
  ]);
  const shipment = Array.isArray(o.shipment) ? o.shipment[0] : o.shipment;
  return { ...s, o, sp, bp, shipment, isSeller: o.seller_id === s.user.id };
}
