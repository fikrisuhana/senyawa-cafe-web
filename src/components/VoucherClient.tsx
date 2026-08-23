"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";

export type VoucherRow = {
  id: string;
  name: string;
  type: "PERCENT" | "NOMINAL";
  value: number;
  active: boolean;
  maxUses: number | null;
  usedCount: number;
  validFrom: string; // YYYY-MM-DD atau ""
  validUntil: string;
};

const EMPTY = {
  id: "",
  name: "",
  type: "PERCENT",
  value: 0,
  active: true,
  maxUses: "",
  validFrom: "",
  validUntil: "",
};

export default function VoucherClient({ rows }: { rows: VoucherRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState<any>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const editing = !!form.id;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/vouchers", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, value: Number(form.value) }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Gagal");
      return;
    }
    setForm(EMPTY);
    router.refresh();
  }

  async function toggle(v: VoucherRow) {
    await fetch("/api/admin/vouchers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, active: !v.active }),
    });
    router.refresh();
  }

  async function del(v: VoucherRow) {
    if (!confirm(`Hapus voucher "${v.name}"?`)) return;
    await fetch(`/api/admin/vouchers?id=${v.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <form onSubmit={save} className="card h-fit space-y-3">
        <h2 className="font-bold">{editing ? "Edit voucher" : "Tambah voucher"}</h2>
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
            <label className="label">Tipe</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="PERCENT">Persen (%)</option>
              <option value="NOMINAL">Nominal (Rp)</option>
            </select>
          </div>
          <div>
            <label className="label">{form.type === "PERCENT" ? "Persen" : "Rupiah"}</label>
            <input
              className="input"
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              required
            />
          </div>
        </div>
        <div>
          <label className="label">Kuota pemakaian (kosong = tak terbatas)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.maxUses ?? ""}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            placeholder="mis. 50"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Berlaku dari</label>
            <input
              className="input"
              type="date"
              value={form.validFrom || ""}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Sampai</label>
            <input
              className="input"
              type="date"
              value={form.validUntil || ""}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Aktif
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
              <th className="th">Nama</th>
              <th className="th">Potongan</th>
              <th className="th">Pemakaian</th>
              <th className="th">Periode</th>
              <th className="th">Status</th>
              <th className="th text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className="td font-medium">{v.name}</td>
                <td className="td">
                  {v.type === "PERCENT" ? `${v.value}%` : rupiah(v.value)}
                </td>
                <td className="td text-slate-600">
                  {v.usedCount}
                  {v.maxUses != null ? `/${v.maxUses}` : "×"}
                </td>
                <td className="td text-xs text-slate-500">
                  {v.validFrom || v.validUntil
                    ? `${v.validFrom || "…"} → ${v.validUntil || "…"}`
                    : "—"}
                </td>
                <td className="td">
                  <button
                    onClick={() => toggle(v)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      v.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {v.active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="td text-right">
                  <button
                    onClick={() => setForm({ ...v, maxUses: v.maxUses ?? "" })}
                    className="text-brand-700 hover:underline"
                  >
                    Edit
                  </button>
                  <button onClick={() => del(v)} className="ml-3 text-red-600 hover:underline">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={6}>
                  Belum ada voucher.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
