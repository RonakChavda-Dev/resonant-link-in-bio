import { data, Form, Link, redirect, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/signup";
import { privateMeta, seo } from "~/lib/seo";
import { Field, FormError, Turnstile } from "~/components/ui/forms";
import { db, getEnv } from "~/server/db.server";
import { sessionContext } from "~/server/context";
import { createSession } from "~/server/session.server";
import { hashPassword, passwordProblem } from "~/server/password.server";
import { PASSWORD_MIN } from "~/lib/limits";
import { checkRateLimits, tooManyRequests } from "~/server/rate-limit.server";
import { formString, ipKey } from "~/server/request.server";
import { PASSWORD_AUTH_OFF_MESSAGE, passwordAuthEnabled, turnstileSiteKey, verifyTurnstile } from "~/server/integrations.server";
import { displayNameProblem, emailProblem, normalizeEmail } from "~/server/users.server";
import { getTemplate } from "~/lib/templates";
import { normalizeHandle } from "~/lib/handles";
import { safeRedirectPath } from "~/lib/safe-redirect";
import { googleConfigured } from "~/server/oauth.server";
import { GoogleButton, OrDivider, PasswordsInDevelopment } from "~/components/ui/GoogleButton";

export const meta: Route.MetaFunction = ({ matches }) =>
  seo(matches, { title: "Create your account · Resonant", description: "Create a Resonant account to build and publish your page.", path: "/signup" });

function nextStep(params: URLSearchParams) {
  const explicit = params.get("next");
  if (explicit) return safeRedirectPath(explicit);
  const template = getTemplate(params.get("template"))?.id;
  const handle = normalizeHandle(params.get("handle") ?? "").slice(0, 30);
  if (!template && !handle) return "/dashboard";
  const q = new URLSearchParams();
  if (template) q.set("template", template);
  if (handle) q.set("handle", handle);
  return `/dashboard/new?${q}`;
}

export function loader({ context, request }: Route.LoaderArgs) {
  if (context.get(sessionContext)) throw redirect(nextStep(new URL(request.url).searchParams));
  const env = getEnv(context);
  return { turnstileSiteKey: turnstileSiteKey(env), google: googleConfigured(context), passwords: passwordAuthEnabled(env) };
}

type Errors = Partial<Record<"displayName" | "email" | "password", string>>;

export async function action({ request, context }: Route.ActionArgs) {
  if (!passwordAuthEnabled(getEnv(context))) {
    return data(
      { ok: false as const, formError: PASSWORD_AUTH_OFF_MESSAGE, fieldErrors: {} as Errors, values: { displayName: "", email: "" } },
      { status: 403 },
    );
  }
  const form = await request.formData();
  const displayName = formString(form, "displayName", 200).trim();
  const email = normalizeEmail(formString(form, "email", 300));
  const password = formString(form, "password", 1000);
  const values = { displayName, email };

  const fieldErrors: Errors = {};
  const nameErr = displayNameProblem(displayName);
  if (nameErr) fieldErrors.displayName = nameErr;
  const emailErr = emailProblem(email);
  if (emailErr) fieldErrors.email = emailErr;
  const pwErr = passwordProblem(password, email);
  if (pwErr) fieldErrors.password = pwErr;
  if (Object.keys(fieldErrors).length) {
    return data({ ok: false as const, formError: null, fieldErrors, values }, { status: 400 });
  }

  const limit = await checkRateLimits(context, [
    { key: `signup:ip:${await ipKey(context, request)}`, limit: 6, windowSeconds: 3600 },
  ]);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  if (!(await verifyTurnstile(getEnv(context), request, form))) {
    return data(
      { ok: false as const, formError: "The bot check didn't pass. Please try again.", fieldErrors: {}, values },
      { status: 400 },
    );
  }

  const hash = await hashPassword(password);
  const [user] = await db(context)<{ id: string }[]>`
    INSERT INTO users (email, display_name, password_hash)
    VALUES (${email}, ${displayName}, ${hash})
    ON CONFLICT (email) DO NOTHING
    RETURNING id`;
  if (!user) {
    return data(
      {
        ok: false as const,
        formError: "We couldn't create an account with those details. If you already have one, log in instead.",
        fieldErrors: {},
        values,
      },
      { status: 400 },
    );
  }

  const cookie = await createSession(context, request, user.id);
  throw redirect(nextStep(new URL(request.url).searchParams), { headers: { "Set-Cookie": cookie } });
}

export default function Signup({ loaderData, actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const busy = useNavigation().state === "submitting";
  const errors: Errors = actionData?.fieldErrors ?? {};
  const values = actionData && "values" in actionData ? actionData.values : undefined;
  const template = getTemplate(params.get("template"));
  const handle = normalizeHandle(params.get("handle") ?? "");

  return (
    <>
      <h1 className="display text-4xl">Create your account</h1>
      <p className="mt-3 text-dim">
        {template
          ? `You'll start from the ${template.name} template.`
          : handle
            ? `Next you'll set up /@${handle}.`
            : "Then pick a starting design and handle."}
      </p>
      {loaderData.google ? (
        <div className="mt-8 grid gap-5">
          <GoogleButton next={nextStep(params)} label="Sign up with Google" />
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
        <Field
          label="Display name"
          name="displayName"
          autoComplete="name"
          required
          maxLength={60}
          defaultValue={values?.displayName}
          error={errors.displayName}
          hint="Shown next to comments you post."
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={values?.email}
          error={errors.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={128}
          error={errors.password}
          hint={`At least ${PASSWORD_MIN} characters. A short phrase works well.`}
        />
        <Turnstile siteKey={loaderData.turnstileSiteKey} action="signup" />
        <button type="submit" className="btn btn-volt w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </Form>
      )}
      <p className="mt-6 text-sm text-dim">
        Already have an account?{" "}
        <Link to={`/login?next=${encodeURIComponent(nextStep(params))}`} className="text-fg underline underline-offset-4 decoration-volt/60">
          Log in
        </Link>
      </p>
      <p className="mt-3 text-xs text-faint leading-relaxed">
        {loaderData.passwords ? "Email addresses aren't verified yet. " : null} See <Link to="/privacy" className="underline">what we store</Link>.
      </p>
    </>
  );
}
