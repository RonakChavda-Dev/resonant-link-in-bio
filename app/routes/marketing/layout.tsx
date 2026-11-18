import { useEffect, useState, type CSSProperties } from "react";
import { Wordmark } from "~/components/ui/Wordmark";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Logo } from "~/components/ui/Logo";
import { useRootData } from "~/root";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/templates", label: "Templates" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/security", label: "Security" },
];

export default function MarketingLayout() {
  const root = useRootData();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-volt">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-xl">
        <div className="wrap flex h-16 items-center justify-between gap-6">
          <Link to="/" aria-label="Resonant home" className="rounded-lg">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `rounded-full px-3.5 py-2 text-[0.9rem] transition-colors ${isActive ? "text-fg bg-white/[0.06]" : "text-dim hover:text-fg"}`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="hidden md:flex items-center gap-2">
            {root?.user ? (
              <Link to="/dashboard" className="btn btn-volt btn-sm">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-quiet btn-sm">
                  Log in
                </Link>
                <Link to="/signup" className="btn btn-volt btn-sm">
                  Get started
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="md:hidden btn btn-ghost btn-sm menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="menu-icon" aria-hidden="true"><span /><span /></span>
            <span className="menu-label" aria-hidden="true">
              <span>Menu</span>
              <span>Close</span>
            </span>
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        <nav id="mobile-nav" aria-label="Main" className="mobile-nav md:hidden" data-open={open || undefined} inert={!open}>
          <div className="mobile-nav-inner">
            <ul className="wrap py-3 grid gap-1">
              {NAV.map((item, i) => (
                <li key={item.to} className="mobile-nav-item" style={{ "--i": i } as CSSProperties}>
                  <NavLink to={item.to} className="block rounded-xl px-3 py-3 text-fg hover:bg-white/[0.04]">
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li className="mobile-nav-item flex gap-2 pt-2" style={{ "--i": NAV.length } as CSSProperties}>
                {root?.user ? (
                  <Link to="/dashboard" className="btn btn-volt flex-1">
                    Open dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="btn btn-ghost flex-1">
                      Log in
                    </Link>
                    <Link to="/signup" className="btn btn-volt flex-1">
                      Get started
                    </Link>
                  </>
                )}
              </li>
            </ul>
          </div>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <div aria-hidden="true" className="mt-16 overflow-hidden border-t border-line">
        <div className="wrap flex justify-center pt-10"><Wordmark /></div>
      </div>
      <footer className="border-t border-line">
        <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm text-dim leading-relaxed">
              A personal page, profile and one-page portfolio builder. Pages are made of structured blocks, so they stay
              fast, readable and safe.
            </p>
          </div>
          <div>
            <p className="eyebrow mb-4">Product</p>
            <ul className="grid gap-2.5 text-sm">
              <li><Link className="text-dim hover:text-fg" to="/features">Features</Link></li>
              <li><Link className="text-dim hover:text-fg" to="/templates">Templates</Link></li>
              <li><Link className="text-dim hover:text-fg" to="/how-it-works">How it works</Link></li>
              <li><Link className="text-dim hover:text-fg" to="/signup">Create an account</Link></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4">Trust</p>
            <ul className="grid gap-2.5 text-sm">
              <li><Link className="text-dim hover:text-fg" to="/security">Security</Link></li>
              <li><Link className="text-dim hover:text-fg" to="/privacy">Privacy</Link></li>
              <li><Link className="text-dim hover:text-fg" to="/login">Log in</Link></li>
            </ul>
          </div>
        </div>
        <div className="wrap border-t border-line py-6 text-xs text-faint flex flex-wrap justify-between gap-3">
          <span>© {new Date().getFullYear()} Resonant</span>
          <span>Sample pages on this site use fictional people and example.com links.</span>
        </div>
      </footer>
    </div>
  );
}
