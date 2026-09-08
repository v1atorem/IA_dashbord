"use client";
import { useEffect, useState } from "react";

const DIRECTIONS = ["ГП", "ТЗ", "Буст+", "Казахский"];

type CampRule = {
  id: number;
  campaign: string;
  adset: string;
  direction: string;
  city: string | null;
  multiCity: boolean;
  cities: string[];
  note: string | null;
};
type CourseRule = { id: number; pattern: string; direction: string; priority: number };
type Opt = { campaign: string; adset: string };
type Settings = {
  usdToKzt: number;
  qualStages: string[];
  saleStages: string[];
  splitByCity: Record<string, boolean>;
};

export default function MappingsClient() {
  const [rules, setRules] = useState<CampRule[]>([]);
  const [options, setOptions] = useState<Opt[]>([]);
  const [courseRules, setCourseRules] = useState<CourseRule[]>([]);
  const [courseValues, setCourseValues] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");

  // формы
  const [cf, setCf] = useState({ campaign: "", adset: "*", direction: "ТЗ", city: "", multiCity: true, cities: "" });
  const [crf, setCrf] = useState({ pattern: "", direction: "ТЗ", priority: 50 });

  async function loadAll() {
    const [a, b, c] = await Promise.all([
      fetch("/api/campaign-map").then((r) => r.json()),
      fetch("/api/course-map").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setRules(a.rules);
    setOptions(a.options);
    setCourseRules(b.rules);
    setCourseValues(b.values);
    setSettings(c);
  }
  useEffect(() => {
    loadAll();
  }, []);

  async function saveCampaign() {
    if (!cf.campaign) return;
    const res = await fetch("/api/campaign-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cf),
    });
    setMsg(res.ok ? "Правило кампании сохранено" : "Ошибка сохранения");
    setCf({ campaign: "", adset: "*", direction: "ТЗ", city: "", multiCity: true, cities: "" });
    loadAll();
  }
  async function delCampaign(id: number) {
    await fetch(`/api/campaign-map?id=${id}`, { method: "DELETE" });
    loadAll();
  }
  async function saveCourse() {
    if (!crf.pattern) return;
    const res = await fetch("/api/course-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crf),
    });
    setMsg(res.ok ? "Правило курса сохранено" : "Ошибка сохранения");
    setCrf({ pattern: "", direction: "ТЗ", priority: 50 });
    loadAll();
  }
  async function delCourse(id: number) {
    await fetch(`/api/course-map?id=${id}`, { method: "DELETE" });
    loadAll();
  }
  async function saveSettings(next: Partial<Settings>) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setMsg(res.ok ? "Настройки сохранены" : "Ошибка");
    loadAll();
  }

  const mappedKeys = new Set(rules.map((r) => `${r.campaign}|${r.adset}`));
  const unmapped = options.filter(
    (o) => !mappedKeys.has(`${o.campaign}|${o.adset}`) && !mappedKeys.has(`${o.campaign}|*`)
  );

  return (
    <div>
      {msg && <div className="card notice">{msg}</div>}

      {/* Кампании */}
      <div className="card">
        <h2>Справочник кампаний → направление + город</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Кампания</th>
                <th>Группа</th>
                <th>Направление</th>
                <th>Город</th>
                <th>Мультигород</th>
                <th>Разрешённые города</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>{r.campaign}</td>
                  <td>{r.adset}</td>
                  <td>{r.direction}</td>
                  <td>{r.city || "—"}</td>
                  <td>{r.multiCity ? "да" : "нет"}</td>
                  <td>{r.cities?.join(", ") || "—"}</td>
                  <td>
                    <button className="secondary" onClick={() => delCampaign(r.id)}>
                      удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={{ marginTop: 20 }}>Добавить / обновить правило</h2>
        <div className="row editrow">
          <div style={{ minWidth: 200 }}>
            <label>Кампания (utm_medium)</label>
            <input list="camp-opts" value={cf.campaign} onChange={(e) => setCf({ ...cf, campaign: e.target.value })} />
            <datalist id="camp-opts">
              {[...new Set(options.map((o) => o.campaign))].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div style={{ minWidth: 140 }}>
            <label>Группа (utm_campaign), * = вся</label>
            <input value={cf.adset} onChange={(e) => setCf({ ...cf, adset: e.target.value })} />
          </div>
          <div>
            <label>Направление</label>
            <select value={cf.direction} onChange={(e) => setCf({ ...cf, direction: e.target.value })}>
              {DIRECTIONS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Город (если один)</label>
            <input value={cf.city} onChange={(e) => setCf({ ...cf, city: e.target.value })} placeholder="напр. Алматы" />
          </div>
          <div>
            <label>
              <input type="checkbox" checked={cf.multiCity} onChange={(e) => setCf({ ...cf, multiCity: e.target.checked })} />{" "}
              мультигород
            </label>
          </div>
          <div style={{ minWidth: 200 }}>
            <label>Разрешённые города (через запятую)</label>
            <input value={cf.cities} onChange={(e) => setCf({ ...cf, cities: e.target.value })} placeholder="Алматы, Астана" />
          </div>
          <button onClick={saveCampaign}>Сохранить</button>
        </div>

        {unmapped.length > 0 && (
          <div className="notice" style={{ marginTop: 12 }}>
            Не размечено ({unmapped.length}):{" "}
            {unmapped.slice(0, 40).map((o) => (
              <span
                key={`${o.campaign}|${o.adset}`}
                className="badge"
                style={{ margin: 3, cursor: "pointer" }}
                onClick={() => setCf({ ...cf, campaign: o.campaign, adset: o.adset || "*" })}
                title="кликни, чтобы подставить в форму"
              >
                {o.campaign}{o.adset ? ` / ${o.adset}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Курс */}
      <div className="card">
        <h2>Правила «Курс → фактическое направление»</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Шаблон (вхождение)</th>
                <th>Направление</th>
                <th>Приоритет</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {courseRules.map((r) => (
                <tr key={r.id}>
                  <td>{r.pattern}</td>
                  <td>{r.direction}</td>
                  <td>{r.priority}</td>
                  <td>
                    <button className="secondary" onClick={() => delCourse(r.id)}>удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row editrow" style={{ marginTop: 12 }}>
          <div style={{ minWidth: 220 }}>
            <label>Шаблон (напр. «Каз», «ГП», «Career Boost»)</label>
            <input list="course-opts" value={crf.pattern} onChange={(e) => setCrf({ ...crf, pattern: e.target.value })} />
            <datalist id="course-opts">
              {courseValues.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label>Направление</label>
            <select value={crf.direction} onChange={(e) => setCrf({ ...crf, direction: e.target.value })}>
              {DIRECTIONS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Приоритет</label>
            <input type="number" value={crf.priority} onChange={(e) => setCrf({ ...crf, priority: Number(e.target.value) })} style={{ width: 90 }} />
          </div>
          <button onClick={saveCourse}>Сохранить</button>
        </div>
        <div className="notice">Больший приоритет выигрывает при нескольких совпадениях (напр. «Каз Career Boost» → Казахский, если у «Каз» приоритет выше).</div>
      </div>

      {/* Настройки */}
      {settings && (
        <div className="card">
          <h2>Настройки расчёта</h2>
          <div className="row">
            <div>
              <label>Курс USD → ₸</label>
              <input
                type="number"
                defaultValue={settings.usdToKzt}
                onBlur={(e) => saveSettings({ usdToKzt: Number(e.target.value) })}
                style={{ width: 120 }}
              />
            </div>
            <div>
              <label>Разбивать по городам</label>
              <div className="flex">
                {DIRECTIONS.map((d) => (
                  <label key={d} style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={!!settings.splitByCity[d]}
                      onChange={(e) =>
                        saveSettings({ splitByCity: { ...settings.splitByCity, [d]: e.target.checked } })
                      }
                    />{" "}
                    {d}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid2" style={{ marginTop: 12 }}>
            <div>
              <label>Стадии = квал (по одной в строке)</label>
              <textarea
                defaultValue={settings.qualStages.join("\n")}
                rows={8}
                style={{ width: "100%", background: "var(--panel2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
                onBlur={(e) => saveSettings({ qualStages: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div>
              <label>Стадии = продажа (по одной в строке)</label>
              <textarea
                defaultValue={settings.saleStages.join("\n")}
                rows={8}
                style={{ width: "100%", background: "var(--panel2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
                onBlur={(e) => saveSettings({ saleStages: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
          </div>
          <div className="notice">Изменения сохраняются при уходе из поля (blur).</div>
        </div>
      )}
    </div>
  );
}
