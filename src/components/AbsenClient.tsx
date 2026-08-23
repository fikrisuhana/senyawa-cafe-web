"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      setErr(j.error || "Gagal");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-600">{err}</p>}
      {list.map((e) => (
        <div key={e.id} className="card flex flex-wrap items-center gap-3 !py-3">
          <div className="flex-1 font-semibold">{e.name}</div>
          <div className="flex gap-1">
            {shifts.map((s) => {
              const on = e.shifts.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggle(e.id, s)}
                  disabled={!!busy}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    on
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-center text-xs text-slate-400">
        Hijau = sudah masuk shift itu hari ini. Nggak perlu absen pulang.
      </p>
    </div>
  );
}
