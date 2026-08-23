"use client";

import { useRouter } from "next/navigation";

export default function DeleteCash({ id }: { id: string }) {
  const router = useRouter();
  async function del() {
    if (!confirm("Hapus catatan ini?")) return;
    await fetch(`/api/admin/cash?id=${id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <button onClick={del} className="text-xs text-red-600 hover:underline">
      hapus
    </button>
  );
}
