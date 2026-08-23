import { prisma } from "@/lib/db";
import { getSettings, parseShifts } from "@/lib/settings";
import { labelHari } from "@/lib/bizday";
import { resolvePeriod } from "@/lib/period";
import PeriodFilter from "@/components/PeriodFilter";
import EmployeeManager, { type EmpRow } from "@/components/EmployeeManager";
import DeleteAttendance from "@/components/DeleteAttendance";

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Absensi Karyawan</h1>
          <p className="text-xs text-slate-500">{period.label}</p>
        </div>
        <PeriodFilter mode={period.mode} date={period.date} month={period.month} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="card overflow-x-auto !p-0">
            <div className="p-3 text-sm font-bold">
              Siapa masuk shift apa
              {period.mode === "bulan" && (
                <span className="ml-1 text-xs font-normal text-slate-400">— angka = berapa kali</span>
              )}
            </div>
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Karyawan</th>
                  {cols.map((c) => (
                    <th key={c} className="th text-center">
                      {c}
                    </th>
                  ))}
                  <th className="th text-right">Total masuk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...matrix.entries()].map(([name, c]) => (
                  <tr key={name} className="hover:bg-slate-50">
                    <td className="td font-medium">{name}</td>
                    {cols.map((col) => (
                      <td key={col} className="td text-center">
                        {c.shifts[col] ? (
                          period.mode === "bulan" ? (
                            <span className="font-semibold text-brand-700">{c.shifts[col]}×</span>
                          ) : (
                            <span className="text-lg text-emerald-600">✓</span>
                          )
                        ) : (
                          <span className="text-slate-300">·</span>
                        )}
                      </td>
                    ))}
                    <td className="td text-right font-semibold">{c.total}×</td>
                  </tr>
                ))}
                {matrix.size === 0 && (
                  <tr>
                    <td className="td text-slate-500" colSpan={cols.length + 2}>
                      Belum ada karyawan/absensi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Rincian ringkas (tanpa jam) + koreksi */}
          <div className="card overflow-x-auto !p-0">
            <div className="p-3 text-sm font-bold">Rincian</div>
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Hari</th>
                  <th className="th">Nama</th>
                  <th className="th">Shift</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td whitespace-nowrap">{labelHari(r.businessDate)}</td>
                    <td className="td font-medium">{r.employeeName}</td>
                    <td className="td">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                        {r.shift || "Masuk"}
                      </span>
                    </td>
                    <td className="td text-right">
                      <DeleteAttendance id={r.id} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="td text-slate-500" colSpan={4}>
                      Tidak ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <EmployeeManager rows={empRows} />
      </div>
    </div>
  );
}
