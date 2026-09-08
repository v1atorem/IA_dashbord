/**
 * Начальное наполнение: настройки, стартовые справочники.
 *   npm run db:seed
 * Направления кампаний — предзаполнены по названиям (проверь и поправь в UI).
 */
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_QUAL_STAGES,
  DEFAULT_SALE_STAGES,
  DEFAULT_SPLIT_BY_CITY,
  DEFAULT_USD_TO_KZT,
  DIRECTION_CITIES,
} from "../src/lib/config";

const prisma = new PrismaClient();

// кампания → направление (по данным августа; города берём из справочника направления)
const CAMPAIGN_DIRECTION: Record<string, string> = {
  tz_july: "ТЗ",
  tz_stazh: "ТЗ",
  august_tz: "ТЗ",
  plan_august_tz: "ТЗ",
  "Leads_TZ_07.07": "ТЗ",
  kaspi24_tz: "ТЗ",
  каспи_тз: "ТЗ",
  tz_shym_kara: "ТЗ",
  Bestseller_oldbutgold: "ТЗ",
  Bestseller_LAL: "ТЗ",
  gp_augistin: "ГП",
  gp_july: "ГП",
  "Leads_GP_07.07": "ГП",
  kaspi24_gp: "ГП",
  ГП_бестселлер: "ГП",
  ГП_каспи: "ГП",
  ГП_квал: "ГП",
  Bust_plus_1307: "Буст+",
  TZ_kaz: "Казахский",
};

const COURSE_RULES: { pattern: string; direction: string; priority: number }[] = [
  { pattern: "Каз", direction: "Казахский", priority: 100 },
  { pattern: "ГП", direction: "ГП", priority: 90 },
  { pattern: "Стретчинг", direction: "ГП", priority: 80 },
  { pattern: "Силовые", direction: "ГП", priority: 80 },
  { pattern: "Пилатес", direction: "ГП", priority: 80 },
  { pattern: "MindBody", direction: "ГП", priority: 80 },
  { pattern: "Balance", direction: "ГП", priority: 80 },
  { pattern: "Сам себе тренер", direction: "Буст+", priority: 70 },
  { pattern: "Будь как про", direction: "Буст+", priority: 70 },
  { pattern: "Career Boost", direction: "ТЗ", priority: 50 },
];

async function main() {
  // настройки
  const settings: [string, unknown][] = [
    ["usdToKzt", DEFAULT_USD_TO_KZT],
    ["qualStages", DEFAULT_QUAL_STAGES],
    ["saleStages", DEFAULT_SALE_STAGES],
    ["splitByCity", DEFAULT_SPLIT_BY_CITY],
  ];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: {}, // не перетираем, если уже настроено
    });
  }

  // справочник кампаний (правило на всю кампанию: adset="*")
  for (const [campaign, direction] of Object.entries(CAMPAIGN_DIRECTION)) {
    const cities = DIRECTION_CITIES[direction] ?? [];
    const multiCity = cities.length > 1;
    await prisma.campaignMap.upsert({
      where: { campaign_adset: { campaign, adset: "*" } },
      create: { campaign, adset: "*", direction, multiCity, cities },
      update: {},
    });
  }

  // правила курса
  for (const r of COURSE_RULES) {
    await prisma.courseMap.upsert({
      where: { pattern: r.pattern },
      create: r,
      update: {},
    });
  }

  console.log("Seed готов: настройки, справочник кампаний, правила курса.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
