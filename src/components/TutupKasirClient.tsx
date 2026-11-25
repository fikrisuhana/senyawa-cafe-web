"use client";

import { useEffect, useState } from "react";

type Closing = { id: string; cashierName: string; shift: string | null; expected: number; counted: number; diff: number; createdAt: string; note: string | null };
type Exp = {
  businessDate: string;
  since: string | null;
  kasAwal: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  expected: number;
  trxCount: number;
  closings: Closing[];
};

const rp = (n: number) => (n < 0 ? "−" : "") + "Rp" + Math.abs(n).toLocaleString("id-ID");
const jam = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

export default function TutupKasirClient() {
  const [exp, setExp] = useState<Exp | null>(null);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await fetch("/api/cash-closings", { cache: "no-store" });
    if (r.ok) setExp(await r.json());
  }
  useEffect(() => {
    load();
  }, []);

  const diff = exp && counted !== "" ? Number(counted) - exp.expected : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!exp || counted === "") return;
    if (diff !== 0 && !confirm(`Uang laci ${diff! > 0 ? "LEBIH" : "KURANG"} ${rp(Math.abs(diff!))}. Tetap simpan?`)) return;
    setBusy(true);
    const r = await fetch("/api/cash-closings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counted: Number(counted), note, clientId: crypto.randomUUID() }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(`❌ ${j.error || "Gagal"}`);
    setMsg(`✅ Tutup kasir tersimpan — selisih ${rp(j.closing.diff)}`);
    setCounted("");
    setNote("");
    load();
  }

  if (!exp) return <p className="text-sm text-slate-500">Memuat…</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 h-fit">
        <div className="space-y-1.5 text-sm">
          <p className="text-xs text-slate-500">
            Dihitung {exp.since ? `sejak tutup kasir terakhir (${jam(exp.since)})` : "sejak awal hari usaha"} · {exp.trxCount} transaksi
          </p>
          {[
            ["Kas awal laci", exp.kasAwal],
            ["Penjualan tunai", exp.cashSales],
            ["Kas masuk", exp.cashIn],
            ["Kas keluar", -exp.cashOut],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between">
              <span className="text-slate-600">{k}</span>
              <span className="font-mono">{rp(v as number)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
            <span>Seharusnya di laci</span>
            <span className="font-mono text-blue-700">{rp(exp.expected)}</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Uang yang ada di laci (dihitung)</label>
          <input
            type="number"
            min={0}
            required
            autoFocus
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-lg font-mono focus:outline-none focus:border-blue-500"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
        </div>
        {diff !== null && (
          <div className={`rounded-lg p-3 text-sm font-bold ${diff === 0 ? "bg-emerald-50 text-emerald-700" : diff > 0 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
            {diff === 0 ? "Pas — tidak ada selisih" : `${diff > 0 ? "Lebih" : "Kurang"} ${rp(Math.abs(diff))}`}
            <span className="block text-xs font-normal">Setoran (di luar kas awal): {rp(Number(counted) - exp.kasAwal)}</span>
          </div>
        )}
        <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm" placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {msg && <p className="text-sm font-medium">{msg}</p>}
        <button disabled={busy || counted === ""} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50">
          {busy ? "Menyimpan…" : "Simpan tutup kasir"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-fit">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">Tutup kasir hari ini ({exp.businessDate})</div>
        {exp.closings.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Belum ada.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {exp.closings.map((c) => (
              <li key={c.id} className="p-4 flex justify-between gap-3">
                <span>
                  <b>{jam(c.createdAt)}</b> · {c.cashierName}
                  {c.note && <span className="block text-xs text-slate-500">{c.note}</span>}
                </span>
                <span className="text-right font-mono">
                  {rp(c.counted)}
                  <span className={`block text-xs ${c.diff === 0 ? "text-emerald-600" : c.diff > 0 ? "text-amber-600" : "text-rose-600"}`}>
                    selisih {rp(c.diff)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
