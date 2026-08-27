"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Utensils,
  ShoppingBag,
  CreditCard,
  QrCode,
  Banknote,
  AlertCircle,
  X,
  Layers,
} from "lucide-react";

export type PosOption = { id: string; name: string; priceDelta: number };
export type PosGroup = {
  id: string;
  name: string;
  type: "SINGLE" | "MULTI";
  required: boolean;
  options: PosOption[];
};
export type PosMenu = {
  id: string;
  name: string;
  category: string;
  price: number;
  stokPorsi: number | null;
  groups: PosGroup[];
};

type QuickCash = { label: string; value: number };
export type PosVoucher = { id: string; name: string; type: "PERCENT" | "NOMINAL"; value: number };
type CartLine = {
  key: string;
  menu: PosMenu;
  options: PosOption[];
  note: string;
  qty: number;
  unitPrice: number;
};

function lineKey(menuId: string, optionIds: string[], note: string) {
  return menuId + "|" + [...optionIds].sort().join(",") + "|" + note.trim();
}

export default function PosClient({
  menus,
  quickCash,
  vouchers,
}: {
  menus: PosMenu[];
  quickCash: QuickCash[];
  vouchers: PosVoucher[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cat, setCat] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [paid, setPaid] = useState<string>("");
  const [payment, setPayment] = useState("TUNAI");
  const [orderType, setOrderType] = useState("DINEIN");
  const [note, setNote] = useState("");
  const [voucherId, setVoucherId] = useState("");
  const [manualDiscount, setManualDiscount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chooser, setChooser] = useState<{
    menu: PosMenu;
    editKey: string | null;
    initOptionIds: string[];
    initNote: string;
  } | null>(null);

  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(menus.map((m) => m.category)))],
    [menus]
  );
  const filtered = menus.filter(
    (m) =>
      (cat === "ALL" || m.category === cat) &&
      m.name.toLowerCase().includes(q.toLowerCase())
  );

  const lines = Object.values(cart);
  const gross = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  const voucher = vouchers.find((v) => v.id === voucherId) || null;
  let discount = 0;
  if (voucher) {
    discount = voucher.type === "PERCENT" ? Math.round((gross * voucher.value) / 100) : voucher.value;
  } else if (manualDiscount) {
    discount = Number(manualDiscount) || 0;
  }
  discount = Math.min(Math.max(0, discount), gross);
  const total = gross - discount;

  const isTunai = payment === "TUNAI";
  const paidNum = Number(paid) || 0;
  const effectivePaid = isTunai ? paidNum : total;
  const change = isTunai ? paidNum - total : 0;
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  function qtyInCart(menuId: string) {
    return lines.filter((l) => l.menu.id === menuId).reduce((s, l) => s + l.qty, 0);
  }

  function tapMenu(menu: PosMenu) {
    setErr("");
    if (menu.groups.length > 0) {
      setChooser({ menu, editKey: null, initOptionIds: [], initNote: "" });
      return;
    }
    addLine(menu, [], "");
  }

  function editLine(l: CartLine) {
    setChooser({
      menu: l.menu,
      editKey: l.key,
      initOptionIds: l.options.map((o) => o.id),
      initNote: l.note,
    });
  }

  function removeLine(key: string) {
    setCart((c) => {
      const { [key]: _, ...rest } = c;
      return rest;
    });
  }

  function applyChoice(menu: PosMenu, options: PosOption[], lineNote: string, editKey: string | null) {
    const key = lineKey(menu.id, options.map((o) => o.id), lineNote);
    const unitPrice = menu.price + options.reduce((s, o) => s + o.priceDelta, 0);

    setCart((c) => {
      let draft = { ...c };
      let initialQty = 1;
      if (editKey) {
        initialQty = draft[editKey]?.qty || 1;
        delete draft[editKey];
      }
      const cur = draft[key]?.qty ?? (editKey ? 0 : 0);
      const targetQty = editKey && cur === 0 ? initialQty : cur + initialQty;

      if (menu.stokPorsi !== null) {
        const otherQty = Object.values(draft)
          .filter((l) => l.menu.id === menu.id)
          .reduce((s, l) => s + l.qty, 0);
        if (otherQty + targetQty > menu.stokPorsi) {
          setErr(`Stok ${menu.name} tidak cukup (sisa ${menu.stokPorsi} porsi)`);
          return c;
        }
      }
      return {
        ...draft,
        [key]: { key, menu, options, note: lineNote, qty: targetQty, unitPrice },
      };
    });
    setChooser(null);
  }

  function addLine(menu: PosMenu, options: PosOption[], lineNote: string) {
    const key = lineKey(menu.id, options.map((o) => o.id), lineNote);
    const unitPrice = menu.price + options.reduce((s, o) => s + o.priceDelta, 0);
    setCart((c) => {
      const cur = c[key]?.qty ?? 0;
      if (menu.stokPorsi !== null && qtyInCart(menu.id) + 1 > menu.stokPorsi) {
        setErr(`Stok ${menu.name} tinggal ${menu.stokPorsi} porsi`);
        return c;
      }
      return { ...c, [key]: { key, menu, options, note: lineNote, qty: cur + 1, unitPrice } };
    });
  }
  function inc(l: CartLine) {
    if (l.menu.stokPorsi !== null && qtyInCart(l.menu.id) + 1 > l.menu.stokPorsi) {
      setErr(`Stok ${l.menu.name} tinggal ${l.menu.stokPorsi} porsi`);
      return;
    }
    setCart((c) => ({ ...c, [l.key]: { ...l, qty: l.qty + 1 } }));
  }
  function dec(key: string) {
    setCart((c) => {
      const cur = c[key];
      if (!cur) return c;
      if (cur.qty <= 1) {
        const { [key]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [key]: { ...cur, qty: cur.qty - 1 } };
    });
  }
  function clear() {
    setCart({});
    setPaid("");
    setNote("");
    setErr("");
    setVoucherId("");
    setManualDiscount("");
  }

  async function checkout() {
    if (lines.length === 0) return;
    if (isTunai && paidNum < total) {
      setErr("Uang bayar kurang dari total transaksi");
      return;
    }
    setBusy(true);
    setErr("");
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: lines.map((l) => ({
          id: l.menu.id,
          qty: l.qty,
          optionIds: l.options.map((o) => o.id),
          note: l.note || null,
        })),
        paid: effectivePaid,
        payment,
        orderType,
        note,
        voucherId: voucherId || null,
        manualDiscount: voucherId ? 0 : Number(manualDiscount) || 0,
      }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || "Gagal menyimpan transaksi");
      return;
    }
    clear();
    setSheetOpen(false);
    router.refresh();
    window.open(`/receipt/${j.code}`, "_blank");
  }

  const cartPanel = (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <ShoppingCart className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-slate-900 text-sm">Ringkasan Pesanan</h3>
          {lines.length > 0 && (
            <span className="text-[11px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
              {totalQty}
            </span>
          )}
        </div>
        {lines.length > 0 && (
          <button
            onClick={clear}
            className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Kosongkan</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setOrderType("DINEIN")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-md font-semibold text-xs transition ${
            orderType === "DINEIN" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Makan di Tempat</span>
        </button>
        <button
          onClick={() => setOrderType("TAKEAWAY")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-md font-semibold text-xs transition ${
            orderType === "TAKEAWAY" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Bungkus (Takeaway)</span>
        </button>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {lines.length === 0 && (
          <div className="py-10 text-center text-slate-400 space-y-1">
            <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
            <p>Keranjang kosong. Pilih menu di sebelah kiri.</p>
          </div>
        )}
        {lines.map((l) => (
          <div key={l.key} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-800 leading-tight truncate">{l.menu.name}</div>
              {l.options.length > 0 && (
                <div className="text-[11px] text-slate-500 font-medium">{l.options.map((o) => o.name).join(", ")}</div>
              )}
              {l.note && <div className="text-[11px] italic text-amber-600">“{l.note}”</div>}
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">{rupiah(l.unitPrice)} / item</div>
              <div className="mt-1 flex gap-2 text-[11px]">
                {l.menu.groups.length > 0 && (
                  <button onClick={() => editLine(l)} className="text-blue-600 hover:underline font-medium">
                    Ubah varian
                  </button>
                )}
                <button onClick={() => removeLine(l.key)} className="text-rose-600 hover:underline font-medium">
                  Hapus
                </button>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="font-mono font-bold text-xs text-slate-900">{rupiah(l.unitPrice * l.qty)}</div>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                <button
                  onClick={() => dec(l.key)}
                  className="p-1 text-slate-600 hover:bg-slate-100 rounded transition"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-5 text-center font-mono font-bold text-xs">{l.qty}</span>
                <button
                  onClick={() => inc(l)}
                  className="p-1 text-slate-600 hover:bg-slate-100 rounded transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-2">
        <label className="block font-semibold text-slate-700 text-xs">Voucher / Diskon Potongan</label>
        <select
          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
          value={voucherId}
          onChange={(e) => {
            setVoucherId(e.target.value);
            if (e.target.value) setManualDiscount("");
          }}
        >
          <option value="">— Tanpa Voucher Promo —</option>
          {vouchers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.type === "PERCENT" ? `${v.value}%` : rupiah(v.value)})
            </option>
          ))}
        </select>
        {!voucherId && (
          <input
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
            inputMode="numeric"
            placeholder="Atau masukkan diskon manual (Rp)"
            value={manualDiscount}
            onChange={(e) => setManualDiscount(e.target.value.replace(/\D/g, ""))}
          />
        )}
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-1.5">
        {discount > 0 && (
          <>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal Kotor</span>
              <span className="font-mono">{rupiah(gross)}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-600 font-medium">
              <span>Potongan Diskon{voucher ? ` (${voucher.name})` : ""}</span>
              <span className="font-mono">−{rupiah(discount)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-bold text-slate-900">Total Pembayaran</span>
          <span className="font-mono text-lg font-bold text-blue-600">{rupiah(total)}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block font-semibold text-slate-700 text-xs">Metode Pembayaran</label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "TUNAI", label: "Tunai", icon: Banknote },
            { id: "QRIS", label: "QRIS", icon: QrCode },
            { id: "TRANSFER", label: "Transfer", icon: CreditCard },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setPayment(m.id)}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold text-xs border transition ${
                payment === m.id
                  ? "bg-blue-50 border-blue-500 text-blue-600 font-bold"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <m.icon className="w-3.5 h-3.5" />
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isTunai ? (
        <div className="space-y-2">
          <label className="block font-semibold text-slate-700 text-xs">Nominal Uang Diterima</label>
          <input
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2.5 text-base font-bold font-mono focus:outline-none focus:border-blue-500"
            inputMode="numeric"
            value={paid}
            onChange={(e) => setPaid(e.target.value.replace(/\D/g, ""))}
            placeholder="0"
          />
          {quickCash.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {quickCash.map((qc, i) => (
                <button
                  key={i}
                  onClick={() => setPaid(String(qc.value === 0 ? total : qc.value))}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-[11px] font-mono transition"
                >
                  {qc.label}
                </button>
              ))}
            </div>
          )}
          {paidNum > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
              <span className="text-slate-500">Kembalian Kasir</span>
              <span className={`font-mono font-bold text-sm ${change < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {rupiah(change)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-blue-800 text-[11px] text-center">
          Pembayaran non-tunai ({payment}) diverifikasi sesuai total tagihan {rupiah(total)}.
        </div>
      )}

      <div>
        <input
          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
          placeholder="Catatan pesanan / nama meja (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {err && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <button
        onClick={checkout}
        disabled={busy || lines.length === 0}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition disabled:opacity-50 text-sm cursor-pointer"
      >
        {busy ? "Menyimpan Transaksi..." : `Selesaikan & Bayar ${rupiah(total)}`}
      </button>
    </div>
  );

  return (
    <div className="lg:grid lg:gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4 pb-28 lg:pb-0">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cari menu minuman, kopi, atau makanan..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500 transition font-medium"
              />
            </div>
            <span className="text-xs text-slate-500">
              Menampilkan <strong>{filtered.length}</strong> menu aktif
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`chip-filter ${cat === c ? "active" : ""}`}
              >
                <span>{c === "ALL" ? "Semua Kategori" : c}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((m) => {
            const habis = m.stokPorsi !== null && m.stokPorsi <= 0;
            const inCart = qtyInCart(m.id);
            return (
              <button
                key={m.id}
                onClick={() => tapMenu(m)}
                disabled={habis}
                className={`card-site bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between text-left relative transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  inCart ? "border-blue-500 ring-1 ring-blue-500 shadow-sm" : ""
                }`}
              >
                {inCart > 0 && (
                  <span className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white shadow-xs">
                    {inCart}
                  </span>
                )}

                <div className="space-y-1">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">
                    {m.category}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                    {m.name}
                  </h4>
                </div>

                <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-600 text-sm">
                    {rupiah(m.price)}
                  </span>
                  <div className="flex items-center gap-1">
                    {m.groups.length > 0 && (
                      <span className="pill-slate text-[10px]">+opsi</span>
                    )}
                    {m.stokPorsi !== null && (
                      <span
                        className={`text-[10px] font-bold ${
                          habis ? "text-rose-600" : "text-slate-400 font-mono"
                        }`}
                      >
                        {habis ? "Habis" : `${m.stokPorsi} porsi`}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-xl">
              Menu tidak ditemukan. Coba gunakan kata kunci lain.
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm sticky top-20">
          {cartPanel}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setSheetOpen(true)}
          disabled={lines.length === 0}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition flex items-center justify-between px-4 text-sm disabled:opacity-40"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <span>{lines.length ? `${totalQty} Item Pesanan` : "Keranjang Kosong"}</span>
          </span>
          <span className="font-mono">{rupiah(total)} · Bayar ›</span>
        </button>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl border-t border-slate-200">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300" />
            {cartPanel}
          </div>
        </div>
      )}

      {chooser && (
        <VariantChooser
          key={chooser.editKey || chooser.menu.id}
          menu={chooser.menu}
          initOptionIds={chooser.initOptionIds}
          initNote={chooser.initNote}
          editing={!!chooser.editKey}
          onCancel={() => setChooser(null)}
          onAdd={(opts, n) => applyChoice(chooser.menu, opts, n, chooser.editKey)}
        />
      )}
    </div>
  );
}

function VariantChooser({
  menu,
  initOptionIds,
  initNote,
  editing,
  onCancel,
  onAdd,
}: {
  menu: PosMenu;
  initOptionIds: string[];
  initNote: string;
  editing: boolean;
  onCancel: () => void;
  onAdd: (options: PosOption[], note: string) => void;
}) {
  const initSel: Record<string, string[]> = {};
  for (const g of menu.groups) {
    const picked = g.options.filter((o) => initOptionIds.includes(o.id)).map((o) => o.id);
    if (picked.length) initSel[g.id] = picked;
  }
  const [sel, setSel] = useState<Record<string, string[]>>(initSel);
  const [note, setNote] = useState(initNote);
  const [err, setErr] = useState("");

  function toggle(group: PosGroup, opt: PosOption) {
    setErr("");
    setSel((s) => {
      const cur = s[group.id] || [];
      if (group.type === "SINGLE") return { ...s, [group.id]: [opt.id] };
      return cur.includes(opt.id)
        ? { ...s, [group.id]: cur.filter((x) => x !== opt.id) }
        : { ...s, [group.id]: [...cur, opt.id] };
    });
  }

  function submit() {
    for (const g of menu.groups) {
      if (g.required && !(sel[g.id]?.length)) {
        setErr(`Pilih varian ${g.name} terlebih dahulu`);
        return;
      }
    }
    const chosen: PosOption[] = [];
    for (const g of menu.groups) {
      for (const oid of sel[g.id] || []) {
        const o = g.options.find((x) => x.id === oid);
        if (o) chosen.push(o);
      }
    }
    onAdd(chosen, note);
  }

  const extra = menu.groups
    .flatMap((g) => (sel[g.id] || []).map((oid) => g.options.find((o) => o.id === oid)))
    .reduce((s, o) => s + (o?.priceDelta || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 leading-tight">{menu.name}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{rupiah(menu.price)}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {menu.groups.map((g) => (
            <div key={g.id} className="space-y-2">
              <div className="font-semibold text-slate-700 flex items-center justify-between">
                <span>
                  {g.name}
                  {g.required && <span className="ml-1 text-rose-500">*</span>}
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {g.type === "SINGLE" ? "Pilih satu" : "Boleh banyak"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.options.map((o) => {
                  const on = (sel[g.id] || []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggle(g, o)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                        on
                          ? "bg-blue-50 border-blue-500 text-blue-600 font-semibold shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{o.name}</span>
                      {o.priceDelta ? <span className="font-mono font-bold ml-1">+{rupiah(o.priceDelta)}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="pt-1">
            <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              placeholder="Contoh: Less sugar, extra ice, sedotan dipisah"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {err && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="font-mono">
            <span className="text-[11px] text-slate-400 block">Total Item</span>
            <span className="font-bold text-sm text-slate-900">{rupiah(menu.price + extra)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={submit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-sm transition"
            >
              {editing ? "Simpan Perubahan" : "+ Tambah ke Pesanan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
