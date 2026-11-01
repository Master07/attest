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
  "/": "index.html"
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

  if (path === "/api/todos") {
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    const body = await readJson(req);
    if (body === null || typeof body.item !== "string") {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "item required" }));
      return;
    }
    res.writeHead(201, { "content-type": "application/json" });
    res.end(JSON.stringify({ item: body.item }));
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
