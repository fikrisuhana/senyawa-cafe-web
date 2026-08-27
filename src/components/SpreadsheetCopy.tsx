"use client";

import { useState } from "react";
import { Copy, Check, FileSpreadsheet } from "lucide-react";

export default function SpreadsheetCopy({ tsv }: { tsv: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      // fallback: seleksi manual
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Salin Data ke Spreadsheet (Excel / Google Sheet)</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Klik tombol salin, lalu tempel (Ctrl+V) langsung ke spreadsheet — kolom dan baris otomatis terformat rapi.
          </p>
        </div>
        <button
          onClick={copy}
          className={`px-4 py-2 rounded-lg font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Berhasil Disalin!" : "Salin Tabel (TSV)"}</span>
        </button>
      </div>
      <textarea
        readOnly
        onFocus={(e) => e.currentTarget.select()}
        value={tsv}
        rows={4}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[11px] text-slate-700 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
