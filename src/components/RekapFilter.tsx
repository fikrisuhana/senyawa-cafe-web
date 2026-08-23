"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RekapFilter({
  from,
  to,
  today,
}: {
  from: string;
  to: string;
  today: string;
}) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function apply(nf: string, nt: string) {
    router.push(`/rekap?from=${nf}&to=${nt}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label">Dari</label>
        <input
          type="date"
          className="input"
          value={f}
          onChange={(e) => setF(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Sampai</label>
        <input
          type="date"
          className="input"
          value={t}
          onChange={(e) => setT(e.target.value)}
        />
      </div>
      <button className="btn-primary" onClick={() => apply(f, t)}>
        Terapkan
      </button>
      <button className="btn-ghost" onClick={() => apply(today, today)}>
        Hari ini
      </button>
    </div>
  );
}
