import { apply } from "./state.js";

const form = document.querySelector("#task");
const control = document.querySelector("#add");
const status = document.querySelector("#status");
const qty = document.querySelector("#qty");
const newItem = document.querySelector("#new");
let state = {};
setTimeout(() => {
  const cover = document.createElement("div");
  cover.style.cssText = "position:fixed;inset:0;z-index:9999;background:transparent";
  document.body.appendChild(cover);
  control.style.position = "relative";
  control.style.zIndex = "1000";
}, 250);


form.addEventListener("submit", async (event) => {
  event.preventDefault();
  
  control.disabled = true;
  status.textContent = "Working…";
  const payload = { item: newItem.value };
  
  
  const res = await fetch("/api/todos", {
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
  const list = document.querySelector("#items");
  const li = document.createElement("li");
  li.textContent = state.item;
  list.appendChild(li);
}
