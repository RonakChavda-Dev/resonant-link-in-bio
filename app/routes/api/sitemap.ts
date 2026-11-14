// /sitemap.xml — marketing routes, template previews and indexable published profiles.
import type { Route } from "./+types/sitemap";
import { db } from "~/server/db.server";
import { TEMPLATES } from "~/lib/templates";
import { profilePath } from "~/lib/handles";

const STATIC = ["/", "/features", "/templates", "/how-it-works", "/security", "/privacy"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function loader({ request, context }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const profiles = await db(context)<{ handle: string; published_at: Date }[]>`
    SELECT handle, published_at FROM profiles
    WHERE status = 'published' AND indexable = true
    ORDER BY published_at DESC LIMIT 45000`;
  const urls = [
    ...STATIC.map((p) => `<url><loc>${esc(origin + p)}</loc></url>`),
    ...TEMPLATES.map((t) => `<url><loc>${esc(`${origin}/templates/${t.id}`)}</loc></url>`),
    ...profiles.map(
      (p) => `<url><loc>${esc(origin + profilePath(p.handle))}</loc><lastmod>${p.published_at.toISOString()}</lastmod></url>`,
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
