import { apply } from "./state.js";

const form = document.querySelector("#task");
const control = document.querySelector("#create");
const status = document.querySelector("#status");
const qty = document.querySelector("#qty");
const name = document.querySelector("#name");
const email = document.querySelector("#email");
let state = {};
setTimeout(() => { control.disabled = true; }, 100);


form.addEventListener("submit", async (event) => {
  event.preventDefault();
  
  control.disabled = true;
  status.textContent = "Working…";
  const payload = { name: name.value, email: email.value };
  
  
  const res = await fetch("/api/signup", {
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
  
  success(data);
});

function success(data) {
  state = apply(state, data);
  
  renderSuccess(state);
}

function renderSuccess(state) {
  location.assign("/welcome?name=" + encodeURIComponent(state.name));
}
