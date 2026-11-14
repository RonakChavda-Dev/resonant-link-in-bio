import { data, Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/reset-password";
import { Field, FormError } from "~/components/ui/forms";
import { db, getEnv } from "~/server/db.server";
import { passwordAuthEnabled } from "~/server/integrations.server";
import { sha256Hex } from "~/server/crypto.server";
import { hashPassword, passwordProblem } from "~/server/password.server";
import { PASSWORD_MIN } from "~/lib/limits";
import { createSession, revokeOtherSessions } from "~/server/session.server";
import { checkRateLimits, tooManyRequests } from "~/server/rate-limit.server";
import { formString, ipKey } from "~/server/request.server";

export const meta: Route.MetaFunction = () => [
  { title: "Choose a new password · Resonant" },
  { name: "robots", content: "noindex" },
  // Keep the token out of Referer headers sent to anything this page loads.
  { name: "referrer", content: "no-referrer" },
];

async function findValidToken(context: Route.LoaderArgs["context"], token: string | null) {
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const [row] = await db(context)<{ id: string; user_id: string; email: string }[]>`
    SELECT t.id, t.user_id, u.email FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
    WHERE t.id = ${await sha256Hex(token)} AND t.used_at IS NULL AND t.expires_at > now()`;
  return row ?? null;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  if (!passwordAuthEnabled(getEnv(context))) return { valid: false };
  const token = new URL(request.url).searchParams.get("token");
  return { valid: (await findValidToken(context, token)) !== null };
}

export async function action({ request, context }: Route.ActionArgs) {
  if (!passwordAuthEnabled(getEnv(context))) {
    return data({ ok: false as const, formError: "This reset link is invalid or has expired." }, { status: 403 });
  }
  const limit = await checkRateLimits(context, [
    { key: `reset-use:ip:${await ipKey(context, request)}`, limit: 10, windowSeconds: 3600 },
  ]);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const token = new URL(request.url).searchParams.get("token");
  const record = await findValidToken(context, token);
  if (!record) return data({ ok: false as const, formError: "This reset link is invalid or has expired." }, { status: 400 });

  const form = await request.formData();
  const password = formString(form, "password", 1000);
  const problem = passwordProblem(password, record.email);
  if (problem) return data({ ok: false as const, formError: problem }, { status: 400 });

  const sql = db(context);
  const hash = await hashPassword(password);
  await sql.begin(async (tx) => {
    await tx`UPDATE users SET password_hash = ${hash}, updated_at = now() WHERE id = ${record.user_id}`;
    await tx`UPDATE password_reset_tokens SET used_at = now() WHERE user_id = ${record.user_id} AND used_at IS NULL`;
  });
  await revokeOtherSessions(context, record.user_id, null);
  const cookie = await createSession(context, request, record.user_id);
  throw redirect("/dashboard", { headers: { "Set-Cookie": cookie } });
}

export default function ResetPassword({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  if (!loaderData.valid) {
    return (
      <>
        <h1 className="display text-4xl">Link expired</h1>
        <p className="mt-4 text-dim">This reset link is invalid, already used or more than 30 minutes old.</p>
        <Link to="/forgot-password" className="btn btn-volt mt-8">Request a new link</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="display text-4xl">Choose a new password</h1>
      <p className="mt-3 text-dim">Saving it signs out every other session on your account.</p>
      <Form method="post" className="mt-8 grid gap-5" noValidate>
        <FormError message={actionData?.formError} />
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={128}
          hint={`At least ${PASSWORD_MIN} characters.`}
        />
        <button type="submit" className="btn btn-volt w-full" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </Form>
    </>
  );
}
