export function formatPrice(value) {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n.toFixed(2) : "";
}
