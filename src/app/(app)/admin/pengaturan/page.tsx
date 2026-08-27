import { getSettings } from "@/lib/settings";
import PengaturanClient from "@/components/PengaturanClient";
import { Sliders } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
          <Sliders className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Pengaturan Sistem Cafe &amp; POS</h2>
          <p className="text-xs text-slate-500">Konfigurasi nama toko, jam operasional, format struk kasir, dan integrasi Google Sheets</p>
        </div>
      </div>
      <PengaturanClient settings={s} />
    </div>
  );
}
