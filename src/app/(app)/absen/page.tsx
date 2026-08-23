import { prisma } from "@/lib/db";
import { getSettings, parseShifts } from "@/lib/settings";
import { todayKey, labelHari } from "@/lib/bizday";
import AbsenClient, { type EmpRow } from "@/components/AbsenClient";

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
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-lg font-bold">Absensi</h1>
        <p className="text-xs text-slate-500">
          Hari usaha: {labelHari(today)} · klik shift = tandai masuk (klik lagi = batal)
        </p>
      </div>
      {list.length === 0 ? (
        <div className="card text-sm text-slate-500">
          Belum ada karyawan. Minta admin menambah karyawan di menu Absensi.
        </div>
      ) : (
        <AbsenClient list={list} shifts={shifts.length ? shifts : ["Masuk"]} />
      )}
    </div>
  );
}
