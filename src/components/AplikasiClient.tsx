"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, Upload, Smartphone } from "lucide-react";

export type ReleaseRow = {
  id: string;
  versionCode: number;
  versionName: string;
  notes: string;
  size: number;
  sha256: string;
  publishedAt: string;
  url: string;
  createdBy: string | null;
};
type DeviceRow = { id: string; name: string; appVersion: string | null; lastSeenAt: string };

const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
const tgl = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AplikasiClient({ releases, devices }: { releases: ReleaseRow[]; devices: DeviceRow[] }) {
  const router = useRouter();
  const latest = releases[0];
  const fileRef = useRef<HTMLInputElement>(null);
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState(latest ? String(latest.versionCode + 1) : "");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState("");

  function upload(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const f = fileRef.current?.files?.[0];
    if (!f) return setErr("Pilih file APK dulu");
    const fd = new FormData();
    fd.append("file", f);
    fd.append("versionCode", versionCode);
    fd.append("versionName", versionName);
    fd.append("notes", notes);
    // XHR biar ada progres upload (file puluhan MB).
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/app-releases");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      let body: { error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        setNotes("");
        setVersionName("");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else setErr(body.error || `Gagal upload (HTTP ${xhr.status})`);
    };
    xhr.onerror = () => {
      setProgress(null);
      setErr("Koneksi putus saat upload");
    };
    setProgress(0);
    xhr.send(fd);
  }

  async function del(r: ReleaseRow) {
    if (!confirm(`Hapus rilis v${r.versionName} (kode ${r.versionCode})? HP yang belum update tidak akan ditawari versi ini lagi.`)) return;
    await fetch(`/api/admin/app-releases?id=${r.id}`, { method: "DELETE" });
    router.refresh();
  }

  const inp = "w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white";

  return (
    <div className="space-y-6 text-xs">
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={upload} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3">
          <p className="font-bold text-slate-900 text-sm">Terbitkan versi baru</p>
          <input ref={fileRef} type="file" accept=".apk,application/vnd.android.package-archive" className="block w-full text-xs" />
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Versi (mis. 1.1.0)</span>
              <input className={inp} value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="1.1.0" required />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Kode build (angka)</span>
              <input
                className={inp}
                value={versionCode}
                onChange={(e) => setVersionCode(e.target.value.replace(/\D/g, ""))}
                placeholder="2"
                required
              />
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            Isi sesuai build APK-nya (pubspec <code>versi+kode</code>, mis. <code>1.1.0+2</code> → versi 1.1.0, kode 2). Kode harus lebih besar
            dari yang terpasang di HP supaya HP ditawari update.
          </p>
          <label className="space-y-1 block">
            <span className="font-semibold text-slate-700">Catatan perubahan (tampil di HP)</span>
            <textarea className={inp} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={"- Perbaikan struk\n- Fitur baru …"} />
          </label>
          {err && <p className="text-rose-600 font-medium">{err}</p>}
          <button
            disabled={progress !== null}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {progress !== null ? `Mengunggah… ${progress}%` : "Upload & terbitkan"}
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-slate-500" /> Versi terpasang di perangkat
          </div>
          <div className="divide-y divide-slate-100">
            {devices.length === 0 && <p className="p-4 text-slate-400">Belum ada perangkat login.</p>}
            {devices.map((d) => {
              const v = d.appVersion || "?";
              const upToDate = latest && v.endsWith(`+${latest.versionCode}`);
              return (
                <div key={d.id} className="p-3 px-4 flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-800">{d.name}</span>
                  <span className={`pill ${!latest ? "pill-slate" : upToDate ? "pill-green" : "pill-amber"}`}>v{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">Rilis ({releases.length}) · disimpan 3 terakhir</div>
        <div className="divide-y divide-slate-100">
          {releases.length === 0 && <p className="p-4 text-slate-400">Belum ada APK diterbitkan.</p>}
          {releases.map((r, i) => (
            <div key={r.id} className="p-4 flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[220px] space-y-1">
                <p className="font-bold text-slate-800">
                  v{r.versionName} <span className="text-slate-400 font-medium">(kode {r.versionCode})</span>
                  {i === 0 && <span className="pill pill-green ml-2">terbaru</span>}
                </p>
                <p className="text-slate-500">
                  {tgl(r.publishedAt)} · {mb(r.size)}
                  {r.createdBy ? ` · oleh ${r.createdBy}` : ""}
                </p>
                {r.notes && <p className="whitespace-pre-line text-slate-600">{r.notes}</p>}
              </div>
              <a
                href={r.url}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" /> Unduh
              </a>
              <button onClick={() => del(r)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50" title="Hapus rilis">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
