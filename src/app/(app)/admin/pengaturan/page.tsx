import { getSettings } from "@/lib/settings";
import PengaturanClient from "@/components/PengaturanClient";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  const s = await getSettings();
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-bold">Pengaturan</h1>
      <PengaturanClient settings={s} />
    </div>
  );
}
