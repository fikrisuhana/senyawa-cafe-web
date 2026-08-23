/**
 * "Hari usaha" (business day) untuk cafe yang tutup lewat tengah malam.
 * Buka 9 pagi - 1 pagi. Transaksi jam 00:30 masih masuk hari sebelumnya.
 *
 * dayCutoffHour = jam pemisah (default 6 pagi). Segala transaksi mulai
 * jam cutoff hari ini s/d cutoff besok dihitung sebagai satu hari usaha.
 *
 * Server dijalankan dengan TZ=Asia/Jakarta, jadi semua pakai jam lokal.
 */

export function businessDateKey(d: Date, cutoffHour: number): string {
  const shifted = new Date(d.getTime() - cutoffHour * 3600 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const day = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Jendela waktu [start, end) untuk satu kunci hari usaha "YYYY-MM-DD". */
export function businessDateRange(
  key: string,
  cutoffHour: number
): { start: Date; end: Date } {
  const [y, m, d] = key.split("-").map(Number);
  const start = new Date(y, m - 1, d, cutoffHour, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end };
}

/** Kunci hari usaha "sekarang". */
export function todayKey(cutoffHour: number): string {
  return businessDateKey(new Date(), cutoffHour);
}

/** Label ramah: "Sen, 27 Jul 2026". */
export function labelHari(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
