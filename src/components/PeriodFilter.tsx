"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Calendar } from "lucide-react";

export default function PeriodFilter({
  mode,
  date,
  month,
}: {
  mode: "hari" | "bulan" | "rentang"; // rentang hanya dari Dashboard — di sini dianggap hari
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
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
        {(["hari", "bulan"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => {
              setM(opt);
              apply(opt);
            }}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              m === opt ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {opt === "hari" ? "Harian" : "Bulanan"}
          </button>
        ))}
      </div>
      {m === "hari" ? (
        <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            className="bg-transparent text-xs text-slate-800 focus:outline-none font-medium"
            value={d}
            onChange={(e) => {
              setD(e.target.value);
              apply("hari", e.target.value);
            }}
          />
        </div>
      ) : (
        <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="month"
            className="bg-transparent text-xs text-slate-800 focus:outline-none font-medium"
            value={mo}
            onChange={(e) => {
              setMo(e.target.value);
              apply("bulan", undefined, e.target.value);
            }}
          />
        </div>
      )}
    </div>
  );
}
