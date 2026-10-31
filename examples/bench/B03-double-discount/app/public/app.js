const pay = document.querySelector("#pay");
const status = document.querySelector("#status");

const total = Math.round(89 * 0.9 * 0.9 * 100) / 100;
document.querySelector("#total").textContent = "$" + total.toFixed(2);
pay.textContent = "Pay $" + total.toFixed(2);

pay.addEventListener("click", async () => {
  pay.disabled = true;
  status.textContent = "Processing…";

  const res = await fetch("/api/pay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: total }),
  });
  if (!res.ok) {
    status.textContent = "Payment failed. Please try again.";
    pay.disabled = false;
    return;
  }

  const { order } = await res.json();
  location.assign("/order-confirmation?order=" + order);
});
