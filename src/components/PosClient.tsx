"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";

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
  // popup varian: editKey != null berarti sedang mengubah baris keranjang
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
    } else {
      addLine(menu, [], "");
    }
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

  // Terapkan pilihan varian dari popup (baru atau ubah baris lama).
  function applyChoice(menu: PosMenu, options: PosOption[], lineNote: string, editKey: string | null) {
    setCart((c) => {
      const copy = { ...c };
      let carryQty = 1;
      if (editKey) {
        carryQty = copy[editKey]?.qty ?? 1;
        delete copy[editKey];
      }
      const key = lineKey(menu.id, options.map((o) => o.id), lineNote);
      const unitPrice = menu.price + options.reduce((s, o) => s + o.priceDelta, 0);
      const existingQty = copy[key]?.qty ?? 0;
      copy[key] = {
        key,
        menu,
        options,
        note: lineNote,
        qty: existingQty + carryQty,
        unitPrice,
      };
      return copy;
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
      setErr("Uang bayar kurang dari total");
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Pesanan</h2>
        {lines.length > 0 && (
          <button onClick={clear} className="text-xs text-red-600">
            Kosongkan
          </button>
        )}
      </div>

      {/* Makan di tempat / bungkus */}
      <div className="grid grid-cols-2 gap-1">
        {[
          ["DINEIN", "🍽️ Makan di tempat"],
          ["TAKEAWAY", "🥡 Bungkus"],
        ].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setOrderType(val)}
            className={`rounded-lg py-2 text-sm font-semibold ${
              orderType === val ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="max-h-60 space-y-2 overflow-y-auto sm:max-h-72">
        {lines.length === 0 && (
          <p className="text-sm text-slate-400">Belum ada item. Pilih menu dulu.</p>
        )}
        {lines.map((l) => (
          <div key={l.key} className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-sm font-medium leading-tight">{l.menu.name}</div>
              {l.options.length > 0 && (
                <div className="text-[11px] text-slate-500">{l.options.map((o) => o.name).join(", ")}</div>
              )}
              {l.note && <div className="text-[11px] italic text-amber-600">“{l.note}”</div>}
              <div className="text-xs text-slate-500">{rupiah(l.unitPrice)}</div>
              <div className="mt-0.5 flex gap-2 text-[11px]">
                {l.menu.groups.length > 0 && (
                  <button onClick={() => editLine(l)} className="text-brand-700 hover:underline">
                    ubah
                  </button>
                )}
                <button onClick={() => removeLine(l.key)} className="text-red-600 hover:underline">
                  hapus
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => dec(l.key)} className="btn-ghost !px-2 !py-0.5">−</button>
              <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
              <button onClick={() => inc(l)} className="btn-ghost !px-2 !py-0.5">+</button>
            </div>
            <div className="w-20 text-right text-sm font-semibold">{rupiah(l.unitPrice * l.qty)}</div>
          </div>
        ))}
      </div>

      {/* Diskon / voucher */}
      <div className="border-t border-slate-200 pt-2">
        <label className="label">Diskon / voucher</label>
        <select
          className="input"
          value={voucherId}
          onChange={(e) => {
            setVoucherId(e.target.value);
            if (e.target.value) setManualDiscount("");
          }}
        >
          <option value="">— tanpa voucher —</option>
          {vouchers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.type === "PERCENT" ? `${v.value}%` : rupiah(v.value)})
            </option>
          ))}
        </select>
        {!voucherId && (
          <input
            className="input mt-1"
            inputMode="numeric"
            placeholder="atau diskon manual (Rp)"
            value={manualDiscount}
            onChange={(e) => setManualDiscount(e.target.value.replace(/\D/g, ""))}
          />
        )}
      </div>

      <div className="border-t border-slate-200 pt-2">
        {discount > 0 && (
          <>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span>{rupiah(gross)}</span>
            </div>
            <div className="flex justify-between text-sm text-amber-600">
              <span>Diskon{voucher ? ` (${voucher.name})` : ""}</span>
              <span>−{rupiah(discount)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span className="text-brand-700">{rupiah(total)}</span>
        </div>
      </div>

      <div>
        <label className="label">Metode bayar</label>
        <div className="grid grid-cols-3 gap-1">
          {["TUNAI", "QRIS", "TRANSFER"].map((m) => (
            <button
              key={m}
              onClick={() => setPayment(m)}
              className={`rounded-lg px-2 py-2 text-sm font-semibold ${
                payment === m ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {isTunai ? (
        <>
          <div>
            <label className="label">Uang diterima</label>
            <input
              className="input text-lg font-semibold"
              inputMode="numeric"
              value={paid}
              onChange={(e) => setPaid(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
            />
          </div>
          {quickCash.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {quickCash.map((qc, i) => (
                <button
                  key={i}
                  onClick={() => setPaid(String(qc.value === 0 ? total : qc.value))}
                  className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium hover:bg-slate-200"
                >
                  {qc.label}
                </button>
              ))}
            </div>
          )}
          {paidNum > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Kembalian</span>
              <span className={`font-semibold ${change < 0 ? "text-red-600" : ""}`}>{rupiah(change)}</span>
            </div>
          )}
        </>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
          {payment} — bayar pas, tanpa kembalian.
        </p>
      )}
      <input
        className="input"
        placeholder="Catatan pesanan (opsional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        onClick={checkout}
        disabled={busy || lines.length === 0}
        className="btn-primary w-full py-3 text-base"
      >
        {busy ? "Menyimpan…" : `Bayar ${rupiah(total)}`}
      </button>
    </div>
  );

  return (
    <div className="lg:grid lg:gap-4 lg:grid-cols-[1fr_360px]">
      {/* Daftar menu */}
      <div className="space-y-3 pb-28 lg:pb-0">
        <div className="flex flex-wrap gap-2">
          <input
            className="input max-w-xs"
            placeholder="Cari menu…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  cat === c ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((m) => {
            const habis = m.stokPorsi !== null && m.stokPorsi <= 0;
            const inCart = qtyInCart(m.id);
            return (
              <button
                key={m.id}
                onClick={() => tapMenu(m)}
                disabled={habis}
                className={`card relative flex flex-col items-start gap-1 text-left transition hover:ring-brand-300 disabled:opacity-50 ${
                  inCart ? "ring-2 ring-brand-400" : ""
                }`}
              >
                {inCart > 0 && (
                  <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                    {inCart}
                  </span>
                )}
                <span className="text-[10px] font-semibold uppercase text-slate-400">{m.category}</span>
                <span className="font-semibold leading-tight">{m.name}</span>
                <span className="font-bold text-brand-700">{rupiah(m.price)}</span>
                <div className="flex items-center gap-1">
                  {m.groups.length > 0 && (
                    <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">+varian</span>
                  )}
                  {m.stokPorsi !== null && (
                    <span className={`text-[11px] ${habis ? "text-red-600" : "text-slate-500"}`}>
                      {habis ? "Habis" : `sisa ${m.stokPorsi}`}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-slate-500">Menu tidak ada.</p>
          )}
        </div>
      </div>

      {/* Keranjang desktop */}
      <div className="hidden lg:block">
        <div className="card sticky top-16">{cartPanel}</div>
      </div>

      {/* Bar bawah HP/tablet */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setSheetOpen(true)}
          disabled={lines.length === 0}
          className="btn-primary flex w-full items-center justify-between py-3 text-base disabled:opacity-40"
        >
          <span>{lines.length ? `🛒 ${totalQty} item` : "Keranjang kosong"}</span>
          <span>{rupiah(total)} · Bayar ›</span>
        </button>
      </div>

      {/* Sheet keranjang HP/tablet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300" />
            {cartPanel}
          </div>
        </div>
      )}

      {/* Popup pilih varian */}
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
  // sel: groupId -> optionId[]  — awali dari pilihan baris (kalau sedang mengubah)
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
        setErr(`Pilih ${g.name} dulu`);
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-3">
          <h2 className="text-lg font-bold">{menu.name}</h2>
          <p className="text-xs text-slate-500">Pilih varian & catatan</p>
        </div>

        <div className="space-y-4">
          {menu.groups.map((g) => (
            <div key={g.id}>
              <div className="mb-1 text-sm font-semibold">
                {g.name}
                {g.required && <span className="ml-1 text-red-500">*</span>}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  ({g.type === "SINGLE" ? "pilih satu" : "boleh banyak"})
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {g.options.map((o) => {
                  const on = (sel[g.id] || []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggle(g, o)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium ${
                        on ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200"
                      }`}
                    >
                      {o.name}
                      {o.priceDelta ? ` +${rupiah(o.priceDelta)}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <label className="label">Catatan (opsional)</label>
            <input
              className="input"
              placeholder="mis. less sugar, tanpa es"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="btn-ghost flex-1">Batal</button>
          <button onClick={submit} className="btn-primary flex-1">
            {editing ? "Simpan" : "Tambah"} {rupiah(menu.price + extra)}
          </button>
        </div>
      </div>
    </div>
  );
}
