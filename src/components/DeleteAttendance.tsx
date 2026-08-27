"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteAttendance({ id }: { id: string }) {
  const router = useRouter();
  async function del() {
    if (!confirm("Hapus catatan absensi ini?")) return;
    await fetch(`/api/admin/attendance?id=${id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <button
      onClick={del}
      className="p-1 text-rose-500 hover:bg-rose-50 rounded transition inline-flex items-center"
      title="Hapus Absensi"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
