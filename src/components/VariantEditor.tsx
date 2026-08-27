"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";
import type { MenuRow, PackOption } from "@/components/MenuAdminClient";

export default function VariantEditor({
  menu,
  packs,
  onClose,
}: {
  menu: MenuRow;
  packs: PackOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<"SINGLE" | "MULTI">("SINGLE");
  const [busy, setBusy] = useState(false);
  // input opsi per grup
  const [optName, setOptName] = useState<Record<string, string>>({});
  const [optDelta, setOptDelta] = useState<Record<string, string>>({});
  // input bahan per opsi
  const [stockPack, setStockPack] = useState<Record<string, string>>({});
  const [stockQty, setStockQty] = useState<Record<string, string>>({});
  const [openStock, setOpenStock] = useState<string | null>(null); // opsi yang lagi tambah bahan
  const [editStock, setEditStock] = useState<{ id: string; packagingId: string; qty: string } | null>(null);

  async function saveEditStock() {
    if (!editStock) return;
    await fetch("/api/admin/variants", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "optionStock",
        id: editStock.id,
        packagingId: editStock.packagingId,
        qty: Number(editStock.qty) || 1,
      }),
    });
    setEditStock(null);
    router.refresh();
  }

  async function addOptionStock(optionId: string) {
    const packagingId = stockPack[optionId] || packs[0]?.id;
    if (!packagingId) return;
    await fetch("/api/admin/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "optionStock",
        optionId,
        packagingId,
        qty: Number(stockQty[optionId]) || 1,
      }),
    });
    setStockQty({ ...stockQty, [optionId]: "" });
    setOpenStock(null);
    router.refresh();
  }
  async function delOptionStock(id: string) {
    await fetch(`/api/admin/variants?kind=optionStock&id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setBusy(true);
    await fetch("/api/admin/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "group",
        menuItemId: menu.id,
        name: groupName,
        type: groupType,
      }),
    });
    setBusy(false);
    setGroupName("");
    router.refresh();
  }

  async function addOption(groupId: string) {
    const name = (optName[groupId] || "").trim();
    if (!name) return;
    await fetch("/api/admin/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "option",
        groupId,
        name,
        priceDelta: Number(optDelta[groupId]) || 0,
      }),
    });
    setOptName({ ...optName, [groupId]: "" });
    setOptDelta({ ...optDelta, [groupId]: "" });
    router.refresh();
  }

  async function delGroup(id: string) {
    if (!confirm("Hapus grup varian ini beserta opsinya?")) return;
    await fetch(`/api/admin/variants?kind=group&id=${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function delOption(id: string) {
    await fetch(`/api/admin/variants?kind=option&id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              🧊
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 leading-tight">Konfigurasi Varian — {menu.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Contoh: Grup &ldquo;Suhu&rdquo; (Panas / Dingin), Grup &ldquo;Extra Shot&rdquo; (+Rp 5.000)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {menu.groups.length === 0 && (
            <div className="py-8 text-center text-slate-400">
              Belum ada grup varian. Tambahkan grup varian baru di bawah ini.
            </div>
          )}
          {menu.groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span>{g.name}</span>
                  <span className="pill-slate text-[10px]">
                    {g.type === "SINGLE" ? "Pilih Satu" : "Boleh Banyak"}
                  </span>
                </div>
                <button onClick={() => delGroup(g.id)} className="text-xs text-rose-600 hover:underline font-medium">
                  Hapus Grup
                </button>
              </div>

              <div className="space-y-2">
                {g.options.map((o) => (
                  <div key={o.id} className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {o.name}
                        {o.priceDelta ? (
                          <span className="font-mono text-blue-600 font-bold ml-1.5">+{rupiah(o.priceDelta)}</span>
                        ) : null}
                      </span>
                      <button
                        onClick={() => delOption(o.id)}
                        className="text-[11px] text-rose-600 hover:underline font-medium"
                      >
                        Hapus Opsi
                      </button>
                    </div>

                    {/* Bahan/kemasan khusus opsi ini */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                      {o.stocks.map((s) =>
                        editStock?.id === s.id ? (
                          <span key={s.id} className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded border border-slate-200">
                            <select
                              className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px]"
                              value={editStock.packagingId}
                              onChange={(e) => setEditStock({ ...editStock, packagingId: e.target.value })}
                            >
                              {packs.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <input
                              className="w-12 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono text-center"
                              type="number"
                              min={1}
                              value={editStock.qty}
                              onChange={(e) => setEditStock({ ...editStock, qty: e.target.value })}
                            />
                            <button
                              onClick={saveEditStock}
                              className="bg-blue-600 text-white rounded px-2 py-0.5 text-[11px] font-semibold"
                            >
                              Simpan
                            </button>
                            <button
                              onClick={() => setEditStock(null)}
                              className="px-1 text-[11px] text-slate-400 hover:underline"
                            >
                              Batal
                            </button>
                          </span>
                        ) : (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-700 font-medium"
                          >
                            <span>📦 {s.name} ×{s.qty}</span>
                            <button
                              onClick={() =>
                                setEditStock({ id: s.id, packagingId: s.packagingId, qty: String(s.qty) })
                              }
                              className="text-blue-600 hover:text-blue-800"
                              title="Ubah Bahan"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => delOptionStock(s.id)}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              ✕
                            </button>
                          </span>
                        )
                      )}

                      {openStock === o.id ? (
                        <span className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded border border-slate-200">
                          <select
                            className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px]"
                            value={stockPack[o.id] || packs[0]?.id}
                            onChange={(e) => setStockPack({ ...stockPack, [o.id]: e.target.value })}
                          >
                            {packs.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <input
                            className="w-12 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono text-center"
                            type="number"
                            min={1}
                            placeholder="Qty"
                            value={stockQty[o.id] || ""}
                            onChange={(e) => setStockQty({ ...stockQty, [o.id]: e.target.value })}
                          />
                          <button
                            onClick={() => addOptionStock(o.id)}
                            className="bg-blue-600 text-white rounded px-2 py-0.5 text-[11px] font-semibold"
                          >
                            Simpan
                          </button>
                          <button
                            onClick={() => setOpenStock(null)}
                            className="px-1 text-[11px] text-slate-400 hover:underline"
                          >
                            Batal
                          </button>
                        </span>
                      ) : (
                        packs.length > 0 && (
                          <button
                            onClick={() => setOpenStock(o.id)}
                            className="text-[11px] text-blue-600 hover:underline font-medium"
                          >
                            + Kaitkan Bahan Baku
                          </button>
                        )
                      )}

                      {o.stocks.length === 0 && openStock !== o.id && (
                        <span className="text-[11px] text-slate-400 italic">Tanpa pengurangan bahan baku</span>
                      )}
                    </div>
                  </div>
                ))}
                {g.options.length === 0 && (
                  <span className="text-xs text-slate-400 italic">Belum ada pilihan opsi pada grup ini</span>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                  placeholder="Nama opsi baru (mis. Dingin, Double Shot)"
                  value={optName[g.id] || ""}
                  onChange={(e) => setOptName({ ...optName, [g.id]: e.target.value })}
                />
                <input
                  className="w-28 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono font-bold"
                  type="number"
                  placeholder="+Harga (Rp)"
                  value={optDelta[g.id] || ""}
                  onChange={(e) => setOptDelta({ ...optDelta, [g.id]: e.target.value })}
                />
                <button
                  onClick={() => addOption(g.id)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition"
                >
                  + Tambah
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={addGroup} className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
          <input
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            placeholder="Nama grup varian baru (mis. Level Pedas, Pilihan Susu)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <select
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            value={groupType}
            onChange={(e) => setGroupType(e.target.value as any)}
          >
            <option value="SINGLE">Pilih Satu (Radio)</option>
            <option value="MULTI">Boleh Banyak (Checkbox)</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg font-semibold text-xs transition disabled:opacity-50"
            disabled={busy}
          >
            + Buat Grup
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-400 text-[11px]">
          <span>Perubahan varian otomatis tersimpan langsung ke sistem.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
