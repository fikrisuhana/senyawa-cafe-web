"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      setErr(j.error || "Gagal");
      return;
    }
    setAmount("");
    setCategory("");
    setNote("");
    setOk("✓ Tercatat");
    setTimeout(() => setOk(""), 1500);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-bold">Catat pengeluaran / kas</h2>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setType("KELUAR")}
          className={`rounded-lg py-2 text-sm font-semibold ${
            type === "KELUAR" ? "bg-red-600 text-white" : "bg-white ring-1 ring-slate-200"
          }`}
        >
          💸 Pengeluaran
        </button>
        <button
          type="button"
          onClick={() => setType("MASUK")}
          className={`rounded-lg py-2 text-sm font-semibold ${
            type === "MASUK" ? "bg-emerald-600 text-white" : "bg-white ring-1 ring-slate-200"
          }`}
        >
          💰 Pemasukan
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nominal</label>
          <input
            className="input text-lg font-semibold"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder="0"
            required
          />
        </div>
        <div>
          <label className="label">Untuk apa (kategori)</label>
          <input
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="katkasir"
            placeholder="mis. Beli es"
          />
          <datalist id="katkasir">
            <option>Beli es</option>
            <option>Belanja bahan</option>
            <option>Galon/air</option>
            <option>Gas</option>
            <option>Lainnya</option>
          </datalist>
        </div>
      </div>
      <input
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (opsional)"
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      {ok && <p className="text-sm text-emerald-600">{ok}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "…" : "Simpan"}
      </button>
    </form>
  );
}
