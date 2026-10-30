import { submitPayment } from "./pay.js";

const pay = document.querySelector("#pay");
const status = document.querySelector("#status");

pay.addEventListener("click", async (event) => {
  event.preventDefault();
  pay.disabled = true;
  status.textContent = "Processing…";

  try {
    location.assign(await submitPayment());
  } catch (err) {
    status.textContent = `${err.message}. Please try again.`;
    pay.disabled = false;
  }
});
