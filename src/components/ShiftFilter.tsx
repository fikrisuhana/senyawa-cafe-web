"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/// Dropdown filter SHIFT (Semua / Pagi / Malam) — nilai dari Setting web,
/// dipakai di halaman Rekap biar laporan bisa dilihat per shift.
export default function ShiftFilter({ shifts, current }: { shifts: string[]; current: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  return (
    <select
      className="h-8 min-w-[8.5rem] rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
      value={current}
      onChange={(e) => {
        const p = new URLSearchParams(sp.toString());
        if (e.target.value) p.set("shift", e.target.value);
        else p.delete("shift");
        p.delete("page");
        router.push(`${pathname}?${p}`);
      }}
    >
      <option value="">Semua Shift</option>
      {shifts.map((s) => (
        <option key={s} value={s}>
          Shift {s}
        </option>
      ))}
    </select>
  );
}
