// A vertical "wheel" picker: drag it (grab cursor) and items curve away, fade
// and blur with distance from the centre; it settles on the nearest item with a
// little momentum. It does not capture the mouse wheel, so page scrolling is
// never hijacked. Click an item to jump to it. Keyboard: ↑/↓, Home/End.
// Under reduced motion it becomes a flat list (no blur or rotation).
import { useCallback, useEffect, useId, useRef } from "react";

export interface WheelItem {
  id: string;
  label: string;
}

export function WheelPicker({
  items,
  value,
  onChange,
  label,
  itemHeight = 56,
  visible = 7,
  size = "lg",
}: {
  items: WheelItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  itemHeight?: number;
  visible?: number;
  size?: "lg" | "sm";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef(0);
  // Index of the item we're currently scrolling to (smoothly), so the
  // value-sync effect below doesn't cut the animation short with a jump.
  const target = useRef<number | null>(null);
  const mounted = useRef(false);
  const id = useId();
  const index = Math.max(0, items.findIndex((i) => i.id === value));
  const pad = (itemHeight * (visible - 1)) / 2;

  const paint = useCallback(() => {
    raf.current = 0;
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const center = el.scrollTop + el.clientHeight / 2;
    const children = el.querySelectorAll<HTMLElement>("[data-wheel-item]");
    children.forEach((child, i) => {
      const mid = pad + i * itemHeight + itemHeight / 2;
      const d = (mid - center) / itemHeight;
      const a = Math.min(Math.abs(d), 3.5);
      child.style.opacity = String(Math.max(0.08, 1 - a * 0.27));
      child.style.transform = reduce ? "none" : `perspective(600px) rotateX(${Math.max(-60, Math.min(60, -d * 17))}deg) scale(${1 - a * 0.07})`;
      child.style.filter = reduce || a < 0.5 ? "none" : `blur(${(a * 0.9).toFixed(2)}px)`;
    });
  }, [itemHeight, pad]);

  const scrollToIndex = useCallback((i: number, smooth = true) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.current = i;
    el.scrollTo({ top: i * itemHeight, behavior: smooth && !reduce ? "smooth" : "auto" });
  }, [itemHeight]);

  // Position on the current value: instantly on first render, then follow
  // outside changes smoothly. Skip when we're already animating to it —
  // mid-animation scrollTop is still near the old item, and re-scrolling
  // with "auto" here is what made jumps of 2+ items snap.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = !mounted.current;
    mounted.current = true;
    if (target.current !== index && Math.round(el.scrollTop / itemHeight) !== index) scrollToIndex(index, !first);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onScroll = () => {
    if (!raf.current) raf.current = requestAnimationFrame(paint);
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el || drag.current?.moved) return;
      target.current = null; // scrolling has come to rest
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / itemHeight)));
      if (items[i] && items[i].id !== value) onChange(items[i].id);
    }, 140);
  };

  // Drag to spin.
  const drag = useRef<{ id: number; y: number; top: number; lastY: number; lastT: number; v: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || (e.pointerType === "mouse" && e.button !== 0)) return;
    target.current = null;
    drag.current = { id: e.pointerId, y: e.clientY, top: el.scrollTop, lastY: e.clientY, lastT: performance.now(), v: 0, moved: false };
    suppressClick.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) > 4) {
      d.moved = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
      el.dataset.dragging = "";
    }
    if (!d.moved) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.v = 0.8 * ((e.clientY - d.lastY) / dt) + 0.2 * d.v;
    d.lastY = e.clientY;
    d.lastT = now;
    el.scrollTop = d.top - dy;
  };
  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el || !d.moved) return;
    delete el.dataset.dragging;
    try { if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    suppressClick.current = true;
    const projected = el.scrollTop - d.v * 160;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(projected / itemHeight)));
    scrollToIndex(i);
    if (items[i].id !== value) onChange(items[i].id);
  };

  const onKey = (e: React.KeyboardEvent) => {
    let next = index;
    if (e.key === "ArrowDown") next = index + 1;
    else if (e.key === "ArrowUp") next = index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    next = Math.max(0, Math.min(items.length - 1, next));
    scrollToIndex(next);
    onChange(items[next].id);
  };

  const text = size === "lg" ? "text-[clamp(1.6rem,3.4vw,2.6rem)]" : "text-[1.05rem]";
  return (
    <div className="relative select-none" style={{ height: itemHeight * visible }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 rounded-2xl border border-line bg-white/[0.05]"
        style={{ top: pad, height: itemHeight }}
      />
      <div
        ref={ref}
        role="listbox"
        tabIndex={0}
        aria-label={label}
        aria-activedescendant={`${id}-${index}`}
        onScroll={onScroll}
        onKeyDown={onKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            e.stopPropagation();
          }
        }}
        className="relative h-full cursor-grab touch-none overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:rounded-2xl data-[dragging]:cursor-grabbing"
        style={{ paddingBlock: pad, maskImage: "linear-gradient(transparent, #000 30%, #000 70%, transparent)" }}
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === index}
            data-wheel-item=""
            onClick={() => {
              scrollToIndex(i);
              onChange(item.id);
            }}
            className={`flex items-center justify-center font-semibold tracking-[-0.035em] transition-colors ${text} ${i === index ? "text-fg" : "text-dim"}`}
            style={{ height: itemHeight, transformOrigin: "center", willChange: "transform, filter, opacity" }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
