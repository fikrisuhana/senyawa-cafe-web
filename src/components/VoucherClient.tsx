"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";
import { TicketPercent, Edit2, Trash2, Tag, Calendar, AlertCircle } from "lucide-react";

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
      setErr(j.error || "Gagal menyimpan voucher");
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
    if (!confirm(`Apakah Anda yakin ingin menghapus voucher "${v.name}"?`)) return;
    await fetch(`/api/admin/vouchers?id=${v.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Form Input Voucher */}
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 h-fit text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-sm">
            {editing ? "Ubah Data Voucher" : "Buat Voucher Baru"}
          </h3>
          <p className="text-[11px] text-slate-400">
            {editing ? "Perbarui potongan nilai atau masa berlaku" : "Tambahkan kupon promo potongan belanja"}
          </p>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Nama Voucher / Promo</label>
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            placeholder="Contoh: DISKON10, PROMOJUMAT"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tipe Diskon</label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="PERCENT">Persen (%)</option>
              <option value="NOMINAL">Nominal (Rp)</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {form.type === "PERCENT" ? "Besaran (%)" : "Nominal (Rp)"}
            </label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono font-bold"
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Batas Kuota Pemakaian (Opsional)</label>
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
            type="number"
            min={1}
            value={form.maxUses ?? ""}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            placeholder="Kosongkan jika tak terbatas"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Berlaku Mulai</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              type="date"
              value={form.validFrom || ""}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sampai Dengan</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              type="date"
              value={form.validUntil || ""}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
          <input
            type="checkbox"
            id="chk-voucher-active"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="rounded text-blue-600 border-slate-300 focus:ring-blue-500"
          />
          <label htmlFor="chk-voucher-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
            Voucher Aktif (Dapat dipilih kasir)
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
            {busy ? "Menyimpan..." : editing ? "Simpan Perubahan" : "+ Tambah Voucher"}
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

      {/* Tabel Daftar Voucher (ala app-monitoring) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0 h-fit">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Daftar Voucher Promo</h3>
          <span className="text-xs text-slate-500">{rows.length} voucher terdaftar</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nama Kupon</th>
                <th className="py-3 px-4">Nilai Potongan</th>
                <th className="py-3 px-4">Pemakaian</th>
                <th className="py-3 px-4">Periode Berlaku</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {v.name}
                  </td>
                  <td className="py-3 px-4">
                    <span className="pill-amber font-mono font-bold text-xs">
                      {v.type === "PERCENT" ? `${v.value}% OFF` : `−${rupiah(v.value)}`}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    <span className="font-bold text-slate-800">{v.usedCount}</span>
                    {v.maxUses != null ? ` / ${v.maxUses} kuota` : " kali"}
                  </td>
                  <td className="py-3 px-4 text-[11px] text-slate-500">
                    {v.validFrom || v.validUntil
                      ? `${v.validFrom || "Selamanya"} s/d ${v.validUntil || "Selamanya"}`
                      : <span className="text-slate-400">Tak Terbatas</span>}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggle(v)}
                      className={v.active ? "pill-green cursor-pointer" : "pill-slate cursor-pointer"}
                    >
                      {v.active ? "Aktif" : "Nonaktif"}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setForm({ ...v, maxUses: v.maxUses ?? "" });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Edit Voucher"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => del(v)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition"
                        title="Hapus Voucher"
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
                    Belum ada voucher. Tambahkan voucher di form sebelah kiri.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
