import { prisma } from "./db";
import { autoBuyFactor } from "./units";

/**
 * Menu INDUK dari aplikasi timetable (jadwal) — dikirim lewat /api/integrations/menu.
 * Semua dicocokkan lewat NAMA (MenuItem.name & Packaging.name unik), jadi id lokal
 * tiap outlet tak perlu sama. Stok tetap milik outlet: bahan yang belum ada dibuat
 * dengan stok 0, bahan yang sudah ada TIDAK diubah.
 */
export type StockRef = { packaging: string; qty: number };
export type MenuOptionIn = { name: string; priceDelta: number; stocks: StockRef[] };
export type MenuGroupIn = { name: string; type: "SINGLE" | "MULTI"; required: boolean; options: MenuOptionIn[] };
export type MenuItemIn = {
  name: string;
  category: string;
  price: number;
  cost: number;
  sortOrder: number;
  active: boolean;
  stocks: StockRef[];
  variants: MenuGroupIn[];
};
/** minStock terisi = data bahan DIATUR PUSAT (satuan/satuan beli/min stok ikut diperbarui; stok tidak). */
export type PackagingIn = { name: string; unit: string; buyUnit: string | null; buyFactor: number; minStock?: number };
export type RenameIn = { from: string; to: string };

export const MANAGED_KEY = "menuManagedBy";
export const BAHAN_KEY = "bahanManagedBy";
export const VOUCHER_KEY = "voucherManagedBy";

/** Voucher outlet ini diatur dari timetable? */
export async function voucherManaged(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: VOUCHER_KEY } });
  return !!s?.value;
}
export const VOUCHER_LOCKED_MSG = "Voucher diatur dari aplikasi timetable (pusat) — buat/ubah voucher di sana.";

export type VoucherIn = {
  name: string;
  type: "PERCENT" | "NOMINAL";
  value: number;
  active: boolean;
  maxUses: number | null;
  validFrom: string | null; // YYYY-MM-DD
  validUntil: string | null;
};

export function cleanVouchers(raw: unknown): VoucherIn[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: VoucherIn[] = [];
  const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  for (const r of raw as Record<string, unknown>[]) {
    const name = String(r?.name ?? "").trim().slice(0, 60);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const type = r.type === "NOMINAL" ? "NOMINAL" : "PERCENT";
    let value = Math.round(Number(r.value) || 0);
    value = type === "PERCENT" ? Math.min(100, Math.max(0, value)) : Math.max(0, value);
    const mu = Number(r.maxUses);
    out.push({
      name,
      type,
      value,
      active: r.active !== false,
      maxUses: Number.isFinite(mu) && mu > 0 ? Math.round(mu) : null,
      validFrom: day(r.validFrom),
      validUntil: day(r.validUntil),
    });
  }
  return out;
}

const dayOf = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;

/**
 * Terapkan voucher pusat (cocok lewat NAMA). Pemakaian (usedCount) tetap milik outlet.
 * Voucher lokal yang tak ada di pusat → dinonaktifkan (riwayat transaksi aman).
 */
export async function applyVouchers(list: VoucherIn[], opts: { dryRun?: boolean } = {}) {
  const stats = { voucherCreated: 0, voucherUpdated: 0, voucherDeactivated: 0 };
  const cur = await prisma.voucher.findMany();
  const byName = new Map(cur.map((v) => [v.name, v]));
  const want = new Set(list.map((v) => v.name));
  const writes: (() => Promise<unknown>)[] = [];
  for (const v of list) {
    const data = {
      type: v.type,
      value: v.value,
      active: v.active,
      maxUses: v.maxUses,
      validFrom: v.validFrom ? new Date(v.validFrom + "T00:00:00") : null,
      validUntil: v.validUntil ? new Date(v.validUntil + "T23:59:59") : null,
    };
    const c = byName.get(v.name);
    if (!c) {
      stats.voucherCreated++;
      writes.push(() => prisma.voucher.create({ data: { name: v.name, ...data } }));
    } else if (
      c.type !== v.type ||
      c.value !== v.value ||
      c.active !== v.active ||
      (c.maxUses ?? null) !== v.maxUses ||
      dayOf(c.validFrom) !== v.validFrom ||
      dayOf(c.validUntil) !== v.validUntil
    ) {
      stats.voucherUpdated++;
      writes.push(() => prisma.voucher.update({ where: { id: c.id }, data }));
    }
  }
  const extra = cur.filter((c) => !want.has(c.name) && c.active).map((c) => c.id);
  stats.voucherDeactivated = extra.length;
  if (opts.dryRun) return stats;
  for (const w of writes) await w();
  if (extra.length) await prisma.voucher.updateMany({ where: { id: { in: extra } }, data: { active: false } });
  await prisma.setting.upsert({ where: { key: VOUCHER_KEY }, create: { key: VOUCHER_KEY, value: "timetable" }, update: { value: "timetable" } });
  return stats;
}

export async function exportVouchers() {
  const rows = await prisma.voucher.findMany({ orderBy: { name: "asc" } });
  return rows.map((v) => ({
    name: v.name,
    type: v.type,
    value: v.value,
    active: v.active,
    maxUses: v.maxUses,
    usedCount: v.usedCount,
    validFrom: dayOf(v.validFrom),
    validUntil: dayOf(v.validUntil),
  }));
}

/** Data bahan outlet ini dikunci (diatur dari timetable)? Stok tetap boleh diubah di kasir. */
export async function bahanManaged(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: BAHAN_KEY } });
  return !!s?.value;
}
export const BAHAN_LOCKED_MSG =
  "Data bahan diatur dari aplikasi timetable (pusat) — tambah/ubah bahan di sana. Stok tetap bisa diubah di sini.";

/** Menu outlet ini dikunci (diatur dari timetable)? */
export async function menuManaged(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: MANAGED_KEY } });
  return !!s?.value;
}

export const LOCKED_MSG = "Menu diatur dari aplikasi timetable (pusat) — ubah di sana.";

const int = (v: unknown, min = 0) => Math.max(min, Math.round(Number(v) || 0));
const str = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

function cleanStocks(raw: unknown): StockRef[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: StockRef[] = [];
  for (const s of raw) {
    const packaging = str((s as StockRef)?.packaging);
    if (!packaging || seen.has(packaging)) continue;
    seen.add(packaging);
    out.push({ packaging, qty: int((s as StockRef)?.qty, 1) });
  }
  return out.sort((a, b) => a.packaging.localeCompare(b.packaging));
}

export function cleanMenu(raw: unknown): MenuItemIn[] {
  if (!Array.isArray(raw)) throw new Error("items wajib array");
  const seen = new Set<string>();
  const out: MenuItemIn[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const name = str(r?.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      category: (str(r.category, 40) || "LAINNYA").toUpperCase(),
      price: int(r.price),
      cost: int(r.cost),
      sortOrder: int(r.sortOrder),
      active: r.active !== false,
      stocks: cleanStocks(r.stocks),
      variants: (Array.isArray(r.variants) ? (r.variants as Record<string, unknown>[]) : [])
        .map((g) => ({
          name: str(g?.name, 60),
          type: (g?.type === "MULTI" ? "MULTI" : "SINGLE") as "SINGLE" | "MULTI",
          required: g?.required === true,
          options: (Array.isArray(g?.options) ? (g.options as Record<string, unknown>[]) : [])
            .map((o) => ({ name: str(o?.name, 60), priceDelta: Math.round(Number(o?.priceDelta) || 0), stocks: cleanStocks(o?.stocks) }))
            .filter((o) => o.name),
        }))
        .filter((g) => g.name),
    });
  }
  return out;
}

type DbItem = Awaited<ReturnType<typeof loadMenu>>[number];

export async function loadMenu() {
  return prisma.menuItem.findMany({
    include: {
      stocks: { include: { packaging: true } },
      variantGroups: { include: { options: { include: { stocks: { include: { packaging: true } } } } } },
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Bentuk menu lokal → format pertukaran (pakai nama, tanpa id). */
export function exportItem(m: DbItem): MenuItemIn {
  const stocks = (list: { qty: number; packaging: { name: string } }[]) =>
    list.map((s) => ({ packaging: s.packaging.name, qty: s.qty })).sort((a, b) => a.packaging.localeCompare(b.packaging));
  return {
    name: m.name,
    category: m.category,
    price: m.price,
    cost: m.cost,
    sortOrder: m.sortOrder,
    active: m.active,
    stocks: stocks(m.stocks),
    variants: [...m.variantGroups]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => ({
        name: g.name,
        type: (g.type === "MULTI" ? "MULTI" : "SINGLE") as "SINGLE" | "MULTI",
        required: g.required,
        options: [...g.options].sort((a, b) => a.sortOrder - b.sortOrder).map((o) => ({ name: o.name, priceDelta: o.priceDelta, stocks: stocks(o.stocks) })),
      })),
  };
}

/**
 * Terapkan menu induk ke outlet ini. Yang tak berubah TIDAK disentuh (updatedAt tetap).
 * Menu lokal yang tak ada di kiriman → dinonaktifkan (tidak dihapus).
 */
class DryRun extends Error {}

export async function applyMenu(
  items: MenuItemIn[],
  packagings: PackagingIn[],
  opts: { dryRun?: boolean; renames?: RenameIn[] } = {},
) {
  const stats = {
    created: 0,
    updated: 0,
    unchanged: 0,
    deactivated: 0,
    packagingCreated: 0,
    packagingUpdated: 0,
    packagingRenamed: 0,
    changedNames: [] as string[],
  };
  try {
  await prisma.$transaction(
    async (tx) => {
      // 1) Bahan/kemasan yang dipakai resep tapi belum ada di outlet → buat (stok 0).
      const needed = new Set<string>();
      for (const it of items) {
        it.stocks.forEach((s) => needed.add(s.packaging));
        it.variants.forEach((g) => g.options.forEach((o) => o.stocks.forEach((s) => needed.add(s.packaging))));
      }
      // 0) Bahan yang diganti namanya di pusat (stok & resep ikut, karena id-nya sama).
      for (const r of opts.renames || []) {
        if (!r.from || !r.to || r.from === r.to) continue;
        const from = await tx.packaging.findUnique({ where: { name: r.from } });
        const to = await tx.packaging.findUnique({ where: { name: r.to } });
        if (from && !to) {
          await tx.packaging.update({ where: { id: from.id }, data: { name: r.to } });
          stats.packagingRenamed++;
        }
      }
      const existing = await tx.packaging.findMany({
        select: { id: true, name: true, unit: true, buyUnit: true, buyFactor: true, minStock: true },
      });
      const packId = new Map(existing.map((p) => [p.name, p.id]));
      const defs = new Map(packagings.map((p) => [p.name, p]));
      // Data bahan diatur pusat → semua bahan pusat dibuat/diperbarui (STOK tak pernah disentuh).
      const managedBahan = packagings.length > 0 && packagings.every((p) => typeof p.minStock === "number");
      if (managedBahan) {
        const cur = new Map(existing.map((p) => [p.name, p]));
        for (const d of packagings) {
          const unit = d.unit || "pcs";
          const buyUnit = d.buyUnit || null;
          const buyFactor = autoBuyFactor(unit, buyUnit) ?? Math.max(1, d.buyFactor || 1);
          const minStock = Math.max(0, Math.round(d.minStock || 0));
          const c = cur.get(d.name);
          if (!c) {
            const p = await tx.packaging.create({ data: { name: d.name, unit, buyUnit, buyFactor, minStock } });
            packId.set(d.name, p.id);
            stats.packagingCreated++;
          } else if (c.unit !== unit || c.buyUnit !== buyUnit || c.buyFactor !== buyFactor || c.minStock !== minStock) {
            await tx.packaging.update({ where: { id: c.id }, data: { unit, buyUnit, buyFactor, minStock } });
            stats.packagingUpdated++;
          }
        }
      }
      for (const name of needed) {
        if (packId.has(name)) continue;
        const d = defs.get(name);
        const p = await tx.packaging.create({
          data: { name, unit: d?.unit || "pcs", buyUnit: d?.buyUnit || null, buyFactor: Math.max(1, d?.buyFactor || 1) },
        });
        packId.set(name, p.id);
        stats.packagingCreated++;
      }

      // 2) Menu: bandingkan dengan yang ada, tulis hanya yang beda.
      const current = await tx.menuItem.findMany({
        include: {
          stocks: { include: { packaging: true } },
          variantGroups: { include: { options: { include: { stocks: { include: { packaging: true } } } } } },
        },
      });
      const byName = new Map(current.map((m) => [m.name, m]));
      const want = new Set(items.map((i) => i.name));

      for (const it of items) {
        const cur = byName.get(it.name);
        const stockRows = (list: StockRef[]) => list.map((s) => ({ packagingId: packId.get(s.packaging)!, qty: s.qty }));
        if (!cur) {
          await tx.menuItem.create({
            data: {
              name: it.name,
              category: it.category,
              price: it.price,
              cost: it.cost,
              sortOrder: it.sortOrder,
              active: it.active,
              stocks: { create: stockRows(it.stocks) },
              variantGroups: {
                create: it.variants.map((g, gi) => ({
                  name: g.name,
                  type: g.type,
                  required: g.required,
                  sortOrder: gi,
                  options: { create: g.options.map((o, oi) => ({ name: o.name, priceDelta: o.priceDelta, sortOrder: oi, stocks: { create: stockRows(o.stocks) } })) },
                })),
              },
            },
          });
          stats.created++;
          stats.changedNames.push(it.name);
          continue;
        }
        const ex = exportItem(cur as DbItem);
        const baseSame =
          ex.category === it.category && ex.price === it.price && ex.cost === it.cost && ex.sortOrder === it.sortOrder && ex.active === it.active;
        const stocksSame = JSON.stringify(ex.stocks) === JSON.stringify(it.stocks);
        const variantsSame = JSON.stringify(ex.variants) === JSON.stringify(it.variants);
        if (baseSame && stocksSame && variantsSame) {
          stats.unchanged++;
          continue;
        }
        await tx.menuItem.update({
          where: { id: cur.id },
          data: { category: it.category, price: it.price, cost: it.cost, sortOrder: it.sortOrder, active: it.active },
        });
        if (!stocksSame) {
          await tx.menuStock.deleteMany({ where: { menuItemId: cur.id } });
          await tx.menuStock.createMany({ data: stockRows(it.stocks).map((s) => ({ ...s, menuItemId: cur.id })) });
        }
        if (!variantsSame) {
          await tx.variantGroup.deleteMany({ where: { menuItemId: cur.id } });
          for (const [gi, g] of it.variants.entries()) {
            await tx.variantGroup.create({
              data: {
                menuItemId: cur.id,
                name: g.name,
                type: g.type,
                required: g.required,
                sortOrder: gi,
                options: { create: g.options.map((o, oi) => ({ name: o.name, priceDelta: o.priceDelta, sortOrder: oi, stocks: { create: stockRows(o.stocks) } })) },
              },
            });
          }
        }
        stats.updated++;
        stats.changedNames.push(it.name);
      }

      // 3) Menu lokal yang tak ada di induk → nonaktif (riwayat transaksi aman).
      const extra = current.filter((m) => !want.has(m.name) && m.active).map((m) => m.id);
      if (extra.length) {
        await tx.menuItem.updateMany({ where: { id: { in: extra } }, data: { active: false } });
        stats.deactivated = extra.length;
      }

      // Uji coba: hitung saja, semua tulisan di atas dibatalkan (rollback).
      if (opts.dryRun) throw new DryRun();
      if (managedBahan)
        await tx.setting.upsert({
          where: { key: BAHAN_KEY },
          create: { key: BAHAN_KEY, value: "timetable" },
          update: { value: "timetable" },
        });
      await tx.setting.upsert({
        where: { key: MANAGED_KEY },
        create: { key: MANAGED_KEY, value: "timetable" },
        update: { value: "timetable" },
      });
    },
    { timeout: 60_000 },
  );
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
  }
  return stats;
}
