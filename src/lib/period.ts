import { todayKey, labelHari } from "./bizday";

export type Period = {
  mode: "hari" | "bulan" | "rentang";
  date: string; // YYYY-MM-DD (mode hari / rentang=tanggal)
  month: string; // YYYY-MM (mode bulan)
  start: string; // awal rentang (mode rentang)
  end: string; // akhir rentang (mode rentang)
  preset: string; // id preset aktif
  label: string;
  /** Filter Prisma untuk kolom businessDate (string, urut leksikografis = urut tanggal). */
  filter: { equals: string } | { startsWith: string } | { gte: string; lte: string };
};

export type PresetOpt = { id: string; label: string };
export const PERIOD_PRESETS: PresetOpt[] = [
  { id: "hari_ini", label: "Hari ini" },
  { id: "kemarin", label: "Kemarin" },
  { id: "7hari", label: "7 hari" },
  { id: "14hari", label: "14 hari" },
  { id: "1bulan", label: "1 bulan (30 hari)" },
  { id: "bulan_lalu", label: "Bulan lalu" },
  { id: "2bulan", label: "2 bulan (60 hari)" },
  { id: "tanggal", label: "Tanggal tertentu" },
];

export function labelBulan(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function resolvePeriod(
  sp: { mode?: string; date?: string; month?: string; preset?: string },
  cutoffHour: number
): Period {
  const today = todayKey(cutoffHour);
  const mode = sp.mode === "bulan" ? "bulan" : sp.mode === "rentang" ? "rentang" : "hari";
  const date = sp.date || today;
  const month = sp.month || today.slice(0, 7);
  if (mode === "bulan") {
    return { mode, date, month, start: month + "-01", end: month + "-31", preset: "", label: labelBulan(month), filter: { startsWith: month } };
  }
  if (mode === "hari") {
    return { mode, date, month, start: date, end: date, preset: "", label: labelHari(date), filter: { equals: date } };
  }

  // mode rentang — preset (konsisten dgn Dashboard Spreadsheet: N hari berakhir hari ini)
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (n: number) => {
    const d = new Date(t);
    d.setDate(d.getDate() - n);
    return d;
  };
  const preset = sp.preset || "hari_ini";
  let start = today;
  let end = today;
  let label = "Hari ini";
  switch (preset) {
    case "kemarin": {
      const k = back(1);
      start = end = iso(k);
      label = "Kemarin (" + labelHari(iso(k)) + ")";
      break;
    }
    case "7hari":
      start = iso(back(6));
      label = "7 hari terakhir";
      break;
    case "14hari":
      start = iso(back(13));
      label = "14 hari terakhir";
      break;
    case "1bulan":
      start = iso(back(29));
      label = "30 hari terakhir";
      break;
    case "2bulan":
      start = iso(back(59));
      label = "60 hari terakhir";
      break;
    case "bulan_lalu": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      start = iso(first);
      end = iso(last);
      label = "Bulan lalu (" + labelBulan(start.slice(0, 7)) + ")";
      break;
    }
    case "tanggal":
      start = end = date;
      label = "Tanggal " + labelHari(date);
      break;
    default:
      label = "Hari ini";
  }
  return { mode, date, month, start, end, preset, label, filter: { gte: start, lte: end } };
}
