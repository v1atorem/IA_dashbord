import { NextResponse } from "next/server";
import { loadSettings, saveSetting, SETTING_KEYS } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await loadSettings());
}

export async function POST(req: Request) {
  const b = await req.json();
  if (b.usdToKzt != null) await saveSetting(SETTING_KEYS.usdToKzt, Number(b.usdToKzt));
  if (Array.isArray(b.qualStages)) await saveSetting(SETTING_KEYS.qualStages, b.qualStages);
  if (Array.isArray(b.saleStages)) await saveSetting(SETTING_KEYS.saleStages, b.saleStages);
  if (b.splitByCity && typeof b.splitByCity === "object")
    await saveSetting(SETTING_KEYS.splitByCity, b.splitByCity);
  return NextResponse.json({ ok: true });
}
