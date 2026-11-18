import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext, requestMetaContext } from "../app/server/context";
import { createDbHolder } from "../app/server/db.server";
import { isAllowedOrigin } from "../app/server/request.server";
import { base64url, randomBytes } from "../app/server/crypto.server";
import { purgeExpiredSessions } from "../app/server/session.server";
import { purgeExpiredRateLimits } from "../app/server/rate-limit.server";
import postgres from "postgres";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

function contentSecurityPolicy(nonce: string, dev: boolean, secure: boolean) {
  const turnstile = "https://challenges.cloudflare.com";
  const directives = [
    "default-src 'self'",
    dev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${turnstile}`,
    // Inline style attributes carry constrained theme tokens (CSS variables).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    dev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    `frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com https://open.spotify.com https://w.soundcloud.com ${turnstile}`,
    "media-src 'self' https:", // profile music may be a pasted https:// audio link
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    secure && !dev ? "upgrade-insecure-requests" : "",
  ];
  return directives.filter(Boolean).join("; ");
}

function applySecurityHeaders(response: Response, nonce: string, secure: boolean): Response {
  const res = new Response(response.body, response);
  const h = res.headers;
  const dev = import.meta.env.DEV;
  const type = h.get("content-type") ?? "";
  // Routes that set their own CSP (the code sandbox) keep it.
  if (type.includes("text/html") && !h.has("Content-Security-Policy")) {
    h.set("Content-Security-Policy", contentSecurityPolicy(nonce, dev, secure));
  }
  h.set("X-Content-Type-Options", "nosniff");
  if (!h.has("Referrer-Policy")) h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!h.has("X-Frame-Options")) h.set("X-Frame-Options", "DENY");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  if (secure) h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Default: responses may contain per-user data, so never let shared caches store them.
  if (!h.has("Cache-Control")) h.set("Cache-Control", "private, no-store");
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const secure = url.protocol === "https:";
    const nonce = base64url(randomBytes(16));

    if (!isAllowedOrigin(request)) {
      return applySecurityHeaders(
        new Response("Cross-origin request refused.", {
          status: 403,
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
        nonce,
        secure,
      );
    }

    const dbHolder = createDbHolder(env);
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    context.set(requestMetaContext, { nonce, secure, db: dbHolder });

    try {
      const response = await requestHandler(request, context);
      return applySecurityHeaders(response, nonce, secure);
    } finally {
      ctx.waitUntil(dbHolder.close());
    }
  },

  // Daily housekeeping: expired sessions, reset tokens, rate-limit windows,
  // retired handles past their cooling-off period.
  async scheduled(_event, env, ctx) {
    const sql = postgres(env.HYPERDRIVE.connectionString, { max: 1, fetch_types: false });
    ctx.waitUntil(
      (async () => {
        try {
          await purgeExpiredSessions(sql);
          await purgeExpiredRateLimits(sql);
          await sql`DELETE FROM retired_handles WHERE retired_at < now() - interval '30 days'`;
        } finally {
          await sql.end({ timeout: 5 });
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
