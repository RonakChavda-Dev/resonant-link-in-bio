import { Link } from "react-router";
import type { Route } from "./+types/analytics";
import { privateMeta } from "~/lib/seo";
import { requireUser } from "~/server/session.server";
import { getOwnedProfile } from "~/server/profiles.server";
import { db } from "~/server/db.server";
import { DailyBars, type DayPoint } from "~/components/ui/DailyBars";
import type { Block } from "~/lib/blocks";
import { upgradeTrusted } from "~/lib/block-registry";

export const meta: Route.MetaFunction = ({ loaderData }) =>
  privateMeta(loaderData ? `Analytics for @${loaderData.handle}` : "Analytics");

const DAYS = 30;

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { user } = requireUser(context, request);
  const profile = await getOwnedProfile(context, user.id, params.profileId); // ownership check
  const sql = db(context);
  const daily = await sql<{ day: string; views: number; clicks: number }[]>`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
           COALESCE(SUM(a.count) FILTER (WHERE a.metric = 'view'), 0)::int AS views,
           COALESCE(SUM(a.count) FILTER (WHERE a.metric = 'click'), 0)::int AS clicks
    FROM generate_series(current_date - ${DAYS - 1}::int, current_date, interval '1 day') AS d(day)
    LEFT JOIN analytics_daily a ON a.profile_id = ${profile.id} AND a.day = d.day::date
    GROUP BY d.day ORDER BY d.day`;
  const links = await sql<{ block_id: string; clicks: number }[]>`
    SELECT block_id, SUM(count)::int AS clicks FROM analytics_daily
    WHERE profile_id = ${profile.id} AND metric = 'click' AND day > current_date - ${DAYS}::int
    GROUP BY block_id ORDER BY clicks DESC LIMIT 20`;
  const referrers = await sql<{ host: string; views: number }[]>`
    SELECT referrer_host AS host, SUM(count)::int AS views FROM analytics_daily
    WHERE profile_id = ${profile.id} AND metric = 'view' AND day > current_date - ${DAYS}::int
    GROUP BY referrer_host ORDER BY views DESC LIMIT 10`;

  const blocks: Block[] = upgradeTrusted(profile.draft).blocks;
  const labelFor = (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (b?.type === "link") return b.label;
    if (b?.type === "callout") return b.linkLabel || b.title;
    if (b) return `${b.type[0].toUpperCase()}${b.type.slice(1)} block`;
    return "Removed block";
  };

  return {
    handle: profile.handle,
    profileId: profile.id,
    status: profile.status,
    views: daily.map((d) => ({ day: d.day, value: d.views })) satisfies DayPoint[],
    clicks: daily.map((d) => ({ day: d.day, value: d.clicks })) satisfies DayPoint[],
    links: links.map((l) => ({ label: labelFor(l.block_id), clicks: l.clicks })),
    referrers: referrers.map((r) => ({ host: r.host || "Direct or unknown", views: r.views })),
  };
}

export default function Analytics({ loaderData: d }: Route.ComponentProps) {
  const totalViews = d.views.reduce((s, p) => s + p.value, 0);
  const totalClicks = d.clicks.reduce((s, p) => s + p.value, 0);
  return (
    <>
      <Link to="/dashboard" className="text-sm text-dim hover:text-fg">← Dashboard</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Analytics</p>
          <h1 className="display text-4xl sm:text-5xl">@{d.handle}</h1>
        </div>
        <Link to={`/editor/${d.profileId}`} className="btn btn-ghost btn-sm">Open editor</Link>
      </div>

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-dim">
        Measured counts from visitors' browsers with JavaScript enabled, with obvious bots and your own signed-in
        visits excluded. Days are in UTC. No cookies, IP addresses or visitor identifiers are stored.
      </p>

      {d.status !== "published" ? (
        <div className="alert alert-info mt-6">This page isn't live, so it isn't collecting new views or clicks.</div>
      ) : null}

      {totalViews === 0 && totalClicks === 0 ? (
        <div className="mt-8 rounded-[1.4rem] border border-dashed border-line-strong px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">No visits recorded in the last 30 days</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-dim">
            Share your page address and views will appear here the day they happen.
          </p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-5">
        <DailyBars title="Page views" unit="views" points={d.views} />
        <DailyBars title="Link clicks" unit="clicks" points={d.clicks} />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <RankList title="Clicks by link" empty="No link clicks yet." rows={d.links.map((l) => ({ label: l.label, value: l.clicks }))} />
        <RankList title="Where views came from" empty="No views yet." rows={d.referrers.map((r) => ({ label: r.host, value: r.views }))} />
      </div>
    </>
  );
}

function RankList({ title, rows, empty }: { title: string; rows: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="card p-5">
      <h2 className="text-sm font-medium">{title} <span className="text-faint">· 30 days</span></h2>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-faint">{empty}</p>
      ) : (
        <ol className="mt-4 grid gap-3">
          {rows.map((r, i) => (
            <li key={r.label + i}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="font-mono text-dim">{r.value.toLocaleString()}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full bg-volt" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
