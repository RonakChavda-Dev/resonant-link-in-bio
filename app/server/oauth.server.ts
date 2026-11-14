// Google sign-in: OpenID Connect authorization-code flow with PKCE.
// - state, nonce and the PKCE verifier live in a short-lived, HMAC-signed,
//   HttpOnly cookie scoped to /auth/google.
// - The ID token is obtained directly from Google's token endpoint over TLS
//   (server-to-server), and its iss/aud/exp/nonce/email_verified claims are
//   checked before use.
// - Disabled unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured.
import type { RouterContextProvider } from "react-router";
import { appSecret, getEnv } from "./db.server";
import { base64url, fromBase64url, hmacHex, randomToken, timingSafeEqual } from "./crypto.server";
import { requestMetaContext } from "./context";

type Ctx = Readonly<RouterContextProvider>;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const COOKIE = "rsn_oauth";
const TTL_SECONDS = 600;

export function googleConfigured(context: Ctx): boolean {
  const env = getEnv(context);
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(request: Request) {
  return `${new URL(request.url).origin}/auth/google/callback`;
}

interface FlowState {
  state: string;
  nonce: string;
  verifier: string;
  intent: "login" | "link";
  next: string;
  exp: number;
}

async function sign(context: Ctx, payload: string) {
  return hmacHex(appSecret(context), `oauth:${payload}`);
}

function cookieHeader(context: Ctx, value: string, maxAge: number) {
  const { secure } = context.get(requestMetaContext);
  return [`${COOKIE}=${value}`, "Path=/auth/google", "HttpOnly", "SameSite=Lax", secure ? "Secure" : "", `Max-Age=${maxAge}`].filter(Boolean).join("; ");
}

export function clearFlowCookie(context: Ctx) {
  return cookieHeader(context, "", 0);
}

async function s256(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Build the Google authorization URL and the cookie that remembers this attempt. */
export async function startGoogleFlow(context: Ctx, request: Request, intent: "login" | "link", next: string) {
  const env = getEnv(context);
  const flow: FlowState = {
    state: randomToken(24),
    nonce: randomToken(24),
    verifier: randomToken(48),
    intent,
    next,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const payload = base64url(new TextEncoder().encode(JSON.stringify(flow)));
  const cookie = cookieHeader(context, `${payload}.${await sign(context, payload)}`, TTL_SECONDS);
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: await s256(flow.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie };
}

async function readFlow(context: Ctx, request: Request): Promise<FlowState | null> {
  const raw = request.headers.get("cookie")?.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac || !timingSafeEqual(mac, await sign(context, payload))) return null;
  try {
    const flow = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as FlowState;
    if (typeof flow.exp !== "number" || flow.exp < Date.now() / 1000) return null;
    return flow;
  } catch {
    return null;
  }
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string;
}

export type CallbackResult =
  | { ok: true; identity: GoogleIdentity; intent: "login" | "link"; next: string }
  | { ok: false; reason: "cancelled" | "invalid" | "unverified" };

/** Validate the callback, exchange the code and verify the ID token claims. */
export async function completeGoogleFlow(context: Ctx, request: Request): Promise<CallbackResult> {
  const env = getEnv(context);
  const url = new URL(request.url);
  const flow = await readFlow(context, request);
  if (!flow) return { ok: false, reason: "invalid" };
  if (url.searchParams.get("error")) return { ok: false, reason: "cancelled" };
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!code || code.length > 2048 || !timingSafeEqual(state, flow.state)) return { ok: false, reason: "invalid" };

  let tokens: { id_token?: string };
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(request),
        grant_type: "authorization_code",
        code_verifier: flow.verifier,
      }),
    });
    if (!res.ok) return { ok: false, reason: "invalid" };
    tokens = await res.json();
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const parts = tokens.id_token?.split(".");
  if (!parts || parts.length !== 3) return { ok: false, reason: "invalid" };
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64url(parts[1])));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const now = Date.now() / 1000;
  const issOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const audOk = claims.aud === env.GOOGLE_CLIENT_ID;
  const expOk = typeof claims.exp === "number" && claims.exp > now;
  const nonceOk = typeof claims.nonce === "string" && timingSafeEqual(claims.nonce, flow.nonce);
  if (!issOk || !audOk || !expOk || !nonceOk || typeof claims.sub !== "string" || typeof claims.email !== "string") {
    return { ok: false, reason: "invalid" };
  }
  if (claims.email_verified !== true) return { ok: false, reason: "unverified" };
  return {
    ok: true,
    intent: flow.intent,
    next: flow.next,
    identity: {
      subject: claims.sub,
      email: claims.email.trim().toLowerCase(),
      name: typeof claims.name === "string" ? claims.name.trim().slice(0, 60) : "",
    },
  };
}
