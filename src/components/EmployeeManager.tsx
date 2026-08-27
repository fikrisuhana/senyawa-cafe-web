"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Edit2, Trash2, Users } from "lucide-react";

export type EmpRow = { id: string; name: string; active: boolean };

export default function EmployeeManager({ rows }: { rows: EmpRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    setName("");
    router.refresh();
  }

  async function toggle(r: EmpRow) {
    await fetch("/api/admin/employees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, active: !r.active }),
    });
    router.refresh();
  }

  async function rename(r: EmpRow) {
    const input = prompt(`Ganti nama karyawan "${r.name}" menjadi:`, r.name);
    const newName = input?.trim();
    if (!newName || newName === r.name) return;
    const res = await fetch("/api/admin/employees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, name: newName }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Gagal mengganti nama");
      return;
    }
    router.refresh();
  }

  async function del(r: EmpRow) {
    if (!confirm(`Apakah Anda yakin ingin menghapus karyawan "${r.name}"?`)) return;
    const res = await fetch(`/api/admin/employees?id=${r.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Gagal menghapus karyawan");
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 h-fit text-xs lg:sticky lg:top-20">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Daftar Karyawan</h3>
          <p className="text-[11px] text-slate-400">Kelola staf yang terdaftar pada menu absensi</p>
        </div>
        <span className="pill-slate text-[10px]">{rows.length} Staf</span>
      </div>

      <form onSubmit={add} className="flex gap-1.5">
        <input
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          placeholder="Nama karyawan baru..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-sm transition disabled:opacity-50"
          disabled={busy || !name.trim()}
        >
          + Tambah
        </button>
      </form>

      <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 py-2.5">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                {r.name.slice(0, 2).toUpperCase()}
              </div>
              <span className={`font-semibold truncate ${r.active ? "text-slate-800" : "text-slate-400 line-through"}`}>
                {r.name}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => toggle(r)}
                className={r.active ? "pill-green cursor-pointer text-[10px]" : "pill-slate cursor-pointer text-[10px]"}
              >
                {r.active ? "Aktif" : "Nonaktif"}
              </button>
              <button
                onClick={() => rename(r)}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                title="Ubah Nama"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => del(r)}
                className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                title="Hapus Karyawan"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="py-6 text-center text-slate-400 text-xs">
            Belum ada data karyawan.
          </p>
        )}
      </div>
    </div>
  );
}
