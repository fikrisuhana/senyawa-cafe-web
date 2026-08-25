import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncCatalogToSheet, syncOpsToSheet } from "@/lib/gsheet";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.name) return NextResponse.json({ error: "Nama wajib" }, { status: 400 });
  try {
    const e = await prisma.employee.create({ data: { name: String(b.name).trim() } });
    return NextResponse.json({ ok: true, id: e.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.code === "P2002" ? "Nama karyawan sudah ada" : "Gagal" },
      { status: 400 }
    );
  }
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const data: any = {};
  if (typeof b.name === "string") data.name = b.name.trim();
  if (typeof b.active === "boolean") data.active = b.active;
  await prisma.employee.update({ where: { id: b.id }, data });

  // Nama tersalin (denormalized) di riwayat absensi — ikutkan rename supaya
  // matriks absen/Jadwal tidak menampilkan nama lama.
  if (data.name) {
    await prisma.attendance.updateMany({
      where: { employeeId: b.id },
      data: { employeeName: data.name },
    });
  }
  void syncCatalogToSheet(); // mirror katalog ke Sheet (fire-and-forget)
  void syncOpsToSheet(); // absensi & jadwal di Sheet ikut nama baru
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const count = await prisma.attendance.count({ where: { employeeId: id } });
  if (count > 0)
    return NextResponse.json(
      { error: "Karyawan punya riwayat absensi — nonaktifkan saja" },
      { status: 400 }
    );
  await prisma.employee.delete({ where: { id } });
  void syncCatalogToSheet(); // mirror katalog ke Sheet (fire-and-forget)
  return NextResponse.json({ ok: true });
}
