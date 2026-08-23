"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VoidButton({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function voidTrx() {
    const reason = prompt(`Batalkan transaksi ${code}?\nAlasan (opsional):`, "");
    if (reason === null) return; // batal
    setBusy(true);
    const res = await fetch("/api/transactions/void", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reason }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Gagal membatalkan");
      return;
    }
    router.refresh();
  }

  return (
    <button onClick={voidTrx} disabled={busy} className="text-xs text-red-600 hover:underline">
      {busy ? "…" : "Batalkan"}
    </button>
  );
}
