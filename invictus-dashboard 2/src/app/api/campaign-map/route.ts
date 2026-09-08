import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Список правил + подсказки: кампании/группы из расхода и лидов. */
export async function GET() {
  const [rules, spendKeys, dealKeys] = await Promise.all([
    prisma.campaignMap.findMany({ orderBy: [{ campaign: "asc" }, { adset: "asc" }] }),
    prisma.adSpend.findMany({ select: { campaign: true, adset: true }, distinct: ["campaign", "adset"] }),
    prisma.deal.findMany({ select: { utmMedium: true, utmCampaign: true }, distinct: ["utmMedium", "utmCampaign"] }),
  ]);
  const seen = new Map<string, { campaign: string; adset: string }>();
  for (const s of spendKeys) if (s.campaign) seen.set(`${s.campaign}|${s.adset}`, { campaign: s.campaign, adset: s.adset });
  for (const d of dealKeys)
    if (d.utmMedium) seen.set(`${d.utmMedium}|${d.utmCampaign ?? ""}`, { campaign: d.utmMedium, adset: d.utmCampaign ?? "" });
  return NextResponse.json({ rules, options: [...seen.values()] });
}

export async function POST(req: Request) {
  const b = await req.json();
  const campaign = String(b.campaign ?? "").trim();
  const adset = String(b.adset ?? "*").trim() || "*";
  if (!campaign) return NextResponse.json({ error: "campaign обязателен" }, { status: 400 });
  const cities: string[] = Array.isArray(b.cities)
    ? b.cities.map((c: any) => String(c).trim()).filter(Boolean)
    : String(b.cities ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
  const rule = await prisma.campaignMap.upsert({
    where: { campaign_adset: { campaign, adset } },
    create: {
      campaign,
      adset,
      direction: String(b.direction),
      city: b.city ? String(b.city) : null,
      multiCity: Boolean(b.multiCity),
      cities,
      note: b.note ? String(b.note) : null,
    },
    update: {
      direction: String(b.direction),
      city: b.city ? String(b.city) : null,
      multiCity: Boolean(b.multiCity),
      cities,
      note: b.note ? String(b.note) : null,
    },
  });
  return NextResponse.json({ ok: true, rule });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  await prisma.campaignMap.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
