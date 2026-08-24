import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { syncCatalogToSheet, syncOpsToSheet } from "@/lib/gsheet";
import { getSession } from "@/lib/auth";

// GET: unduh template Excel (nama, satuan, stok, stok_min)
export async function GET() {
  const packs = await prisma.packaging.findMany({ orderBy: { name: "asc" } });
  const data = [
    ["nama", "satuan", "stok", "stok_min"],
    ...(packs.length
      ? packs.map((p) => [p.name, p.unit, p.stock, p.minStock])
      : [
          ["Cup Plastik 16oz", "pcs", 500, 50],
          ["Wadah Makan", "pcs", 200, 30],
        ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stok Kemasan");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-stok-kemasan.xlsx"',
    },
  });
}

// POST: import file (.xlsx/.csv). Kolom fleksibel: nama|name, satuan|unit, stok|stock, stok_min|minstock
export async function POST(req: Request) {
  const user = await getSession();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string")
    return NextResponse.json({ error: "File tidak ada" }, { status: 400 });

  const buf = Buffer.from(await (file as File).arrayBuffer());
  let rows: any[];
  try {
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  } catch {
    return NextResponse.json({ error: "File tidak bisa dibaca" }, { status: 400 });
  }

  const pick = (r: any, keys: string[]) => {
    for (const k of Object.keys(r)) {
      if (keys.includes(k.toLowerCase().trim())) return r[k];
    }
    return undefined;
  };

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const name = String(pick(r, ["nama", "name"]) ?? "").trim();
    if (!name) continue;
    const unit = String(pick(r, ["satuan", "unit"]) ?? "pcs").trim() || "pcs";
    const stokRaw = pick(r, ["stok", "stock"]);
    const minRaw = pick(r, ["stok_min", "stok min", "minstock", "min"]);
    const stock = Math.max(0, Math.round(Number(stokRaw) || 0));
    const minStock = Math.max(0, Math.round(Number(minRaw) || 0));

    try {
      const existing = await prisma.packaging.findUnique({ where: { name } });
      if (existing) {
        await prisma.$transaction([
          prisma.packaging.update({
            where: { id: existing.id },
            data: { unit, stock, minStock },
          }),
          prisma.stockMovement.create({
            data: {
              packagingId: existing.id,
              type: "IMPORT",
              delta: stock - existing.stock,
              before: existing.stock,
              after: stock,
              note: "Import Excel",
              userName: user?.name || null,
            },
          }),
        ]);
        updated++;
      } else {
        const p = await prisma.packaging.create({
          data: { name, unit, stock, minStock },
        });
        await prisma.stockMovement.create({
          data: {
            packagingId: p.id,
            type: "IMPORT",
            delta: stock,
            before: 0,
            after: stock,
            note: "Import Excel (baru)",
            userName: user?.name || null,
          },
        });
        created++;
      }
    } catch {
      errors.push(name);
    }
  }

  void syncCatalogToSheet();
  return NextResponse.json({ ok: true, created, updated, errors });
}
