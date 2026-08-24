import { prisma } from "./db";

export type Settings = {
  storeName: string;
  logoEmoji: string;
  logoImage: string; // data URL (kosong = pakai emoji)
  openHour: number;
  closeHour: number;
  dayCutoffHour: number;
  receiptHeader: string;
  receiptFooter: string;
  quickCash: string; // csv nominal, "pas" = tepat total
  paperWidth: number; // 58 | 80 (mm)
  shifts: string; // csv nama shift, mis. "Pagi,Malam"
  shiftHours: string; // csv jam per shift sejajar `shifts`, mis. "9-17,17-24"
  kasAwal: number; // modal kas awal harian (mis. 250000)
};

const DEFAULTS: Settings = {
  storeName: "Cafe Kita",
  logoEmoji: "☕",
  logoImage: "",
  openHour: 7,
  closeHour: 3,
  dayCutoffHour: 6,
  receiptHeader: "",
  receiptFooter: "Terima kasih!",
  quickCash: "pas,20000,50000,100000",
  paperWidth: 58,
  shifts: "Pagi,Malam",
  shiftHours: "9-17,17-24",
  kasAwal: 250000,
};

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    storeName: map.storeName ?? DEFAULTS.storeName,
    logoEmoji: map.logoEmoji ?? DEFAULTS.logoEmoji,
    logoImage: map.logoImage ?? DEFAULTS.logoImage,
    openHour: numOr(map.openHour, DEFAULTS.openHour),
    closeHour: numOr(map.closeHour, DEFAULTS.closeHour),
    dayCutoffHour: numOr(map.dayCutoffHour, DEFAULTS.dayCutoffHour),
    receiptHeader: map.receiptHeader ?? DEFAULTS.receiptHeader,
    receiptFooter: map.receiptFooter ?? DEFAULTS.receiptFooter,
    quickCash: map.quickCash ?? DEFAULTS.quickCash,
    paperWidth: numOr(map.paperWidth, DEFAULTS.paperWidth),
    shifts: map.shifts ?? DEFAULTS.shifts,
    shiftHours: map.shiftHours ?? DEFAULTS.shiftHours,
    kasAwal: numOr(map.kasAwal, DEFAULTS.kasAwal),
  };
}

/** Parse "Sore,Malam" → ["Sore","Malam"]. */
export function parseShifts(csv: string): string[] {
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function setSettings(patch: Partial<Record<keyof Settings, string>>) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }
}

/** Parse quickCash "pas,20000,50000" → [{label, value}]. value 0 = pas (total). */
export function parseQuickCash(csv: string): Array<{ label: string; value: number }> {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (s.toLowerCase() === "pas") return { label: "Pas", value: 0 };
      const n = Number(s.replace(/\D/g, ""));
      return { label: "Rp" + n.toLocaleString("id-ID"), value: n };
    });
}

function numOr(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
