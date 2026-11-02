// Serves a checked-out hypenosys tree. Injects a local card so the dashboard
// starts in the frozen "given" state. The harness files stay outside the Attest repo.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const harness = __dirname;
const mount = fs.readFileSync(path.join(harness, "mount.js"), "utf8");
const style =
  "<style>.hidden{display:none !important}#lightbox-modal{position:fixed;inset:0;z-index:200;background:rgba(2,6,23,.92)}</style>";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

function inject(html) {
  const extra = style + "<script>" + mount + "</script>";
  const at = html.lastIndexOf("</body>");
  if (at === -1) return html + extra;
  return html.slice(0, at) + extra + html.slice(at);
}

http
  .createServer((req, res) => {
    let rel = decodeURIComponent((req.url || "/").split("?")[0]);
    if (rel === "/harness-thumb.svg") {
      fs.readFile(path.join(harness, "thumb.svg"), (err, data) => {
        if (err) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { "content-type": "image/svg+xml" });
        res.end(data);
      });
      return;
    }
    if (rel === "/") rel = "/dashboard.html";
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(path.normalize(root))) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end("Not found");
        return;
      }
      const ext = path.extname(file);
      let body = data;
      if (ext === ".html" && path.basename(file) === "dashboard.html") body = Buffer.from(inject(data.toString("utf8")), "utf8");
      res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
      res.end(body);
    });
  })
  .listen(Number(process.env.PORT || 4300));
