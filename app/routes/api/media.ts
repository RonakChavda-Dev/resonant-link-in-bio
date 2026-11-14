// GET /media/:mediaId — serves an uploaded image from private R2 storage.
// Ids are random UUIDs; objects are immutable so they can be cached long-term.
import type { Route } from "./+types/media";
import { db, getEnv } from "~/server/db.server";
import { isUuid } from "~/server/comments.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  if (!isUuid(params.mediaId)) return new Response("Not found", { status: 404 });
  const [row] = await db(context)<{ object_key: string; content_type: string }[]>`
    SELECT object_key, content_type FROM media WHERE id = ${params.mediaId}`;
  if (!row) return new Response("Not found", { status: 404 });
  const object = await getEnv(context).MEDIA.get(row.object_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": row.content_type,
      "Content-Length": String(object.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
      "Cross-Origin-Resource-Policy": "same-origin",
      ETag: object.httpEtag,
    },
  });
}
