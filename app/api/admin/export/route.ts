import { supabaseServer } from "@/lib/supabase/server";

const q = (t: unknown) => `"${String(t ?? "").replace(/"/g, '""')}"`;
const num = (n: unknown) => Number(n || 0).toFixed(2).replace(".", ",");

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: admin } = user ? await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle() : { data: null };
  if (!admin) return new Response("Accès réservé", { status: 403 });
  const type = new URL(req.url).searchParams.get("type");
  let rows: unknown[][], name: string;
  if (type === "dac7") {
    const { data } = await supabase.from("admin_dac7").select("*").order("legal_name");
    rows = [["Dénomination", "SIREN", "TVA", "Adresse", "Code postal", "Ville", "Trimestre", "Nombre de ventes", "Montant brut HT", "Commissions HT"],
      ...(data ?? []).map((r: any) => [r.legal_name, r.siren, r.vat_number, r.address, r.postcode, r.city, `T${r.trimestre}`, r.nb_ventes, num(r.montant_brut), num(r.commissions)])];
    name = `dac7-${new Date().getFullYear()}.csv`;
  } else {
    const { data } = await supabase.from("admin_commissions_month").select("*").order("legal_name");
    rows = [["Établissement", "SIRET", "TVA", "Formule", "Ventes du mois", "Montant HT des ventes", "Commission HT", "Abonnement HT", "Total à facturer HT"],
      ...(data ?? []).filter((r: any) => r.nb_ventes > 0 || r.plan === "pro").map((r: any) => [r.legal_name, r.siret, r.vat_number, r.plan, r.nb_ventes, num(r.ventes_ht), num(r.commission_ht), num(r.abonnement_ht), num(Number(r.commission_ht) + Number(r.abonnement_ht))])];
    const d = new Date(); name = `commissions-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}.csv`;
  }
  const csv = "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` } });
}
