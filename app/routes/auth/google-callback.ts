// GET /auth/google/callback — finish Google sign-in.
// Safety rule: a Google identity is never silently attached to an existing
// email/password account (that would let someone who pre-registered your
// email keep access). Existing users connect Google from Settings instead.
import { redirect } from "react-router";
import type { Route } from "./+types/google-callback";
import { db } from "~/server/db.server";
import { sessionContext } from "~/server/context";
import { createSession } from "~/server/session.server";
import { clearFlowCookie, completeGoogleFlow, googleConfigured } from "~/server/oauth.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  if (!googleConfigured(context)) throw redirect("/login?error=google-unavailable");
  const clear = clearFlowCookie(context);
  const fail = (error: string, to = "/login") => redirect(`${to}?error=${error}`, { headers: { "Set-Cookie": clear } });

  const result = await completeGoogleFlow(context, request);
  if (!result.ok) throw fail(result.reason === "cancelled" ? "google-cancelled" : result.reason === "unverified" ? "google-unverified" : "google-failed");
  const { identity, intent, next } = result;
  const sql = db(context);
  const [linked] = await sql<{ user_id: string }[]>`
    SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND subject = ${identity.subject}`;

  if (intent === "link") {
    const session = context.get(sessionContext);
    if (!session) throw fail("google-failed");
    if (linked && linked.user_id !== session.user.id) throw fail("google-in-use", "/settings");
    if (!linked) {
      await sql`
        INSERT INTO oauth_accounts (provider, subject, user_id, email)
        VALUES ('google', ${identity.subject}, ${session.user.id}, ${identity.email})
        ON CONFLICT (user_id, provider) DO NOTHING`;
    }
    throw redirect("/settings?connected=google", { headers: { "Set-Cookie": clear } });
  }

  let userId = linked?.user_id;
  if (!userId) {
    const [existing] = await sql`SELECT 1 FROM users WHERE email = ${identity.email}`;
    if (existing) throw fail("google-exists");
    const displayName = identity.name || identity.email.split("@")[0].slice(0, 60) || "New member";
    const created = await sql.begin(async (tx) => {
      const [user] = await tx<{ id: string }[]>`
        INSERT INTO users (email, display_name, password_hash, email_verified_at)
        VALUES (${identity.email}, ${displayName}, NULL, now())
        ON CONFLICT (email) DO NOTHING
        RETURNING id`;
      if (!user) return null;
      await tx`INSERT INTO oauth_accounts (provider, subject, user_id, email) VALUES ('google', ${identity.subject}, ${user.id}, ${identity.email})`;
      return user.id;
    });
    if (!created) throw fail("google-exists");
    userId = created;
  }

  const sessionCookie = await createSession(context, request, userId);
  const headers = new Headers();
  headers.append("Set-Cookie", clear);
  headers.append("Set-Cookie", sessionCookie);
  throw redirect(next, { headers });
}
