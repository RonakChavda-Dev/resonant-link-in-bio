// POST /api/events — privacy-first analytics beacon.
// Accepts {h: handle, t: "view"|"click", b?: blockId, r?: referrer}. Stores only
// an increment on a daily aggregate row; nothing identifying is persisted.
import type { Route } from "./+types/events";
import { isbot } from "isbot";
import { db } from "~/server/db.server";
import { sessionContext } from "~/server/context";
import { checkRateLimit } from "~/server/rate-limit.server";
import { ipKey } from "~/server/request.server";
import { normalizeHandle, HANDLE_PATTERN } from "~/lib/handles";
import { referrerHost } from "~/lib/urls";

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export function loader() {
  return new Response("Method not allowed", { status: 405 });
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || isbot(ua)) return noContent();
  if (Number(request.headers.get("content-length") ?? "0") > 2048) return new Response(null, { status: 413 });

  let body: { h?: unknown; t?: unknown; b?: unknown; r?: unknown };
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const handle = typeof body.h === "string" ? normalizeHandle(body.h) : "";
  const metric = body.t === "view" || body.t === "click" ? body.t : null;
  if (!HANDLE_PATTERN.test(handle) || !metric) return new Response(null, { status: 400 });

  const limit = await checkRateLimit(context, { key: `events:ip:${await ipKey(context, request)}`, limit: 120, windowSeconds: 60 });
  if (!limit.ok) return noContent();

  const sql = db(context);
  const [profile] = await sql<{ id: string; owner_id: string; published: { blocks: { id: string; type: string }[] } }[]>`
    SELECT id, owner_id, published FROM profiles WHERE handle = ${handle} AND status = 'published'`;
  if (!profile) return noContent();

  // Owners browsing their own page are not counted.
  if (context.get(sessionContext)?.user.id === profile.owner_id) return noContent();

  let blockId = "";
  if (metric === "click") {
    if (typeof body.b !== "string") return new Response(null, { status: 400 });
    const block = profile.published.blocks.find((b) => b.id === body.b);
    const LINKABLE = new Set(["link", "callout", "buttons", "socials", "tabs", "projects", "contact"]);
    if (!block || !LINKABLE.has(block.type)) return noContent();
    blockId = block.id;
  }
  const host = referrerHost(body.r);
  const selfHost = new URL(request.url).hostname.replace(/^www\./, "");
  const referrer = host === selfHost ? "" : host;

  await sql`
    INSERT INTO analytics_daily (profile_id, day, metric, block_id, referrer_host, count)
    VALUES (${profile.id}, current_date, ${metric}, ${blockId}, ${metric === "view" ? referrer : ""}, 1)
    ON CONFLICT (profile_id, day, metric, block_id, referrer_host)
    DO UPDATE SET count = analytics_daily.count + 1`;
  return noContent();
}
