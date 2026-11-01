export function bind(target, handler) {
  target.addEventListener("submit", handler);
}
