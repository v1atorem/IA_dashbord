import { UNKNOWN } from "./config";

export type DealRow = {
  amoId: string;
  createdAt: Date;
  stage: string;
  budget: number;
  city: string | null;
  utmSource: string | null;
  utmMedium: string | null; // = кампания
  utmCampaign: string | null; // = группа
  utmContent: string | null; // = объявление
  courseRaw: string | null;
  formName: string | null;
};

export type SpendRow = {
  date: Date;
  campaign: string;
  adset: string;
  ad: string;
  spendUsd: number;
};

export type CampaignRule = {
  campaign: string;
  adset: string; // "*" = вся кампания
  direction: string;
  city: string | null;
  multiCity: boolean;
  cities?: string[]; // для multiCity: разрешённые города (сплит только по ним)
};

/** Привести город лида к разрешённому списку группы (иначе — null). */
export function constrainCity(
  city: string | null,
  rule: CampaignRule | null
): string | null {
  if (!city || !city.trim()) return null;
  if (rule?.multiCity && rule.cities && rule.cities.length) {
    const allow = rule.cities.map(norm);
    return allow.includes(norm(city)) ? city : null;
  }
  return city;
}

export type CourseRule = { pattern: string; direction: string; priority: number };

export type Settings = {
  qualStages: string[];
  saleStages: string[];
  usdToKzt: number;
  splitByCity: Record<string, boolean>;
};

/** Нормализация для сопоставления строк (регистр/пробелы). */
export function norm(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/\s+/g, " ").trim().toLowerCase();
}

const NOCITY = "(город не указан)";

/** Метка направления для сводки. */
export function makeLabel(
  direction: string,
  city: string | null,
  splitByCity: Record<string, boolean>
): string {
  if (direction === UNKNOWN) return UNKNOWN;
  if (splitByCity[direction]) {
    return city && city.trim() ? `${direction} ${city}` : `${direction} ${NOCITY}`;
  }
  return direction;
}

/** Индекс правил кампаний: точная связка кампания+группа и фолбэк по кампании. */
export function buildRuleIndex(rules: CampaignRule[]) {
  const exact = new Map<string, CampaignRule>();
  const byCampaign = new Map<string, CampaignRule>();
  for (const r of rules) {
    const c = norm(r.campaign);
    if (norm(r.adset) === "*") byCampaign.set(c, r);
    else exact.set(`${c}|||${norm(r.adset)}`, r);
  }
  return { exact, byCampaign };
}

export type RuleIndex = ReturnType<typeof buildRuleIndex>;

/** Найти правило кампании для пары (кампания, группа). */
export function findRule(
  idx: RuleIndex,
  campaign: string | null,
  adset: string | null
): CampaignRule | null {
  const c = norm(campaign);
  const a = norm(adset);
  return idx.exact.get(`${c}|||${a}`) || idx.byCampaign.get(c) || null;
}

/** Рекламное направление лида: направление из справочника, город из правила или из поля "Город?". */
export function classifyAd(
  deal: DealRow,
  idx: RuleIndex
): { direction: string; city: string | null } {
  const rule = findRule(idx, deal.utmMedium, deal.utmCampaign);
  if (!rule) return { direction: UNKNOWN, city: null };
  const city =
    rule.city && !rule.multiCity ? rule.city : constrainCity(deal.city, rule);
  return { direction: rule.direction, city: city ?? null };
}

/** Фактическое направление продажи: по полю "Курс", город из "Город?". */
export function classifyActual(
  deal: DealRow,
  courseRules: CourseRule[]
): { direction: string; city: string | null } {
  const raw = deal.courseRaw;
  if (!raw || !raw.trim()) return { direction: UNKNOWN, city: deal.city ?? null };
  const n = norm(raw);
  // Дамп «все опции сразу» (поле не выбрано осознанно) — не классифицируем.
  const matched = courseRules
    .filter((r) => n.includes(norm(r.pattern)))
    .sort((a, b) => b.priority - a.priority);
  const distinct = new Set(matched.map((m) => m.direction));
  if (matched.length === 0) return { direction: UNKNOWN, city: deal.city ?? null };
  if (raw.length > 120 && distinct.size > 1)
    return { direction: UNKNOWN, city: deal.city ?? null };
  return { direction: matched[0].direction, city: deal.city ?? null };
}

export function isQual(stage: string, s: Settings): boolean {
  return s.qualStages.some((x) => norm(x) === norm(stage));
}
export function isSale(stage: string, s: Settings): boolean {
  return s.saleStages.some((x) => norm(x) === norm(stage));
}
