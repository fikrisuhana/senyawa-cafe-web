"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Check, AlertCircle } from "lucide-react";

export default function KasClient() {
  const router = useRouter();
  const [type, setType] = useState<"KELUAR" | "MASUK">("KELUAR");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");
    setBusy(true);
    const res = await fetch("/api/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, amount: Number(amount), category, note }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Gagal mencatat kas");
      return;
    }
    setAmount("");
    setCategory("");
    setNote("");
    setOk("✓ Kas berhasil dicatat");
    setTimeout(() => setOk(""), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 h-fit text-xs">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="font-bold text-slate-900 text-sm">Catat Kas Keluar / Masuk</h3>
        <p className="text-[11px] text-slate-400">Pencatatan kas operasional toko (mis. beli es batu, gas, galon)</p>
      </div>

      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
        <button
          type="button"
          onClick={() => setType("KELUAR")}
          className={`py-2 rounded-md font-semibold text-xs transition flex items-center justify-center gap-1.5 ${
            type === "KELUAR" ? "bg-white text-rose-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Pengeluaran</span>
        </button>
        <button
          type="button"
          onClick={() => setType("MASUK")}
          className={`py-2 rounded-md font-semibold text-xs transition flex items-center justify-center gap-1.5 ${
            type === "MASUK" ? "bg-white text-emerald-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>Pemasukan</span>
        </button>
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Nominal Uang (Rp)</label>
        <input
          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono font-bold"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          placeholder="0"
          required
        />
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Keperluan / Kategori</label>
        <input
          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="katkasir"
          placeholder="mis. Beli es batu, Gas LPG, Air Galon"
        />
        <datalist id="katkasir">
          <option>Beli es</option>
          <option>Belanja bahan</option>
          <option>Galon/air</option>
          <option>Gas</option>
          <option>Lainnya</option>
        </datalist>
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
        <input
          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Keterangan rincian"
        />
      </div>

      {err && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{err}</span>
        </div>
      )}
      {ok && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1.5">
          <Check className="w-4 h-4 shrink-0" />
          <span>{ok}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-sm transition disabled:opacity-50"
      >
        {busy ? "Menyimpan..." : "Simpan Catatan Kas"}
      </button>
    </form>
  );
}
