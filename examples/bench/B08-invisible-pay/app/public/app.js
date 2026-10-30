const pay = document.querySelector("#pay");
pay.classList.add("pay--hidden");   // BUG: hides the button after render
const status = document.querySelector("#status");

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
