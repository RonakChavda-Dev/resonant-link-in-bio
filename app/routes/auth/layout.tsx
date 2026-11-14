import { Link, Outlet } from "react-router";
import { Logo } from "~/components/ui/Logo";
import { Wave } from "~/components/profile/ProfileView";

export default function AuthLayout() {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link to="/" aria-label="Resonant home" className="self-start rounded-lg">
          <Logo />
        </Link>
        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[25rem]">
            <Outlet />
          </div>
        </main>
        <p className="text-xs text-faint">
          <Link to="/privacy" className="hover:text-dim">Privacy</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/security" className="hover:text-dim">Security</Link>
        </p>
      </div>
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden border-l border-line bg-ink-2 lg:flex lg:flex-col lg:justify-end lg:p-14"
      >
        <div className="absolute inset-0 [background:repeating-radial-gradient(circle_at_70%_38%,transparent_0_54px,rgba(255,255,255,0.045)_54px_55px)] [mask-image:radial-gradient(60%_55%_at_70%_38%,#000_15%,transparent)]" />
        <div className="absolute left-[70%] top-[38%] size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 blur-[1px] [box-shadow:0_0_140px_50px_rgba(255,255,255,0.10)]" />
        <div className="relative">
          <p className="display text-[clamp(2.4rem,3.6vw,3.4rem)] max-w-md">
            Say it once. <span className="serif-accent text-dim">Let it carry.</span>
          </p>
          <div className="mt-8 max-w-sm">
            <Wave bars={36} />
          </div>
        </div>
      </aside>
    </div>
  );
}
