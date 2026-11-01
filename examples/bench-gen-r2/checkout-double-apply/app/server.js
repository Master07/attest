import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = join(appRoot, "public");
const port = Number(process.env.PORT ?? 4100);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const PAGES = {
  "/": "index.html",
  "/cart": "index.html",
  "/order-confirmation": "confirmation.html"
};

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (path === "/api/pay") {
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    const body = await readJson(req);
    if (body === null || body.amount !== 89) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "amount does not match" }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ order: 1042 }));
    return;
  }

  if (path.startsWith("/api/")) {
    res.writeHead(404).end();
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405).end();
    return;
  }

  if (path === "/order-confirmation" && url.searchParams.get("order") === null) {
    res.writeHead(302, { location: "/cart" });
    res.end();
    return;
  }

  const file = normalize(join(publicRoot, PAGES[path] ?? path));
  if (!file.startsWith(publicRoot + sep)) {
    res.writeHead(404).end("Not found");
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

server.listen(port, () => {
  console.log("bench app listening on http://localhost:" + port);
});
