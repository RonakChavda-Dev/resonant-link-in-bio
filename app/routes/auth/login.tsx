import { data, Form, Link, redirect, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/login";
import { Field, FormError, Turnstile } from "~/components/ui/forms";
import { db, getEnv } from "~/server/db.server";
import { sessionContext } from "~/server/context";
import { createSession } from "~/server/session.server";
import { burnPasswordCheck, hashPassword, needsRehash, verifyPassword } from "~/server/password.server";
import { checkRateLimits, tooManyRequests } from "~/server/rate-limit.server";
import { formString, ipKey, safeRedirectPath } from "~/server/request.server";
import { PASSWORD_AUTH_OFF_MESSAGE, passwordAuthEnabled, turnstileSiteKey, verifyTurnstile } from "~/server/integrations.server";
import { emailKey, findUserByEmail, normalizeEmail } from "~/server/users.server";
import { googleConfigured } from "~/server/oauth.server";
import { GoogleButton, OAUTH_ERRORS, OrDivider, PasswordsInDevelopment } from "~/components/ui/GoogleButton";

export const meta: Route.MetaFunction = () => [
  { title: "Log in · Resonant" },
  { name: "description", content: "Log in to edit and publish your Resonant page." },
];

export function loader({ context, request }: Route.LoaderArgs) {
  const next = safeRedirectPath(new URL(request.url).searchParams.get("next"));
  if (context.get(sessionContext)) throw redirect(next);
  const env = getEnv(context);
  return { turnstileSiteKey: turnstileSiteKey(env), google: googleConfigured(context), passwords: passwordAuthEnabled(env) };
}

const GENERIC = "That email and password don't match an account.";

export async function action({ request, context }: Route.ActionArgs) {
  if (!passwordAuthEnabled(getEnv(context))) {
    return data({ ok: false as const, formError: PASSWORD_AUTH_OFF_MESSAGE, fieldErrors: {}, values: { email: "" } }, { status: 403 });
  }
  const form = await request.formData();
  const email = normalizeEmail(formString(form, "email", 300));
  const password = formString(form, "password", 1000);
  const next = safeRedirectPath(new URL(request.url).searchParams.get("next"));
  const values = { email };

  if (!email || !password || password.length > 128) {
    return data({ ok: false as const, formError: GENERIC, fieldErrors: {}, values }, { status: 400 });
  }

  // Per-network and per-account throttles slow brute force and credential stuffing.
  const limit = await checkRateLimits(context, [
    { key: `login:ip:${await ipKey(context, request)}`, limit: 20, windowSeconds: 600 },
    { key: `login:acct:${await emailKey(context, email)}`, limit: 8, windowSeconds: 900 },
  ]);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  if (!(await verifyTurnstile(getEnv(context), request, form))) {
    return data(
      { ok: false as const, formError: "The bot check didn't pass. Please try again.", fieldErrors: {}, values },
      { status: 400 },
    );
  }

  const user = await findUserByEmail(context, email);
  if (!user) {
    await burnPasswordCheck(password); // keep timing similar for unknown emails
    return data({ ok: false as const, formError: GENERIC, fieldErrors: {}, values }, { status: 400 });
  }
  if (!user.password_hash) {
    await burnPasswordCheck(password); // Google-only account: same generic answer
    return data({ ok: false as const, formError: GENERIC, fieldErrors: {}, values }, { status: 400 });
  }
  if (!(await verifyPassword(user.password_hash, password))) {
    return data({ ok: false as const, formError: GENERIC, fieldErrors: {}, values }, { status: 400 });
  }
  if (needsRehash(user.password_hash)) {
    await db(context)`UPDATE users SET password_hash = ${await hashPassword(password)}, updated_at = now() WHERE id = ${user.id}`;
  }

  const cookie = await createSession(context, request, user.id);
  throw redirect(next, { headers: { "Set-Cookie": cookie } });
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const busy = useNavigation().state === "submitting";
  const next = params.get("next");
  return (
    <>
      <h1 className="display text-4xl">Welcome back</h1>
      <p className="mt-3 text-dim">Log in to edit and publish your pages.</p>
      {params.get("error") && OAUTH_ERRORS[params.get("error")!] ? (
        <div role="alert" className="alert alert-error mt-6">{OAUTH_ERRORS[params.get("error")!]}</div>
      ) : null}
      {loaderData.google ? (
        <div className="mt-8 grid gap-5">
          <GoogleButton next={next} />
          {loaderData.passwords ? <OrDivider /> : null}
        </div>
      ) : null}
      {!loaderData.passwords ? (
        <div className={loaderData.google ? "mt-5" : "mt-8"}>
          <PasswordsInDevelopment google={loaderData.google} />
        </div>
      ) : (
      <Form method="post" className={`${loaderData.google ? "mt-5" : "mt-8"} grid gap-5`} noValidate>
        <FormError message={actionData?.formError} />
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={actionData && "values" in actionData ? actionData.values.email : undefined} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-sm text-dim hover:text-fg">
            Forgot your password?
          </Link>
        </div>
        <Turnstile siteKey={loaderData.turnstileSiteKey} action="login" />
        <button type="submit" className="btn btn-volt w-full" disabled={busy}>
          {busy ? "Checking…" : "Log in"}
        </button>
      </Form>
      )}
      <p className="mt-6 text-sm text-dim">
        New to Resonant?{" "}
        <Link to={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="text-fg underline underline-offset-4 decoration-volt/60">
          Create an account
        </Link>
      </p>
    </>
  );
}
