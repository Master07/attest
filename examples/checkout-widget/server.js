import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "public");
const port = Number(process.env.PORT ?? 4100);
const ORDER_NUMBER = 1042;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const PAGES = {
  "/": "cart.html",
  "/cart": "cart.html",
  "/order-confirmation": "confirmation.html",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "POST" && url.pathname === "/api/pay") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ order: ORDER_NUMBER }));
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405).end();
    return;
  }

  const file = normalize(join(root, PAGES[url.pathname] ?? url.pathname));
  if (!file.startsWith(root + sep)) {
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
  console.log(`checkout-demo listening on http://localhost:${port}`);
});
