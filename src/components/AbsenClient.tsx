"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, User } from "lucide-react";

export type EmpRow = { id: string; name: string; shifts: string[] };

export default function AbsenClient({
  list,
  shifts,
}: {
  list: EmpRow[];
  shifts: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function toggle(employeeId: string, shift: string) {
    setBusy(employeeId + shift);
    setErr("");
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, shift }),
    });
    setBusy("");
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Gagal mengubah status absensi");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3 text-xs">
      {err && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-medium">{err}</div>}
      {list.map((e) => (
        <div key={e.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0">
              {e.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">{e.name}</div>
              <div className="text-[11px] text-slate-400">
                {e.shifts.length > 0
                  ? `Hadir: ${e.shifts.join(", ")}`
                  : "Belum absen hari ini"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {shifts.map((s) => {
              const on = e.shifts.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggle(e.id, s)}
                  disabled={!!busy}
                  className={`px-4 py-2 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${
                    on
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {on && <Check className="w-3.5 h-3.5" />}
                  <span>{s}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-center text-[11px] text-slate-400 pt-2">
        💡 Tombol hijau menandakan karyawan sudah tercatat hadir pada shift tersebut hari ini.
      </p>
    </div>
  );
}
