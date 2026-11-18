import { useId, useState } from "react";
import { data, Form, redirect, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/settings";
import { privateMeta } from "~/lib/seo";
import { CsrfInput, Field, FormError, useCsrfToken } from "~/components/ui/forms";
import { db, getEnv } from "~/server/db.server";
import { destroySession, requireCsrf, requireUser, revokeOtherSessions } from "~/server/session.server";
import { hashPassword, passwordProblem, verifyPassword } from "~/server/password.server";
import { PASSWORD_MIN } from "~/lib/limits";
import { checkRateLimit, tooManyRequests } from "~/server/rate-limit.server";
import { formString } from "~/server/request.server";
import { displayNameProblem, findUserById } from "~/server/users.server";
import { getAccount, ownsImage, updateAccountProfile, updatePreferences } from "~/server/account.server";
import { googleConfigured } from "~/server/oauth.server";
import { PASSWORD_AUTH_OFF_MESSAGE, passwordAuthEnabled } from "~/server/integrations.server";
import { OAUTH_ERRORS, GoogleButton, PasswordsInDevelopment } from "~/components/ui/GoogleButton";
import { Avatar } from "~/components/ui/Avatar";
import { MediaPicker, type MediaItem } from "~/components/editor/MediaPicker";
import { Icons } from "~/components/editor/controls";
import { BIO_MAX, bioProblem, parseSocialLinks, SOCIAL_LABEL_MAX, SOCIAL_LINKS_MAX, type AccountProfile } from "~/lib/account";
import { normalizeLink, platformFor } from "~/lib/urls";

export const meta: Route.MetaFunction = () => privateMeta("Settings");

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = requireUser(context, request);
  const sql = db(context);
  const sessions = await sql<{ id: string; client_label: string; created_at: Date; last_seen_at: Date }[]>`
    SELECT id, client_label, created_at, last_seen_at FROM sessions
    WHERE user_id = ${session.user.id} AND expires_at > now()
    ORDER BY last_seen_at DESC`;
  const [authRow] = await sql<{ has_password: boolean; google_email: string | null }[]>`
    SELECT (u.password_hash IS NOT NULL) AS has_password,
           (SELECT email FROM oauth_accounts o WHERE o.user_id = u.id AND o.provider = 'google') AS google_email
    FROM users u WHERE u.id = ${session.user.id}`;
  const images = await sql<{ id: string }[]>`
    SELECT id FROM media WHERE owner_id = ${session.user.id} AND content_type LIKE 'image/%'
    ORDER BY created_at DESC LIMIT 40`;
  const account = await getAccount(context, session.user.id);
  return {
    profile: account.profile,
    preferences: account.preferences,
    images: images.map((m): MediaItem => ({ id: m.id })),
    hasPassword: authRow.has_password,
    googleEmail: authRow.google_email,
    googleAvailable: googleConfigured(context),
    passwords: passwordAuthEnabled(getEnv(context)),
    email: session.user.email,
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
      const limit = await checkRateLimit(context, { key: `account-profile:user:${userId}`, limit: 30, windowSeconds: 600 });
      if (!limit.ok) return tooManyRequests(limit.retryAfter);
      const displayName = formString(form, "displayName", 200).trim();
      const nameProblem = displayNameProblem(displayName);
      if (nameProblem) return fail(nameProblem);
      const bio = formString(form, "bio", BIO_MAX * 2).replace(/\r\n?/g, "\n").trim();
      const bioError = bioProblem(bio);
      if (bioError) return fail(bioError);
      const avatarRaw = formString(form, "avatar", 64);
      const avatar = avatarRaw || null;
      if (avatar && !(await ownsImage(context, userId, avatar))) return fail("That avatar image isn't one of your uploads. Upload it again.");
      // Paired url/label fields; cap how many rows are read before validating.
      const urls = form.getAll("socialUrl").slice(0, SOCIAL_LINKS_MAX + 8);
      const labels = form.getAll("socialLabel");
      const socials = parseSocialLinks(
        urls.map((u, i) => ({
          url: typeof u === "string" ? u.slice(0, 2048) : "",
          label: typeof labels[i] === "string" ? (labels[i] as string).slice(0, 200) : "",
        })),
      );
      if ("error" in socials) return fail(socials.error);
      await updateAccountProfile(context, userId, { displayName, avatar, bio, socials: socials.links });
      return { intent, ok: true, message: "Profile saved." } satisfies Result;
    }
    case "preferences": {
      await updatePreferences(context, userId, {
        prefillPages: form.get("prefillPages") === "on",
        newPageComments: form.get("newPageComments") === "on",
        commentAvatar: form.get("commentAvatar") === "on",
      });
      return { intent, ok: true, message: "Preferences saved." } satisfies Result;
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

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "sign-in", label: "Sign-in & security" },
  { id: "sessions", label: "Sessions" },
  { id: "delete", label: "Delete account" },
] as const;

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting" ? navigation.formData?.get("intent") : null;
  const result = actionData as Result | undefined;
  const msg = (intent: string) =>
    result?.intent === intent ? (
      result.ok ? <div className="alert alert-ok" role="status">{result.message}</div> : <FormError message={result.error} />
    ) : null;
  const prefs = loaderData.preferences;

  return (
    <>
      <p className="eyebrow mb-2">Settings</p>
      <h1 className="display text-4xl sm:text-5xl">Your account</h1>
      <p className="mt-3 max-w-xl text-dim">
        Set up your profile once and reuse it on every page, choose defaults for new pages, and manage how you sign in.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-full px-3 py-1.5 text-sm text-dim transition-colors hover:bg-white/[0.04] hover:text-fg lg:rounded-lg">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid min-w-0 max-w-3xl gap-6">
          <Section id="profile" title="Profile" intro="Your account profile is private. Copy it into a page from the editor, or let new pages start with it (see Preferences).">
            <ProfileForm
              key={JSON.stringify(loaderData.profile)}
              profile={loaderData.profile}
              images={loaderData.images}
              pending={pending === "profile"}
              message={msg("profile")}
            />
          </Section>

          <Section id="preferences" title="Preferences">
            <Form method="post" className="grid gap-1">
              <CsrfInput />
              <input type="hidden" name="intent" value="preferences" />
              {msg("preferences")}
              <Toggle
                name="prefillPages"
                defaultChecked={prefs.prefillPages}
                label="Start new pages with my profile"
                hint="New pages fill their intro with your name, avatar and bio, and their social links row with your links."
              />
              <Toggle
                name="newPageComments"
                defaultChecked={prefs.newPageComments}
                label="Turn on comments for new pages"
                hint="Only signed-in visitors can comment. You can change this per page in the editor at any time."
              />
              <Toggle
                name="commentAvatar"
                defaultChecked={prefs.commentAvatar}
                label="Show my avatar next to my comments"
                hint="When on, your avatar is shown publicly beside comments you post on any page. Your email is never shown."
              />
              <button className="btn btn-ghost btn-sm mt-3 justify-self-start" disabled={pending === "preferences"}>
                {pending === "preferences" ? "Saving…" : "Save preferences"}
              </button>
            </Form>
          </Section>

          <Section id="sign-in" title="Sign-in & security">
            <div className="grid gap-6">
              <div className="field">
                <span className="field-label">Email</span>
                <p className="break-all text-sm text-dim">{loaderData.email}</p>
                <p className="field-hint">Changing your email isn't available yet because addresses can't be verified on this deployment.</p>
              </div>

              <div className="grid gap-3">
                <h3 className="field-label">Connected accounts</h3>
                {params.get("connected") === "google" ? <div className="alert alert-ok" role="status">Google connected.</div> : null}
                {params.get("error") && OAUTH_ERRORS[params.get("error")!] ? <div className="alert alert-error" role="alert">{OAUTH_ERRORS[params.get("error")!]}</div> : null}
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
              </div>

              <div className="grid gap-3">
                <h3 className="field-label">Password</h3>
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
              </div>
            </div>
          </Section>

          <Section id="sessions" title="Sessions" intro="Devices currently signed in to your account. Sessions end after 7 days of inactivity or 30 days at most.">
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

          <Section id="delete" title="Delete account" danger>
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
      </div>
    </>
  );
}

type SocialRow = { key: number; url: string; label: string };

function ProfileForm({ profile, images, pending, message }: { profile: AccountProfile; images: MediaItem[]; pending: boolean; message: React.ReactNode }) {
  const csrf = useCsrfToken();
  const ids = useId();
  const [library, setLibrary] = useState(images);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [name, setName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [nextKey, setNextKey] = useState(profile.socials.length + 1);
  const [rows, setRows] = useState<SocialRow[]>(() =>
    profile.socials.length
      ? profile.socials.map((s, i) => ({ key: i, url: s.url, label: s.label ?? "" }))
      : [{ key: 0, url: "", label: "" }],
  );

  const setRow = (key: number, patch: Partial<SocialRow>) => setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const move = (index: number, by: -1 | 1) =>
    setRows((r) => {
      const next = [...r];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });
  const addRow = () => {
    setRows((r) => [...r, { key: nextKey, url: "", label: "" }]);
    setNextKey((k) => k + 1);
  };
  const previewLinks = rows.map((r) => normalizeLink(r.url)).filter((u): u is string => !!u);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
      <Form method="post" className="grid min-w-0 gap-5">
        <CsrfInput />
        <input type="hidden" name="intent" value="profile" />
        <input type="hidden" name="avatar" value={avatar ?? ""} />
        {message}
        <MediaPicker
          label="Avatar"
          value={avatar}
          onChange={setAvatar}
          library={library}
          onUploaded={(item) => setLibrary((l) => [item, ...l])}
          csrf={csrf}
        />
        <Field label="Display name" name="displayName" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required hint="Shown next to comments you post, and used as the name on new pages." />
        <div className="field">
          <label htmlFor={`${ids}-bio`} className="field-label">Short bio</label>
          <textarea
            id={`${ids}-bio`}
            name="bio"
            className="input"
            rows={3}
            maxLength={BIO_MAX}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            aria-describedby={`${ids}-bio-hint`}
            placeholder="A sentence about you or your work."
          />
          <p id={`${ids}-bio-hint`} className="field-hint">{bio.length}/{BIO_MAX} characters. Plain text.</p>
        </div>

        <fieldset className="grid min-w-0 gap-3">
          <legend className="field-label mb-1">Social links</legend>
          <p className="field-hint -mt-1">Paste the full address of each profile; the platform is detected from it. Up to {SOCIAL_LINKS_MAX}.</p>
          <ul className="grid gap-2">
            {rows.map((row, i) => {
              const url = normalizeLink(row.url);
              const platform = url ? platformFor(url).name : null;
              return (
                <li key={row.key} className="grid gap-2 rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-faint">{platform ?? (row.url ? "Not a valid link yet" : `Link ${i + 1}`)}</span>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" className="btn btn-quiet btn-sm !px-2" aria-label={`Move link ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>{Icons.up}</button>
                      <button type="button" className="btn btn-quiet btn-sm !px-2" aria-label={`Move link ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>{Icons.down}</button>
                      <button type="button" className="btn btn-quiet btn-sm !px-2" aria-label={`Remove link ${i + 1}`} onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}>{Icons.trash}</button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                    <div>
                      <label className="sr-only" htmlFor={`${ids}-u${row.key}`}>Link {i + 1} address</label>
                      <input id={`${ids}-u${row.key}`} name="socialUrl" className="input" inputMode="url" autoComplete="off" spellCheck={false} maxLength={2048} placeholder="https://…" value={row.url} onChange={(e) => setRow(row.key, { url: e.target.value })} aria-invalid={row.url && !url ? true : undefined} />
                    </div>
                    <div>
                      <label className="sr-only" htmlFor={`${ids}-l${row.key}`}>Link {i + 1} label (optional)</label>
                      <input id={`${ids}-l${row.key}`} name="socialLabel" className="input" maxLength={SOCIAL_LABEL_MAX} placeholder={platform ?? "Label (optional)"} value={row.label} onChange={(e) => setRow(row.key, { label: e.target.value })} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm justify-self-start" disabled={rows.length >= SOCIAL_LINKS_MAX} onClick={addRow}>
            {Icons.plus} Add link
          </button>
        </fieldset>

        <button className="btn btn-volt btn-sm justify-self-start" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
      </Form>

      <aside aria-label="Profile preview" className="md:sticky md:top-6 md:self-start">
        <p className="eyebrow mb-3">Preview</p>
        <div className="grid justify-items-center gap-3 rounded-2xl border border-line bg-ink-2 px-5 py-6 text-center">
          <Avatar mediaId={avatar} name={name || "?"} size={72} />
          <p className="max-w-full break-words font-semibold tracking-[-0.01em]">{name.trim() || "Your name"}</p>
          {bio.trim() ? <p className="max-w-full whitespace-pre-line break-words text-sm text-dim">{bio.trim()}</p> : null}
          {previewLinks.length ? (
            <ul className="flex flex-wrap justify-center gap-1.5">
              {previewLinks.map((u, i) => (
                <li key={`${u}-${i}`} className="max-w-full truncate rounded-full border border-line-strong px-2.5 py-1 text-[0.72rem] text-dim">
                  {rows.find((r) => normalizeLink(r.url) === u)?.label.trim() || platformFor(u).name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="field-hint mt-3">Only you see this. It appears on a page when you add it from the editor or start a new page with it.</p>
      </aside>
    </div>
  );
}

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-4 last-of-type:border-b-0">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <p id={`${id}-hint`} className="field-hint mt-1">{hint}</p>
      </div>
      <input id={id} type="checkbox" role="switch" name={name} defaultChecked={defaultChecked} className="switch mt-0.5" aria-describedby={`${id}-hint`} />
    </div>
  );
}

function Section({ id, title, intro, children, danger }: { id: string; title: string; intro?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`card scroll-mt-6 p-6 ${danger ? "!border-danger/25" : ""}`}>
      <h2 id={`${id}-title`} className={`text-lg font-semibold tracking-[-0.015em] ${danger ? "text-danger" : ""}`}>{title}</h2>
      {intro ? <p className="mt-1.5 text-sm text-dim">{intro}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
