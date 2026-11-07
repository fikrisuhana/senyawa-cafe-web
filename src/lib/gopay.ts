/**
 * DETEKSI PEMBAYARAN GOPAY tanpa payment gateway (cabang Kaligondang).
 *
 * HP MASTER (login GoPay Merchant) melapor 2 jenis kejadian:
 *  - NOTIF   : "Pembayaran QRIS statis diterima" / "Rp 1.001 di …" (presisi detik, TANPA ref)
 *  - HISTORY : baris Riwayat aktivitas "QRIS - AJDPID · Rp1.000" (presisi MENIT, ref unik)
 * Satu pembayaran sering terlihat di keduanya → digabung (nominal sama, jam ±2 mnt).
 * Pembayaran lalu dicocokkan ke PaymentIntent PENDING dgn nominal PERSIS sama yang
 * dibuat sebelum pembayaran. Nominal bentrok antar tagihan → kode unik (+1..99).
 */
import { prisma } from "./db";
import { qrisWithAmount } from "./qris";
import { getSettings } from "./settings";

export const MERGE_WINDOW_MS = 2 * 60_000; // notif ↔ riwayat dianggap pembayaran sama
export const INTENT_TTL_MS = 15 * 60_000; // tagihan QR kedaluwarsa
export const MASTER_ONLINE_MS = 2 * 60_000; // master dianggap online kalau heartbeat < 2 mnt

// ---------- parsing notif (sama dgn lib/services/pay_notif.dart di HP) ----------
const AMOUNT_RE = /(?:Rp\.?|IDR)\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+)/gi;
const INCOMING_RE = /diterima|masuk|berhasil|terima|sukses|lunas|dibayar|received|paid|payment|pembayaran/i;

export function amountsIn(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(AMOUNT_RE)) {
    const v = Number(m[1].replace(/[.,]/g, ""));
    if (v > 0) out.push(v);
  }
  return out;
}

/** Notif = pembayaran MASUK? Balik nominalnya, atau null. */
export function parseNotif(title: string, text: string): number | null {
  const all = `${title} — ${text}`;
  if (!INCOMING_RE.test(all)) return null;
  // Tolak notif uang KELUAR (penarikan/refund) walau ada kata "berhasil".
  if (/penarikan|ditarik|refund|dikembalikan|keluar|withdraw/i.test(all)) return null;
  const a = amountsIn(all);
  return a.length ? a[0] : null;
}

// ---------- kode unik ----------
/** Kode unik terkecil (0..99) yg nominal base+kode-nya belum dipakai tagihan PENDING lain. */
export function pickUniqueCode(base: number, takenAmounts: Set<number>): number {
  for (let c = 0; c < 100; c++) if (!takenAmounts.has(base + c)) return c;
  throw new Error("Terlalu banyak tagihan menunggu dengan nominal yang sama");
}

// ---------- DB ----------
export async function expireOldIntents() {
  await prisma.paymentIntent.updateMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

/** Buat tagihan QR. Nominal bentrok dgn tagihan PENDING lain → + kode unik. */
export async function createIntent(opts: { amount: number; label?: string | null; source?: string; createdBy?: string | null }) {
  const base = Math.round(opts.amount);
  if (!(base > 0)) throw new Error("Nominal harus > 0");
  await expireOldIntents();
  const pending = await prisma.paymentIntent.findMany({
    where: { status: "PENDING", amount: { gte: base, lte: base + 99 } },
    select: { amount: true },
  });
  const code = pickUniqueCode(base, new Set(pending.map((p) => p.amount)));
  const settings = await getSettings();
  const qris = settings.qrisStatic ? qrisWithAmount(settings.qrisStatic, base + code) : null;
  const intent = await prisma.paymentIntent.create({
    data: {
      baseAmount: base,
      amount: base + code,
      uniqueCode: code,
      label: opts.label ? String(opts.label).slice(0, 60) : null,
      source: opts.source || "KASIR",
      createdBy: opts.createdBy || null,
      expiresAt: new Date(Date.now() + INTENT_TTL_MS),
    },
  });
  return { intent, qris };
}

/** Cocokkan pembayaran yg belum terpakai ke tagihan PENDING (tertua dulu). */
export async function matchPayment(paymentId: string): Promise<string | null> {
  const p = await prisma.gopayPayment.findUnique({ where: { id: paymentId } });
  if (!p || p.intentId) return p?.intentId ?? null;
  // Tagihan harus SUDAH ada saat dibayar. Riwayat presisi menit (jam dibulatkan ke
  // bawah) → toleransi: tagihan boleh dibuat ≤60 dtk setelah jam pembayaran tercatat.
  // Pembayaran nyasar yg jauh sebelum tagihan dibuat tidak ikut tercocok.
  const intent = await prisma.paymentIntent.findFirst({
    where: {
      status: "PENDING",
      amount: p.amount,
      expiresAt: { gte: p.paidAt },
      createdAt: { lte: new Date(p.paidAt.getTime() + 60_000) },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!intent) return null;
  const via = p.hasHistory ? "HISTORY" : "NOTIF";
  // Kunci dobel: updateMany bersyarat status PENDING (aman kalau 2 laporan bersamaan).
  const done = await prisma.paymentIntent.updateMany({
    where: { id: intent.id, status: "PENDING" },
    data: { status: "PAID", paidAt: p.paidAt, paidVia: via, paymentId: p.id },
  });
  if (done.count === 0) return null;
  await prisma.gopayPayment.update({ where: { id: p.id }, data: { intentId: intent.id } });
  return intent.id;
}

type NotifEvent = { key: string; title: string; text: string; time: number };
type HistoryEvent = { ref: string; amount: number; time: number; incoming?: boolean; type?: string; raw?: string };

/** Simpan laporan HP master (notif + riwayat), gabung yg sama, lalu cocokkan. */
export async function ingestEvents(deviceId: string, notifs: NotifEvent[], history: HistoryEvent[]) {
  let stored = 0;
  let matched = 0;
  const touched: string[] = [];

  for (const n of notifs) {
    const amount = parseNotif(n.title || "", n.text || "");
    if (!amount || !n.key) continue;
    const key = `${n.key}@${n.time}`.slice(0, 200);
    if (await prisma.gopayPayment.findUnique({ where: { notifKey: key } })) continue;
    const t = new Date(Number(n.time));
    // Sudah ada dari RIWAYAT (belum ditandai notif), nominal sama & jam dekat → pembayaran yg sama.
    const twin = await prisma.gopayPayment.findFirst({
      where: {
        amount, hasNotif: false, hasHistory: true,
        paidAt: { gte: new Date(t.getTime() - MERGE_WINDOW_MS), lte: new Date(t.getTime() + MERGE_WINDOW_MS) },
      },
      orderBy: { paidAt: "asc" },
    });
    const p = twin
      ? await prisma.gopayPayment.update({ where: { id: twin.id }, data: { hasNotif: true, notifKey: key, title: n.title, paidAt: t } })
      : await prisma.gopayPayment.create({
          data: { notifKey: key, amount, paidAt: t, hasNotif: true, title: n.title?.slice(0, 120), raw: n.text?.slice(0, 300), deviceId },
        });
    if (!twin) stored++;
    touched.push(p.id);
  }

  for (const h of history) {
    if (!h.ref || h.incoming === false || !(h.amount > 0)) continue;
    if (await prisma.gopayPayment.findUnique({ where: { ref: h.ref } })) continue;
    const t = new Date(Number(h.time)); // awal menit
    const twin = await prisma.gopayPayment.findFirst({
      where: {
        amount: h.amount, hasHistory: false, hasNotif: true,
        paidAt: { gte: new Date(t.getTime() - 60_000), lte: new Date(t.getTime() + MERGE_WINDOW_MS) },
      },
      orderBy: { paidAt: "asc" },
    });
    const p = twin
      ? await prisma.gopayPayment.update({ where: { id: twin.id }, data: { hasHistory: true, ref: h.ref } })
      : await prisma.gopayPayment.create({
          data: { ref: h.ref, amount: h.amount, paidAt: t, hasHistory: true, raw: h.raw?.slice(0, 300), deviceId },
        });
    if (!twin) stored++;
    touched.push(p.id);
  }

  await expireOldIntents();
  for (const id of touched) if (await matchPayment(id)) matched++;
  return { stored, matched };
}

/** Status master buat ditampilkan di kasir ("deteksi otomatis aktif?"). */
export async function masterStatus() {
  const m = await prisma.device.findFirst({ where: { isMaster: true, enabled: true } });
  if (!m) return { master: null, online: false };
  return { master: { name: m.name, lastSeenAt: m.lastSeenAt }, online: Date.now() - m.lastSeenAt.getTime() < MASTER_ONLINE_MS };
}
