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
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Varian — {menu.name}</h2>
            <p className="text-xs text-slate-500">
              Contoh: grup “Suhu” (Panas/Dingin), grup “Extra” (Double shot +5rb).
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost !px-2 !py-1">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {menu.groups.length === 0 && (
            <p className="text-sm text-slate-400">Belum ada varian.</p>
          )}
          {menu.groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">
                  {g.name}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    ({g.type === "SINGLE" ? "pilih satu" : "boleh banyak"})
                  </span>
                </div>
                <button onClick={() => delGroup(g.id)} className="text-xs text-red-600 hover:underline">
                  hapus grup
                </button>
              </div>
              <div className="mb-2 space-y-2">
                {g.options.map((o) => (
                  <div key={o.id} className="rounded-lg bg-slate-50 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {o.name}
                        {o.priceDelta ? (
                          <span className="text-brand-700"> +{rupiah(o.priceDelta)}</span>
                        ) : null}
                      </span>
                      <button
                        onClick={() => delOption(o.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        hapus opsi
                      </button>
                    </div>
                    {/* Bahan/kemasan khusus opsi ini (mis. Dingin → cup plastik).
                        Kalau tak ada bahan, tak menampilkan picker — cukup tombol "+ bahan". */}
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {o.stocks.map((s) =>
                        editStock?.id === s.id ? (
                          <span key={s.id} className="inline-flex items-center gap-1">
                            <select
                              className="rounded border border-slate-200 px-1 py-0.5 text-[11px]"
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
                              className="w-10 rounded border border-slate-200 px-1 py-0.5 text-[11px]"
                              type="number"
                              min={1}
                              value={editStock.qty}
                              onChange={(e) => setEditStock({ ...editStock, qty: e.target.value })}
                            />
                            <button
                              onClick={saveEditStock}
                              className="rounded bg-brand-600 px-1.5 py-0.5 text-[11px] font-medium text-white"
                            >
                              simpan
                            </button>
                            <button
                              onClick={() => setEditStock(null)}
                              className="px-1 text-[11px] text-slate-400 hover:underline"
                            >
                              batal
                            </button>
                          </span>
                        ) : (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 rounded-full bg-white py-0.5 pl-2 pr-0.5 text-[11px] ring-1 ring-slate-200"
                          >
                            🧊 {s.name}×{s.qty}
                            <button
                              onClick={() =>
                                setEditStock({ id: s.id, packagingId: s.packagingId, qty: String(s.qty) })
                              }
                              className="rounded-full px-1 text-brand-600 hover:bg-brand-50"
                              title="ubah bahan"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => delOptionStock(s.id)}
                              className="rounded-full px-1 text-slate-400 hover:text-red-600"
                            >
                              ✕
                            </button>
                          </span>
                        )
                      )}

                      {openStock === o.id ? (
                        <span className="inline-flex items-center gap-1">
                          <select
                            className="rounded border border-slate-200 px-1 py-0.5 text-[11px]"
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
                            className="w-10 rounded border border-slate-200 px-1 py-0.5 text-[11px]"
                            type="number"
                            min={1}
                            placeholder="qty"
                            value={stockQty[o.id] || ""}
                            onChange={(e) => setStockQty({ ...stockQty, [o.id]: e.target.value })}
                          />
                          <button
                            onClick={() => addOptionStock(o.id)}
                            className="rounded bg-brand-600 px-1.5 py-0.5 text-[11px] font-medium text-white"
                          >
                            simpan
                          </button>
                          <button
                            onClick={() => setOpenStock(null)}
                            className="px-1 text-[11px] text-slate-400 hover:underline"
                          >
                            batal
                          </button>
                        </span>
                      ) : (
                        packs.length > 0 && (
                          <button
                            onClick={() => setOpenStock(o.id)}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200"
                          >
                            + bahan
                          </button>
                        )
                      )}

                      {o.stocks.length === 0 && openStock !== o.id && (
                        <span className="text-[11px] text-slate-300">tanpa bahan khusus</span>
                      )}
                    </div>
                  </div>
                ))}
                {g.options.length === 0 && (
                  <span className="text-xs text-slate-400">belum ada opsi</span>
                )}
              </div>
              <div className="flex gap-1">
                <input
                  className="input"
                  placeholder="Nama opsi (mis. Dingin)"
                  value={optName[g.id] || ""}
                  onChange={(e) => setOptName({ ...optName, [g.id]: e.target.value })}
                />
                <input
                  className="input w-24"
                  type="number"
                  placeholder="+Rp"
                  value={optDelta[g.id] || ""}
                  onChange={(e) => setOptDelta({ ...optDelta, [g.id]: e.target.value })}
                />
                <button onClick={() => addOption(g.id)} className="btn-ghost !px-3">
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={addGroup} className="mt-4 flex gap-1 border-t border-slate-200 pt-3">
          <input
            className="input"
            placeholder="Grup baru (mis. Suhu)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <select
            className="input w-32"
            value={groupType}
            onChange={(e) => setGroupType(e.target.value as any)}
          >
            <option value="SINGLE">pilih satu</option>
            <option value="MULTI">boleh banyak</option>
          </select>
          <button className="btn-primary !px-3" disabled={busy}>
            +
          </button>
        </form>

        <p className="mt-3 text-xs text-slate-400">
          Perubahan langsung tersimpan. Tutup jika sudah selesai.
        </p>
      </div>
    </div>
  );
}
