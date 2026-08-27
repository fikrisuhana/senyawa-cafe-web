"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Edit2, Trash2, Shield, User, AlertCircle } from "lucide-react";

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
      setErr(j.error || "Gagal menyimpan user");
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
    if (!confirm(`Apakah Anda yakin ingin menghapus akun user "${u.username}"?`)) return;
    const res = await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Gagal menghapus user");
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Form Input User */}
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 h-fit text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-sm">
            {editing ? "Ubah Akun User" : "Tambah User Baru"}
          </h3>
          <p className="text-[11px] text-slate-400">
            {editing ? "Perbarui informasi nama, role, atau ganti password" : "Buat akun login kasir atau admin baru"}
          </p>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Username</label>
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono font-medium disabled:bg-slate-100 disabled:text-slate-400"
            placeholder="Contoh: kasir1"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            disabled={editing}
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap</label>
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            placeholder="Contoh: Siti Rahmawati"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Role / Peran</label>
          <select
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="KASIR">KASIR (Akses Kasir & Rekap Hari Ini)</option>
            <option value="ADMIN">ADMIN (Akses Penuh Manajemen)</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            {editing ? "Password Baru (Kosongkan jika tidak diganti)" : "Password Login"}
          </label>
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editing}
          />
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
            {busy ? "Menyimpan..." : editing ? "Simpan Perubahan" : "+ Tambah User"}
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

      {/* Tabel Manajemen User Tim (Identik app-monitoring) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0 h-fit">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Daftar Akun Pengguna</h3>
            <p className="text-[11px] text-slate-400">Total {rows.length} akun terdaftar di sistem</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Role Akses</th>
                <th className="py-3 px-4">Status Akun</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{u.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-600">
                    @{u.username}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={u.role === "ADMIN" ? "pill-blue" : "pill-slate"}
                    >
                      {u.role === "ADMIN" ? "🛡️ ADMIN" : "👤 KASIR"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggle(u)}
                      className={u.active ? "pill-green cursor-pointer" : "pill-slate cursor-pointer"}
                    >
                      {u.active ? "Aktif" : "Nonaktif"}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setForm({ ...u, password: "" });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => del(u)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition"
                        title="Hapus User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="py-8 text-center text-slate-400" colSpan={5}>
                    Belum ada user. Tambahkan user di form sebelah kiri.
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
