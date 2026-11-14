// GET /sandbox — the only place creator-written HTML/CSS/JS ever runs.
//
// Isolation (defence in depth):
// - The CSP `sandbox` directive (without allow-same-origin) gives this document
//   an opaque origin even if it's opened directly: no cookies, no storage, no
//   access to Resonant's pages, and its requests carry `Origin: null`, which the
//   Worker refuses for any state-changing request.
// - `connect-src 'none'` and `form-action 'none'`: code can't call APIs or post forms.
// - Embedding iframes also set `sandbox="allow-scripts allow-popups ..."`.
// - The shell only accepts messages from its parent window, and the parent only
//   accepts size/ready messages from this frame (numbers, clamped).
// Creator code arrives by postMessage after load; it's never part of this response.
import type { Route } from "./+types/sandbox";

const BOOT = `
(function () {
  var subs = [], state = { visible: false, progress: 0, top: 0, height: innerHeight }, haveParent = false, rendered = false;
  function post(msg) { try { parent.postMessage(msg, "*"); } catch (e) {} }
  function measure() {
    var vh = state.height, top = state.top;
    var visTop = Math.max(0, -top), visBottom = Math.min(innerHeight, vh - top);
    var docH = document.documentElement.scrollHeight;
    state.visible = visBottom > visTop;
    state.progress = Math.max(0, Math.min(1, (vh - top) / (vh + docH)));
    var els = document.querySelectorAll("[data-reveal]:not(.in-view)");
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (r.top < visBottom - 24 && r.bottom > visTop + 8) els[i].classList.add("in-view");
    }
    for (var j = 0; j < subs.length; j++) { try { subs[j](Object.assign({}, state)); } catch (e) { console.error(e); } }
  }
  window.resonant = { onViewport: function (cb) { if (typeof cb === "function") { subs.push(cb); cb(Object.assign({}, state)); } } };
  addEventListener("scroll", measure, { passive: true });
  addEventListener("resize", measure);
  addEventListener("message", function (e) {
    if (e.source !== parent || !e.data || typeof e.data !== "object") return;
    var d = e.data;
    if (d.type === "rs:viewport") {
      haveParent = true;
      state.top = Number(d.top) || 0;
      state.height = Number(d.height) || innerHeight;
      measure();
    } else if (d.type === "rs:render" && !rendered) {
      rendered = true;
      document.body.innerHTML = String(d.html || "");
      var style = document.createElement("style");
      style.textContent = String(d.css || "");
      document.head.appendChild(style);
      if (d.js) {
        var s = document.createElement("script");
        s.textContent = String(d.js);
        document.body.appendChild(s);
      }
      if (window.ResizeObserver) new ResizeObserver(function () { post({ type: "rs:height", h: document.documentElement.scrollHeight }); measure(); }).observe(document.documentElement);
      post({ type: "rs:height", h: document.documentElement.scrollHeight });
      setTimeout(function () { if (!haveParent) { state.top = 0; state.height = innerHeight; } measure(); }, 60);
    }
  });
  post({ type: "rs:ready" });
})();`;

const BASE_CSS = `
html, body { margin: 0; background: transparent; color: #f4f4f5; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
*, *::before, *::after { box-sizing: border-box; }
img, video { max-width: 100%; }
[data-reveal] { transition: opacity .8s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.22,1,.36,1), filter .8s cubic-bezier(.22,1,.36,1); }
[data-reveal]:not(.in-view) { opacity: 0; filter: blur(10px); transform: translateY(18px); }
[data-reveal="blur"]:not(.in-view) { transform: none; filter: blur(16px); }
[data-reveal="zoom"]:not(.in-view) { transform: scale(.92); }
[data-reveal="left"]:not(.in-view) { transform: translateX(-28px); }
[data-reveal="right"]:not(.in-view) { transform: translateX(28px); }
@media (prefers-reduced-motion: reduce) {
  [data-reveal] { transition: none !important; opacity: 1 !important; filter: none !important; transform: none !important; }
}`;

export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
    "style-src 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
    "font-src https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com data:",
    `img-src ${origin} https: data: blob:`,
    "media-src https: data: blob:",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "frame-ancestors 'self'",
    "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
  ].join("; ");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>Custom section</title><style>${BASE_CSS}</style></head><body><script>${BOOT}</script></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": csp,
      "X-Frame-Options": "SAMEORIGIN",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
