import { NextResponse } from "next/server";
import { syncOpsToSheet } from "@/lib/gsheet";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { businessDateKey } from "@/lib/bizday";

// Presence-only: klik shift = tandai masuk. Klik lagi = batal. Tanpa jam pulang.
// Body: { employeeId, shift, present?, businessDate? }.
// `present` (dari HP, antre offline): set state final — true=hadir, false=batal.
// Tanpa `present` (dari web UI): toggle.
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { employeeId, shift, present, businessDate } = await req.json().catch(() => ({}));
  if (!employeeId) return NextResponse.json({ error: "Pilih karyawan" }, { status: 400 });

  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

  const settings = await getSettings();
  // HP boleh kirim hari-usaha sendiri (replay antre offline di hari berikutnya).
  const bDate =
    typeof businessDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(businessDate)
      ? businessDate
      : businessDateKey(new Date(), settings.dayCutoffHour);
  const shiftVal = shift ? String(shift) : null;

  const existing = await prisma.attendance.findFirst({
    where: { employeeId, businessDate: bDate, shift: shiftVal },
  });

  // Hasil akhir: present eksplisit (HP) atau toggle (web).
  const shouldPresent = typeof present === "boolean" ? present : !existing;

  if (!shouldPresent) {
    if (existing) await prisma.attendance.delete({ where: { id: existing.id } });
    void syncOpsToSheet();
    return NextResponse.json({ ok: true, present: false });
  }
  if (!existing) {
    await prisma.attendance.create({
      data: {
        employeeId: emp.id,
        employeeName: emp.name,
        businessDate: bDate,
        shift: shiftVal,
        recordedBy: user.name,
      },
    });
  }
  void syncOpsToSheet(); // mirror ke Google Sheet (fire-and-forget)
  return NextResponse.json({ ok: true, present: true });
}
