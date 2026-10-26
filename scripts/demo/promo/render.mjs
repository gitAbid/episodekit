// Render promo.html frame-by-frame with headless Chrome (CDP, no deps).
// Usage: node scripts/demo/promo/render.mjs landscape|portrait [outDir] [fps] [only=t1,t2,…]
// Writes <outDir>/<mode>/%05d.jpg; `only` renders single stills at the given times (for QC).
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MODE = process.argv[2] === "portrait" ? "portrait" : "landscape";
const OUT = join(process.argv[3] || "out/promo/frames", MODE);
const FPS = Number(process.argv[4] || 30);
const ONLY = (process.argv[5] || "").replace(/^only=/, "").split(",").filter(Boolean).map(Number);
const [W, H] = MODE === "portrait" ? [1080, 1920] : [1920, 1080];
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9334 + (MODE === "portrait" ? 1 : 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = pathToFileURL(resolve("scripts/demo/promo/promo.html")).href + (MODE === "portrait" ? "?portrait" : "");

mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "ek-promo-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--hide-scrollbars", "--force-color-profile=srgb", "--no-first-run", "--allow-file-access-from-files", "about:blank",
], { stdio: "ignore" });

let ws, seq = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function evaluate(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text) + " in: " + expr.slice(0, 80));
  return r.result.value;
}

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
  }
  if (!target) throw new Error("Chrome did not start");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: page });
  await evaluate(`new Promise(r => document.readyState === "complete" ? r() : addEventListener("load", r))`);
  await evaluate(`window.__ready`);
  if (!(await evaluate(`document.fonts.check("700 40px Inter")`))) throw new Error("Inter did not load");

  const dur = await evaluate("window.__duration");
  const times = ONLY.length ? ONLY : Array.from({ length: Math.round(dur * FPS) }, (_, i) => i / FPS);
  const t0 = Date.now();
  for (let i = 0; i < times.length; i++) {
    await evaluate(`window.__render(${times[i]}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 94, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    const name = ONLY.length ? `t${String(times[i]).replace(".", "_")}.jpg` : String(i).padStart(5, "0") + ".jpg";
    writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
    if (i % 150 === 0) console.log(`${MODE} ${i}/${times.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`${MODE}: ${times.length} frames → ${OUT}`);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
