import { NextResponse } from "next/server";
import { syncAll, syncAmo, syncFb } from "@/lib/sync";
import { env } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // сек (важно для хостинга при больших периодах)

function parseRange(body: any) {
  const from = new Date(body?.from);
  const to = new Date(body?.to);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  return { from, to };
}

export async function POST(req: Request) {
  // Разрешаем либо залогиненного (middleware пропустил), либо cron с секретом
  const cron = req.headers.get("x-cron-secret");
  const body = await req.json().catch(() => ({}));
  if (env.cronSecret && cron && cron !== env.cronSecret) {
    return NextResponse.json({ error: "bad cron secret" }, { status: 401 });
  }
  const range = parseRange(body);
  if (!range) return NextResponse.json({ error: "from/to обязательны (YYYY-MM-DD)" }, { status: 400 });

  const source = body?.source ?? "all";
  try {
    if (source === "amo") await syncAmo(range.from, range.to);
    else if (source === "fb") await syncFb(range.from, range.to);
    else await syncAll(range.from, range.to);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
