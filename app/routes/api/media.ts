// GET /media/:mediaId — serves an uploaded image or song from private R2 storage.
// Ids are random UUIDs; objects are immutable so they can be cached long-term.
// Byte ranges are supported so audio can stream and seek (Safari requires it).
import type { Route } from "./+types/media";
import { db, getEnv } from "~/server/db.server";
import { isUuid } from "~/server/comments.server";

export async function loader({ params, context, request }: Route.LoaderArgs) {
  if (!isUuid(params.mediaId)) return new Response("Not found", { status: 404 });
  const [row] = await db(context)<{ object_key: string; content_type: string }[]>`
    SELECT object_key, content_type FROM media WHERE id = ${params.mediaId}`;
  if (!row) return new Response("Not found", { status: 404 });
  const wantsRange = request.headers.has("range");
  const object = await getEnv(context).MEDIA.get(row.object_key, wantsRange ? { range: request.headers } : undefined);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": row.content_type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": "inline",
    "Cross-Origin-Resource-Policy": "same-origin",
    ETag: object.httpEtag,
  });

  const range = wantsRange ? object.range : undefined;
  if (range) {
    let start: number;
    let length: number;
    if ("suffix" in range && range.suffix !== undefined) {
      length = Math.min(range.suffix, object.size);
      start = object.size - length;
    } else {
      start = "offset" in range && range.offset !== undefined ? range.offset : 0;
      length = "length" in range && range.length !== undefined ? range.length : object.size - start;
    }
    headers.set("Content-Range", `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set("Content-Length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
}
