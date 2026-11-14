// A horizontal strip driven by vertical scrolling: the section pins to the
// viewport while the page scrolls, the strip slides sideways, and normal
// scrolling resumes once its last card is in view. No scrollbars.
// On narrow screens, short viewports or under reduced motion it falls back to
// a plain swipeable row (scrollbar hidden) — nothing is pinned.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function ScrollStrip({ header, children }: { header: ReactNode; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    let dist = 0;
    let raf = 0;

    const update = () => {
      raf = 0;
      const o = outer.current;
      const t = track.current;
      if (!o || !t || !dist) return;
      const travel = o.offsetHeight - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -o.getBoundingClientRect().top / travel)) : 0;
      t.style.transform = `translate3d(${(-p * dist).toFixed(1)}px, 0, 0)`;
      if (bar.current) bar.current.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const measure = () => {
      const t = track.current;
      const s = sticky.current;
      if (!t || !s) return;
      t.style.transform = "";
      // Pinned content = header + strip + progress line, plus room for the site header.
      const content = (s.firstElementChild as HTMLElement | null)?.offsetHeight ?? s.scrollHeight;
      const fits = content + 33 + 64 + 24 <= window.innerHeight;
      dist = mq.matches && fits ? Math.max(0, t.scrollWidth - t.clientWidth) : 0;
      setDistance(dist || null);
      requestAnimationFrame(update);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", measure);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const pinned = distance !== null;
  return (
    <div ref={outer} style={pinned ? { height: `calc(100vh + ${distance}px)` } : undefined}>
      <div
        ref={sticky}
        className={pinned ? "sticky top-0 flex h-screen flex-col justify-center overflow-hidden pt-16" : "py-24"}
      >
        <div className="wrap">
          {header}
          <ul
            ref={track}
            className={`mt-12 flex gap-5 ${pinned ? "will-change-transform" : "snap-x overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}`}
          >
            {children}
          </ul>
          <div aria-hidden="true" className={`mt-8 h-px w-full overflow-hidden bg-line ${pinned ? "" : "hidden"}`}>
            <span ref={bar} className="block h-full origin-left bg-fg/60" style={{ transform: "scaleX(0)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
