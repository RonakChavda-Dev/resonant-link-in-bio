// GET /auth/google — start Google sign-in (or account linking when signed in).
import { redirect } from "react-router";
import type { Route } from "./+types/google";
import { sessionContext } from "~/server/context";
import { googleConfigured, startGoogleFlow } from "~/server/oauth.server";
import { checkRateLimit } from "~/server/rate-limit.server";
import { ipKey, safeRedirectPath } from "~/server/request.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  if (!googleConfigured(context)) throw redirect("/login?error=google-unavailable");
  const limit = await checkRateLimit(context, { key: `oauth:ip:${await ipKey(context, request)}`, limit: 20, windowSeconds: 600 });
  if (!limit.ok) throw redirect("/login?error=rate-limited");
  const url = new URL(request.url);
  const session = context.get(sessionContext);
  const intent = url.searchParams.get("intent") === "link" && session ? "link" : "login";
  const next = safeRedirectPath(url.searchParams.get("next"), intent === "link" ? "/settings" : "/dashboard");
  const { url: target, cookie } = await startGoogleFlow(context, request, intent, next);
  throw redirect(target, { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } });
}
