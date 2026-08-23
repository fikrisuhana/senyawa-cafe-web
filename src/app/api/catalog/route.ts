import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";

/**
 * Katalog lengkap untuk aplikasi HP (pull saat buka / berkala).
 * Semua entitas membawa `id` server supaya HP menyimpannya dan mengirim
 * transaksi dengan id menu & opsi varian yang benar.
 */
export async function GET(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const [menus, vouchers, packaging, employees, settings] = await Promise.all([
    prisma.menuItem.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        stocks: { select: { packagingId: true, qty: true } },
        variantGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            options: {
              orderBy: { sortOrder: "asc" },
              include: { stocks: { select: { packagingId: true, qty: true } } },
            },
          },
        },
      },
    }),
    prisma.voucher.findMany({ orderBy: { name: "asc" } }),
    prisma.packaging.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.setting.findMany(),
  ]);

  return NextResponse.json({
    ok: true,
    serverTime: new Date().toISOString(),
    menus,
    vouchers,
    packaging,
    employees,
    settings,
  });
}
