/**
 * Залить существующие выгрузки в БД (для первичной сверки без API).
 *   npm run import:csv -- --amo path/to/amocrm_export.csv --fb path/to/fb_export.xlsx
 */
import { prisma } from "../src/lib/db";
import { parseAmoCsv, parseFbExport } from "../src/lib/importExports";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const amoPath = arg("amo");
  const fbPath = arg("fb");
  if (!amoPath && !fbPath) {
    console.error("Укажи --amo <csv> и/или --fb <xlsx|csv>");
    process.exit(1);
  }

  if (amoPath) {
    const deals = parseAmoCsv(amoPath);
    console.log(`amo: распознано ${deals.length} сделок, заливаю...`);
    let n = 0;
    for (const d of deals) {
      if (!d.amoId || isNaN(d.createdAt.getTime())) continue;
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
      n++;
    }
    console.log(`amo: залито ${n}`);
  }

  if (fbPath) {
    const rows = parseFbExport(fbPath);
    console.log(`fb: распознано ${rows.length} строк расхода, заливаю...`);
    // Импортные строки помечаем adAccountId="import"; чистим прошлый импорт
    await prisma.adSpend.deleteMany({ where: { adAccountId: "import" } });
    await prisma.adSpend.createMany({
      data: rows.map((r) => ({
        date: r.date,
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
    console.log(`fb: залито ${rows.length}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
