"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { PERIOD_PRESETS } from "@/lib/period";

/// Dropdown periode ala Dashboard Spreadsheet: preset (hari ini/kemarin/7/14/
/// 30 hari/bulan lalu/60 hari) + pilih tanggal tertentu (input date).
export default function PeriodDropdown({
  preset,
  date,
  label,
}: {
  preset: string;
  date: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [d, setD] = useState(date);

  function apply(p: string, customDate = d) {
    if (p === "tanggal") {
      router.push(`${pathname}?mode=rentang&preset=tanggal&date=${customDate}`);
    } else {
      router.push(`${pathname}?mode=rentang&preset=${p}`);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="input h-9 w-auto text-sm"
        value={preset || "hari_ini"}
        onChange={(e) => apply(e.target.value)}
      >
        {PERIOD_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {preset === "tanggal" && (
        <input
          type="date"
          className="input h-9 w-auto text-sm"
          value={d}
          onChange={(e) => {
            setD(e.target.value);
            if (e.target.value) apply("tanggal", e.target.value);
          }}
        />
      )}
      <span className="hidden text-xs text-slate-400 sm:inline">{label}</span>
    </div>
  );
}
