export function rupiah(n: number): string {
  return "Rp" + (n || 0).toLocaleString("id-ID");
}

export function waktu(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function jam(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
