import { Form, Link, NavLink, Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { Logo, LogoMark } from "~/components/ui/Logo";
import { CsrfInput } from "~/components/ui/forms";
import { Avatar } from "~/components/ui/Avatar";
import { requireUser } from "~/server/session.server";

// Server-side gate for every workspace page (each loader/action still checks
// ownership of the specific records it touches).
export const middleware: Route.MiddlewareFunction[] = [
  ({ context, request }) => {
    requireUser(context, request);
  },
];

export function loader({ context, request }: Route.LoaderArgs) {
  const session = requireUser(context, request);
  return { displayName: session.user.displayName, avatarId: session.user.avatarId };
}

export default function WorkspaceLayout({ loaderData }: Route.ComponentProps) {
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 text-sm transition-colors ${isActive ? "bg-white/[0.07] text-fg" : "text-dim hover:text-fg"}`;
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-volt">
        Skip to content
      </a>
      <header className="border-b border-line">
        <div className="wrap flex h-15 min-h-[3.75rem] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Link to="/" aria-label="Resonant home" className="shrink-0 rounded-lg">
              <span className="sm:hidden"><LogoMark size={22} /></span>
              <span className="hidden sm:inline-flex"><Logo /></span>
            </Link>
            <nav aria-label="Workspace">
              <ul className="flex gap-1">
                <li><NavLink to="/dashboard" end className={link}>Dashboard</NavLink></li>
                <li><NavLink to="/settings" className={link}>Settings</NavLink></li>
              </ul>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link to="/settings#profile" className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-1 text-sm text-dim hover:text-fg sm:pr-3" aria-label={`Your profile: ${loaderData.displayName}`}>
              <Avatar mediaId={loaderData.avatarId} name={loaderData.displayName} size={28} />
              <span className="hidden max-w-[12rem] truncate sm:inline">{loaderData.displayName}</span>
            </Link>
            <Form method="post" action="/logout">
              <CsrfInput />
              <button type="submit" className="btn btn-ghost btn-sm">Log out</button>
            </Form>
          </div>
        </div>
      </header>
      <main id="main" className="wrap py-10">
        <Outlet />
      </main>
    </div>
  );
}
