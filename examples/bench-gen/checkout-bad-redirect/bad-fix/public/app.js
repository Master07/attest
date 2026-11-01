import { apply } from "./state.js";
import { redirectPath } from "./redirectPath.js";

const form = document.querySelector("#task");
const control = document.querySelector("#pay");
const status = document.querySelector("#status");
const qty = document.querySelector("#qty");

let state = {};


form.addEventListener("submit", async (event) => {
  event.preventDefault();
  
  control.disabled = true;
  status.textContent = "Working…";
  const payload = { amount: 89 };
  
  
  const res = await fetch("/api/pay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    status.textContent = "Something went wrong. Please try again.";
    control.disabled = false;
    return;
  }
  const data = await res.json();
  location.assign(redirectPath());
return;

  success(data);
});

function success(data) {
  state = apply(state, data);
  
  renderSuccess(state);
}

function renderSuccess(state) {
  if (state.order === undefined) return;
  location.assign("/order-confirmation?order=" + state.order);
}
