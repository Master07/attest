export async function sendPayment(fetchImpl, endpoint = "/api/pay") {
  const res = await fetchImpl(endpoint, { method: "POST" });
  if (!res.ok) throw new Error("payment failed: " + res.status);
  return res.json();
}
