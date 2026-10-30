// Submits the payment and returns the URL of the confirmation page.
export async function submitPayment(fetchImpl = fetch) {
  const res = await fetchImpl("/api/pay", {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`Payment failed (${res.status})`);
  const { order } = await res.json();
  if (!order) throw new Error("Payment response had no order number");
  return `/order-confirmation?order=${encodeURIComponent(order)}`;
}
