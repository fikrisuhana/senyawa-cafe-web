"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  async function del(r: EmpRow) {
    if (!confirm(`Hapus karyawan "${r.name}"?`)) return;
    const res = await fetch(`/api/admin/employees?id=${r.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Gagal");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card h-fit space-y-3 lg:sticky lg:top-16">
      <h2 className="font-bold">Karyawan</h2>
      <form onSubmit={add} className="flex gap-2">
        <input
          className="input"
          placeholder="Nama karyawan"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-primary" disabled={busy}>
          +
        </button>
      </form>
      <div className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 py-2">
            <span className={`flex-1 text-sm ${r.active ? "" : "text-slate-400 line-through"}`}>
              {r.name}
            </span>
            <button
              onClick={() => toggle(r)}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {r.active ? "Aktif" : "Nonaktif"}
            </button>
            <button onClick={() => del(r)} className="text-xs text-red-600 hover:underline">
              Hapus
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="py-2 text-sm text-slate-500">Belum ada karyawan.</p>}
      </div>
    </div>
  );
}
