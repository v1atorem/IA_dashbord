import { prisma } from "./db";
import type { Settings } from "./classify";
import {
  DEFAULT_QUAL_STAGES,
  DEFAULT_SALE_STAGES,
  DEFAULT_SPLIT_BY_CITY,
  DEFAULT_USD_TO_KZT,
} from "./config";

const KEYS = {
  qualStages: "qualStages",
  saleStages: "saleStages",
  usdToKzt: "usdToKzt",
  splitByCity: "splitByCity",
} as const;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

/** Загрузить настройки из БД с дефолтами. ENV USD_TO_KZT имеет приоритет. */
export async function loadSettings(): Promise<Settings> {
  const [qualStages, saleStages, splitByCity, usdSetting] = await Promise.all([
    readJson<string[]>(KEYS.qualStages, DEFAULT_QUAL_STAGES),
    readJson<string[]>(KEYS.saleStages, DEFAULT_SALE_STAGES),
    readJson<Record<string, boolean>>(KEYS.splitByCity, DEFAULT_SPLIT_BY_CITY),
    readJson<number>(KEYS.usdToKzt, DEFAULT_USD_TO_KZT),
  ]);
  const usdToKzt = process.env.USD_TO_KZT ? Number(process.env.USD_TO_KZT) : usdSetting;
  return { qualStages, saleStages, splitByCity, usdToKzt };
}

export async function saveSetting(key: string, value: unknown) {
  const v = JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: v },
    update: { value: v },
  });
}

export { KEYS as SETTING_KEYS };
