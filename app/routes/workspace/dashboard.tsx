import { Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { privateMeta } from "~/lib/seo";
import { requireUser } from "~/server/session.server";
import { listProfiles, MAX_PROFILES_PER_USER } from "~/server/profiles.server";
import { db } from "~/server/db.server";
import { ProfileThumb } from "~/components/profile/Frames";
import { profilePath } from "~/lib/handles";
import { CopyButton } from "~/components/ui/CopyButton";
import { upgradeTrusted } from "~/lib/block-registry";

export const meta: Route.MetaFunction = () => privateMeta("Dashboard");

export async function loader({ context, request }: Route.LoaderArgs) {
  const { user } = requireUser(context, request);
  const profiles = await listProfiles(context, user.id);
  const ids = profiles.map((p) => p.id);
  const stats = ids.length
    ? await db(context)<{ profile_id: string; views: number; clicks: number }[]>`
        SELECT profile_id,
               COALESCE(SUM(count) FILTER (WHERE metric = 'view'), 0)::int AS views,
               COALESCE(SUM(count) FILTER (WHERE metric = 'click'), 0)::int AS clicks
        FROM analytics_daily
        WHERE profile_id = ANY(${ids}::uuid[]) AND day > current_date - 7
        GROUP BY profile_id`
    : [];
  const pending = ids.length
    ? await db(context)<{ profile_id: string; reports: number }[]>`
        SELECT c.profile_id, count(DISTINCT r.comment_id)::int AS reports
        FROM comment_reports r JOIN comments c ON c.id = r.comment_id
        WHERE c.profile_id = ANY(${ids}::uuid[]) AND c.status = 'visible'
        GROUP BY c.profile_id`
    : [];
  const origin = new URL(request.url).origin;
  return {
    origin,
    canCreate: profiles.length < MAX_PROFILES_PER_USER,
    profiles: profiles.map((p) => ({
      id: p.id,
      handle: p.handle,
      status: p.status,
      draft: upgradeTrusted(p.draft),
      unpublishedChanges: p.status === "published" && p.has_unpublished_changes,
      updatedAt: p.updated_at.toISOString(),
      commentsEnabled: p.comments_enabled,
      week: stats.find((s) => s.profile_id === p.id) ?? { views: 0, clicks: 0 },
      reports: pending.find((r) => r.profile_id === p.id)?.reports ?? 0,
    })),
  };
}

const STATUS = {
  draft: { label: "Draft", cls: "border-line-strong text-dim" },
  published: { label: "Live", cls: "border-volt/50 text-volt" },
  unpublished: { label: "Unpublished", cls: "border-warn/40 text-warn" },
} as const;

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { profiles, canCreate, origin } = loaderData;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Dashboard</p>
          <h1 className="display text-4xl sm:text-5xl">Your pages</h1>
        </div>
        {canCreate ? (
          <Link to="/dashboard/new" className="btn btn-volt">New page</Link>
        ) : (
          <p className="text-sm text-dim">You've reached the limit of 5 pages.</p>
        )}
      </div>

      {profiles.length === 0 ? (
        <div className="mt-12 rounded-[1.6rem] border border-dashed border-line-strong px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">No pages yet</h2>
          <p className="mx-auto mt-3 max-w-sm text-dim">
            Choose a handle and a starting design. Nothing is public until you publish.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/dashboard/new" className="btn btn-volt">Create your first page</Link>
            <Link to="/templates" className="btn btn-ghost">Browse templates</Link>
          </div>
        </div>
      ) : (
        <ul className="mt-10 grid gap-5">
          {profiles.map((p) => {
            const url = origin + profilePath(p.handle);
            const status = STATUS[p.status];
            return (
              <li key={p.id} className="card grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
                <Link to={`/editor/${p.id}`} className="justify-self-start rounded-[1.1rem]" aria-label={`Edit @${p.handle}`}>
                  <ProfileThumb doc={p.draft} width={150} height={220} />
                </Link>
                <div className="flex min-w-0 flex-col">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="min-w-0 truncate text-xl font-semibold tracking-[-0.02em]">@{p.handle}</h2>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${status.cls}`}>{status.label}</span>
                    {p.unpublishedChanges ? (
                      <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-dim">Draft has unpublished changes</span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-dim">
                    <span className="truncate font-mono text-[0.8rem]">{url}</span>
                    {p.status === "published" ? <CopyButton value={url} label="Copy link" /> : null}
                  </div>
                  <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                    <div><dt className="text-faint">Views · 7 days</dt><dd className="mt-0.5 font-mono text-lg">{p.week.views}</dd></div>
                    <div><dt className="text-faint">Clicks · 7 days</dt><dd className="mt-0.5 font-mono text-lg">{p.week.clicks}</dd></div>
                    <div><dt className="text-faint">Comments</dt><dd className="mt-1">{p.commentsEnabled ? "On" : "Off"}{p.reports ? <span className="ml-2 text-warn">· {p.reports} reported</span> : null}</dd></div>
                  </dl>
                  <div className="mt-auto flex flex-wrap gap-2 pt-6">
                    <Link to={`/editor/${p.id}`} className="btn btn-volt btn-sm">Edit</Link>
                    <Link to={`/analytics/${p.id}`} className="btn btn-ghost btn-sm">Analytics</Link>
                    {p.status === "published" ? (
                      <a href={profilePath(p.handle)} className="btn btn-quiet btn-sm" target="_blank" rel="noopener">View live ↗</a>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
