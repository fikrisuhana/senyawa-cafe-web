import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { integrationAuth } from "@/lib/integration";
import { syncCatalogToSheet } from "@/lib/gsheet";
import { BAHAN_KEY, MANAGED_KEY, VOUCHER_KEY, applyVouchers, cleanVouchers, exportVouchers, applyMenu, cleanMenu, exportItem, loadMenu, menuManaged, type PackagingIn } from "@/lib/menu-sync";

/**
 * Menu INDUK dari aplikasi timetable (X-Integration-Key, sama dgn /api/integrations/jadwal).
 * GET    → menu outlet ini (nama-based) + daftar bahan/kemasan + status kunci.
 * PUT    { items, packagings, dryRun? } → terapkan menu induk; menu di web kasir jadi TERKUNCI.
 *        dryRun:true = cuma hitung apa yang bakal berubah (tidak menulis apa pun).
 *        packagings[].minStock terisi = data bahan juga diatur pusat (stok tak disentuh).
 * DELETE → lepas kunci menu & bahan (bisa diedit lagi di web kasir).
 */
export async function GET(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [items, packs, managed, vouchers] = await Promise.all([
    loadMenu(),
    prisma.packaging.findMany({ orderBy: { name: "asc" }, select: { name: true, unit: true, buyUnit: true, buyFactor: true, stock: true, minStock: true } }),
    menuManaged(),
    exportVouchers(),
  ]);
  return NextResponse.json({ ok: true, managed, items: items.map(exportItem), packagings: packs, vouchers });
}

export async function PUT(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = await req.json().catch(() => null);
  let items;
  try {
    items = cleanMenu(b?.items);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  // Pengaman: kiriman kosong (bug/timetable belum import) jangan sampai menonaktifkan semua menu.
  if (items.length === 0) return NextResponse.json({ error: "Menu kosong — ditolak" }, { status: 400 });
  const packagings: PackagingIn[] = Array.isArray(b?.packagings)
    ? b.packagings.map((p: Record<string, unknown>) => ({
        name: String(p?.name || "").trim(),
        unit: String(p?.unit || "pcs"),
        buyUnit: p?.buyUnit ? String(p.buyUnit) : null,
        buyFactor: Number(p?.buyFactor) || 1,
        ...(p?.minStock !== undefined ? { minStock: Math.max(0, Math.round(Number(p.minStock) || 0)) } : {}),
      }))
    : [];
  const renames = Array.isArray(b?.renames)
    ? b.renames.map((r: Record<string, unknown>) => ({ from: String(r?.from || "").trim(), to: String(r?.to || "").trim() }))
    : [];
  const dryRun = b?.dryRun === true;
  const stats = await applyMenu(items, packagings, { dryRun, renames });
  // vouchers ada di kiriman (boleh kosong) = voucher diatur pusat.
  const vStats = Array.isArray(b?.vouchers) ? await applyVouchers(cleanVouchers(b.vouchers), { dryRun }) : null;
  if (!dryRun && stats.created || stats.updated || stats.deactivated) void syncCatalogToSheet();
  return NextResponse.json({ ok: true, dryRun, ...stats, ...(vStats || {}) });
}

export async function DELETE(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  await prisma.setting.deleteMany({ where: { key: { in: [MANAGED_KEY, BAHAN_KEY, VOUCHER_KEY] } } });
  return NextResponse.json({ ok: true });
}
