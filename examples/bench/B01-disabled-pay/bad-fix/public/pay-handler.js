export async function sendPayment(fetchImpl) {
  const res = await fetchImpl("/api/pay", { method: "POST" });
  if (!res.ok) return { ok: false };
  const { order } = await res.json();
  return { ok: true, order };
}
