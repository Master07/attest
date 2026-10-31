const pay = document.querySelector("#pay");
const status = document.querySelector("#status");

const price = Number("$89.00");
pay.textContent = "Pay $" + price.toFixed(2);

pay.addEventListener("click", async () => {
  if (!Number.isFinite(price)) return;

  pay.disabled = true;
  status.textContent = "Processing…";

  const res = await fetch("/api/pay", { method: "POST" });
  if (!res.ok) {
    status.textContent = "Payment failed. Please try again.";
    pay.disabled = false;
    return;
  }

  const { order } = await res.json();
  location.assign("/order-confirmation?order=" + order);
});
