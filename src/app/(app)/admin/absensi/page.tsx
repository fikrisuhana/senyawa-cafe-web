import { prisma } from "@/lib/db";
import { getSettings, parseShifts } from "@/lib/settings";
import { labelHari } from "@/lib/bizday";
import { resolvePeriod } from "@/lib/period";
import PeriodFilter from "@/components/PeriodFilter";
import EmployeeManager, { type EmpRow } from "@/components/EmployeeManager";
import DeleteAttendance from "@/components/DeleteAttendance";
import { UserCheck, CalendarCheck, CheckCircle2, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AbsensiAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; month?: string }>;
}) {
  const settings = await getSettings();
  const sp = await searchParams;
  const period = resolvePeriod(sp, settings.dayCutoffHour);
  const shifts = parseShifts(settings.shifts);
  const cols = shifts.length ? shifts : ["Masuk"];

  const [rows, employees] = await Promise.all([
    prisma.attendance.findMany({
      where: { businessDate: period.filter },
      orderBy: [{ businessDate: "desc" }, { employeeName: "asc" }],
    }),
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Matriks karyawan × shift → jumlah masuk
  type Cell = { shifts: Record<string, number>; total: number };
  const matrix = new Map<string, Cell>();
  const ensure = (name: string) =>
    matrix.get(name) ?? matrix.set(name, { shifts: {}, total: 0 }).get(name)!;
  for (const e of employees) if (e.active) ensure(e.name);
  for (const r of rows) {
    const c = ensure(r.employeeName);
    const key = r.shift || "Masuk";
    c.shifts[key] = (c.shifts[key] || 0) + 1;
    c.total += 1;
  }

  const empRows: EmpRow[] = employees.map((e) => ({ id: e.id, name: e.name, active: e.active }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Rekap Absensi &amp; Kehadiran Tim</h2>
            <p className="text-xs text-slate-500">Laporan periode: <strong className="text-slate-700">{period.label}</strong></p>
          </div>
        </div>
        <PeriodFilter mode={period.mode} date={period.date} month={period.month} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Matriks Shift Kehadiran (ala app-monitoring table) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Matriks Kehadiran Shift Karyawan</h3>
                {period.mode === "bulan" && (
                  <p className="text-[11px] text-slate-400">Angka menunjukkan frekuensi masuk shift dalam bulan terpilih</p>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nama Karyawan</th>
                    {cols.map((c) => (
                      <th key={c} className="py-3 px-4 text-center">
                        Shift {c}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right">Total Masuk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {[...matrix.entries()].map(([name, c]) => (
                    <tr key={name} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{name}</td>
                      {cols.map((col) => (
                        <td key={col} className="py-3 px-4 text-center">
                          {c.shifts[col] ? (
                            period.mode === "bulan" ? (
                              <span className="pill-blue font-bold">{c.shifts[col]}×</span>
                            ) : (
                              <span className="pill-green">✓ Masuk</span>
                            )
                          ) : (
                            <span className="text-slate-300 font-mono">—</span>
                          )}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {c.total} kali
                      </td>
                    </tr>
                  ))}
                  {matrix.size === 0 && (
                    <tr>
                      <td className="py-8 text-center text-slate-400" colSpan={cols.length + 2}>
                        Belum ada catatan absensi pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rincian Log Absen */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Log Riwayat Absensi Lengkap</h3>
              <span className="text-xs text-slate-500">{rows.length} catatan kehadiran</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Hari / Tanggal</th>
                    <th className="py-3 px-4">Nama Karyawan</th>
                    <th className="py-3 px-4">Shift Masuk</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{labelHari(r.businessDate)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{r.employeeName}</td>
                      <td className="py-3 px-4">
                        <span className="pill-slate">{r.shift || "Masuk"}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DeleteAttendance id={r.id} />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="py-8 text-center text-slate-400" colSpan={4}>
                        Tidak ada log absensi pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Form Kelola Karyawan */}
        <EmployeeManager rows={empRows} />
      </div>
    </div>
  );
}
