"use client";

import { useState } from "react";

export default function SpreadsheetCopy({ tsv }: { tsv: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      // fallback: seleksi manual
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Salin ke Spreadsheet</h3>
          <p className="text-xs text-slate-500">
            Klik salin, lalu paste (Ctrl+V) di Google Sheet/Excel — kolom otomatis terisi.
          </p>
        </div>
        <button onClick={copy} className="btn-primary">
          {copied ? "✓ Tersalin" : "📋 Salin"}
        </button>
      </div>
      <textarea
        readOnly
        onFocus={(e) => e.currentTarget.select()}
        value={tsv}
        rows={6}
        className="input font-mono text-[11px]"
      />
    </div>
  );
}
