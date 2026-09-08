import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Правила «Курс → направление» + список встреченных значений поля Курс. */
export async function GET() {
  const [rules, courses] = await Promise.all([
    prisma.courseMap.findMany({ orderBy: { priority: "desc" } }),
    prisma.deal.findMany({
      where: { courseRaw: { not: null } },
      select: { courseRaw: true },
      distinct: ["courseRaw"],
      take: 500,
    }),
  ]);
  return NextResponse.json({
    rules,
    values: courses.map((c) => c.courseRaw).filter(Boolean),
  });
}

export async function POST(req: Request) {
  const b = await req.json();
  const pattern = String(b.pattern ?? "").trim();
  if (!pattern) return NextResponse.json({ error: "pattern обязателен" }, { status: 400 });
  const rule = await prisma.courseMap.upsert({
    where: { pattern },
    create: {
      pattern,
      direction: String(b.direction),
      priority: Number(b.priority ?? 0),
      note: b.note ? String(b.note) : null,
    },
    update: {
      direction: String(b.direction),
      priority: Number(b.priority ?? 0),
      note: b.note ? String(b.note) : null,
    },
  });
  return NextResponse.json({ ok: true, rule });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  await prisma.courseMap.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
