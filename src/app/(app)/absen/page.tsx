import { prisma } from "@/lib/db";
import { getSettings, parseShifts } from "@/lib/settings";
import { todayKey, labelHari } from "@/lib/bizday";
import AbsenClient, { type EmpRow } from "@/components/AbsenClient";
import { UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AbsenPage() {
  const settings = await getSettings();
  const today = todayKey(settings.dayCutoffHour);
  const shifts = parseShifts(settings.shifts);

  const employees = await prisma.employee.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  const todayRecs = await prisma.attendance.findMany({ where: { businessDate: today } });
  // employeeId -> daftar shift yang sudah ditandai
  const present = new Map<string, string[]>();
  for (const r of todayRecs) {
    const arr = present.get(r.employeeId) || [];
    arr.push(r.shift || "—");
    present.set(r.employeeId, arr);
  }

  const list: EmpRow[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    shifts: present.get(e.id) || [],
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
          <UserCheck className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Presensi &amp; Absensi Harian</h2>
          <p className="text-xs text-slate-500">
            Hari usaha: <strong className="text-slate-800">{labelHari(today)}</strong> · Klik tombol shift untuk menandai kehadiran
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500 shadow-sm">
          Belum ada staf / karyawan terdaftar. Silakan tambahkan data karyawan di menu Admin &gt; Absensi.
        </div>
      ) : (
        <AbsenClient list={list} shifts={shifts.length ? shifts : ["Masuk"]} />
      )}
    </div>
  );
}
