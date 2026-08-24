"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/settings";

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
        // Resize ke maksimal 256px biar data URL kecil.
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
    setMsg(res.ok ? "✅ Tersimpan" : "❌ Gagal menyimpan");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <form onSubmit={save} className="card space-y-4">
        {/* Tab pemisah bagian pengaturan */}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium ${
                tab === t ? "bg-white shadow-sm" : "text-slate-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Umum" && (
          <section className="space-y-3">
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <div>
                <label className="label">Nama cafe</label>
                <input className="input" value={f.storeName} onChange={(e) => set("storeName", e.target.value)} />
              </div>
              <div>
                <label className="label">Logo</label>
                <input
                  className="input text-center text-lg"
                  value={f.logoEmoji}
                  onChange={(e) => set("logoEmoji", e.target.value)}
                  maxLength={2}
                  placeholder="☕"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-2">
              {f.logoImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.logoImage} alt="logo" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-2xl">
                  {f.logoEmoji || "☕"}
                </div>
              )}
              <div className="flex flex-1 flex-wrap gap-2">
                <label className="btn-ghost cursor-pointer text-sm">
                  📤 Upload logo
                  <input type="file" accept="image/*" hidden onChange={onLogoFile} />
                </label>
                {f.logoImage && (
                  <button
                    type="button"
                    className="btn-ghost text-sm text-red-600"
                    onClick={() => set("logoImage", "")}
                  >
                    Hapus logo
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Kalau ada gambar logo, itu yang dipakai (nav, login, struk). Emoji jadi cadangan.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Jam buka</label>
                <input className="input" type="number" min={0} max={23} value={f.openHour} onChange={(e) => set("openHour", e.target.value)} />
              </div>
              <div>
                <label className="label">Jam tutup</label>
                <input className="input" type="number" min={0} max={23} value={f.closeHour} onChange={(e) => set("closeHour", e.target.value)} />
              </div>
              <div>
                <label className="label">Pemisah hari</label>
                <input className="input" type="number" min={0} max={23} value={f.dayCutoffHour} onChange={(e) => set("dayCutoffHour", e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Tutup lewat tengah malam: transaksi <b>sebelum</b> “pemisah hari” dihitung hari kemarin.
              Buka {f.openHour}:00–{f.closeHour}:00 → pakai pemisah antara jam tutup & buka (mis. 5 atau 6).
            </p>
          </section>
        )}

        {tab === "Kasir & Absensi" && (
          <section className="space-y-3">
            <div>
              <label className="label">Tombol nominal tunai (pisah koma, “pas” = tepat total)</label>
              <input className="input" value={f.quickCash} onChange={(e) => set("quickCash", e.target.value)} placeholder="pas,20000,50000,100000" />
            </div>
            <div>
              <label className="label">Daftar shift absensi (pisah koma)</label>
              <input className="input" value={f.shifts} onChange={(e) => set("shifts", e.target.value)} placeholder="Sore,Malam" />
              <p className="mt-1 text-xs text-slate-500">
                Kosongkan kalau tak pakai shift. Contoh: <code>Pagi,Malam</code>.
              </p>
            </div>
            <div>
              <label className="label">Jam per shift (sejajar daftar shift)</label>
              <input className="input" value={f.shiftHours} onChange={(e) => set("shiftHours", e.target.value)} placeholder="9-17,17-24" />
              <p className="mt-1 text-xs text-slate-500">
                Dipakai HP buat deteksi shift berjalan (tab absen otomatis pindah).
                Contoh 2 shift: Pagi 09.00–17.00, Malam 17.00–24.00 → <code>9-17,17-24</code>.
              </p>
            </div>
            <div>
              <label className="label">Kas awal harian (modal laci)</label>
              <input
                className="input"
                type="number"
                value={f.kasAwal}
                onChange={(e) => set("kasAwal", e.target.value)}
                placeholder="250000"
              />
              <p className="mt-1 text-xs text-slate-500">
                Uang tunai yang disiapkan di laci tiap buka (mis. 250.000). Dipakai di Keuangan
                untuk hitung perkiraan uang di laci.
              </p>
            </div>
          </section>
        )}

        {tab === "Struk" && (
          <section className="space-y-3">
            <div>
              <label className="label">Lebar kertas</label>
              <select className="input" value={f.paperWidth} onChange={(e) => set("paperWidth", e.target.value)}>
                <option value="58">58 mm (thermal kecil)</option>
                <option value="80">80 mm (thermal besar)</option>
              </select>
            </div>
            <div>
              <label className="label">Header struk (alamat/telp/IG)</label>
              <textarea className="input" rows={3} value={f.receiptHeader} onChange={(e) => set("receiptHeader", e.target.value)} />
            </div>
            <div>
              <label className="label">Footer struk</label>
              <textarea className="input" rows={2} value={f.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value)} />
            </div>
          </section>
        )}

        {msg && <p className="text-sm">{msg}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "…" : "Simpan pengaturan"}
        </button>
      </form>

      {/* Preview struk + kelola Google Sheet */}
      <div className="lg:sticky lg:top-16 h-fit space-y-4">
        <SheetManager />
        <div>
        <p className="mb-2 text-xs font-medium text-slate-500">Pratinjau struk</p>
        <div
          className="mx-auto rounded-lg bg-white p-3 text-[12px] leading-tight shadow ring-1 ring-slate-200"
          style={{ width: `${f.paperWidth}mm` }}
        >
          <div className="text-center">
            {f.logoImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.logoImage} alt="logo" className="mx-auto mb-1 h-12 w-12 rounded object-cover" />
            )}
            <div className="text-sm font-bold">
              {!f.logoImage && `${f.logoEmoji} `}
              {f.storeName || "Nama Cafe"}
            </div>
            {f.receiptHeader && (
              <div className="whitespace-pre-line text-[11px] text-slate-500">{f.receiptHeader}</div>
            )}
          </div>
          <hr className="my-2 border-dashed" />
          <div className="flex justify-between"><span>Kopi Susu</span><span>Rp18.000</span></div>
          <div className="text-[11px] text-slate-500">1 × Rp18.000</div>
          <hr className="my-2 border-dashed" />
          <div className="flex justify-between font-bold"><span>Total</span><span>Rp18.000</span></div>
          <div className="flex justify-between"><span>Bayar (TUNAI)</span><span>Rp20.000</span></div>
          <div className="flex justify-between"><span>Kembali</span><span>Rp2.000</span></div>
          {f.receiptFooter && (
            <>
              <hr className="my-2 border-dashed" />
              <p className="whitespace-pre-line text-center text-[11px] text-slate-500">{f.receiptFooter}</p>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

/// Kartu kelola Google Sheet: status koneksi, ganti spreadsheet, sinkron ulang.
function SheetManager() {
  const [state, setState] = useState<{ enabled: boolean; url?: string | null; serviceAccountEmail?: string } | null>(null);
  const [url, setUrl] = useState("");
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

  async function rebuild() {
    setBusy(true);
    setMsg("⏳ Menulis ulang ke Sheet…");
    const res = await fetch("/api/admin/sheet", { method: "POST" });
    const body = await res.json();
    setBusy(false);
    setMsg(res.ok ? "✅ Laporan + katalog tersinkron" : `❌ ${body.error || "Gagal"}`);
    if (res.ok && body.url) setState((s) => (s ? { ...s, url: body.url } : s));
  }

  return (
    <div className="card space-y-2 p-3">
      <p className="text-xs font-semibold text-slate-700">📊 Google Sheet</p>
      {state === null ? (
        <p className="text-xs text-slate-400">Memuat…</p>
      ) : !state.enabled ? (
        <p className="text-xs text-slate-400">
          Belum dikonfigurasi di server (set <code>GOOGLE_SA_JSON_B64</code> di .env).
        </p>
      ) : (
        <>
          {state.url ? (
            <a href={state.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-600 underline">
              Buka spreadsheet ↗
            </a>
          ) : (
            <p className="text-xs text-slate-400">Belum ada sheet aktif — tempel URL di bawah.</p>
          )}
          {state.serviceAccountEmail && (
            <p className="break-all text-[11px] text-slate-400">
              Share sheet ke: <code>{state.serviceAccountEmail}</code> (role Editor)
            </p>
          )}
          <form onSubmit={saveSheet} className="flex gap-1">
            <input
              className="input text-xs"
              placeholder="Tempel URL Google Sheet…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button className="btn-ghost shrink-0 text-xs" disabled={busy || !url.trim()}>
              Ganti
            </button>
          </form>
          <button className="btn-ghost w-full text-xs" onClick={rebuild} disabled={busy}>
            🔄 Sinkronkan ulang (transaksi + katalog)
          </button>
          {msg && <p className="text-[11px] text-slate-500">{msg}</p>}
        </>
      )}
    </div>
  );
}
