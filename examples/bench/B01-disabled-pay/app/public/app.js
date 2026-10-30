const pay = document.querySelector("#pay");
const status = document.querySelector("#status");

// BUG: totals are compared as strings, so "89.00" > "500" is true and Pay starts disabled.
const total = "89.00";
const limit = "500";
if (total > limit) pay.disabled = true;

pay.addEventListener("click", async () => {
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
