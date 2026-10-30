// A "third-party" chat snippet, served by the app from a directory outside its own app dir.
// It injects a transparent full-viewport container 250 ms after load, covering the page.
setTimeout(() => {
  if (document.getElementById("hb-root")) return;

  const root = document.createElement("div");
  root.id = "hb-root";
  root.style.cssText = "position:fixed;inset:0;z-index:9999;background:transparent";

  const launcher = document.createElement("button");
  launcher.id = "hb-launcher";
  launcher.type = "button";
  launcher.textContent = "Chat with us";
  launcher.style.cssText =
    "position:fixed;right:24px;bottom:24px;padding:10px 14px;border:0;border-radius:10px;" +
    "background:#1f5f4a;color:#fff;font:600 14px -apple-system,Segoe UI,Arial;cursor:pointer";

  root.appendChild(launcher);
  document.body.appendChild(root);
}, 250);
