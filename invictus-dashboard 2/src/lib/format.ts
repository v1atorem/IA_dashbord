export const fmtInt = (n: number) =>
  Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ");

export const fmtKzt = (n: number) => fmtInt(n) + " ₸";

export const fmtPct = (n: number) =>
  (Math.round(n * 10) / 10).toLocaleString("ru-RU") + "%";

export function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}
