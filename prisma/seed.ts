import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Hanya isi data CONTOH pada instalasi baru. Kalau DB sudah ada isinya,
  // JANGAN tambah menu/stok/karyawan/voucher contoh (biar data asli tak terganggu).
  const firstRun = (await prisma.user.count()) === 0;

  // --- Users default (selalu dipastikan ada supaya bisa login) ---
  // Password bisa di-override lewat ENV untuk deploy publik (jangan pakai default!).
  const users: Array<[string, string, string, "ADMIN" | "KASIR"]> = [
    ["admin", "Pemilik Cafe", process.env.ADMIN_PASSWORD || "admin123", "ADMIN"],
    ["kasir", "Kasir Cafe", process.env.KASIR_PASSWORD || "kasir123", "KASIR"],
  ];
  for (const [username, name, pass, role] of users) {
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, name, password: await bcrypt.hash(pass, 10), role },
    });
  }

  // --- Pengaturan default ---
  const defaults: Record<string, string> = {
    storeName: "Cafe Kita",
    logoEmoji: "☕",
    logoImage: "",
    openHour: "7",
    closeHour: "3",
    dayCutoffHour: "6",
    receiptHeader: "Jl. Contoh No. 1\nIG: @cafekita",
    receiptFooter: "Terima kasih! Sampai jumpa lagi :)",
    quickCash: "pas,20000,50000,100000",
    paperWidth: "58",
    shifts: "Sore,Malam",
    kasAwal: "250000",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  if (!firstRun) {
    console.log("DB sudah ada isi — lewati data contoh (menu/stok/karyawan/voucher aman).");
    return;
  }

  // --- Stok / bahan (hanya instalasi baru) ---
  const packs: Array<[string, string, number, number]> = [
    ["Cup Plastik 16oz", "pcs", 500, 50],
    ["Cup Panas 8oz", "pcs", 300, 50],
    ["Wadah Makan", "pcs", 200, 30],
    ["Mie (porsi)", "porsi", 100, 20],
  ];
  const packMap: Record<string, string> = {};
  for (const [name, unit, stock, minStock] of packs) {
    const p = await prisma.packaging.upsert({
      where: { name },
      update: {},
      create: { name, unit, stock, minStock },
    });
    packMap[name] = p.id;
  }

  // --- Menu contoh: [nama, kategori, harga, modal, [ [bahan, qty], ... ]] ---
  const menus: Array<[string, string, number, number, Array<[string, number]>]> = [
    ["Kopi Susu", "KOPI", 18000, 7000, [["Cup Plastik 16oz", 1]]],
    ["Espresso", "KOPI", 15000, 5000, [["Cup Panas 8oz", 1]]],
    ["Americano", "KOPI", 16000, 5000, [["Cup Panas 8oz", 1]]],
    ["Matcha Latte", "NON-KOPI", 20000, 8000, [["Cup Plastik 16oz", 1]]],
    ["Teh Manis", "NON-KOPI", 8000, 2000, [["Cup Plastik 16oz", 1]]],
    ["Nasi Goreng", "MAKANAN", 22000, 10000, [["Wadah Makan", 1]]],
    ["Mie Goreng", "MAKANAN", 20000, 9000, [["Mie (porsi)", 1], ["Wadah Makan", 1]]],
    ["Kentang Goreng", "MAKANAN", 15000, 6000, [["Wadah Makan", 1]]],
  ];
  let order = 0;
  for (const [name, category, price, cost, stocks] of menus) {
    const m = await prisma.menuItem.upsert({
      where: { name },
      update: {},
      create: { name, category, price, cost, sortOrder: order++ },
    });
    for (const [packName, qty] of stocks) {
      const packagingId = packMap[packName];
      if (!packagingId) continue;
      await prisma.menuStock.upsert({
        where: { menuItemId_packagingId: { menuItemId: m.id, packagingId } },
        update: {},
        create: { menuItemId: m.id, packagingId, qty },
      });
    }
  }

  // --- Karyawan contoh (untuk absensi) ---
  for (const name of ["Andi", "Budi", "Citra"]) {
    await prisma.employee.upsert({ where: { name }, update: {}, create: { name } });
  }

  // --- Voucher contoh ---
  const vouchers: Array<[string, string, number]> = [
    ["Owner Gratis", "PERCENT", 100],
    ["Diskon 10%", "PERCENT", 10],
    ["Potongan 5rb", "NOMINAL", 5000],
  ];
  for (const [name, type, value] of vouchers) {
    await prisma.voucher.upsert({ where: { name }, update: {}, create: { name, type, value } });
  }

  console.log("Seed selesai. Login admin/admin123 (pemilik), kasir/kasir123.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
