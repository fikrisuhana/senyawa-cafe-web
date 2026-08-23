"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PackRow = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  low: boolean;
};

export default function StokClient({ rows }: { rows: PackRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [minStock, setMinStock] = useState("0");
  const [importMsg, setImportMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function addPack(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/admin/packaging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, unit, minStock: Number(minStock) || 0 }),
    });
    setBusy(false);
    setName("");
    router.refresh();
  }

  async function adjust(p: PackRow) {
    const val = prompt(
      `Penyesuaian stok "${p.name}" (sekarang ${p.stock}).\nMasukkan jumlah tambah (mis. 100) atau kurang (mis. -20):`,
      ""
    );
    if (val === null) return;
    const delta = Number(val);
    if (!Number.isFinite(delta) || delta === 0) return;
    await fetch("/api/admin/packaging", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, delta, note: "Penyesuaian manual" }),
    });
    router.refresh();
  }

  async function setStok(p: PackRow) {
    const val = prompt(`Set stok "${p.name}" jadi berapa? (sekarang ${p.stock})`, String(p.stock));
    if (val === null) return;
    const target = Number(val);
    if (!Number.isFinite(target)) return;
    await fetch("/api/admin/packaging", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, setTo: target, note: "Set manual" }),
    });
    router.refresh();
  }

  async function del(p: PackRow) {
    if (!confirm(`Hapus kemasan "${p.name}"?`)) return;
    await fetch(`/api/admin/packaging?id=${p.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg("Mengunggah…");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/packaging/import", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    e.target.value = "";
    if (!res.ok) {
      setImportMsg("❌ " + (j.error || "Gagal import"));
      return;
    }
    setImportMsg(`✅ ${j.updated} kemasan diperbarui, ${j.created} baru.`);
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <form onSubmit={addPack} className="card space-y-3">
          <h2 className="font-bold">Tambah stok / bahan</h2>
          <div>
            <label className="label">Nama (mis. Cup 16oz, Mie)</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Satuan</label>
              <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div>
              <label className="label">Stok minimum</label>
              <input
                className="input"
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "…" : "Tambah"}
          </button>
        </form>

        <div className="card space-y-2">
          <h2 className="font-bold">Import dari Excel</h2>
          <p className="text-xs text-slate-500">
            Unduh template, isi/ubah stok di Excel secara manual, lalu unggah lagi di sini. Kolom:
            <code className="mx-1 rounded bg-slate-100 px-1">nama, satuan, stok, stok_min</code>.
            Stok akan diset sesuai isi file.
          </p>
          <label className="btn-ghost w-full cursor-pointer">
            📄 Pilih file .xlsx / .csv
            <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={onImport} />
          </label>
          {importMsg && <p className="text-sm">{importMsg}</p>}
        </div>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="th">Kemasan</th>
              <th className="th text-right">Stok</th>
              <th className="th text-right">Min</th>
              <th className="th text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="td">
                  <span className="font-medium">{p.name}</span>
                  {p.low && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      menipis
                    </span>
                  )}
                  <div className="text-xs text-slate-400">{p.unit}</div>
                </td>
                <td className="td text-right font-semibold">{p.stock}</td>
                <td className="td text-right text-slate-500">{p.minStock}</td>
                <td className="td text-right">
                  <button onClick={() => adjust(p)} className="text-brand-700 hover:underline">
                    +/−
                  </button>
                  <button onClick={() => setStok(p)} className="ml-3 text-slate-600 hover:underline">
                    Set
                  </button>
                  <button onClick={() => del(p)} className="ml-3 text-red-600 hover:underline">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={4}>
                  Belum ada kemasan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
