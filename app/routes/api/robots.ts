import type { Route } from "./+types/robots";

export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const body = [
    "User-agent: *",
    "Disallow: /dashboard",
    "Disallow: /editor/",
    "Disallow: /analytics/",
    "Disallow: /settings",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /login",
    "Disallow: /signup",
    "Disallow: /forgot-password",
    "Disallow: /reset-password",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
