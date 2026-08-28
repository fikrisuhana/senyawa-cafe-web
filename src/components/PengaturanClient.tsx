"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/settings";
import { Sliders, Store, Clock, Receipt, FileSpreadsheet, Upload, Check, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

const TABS = ["Umum", "Kasir & Absensi", "Struk"] as const;
type Tab = (typeof TABS)[number];

export default function PengaturanClient({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Umum");
  const [f, setF] = useState({
    storeName: settings.storeName,
    logoEmoji: settings.logoEmoji,
    logoImage: settings.logoImage,
    openHour: String(settings.openHour),
    closeHour: String(settings.closeHour),
    dayCutoffHour: String(settings.dayCutoffHour),
    quickCash: settings.quickCash,
    shifts: settings.shifts,
    shiftHours: settings.shiftHours,
    kasAwal: String(settings.kasAwal),
    paperWidth: String(settings.paperWidth),
    receiptHeader: settings.receiptHeader,
    receiptFooter: settings.receiptFooter,
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        setF((prev) => ({ ...prev, logoImage: canvas.toDataURL("image/jpeg", 0.85) }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    setMsg(res.ok ? "✅ Pengaturan berhasil disimpan" : "❌ Gagal menyimpan pengaturan");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 text-xs">
        {/* Tab pemisah bagian pengaturan */}
        <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${
                tab === t ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Umum" && (
          <section className="space-y-4">
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Outlet / Cafe</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                  value={f.storeName}
                  onChange={(e) => set("storeName", e.target.value)}
                  placeholder="Contoh: Kopi Senja Coffee & Eatery"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Logo Emoji</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center text-lg focus:outline-none focus:border-blue-500"
                  value={f.logoEmoji}
                  onChange={(e) => set("logoEmoji", e.target.value)}
                  maxLength={2}
                  placeholder="☕"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
              {f.logoImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.logoImage} alt="logo" className="h-14 w-14 rounded-xl object-cover border border-slate-200" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-white text-2xl font-bold">
                  {f.logoEmoji || "☕"}
                </div>
              )}
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <label className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer transition flex items-center gap-1.5 shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Logo Gambar</span>
                  <input type="file" accept="image/*" hidden onChange={onLogoFile} />
                </label>
                {f.logoImage && (
                  <button
                    type="button"
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-semibold text-xs transition"
                    onClick={() => set("logoImage", "")}
                  >
                    Hapus Logo
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Jika file logo gambar diunggah, gambar akan dipakai di header navigasi, halaman login, dan cetak struk.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jam Buka (0-23)</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono text-center font-bold"
                  type="number"
                  min={0}
                  max={23}
                  value={f.openHour}
                  onChange={(e) => set("openHour", e.target.value)}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jam Tutup (0-23)</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono text-center font-bold"
                  type="number"
                  min={0}
                  max={23}
                  value={f.closeHour}
                  onChange={(e) => set("closeHour", e.target.value)}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pemisah Hari Usaha</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono text-center font-bold"
                  type="number"
                  min={0}
                  max={23}
                  value={f.dayCutoffHour}
                  onChange={(e) => set("dayCutoffHour", e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
              💡 Buka lewat tengah malam: transaksi sebelum jam pemisah hari (mis. jam 05:00 pagi) tetap dicatat sebagai omzet hari usaha kemarin.
            </p>
          </section>
        )}

        {tab === "Kasir & Absensi" && (
          <section className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tombol Cepat Uang Tunai Kasir</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                value={f.quickCash}
                onChange={(e) => set("quickCash", e.target.value)}
                placeholder="pas,20000,50000,100000"
              />
              <p className="mt-1 text-[11px] text-slate-400">Pisahkan dengan koma (mis: <code>pas,20000,50000,100000</code>). &ldquo;pas&rdquo; berarti tombol uang pas.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Daftar Nama Shift Kerja Absensi</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                value={f.shifts}
                onChange={(e) => set("shifts", e.target.value)}
                placeholder="Pagi,Malam"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Kosongkan jika tidak memakai shift kerja. Contoh: <code>Pagi,Malam</code> atau <code>Siang,Sore,Malam</code>.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Rentang Jam Shift Absensi</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                value={f.shiftHours}
                onChange={(e) => set("shiftHours", e.target.value)}
                placeholder="9-17,17-24"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Otomatis memilih tab shift yang sedang aktif di layar absensi. Contoh 2 shift: <code>9-17,17-24</code>.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Standar Kas Awal / Modal Laci (Rp)</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono font-bold"
                type="number"
                value={f.kasAwal}
                onChange={(e) => set("kasAwal", e.target.value)}
                placeholder="250000"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Uang kembalian yang disiapkan di laci kasir setiap awal buka toko (mis. 250.000).
              </p>
            </div>
          </section>
        )}

        {tab === "Struk" && (
          <section className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lebar Kertas Printer Thermal</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
                value={f.paperWidth}
                onChange={(e) => set("paperWidth", e.target.value)}
              >
                <option value="58">58 mm (Printer Thermal Portable / Standar)</option>
                <option value="80">80 mm (Printer Thermal Lebar / POS Besar)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Header Struk (Alamat, No. Telp, IG)</label>
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                rows={3}
                value={f.receiptHeader}
                onChange={(e) => set("receiptHeader", e.target.value)}
                placeholder="Jl. Merdeka No. 45&#10;IG: @kopisenja.cafe&#10;WA: 0812-3456-7890"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Footer Struk (Pesan Terima Kasih / Wifi)</label>
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                rows={2}
                value={f.receiptFooter}
                onChange={(e) => set("receiptFooter", e.target.value)}
                placeholder="Terima kasih atas kunjungan Anda!&#10;Password WiFi: kopienak123"
              />
            </div>
          </section>
        )}

        {msg && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
            {msg}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-sm transition disabled:opacity-50"
        >
          {busy ? "Menyimpan Perubahan..." : "Simpan Semua Pengaturan"}
        </button>
      </form>

      {/* Preview struk + kelola Google Sheet */}
      <div className="lg:sticky lg:top-20 h-fit space-y-4">
        <SheetManager />

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-slate-500" />
              <span>Pratinjau Struk Thermal</span>
            </h4>
            <span className="pill-slate text-[10px]">{f.paperWidth}mm</span>
          </div>

          <div
            className="mx-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-tight font-mono text-slate-800 border border-dashed border-slate-300"
            style={{ width: `${Math.min(240, Number(f.paperWidth) * 3.5)}px` }}
          >
            <div className="text-center space-y-0.5">
              {f.logoImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.logoImage} alt="logo" className="mx-auto mb-1 h-10 w-10 rounded-lg object-cover" />
              )}
              <div className="text-xs font-bold">
                {!f.logoImage && `${f.logoEmoji} `}
                {f.storeName || "Nama Cafe"}
              </div>
              {f.receiptHeader && (
                <div className="whitespace-pre-line text-[10px] text-slate-500">{f.receiptHeader}</div>
              )}
            </div>
            <hr className="my-2 border-dashed border-slate-300" />
            <div className="flex justify-between"><span>Kopi Susu Aren</span><span>18.000</span></div>
            <div className="text-[10px] text-slate-400">1 × Rp 18.000</div>
            <hr className="my-2 border-dashed border-slate-300" />
            <div className="flex justify-between font-bold"><span>TOTAL</span><span>Rp 18.000</span></div>
            <div className="flex justify-between text-slate-500"><span>TUNAI</span><span>20.000</span></div>
            <div className="flex justify-between text-slate-500"><span>KEMBALI</span><span>2.000</span></div>
            {f.receiptFooter && (
              <>
                <hr className="my-2 border-dashed border-slate-300" />
                <p className="whitespace-pre-line text-center text-[10px] text-slate-500">{f.receiptFooter}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/// Kartu kelola Google Sheet: status koneksi, ganti spreadsheet, folder nota Drive, sinkron ulang.
function SheetManager() {
  const [state, setState] = useState<{
    enabled: boolean;
    url?: string | null;
    serviceAccountEmail?: string;
    driveFolderUrl?: string | null;
  } | null>(null);
  const [url, setUrl] = useState("");
  const [folder, setFolder] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/sheet")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ enabled: false }));
  }, []);

  async function saveSheet(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/sheet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(`❌ ${body.error || "Gagal"}`);
      return;
    }
    setUrl("");
    setMsg("✅ Spreadsheet diganti — klik Sinkronkan ulang");
    setState((s) => (s ? { ...s, url: body.url } : s));
  }

  async function saveFolder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/sheet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driveFolder: folder }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(`❌ ${body.error || "Gagal"}`);
      return;
    }
    setFolder("");
    setMsg(`✅ Folder nota tersimpan: ${body.driveFolder?.name || "folder"}`);
    setState((s) => (s ? { ...s, driveFolderUrl: body.driveFolderUrl } : s));
  }

  async function rebuild() {
    setBusy(true);
    setMsg("⏳ Menulis ulang ke Sheet…");
    const res = await fetch("/api/admin/sheet", { method: "POST" });
    const body = await res.json();
    setBusy(false);
    setMsg(res.ok ? "✅ Laporan & katalog tersinkron" : `❌ ${body.error || "Gagal"}`);
    if (res.ok && body.url) setState((s) => (s ? { ...s, url: body.url } : s));
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Integrasi Google Sheets</span>
        </h4>
      </div>

      {state === null ? (
        <p className="text-slate-400">Memuat status koneksi…</p>
      ) : !state.enabled ? (
        <p className="text-[11px] text-slate-400">
          Belum dikonfigurasi di server (set <code>GOOGLE_SA_JSON_B64</code> di .env).
        </p>
      ) : (
        <div className="space-y-2.5">
          {state.url ? (
            <a
              href={state.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>Buka Google Spreadsheet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <p className="text-[11px] text-slate-400">Belum ada URL sheet aktif. Tempel URL di bawah ini:</p>
          )}

          {state.serviceAccountEmail && (
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 break-all">
              <span className="text-slate-400 block mb-0.5">Beri akses Editor ke email:</span>
              <code className="font-mono text-blue-600 font-semibold">{state.serviceAccountEmail}</code>
            </div>
          )}

          <form onSubmit={saveSheet} className="flex gap-1.5">
            <input
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              placeholder="https://docs.google.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="submit"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition disabled:opacity-50"
              disabled={busy || !url.trim()}
            >
              Simpan
            </button>
          </form>

          {/* Folder nota belanja (Google Drive) */}
          <div className="border-t border-slate-100 pt-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-slate-500" />
                Folder Nota Belanja (Drive)
              </span>
              <span className={state.driveFolderUrl ? "pill-green text-[10px]" : "pill-amber text-[10px]"}>
                {state.driveFolderUrl ? "Terhubung" : "Belum diset"}
              </span>
            </div>
            {state.driveFolderUrl ? (
              <a
                href={state.driveFolderUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>Buka folder nota</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nota belanja disimpan sebagai foto di Google Drive (bukan di server). Buat folder di Drive kamu
                (mis. <b>Nota POS</b>), share <b>Editor</b> ke email SA di atas, lalu tempel URL foldernya di sini.
              </p>
            )}
            <form onSubmit={saveFolder} className="flex gap-1.5">
              <input
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                placeholder="https://drive.google.com/drive/folders/..."
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
              />
              <button
                type="submit"
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition disabled:opacity-50"
                disabled={busy || !folder.trim()}
              >
                Simpan
              </button>
            </form>
          </div>

          <button
            type="button"
            className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-semibold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            onClick={rebuild}
            disabled={busy}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
            <span>Sinkronkan Ulang Sheet</span>
          </button>

          {msg && <p className="text-[11px] text-slate-600 font-medium">{msg}</p>}
        </div>
      )}
    </div>
  );
}
