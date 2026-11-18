import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./app.css";

import type { Route } from "./+types/root";
import { sessionContext } from "./server/context";
import { loadSession } from "./server/session.server";
import { Logo } from "./components/ui/Logo";
import { useReveal } from "./components/ui/useReveal";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }) => {
    context.set(sessionContext, await loadSession(context, request));
  },
];

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = context.get(sessionContext);
  return {
    origin: new URL(request.url).origin,
    user: session ? { displayName: session.user.displayName } : null,
    csrf: session?.csrfToken ?? null,
  };
}

export function useRootData() {
  return useRouteLoaderData<typeof loader>("root");
}

export const links: Route.LinksFunction = () => [
  // Bump ?v= whenever favicon.svg changes; browsers cache favicons aggressively.
  { rel: "icon", href: "/favicon.svg?v=2", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
  { rel: "manifest", href: "/manifest.webmanifest" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#09090b" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useReveal();
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let status = 500;
  let title = "Something went wrong";
  let details = "An unexpected error occurred. Try again in a moment.";
  if (isRouteErrorResponse(error)) {
    status = error.status;
    if (status === 404) {
      title = "Page not found";
      details = "There's nothing at this address.";
    } else if (status === 410) {
      title = "This page is gone";
      details = "Its owner has unpublished or removed it.";
    } else if (status === 403) {
      title = "Not allowed";
      details = typeof error.data === "string" ? error.data : "You don't have access to this.";
    } else if (status === 429) {
      title = "Slow down";
      details = "Too many requests. Wait a moment and try again.";
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }
  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <title>{`${title} · Resonant`}</title>
      <div className="text-center max-w-md">
        <Link to="/" className="inline-flex mb-10" aria-label="Resonant home">
          <Logo />
        </Link>
        <p className="eyebrow mb-3">Error {status}</p>
        <h1 className="display text-4xl sm:text-5xl mb-4">{title}</h1>
        <p className="text-dim leading-relaxed mb-8">{details}</p>
        <Link to="/" className="btn btn-ghost">
          Back to Resonant
        </Link>
      </div>
    </main>
  );
}
