// Hosts a custom-code block inside the sandboxed /sandbox frame.
// The code is delivered by postMessage; the frame reports its height back and
// receives the visitor's viewport position so on-scroll animations work even
// though the frame itself doesn't scroll (auto height).
import { useEffect, useMemo, useRef, useState } from "react";

const SANDBOX_FLAGS = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

export function CodeFrame({
  html,
  css,
  js,
  title,
  height,
  fixedHeight,
  live = false,
}: {
  html: string;
  css: string;
  js: string;
  title: string;
  height: "auto" | "fixed";
  fixedHeight: number;
  /** Editor: re-run shortly after the code stops changing. */
  live?: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [autoHeight, setAutoHeight] = useState(160);
  const code = useMemo(() => ({ html, css, js }), [html, css, js]);
  const [runKey, setRunKey] = useState(0);
  const [runCode, setRunCode] = useState(code);

  // In the editor, debounce re-runs so typing stays smooth.
  useEffect(() => {
    if (!live) {
      setRunCode(code);
      return;
    }
    const t = setTimeout(() => {
      setRunCode(code);
      setRunKey((k) => k + 1);
    }, 450);
    return () => clearTimeout(t);
  }, [code, live]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let raf = 0;
    const sendViewport = () => {
      raf = 0;
      const win = frame.contentWindow;
      if (!win) return;
      const rect = frame.getBoundingClientRect();
      const sp = scrollParent(frame);
      const view = sp ? sp.getBoundingClientRect() : { top: 0, height: window.innerHeight };
      win.postMessage({ type: "rs:viewport", top: rect.top - view.top, height: view.height }, "*");
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(sendViewport);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.type === "rs:ready") {
        frame.contentWindow?.postMessage({ type: "rs:render", ...runCode }, "*");
        schedule();
      } else if (e.data.type === "rs:height") {
        const h = Number(e.data.h);
        if (Number.isFinite(h)) setAutoHeight(Math.max(40, Math.min(6000, Math.ceil(h))));
        schedule();
      }
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [runCode, runKey]);

  return (
    <iframe
      key={runKey}
      ref={frameRef}
      src="/sandbox"
      title={title}
      sandbox={SANDBOX_FLAGS}
      referrerPolicy="no-referrer"
      loading={live ? "eager" : "lazy"}
      className="rp-code-frame"
      style={{ height: height === "auto" ? autoHeight : fixedHeight }}
    />
  );
}
