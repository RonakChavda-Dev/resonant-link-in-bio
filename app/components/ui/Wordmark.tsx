// The giant footer wordmark. A glint of light follows the mouse across the
// letters. Decorative only (aria-hidden by its parent).
import { useRef } from "react";

export function Wordmark({ text = "RESONANT" }: { text?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--gx", `${e.clientX - r.left}px`);
    el.style.setProperty("--gy", `${e.clientY - r.top}px`);
  };
  return (
    <span ref={ref} className="wordmark-wrap" onPointerMove={move}>
      <span className="wordmark">{text}</span>
      <span className="wordmark wordmark-glint">{text}</span>
    </span>
  );
}
