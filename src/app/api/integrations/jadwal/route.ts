import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { integrationAuth } from "@/lib/integration";
import { getSettings, parseShifts } from "@/lib/settings";

/**
 * Jalur data untuk aplikasi JADWAL karyawan (lintas outlet). Dikunci
 * X-Integration-Key (bukan login). Middleware melewatkan /api/integrations/*.
 *
 * GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD → karyawan + absensi (hari usaha) + nama shift outlet ini.
 * POST { employees: [{ name, active }] } → upsert karyawan (induk = aplikasi jadwal).
 *      Karyawan TIDAK pernah dihapus (riwayat absen aman) — cuma diaktif/nonaktifkan.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to))
    return NextResponse.json({ error: "from/to wajib format YYYY-MM-DD" }, { status: 400 });

  const [employees, attendances, settings] = await Promise.all([
    prisma.employee.findMany({ orderBy: { name: "asc" }, select: { name: true, active: true } }),
    prisma.attendance.findMany({
      where: { businessDate: { gte: from, lte: to } },
      orderBy: { clockIn: "asc" },
      select: { employeeName: true, businessDate: true, shift: true, clockIn: true },
    }),
    getSettings(),
  ]);
  return NextResponse.json({
    ok: true,
    storeName: settings.storeName,
    shifts: parseShifts(settings.shifts),
    shiftHours: settings.shiftHours,
    employees,
    attendances: attendances.map((a) => ({ ...a, clockIn: a.clockIn.toISOString() })),
  });
}

export async function POST(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = await req.json().catch(() => ({}));
  const list: { name: string; active: boolean }[] = (Array.isArray(b.employees) ? b.employees : [])
    .map((e: any) => ({ name: String(e?.name || "").trim().slice(0, 60), active: e?.active !== false }))
    .filter((e: { name: string }) => e.name);
  if (list.length > 300) return NextResponse.json({ error: "Maks 300 karyawan per kirim" }, { status: 400 });

  let created = 0;
  let updated = 0;
  for (const e of list) {
    const cur = await prisma.employee.findUnique({ where: { name: e.name } });
    if (!cur) {
      await prisma.employee.create({ data: { name: e.name, active: e.active } });
      created++;
    } else if (cur.active !== e.active) {
      await prisma.employee.update({ where: { id: cur.id }, data: { active: e.active } });
      updated++;
    }
  }
  return NextResponse.json({ ok: true, created, updated });
}
