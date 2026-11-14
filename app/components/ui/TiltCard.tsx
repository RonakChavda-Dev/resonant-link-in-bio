// 3D tilt with depth: the card leans towards the pointer, a soft glare follows
// it, and a shadow and coloured ambient glow sit further back and drift the
// other way for a parallax feel. Pointer-only (no effect on touch), disabled under reduced motion.
import { useEffect, useRef, type ReactNode } from "react";

export function TiltCard({ children, max = 9, glow, radius = "2.6rem", className = "" }: { children: ReactNode; max?: number; glow?: string; radius?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(hover: hover)").matches) return;
    let raf = 0;
    let x = 0.5;
    let y = 0.5;
    const paint = () => {
      raf = 0;
      el.style.setProperty("--rx", `${((0.5 - y) * max).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((x - 0.5) * max * 1.2).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      el.style.setProperty("--px", ((x - 0.5) * 2).toFixed(3));
      el.style.setProperty("--py", ((y - 0.5) * 2).toFixed(3));
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      el.dataset.tilting = "";
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const leave = () => {
      x = 0.5;
      y = 0.5;
      delete el.dataset.tilting;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [max]);

  return (
    <div className={`tilt ${className}`} style={{ perspective: "1200px" }}>
      <div ref={ref} className="tilt-card" style={{ "--tilt-radius": radius, ...(glow ? { "--glow": glow } : {}) } as React.CSSProperties}>
        <span aria-hidden="true" className="tilt-shadow" />
        {glow ? <span aria-hidden="true" className="tilt-ambient" /> : null}
        {children}
        <span aria-hidden="true" className="tilt-glare" />
      </div>
    </div>
  );
}
