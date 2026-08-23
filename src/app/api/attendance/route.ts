import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { businessDateKey } from "@/lib/bizday";

// Presence-only: klik shift = tandai masuk. Klik lagi = batal. Tanpa jam pulang.
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { employeeId, shift } = await req.json().catch(() => ({}));
  if (!employeeId) return NextResponse.json({ error: "Pilih karyawan" }, { status: 400 });

  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

  const settings = await getSettings();
  const businessDate = businessDateKey(new Date(), settings.dayCutoffHour);
  const shiftVal = shift ? String(shift) : null;

  // Toggle: hapus kalau sudah ada, buat kalau belum.
  const existing = await prisma.attendance.findFirst({
    where: { employeeId, businessDate, shift: shiftVal },
  });
  if (existing) {
    await prisma.attendance.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, present: false });
  }
  await prisma.attendance.create({
    data: {
      employeeId: emp.id,
      employeeName: emp.name,
      businessDate,
      shift: shiftVal,
      recordedBy: user.name,
    },
  });
  return NextResponse.json({ ok: true, present: true });
}
