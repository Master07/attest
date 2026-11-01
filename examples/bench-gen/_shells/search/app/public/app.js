import { apply } from "./state.js";

const form = document.querySelector("#task");
const control = document.querySelector("#go");
const status = document.querySelector("#status");
const qty = document.querySelector("#qty");
const query = document.querySelector("#q");
let state = {};
/*@init*/

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  /*@pre-submit*/
  control.disabled = true;
  status.textContent = "Working…";
  let q = query.value;
  /*@after-payload*/
  /*@pre-request*/
  const res = await fetch("/api/search?q=" + encodeURIComponent(q), { method: "GET" });
  /*@post-request*/
  if (!res.ok) {
    status.textContent = "Something went wrong. Please try again.";
    control.disabled = false;
    return;
  }
  const data = await res.json();
  /*@pre-success*/
  success(data);
});

function success(data) {
  state = apply(state, data);
  /*@render*/
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
