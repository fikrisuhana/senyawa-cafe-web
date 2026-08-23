"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";
import VariantEditor from "@/components/VariantEditor";

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
      setErr(j.error || "Gagal menyimpan");
      return;
    }
    setForm(EMPTY);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Hapus menu ini?")) return;
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
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <form onSubmit={save} className="card h-fit space-y-3">
        <h2 className="font-bold">{editing ? "Edit menu" : "Tambah menu"}</h2>
        <div>
          <label className="label">Nama</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Kategori</label>
            <input
              className="input"
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
            <label className="label">Urutan</label>
            <input
              className="input"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Harga jual</label>
            <input
              className="input"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Modal (opsional)</label>
            <input
              className="input"
              type="number"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label !mb-0">Bahan / stok dipakai</label>
            <button
              type="button"
              onClick={addStock}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              + tambah bahan
            </button>
          </div>
          <div className="space-y-2">
            {form.stocks.length === 0 && (
              <p className="text-xs text-slate-400">
                Tanpa stok (mis. menu yang tak potong bahan). Klik “+ tambah bahan”.
              </p>
            )}
            {form.stocks.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-1">
                <select
                  className="input"
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
                  className="input w-16"
                  type="number"
                  min={1}
                  value={s.qty}
                  onChange={(e) => setStock(i, { qty: e.target.value })}
                  title="qty per porsi"
                />
                <button
                  type="button"
                  onClick={() => delStock(i)}
                  className="btn-ghost !px-2 !py-1 text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Aktif (tampil di kasir)
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy}>
            {busy ? "…" : editing ? "Simpan" : "Tambah"}
          </button>
          {editing && (
            <button type="button" className="btn-ghost" onClick={() => setForm(EMPTY)}>
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="th">Menu</th>
              <th className="th">Harga</th>
              <th className="th">Bahan</th>
              <th className="th">Status</th>
              <th className="th text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="td">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-slate-400">{r.category}</div>
                </td>
                <td className="td">{rupiah(r.price)}</td>
                <td className="td text-xs text-slate-500">
                  {r.stocks.length
                    ? r.stocks.map((s) => `${s.name}×${s.qty}`).join(", ")
                    : "—"}
                </td>
                <td className="td">
                  <button
                    onClick={() => toggle(r)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {r.active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="td whitespace-nowrap text-right">
                  <button
                    onClick={() => setVariantMenuId(r.id)}
                    className="text-slate-600 hover:underline"
                  >
                    Varian{r.groups.length ? ` (${r.groups.length})` : ""}
                  </button>
                  <button onClick={() => edit(r)} className="ml-3 text-brand-700 hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => del(r.id)}
                    className="ml-3 text-red-600 hover:underline"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {variantMenu && (
        <VariantEditor menu={variantMenu} packs={packs} onClose={() => setVariantMenuId(null)} />
      )}
    </div>
  );
}
