// Dev utility: drives the editor in headless Chrome to check selection, the
// inspector layout (no horizontal overflow), library insert, drag-and-drop
// from the library onto the canvas, a design toggle and autosave.
// Usage (Git Bash: prefix with MSYS_NO_PATHCONV=1):
//   node scripts/editor-check.mjs <baseUrl> <sessionCookie name=value> </editor/:id> [width]
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const [base, cookie, path, widthArg] = process.argv.slice(2);
const width = Number(widthArg ?? 1100);
const PORT = 9400 + Math.floor(Math.random() * 500);
mkdirSync(".shots", { recursive: true });
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe",
  ["--headless=new", `--remote-debugging-port=${PORT}`, "--disable-gpu", `--user-data-dir=${process.cwd()}/.shots/.p${PORT}`, "about:blank"], { stdio: "ignore" });
let url;
for (let i = 0; i < 50 && !url; i++) {
  try { url = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {}
  await new Promise((r) => setTimeout(r, 200));
}
const ws = new WebSocket(url);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  else if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description);
  else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
};
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true }); return r.result?.exceptionDetails ? "EXC " + r.result.exceptionDetails.exception?.description : r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const center = async (sel) => JSON.parse(await ev(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`));
async function drag(from, to) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x, y: from.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", clickCount: 1 });
  for (let i = 1; i <= 12; i++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12, button: "left", buttons: 1 });
    await sleep(30);
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", clickCount: 1 });
}
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`); if (!ok) failures++; };

await send("Runtime.enable"); await send("Page.enable");
const [n, v] = cookie.split("=");
await send("Network.setCookie", { name: n, value: v, url: base });
await send("Emulation.setDeviceMetricsOverride", { width, height: 850, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: base + path });
await sleep(3000);

const blocks = () => ev(`document.querySelectorAll('.editor-block').length`);
const before = await blocks();
check("canvas renders blocks", before > 0, String(before));
check("preview defaults to desktop on a wide screen", (await ev(`document.querySelector('[aria-label="Preview device"] [aria-pressed="true"]')?.textContent`)) === "desktop");

// Select the intro on the canvas.
await ev(`[...document.querySelectorAll('.editor-block')].find(b=>b.querySelector('.rp-intro')).click()`);
await sleep(300);
const inspectorVisible = await ev(`!!document.querySelector('h2') && [...document.querySelectorAll('h2')].some(h=>h.textContent==='Intro')`);
check("clicking a block opens its settings", inspectorVisible);

// Type a very long tagline; the side panel must not overflow horizontally.
await ev(`(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.previousElementSibling?.textContent==='Tagline'||x.closest('.field')?.querySelector('label')?.textContent==='Tagline');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'A weekly letter about walking, maps and small towns, and everything in between them');i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
await sleep(400);
const overflow = await ev(`(()=>{const p=document.getElementById('editor-tabpanel')||document.querySelector('aside[aria-label="Block settings"] > div');return JSON.stringify({sw:p.scrollWidth,cw:p.clientWidth})})()`);
const o = JSON.parse(overflow);
check("settings panel has no horizontal overflow", o.sw <= o.cw, overflow);
await send("Page.captureScreenshot", { format: "png" }).then((s) => writeFileSync(`.shots/check-inspector-${width}.png`, Buffer.from(s.result.data, "base64")));

// Library: click to insert.
await ev(`document.getElementById('tab-add').click()`);
await sleep(300);
await ev(`document.querySelector('[aria-label="Add Featured link"]').click()`);
await sleep(400);
check("clicking a library item inserts a block", (await blocks()) === before + 1);

// Drag a library component onto the canvas end drop zone.
await ev(`document.getElementById('tab-add').click()`);
await sleep(300);
await ev(`(()=>{const i=document.getElementById('lib-search');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'quote');i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
await sleep(300);
await ev(`document.querySelector('.editor-dropzone').scrollIntoView({block:'center'})`);
await sleep(300);
const from = await center('[aria-label="Add Quote — card"]');
const to = await center(".editor-dropzone");
await drag(from, to);
await sleep(600);
const after = await blocks();
check("dragging a library item onto the canvas inserts it", after === before + 2, `${before} → ${after}`);
check("dropped block is a quote card", await ev(`!!document.querySelector('.editor-block .rp-quote[data-variant="card"]')`));

// Design: glassmorphism toggle.
await ev(`document.getElementById('tab-design').click()`);
await sleep(300);
const glassBefore = await ev(`document.querySelector('.editor-canvas .rp').dataset.glass`);
await ev(`[...document.querySelectorAll('button[role="switch"]')].find(b=>b.id && document.querySelector('label[for="'+b.id+'"]')?.textContent==='Glassmorphism').click()`);
await sleep(300);
check("glassmorphism toggle applies to the page", (await ev(`document.querySelector('.editor-canvas .rp').dataset.glass`)) === (glassBefore === "on" ? "off" : "on"));
await send("Page.captureScreenshot", { format: "png" }).then((s) => writeFileSync(`.shots/check-design-${width}.png`, Buffer.from(s.result.data, "base64")));

await sleep(2500);
check("autosave completes", (await ev(`document.querySelector('[role=status]')?.textContent`)) === "Saved", await ev(`document.querySelector('[role=status]')?.textContent`));
check("no console errors", errors.length === 0, errors.join(" | ").slice(0, 300));

ws.close();
chrome.kill();
console.log(failures ? `\n${failures} check(s) failed.` : "\nAll editor checks passed.");
process.exit(failures ? 1 : 0);
