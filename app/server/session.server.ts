// Server-managed sessions.
// - Cookie: random 256-bit token, HttpOnly, SameSite=Lax, Secure + __Host- prefix on HTTPS.
// - Database: only sha256(token) is stored, with absolute and idle expiry.
// - A fresh session is created on every sign-in (session fixation defence) and
//   all sessions are revoked on password change/reset.
import { redirect, type RouterContextProvider } from "react-router";
import { db, getExecutionContext } from "./db.server";
import { randomToken, sha256Hex, timingSafeEqual } from "./crypto.server";
import { requestMetaContext, sessionContext, type SessionInfo } from "./context";
import { clientLabel } from "./request.server";

type Ctx = Readonly<RouterContextProvider>;

const ABSOLUTE_TTL_DAYS = 30;
const IDLE_TTL_DAYS = 7;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

function cookieName(secure: boolean) {
  return secure ? "__Host-rsn_session" : "rsn_session";
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      const value = part.slice(idx + 1).trim();
      return /^[A-Za-z0-9_-]{20,100}$/.test(value) ? value : null;
    }
  }
  return null;
}

function serializeCookie(secure: boolean, value: string, maxAgeSeconds: number) {
  return [
    `${cookieName(secure)}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAgeSeconds}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/** Root middleware: resolve the session (if any) once per request. */
export async function loadSession(context: Ctx, request: Request): Promise<SessionInfo | null> {
  const { secure } = context.get(requestMetaContext);
  const token = readCookie(request, cookieName(secure));
  if (!token) return null;
  const id = await sha256Hex(token);
  const sql = db(context);
  const [row] = await sql<
    { csrf_token: string; last_seen_at: Date; user_id: string; email: string; display_name: string; avatar_media_id: string | null }[]
  >`
    SELECT s.csrf_token, s.last_seen_at, u.id AS user_id, u.email, u.display_name, u.avatar_media_id
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ${id}
      AND s.expires_at > now()
      AND s.last_seen_at > now() - make_interval(days => ${IDLE_TTL_DAYS})`;
  if (!row) return null;

  if (Date.now() - row.last_seen_at.getTime() > TOUCH_INTERVAL_MS) {
    // Touch in the background; failures here must not break the request.
    getExecutionContext(context).waitUntil(
      sql`UPDATE sessions SET last_seen_at = now() WHERE id = ${id}`.then(
        () => undefined,
        () => undefined,
      ),
    );
  }
  return {
    id,
    csrfToken: row.csrf_token,
    user: { id: row.user_id, email: row.email, displayName: row.display_name, avatarId: row.avatar_media_id },
  };
}

/** Create a brand-new session and return the Set-Cookie header value. */
export async function createSession(context: Ctx, request: Request, userId: string): Promise<string> {
  const { secure } = context.get(requestMetaContext);
  const sql = db(context);

  // Rotate: discard any session the browser presented before signing in.
  const previous = readCookie(request, cookieName(secure));
  if (previous) await sql`DELETE FROM sessions WHERE id = ${await sha256Hex(previous)}`;

  const token = randomToken(32);
  const id = await sha256Hex(token);
  const csrf = randomToken(32);
  await sql`
    INSERT INTO sessions (id, user_id, csrf_token, expires_at, client_label)
    VALUES (${id}, ${userId}, ${csrf}, now() + make_interval(days => ${ABSOLUTE_TTL_DAYS}),
            ${clientLabel(request.headers.get("user-agent"))})`;
  return serializeCookie(secure, token, ABSOLUTE_TTL_DAYS * 24 * 60 * 60);
}

export async function destroySession(context: Ctx): Promise<string> {
  const { secure } = context.get(requestMetaContext);
  const session = context.get(sessionContext);
  if (session) await db(context)`DELETE FROM sessions WHERE id = ${session.id}`;
  return serializeCookie(secure, "", 0);
}

export async function revokeOtherSessions(context: Ctx, userId: string, keepSessionId: string | null) {
  const sql = db(context);
  if (keepSessionId) {
    await sql`DELETE FROM sessions WHERE user_id = ${userId} AND id <> ${keepSessionId}`;
  } else {
    await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
  }
}

export function getSession(context: Ctx): SessionInfo | null {
  return context.get(sessionContext);
}

/** Authorization gate for workspace loaders/actions. */
export function requireUser(context: Ctx, request: Request): SessionInfo {
  const session = context.get(sessionContext);
  if (!session) {
    const url = new URL(request.url);
    const next = url.pathname + url.search;
    throw redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return session;
}

/**
 * CSRF layer 2: synchronizer token bound to the session, required on every
 * authenticated state-changing action (in addition to the Origin check).
 */
export function verifyCsrf(context: Ctx, provided: unknown): boolean {
  const session = context.get(sessionContext);
  if (!session || typeof provided !== "string" || provided.length === 0) return false;
  return timingSafeEqual(provided, session.csrfToken);
}

export function requireCsrf(context: Ctx, form: FormData) {
  if (!verifyCsrf(context, form.get("_csrf"))) {
    throw new Response("Your session token is invalid or expired. Reload the page and try again.", {
      status: 403,
    });
  }
}

export async function purgeExpiredSessions(sql: ReturnType<typeof db>) {
  await sql`DELETE FROM sessions WHERE expires_at < now() OR last_seen_at < now() - make_interval(days => ${IDLE_TTL_DAYS})`;
  await sql`DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '1 day'`;
}
