import { apply } from "./state.js";

const form = document.querySelector("#task");
const control = document.querySelector("#add");
const status = document.querySelector("#status");
const qty = document.querySelector("#qty");
const newItem = document.querySelector("#new");
let state = {};
/*@init*/

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  /*@pre-submit*/
  control.disabled = true;
  status.textContent = "Working…";
  const payload = { item: newItem.value };
  /*@after-payload*/
  /*@pre-request*/
  const res = await fetch("/api/todos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
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
  const list = document.querySelector("#items");
  const li = document.createElement("li");
  li.textContent = state.item;
  list.appendChild(li);
}
