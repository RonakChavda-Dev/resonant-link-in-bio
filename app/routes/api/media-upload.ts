// POST /api/media — authenticated image or audio upload to private R2 storage.
import type { Route } from "./+types/media-upload";
import { db, getEnv } from "~/server/db.server";
import { sessionContext } from "~/server/context";
import { verifyCsrf } from "~/server/session.server";
import { checkRateLimit } from "~/server/rate-limit.server";
import { MAX_AUDIO_BYTES, MAX_MEDIA_PER_USER, MAX_UPLOAD_BYTES, sniffAudioType, sniffImageType } from "~/server/media.server";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function loader() {
  return json({ error: "Method not allowed" }, 405);
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const session = context.get(sessionContext);
  if (!session) return json({ error: "Sign in to upload." }, 401);
  if (!verifyCsrf(context, request.headers.get("x-csrf-token"))) return json({ error: "Reload the page and try again." }, 403);

  // Reject oversize bodies before reading them (multipart overhead allowance).
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_AUDIO_BYTES + 64 * 1024) return json({ error: "Files must be 10 MB or smaller (images 5 MB)." }, 413);

  const limit = await checkRateLimit(context, { key: `upload:user:${session.user.id}`, limit: 40, windowSeconds: 3600 });
  if (!limit.ok) return json({ error: "Too many uploads. Try again later." }, 429);

  const sql = db(context);
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM media WHERE owner_id = ${session.user.id}`;
  if (n >= MAX_MEDIA_PER_USER) return json({ error: `You've reached the limit of ${MAX_MEDIA_PER_USER} uploads.` }, 400);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Upload could not be read." }, 400);
  }
  const file = form.get("file");
  // "audio" uploads come from the music settings; everything else is an image.
  const wantAudio = form.get("kind") === "audio";
  if (!(file instanceof File)) return json({ error: wantAudio ? "Choose a song to upload." : "Choose an image to upload." }, 400);
  const maxBytes = wantAudio ? MAX_AUDIO_BYTES : MAX_UPLOAD_BYTES;
  if (file.size === 0 || file.size > maxBytes) {
    return json({ error: wantAudio ? "Songs must be 10 MB or smaller." : "Images must be 5 MB or smaller." }, 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = wantAudio ? sniffAudioType(bytes) : sniffImageType(bytes);
  if (!type) {
    return json({ error: wantAudio ? "That file isn't an MP3, M4A, OGG or WAV audio file." : "That file isn't a PNG, JPEG, WebP or GIF image." }, 415);
  }

  const id = crypto.randomUUID();
  const key = `u/${session.user.id}/${id}`;
  await getEnv(context).MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
  try {
    await sql`
      INSERT INTO media (id, owner_id, object_key, content_type, byte_size)
      VALUES (${id}, ${session.user.id}, ${key}, ${type}, ${bytes.byteLength})`;
  } catch (e) {
    await getEnv(context).MEDIA.delete(key);
    throw e;
  }
  return json({ id }, 201);
}
