// Starts the app's own Vite dev server on $PORT, bound to 127.0.0.1. Lives in Attest's config dir, not in their tree.
const { spawn } = require("node:child_process");
const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(process.env.PORT), "--strictPort"], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
