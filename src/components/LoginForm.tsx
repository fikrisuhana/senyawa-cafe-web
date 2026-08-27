"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Lock, User, AlertCircle } from "lucide-react";

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
      setErr(j.error || "Login gagal, periksa username dan password Anda.");
      return;
    }
    router.push(j.role === "ADMIN" ? "/admin/dashboard" : "/kasir");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 antialiased font-sans">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-8 border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-md overflow-hidden">
            {logoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoImage} alt="logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl">{logoEmoji || "☕"}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Login ke {storeName}</h2>
          <p className="text-xs text-slate-500">Aplikasi Kasir POS & Manajemen Operasional</p>
        </div>

        <form onSubmit={submit} className="space-y-4 text-xs sm:text-sm">
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-xs">Username</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoFocus
                required
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-3 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-xs">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                required
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-3 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition"
              />
            </div>
          </div>

          {err && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{err}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
          >
            {loading ? "Memproses..." : "Masuk ke Sistem"}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Sistem POS Modern · Clean Dashboard & Telemetry Style
          </p>
        </div>
      </div>
    </main>
  );
}
