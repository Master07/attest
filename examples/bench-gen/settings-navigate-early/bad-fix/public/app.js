import { apply } from "./state.js";
import { soon } from "./soon.js";

const form = document.querySelector("#task");
const control = document.querySelector("#save");
const status = document.querySelector("#status");
const qty = document.querySelector("#qty");
const notify = document.querySelector("#notify");
let state = {};


form.addEventListener("submit", async (event) => {
  event.preventDefault();
  
  control.disabled = true;
  status.textContent = "Working…";
  const payload = { notify: notify.checked, interval: Number(qty.value) };
  
  soon(() => location.reload());
return;

  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    status.textContent = "Something went wrong. Please try again.";
    control.disabled = false;
    return;
  }
  const data = await res.json();
  
  success(data);
});

function success(data) {
  state = apply(state, data);
  
  renderSuccess(state);
}

function renderSuccess(state) {
  status.textContent = state.notify ? "Settings saved" : "Settings off";
}
