/**
 * QRIS dinamis dari QRIS statis (mis. QRIS GoPay Merchant) — versi web, sama
 * persis dengan lib/services/qris.dart di aplikasi HP. Format QRIS = TLV
 * [ID 2][PANJANG 2][NILAI], diakhiri tag 63 = CRC16-CCITT-FALSE.
 * Bernominal: sisipkan tag 54 (nominal), buang 55/56/57 (lihat qrisWithAmount).
 * Data merchant (tag 26-51) tidak diubah → uang tetap ke merchant yang sama.
 * Modul MURNI (tanpa server import) — aman dipakai komponen client.
 */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) & 0xff) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseQris(payload: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) throw new Error("QRIS terpotong");
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!Number.isInteger(len) || i + 4 + len > payload.length) throw new Error(`Panjang tag ${tag} tidak valid`);
    out.push([tag, payload.slice(i + 4, i + 4 + len)]);
    i += 4 + len;
  }
  return out;
}

/** null kalau valid, atau pesan kesalahan. */
export function validateQris(raw: string): string | null {
  const p = (raw || "").trim();
  if (!p) return "QRIS kosong";
  if (!p.startsWith("000201")) return "Bukan QRIS (harus diawali 000201)";
  try {
    const tags = parseQris(p);
    const last = tags[tags.length - 1];
    if (!last || last[0] !== "63") return "Tag CRC (63) tidak ada di akhir";
    if (crc16(p.slice(0, -4)) !== last[1].toUpperCase()) return "CRC QRIS tidak cocok (salah salin?)";
    if (!tags.some((t) => t[0] === "58")) return "Tag negara (58) tidak ada";
  } catch (e) {
    return (e as Error).message;
  }
  return null;
}

export function qrisMerchantName(raw: string): string {
  try {
    return parseQris(raw.trim()).find((t) => t[0] === "59")?.[1] || "";
  } catch {
    return "";
  }
}

/**
 * QRIS bernominal. Default TETAP bertanda statis (tag 01 "11") — uji nyata 7 Nov
 * 2026: QR statis+nominal → GoPay Merchant kirim notif "Pembayaran QRIS statis
 * diterima Rp …" (deteksi otomatis jalan); versi dinamis ("12") uang masuk tapi
 * tanpa notif. `dynamic: true` → tandai dinamis.
 */
export function qrisWithAmount(staticPayload: string, amount: number, opts: { dynamic?: boolean } = {}): string {
  if (!(amount > 0)) throw new Error("Nominal harus > 0");
  const err = validateQris(staticPayload);
  if (err) throw new Error(err);
  const tags = parseQris(staticPayload.trim()).filter((t) => !["54", "55", "56", "57", "63"].includes(t[0]));
  if (!tags.some((t) => t[0] === "01")) tags.splice(1, 0, ["01", opts.dynamic ? "12" : "11"]);
  const amt = String(Math.round(amount));
  const tlv = (t: string, v: string) => `${t}${String(v.length).padStart(2, "0")}${v}`;
  let body = "";
  let written = false;
  for (const [t, v] of tags) {
    if (!written && Number(t) > 54) {
      body += tlv("54", amt);
      written = true;
    }
    body += tlv(t, t === "01" && opts.dynamic ? "12" : v);
  }
  if (!written) body += tlv("54", amt);
  body += "6304";
  return body + crc16(body);
}
