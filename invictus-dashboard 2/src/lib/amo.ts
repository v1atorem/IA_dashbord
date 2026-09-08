import { env, AMO_FIELD_NAMES } from "./config";
import { norm } from "./classify";

const base = () => `https://${env.amoSubdomain}.amocrm.ru`;

function authHeaders() {
  if (!env.amoToken) throw new Error("AMO_ACCESS_TOKEN не задан");
  return { Authorization: `Bearer ${env.amoToken}`, "Content-Type": "application/json" };
}

async function amoGet(path: string): Promise<any> {
  const res = await fetch(`${base()}${path}`, { headers: authHeaders(), cache: "no-store" });
  if (res.status === 204) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`amoCRM ${res.status} ${path}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** status_id → название стадии для воронки. */
export async function fetchStageNames(pipelineId: string): Promise<Map<number, string>> {
  const data = await amoGet(`/api/v4/leads/pipelines/${pipelineId}`);
  const map = new Map<number, string>();
  const statuses = data?._embedded?.statuses ?? [];
  for (const s of statuses) map.set(Number(s.id), String(s.name));
  return map;
}

function pickCustomField(cfv: any[], names: string[]): string | null {
  if (!Array.isArray(cfv)) return null;
  const wanted = names.map(norm);
  for (const f of cfv) {
    if (wanted.includes(norm(f.field_name))) {
      const vals = (f.values ?? [])
        .map((v: any) => (v?.value ?? "").toString())
        .filter(Boolean);
      if (vals.length) return vals.join(", ");
    }
  }
  return null;
}

export type AmoDeal = {
  amoId: string;
  createdAt: Date;
  stage: string;
  budget: number;
  city: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  courseRaw: string | null;
  formName: string | null;
  dealName: string | null;
};

function mapLead(raw: any, stages: Map<number, string>): AmoDeal {
  const cfv = raw.custom_fields_values ?? [];
  return {
    amoId: String(raw.id),
    createdAt: new Date(Number(raw.created_at) * 1000),
    stage: stages.get(Number(raw.status_id)) ?? `status_${raw.status_id}`,
    budget: Number(raw.price ?? 0) || 0,
    city: pickCustomField(cfv, AMO_FIELD_NAMES.city),
    utmSource: pickCustomField(cfv, AMO_FIELD_NAMES.utmSource),
    utmMedium: pickCustomField(cfv, AMO_FIELD_NAMES.utmMedium),
    utmCampaign: pickCustomField(cfv, AMO_FIELD_NAMES.utmCampaign),
    utmContent: pickCustomField(cfv, AMO_FIELD_NAMES.utmContent),
    courseRaw: pickCustomField(cfv, AMO_FIELD_NAMES.course),
    formName: pickCustomField(cfv, AMO_FIELD_NAMES.formName),
    dealName: raw.name ?? null,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Тянет сделки из воронки по дате СОЗДАНИЯ в диапазоне [from, to] (включительно по дню).
 * Пагинация по 250, с пауза­ми против лимитов.
 */
export async function fetchDeals(from: Date, to: Date): Promise<AmoDeal[]> {
  const stages = await fetchStageNames(env.amoPipelineId);
  const fromUnix = Math.floor(from.getTime() / 1000);
  const toUnix = Math.floor(to.getTime() / 1000);
  const out: AmoDeal[] = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const qs = new URLSearchParams({
      page: String(page),
      limit: "250",
      "filter[created_at][from]": String(fromUnix),
      "filter[created_at][to]": String(toUnix),
    });
    if (env.amoPipelineId) qs.set("filter[pipeline_id]", env.amoPipelineId);
    const data = await amoGet(`/api/v4/leads?${qs.toString()}`);
    const leads = data?._embedded?.leads ?? [];
    for (const l of leads) out.push(mapLead(l, stages));
    if (leads.length < 250) break;
    page++;
    await sleep(300);
  }
  return out;
}
