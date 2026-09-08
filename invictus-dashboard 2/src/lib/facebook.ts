import { env } from "./config";

export type FbSpendRow = {
  date: Date;
  adAccountId: string;
  campaign: string;
  adset: string;
  ad: string;
  spendUsd: number;
  impressions: number;
  clicks: number;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Дневной расход на уровне объявления из Facebook Marketing API.
 * Тянет по всем аккаунтам из FB_AD_ACCOUNT_IDS за диапазон дат.
 * spend — в валюте рекламного аккаунта (у Invictus = USD → конвертируем курсом).
 */
export async function fetchSpend(from: Date, to: Date): Promise<FbSpendRow[]> {
  if (!env.fbToken) throw new Error("FB_ACCESS_TOKEN не задан");
  if (env.fbAccounts.length === 0) throw new Error("FB_AD_ACCOUNT_IDS не заданы");

  const out: FbSpendRow[] = [];
  for (const acct of env.fbAccounts) {
    const params = new URLSearchParams({
      level: "ad",
      fields: "campaign_name,adset_name,ad_name,spend,impressions,clicks",
      time_range: JSON.stringify({ since: ymd(from), until: ymd(to) }),
      time_increment: "1",
      limit: "500",
      access_token: env.fbToken,
    });
    let url: string | null =
      `https://graph.facebook.com/${env.fbApiVersion}/${acct}/insights?${params.toString()}`;

    while (url) {
      const res = await fetch(url, { cache: "no-store" });
      const json: any = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? JSON.stringify(json).slice(0, 300);
        throw new Error(`Facebook API (${acct}): ${msg}`);
      }
      for (const row of json.data ?? []) {
        out.push({
          date: new Date(row.date_start),
          adAccountId: acct,
          campaign: row.campaign_name ?? "",
          adset: row.adset_name ?? "",
          ad: row.ad_name ?? "",
          spendUsd: Number(row.spend ?? 0) || 0,
          impressions: Number(row.impressions ?? 0) || 0,
          clicks: Number(row.clicks ?? 0) || 0,
        });
      }
      url = json.paging?.next ?? null;
    }
  }
  return out;
}
