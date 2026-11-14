// Scroll-triggered "motion blur" reveals for any element with [data-reveal].
// Content is only hidden once this script has run (html.rv), so pages read
// fine without JavaScript, and the CSS turns it all off under reduced motion.
import { useEffect } from "react";
import { useLocation } from "react-router";

export function useReveal() {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.documentElement;
    if (!("IntersectionObserver" in window)) return;
    root.classList.add("rv");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const scan = () => document.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => io.observe(el));
    scan();
    // Pick up content rendered after navigation or lazy UI.
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);
}
