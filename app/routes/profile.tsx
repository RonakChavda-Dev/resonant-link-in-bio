// GET /@handle — the public, single-page profile.
// Only the published snapshot is loaded. Missing → 404, unpublished/deleted → 410.
import { useEffect } from "react";
import { data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/profile";
import { HANDLE_PATTERN, normalizeHandle, profilePath } from "~/lib/handles";
import { profileDescription, profileTitle } from "~/lib/block-registry";
import { rootOrigin } from "~/lib/seo";
import { ProfileView } from "~/components/profile/ProfileView";
import { LogoMark } from "~/components/ui/Logo";
import { CsrfInput } from "~/components/ui/forms";
import { sessionContext } from "~/server/context";
import { requireCsrf } from "~/server/session.server";
import { findPublicProfile } from "~/server/profiles.server";
import { COMMENT_MAX } from "~/lib/limits";
import {
  createComment,
  deleteComment,
  isUuid,
  listVisibleComments,
  reportComment,
  screenComment,
} from "~/server/comments.server";
import { checkRateLimits, tooManyRequests } from "~/server/rate-limit.server";
import { formString } from "~/server/request.server";

function parseHandle(segment: string | undefined): string | null {
  if (!segment || !segment.startsWith("@")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment.slice(1));
  } catch {
    return null;
  }
  const handle = normalizeHandle(decoded);
  return HANDLE_PATTERN.test(handle) ? handle : null;
}

export async function loader({ params, context, request }: Route.LoaderArgs) {
  const handle = parseHandle(params.handle);
  if (!handle) throw data("Not found", { status: 404 });
  const lookup = await findPublicProfile(context, handle);
  if (lookup.kind === "gone") throw data("Gone", { status: 410 });
  if (lookup.kind === "missing") throw data("Not found", { status: 404 });
  const { profile } = lookup;

  const session = context.get(sessionContext);
  const comments = profile.comments_enabled ? await listVisibleComments(context, profile.id) : [];
  const url = new URL(request.url);
  return {
    handle: profile.handle,
    canonicalPath: profilePath(profile.handle),
    doc: profile.published,
    indexable: profile.indexable,
    commentsEnabled: profile.comments_enabled,
    isOwner: session?.user.id === profile.owner_id,
    viewer: session ? { id: session.user.id, name: session.user.displayName } : null,
    loginHref: `/login?next=${encodeURIComponent(url.pathname + "#comments")}`,
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      author: c.author_name,
      mine: session?.user.id === c.author_id,
      createdAt: c.created_at.toISOString(),
    })),
  };
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  // Personalised (comment form, owner controls) — let browsers revalidate, keep shared caches out.
  const h = new Headers(loaderHeaders);
  h.set("Cache-Control", "private, no-cache");
  return h;
}

export const meta: Route.MetaFunction = ({ loaderData, matches }) => {
  if (!loaderData) return [{ title: "Page not found · Resonant" }, { name: "robots", content: "noindex" }];
  const title = profileTitle(loaderData.doc, loaderData.handle);
  const description = profileDescription(loaderData.doc);
  const url = rootOrigin(matches) + loaderData.canonicalPath;
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:type", content: "profile" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: loaderData.indexable ? "index, follow" : "noindex, nofollow" },
    { name: "theme-color", content: "#0b0c0b" },
  ];
};

export async function action({ params, context, request }: Route.ActionArgs) {
  const handle = parseHandle(params.handle);
  if (!handle) throw data("Not found", { status: 404 });
  const session = context.get(sessionContext);
  if (!session) return data({ ok: false as const, error: "Log in to comment." }, { status: 401 });
  const form = await request.formData();
  requireCsrf(context, form);

  const lookup = await findPublicProfile(context, handle);
  if (lookup.kind !== "published") throw data("Not found", { status: 404 });
  const profile = lookup.profile;
  const intent = formString(form, "intent", 20);

  if (intent === "comment") {
    if (!profile.comments_enabled) return data({ ok: false as const, error: "Comments are turned off for this page." }, { status: 403 });
    const limit = await checkRateLimits(context, [
      { key: `comment:user:${session.user.id}`, limit: 5, windowSeconds: 600 },
      { key: `comment:user-day:${session.user.id}`, limit: 40, windowSeconds: 86_400 },
      { key: `comment:profile:${profile.id}`, limit: 60, windowSeconds: 3600 },
    ]);
    if (!limit.ok) return tooManyRequests(limit.retryAfter, "You're commenting too quickly. Try again in a few minutes.");
    const [body, problem] = screenComment(formString(form, "body", COMMENT_MAX * 2));
    if (problem) return data({ ok: false as const, error: problem }, { status: 400 });
    const result = await createComment(context, profile.id, session.user.id, body);
    if (!result.ok) return data({ ok: false as const, error: result.error }, { status: 400 });
    return { ok: true as const, error: null };
  }

  const commentId = form.get("commentId");
  if (!isUuid(commentId)) throw data("Bad request", { status: 400 });
  if (intent === "delete") {
    if (!(await deleteComment(context, commentId, session.user.id))) throw data("Not allowed", { status: 403 });
    return { ok: true as const, error: null };
  }
  if (intent === "report") {
    const reason = formString(form, "reason", 10);
    if (reason !== "spam" && reason !== "abuse" && reason !== "other") throw data("Bad request", { status: 400 });
    const limit = await checkRateLimits(context, [{ key: `report:user:${session.user.id}`, limit: 20, windowSeconds: 3600 }]);
    if (!limit.ok) return tooManyRequests(limit.retryAfter);
    await reportComment(context, commentId, session.user.id, reason);
    return { ok: true as const, error: null, reported: commentId };
  }
  throw data("Bad request", { status: 400 });
}

function useAnalyticsBeacon(handle: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const send = (payload: Record<string, string>) => {
      const body = JSON.stringify({ h: handle, ...payload });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "text/plain" }));
      else fetch("/api/events", { method: "POST", body, keepalive: true }).catch(() => {});
    };
    send({ t: "view", r: document.referrer });
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-rp-block]");
      if (a?.dataset.rpBlock) send({ t: "click", b: a.dataset.rpBlock });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [handle, enabled]);
}

export default function Profile({ loaderData, actionData }: Route.ComponentProps) {
  const { doc, handle, isOwner } = loaderData;
  useAnalyticsBeacon(handle, !isOwner);
  return (
    <>
      {isOwner ? (
        <div className="flex justify-center bg-ink p-2">
          <div className="flex items-center gap-3 rounded-full border border-line-strong bg-ink/90 px-3 py-1.5 text-xs text-dim backdrop-blur">
            <span>You're viewing your live page. Your visits aren't counted.</span>
            <Link to="/dashboard" className="text-fg underline underline-offset-2">Dashboard</Link>
          </div>
        </div>
      ) : null}
      <ProfileView
        doc={doc}
        mode="public"
        footer={
          <>
            {loaderData.commentsEnabled ? <Comments data={loaderData} actionData={actionData} /> : null}
            <footer className="rp-footer">
              <Link to="/" aria-label="Made with Resonant">
                <LogoMark size={14} /> Made with Resonant
              </Link>
            </footer>
          </>
        }
      />
    </>
  );
}

function Comments({ data: d, actionData }: { data: Route.ComponentProps["loaderData"]; actionData: Route.ComponentProps["actionData"] }) {
  const navigation = useNavigation();
  const posting = navigation.state === "submitting" && navigation.formData?.get("intent") === "comment";
  const reported = actionData && "reported" in actionData ? actionData.reported : null;
  return (
    <section id="comments" aria-labelledby="comments-title" className="rp-comments mt-8 scroll-mt-8">
      <h2 id="comments-title" className="rp-heading !mt-0">Comments</h2>
      {d.viewer ? (
        <Form method="post" className="mt-3 grid gap-2" preventScrollReset>
          <CsrfInput />
          <input type="hidden" name="intent" value="comment" />
          <label htmlFor="comment-body" className="sr-only">Write a comment</label>
          <textarea
            id="comment-body"
            name="body"
            required
            maxLength={COMMENT_MAX}
            rows={3}
            placeholder={`Comment as ${d.viewer.name}`}
            className="rp-input"
            key={actionData?.ok ? "sent" : "draft"}
          />
          {actionData && "error" in actionData && actionData.error ? (
            <p role="alert" className="text-sm" style={{ color: "#ff8f7d" }}>{actionData.error}</p>
          ) : null}
          <button type="submit" className="rp-callout-btn justify-self-start" disabled={posting}>
            {posting ? "Posting…" : "Post comment"}
          </button>
        </Form>
      ) : (
        <p className="rp-text mt-2">
          <Link to={d.loginHref} className="underline underline-offset-4">Log in</Link> to leave a comment.
        </p>
      )}
      {d.comments.length ? (
        <ul className="mt-5 grid gap-3">
          {d.comments.map((c) => (
            <li key={c.id} className="rp-comment">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{c.author}</span>
                <time className="text-xs" style={{ color: "var(--rp-muted)" }} dateTime={c.createdAt}>
                  {new Date(c.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-line break-words text-[0.92rem] leading-relaxed">{c.body}</p>
              {d.viewer ? (
                <div className="mt-2 flex gap-3 text-xs" style={{ color: "var(--rp-muted)" }}>
                  {c.mine || d.isOwner ? (
                    <Form method="post" preventScrollReset>
                      <CsrfInput />
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="commentId" value={c.id} />
                      <button type="submit" className="underline underline-offset-2">Delete</button>
                    </Form>
                  ) : null}
                  {!c.mine ? (
                    reported === c.id ? (
                      <span>Reported to the page owner.</span>
                    ) : (
                      <Form method="post" preventScrollReset className="flex items-center gap-1.5">
                        <CsrfInput />
                        <input type="hidden" name="intent" value="report" />
                        <input type="hidden" name="commentId" value={c.id} />
                        <label className="sr-only" htmlFor={`reason-${c.id}`}>Report reason</label>
                        <select id={`reason-${c.id}`} name="reason" className="rounded bg-transparent" defaultValue="spam">
                          <option value="spam">Spam</option>
                          <option value="abuse">Abuse</option>
                          <option value="other">Other</option>
                        </select>
                        <button type="submit" className="underline underline-offset-2">Report</button>
                      </Form>
                    )
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rp-text mt-4" style={{ color: "var(--rp-muted)" }}>No comments yet.</p>
      )}
    </section>
  );
}
