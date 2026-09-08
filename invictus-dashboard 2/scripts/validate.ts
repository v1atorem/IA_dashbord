/**
 * Проверка ядра расчёта на выгрузках, без БД. Строит авто-справочник кампаний
 * по ключевым словам и печатает сводку + проверку сохранения денег при разнесении.
 *   npm run validate -- --amo path/amocrm.csv --fb path/fb.xlsx [--rate 465]
 */
import { parseAmoCsv, parseFbExport } from "../src/lib/importExports";
import {
  buildMaster,
  allocateSpendByDirection,
  summarizeByAd,
  summarizeProduct,
} from "../src/lib/aggregate";
import type { DealRow, SpendRow, CampaignRule, CourseRule, Settings } from "../src/lib/classify";
import {
  DEFAULT_QUAL_STAGES,
  DEFAULT_SALE_STAGES,
  DEFAULT_SPLIT_BY_CITY,
  DIRECTION_CITIES,
} from "../src/lib/config";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

function directionFor(campaign: string): string | null {
  const c = campaign.toLowerCase();
  if (c.includes("bust")) return "Буст+";
  if (c.includes("kaz")) return "Казахский";
  if (c.startsWith("tz") || c.includes("_tz") || c.includes("tz_") || c.includes("bestseller")) return "ТЗ";
  if (c.startsWith("gp") || c.includes("_gp") || c.includes("gp_") || c.includes("гп")) return "ГП";
  return null;
}

function main() {
  const amoPath = arg("amo");
  const fbPath = arg("fb");
  const rate = Number(arg("rate") ?? "465");
  if (!amoPath || !fbPath) {
    console.error("Нужно --amo <csv> и --fb <xlsx|csv>");
    process.exit(1);
  }

  const deals: DealRow[] = parseAmoCsv(amoPath).map((d) => ({ ...d }));
  const fb: SpendRow[] = parseFbExport(fbPath).map((s) => ({
    date: s.date,
    campaign: s.campaign,
    adset: s.adset,
    ad: s.ad,
    spendUsd: s.spendUsd,
  }));

  const rules: CampaignRule[] = [];
  const seen = new Set<string>();
  for (const s of fb) {
    const dir = directionFor(s.campaign);
    if (!dir || seen.has(s.campaign)) continue;
    seen.add(s.campaign);
    const cities = DIRECTION_CITIES[dir] ?? [];
    rules.push({ campaign: s.campaign, adset: "*", direction: dir, city: null, multiCity: cities.length > 1, cities });
  }
  const courseRules: CourseRule[] = [
    { pattern: "Каз", direction: "Казахский", priority: 100 },
    { pattern: "ГП", direction: "ГП", priority: 90 },
    { pattern: "Career Boost", direction: "ТЗ", priority: 50 },
  ];
  const settings: Settings = {
    qualStages: DEFAULT_QUAL_STAGES,
    saleStages: DEFAULT_SALE_STAGES,
    usdToKzt: rate,
    splitByCity: DEFAULT_SPLIT_BY_CITY,
  };

  const master = buildMaster(deals, rules, courseRules, settings);
  const spendByLabel = allocateSpendByDirection(fb, deals, rules, settings);
  const { rows, total } = summarizeByAd(master, spendByLabel);
  const product = summarizeProduct(master);

  const totalUsd = fb.reduce((a, s) => a + s.spendUsd, 0);
  const allocated = [...spendByLabel.values()].reduce((a, b) => a + b, 0);

  console.log(`Лидов: ${deals.length} | строк расхода: ${fb.length}`);
  console.log(`Расход Meta: $${totalUsd.toFixed(2)} × ${rate} = ${Math.round(totalUsd * rate).toLocaleString("ru-RU")} ₸`);
  console.log(`Разнесено по направлениям:            ${Math.round(allocated).toLocaleString("ru-RU")} ₸`);
  console.log(`Деньги сохранены: ${Math.abs(allocated - totalUsd * rate) < 1e-6 ? "ДА ✓" : "НЕТ ✗"}`);
  console.log(`\nПродажи всего: ${total.sales} | выручка: ${Math.round(total.revenue).toLocaleString("ru-RU")} ₸\n`);
  console.log("Рекламные направления:");
  for (const r of rows)
    console.log(`  ${r.label.padEnd(26)} лиды ${String(r.leads).padStart(5)}  квал ${String(r.qual).padStart(4)}  прод ${String(r.sales).padStart(3)}  ROMI ${r.romi.toFixed(0)}%`);
  console.log("\nФактические направления (продукт):");
  for (const r of product.rows)
    console.log(`  ${r.label.padEnd(26)} прод ${String(r.sales).padStart(3)}  выручка ${Math.round(r.revenue).toLocaleString("ru-RU")}`);
}

main();
