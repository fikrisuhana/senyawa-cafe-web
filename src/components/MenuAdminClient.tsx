"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";
import VariantEditor from "@/components/VariantEditor";
import { Plus, Edit2, Trash2, Layers, AlertCircle, Check, X } from "lucide-react";

export type PackOption = { id: string; name: string };
export type MenuStockRow = { packagingId: string; qty: number; name: string };
export type OptionStockRow = { id: string; packagingId: string; qty: number; name: string };
export type VariantOptionRow = {
  id: string;
  name: string;
  priceDelta: number;
  stocks: OptionStockRow[];
};
export type VariantGroupRow = {
  id: string;
  name: string;
  type: "SINGLE" | "MULTI";
  required: boolean;
  options: VariantOptionRow[];
};
export type MenuRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  active: boolean;
  sortOrder: number;
  stocks: MenuStockRow[];
  groups: VariantGroupRow[];
};

const EMPTY = {
  id: "",
  name: "",
  category: "KOPI",
  price: 0,
  cost: 0,
  active: true,
  sortOrder: 0,
  stocks: [] as Array<{ packagingId: string; qty: number }>,
};

export default function MenuAdminClient({
  rows,
  packs,
}: {
  rows: MenuRow[];
  packs: PackOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<any>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [variantMenuId, setVariantMenuId] = useState<string | null>(null);
  // Ambil dari rows (yang diperbarui setiap router.refresh) supaya editor tidak basi.
  const variantMenu = variantMenuId ? rows.find((r) => r.id === variantMenuId) || null : null;
  const editing = !!form.id;

  function edit(r: MenuRow) {
    setForm({
      id: r.id,
      name: r.name,
      category: r.category,
      price: r.price,
      cost: r.cost,
      active: r.active,
      sortOrder: r.sortOrder,
      stocks: r.stocks.map((s) => ({ packagingId: s.packagingId, qty: s.qty })),
    });
    setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addStock() {
    const used = new Set(form.stocks.map((s: any) => s.packagingId));
    const next = packs.find((p) => !used.has(p.id));
    if (!next) return;
    setForm({ ...form, stocks: [...form.stocks, { packagingId: next.id, qty: 1 }] });
  }
  function setStock(i: number, patch: any) {
    const stocks = form.stocks.map((s: any, idx: number) => (idx === i ? { ...s, ...patch } : s));
    setForm({ ...form, stocks });
  }
  function delStock(i: number) {
    setForm({ ...form, stocks: form.stocks.filter((_: any, idx: number) => idx !== i) });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/menu", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        cost: Number(form.cost),
        sortOrder: Number(form.sortOrder),
        stocks: form.stocks
          .filter((s: any) => s.packagingId)
          .map((s: any) => ({ packagingId: s.packagingId, qty: Number(s.qty) || 1 })),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Gagal menyimpan menu");
      return;
    }
    setForm(EMPTY);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus menu ini?")) return;
    await fetch(`/api/admin/menu?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function toggle(r: MenuRow) {
    await fetch("/api/admin/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: r.id,
        name: r.name,
        category: r.category,
        price: r.price,
        cost: r.cost,
        sortOrder: r.sortOrder,
        active: !r.active,
        stocks: r.stocks.map((s) => ({ packagingId: s.packagingId, qty: s.qty })),
      }),
    });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Form Input Menu */}
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 h-fit text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-sm">
            {editing ? "Ubah Data Menu" : "Tambah Menu Baru"}
          </h3>
          <p className="text-[11px] text-slate-400">
            {editing ? "Perbarui informasi harga atau resep bahan" : "Masukkan detail nama, harga jual, dan kategori"}
          </p>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Nama Menu</label>
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            placeholder="Contoh: Kopi Susu Gula Aren"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })}
              list="katlist"
            />
            <datalist id="katlist">
              <option>KOPI</option>
              <option>NON-KOPI</option>
              <option>MAKANAN</option>
              <option>SNACK</option>
            </datalist>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Urutan Tampil</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Harga Jual (Rp)</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono font-bold"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">HPP / Modal (Rp)</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              type="number"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block font-semibold text-slate-700 text-xs">Resep Bahan Baku / Kemasan</label>
            <button
              type="button"
              onClick={addStock}
              className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>+ Bahan</span>
            </button>
          </div>

          <div className="space-y-2">
            {form.stocks.length === 0 && (
              <p className="text-[11px] text-slate-400">
                Menu ini tidak memotong stok bahan baku langsung.
              </p>
            )}
            {form.stocks.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  value={s.packagingId}
                  onChange={(e) => setStock(i, { packagingId: e.target.value })}
                >
                  {packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  className="w-16 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-center font-mono font-bold"
                  type="number"
                  min={1}
                  value={s.qty}
                  onChange={(e) => setStock(i, { qty: e.target.value })}
                  title="Jumlah per porsi"
                />
                <button
                  type="button"
                  onClick={() => delStock(i)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
          <input
            type="checkbox"
            id="chk-menu-active"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="rounded text-blue-600 border-slate-300 focus:ring-blue-500"
          />
          <label htmlFor="chk-menu-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
            Menu Aktif (Tampil di aplikasi kasir)
          </label>
        </div>

        {err && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <div className="pt-2 flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-sm transition disabled:opacity-50"
          >
            {busy ? "Menyimpan..." : editing ? "Simpan Perubahan" : "+ Tambah Menu"}
          </button>
          {editing && (
            <button
              type="button"
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition"
              onClick={() => setForm(EMPTY)}
            >
              Batal
            </button>
          )}
        </div>
      </form>

      {/* Tabel Daftar Menu (ala app-monitoring) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0 h-fit">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Daftar Menu & Katalog Produk</h3>
          <span className="text-xs text-slate-500">Total {rows.length} menu terdaftar</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nama Menu</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Harga Jual</th>
                <th className="py-3 px-4">Pemotongan Bahan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">{r.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="pill-slate">{r.category}</span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {rupiah(r.price)}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {r.stocks.length
                      ? r.stocks.map((s) => `${s.name} ×${s.qty}`).join(", ")
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggle(r)}
                      className={r.active ? "pill-green cursor-pointer" : "pill-slate cursor-pointer"}
                    >
                      {r.active ? "Aktif" : "Nonaktif"}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setVariantMenuId(r.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-xs transition flex items-center gap-1"
                      >
                        <Layers className="w-3 h-3 text-slate-500" />
                        <span>Varian {r.groups.length ? `(${r.groups.length})` : ""}</span>
                      </button>
                      <button
                        onClick={() => edit(r)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Edit Menu"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => del(r.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition"
                        title="Hapus Menu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="py-8 text-center text-slate-400" colSpan={6}>
                    Belum ada menu terdaftar. Silakan tambahkan menu baru di form sebelah kiri.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {variantMenu && (
        <VariantEditor menu={variantMenu} packs={packs} onClose={() => setVariantMenuId(null)} />
      )}
    </div>
  );
}
