import type { RouterContextProvider } from "react-router";
import { appSecret } from "./db.server";
import { hmacHex } from "./crypto.server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF layer 1 (applied to every request in the Worker entry): state-changing
 * requests must come from our own origin. Browsers always send `Origin` on
 * cross-origin POSTs and on same-origin fetch/form POSTs in current engines;
 * `Sec-Fetch-Site` is accepted as a fallback. Requests with neither are refused.
 */
export function isAllowedOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) return origin === url.origin;
  const site = request.headers.get("sec-fetch-site");
  return site === "same-origin";
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "local";
}

/** Keyed digest of the client IP so rate-limit rows never contain raw addresses. */
export async function ipKey(context: Readonly<RouterContextProvider>, request: Request) {
  return (await hmacHex(appSecret(context), `ip:${clientIp(request)}`)).slice(0, 32);
}

export { safeRedirectPath } from "~/lib/safe-redirect";

/** Coarse device label for the session list. The raw user agent is not stored. */
export function clientLabel(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "unknown OS";
  return `${browser} on ${os}`;
}

export function formString(form: FormData, name: string, max = 10_000): string {
  const value = form.get(name);
  if (typeof value !== "string") return "";
  return value.length > max ? value.slice(0, max) : value;
}
