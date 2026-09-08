import { prisma } from "./db";
import { fetchDeals } from "./amo";
import { fetchSpend } from "./facebook";
import { loadSettings } from "./settings";
import {
  buildMaster,
  allocateSpendByDirection,
  allocateSpendByChannel,
  summarizeByAd,
  summarizeProduct,
  buildMatrix,
  summarizeChannels,
} from "./aggregate";
import type { DealRow, SpendRow, CampaignRule, CourseRule } from "./classify";

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayEnd(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function logRun(source: string, fn: () => Promise<number>): Promise<void> {
  const run = await prisma.syncRun.create({ data: { source, status: "running" } });
  try {
    const rows = await fn();
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "ok", finishedAt: new Date(), rows },
    });
  } catch (e: any) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "error", finishedAt: new Date(), message: String(e?.message ?? e) },
    });
    throw e;
  }
}

/** Синхронизация сделок amoCRM за период (по дате создания). */
export async function syncAmo(from: Date, to: Date) {
  await logRun("amo", async () => {
    const deals = await fetchDeals(dayStart(from), dayEnd(to));
    for (const d of deals) {
      await prisma.deal.upsert({
        where: { amoId: BigInt(d.amoId) },
        create: {
          amoId: BigInt(d.amoId),
          createdAt: d.createdAt,
          stage: d.stage,
          budget: d.budget,
          city: d.city,
          utmSource: d.utmSource,
          utmMedium: d.utmMedium,
          utmCampaign: d.utmCampaign,
          utmContent: d.utmContent,
          courseRaw: d.courseRaw,
          formName: d.formName,
          dealName: d.dealName,
        },
        update: {
          stage: d.stage,
          budget: d.budget,
          city: d.city,
          courseRaw: d.courseRaw,
          updatedAt: new Date(),
        },
      });
    }
    return deals.length;
  });
}

/** Синхронизация расходов Facebook за период (по дню). */
export async function syncFb(from: Date, to: Date) {
  await logRun("fb", async () => {
    const rows = await fetchSpend(dayStart(from), dayEnd(to));
    await prisma.adSpend.deleteMany({
      where: { date: { gte: dayStart(from), lte: dayEnd(to) } },
    });
    if (rows.length) {
      await prisma.adSpend.createMany({
        data: rows.map((r) => ({
          date: dayStart(r.date),
          adAccountId: r.adAccountId,
          campaign: r.campaign,
          adset: r.adset,
          ad: r.ad,
          spendUsd: r.spendUsd,
          impressions: r.impressions,
          clicks: r.clicks,
        })),
        skipDuplicates: true,
      });
    }
    return rows.length;
  });
}

export async function syncAll(from: Date, to: Date) {
  await syncAmo(from, to);
  await syncFb(from, to);
}

/** Полный отчёт за период из БД: сводки, матрица, master. */
export async function getReport(from: Date, to: Date) {
  const [dealsDb, spendsDb, rulesDb, coursesDb, settings] = await Promise.all([
    prisma.deal.findMany({
      where: { createdAt: { gte: dayStart(from), lte: dayEnd(to) } },
    }),
    prisma.adSpend.findMany({
      where: { date: { gte: dayStart(from), lte: dayEnd(to) } },
    }),
    prisma.campaignMap.findMany(),
    prisma.courseMap.findMany(),
    loadSettings(),
  ]);

  const deals: DealRow[] = dealsDb.map((d) => ({
    amoId: String(d.amoId),
    createdAt: d.createdAt,
    stage: d.stage,
    budget: d.budget,
    city: d.city,
    utmSource: d.utmSource,
    utmMedium: d.utmMedium,
    utmCampaign: d.utmCampaign,
    utmContent: d.utmContent,
    courseRaw: d.courseRaw,
    formName: d.formName,
  }));
  const spends: SpendRow[] = spendsDb.map((s) => ({
    date: s.date,
    campaign: s.campaign,
    adset: s.adset,
    ad: s.ad,
    spendUsd: s.spendUsd,
  }));
  const rules: CampaignRule[] = rulesDb.map((r) => ({
    campaign: r.campaign,
    adset: r.adset,
    direction: r.direction,
    city: r.city,
    multiCity: r.multiCity,
    cities: r.cities,
  }));
  const courseRules: CourseRule[] = coursesDb.map((c) => ({
    pattern: c.pattern,
    direction: c.direction,
    priority: c.priority,
  }));

  const master = buildMaster(deals, rules, courseRules, settings);
  const spendByLabel = allocateSpendByDirection(spends, deals, rules, settings);
  const spendByChannel = allocateSpendByChannel(spends, deals, settings);

  return {
    settings,
    counts: { deals: deals.length, spendRows: spends.length, rules: rules.length },
    byAd: summarizeByAd(master, spendByLabel),
    product: summarizeProduct(master),
    matrix: buildMatrix(master),
    channels: summarizeChannels(master, spendByChannel),
    totalSpendUsd: spends.reduce((a, s) => a + s.spendUsd, 0),
  };
}
