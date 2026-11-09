import jsQR from "jsqr";

/**
 * Reads the QR code in a photo or screenshot (browser only), e.g. the QRIS sticker of any bank or wallet.
 * Big photos are scanned at a few sizes, since jsQR misses codes that are tiny or huge relative to the frame.
 * Returns the decoded text, or null when no QR code is found.
 */
export async function readQrFromImage(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    for (const target of [1600, 1000, 600, longest]) {
      const scale = Math.min(1, target / longest);
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const code = jsQR(data.data, w, h, { inversionAttempts: "attemptBoth" });
      if (code?.data) return code.data.trim();
    }
    return null;
  } finally {
    bitmap.close();
  }
}
