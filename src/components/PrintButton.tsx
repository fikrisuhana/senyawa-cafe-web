"use client";

import { Printer, X } from "lucide-react";

export default function PrintButton() {
  return (
    <div className="no-print mt-4 flex items-center gap-2 w-full max-w-[280px]">
      <button
        onClick={() => window.print()}
        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
      >
        <Printer className="w-3.5 h-3.5" />
        <span>Cetak Struk</span>
      </button>
      <button
        onClick={() => window.close()}
        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition"
      >
        Tutup
      </button>
    </div>
  );
}
