import Link from "next/link";
import Toolbar from "@/components/Toolbar";
import LogoutButton from "@/components/LogoutButton";
import { getReport } from "@/lib/sync";
import { fmtInt, fmtKzt, fmtPct, defaultRange } from "@/lib/format";
import type { MetricRow } from "@/lib/aggregate";

export const dynamic = "force-dynamic";

function MetricTable({
  title,
  firstCol,
  rows,
  total,
}: {
  title: string;
  firstCol: string;
  rows: MetricRow[];
  total?: MetricRow;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>{firstCol}</th>
              <th>Лиды</th>
              <th>Квал</th>
              <th>% квала</th>
              <th>Продажи</th>
              <th>Продажи ₸</th>
              <th>Расходы ₸</th>
              <th>CPL ₸</th>
              <th>CPQL ₸</th>
              <th>ROMI</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{fmtInt(r.leads)}</td>
                <td>{fmtInt(r.qual)}</td>
                <td>{fmtPct(r.qualPct)}</td>
                <td>{fmtInt(r.sales)}</td>
                <td>{fmtInt(r.revenue)}</td>
                <td>{fmtInt(r.spend)}</td>
                <td>{fmtInt(r.cpl)}</td>
                <td>{fmtInt(r.cpql)}</td>
                <td className={r.romi >= 0 ? "pos" : "neg"}>{fmtPct(r.romi)}</td>
              </tr>
            ))}
            {total && (
              <tr className="total">
                <td>{total.label}</td>
                <td>{fmtInt(total.leads)}</td>
                <td>{fmtInt(total.qual)}</td>
                <td>{fmtPct(total.qualPct)}</td>
                <td>{fmtInt(total.sales)}</td>
                <td>{fmtInt(total.revenue)}</td>
                <td>{fmtInt(total.spend)}</td>
                <td>{fmtInt(total.cpl)}</td>
                <td>{fmtInt(total.cpql)}</td>
                <td className={total.romi >= 0 ? "pos" : "neg"}>{fmtPct(total.romi)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const def = defaultRange();
  const from = searchParams.from || def.from;
  const to = searchParams.to || def.to;
  const rep = await getReport(new Date(from), new Date(to));

  const empty = rep.counts.deals === 0 && rep.counts.spendRows === 0;

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          Invictus <span>Dashboard</span>
        </div>
        <div className="nav">
          <Link href="/" className="active">Сводка</Link>
          <Link href="/mappings">Справочники</Link>
          <LogoutButton />
        </div>
      </div>

      <div className="container">
        <Toolbar from={from} to={to} />

        <div className="card small muted">
          Период <b>{from}</b> — <b>{to}</b> · лидов в базе: {fmtInt(rep.counts.deals)} ·
          строк расхода: {fmtInt(rep.counts.spendRows)} · расход Meta:{" "}
          {fmtKzt(rep.totalSpendUsd * rep.settings.usdToKzt)} (курс {rep.settings.usdToKzt} ₸/$) ·
          правил в справочнике: {fmtInt(rep.counts.rules)}
        </div>

        {empty && (
          <div className="card">
            База пуста за этот период. Нажми <b>«Синхронизировать amo+FB»</b> вверху (нужны ключи в
            <code> .env</code>), либо залей выгрузки командой{" "}
            <code>npm run import:csv</code>. Затем настрой{" "}
            <Link href="/mappings">справочники</Link>.
          </div>
        )}

        <MetricTable
          title="Маркетинг — по рекламным направлениям (расход всегда здесь)"
          firstCol="Рекламное направление"
          rows={rep.byAd.rows}
          total={rep.byAd.total}
        />

        <div className="grid2">
          <div className="card">
            <h2>Продукт — по фактическому направлению продажи</h2>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Фактическое направление</th>
                    <th>Продажи</th>
                    <th>Выручка ₸</th>
                  </tr>
                </thead>
                <tbody>
                  {rep.product.rows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td>{fmtInt(r.sales)}</td>
                      <td>{fmtInt(r.revenue)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>ИТОГО</td>
                    <td>{fmtInt(rep.product.total.sales)}</td>
                    <td>{fmtInt(rep.product.total.revenue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>Матрица: реклама → факт (продажи · выручка ₸)</h2>
            <div className="tablewrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <th>реклама ↓ / факт →</th>
                    {rep.matrix.actualDirections.map((a) => (
                      <th key={a}>{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rep.matrix.adDirections.map((ad) => (
                    <tr key={ad}>
                      <td>{ad}</td>
                      {rep.matrix.actualDirections.map((act) => {
                        const c = rep.matrix.cells.get(`${ad}|||${act}`);
                        return (
                          <td key={act} className={"cell" + (c ? " hascell" : "")}>
                            {c ? (
                              <>
                                {fmtInt(c.count)}
                                <div className="small muted">{fmtInt(c.revenue)}</div>
                              </>
                            ) : (
                              <span className="muted">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="notice">
              Строка — откуда пришёл лид (реклама), столбец — что реально купил. Диагональ = продали
              то, на что рекламировали.
            </div>
          </div>
        </div>

        <MetricTable
          title="Каналы (utm_source)"
          firstCol="Канал"
          rows={rep.channels.rows}
          total={rep.channels.total}
        />
      </div>
    </div>
  );
}
