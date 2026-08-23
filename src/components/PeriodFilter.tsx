"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

export default function PeriodFilter({
  mode,
  date,
  month,
}: {
  mode: "hari" | "bulan";
  date: string;
  month: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [m, setM] = useState(mode);
  const [d, setD] = useState(date);
  const [mo, setMo] = useState(month);

  function apply(nextMode = m, nextDate = d, nextMonth = mo) {
    const q =
      nextMode === "bulan"
        ? `mode=bulan&month=${nextMonth}`
        : `mode=hari&date=${nextDate}`;
    router.push(`${pathname}?${q}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex overflow-hidden rounded-lg ring-1 ring-slate-200">
        {(["hari", "bulan"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => {
              setM(opt);
              apply(opt);
            }}
            className={`px-3 py-2 text-sm font-medium ${
              m === opt ? "bg-brand-600 text-white" : "bg-white text-slate-600"
            }`}
          >
            {opt === "hari" ? "Harian" : "Bulanan"}
          </button>
        ))}
      </div>
      {m === "hari" ? (
        <input
          type="date"
          className="input w-auto"
          value={d}
          onChange={(e) => {
            setD(e.target.value);
            apply("hari", e.target.value);
          }}
        />
      ) : (
        <input
          type="month"
          className="input w-auto"
          value={mo}
          onChange={(e) => {
            setMo(e.target.value);
            apply("bulan", d, e.target.value);
          }}
        />
      )}
    </div>
  );
}
