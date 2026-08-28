import { prisma } from "./db";

/**
 * Rentang shift dari Setting web (`shifts` + `shiftHours`), mis.
 * Pagi 8-16, Malam 16-24. Dipakai buat nentuin shift-nya sebuah transaksi
 * (dinamis — kalau owner ubah jam shift, data BARU ikut aturan baru).
 */
export type ShiftRange = { name: string; start: number; end: number };

export async function shiftRanges(): Promise<ShiftRange[]> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ["shifts", "shiftHours"] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const names = (map.shifts || "Pagi,Malam")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ranges = (map.shiftHours || "8-16,16-24")
    .split(",")
    .map((x) => {
      const m = x.trim().match(/^(\d{1,2})-(\d{1,2})$/);
      return m ? { start: Number(m[1]), end: Number(m[2]) } : null;
    })
    .filter((x): x is { start: number; end: number } => !!x);
  return names.map((name, i) => ({
    name,
    start: ranges[i]?.start ?? 0,
    end: ranges[i]?.end ?? 24,
  }));
}

/**
 * Nama shift untuk jam tertentu (0-23). Jam 16:00+ → Malam, dst.
 * Jam SEBELUM shift pertama (mis. 00-08) dihitung lanjutan shift TERAKHIR
 * (malam — sesuai hari usaha yang tutup jam 00.00).
 */
export function shiftNameForHour(hour: number, ranges: ShiftRange[]): string {
  for (const r of ranges) {
    if (hour >= r.start && hour < r.end) return r.name;
  }
  return ranges.length ? ranges[ranges.length - 1].name : "";
}
