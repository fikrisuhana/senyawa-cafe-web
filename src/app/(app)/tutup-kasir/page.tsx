import TutupKasirClient from "@/components/TutupKasirClient";
import { Vault } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TutupKasirPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <Vault className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tutup Kasir</h2>
          <p className="text-xs text-slate-500">Hitung uang di laci di akhir shift — sistem langsung tunjukkan selisihnya.</p>
        </div>
      </div>
      <TutupKasirClient />
    </div>
  );
}
