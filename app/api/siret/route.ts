import { NextResponse } from "next/server";
import { lookupSiret } from "@/lib/siret";

export async function GET(req: Request) {
  const info = await lookupSiret(new URL(req.url).searchParams.get("siret") ?? "");
  return NextResponse.json(info, { status: info.ok ? 200 : info.status });
}
