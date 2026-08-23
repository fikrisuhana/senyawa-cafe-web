"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({
  storeName,
  logoEmoji,
  logoImage,
}: {
  storeName: string;
  logoEmoji: string;
  logoImage: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || "Login gagal");
      return;
    }
    router.push(j.role === "ADMIN" ? "/admin/dashboard" : "/kasir");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          {logoImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoImage}
              alt="logo"
              className="mx-auto mb-2 h-16 w-16 rounded-2xl object-cover shadow"
            />
          ) : (
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-3xl">
              {logoEmoji || "☕"}
            </div>
          )}
          <h1 className="text-lg font-bold">{storeName}</h1>
          <p className="text-xs text-slate-500">Masuk untuk mulai berjualan</p>
        </div>
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Memproses…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}
