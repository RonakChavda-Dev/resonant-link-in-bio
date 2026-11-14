// Fixed-window rate limiter backed by PostgreSQL so limits are shared across
// every Worker isolate and location. One upsert per check.
import { data, type RouterContextProvider } from "react-router";
import { db } from "./db.server";

export interface LimitRule {
  /** Namespaced key, e.g. `login:ip:<digest>`. Never include raw PII. */
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface LimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
}

export async function checkRateLimit(
  context: Readonly<RouterContextProvider>,
  rule: LimitRule,
): Promise<LimitResult> {
  const sql = db(context);
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStartSec = nowSec - (nowSec % rule.windowSeconds);
  const windowStart = new Date(windowStartSec * 1000);
  const [row] = await sql<{ count: number }[]>`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${rule.key}, ${windowStart}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`;
  const count = row.count;
  return {
    ok: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfter: windowStartSec + rule.windowSeconds - nowSec,
  };
}

/** Check several rules; returns the first failure or ok. */
export async function checkRateLimits(
  context: Readonly<RouterContextProvider>,
  rules: LimitRule[],
): Promise<LimitResult> {
  let last: LimitResult = { ok: true, remaining: Infinity, retryAfter: 0 };
  for (const rule of rules) {
    const result = await checkRateLimit(context, rule);
    if (!result.ok) return result;
    last = result;
  }
  return last;
}

export function tooManyRequests(retryAfter: number, message = "Too many attempts. Please wait and try again.") {
  return data(
    { ok: false as const, formError: message, fieldErrors: {} as Record<string, string> },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)) } },
  );
}

/** Opportunistic cleanup, also run daily by the cron trigger. */
export async function purgeExpiredRateLimits(sql: ReturnType<typeof db>) {
  await sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`;
}
