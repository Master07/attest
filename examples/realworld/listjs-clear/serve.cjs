// Serves the harness page and the checked-out commit's dist/list.js. Not part of the Attest repo.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const harness = __dirname;

function send(res, file, type) {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": type });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]);
    if (rel === "/" || rel === "/index.html") {
      send(res, path.join(harness, "index.html"), "text/html; charset=utf-8");
      return;
    }
    if (rel === "/list.js") {
      send(res, path.join(root, "dist", "list.js"), "text/javascript");
      return;
    }
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    const ext = path.extname(file);
    const type = ext === ".js" ? "text/javascript" : ext === ".html" ? "text/html; charset=utf-8" : "application/octet-stream";
    send(res, file, type);
  })
  .listen(Number(process.env.PORT || 4300));
