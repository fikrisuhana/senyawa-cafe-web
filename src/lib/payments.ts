/**
 * Metode bayar + SPLIT PAYMENT (mis. 100rb = 50rb tunai + 50rb transfer).
 *
 * Kontrak data Transaction:
 *  - 1 metode  → payment = "TUNAI" | "QRIS" | "TRANSFER" | ..., payments = null
 *  - split     → payment = "SPLIT", payments = [{method, amount}, {method, amount}]
 *    `amount` = porsi BERSIH yang masuk ke transaksi → jumlahnya SELALU = total.
 *    Kembalian (cuma dari tunai) tetap di `change`; `paid` = total + change.
 *
 * Semua laporan (laci, per-metode, Sheet) WAJIB baca lewat payParts() supaya
 * porsi tunai dari transaksi split ikut kehitung ke uang laci.
 */

export type PayPart = { method: string; amount: number };

export const SPLIT = "SPLIT";

/** Pilihan metode yang bisa diaktifkan admin di kasir (Setting `paymentMethods`). */
export const PAYMENT_METHOD_OPTIONS = ["TUNAI", "QRIS", "TRANSFER", "SPLIT"] as const;

/** Normalisasi nama metode: uppercase, CASH → TUNAI. */
export function normMethod(m: unknown): string {
  const u = String(m ?? "").trim().toUpperCase();
  if (u === "CASH") return "TUNAI";
  return u;
}

/** Rincian bayar per metode. Transaksi 1 metode → satu porsi senilai total. */
export function payParts(t: { payment: string; total: number; payments?: unknown }): PayPart[] {
  if (t.payment === SPLIT && Array.isArray(t.payments)) {
    const parts = (t.payments as any[])
      .map((p) => ({ method: normMethod(p?.method), amount: Math.round(Number(p?.amount) || 0) }))
      .filter((p) => p.method && p.amount > 0);
    if (parts.length) return parts;
  }
  return [{ method: normMethod(t.payment), amount: t.total }];
}

/** Porsi TUNAI sebuah transaksi (yang beneran masuk laci). */
export function cashPortion(t: { payment: string; total: number; payments?: unknown }): number {
  return payParts(t)
    .filter((p) => p.method === "TUNAI")
    .reduce((s, p) => s + p.amount, 0);
}

/** Label singkat buat tabel/struk, mis. "TUNAI + TRANSFER". */
export function payLabel(t: { payment: string; total: number; payments?: unknown }): string {
  if (t.payment !== SPLIT) return t.payment;
  return payParts(t).map((p) => p.method).join(" + ");
}

/**
 * Validasi input split dari HP/web. Aturan: TEPAT 2 porsi, metode beda &
 * tak kosong (metode HP dinamis, mis. "OVO" → masuk "Lainnya" di laporan),
 * nominal > 0, jumlah = total. Lempar Error berpesan jelas kalau tak valid.
 *
 * `cashAbsorbs` (dipakai POST penjualan dari kasir): server menghitung ulang
 * total dari harga SERVER — kalau katalog HP telat (harga baru diubah di web),
 * total HP ≠ total server. Porsi non-tunai = uang yang benar-benar masuk (pas),
 * jadi porsi TUNAI yang menyesuaikan (= total − non-tunai), persis seperti
 * bayar tunai biasa yang selisihnya diserap kembalian. Tanpa ini transaksi
 * split ditolak & nyangkut selamanya di antrean HP. Koreksi admin (PUT) = strict.
 */
export function parseSplit(raw: unknown, total: number, opts: { cashAbsorbs?: boolean } = {}): PayPart[] {
  if (!Array.isArray(raw) || raw.length !== 2) throw new Error("Split bayar harus tepat 2 metode");
  const parts = raw.map((p: any) => ({
    method: normMethod(p?.method).slice(0, 20),
    amount: Math.round(Number(p?.amount) || 0),
  }));
  for (const p of parts) {
    if (!p.method || p.method === SPLIT) throw new Error(`Metode split tidak valid: ${p.method || "(kosong)"}`);
    if (p.amount <= 0) throw new Error("Nominal tiap metode split harus > 0");
  }
  if (parts[0].method === parts[1].method) throw new Error("Metode split harus beda");

  const cash = parts.find((p) => p.method === "TUNAI");
  if (opts.cashAbsorbs && cash) {
    const nonCash = parts.filter((p) => p !== cash).reduce((s, p) => s + p.amount, 0);
    if (nonCash >= total) throw new Error("Porsi non-tunai split sudah ≥ total — bayar 1 metode saja");
    cash.amount = total - nonCash;
    return parts;
  }
  const sum = parts[0].amount + parts[1].amount;
  if (sum !== total) throw new Error(`Rincian split (${sum}) tidak sama dengan total (${total})`);
  return parts;
}

/** Bucket laporan per metode (tunai/qris/transfer/lain) dari rincian bayar. */
export function bucketOf(method: string): "tunai" | "qris" | "transfer" | "lain" {
  const p = method.toUpperCase();
  if (p.includes("TUNAI") || p.includes("CASH")) return "tunai";
  if (p.includes("QRIS") || p.includes("QRI")) return "qris";
  if (p.includes("TRANSFER")) return "transfer";
  return "lain";
}
