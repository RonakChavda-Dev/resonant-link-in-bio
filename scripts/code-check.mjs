// Dev utility: verifies the custom-code block end to end in headless Chrome —
// insert from the library, sandboxed render, isolation guarantees, code studio.
// Usage (Git Bash: prefix with MSYS_NO_PATHCONV=1):
//   node scripts/code-check.mjs <baseUrl> <sessionCookie name=value> </editor/:id>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [base, cookie, path] = process.argv.slice(2);
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
};
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (x, contextId) => { const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true, ...(contextId ? { contextId } : {}) }); return r.result?.exceptionDetails ? "EXC " + (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text) : r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`); if (!ok) failures++; };

await send("Runtime.enable"); await send("Page.enable");
const [n, v] = cookie.split("=");
await send("Network.setCookie", { name: n, value: v, url: base });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: base + path });
await sleep(3000);

// Insert the scroll-reveal code preset from the library.
await ev(`document.getElementById('tab-add').click()`);
await sleep(200);
await ev(`(()=>{const i=document.getElementById('lib-search');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'scroll reveal');i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
await sleep(300);
check("library shows component previews", (await ev(`document.querySelectorAll('#editor-tabpanel .rp[data-mode="thumbnail"]').length`)) > 0);
await ev(`document.querySelector('[aria-label="Add Custom code — scroll reveal"]').click()`);
await sleep(2500);
const height = await ev(`(()=>{const f=[...document.querySelectorAll('iframe.rp-code-frame')].pop();f?.scrollIntoView({block:'center'});return f?Math.round(f.getBoundingClientRect().height):0})()`);
check("code block renders in a sandboxed frame", height > 100, `height ${height}px`);
check("frame carries the sandbox attribute", (await ev(`[...document.querySelectorAll('iframe.rp-code-frame')].pop()?.getAttribute('sandbox')`)) === "allow-scripts allow-popups allow-popups-to-escape-sandbox");
await sleep(1200);

// The sandbox has an opaque origin, so Chrome runs it out of process: attach to its target.
const send2 = (method, params = {}, sessionId) => new Promise((r) => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) })); });
await send2("Target.setDiscoverTargets", { discover: true });
const targets = (await send2("Target.getTargets")).result.targetInfos;
const sandboxTarget = targets.filter((t) => t.type === "iframe" && t.url.endsWith("/sandbox")).pop();
check("sandbox runs as an isolated (out-of-process) frame", !!sandboxTarget);
if (sandboxTarget) {
  const { sessionId } = (await send2("Target.attachToTarget", { targetId: sandboxTarget.targetId, flatten: true })).result;
  const evs = async (x) => { const r = await send2("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true }, sessionId); return r.result?.exceptionDetails ? "EXC " + (r.result.exceptionDetails.exception?.description ?? "") : r.result?.result?.value; };
  check("creator code rendered", String(await evs("document.body.innerText")).includes("Made with my own code"));
  check("scroll reveal applied (data-reveal → in-view)", (await evs("document.querySelectorAll('[data-reveal].in-view').length")) > 0);
  check("origin is opaque", (await evs("String(self.origin)")) === "null");
  check("cannot read cookies", String(await evs("(()=>{try{return document.cookie}catch(e){return 'blocked: '+e.name}})()")).startsWith("blocked"));
  check("cannot reach the parent page", String(await evs("(()=>{try{return parent.document.title}catch(e){return 'blocked: '+e.name}})()")).startsWith("blocked"));
  check("cannot make network requests", String(await evs("fetch('/dashboard').then(()=> 'allowed').catch(e=>'blocked: '+e.name)")).startsWith("blocked"));
  check("cannot use storage", String(await evs("(()=>{try{localStorage.setItem('x','1');return 'allowed'}catch(e){return 'blocked: '+e.name}})()")).startsWith("blocked"));
}

// Open the code studio for the new block.
await ev(`[...document.querySelectorAll('.editor-block')].find(b=>b.querySelector('.rp-code'))?.click()`);
await sleep(400);
await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Open code studio')?.click()`);
await sleep(2500);
check("code studio opens with CodeMirror", (await ev(`!!document.querySelector('[role="dialog"] .cm-editor')`)) === true);
check("studio live preview renders", (await ev(`document.querySelectorAll('[role="dialog"] iframe.rp-code-frame').length`)) === 1);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(".shots/code-studio.png", Buffer.from(shot.result.data, "base64"));
await ev(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent==='Done')?.click()`);
await sleep(2500);
check("autosave completes", (await ev(`document.querySelector('[role=status]')?.textContent`)) === "Saved", await ev(`document.querySelector('[role=status]')?.textContent`));
check("no uncaught errors in the editor", errors.length === 0, errors.join(" | ").slice(0, 300));

ws.close();
chrome.kill();
console.log(failures ? `\n${failures} check(s) failed.` : "\nAll code checks passed.");
process.exit(failures ? 1 : 0);
