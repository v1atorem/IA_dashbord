"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Toolbar({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [busy, setBusy] = useState<"" | "show" | "sync">("");
  const [msg, setMsg] = useState("");

  function show() {
    router.push(`/?from=${f}&to=${t}`);
    router.refresh();
  }

  async function sync() {
    setBusy("sync");
    setMsg("Тяну данные из amoCRM и Facebook…");
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: f, to: t }),
    });
    setBusy("");
    if (res.ok) {
      setMsg("Готово. Обновляю отчёт…");
      router.push(`/?from=${f}&to=${t}`);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg("Ошибка синхронизации: " + (j.error || res.status));
    }
  }

  const presets: [string, () => void][] = [
    ["Тек. месяц", () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setF(first.toISOString().slice(0, 10));
      setT(now.toISOString().slice(0, 10));
    }],
    ["30 дней", () => {
      const now = new Date();
      const p = new Date();
      p.setDate(now.getDate() - 29);
      setF(p.toISOString().slice(0, 10));
      setT(now.toISOString().slice(0, 10));
    }],
  ];

  return (
    <div className="card">
      <div className="row">
        <div>
          <label>С</label>
          <input type="date" value={f} onChange={(e) => setF(e.target.value)} />
        </div>
        <div>
          <label>По</label>
          <input type="date" value={t} onChange={(e) => setT(e.target.value)} />
        </div>
        <button onClick={show} disabled={!!busy}>Показать</button>
        <button className="secondary" onClick={sync} disabled={!!busy}>
          {busy === "sync" ? "Синхронизирую…" : "Синхронизировать amo+FB"}
        </button>
        <div className="spacer" />
        {presets.map(([label, fn]) => (
          <button key={label} className="secondary" onClick={fn} disabled={!!busy}>
            {label}
          </button>
        ))}
      </div>
      {msg && <div className="notice">{msg}</div>}
    </div>
  );
}
