import {
  DealRow,
  SpendRow,
  CampaignRule,
  CourseRule,
  Settings,
  RuleIndex,
  buildRuleIndex,
  findRule,
  classifyAd,
  classifyActual,
  constrainCity,
  isQual,
  isSale,
  makeLabel,
  norm,
} from "./classify";
import { UNKNOWN } from "./config";

export type MasterRow = {
  amoId: string;
  createdAt: Date;
  stage: string;
  budget: number;
  isQual: boolean;
  isSale: boolean;
  revenue: number;
  utmSource: string | null;
  adDirection: string;
  adCity: string | null;
  adLabel: string;
  actualDirection: string;
  actualCity: string | null;
  actualLabel: string;
};

export type MetricRow = {
  label: string;
  leads: number;
  qual: number;
  qualPct: number;
  sales: number;
  revenue: number;
  spend: number;
  cpl: number;
  cpql: number;
  romi: number;
};

/** Одна строка = один лид. Подтягивает рекламное и фактическое направления. */
export function buildMaster(
  deals: DealRow[],
  rules: CampaignRule[],
  courseRules: CourseRule[],
  settings: Settings
): MasterRow[] {
  const idx = buildRuleIndex(rules);
  return deals.map((d) => {
    const ad = classifyAd(d, idx);
    const actual = classifyActual(d, courseRules);
    const sale = isSale(d.stage, settings);
    return {
      amoId: d.amoId,
      createdAt: d.createdAt,
      stage: d.stage,
      budget: d.budget,
      isQual: isQual(d.stage, settings),
      isSale: sale,
      revenue: sale ? d.budget : 0,
      utmSource: d.utmSource,
      adDirection: ad.direction,
      adCity: ad.city,
      adLabel: makeLabel(ad.direction, ad.city, settings.splitByCity),
      actualDirection: actual.direction,
      actualCity: actual.city,
      actualLabel: makeLabel(actual.direction, actual.city, settings.splitByCity),
    };
  });
}

function indexDealsByAdKey(deals: DealRow[]) {
  const byAd = new Map<string, DealRow[]>();
  const byAdset = new Map<string, DealRow[]>();
  for (const d of deals) {
    const c = norm(d.utmMedium),
      a = norm(d.utmCampaign),
      ad = norm(d.utmContent);
    const k3 = `${c}|${a}|${ad}`,
      k2 = `${c}|${a}`;
    (byAd.get(k3) ?? byAd.set(k3, []).get(k3)!).push(d);
    (byAdset.get(k2) ?? byAdset.set(k2, []).get(k2)!).push(d);
  }
  return { byAd, byAdset };
}

/**
 * Разнесение расхода Meta по РЕКЛАМНЫМ направлениям.
 * Направление берётся из справочника кампаний; если группа мультигородняя —
 * расход делится между городами пропорционально числу лидов в amo с тем же
 * ключом кампания/группа/объявление (фолбэк — кампания/группа).
 * Возвращает сумму в ₸ на каждую метку направления.
 */
export function allocateSpendByDirection(
  spends: SpendRow[],
  deals: DealRow[],
  rules: CampaignRule[],
  settings: Settings
): Map<string, number> {
  const idx: RuleIndex = buildRuleIndex(rules);
  const { byAd, byAdset } = indexDealsByAdKey(deals);
  const out = new Map<string, number>();
  const add = (label: string, v: number) =>
    out.set(label, (out.get(label) ?? 0) + v);

  for (const sp of spends) {
    const kzt = sp.spendUsd * settings.usdToKzt;
    const rule = findRule(idx, sp.campaign, sp.adset);
    if (!rule) {
      add(UNKNOWN, kzt);
      continue;
    }
    const dir = rule.direction;
    if (!settings.splitByCity[dir]) {
      add(makeLabel(dir, null, settings.splitByCity), kzt);
      continue;
    }
    if (rule.city && !rule.multiCity) {
      add(makeLabel(dir, rule.city, settings.splitByCity), kzt);
      continue;
    }
    // мультигородняя группа → сплит по факту лидов
    const c = norm(sp.campaign),
      a = norm(sp.adset),
      ad = norm(sp.ad);
    const leads = byAd.get(`${c}|${a}|${ad}`) ?? byAdset.get(`${c}|${a}`) ?? [];
    if (leads.length === 0) {
      add(makeLabel(dir, rule.city ?? null, settings.splitByCity), kzt);
      continue;
    }
    const byCity = new Map<string, number>();
    for (const l of leads) {
      const c2 = constrainCity(l.city, rule);
      const city = c2 && c2.trim() ? c2 : "";
      byCity.set(city, (byCity.get(city) ?? 0) + 1);
    }
    for (const [city, cnt] of byCity) {
      add(makeLabel(dir, city || null, settings.splitByCity), (kzt * cnt) / leads.length);
    }
  }
  return out;
}

/** Разнесение расхода по КАНАЛАМ (utm_source) пропорционально факту лидов. */
export function allocateSpendByChannel(
  spends: SpendRow[],
  deals: DealRow[],
  settings: Settings
): Map<string, number> {
  const { byAd, byAdset } = indexDealsByAdKey(deals);
  const NOTAG = "(без метки)";
  const out = new Map<string, number>();
  const add = (label: string, v: number) =>
    out.set(label, (out.get(label) ?? 0) + v);

  for (const sp of spends) {
    const kzt = sp.spendUsd * settings.usdToKzt;
    const c = norm(sp.campaign),
      a = norm(sp.adset),
      ad = norm(sp.ad);
    const leads = byAd.get(`${c}|${a}|${ad}`) ?? byAdset.get(`${c}|${a}`) ?? [];
    if (leads.length === 0) {
      add(NOTAG, kzt);
      continue;
    }
    const bySrc = new Map<string, number>();
    for (const l of leads) {
      const src = l.utmSource && l.utmSource.trim() ? l.utmSource : NOTAG;
      bySrc.set(src, (bySrc.get(src) ?? 0) + 1);
    }
    for (const [src, cnt] of bySrc) add(src, (kzt * cnt) / leads.length);
  }
  return out;
}

// ─────────────────────────── Сводки ───────────────────────────

function emptyMetric(label: string): MetricRow {
  return { label, leads: 0, qual: 0, qualPct: 0, sales: 0, revenue: 0, spend: 0, cpl: 0, cpql: 0, romi: 0 };
}

function finalize(m: MetricRow): MetricRow {
  m.qualPct = m.leads ? (m.qual / m.leads) * 100 : 0;
  m.cpl = m.leads ? m.spend / m.leads : 0;
  m.cpql = m.qual ? m.spend / m.qual : 0;
  m.romi = m.spend ? ((m.revenue - m.spend) / m.spend) * 100 : 0;
  return m;
}

/** Маркетинговая сводка по рекламным направлениям (метки adLabel) + расход. */
export function summarizeByAd(
  master: MasterRow[],
  spendByLabel: Map<string, number>
): { rows: MetricRow[]; total: MetricRow } {
  const map = new Map<string, MetricRow>();
  const get = (l: string) => map.get(l) ?? map.set(l, emptyMetric(l)).get(l)!;
  for (const r of master) {
    const m = get(r.adLabel);
    m.leads++;
    if (r.isQual) m.qual++;
    if (r.isSale) {
      m.sales++;
      m.revenue += r.revenue;
    }
  }
  for (const [label, spend] of spendByLabel) get(label).spend += spend;

  const rows = [...map.values()].map(finalize);
  rows.sort((a, b) => (a.label === UNKNOWN ? 1 : b.label === UNKNOWN ? -1 : b.spend - a.spend));

  const total = emptyMetric("ИТОГО");
  for (const r of rows) {
    total.leads += r.leads;
    total.qual += r.qual;
    total.sales += r.sales;
    total.revenue += r.revenue;
    total.spend += r.spend;
  }
  finalize(total);
  return { rows, total };
}

/** Продуктовая сводка: по фактическому направлению продажи (только проданные). */
export function summarizeProduct(
  master: MasterRow[]
): { rows: { label: string; sales: number; revenue: number }[]; total: { sales: number; revenue: number } } {
  const map = new Map<string, { label: string; sales: number; revenue: number }>();
  const get = (l: string) => map.get(l) ?? map.set(l, { label: l, sales: 0, revenue: 0 }).get(l)!;
  let ts = 0,
    tr = 0;
  for (const r of master) {
    if (!r.isSale) continue;
    const m = get(r.actualLabel);
    m.sales++;
    m.revenue += r.revenue;
    ts++;
    tr += r.revenue;
  }
  const rows = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  return { rows, total: { sales: ts, revenue: tr } };
}

/** Матрица «рекламное направление → фактическое направление» по проданным сделкам. */
export function buildMatrix(master: MasterRow[]) {
  const adDirs = new Set<string>();
  const actDirs = new Set<string>();
  const cells = new Map<string, { count: number; revenue: number }>();
  for (const r of master) {
    if (!r.isSale) continue;
    adDirs.add(r.adDirection);
    actDirs.add(r.actualDirection);
    const k = `${r.adDirection}|||${r.actualDirection}`;
    const c = cells.get(k) ?? cells.set(k, { count: 0, revenue: 0 }).get(k)!;
    c.count++;
    c.revenue += r.revenue;
  }
  const order = (arr: Set<string>) =>
    [...arr].sort((a, b) => (a === UNKNOWN ? 1 : b === UNKNOWN ? -1 : a.localeCompare(b, "ru")));
  return { adDirections: order(adDirs), actualDirections: order(actDirs), cells };
}

/** Сводка по каналам (utm_source). */
export function summarizeChannels(
  master: MasterRow[],
  spendByChannel: Map<string, number>
): { rows: MetricRow[]; total: MetricRow } {
  const NOTAG = "(без метки)";
  const map = new Map<string, MetricRow>();
  const get = (l: string) => map.get(l) ?? map.set(l, emptyMetric(l)).get(l)!;
  for (const r of master) {
    const src = r.utmSource && r.utmSource.trim() ? r.utmSource : NOTAG;
    const m = get(src);
    m.leads++;
    if (r.isQual) m.qual++;
    if (r.isSale) {
      m.sales++;
      m.revenue += r.revenue;
    }
  }
  for (const [ch, spend] of spendByChannel) get(ch).spend += spend;
  const rows = [...map.values()].map(finalize).sort((a, b) => b.leads - a.leads);
  const total = emptyMetric("ИТОГО");
  for (const r of rows) {
    total.leads += r.leads;
    total.qual += r.qual;
    total.sales += r.sales;
    total.revenue += r.revenue;
    total.spend += r.spend;
  }
  finalize(total);
  return { rows, total };
}
