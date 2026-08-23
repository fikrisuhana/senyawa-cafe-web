import { todayKey, labelHari } from "./bizday";

export type Period = {
  mode: "hari" | "bulan";
  date: string; // YYYY-MM-DD (mode hari)
  month: string; // YYYY-MM (mode bulan)
  label: string;
  /** Filter Prisma untuk kolom businessDate (string). */
  filter: { equals: string } | { startsWith: string };
};

export function labelBulan(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

export function resolvePeriod(
  sp: { mode?: string; date?: string; month?: string },
  cutoffHour: number
): Period {
  const today = todayKey(cutoffHour);
  const mode = sp.mode === "bulan" ? "bulan" : "hari";
  const date = sp.date || today;
  const month = sp.month || today.slice(0, 7);
  if (mode === "bulan") {
    return { mode, date, month, label: labelBulan(month), filter: { startsWith: month } };
  }
  return { mode, date, month, label: labelHari(date), filter: { equals: date } };
}
