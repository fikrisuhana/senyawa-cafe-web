import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { appendTransactionToSheet } from "@/lib/gsheet";
import { getSettings } from "@/lib/settings";
import { businessDateKey } from "@/lib/bizday";
import { shiftRanges, shiftNameForHour } from "@/lib/shifts";

type InItem = { id: string; qty: number; optionIds?: string[]; note?: string };

export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items: InItem[] = Array.isArray(body.items) ? body.items : [];
  const paid = Number(body.paid) || 0;
  // Normalisasi ke UPPERCASE biar konsisten (TUNAI/QRIS/TRANSFER) — cocok dgn rumus Sheet.
  const payment = String(body.payment || "TUNAI").toUpperCase();
  const orderType = body.orderType === "TAKEAWAY" ? "TAKEAWAY" : "DINEIN";
  const note = body.note ? String(body.note) : null;
  const voucherId: string | null = body.voucherId || null;
  const manualDiscount = Math.max(0, Math.round(Number(body.manualDiscount) || 0));
  // UUID dari aplikasi HP → anti-dobel saat sinkron ulang (idempotent).
  const clientId: string | null = body.clientId ? String(body.clientId) : null;

  if (items.length === 0)
    return NextResponse.json({ error: "Keranjang kosong" }, { status: 400 });

  // Idempotency: kalau transaksi dgn clientId ini sudah pernah masuk, balikin yang lama.
  if (clientId) {
    const dup = await prisma.transaction.findUnique({ where: { clientId } });
    if (dup) return NextResponse.json({ ok: true, id: dup.id, code: dup.code, duplicate: true });
  }

  const settings = await getSettings();
  const now = new Date();
  // Waktu jual ASLI dari HP (offline-first): pakai `createdAt` klien kalau valid,
  // fallback ke jam server (jualan online real-time). Biar transaksi yang baru
  // kesync belakangan tetap masuk ke shift & hari usaha yang benar.
  const soldAtRaw = body.createdAt ? new Date(String(body.createdAt)) : now;
  const soldAt = isNaN(soldAtRaw.getTime()) ? now : soldAtRaw;
  // businessDate dari HP kalau formatnya benar (sama pola dgn /api/cash & /api/attendance).
  const businessDate =
    typeof body.businessDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.businessDate)
      ? body.businessDate
      : businessDateKey(soldAt, settings.dayCutoffHour);
  // Shift dari jam JUAL asli (Setting shiftHours, mis. Pagi 8-16 / Malam 16-24).
  const shift = shiftNameForHour(soldAt.getHours(), await shiftRanges());

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Ambil menu + semua bahan/stok + varian
      const menus = await tx.menuItem.findMany({
        where: { id: { in: items.map((i) => i.id) } },
        include: {
          stocks: true,
          variantGroups: { include: { options: { include: { stocks: true } } } },
        },
      });
      const menuMap = new Map(menus.map((m) => [m.id, m]));

      let gross = 0;
      let costTotal = 0;
      const txItems = [];
      // Akumulasi kebutuhan kemasan
      const packNeed = new Map<string, number>();

      for (const it of items) {
        const m = menuMap.get(it.id);
        const qty = Math.max(1, Math.floor(it.qty));
        if (!m || !m.active) throw new Error("Menu tidak tersedia");

        // Varian terpilih: validasi milik menu ini, hitung tambahan harga.
        const validOptions = new Map(
          m.variantGroups.flatMap((g) => g.options).map((o) => [o.id, o])
        );
        const chosen = (it.optionIds || [])
          .map((oid) => validOptions.get(oid))
          .filter((o): o is NonNullable<typeof o> => !!o);
        const delta = chosen.reduce((s, o) => s + o.priceDelta, 0);
        const unitPrice = m.price + delta;
        const variantLabel = chosen.length ? chosen.map((o) => o.name).join(", ") : null;

        gross += unitPrice * qty;
        costTotal += m.cost * qty;
        txItems.push({
          name: m.name,
          category: m.category,
          price: unitPrice,
          cost: m.cost,
          qty,
          subtotal: unitPrice * qty,
          variants: variantLabel,
          note: it.note ? String(it.note).slice(0, 200) : null,
        });
        // Stok base menu
        for (const s of m.stocks) {
          packNeed.set(s.packagingId, (packNeed.get(s.packagingId) || 0) + s.qty * qty);
        }
        // Stok dari opsi varian terpilih (mis. Dingin → cup plastik)
        for (const o of chosen) {
          for (const os of (o as any).stocks || []) {
            packNeed.set(os.packagingId, (packNeed.get(os.packagingId) || 0) + os.qty * qty);
          }
        }
      }

      // Diskon: dari voucher (dihitung ulang di server) atau diskon manual.
      let discount = 0;
      let voucherName: string | null = null;
      let usedVoucherId: string | null = null;
      if (voucherId) {
        const v = await tx.voucher.findUnique({ where: { id: voucherId } });
        if (!v || !v.active) throw new Error("Voucher tidak aktif");
        const now = new Date();
        if (v.validFrom && now < v.validFrom) throw new Error(`Voucher ${v.name} belum berlaku`);
        if (v.validUntil && now > v.validUntil) throw new Error(`Voucher ${v.name} sudah kadaluarsa`);
        if (v.maxUses != null && v.usedCount >= v.maxUses)
          throw new Error(`Voucher ${v.name} sudah habis kuota`);
        discount = v.type === "PERCENT" ? Math.round((gross * v.value) / 100) : v.value;
        voucherName = v.name;
        usedVoucherId = v.id;
      } else if (manualDiscount > 0) {
        discount = manualDiscount;
        voucherName = "Diskon manual";
      }
      discount = Math.min(Math.max(0, discount), gross);
      const total = gross - discount;

      if (paid < total) throw new Error("Uang bayar kurang");

      const code = "TRX" + Date.now().toString(36).toUpperCase();
      const trx = await tx.transaction.create({
        data: {
          code,
          clientId,
          cashierId: user.id,
          // Dari HP: nama karyawan yang dipilih (bar bawah POS), bukan nama akun.
          cashierName: String(body.cashierName || user.name).slice(0, 60),
          grossTotal: gross,
          discount,
          voucherName,
          voucherId: usedVoucherId,
          total,
          costTotal,
          paid,
          change: paid - total,
          payment,
          orderType,
          note,
          businessDate,
          shift,
          items: { create: txItems },
        },
      });

      // Validasi + potong stok bahan (ditautkan ke transaksi utk pembatalan)
      for (const [packagingId, need] of packNeed) {
        const p = await tx.packaging.findUnique({ where: { id: packagingId } });
        if (!p) continue;
        if (p.stock < need)
          throw new Error(`Stok ${p.name} tidak cukup (butuh ${need}, ada ${p.stock})`);
        const after = p.stock - need;
        await tx.packaging.update({ where: { id: p.id }, data: { stock: after } });
        await tx.stockMovement.create({
          data: {
            packagingId: p.id,
            type: "SALE",
            delta: -need,
            before: p.stock,
            after,
            userName: user.name,
            transactionId: trx.id,
          },
        });
      }

      if (usedVoucherId) {
        await tx.voucher.update({
          where: { id: usedVoucherId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return trx;
    });

    // Auto-ekspor ke Google Sheet (non-blocking; kalau tak dikonfigurasi → no-op).
    appendTransactionToSheet(result.id).catch(() => {});

    return NextResponse.json({ ok: true, code: result.code, id: result.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Gagal menyimpan transaksi" },
      { status: 400 }
    );
  }
}
