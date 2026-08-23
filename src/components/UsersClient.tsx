"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type UserRow = {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "KASIR";
  active: boolean;
};

const EMPTY = { id: "", username: "", name: "", role: "KASIR", password: "" };

export default function UsersClient({ rows }: { rows: UserRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState<any>(EMPTY);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = !!form.id;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/users", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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

  async function toggle(u: UserRow) {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, active: !u.active }),
    });
    router.refresh();
  }

  async function del(u: UserRow) {
    if (!confirm(`Hapus user "${u.username}"?`)) return;
    const res = await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Gagal hapus");
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <form onSubmit={save} className="card h-fit space-y-3">
        <h2 className="font-bold">{editing ? "Edit user" : "Tambah user"}</h2>
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            disabled={editing}
            required
          />
        </div>
        <div>
          <label className="label">Nama</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Role</label>
          <select
            className="input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="KASIR">KASIR</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <div>
          <label className="label">
            {editing ? "Password baru (kosongkan jika tetap)" : "Password"}
          </label>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editing}
          />
        </div>
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
              <th className="th">Username</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="td font-medium">{u.name}</td>
                <td className="td text-slate-500">{u.username}</td>
                <td className="td">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.role === "ADMIN"
                        ? "bg-brand-100 text-brand-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="td">
                  <button
                    onClick={() => toggle(u)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {u.active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="td text-right">
                  <button
                    onClick={() => setForm({ ...u, password: "" })}
                    className="text-brand-700 hover:underline"
                  >
                    Edit
                  </button>
                  <button onClick={() => del(u)} className="ml-3 text-red-600 hover:underline">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
