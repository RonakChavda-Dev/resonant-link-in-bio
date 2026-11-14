import { data, Form, redirect, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/settings";
import { privateMeta } from "~/lib/seo";
import { CsrfInput, Field, FormError } from "~/components/ui/forms";
import { db, getEnv } from "~/server/db.server";
import { destroySession, requireCsrf, requireUser, revokeOtherSessions } from "~/server/session.server";
import { hashPassword, passwordProblem, verifyPassword } from "~/server/password.server";
import { PASSWORD_MIN } from "~/lib/limits";
import { checkRateLimit, tooManyRequests } from "~/server/rate-limit.server";
import { formString } from "~/server/request.server";
import { displayNameProblem, findUserById } from "~/server/users.server";
import { googleConfigured } from "~/server/oauth.server";
import { PASSWORD_AUTH_OFF_MESSAGE, passwordAuthEnabled } from "~/server/integrations.server";
import { OAUTH_ERRORS, GoogleButton, PasswordsInDevelopment } from "~/components/ui/GoogleButton";

export const meta: Route.MetaFunction = () => privateMeta("Settings");

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = requireUser(context, request);
  const sessions = await db(context)<{ id: string; client_label: string; created_at: Date; last_seen_at: Date }[]>`
    SELECT id, client_label, created_at, last_seen_at FROM sessions
    WHERE user_id = ${session.user.id} AND expires_at > now()
    ORDER BY last_seen_at DESC`;
  const [account] = await db(context)<{ has_password: boolean; google_email: string | null }[]>`
    SELECT (u.password_hash IS NOT NULL) AS has_password,
           (SELECT email FROM oauth_accounts o WHERE o.user_id = u.id AND o.provider = 'google') AS google_email
    FROM users u WHERE u.id = ${session.user.id}`;
  return {
    hasPassword: account.has_password,
    googleEmail: account.google_email,
    googleAvailable: googleConfigured(context),
    passwords: passwordAuthEnabled(getEnv(context)),
    email: session.user.email,
    displayName: session.user.displayName,
    sessions: sessions.map((s) => ({
      // Expose only a short prefix of the digest as a handle; never the cookie token.
      ref: s.id.slice(0, 16),
      current: s.id === session.id,
      label: s.client_label,
      createdAt: s.created_at.toISOString(),
      lastSeenAt: s.last_seen_at.toISOString(),
    })),
  };
}

type Result = { intent: string; ok: boolean; message?: string; error?: string };

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireUser(context, request);
  const form = await request.formData();
  requireCsrf(context, form);
  const intent = formString(form, "intent", 40);
  const sql = db(context);
  const userId = session.user.id;
  const fail = (error: string, status = 400) => data<Result>({ intent, ok: false, error }, { status });
  const passwords = passwordAuthEnabled(getEnv(context));

  switch (intent) {
    case "profile": {
      const name = formString(form, "displayName", 200).trim();
      const problem = displayNameProblem(name);
      if (problem) return fail(problem);
      await sql`UPDATE users SET display_name = ${name}, updated_at = now() WHERE id = ${userId}`;
      return { intent, ok: true, message: "Display name updated." } satisfies Result;
    }
    case "password": {
      if (!passwords) return fail(PASSWORD_AUTH_OFF_MESSAGE, 403);
      const limit = await checkRateLimit(context, { key: `pw-change:user:${userId}`, limit: 5, windowSeconds: 900 });
      if (!limit.ok) return tooManyRequests(limit.retryAfter);
      const user = await findUserById(context, userId);
      if (!user) return fail("Account not found.");
      // Accounts created with Google can set a first password without a current one.
      if (user.password_hash && !(await verifyPassword(user.password_hash, formString(form, "current", 1000)))) {
        return fail("Your current password is incorrect.");
      }
      const next = formString(form, "next", 1000);
      const problem = passwordProblem(next, user.email);
      if (problem) return fail(problem);
      await sql`UPDATE users SET password_hash = ${await hashPassword(next)}, updated_at = now() WHERE id = ${userId}`;
      await revokeOtherSessions(context, userId, session.id);
      return { intent, ok: true, message: user.password_hash ? "Password changed. Your other sessions were signed out." : "Password set. You can now also log in with your email." } satisfies Result;
    }
    case "google-disconnect": {
      // With passwords switched off, Google is the only way back in.
      if (!passwords) return fail("You can't disconnect Google while it's the only way to sign in here.");
      const user = await findUserById(context, userId);
      if (!user?.password_hash) return fail("Set a password first, so you can still log in after disconnecting Google.");
      await sql`DELETE FROM oauth_accounts WHERE user_id = ${userId} AND provider = 'google'`;
      return { intent, ok: true, message: "Google disconnected." } satisfies Result;
    }
    case "revoke": {
      const ref = formString(form, "ref", 32);
      if (!/^[0-9a-f]{16}$/.test(ref)) return fail("Unknown session.");
      await sql`DELETE FROM sessions WHERE user_id = ${userId} AND left(id, 16) = ${ref} AND id <> ${session.id}`;
      return { intent, ok: true, message: "Session signed out." } satisfies Result;
    }
    case "revoke-others": {
      await revokeOtherSessions(context, userId, session.id);
      return { intent, ok: true, message: "All other sessions were signed out." } satisfies Result;
    }
    case "delete-account": {
      const limit = await checkRateLimit(context, { key: `delete:user:${userId}`, limit: 5, windowSeconds: 900 });
      if (!limit.ok) return tooManyRequests(limit.retryAfter);
      const user = await findUserById(context, userId);
      if (!user) return fail("Account not found.");
      const byPassword = passwords && !!user.password_hash;
      const confirmed = byPassword
        ? await verifyPassword(user.password_hash!, formString(form, "password", 1000))
        : formString(form, "confirmEmail", 300).trim().toLowerCase() === user.email;
      if (!confirmed) return fail(byPassword ? "Your password is incorrect." : "Type your email address exactly to confirm.");
      const objects = await sql<{ object_key: string }[]>`SELECT object_key FROM media WHERE owner_id = ${userId}`;
      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO retired_handles (handle)
          SELECT handle FROM profiles WHERE owner_id = ${userId} AND status <> 'draft'
          ON CONFLICT (handle) DO UPDATE SET retired_at = now()`;
        await tx`DELETE FROM users WHERE id = ${userId}`; // cascades to sessions, profiles, media rows, comments
      });
      const bucket = getEnv(context).MEDIA;
      for (let i = 0; i < objects.length; i += 1000) {
        await bucket.delete(objects.slice(i, i + 1000).map((o) => o.object_key));
      }
      const cookie = await destroySession(context);
      throw redirect("/", { headers: { "Set-Cookie": cookie } });
    }
    default:
      throw data("Unknown action", { status: 400 });
  }
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting" ? navigation.formData?.get("intent") : null;
  const result = actionData as Result | undefined;
  const msg = (intent: string) =>
    result?.intent === intent ? (
      result.ok ? <div className="alert alert-ok" role="status">{result.message}</div> : <FormError message={result.error} />
    ) : null;

  return (
    <>
      <p className="eyebrow mb-2">Settings</p>
      <h1 className="display text-4xl sm:text-5xl">Account</h1>

      <div className="mt-10 grid max-w-2xl gap-6">
        <Section title="Profile">
          <Form method="post" className="grid gap-4">
            <CsrfInput />
            <input type="hidden" name="intent" value="profile" />
            {msg("profile")}
            <Field label="Display name" name="displayName" defaultValue={loaderData.displayName} maxLength={60} required hint="Shown next to comments you post." />
            <div className="field">
              <span className="field-label">Email</span>
              <p className="text-sm text-dim">{loaderData.email}</p>
              <p className="field-hint">Changing your email isn't available yet because addresses can't be verified on this deployment.</p>
            </div>
            <button className="btn btn-ghost btn-sm justify-self-start" disabled={pending === "profile"}>Save</button>
          </Form>
        </Section>

        <Section title="Connected accounts">
          {params.get("connected") === "google" ? <div className="alert alert-ok mb-4" role="status">Google connected.</div> : null}
          {params.get("error") && OAUTH_ERRORS[params.get("error")!] ? <div className="alert alert-error mb-4" role="alert">{OAUTH_ERRORS[params.get("error")!]}</div> : null}
          {msg("google-disconnect")}
          {loaderData.googleEmail ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm">Google</p>
                <p className="truncate text-xs text-faint">Connected as {loaderData.googleEmail}</p>
              </div>
              <Form method="post">
                <CsrfInput />
                <input type="hidden" name="intent" value="google-disconnect" />
                <button className="btn btn-quiet btn-sm" disabled={!loaderData.passwords || !loaderData.hasPassword} title={!loaderData.passwords ? "Google is the only way to sign in here" : loaderData.hasPassword ? undefined : "Set a password first"}>Disconnect</button>
              </Form>
            </div>
          ) : loaderData.googleAvailable ? (
            <div className="grid gap-2">
              <p className="text-sm text-dim">Connect Google to log in with one click.</p>
              <div className="max-w-xs"><GoogleButton label="Connect Google" next="/settings" /></div>
            </div>
          ) : (
            <p className="text-sm text-dim">Google sign-in isn't configured on this deployment.</p>
          )}
        </Section>

        <Section title="Password">
          {!loaderData.passwords ? (
            <PasswordsInDevelopment google={loaderData.googleAvailable}>
              Setting or changing a password isn't available on this site yet. You sign in with Google.
            </PasswordsInDevelopment>
          ) : (
          <Form method="post" className="grid gap-4">
            <CsrfInput />
            <input type="hidden" name="intent" value="password" />
            {msg("password")}
            {loaderData.hasPassword ? (
              <Field label="Current password" name="current" type="password" autoComplete="current-password" required />
            ) : (
              <p className="text-sm text-dim">Your account uses Google sign-in. Set a password to also log in with your email.</p>
            )}
            <Field label="New password" name="next" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={128} hint={`At least ${PASSWORD_MIN} characters. Changing it signs out your other sessions.`} />
            <button className="btn btn-ghost btn-sm justify-self-start" disabled={pending === "password"}>
              {pending === "password" ? "Saving…" : loaderData.hasPassword ? "Change password" : "Set password"}
            </button>
          </Form>
          )}
        </Section>

        <Section title="Sessions">
          {msg("revoke")}
          {msg("revoke-others")}
          <ul className="grid gap-2">
            {loaderData.sessions.map((s) => (
              <li key={s.ref} className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    {s.label} {s.current ? <span className="ml-1 rounded-full border border-volt/50 px-2 py-0.5 text-[0.7rem] text-volt">This device</span> : null}
                  </p>
                  <p className="text-xs text-faint">
                    Signed in {new Date(s.createdAt).toLocaleDateString()} · last active {new Date(s.lastSeenAt).toLocaleString()}
                  </p>
                </div>
                {!s.current ? (
                  <Form method="post">
                    <CsrfInput />
                    <input type="hidden" name="intent" value="revoke" />
                    <input type="hidden" name="ref" value={s.ref} />
                    <button className="btn btn-quiet btn-sm">Sign out</button>
                  </Form>
                ) : null}
              </li>
            ))}
          </ul>
          {loaderData.sessions.length > 1 ? (
            <Form method="post" className="mt-3">
              <CsrfInput />
              <input type="hidden" name="intent" value="revoke-others" />
              <button className="btn btn-ghost btn-sm">Sign out all other sessions</button>
            </Form>
          ) : null}
        </Section>

        <Section title="Delete account" danger>
          <p className="text-sm text-dim">
            Permanently deletes your account, every page (drafts, history, analytics, comments on them), your uploads
            and comments you've posted elsewhere. This can't be undone.
          </p>
          <Form method="post" className="mt-4 grid gap-4">
            <CsrfInput />
            <input type="hidden" name="intent" value="delete-account" />
            {msg("delete-account")}
            {loaderData.passwords && loaderData.hasPassword ? (
              <Field label="Confirm with your password" name="password" type="password" autoComplete="current-password" required />
            ) : (
              <Field label="Type your email address to confirm" name="confirmEmail" type="email" autoComplete="off" required />
            )}
            <button className="btn btn-danger btn-sm justify-self-start" disabled={pending === "delete-account"}>
              Delete my account
            </button>
          </Form>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`card p-6 ${danger ? "!border-danger/25" : ""}`}>
      <h2 className={`mb-5 text-lg font-semibold tracking-[-0.015em] ${danger ? "text-danger" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}
