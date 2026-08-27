"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Edit2, Sliders, Hash, Trash2, AlertTriangle, CheckCircle2, ArrowUpDown } from "lucide-react";

export type PackRow = {
  id: string;
  name: string;
  unit: string;
  buyUnit: string | null;
  buyFactor: number;
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
  const [edit, setEdit] = useState<PackRow | null>(null);

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
      `Penyesuaian stok "${p.name}" (sekarang ${p.stock} ${p.unit}).\nMasukkan jumlah penambahan (mis. 100) atau pengurangan (mis. -20):`,
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
    const val = prompt(`Set jumlah stok fisik "${p.name}" (sekarang ${p.stock} ${p.unit}) menjadi:`, String(p.stock));
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

  /// Restok dalam SATUAN BELI (mis. liter) — server konversi ke satuan dasar.
  async function restock(p: PackRow) {
    const label = p.buyUnit || p.unit;
    const val = prompt(
      `Restok persediaan "${p.name}" — masuk berapa ${label}?` +
        (p.buyUnit && p.buyFactor > 1 ? `\n(Catatan: 1 ${p.buyUnit} = ${p.buyFactor} ${p.unit})` : ""),
      ""
    );
    if (val === null) return;
    const qty = Number(val);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const res = await fetch("/api/admin/packaging", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, delta: qty, mode: p.buyUnit ? "buy" : "base" }),
    });
    if (!res.ok) alert("Gagal restok bahan");
    router.refresh();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const res = await fetch("/api/admin/packaging", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: edit.id,
        name: edit.name,
        unit: edit.unit,
        buyUnit: edit.buyUnit || "",
        buyFactor: edit.buyFactor,
        minStock: edit.minStock,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Gagal menyimpan");
      return;
    }
    setEdit(null);
    router.refresh();
  }

  async function del(p: PackRow) {
    if (!confirm(`Apakah Anda yakin ingin menghapus bahan/kemasan "${p.name}"?`)) return;
    await fetch(`/api/admin/packaging?id=${p.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg("Mengunggah dan memproses data...");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/packaging/import", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    e.target.value = "";
    if (!res.ok) {
      setImportMsg("❌ " + (j.error || "Gagal import file"));
      return;
    }
    setImportMsg(`✅ Berhasil: ${j.updated} diperbarui, ${j.created} dibuat baru.`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-5">
        {/* Form Tambah Bahan */}
        <form onSubmit={addPack} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">Tambah Bahan Baku / Kemasan</h3>
            <p className="text-[11px] text-slate-400">Daftarkan bahan baku seperti Cup, Sedotan, Susu, Sirup, dll.</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Bahan / Kemasan</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              placeholder="Contoh: Cup 16oz, Susu Fresh Milk"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Satuan Dasar</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                placeholder="pcs / ml / gr"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Batas Minimum</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-sm transition disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Menyimpan..." : "+ Tambah Bahan Baku"}
          </button>
        </form>

        {/* Import Excel Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
          <div className="border-b border-slate-100 pb-2.5">
            <h3 className="font-bold text-slate-900 text-sm">Import Massal Excel</h3>
            <p className="text-[11px] text-slate-400">
              Upload template yang sudah diisi kolom: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">nama, satuan, stok, stok_min</code>
            </p>
          </div>

          <label className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition text-slate-600">
            <Upload className="w-4 h-4 text-slate-400 mb-1" />
            <span className="font-semibold text-[11px] text-slate-700">Pilih file .xlsx / .csv</span>
            <span className="text-[10px] text-slate-400">atau tarik file ke sini</span>
            <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={onImport} />
          </label>

          {importMsg && (
            <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium">
              {importMsg}
            </p>
          )}
        </div>
      </div>

      {/* Tabel Inventori Stok (ala app-monitoring) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0 h-fit">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Daftar Persediaan Stok Bahan</h3>
          <span className="text-xs text-slate-500">{rows.length} jenis bahan terdata</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nama Bahan & Satuan</th>
                <th className="py-3 px-4 text-right">Sisa Stok</th>
                <th className="py-3 px-4 text-right">Stok Min</th>
                <th className="py-3 px-4 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((p) => (
                <tr key={p.id} className={`hover:bg-slate-50/60 transition ${p.low ? "bg-rose-50/20" : ""}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">{p.name}</span>
                      {p.low && (
                        <span className="pill-red text-[10px] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Menipis</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Satuan: <strong className="text-slate-600">{p.unit}</strong>
                      {p.buyUnit ? (
                        <span className="text-slate-500">
                          {" "}· Satuan Beli: {p.buyUnit} (1 {p.buyUnit} = {p.buyFactor} {p.unit})
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className={`py-3 px-4 text-right font-mono font-bold ${p.low ? "text-rose-600" : "text-slate-900"}`}>
                    {p.stock} <span className="text-xs font-normal text-slate-400">{p.unit}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {p.minStock} <span className="text-xs font-normal text-slate-400">{p.unit}</span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => restock(p)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md font-semibold text-xs transition flex items-center gap-1"
                        title="Restok Masuk"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Restok</span>
                      </button>
                      <button
                        onClick={() => adjust(p)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-xs transition"
                        title="Penyesuaian Tambah / Kurang (+/-)"
                      >
                        +/-
                      </button>
                      <button
                        onClick={() => setStok(p)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-xs transition"
                        title="Set Jumlah Fisik"
                      >
                        Set
                      </button>
                      <button
                        onClick={() => setEdit(p)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Edit Bahan"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => del(p)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition"
                        title="Hapus Bahan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="py-8 text-center text-slate-400" colSpan={4}>
                    Belum ada data stok bahan baku.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Bahan */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={saveEdit} className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-100">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Ubah Data Bahan — {edit.name}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Konfigurasi konversi satuan beli ke satuan dasar</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nama Bahan</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Satuan Dasar (Terkecil)</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  value={edit.unit}
                  onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
                  placeholder="ml / gr / pcs"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Satuan Beli (Opsional)</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  value={edit.buyUnit || ""}
                  onChange={(e) => setEdit({ ...edit, buyUnit: e.target.value })}
                  placeholder="liter / kg / dus"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">1 Satuan Beli = ? Dasar</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                  type="number"
                  min={1}
                  value={edit.buyFactor}
                  onChange={(e) => setEdit({ ...edit, buyFactor: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stok Minimum</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                  type="number"
                  value={edit.minStock}
                  onChange={(e) => setEdit({ ...edit, minStock: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              💡 Contoh: Susu satuan dasar <code className="text-blue-600">ml</code>, satuan beli <code className="text-blue-600">liter</code>, faktor <code className="text-blue-600">1000</code> → restok 2 liter otomatis bertambah 2.000 ml.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition"
                onClick={() => setEdit(null)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-sm transition"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
