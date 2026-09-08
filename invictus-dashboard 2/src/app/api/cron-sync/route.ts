import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";
import { env } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Hobby = максимум 60; на Pro можно поднять до 300

/**
 * Плановая синхронизация (Vercel Cron). Vercel сам шлёт заголовок
 * Authorization: Bearer $CRON_SECRET, если задан env CRON_SECRET.
 * Синхронизируем последние ~35 дней (текущий период с запасом).
 */
export async function GET(req: Request) {
  if (env.cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 35);
  try {
    await syncAll(from, to);
    return NextResponse.json({ ok: true, from, to });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
