"use client";

export default function PrintButton() {
  return (
    <div className="no-print mt-3 flex gap-2">
      <button onClick={() => window.print()} className="btn-primary flex-1">
        🖨️ Cetak
      </button>
      <button onClick={() => window.close()} className="btn-ghost">
        Tutup
      </button>
    </div>
  );
}
