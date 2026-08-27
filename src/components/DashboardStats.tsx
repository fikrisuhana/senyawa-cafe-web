"use client";

import { useState } from "react";
import { rupiah } from "@/lib/format";
import { BarChart3 } from "lucide-react";

type Bar = { label: string; value: number };
export type StatData = {
  month: string;
  omzetHarian: Bar[];
  terlaris: Bar[];
  metode: Bar[];
  kategori: Bar[];
};

const METRICS = [
  { key: "omzetHarian", label: "Omzet per Hari", money: true },
  { key: "terlaris", label: "Menu Terlaris", money: false },
  { key: "metode", label: "Metode Pembayaran", money: true },
  { key: "kategori", label: "Kategori Produk", money: true },
] as const;

export default function DashboardStats({
  data,
  monthLabel,
}: {
  data: StatData;
  monthLabel: string;
}) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("omzetHarian");
  const active = METRICS.find((m) => m.key === metric)!;
  const bars = data[metric];
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Visualisasi Statistik & Grafik Penjualan</h3>
            <p className="text-[11px] text-slate-400">Analisis tren harian dan performa menu pada {monthLabel}</p>
          </div>
        </div>

        {/* Filter Chips (ala app-monitoring) */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`chip-filter ${metric === m.key ? "active" : ""}`}
            >
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          Belum ada data transaksi tercatat pada periode ini.
        </div>
      ) : metric === "omzetHarian" ? (
        <ColumnChart bars={bars} max={max} />
      ) : (
        <div className="space-y-2 py-2">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-3 text-xs">
              <span className="w-24 shrink-0 truncate text-right font-medium text-slate-600 sm:w-32">
                {b.label}
              </span>
              <div className="h-6 flex-1 overflow-hidden rounded-lg bg-slate-100 p-0.5">
                <div
                  className="h-full rounded-md bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.max(4, (b.value / max) * 100)}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right font-mono font-bold text-slate-900 sm:w-28">
                {active.money ? rupiah(b.value) : `${b.value} porsi`}
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
  const gap = 12;
  const topPad = 24; // ruang label nilai di atas batang
  const h = 160; // area batang
  const bottomPad = 24; // ruang label tanggal
  const height = topPad + h + bottomPad;
  const width = Math.max(bars.length * (barW + gap) + gap, 360);
  return (
    <div className="overflow-x-auto pt-2">
      <svg width={width} height={height} className="min-w-full">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={0}
            x2={width}
            y1={topPad + (h - h * g)}
            y2={topPad + (h - h * g)}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
        ))}
        {bars.map((b, i) => {
          const bh = Math.max(3, (b.value / max) * h);
          const x = gap / 2 + i * (barW + gap);
          const y = topPad + (h - bh);
          return (
            <g key={b.label} className="group cursor-pointer">
              <rect
                x={x}
                y={y}
                width={barW}
                height={bh}
                rx={6}
                fill="#2563eb"
                className="transition-opacity hover:opacity-80"
              >
                <title>
                  Tanggal {b.label}: {rupiah(b.value)}
                </title>
              </rect>
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#1e293b"
                className="font-mono"
              >
                {b.value > 0 ? ringkas(b.value) : ""}
              </text>
              <text
                x={x + barW / 2}
                y={topPad + h + 16}
                textAnchor="middle"
                fontSize="10"
                fill="#64748b"
                fontWeight="500"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        Grafik harian tanggal bulan usaha · Satuan rupiah · Arahkan kursor ke batang grafik untuk detail nominal
      </p>
    </div>
  );
}
