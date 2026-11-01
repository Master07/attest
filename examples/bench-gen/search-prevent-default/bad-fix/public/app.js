import { apply } from "./state.js";

const form = document.querySelector("#task");
const control = document.querySelector("#go");
const status = document.querySelector("#status");
const qty = document.querySelector("#qty");
const query = document.querySelector("#q");
let state = {};
document.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); }, true);


form.addEventListener("submit", async (event) => {
  event.preventDefault();
  
  control.disabled = true;
  status.textContent = "Working…";
  let q = query.value;
  
  
  const res = await fetch("/api/search?q=" + encodeURIComponent(q), { method: "GET" });
  
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
  const list = document.querySelector("#results");
  list.textContent = "";
  for (const item of state.results ?? []) {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  }
}
