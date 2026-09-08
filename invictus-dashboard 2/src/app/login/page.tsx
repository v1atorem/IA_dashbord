"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      const next =
        new URLSearchParams(window.location.search).get("next") || "/";
      router.push(next);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Ошибка входа");
    }
  }

  return (
    <div className="container">
      <form className="login card" onSubmit={submit}>
        <div className="brand" style={{ fontSize: 20, marginBottom: 16 }}>
          Invictus <span>Dashboard</span>
        </div>
        <label>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{ width: "100%" }}
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 14 }}>
          {loading ? "Вхожу..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
