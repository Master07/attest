const pay = document.querySelector("#pay");
const status = document.querySelector("#status");

pay.addEventListener("click", async () => {
  pay.disabled = true;
  status.textContent = "Processing…";

  const res = await fetch("/api/payments", { method: "POST" })   // BUG: the server route is /api/pay;
  if (!res.ok) {
    status.textContent = "Payment failed. Please try again.";
    pay.disabled = false;
    return;
  }

  const { order } = await res.json();
  location.assign("/order-confirmation?order=" + order);
});
