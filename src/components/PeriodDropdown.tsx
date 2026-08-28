"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PERIOD_PRESETS } from "@/lib/period";

/// Dropdown periode ala Dashboard Spreadsheet: preset (hari ini/kemarin/7/14/
/// 30 hari/bulan lalu/60 hari) + pilih tanggal tertentu (input date).
/// Param lain (mis. shift) dipertahankan saat ganti periode.
export default function PeriodDropdown({
  preset,
  date,
}: {
  preset: string;
  date: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [d, setD] = useState(date);

  function apply(p: string, customDate = d) {
    const q = new URLSearchParams(sp.toString());
    q.set("mode", "rentang");
    q.set("preset", p);
    if (p === "tanggal") {
      q.set("date", customDate);
    } else {
      q.delete("date");
      q.delete("page");
    }
    router.push(`${pathname}?${q}`);
  }

  const sel =
    "h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500";

  return (
    <div className="flex items-center gap-2">
      <select className={`${sel} min-w-[9.5rem]`} value={preset || "hari_ini"} onChange={(e) => apply(e.target.value)}>
        {PERIOD_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {preset === "tanggal" && (
        <input
          type="date"
          className={`${sel} min-w-[9.5rem]`}
          value={d}
          onChange={(e) => {
            setD(e.target.value);
            if (e.target.value) apply("tanggal", e.target.value);
          }}
        />
      )}
    </div>
  );
}
