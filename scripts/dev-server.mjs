// SermonKit local dev server — serves site/ and wires /api/* to the Vercel
// function modules so the full app flow works locally without a Vercel deploy.
// Usage: node scripts/dev-server.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.argv[2] || 8931);
const ROOT = new URL("..", import.meta.url).pathname;
const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".png": "image/png", ".txt": "text/plain",
  ".xml": "application/xml", ".webm": "audio/webm", ".mp4": "audio/mp4",
};

const modules = {
  "generate-suite": (await import("../api/generate-suite.js")).default,
  track: (await import("../api/track.js")).default,
  transcribe: (await import("../api/transcribe.js")).default,
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const apiMatch = url.pathname.match(/^\/api\/([\w-]+)$/);
    if (apiMatch && modules[apiMatch[1]]) {
      const fn = modules[apiMatch[1]];
      // adapt to the Web-ish req/res the Vercel handlers expect
      if (req.method === "POST") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const raw = Buffer.concat(chunks);
        const ct = req.headers["content-type"] || "";
        req.body = raw.length && ct.includes("application/json") ? JSON.parse(raw.toString()) : raw;
      }
      const shim = {
        status(c) { res.statusCode = c; return shim; },
        setHeader: (k, v) => res.setHeader(k, v),
        json(j) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(j)); return shim; },
        end(b) { res.end(b); return shim; },
      };
      return fn(req, shim);
    }
    let path = join(ROOT, "site", decodeURIComponent(url.pathname));
    if (url.pathname === "/") path = join(ROOT, "site", "index.html");
    path = normalize(path);
    if (!path.startsWith(join(ROOT, "site"))) { res.writeHead(403); return res.end(); }
    try {
      const data = await readFile(path);
      res.writeHead(200, { "Content-Type": MIME[extname(path)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  } catch (e) {
    console.error(e);
    res.writeHead(500); res.end("error");
  }
});
server.listen(PORT, () => console.log(`dev server on http://127.0.0.1:${PORT}`));
