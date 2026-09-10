// Konversi satuan BELI → satuan DASAR (stok disimpan dalam satuan dasar).
// Liter → ml (×1000), Kg → gram (×1000). Kalau pasangan tak dikenal → null
// (pemanggil pakai buyFactor manual). Dipakai saat buat/edit bahan & restok.

const ML = ["ml", "mililiter", "milliliter", "cc"];
const GRAM = ["g", "gr", "gram", "grams"];
const LITER = ["l", "lt", "ltr", "liter", "litre", "liter(l)"];
const KILO = ["kg", "kgs", "kilo", "kilogram", "kilograms"];

function norm(u: string): string {
  return u.trim().toLowerCase();
}

/**
 * Faktor konversi dari `buyUnit` ke `baseUnit`.
 * - Satuan sama → 1.
 * - Liter → ml / Kg → gram → 1000.
 * - Tak dikenal → null (caller fallback ke buyFactor manual).
 */
export function autoBuyFactor(baseUnit: string, buyUnit?: string | null): number | null {
  if (!buyUnit) return null;
  const base = norm(baseUnit);
  const buy = norm(buyUnit);
  if (!base || !buy) return null;
  if (base === buy) return 1;
  if (ML.includes(base) && LITER.includes(buy)) return 1000;
  if (GRAM.includes(base) && KILO.includes(buy)) return 1000;
  return null;
}
