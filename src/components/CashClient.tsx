"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CashClient({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [type, setType] = useState<"KELUAR" | "MASUK">("KELUAR");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const res = await fetch("/api/admin/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        amount: Number(amount),
        category,
        note,
        businessDate: date,
      }),
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
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card h-fit space-y-3">
      <h2 className="font-bold">Tambah catatan</h2>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setType("KELUAR")}
          className={`rounded-lg py-2 text-sm font-semibold ${
            type === "KELUAR" ? "bg-red-600 text-white" : "bg-white ring-1 ring-slate-200"
          }`}
        >
          Pengeluaran
        </button>
        <button
          type="button"
          onClick={() => setType("MASUK")}
          className={`rounded-lg py-2 text-sm font-semibold ${
            type === "MASUK" ? "bg-emerald-600 text-white" : "bg-white ring-1 ring-slate-200"
          }`}
        >
          Pemasukan
        </button>
      </div>
      <div>
        <label className="label">Nominal</label>
        <input
          className="input"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          placeholder="0"
          required
        />
      </div>
      <div>
        <label className="label">Kategori</label>
        <input
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="katkas"
          placeholder="mis. Belanja bahan"
        />
        <datalist id="katkas">
          <option>Belanja bahan</option>
          <option>Gaji</option>
          <option>Listrik</option>
          <option>Sewa</option>
          <option>Perlengkapan</option>
          <option>Lainnya</option>
        </datalist>
      </div>
      <div>
        <label className="label">Catatan</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div>
        <label className="label">Tanggal (hari usaha)</label>
        <input
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "…" : "Simpan"}
      </button>
    </form>
  );
}
