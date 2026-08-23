"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";

type Bar = { label: string; value: number };
export type StatData = {
  month: string;
  omzetHarian: Bar[];
  terlaris: Bar[];
  metode: Bar[];
  kategori: Bar[];
};

const METRICS = [
  { key: "omzetHarian", label: "Omzet per hari", money: true },
  { key: "terlaris", label: "Menu terlaris", money: false },
  { key: "metode", label: "Metode bayar", money: true },
  { key: "kategori", label: "Per kategori", money: true },
] as const;

export default function DashboardStats({
  data,
  monthLabel,
}: {
  data: StatData;
  monthLabel: string;
}) {
  const router = useRouter();
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("omzetHarian");
  const active = METRICS.find((m) => m.key === metric)!;
  const bars = data[metric];
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">Statistik</h2>
          <p className="text-xs text-slate-500">{monthLabel}</p>
        </div>
        <input
          type="month"
          className="input w-auto"
          value={data.month}
          onChange={(e) => router.push(`/admin/dashboard?bulan=${e.target.value}`)}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              metric === m.key ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {bars.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Belum ada data bulan ini.</p>
      ) : metric === "omzetHarian" ? (
        <ColumnChart bars={bars} max={max} />
      ) : (
        <div className="space-y-1.5">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="w-12 shrink-0 truncate text-right text-[11px] text-slate-500 sm:w-24">
                {b.label}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full rounded bg-brand-500"
                  style={{ width: `${Math.max(3, (b.value / max) * 100)}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-[11px] font-medium sm:w-24 sm:text-xs">
                {active.money ? rupiah(b.value) : `${b.value}×`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ringkas(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0) + "jt";
  if (v >= 1000) return Math.round(v / 1000) + "rb";
  return String(v);
}

function ColumnChart({ bars, max }: { bars: Bar[]; max: number }) {
  const barW = 34;
  const gap = 10;
  const topPad = 20; // ruang label nilai di atas batang
  const h = 150; // area batang
  const bottomPad = 22; // ruang label tanggal
  const height = topPad + h + bottomPad;
  const width = Math.max(bars.length * (barW + gap) + gap, 320);
  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={0} x2={width} y1={topPad + (h - h * g)} y2={topPad + (h - h * g)} stroke="#eef2f7" />
        ))}
        {bars.map((b, i) => {
          const bh = Math.max(2, (b.value / max) * h);
          const x = gap / 2 + i * (barW + gap);
          const y = topPad + (h - bh);
          return (
            <g key={b.label}>
              <rect x={x} y={y} width={barW} height={bh} rx={4} fill="#7c5cff">
                <title>
                  {b.label}: {rupiah(b.value)}
                </title>
              </rect>
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#5b34d6">
                {b.value > 0 ? ringkas(b.value) : ""}
              </text>
              <text x={x + barW / 2} y={topPad + h + 15} textAnchor="middle" fontSize="10" fill="#64748b">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[11px] text-slate-400">
        Tanggal (hari usaha) · angka dalam ribuan · sentuh batang untuk nilai penuh
      </p>
    </div>
  );
}
