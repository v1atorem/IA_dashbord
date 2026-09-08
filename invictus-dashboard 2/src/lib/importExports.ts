import fs from "fs";
import { parse } from "csv-parse/sync";
import type { AmoDeal } from "./amo";
import type { FbSpendRow } from "./facebook";

/** Дата amo "31.08.2026 23:50:30" → Date. */
function parseAmoDate(s: string): Date {
  const m = String(s).match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return new Date(NaN);
  const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
}

const first = (row: Record<string, any>, keys: string[]): string | null => {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return null;
};

/** Парс выгрузки сделок amoCRM (CSV с заголовками на русском). */
export function parseAmoCsv(filePath: string): AmoDeal[] {
  const buf = fs.readFileSync(filePath);
  const records: Record<string, any>[] = parse(buf, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });
  return records
    .filter((r) => r["ID"])
    .map((r) => ({
      amoId: String(r["ID"]).trim(),
      createdAt: parseAmoDate(r["Дата создания сделки"]),
      stage: String(r["Этап сделки"] ?? "").trim(),
      budget: Number(String(r["Бюджет ₸"] ?? "0").replace(/[^\d.-]/g, "")) || 0,
      city: first(r, ["Город?", "ГОРОД_ПРОЖИВАНИЯ", "ГОРОД"]),
      utmSource: first(r, ["utm_source"]),
      utmMedium: first(r, ["utm_medium"]),
      utmCampaign: first(r, ["utm_campaign"]),
      utmContent: first(r, ["utm_content"]),
      courseRaw: first(r, ["Курс"]),
      formName: first(r, ["FORMNAME", "form_name"]),
      dealName: first(r, ["Название сделки"]),
    }));
}

/** Парс выгрузки Facebook Ads Manager. XLSX (через пакет xlsx) или CSV. */
export function parseFbExport(filePath: string): FbSpendRow[] {
  let rows: Record<string, any>[];
  if (filePath.toLowerCase().endsWith(".csv")) {
    rows = parse(fs.readFileSync(filePath), {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    });
  } else {
    // xlsx подключаем лениво, чтобы отсутствие пакета не ломало сборку остального
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require("xlsx");
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  }
  const spendKey = (r: Record<string, any>) =>
    Object.keys(r).find((k) => k.startsWith("Потраченная сумма")) ??
    Object.keys(r).find((k) => k.toLowerCase().startsWith("amount spent")) ??
    "spend";

  return rows
    .filter((r) => r["Название кампании"] || r["Campaign name"])
    .map((r) => {
      const dateRaw =
        r["Дата начала отчетности"] || r["Reporting starts"] || r["date_start"] || "";
      const d = /\d{4}-\d{2}-\d{2}/.test(String(dateRaw))
        ? new Date(String(dateRaw))
        : parseAmoDate(String(dateRaw));
      return {
        date: isNaN(d.getTime()) ? new Date() : d,
        adAccountId: "import",
        campaign: String(r["Название кампании"] ?? r["Campaign name"] ?? "").trim(),
        adset: String(r["Название группы объявлений"] ?? r["Ad set name"] ?? "").trim(),
        ad: String(r["Название объявления"] ?? r["Ad name"] ?? "").trim(),
        spendUsd: Number(String(r[spendKey(r)] ?? "0").replace(/[^\d.-]/g, "")) || 0,
        impressions: Number(String(r["Показы"] ?? r["Impressions"] ?? "0").replace(/[^\d.-]/g, "")) || 0,
        clicks: Number(String(r["Клики (все)"] ?? r["Clicks (all)"] ?? "0").replace(/[^\d.-]/g, "")) || 0,
      };
    });
}
