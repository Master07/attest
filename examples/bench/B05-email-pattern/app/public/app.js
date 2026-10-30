import { validateEmail } from "./validate.js";

const form = document.querySelector("#checkout");
const status = document.querySelector("#status");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.querySelector("#email").value;
  if (!validateEmail(email)) {
    status.textContent = "Enter a valid email address.";
    return;
  }

  status.textContent = "Processing…";
  const res = await fetch("/api/pay", { method: "POST" });
  if (!res.ok) {
    status.textContent = "Payment failed. Please try again.";
    return;
  }

  const { order } = await res.json();
  location.assign("/order-confirmation?order=" + order);
});
