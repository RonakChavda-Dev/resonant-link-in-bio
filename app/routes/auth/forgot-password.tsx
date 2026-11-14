import { data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/forgot-password";
import { Field, FormError, Turnstile } from "~/components/ui/forms";
import { db, getEnv } from "~/server/db.server";
import { checkRateLimits, tooManyRequests } from "~/server/rate-limit.server";
import { formString, ipKey } from "~/server/request.server";
import { mailMode, PASSWORD_AUTH_OFF_MESSAGE, passwordAuthEnabled, sendMail, turnstileSiteKey, verifyTurnstile } from "~/server/integrations.server";
import { PasswordsInDevelopment } from "~/components/ui/GoogleButton";
import { googleConfigured } from "~/server/oauth.server";
import { emailKey, emailProblem, findUserByEmail, normalizeEmail } from "~/server/users.server";
import { randomToken, sha256Hex } from "~/server/crypto.server";

export const meta: Route.MetaFunction = () => [
  { title: "Reset your password · Resonant" },
  { name: "robots", content: "noindex" },
];

export function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  return { mode: mailMode(env), turnstileSiteKey: turnstileSiteKey(env), passwords: passwordAuthEnabled(env), google: googleConfigured(context) };
}

const RESET_TTL_MINUTES = 30;

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  if (!passwordAuthEnabled(env)) {
    return data({ ok: false as const, formError: PASSWORD_AUTH_OFF_MESSAGE, sent: false }, { status: 403 });
  }
  const mode = mailMode(env);
  if (mode === "unavailable") {
    return data({ ok: false as const, formError: "Password reset by email isn't available on this deployment.", sent: false }, { status: 503 });
  }
  const form = await request.formData();
  const email = normalizeEmail(formString(form, "email", 300));
  const problem = emailProblem(email);
  if (problem) return data({ ok: false as const, formError: problem, sent: false }, { status: 400 });

  const limit = await checkRateLimits(context, [
    { key: `reset:ip:${await ipKey(context, request)}`, limit: 5, windowSeconds: 3600 },
    { key: `reset:acct:${await emailKey(context, email)}`, limit: 3, windowSeconds: 3600 },
  ]);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  if (!(await verifyTurnstile(env, request, form))) {
    return data({ ok: false as const, formError: "The bot check didn't pass. Please try again.", sent: false }, { status: 400 });
  }

  const user = await findUserByEmail(context, email);
  if (user) {
    const token = randomToken(32);
    await db(context)`
      INSERT INTO password_reset_tokens (id, user_id, expires_at)
      VALUES (${await sha256Hex(token)}, ${user.id}, now() + make_interval(mins => ${RESET_TTL_MINUTES}))`;
    const link = `${new URL(request.url).origin}/reset-password?token=${token}`;
    const delivered = await sendMail(env, {
      to: user.email,
      subject: "Reset your Resonant password",
      text: `Someone asked to reset the password for this Resonant account.\n\nIf it was you, open this link within ${RESET_TTL_MINUTES} minutes:\n${link}\n\nIf it wasn't, you can ignore this email; your password hasn't changed.`,
    });
    if (!delivered) {
      // Honest failure: we never claim an email was sent when it wasn't.
      return data({ ok: false as const, formError: "We couldn't send email just now. Please try again later.", sent: false }, { status: 502 });
    }
  }
  return { ok: true as const, formError: null, sent: true };
}

export default function ForgotPassword({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";

  if (!loaderData.passwords) {
    return (
      <>
        <h1 className="display text-4xl">Password reset</h1>
        <div className="mt-6">
          <PasswordsInDevelopment google={loaderData.google}>
            Passwords aren't available on this site yet, so there's nothing to reset.{" "}
            {loaderData.google ? "Accounts here sign in with Google." : null}
          </PasswordsInDevelopment>
        </div>
        <Link to="/login" className="btn btn-ghost mt-8">Back to log in</Link>
      </>
    );
  }

  if (loaderData.mode === "unavailable") {
    return (
      <>
        <h1 className="display text-4xl">Password reset</h1>
        <div className="alert alert-info mt-6">
          This deployment doesn't have an email provider configured, so reset links can't be sent and no email will
          be sent. If you're signed in elsewhere you can change your password in Settings; otherwise contact the
          operator of this site.
        </div>
        <Link to="/login" className="btn btn-ghost mt-8">Back to log in</Link>
      </>
    );
  }

  if (actionData && "sent" in actionData && actionData.sent) {
    return (
      <>
        <h1 className="display text-4xl">Check your inbox</h1>
        <div className="alert alert-ok mt-6" role="status">
          {loaderData.mode === "dev-console"
            ? "Development mode: if an account exists for that address, its reset link was printed in the server terminal instead of being emailed."
            : "If an account exists for that address, we've emailed it a reset link. It expires in 30 minutes."}
        </div>
        <Link to="/login" className="btn btn-ghost mt-8">Back to log in</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="display text-4xl">Reset your password</h1>
      <p className="mt-3 text-dim">Enter your account email and we'll send a link to choose a new password.</p>
      <Form method="post" className="mt-8 grid gap-5" noValidate>
        <FormError message={actionData?.formError} />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Turnstile siteKey={loaderData.turnstileSiteKey} action="reset" />
        <button type="submit" className="btn btn-volt w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </Form>
      <p className="mt-6 text-sm text-dim">
        Remembered it? <Link to="/login" className="text-fg underline underline-offset-4 decoration-volt/60">Log in</Link>
      </p>
    </>
  );
}
