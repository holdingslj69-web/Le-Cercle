import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Lecture d'une étiquette par Claude (facultatif : nécessite ANTHROPIC_API_KEY).
export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Lecture d'étiquette non configurée." }, { status: 501 });
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { image, mediaType } = await req.json();
  if (typeof image !== "string" || image.length > 7_000_000) return NextResponse.json({ error: "Image trop lourde." }, { status: 400 });
  const prompt = `The image is a photo of a wine, champagne or spirit bottle label. Read only what is printed; do not guess.
Reply with only a JSON object: {"category":"Vin"|"Champagne"|"Spiritueux","name":"","producer":"","appellation":"","vintage":"","abv":"","volume":"37,5 cl"|"75 cl"|"Magnum 150 cl"|"Jéroboam 300 cl"|"35 cl"|"50 cl"|"70 cl"|"1 L"|"1,5 L"|"","spirit_type":"","grapes":"","bottled":""}. Use "" when not shown.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 400,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } }, { type: "text", text: prompt }] }],
    }),
  });
  if (!r.ok) return NextResponse.json({ error: "Lecture impossible pour le moment." }, { status: 502 });
  const out = await r.json();
  const text: string = out?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  try { return NextResponse.json(m ? JSON.parse(m[0]) : {}); } catch { return NextResponse.json({ error: "Réponse illisible." }, { status: 502 }); }
}
