// Dev utility: screenshots + horizontal-overflow check using Chrome DevTools
// Protocol with true device emulation. Usage:
//   node scripts/shoot.mjs <baseUrl> <outDir> [cookie] -- name:path:width[:height] ...
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [base, outDir, maybeCookie, ...rest] = process.argv.slice(2);
const cookie = maybeCookie === "--" ? null : maybeCookie;
const specs = (maybeCookie === "--" ? rest : rest.slice(1)).map((s) => {
  const [name, path, w, h] = s.split(":");
  return { name, path, width: Number(w), height: Number(h ?? 900) };
});
mkdirSync(outDir, { recursive: true });

const chromePath = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9333;
const chrome = spawn(chromePath, [
  "--headless=new", `--remote-debugging-port=${port}`, "--disable-gpu", "--hide-scrollbars",
  `--user-data-dir=${resolve(outDir, ".profile")}`, "about:blank",
], { stdio: "ignore" });

async function waitForTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await waitForTarget());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else listeners.forEach((l) => l(msg));
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send("Page.enable");
if (cookie) {
  const [name, value] = cookie.split("=");
  await send("Network.setCookie", { name, value, url: base });
}
for (const s of specs) {
  await send("Emulation.setDeviceMetricsOverride", { width: s.width, height: s.height, deviceScaleFactor: 1, mobile: s.width < 600 });
  const loaded = new Promise((r) => {
    const l = (m) => m.method === "Page.loadEventFired" && (listeners.splice(listeners.indexOf(l), 1), r());
    listeners.push(l);
  });
  await send("Page.navigate", { url: base + s.path });
  await loaded;
  await new Promise((r) => setTimeout(r, 700));
  if (process.env.PRESCROLL) {
    // Scroll through the page so scroll-triggered reveals run before capture.
    await send("Runtime.evaluate", { expression: "(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=400){scrollTo(0,y);await new Promise(r=>setTimeout(r,120))}scrollTo(0,0);await new Promise(r=>setTimeout(r,1200))})()", awaitPromise: true });
  }
  const metrics = await send("Runtime.evaluate", {
    expression: "JSON.stringify({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight})",
    returnByValue: true,
  });
  const m = JSON.parse(metrics.result.result.value);
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: s.width, height: Math.min(m.h, s.height * 4), scale: 1 },
  });
  writeFileSync(resolve(outDir, `${s.name}.png`), Buffer.from(shot.result.data, "base64"));
  console.log(`${s.name}: ${s.width}px  scrollWidth=${m.sw}  ${m.sw > m.cw ? "OVERFLOW" : "ok"}`);
  if (process.env.EVAL) console.log("  eval:", (await send("Runtime.evaluate", { expression: process.env.EVAL, returnByValue: true })).result?.result?.value);
}
ws.close();
chrome.kill();
