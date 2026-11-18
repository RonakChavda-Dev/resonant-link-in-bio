import { Link } from "react-router";
import type { Route } from "./+types/privacy";
import { seo } from "~/lib/seo";
import { PageHeader, Updated } from "~/components/ui/PageHeader";

export const meta: Route.MetaFunction = ({ matches }) =>
  seo(matches, {
    title: "Privacy · Resonant",
    description: "What Resonant collects, why, how long it is kept, and the controls you have over your data and public page.",
    path: "/privacy",
  });

export default function Privacy() {
  return (
    <>
      <PageHeader eyebrow="Privacy" title={<>Collect less. <span className="serif-accent">Explain all of it.</span></>}>
        This describes how the Resonant software handles data. It is not a legal policy; the operator of a deployment is
        responsible for any legal notices that apply to them.
      </PageHeader>
      <article className="wrap-narrow py-12 prose-plain">
        <h2>If you have an account</h2>
        <ul>
          <li><strong>Email address</strong> — used to sign in and, where email is configured, for password resets. It is never shown on public pages or next to comments.</li>
          <li><strong>Display name</strong> — shown beside comments you post.</li>
          <li><strong>Account profile</strong> (optional) — an avatar, a short bio and social links you add in Settings. It stays private unless you copy it into a page, start new pages with it, or turn on “Show my avatar next to my comments”, which shows your avatar publicly beside your comments.</li>
          <li><strong>Preferences</strong> — your defaults for new pages and the comment-avatar choice above.</li>
          <li><strong>Password</strong> — stored only as an Argon2id hash. Accounts created with Google have no password until you set one. Where email-and-password accounts are switched off, no password is collected at all.</li>
          <li><strong>Google sign-in</strong> (if you use it) — Google's stable account id for you and the email it reported, so we can recognise you next time. We request only your name, email and basic profile, and we don't keep Google access tokens.</li>
          <li><strong>Sessions</strong> — a hashed session token, creation and last-active times, and a coarse device label such as “Firefox on Windows” so you can recognise sessions in Settings. Raw browser strings and IP addresses are not stored.</li>
          <li><strong>Pages and uploads</strong> — your drafts, published versions, publish history and uploaded images.</li>
          <li><strong>Image addresses</strong> — uploaded images are served at long, random addresses. Anyone who has an image's address can load it, even if it is only used in a draft, so avoid uploading anything private.</li>
        </ul>

        <h2>If you visit someone's page</h2>
        <ul>
          <li>No cookies are set for visitors who aren't signed in.</li>
          <li>When the page loads, and when you select a link on it, your browser sends a small event. Resonant adds 1 to a daily counter for that page (and that link), along with the referring site's domain name if there was one.</li>
          <li>No IP address, browser string, device identifier or precise time is stored with these counts.</li>
          <li>Network addresses are used briefly to rate-limit abuse; only a keyed one-way digest is written to the database, and the daily clean-up deletes it once it is more than a day old.</li>
          <li>Embedded videos and music don't contact YouTube, Vimeo, Spotify or SoundCloud until you press play.</li>
          <li>If a creator plays music from a pasted link, your browser loads that file from the site it's hosted on once you click to enter with sound, and that site sees your request like any other. Uploaded songs come from Resonant itself.</li>
          <li>If a page owner adds a Custom code section, it can load images, fonts and scripts from other services (for example a public CDN), which then see your browser's request. Custom code can't read Resonant cookies or send data to its own servers.</li>
        </ul>

        <h2>Comments</h2>
        <ul>
          <li>Comments are off unless the page owner turns them on, and only signed-in users can post.</li>
          <li>A comment stores its text, your account, the page and the time. Publicly it shows only your display name, plus your avatar if you've turned that on in Settings.</li>
          <li>Page owners can hide or delete comments on their page. You can delete your own comments at any time.</li>
          <li>Reports store which comment, who reported it and a reason category, and are visible to the page owner.</li>
        </ul>

        <h2>How long data is kept</h2>
        <ul>
          <li>Account, page and comment data: until you delete it or your account.</li>
          <li>Expired sessions and password-reset tokens: removed by a daily clean-up job.</li>
          <li>Rate-limit counters: removed by the daily clean-up once they are a day old.</li>
          <li>Analytics: daily counters stay with the page and are deleted when the page is deleted.</li>
          <li>Database backups depend on how the operator runs PostgreSQL; Resonant itself does not make or promise backups.</li>
        </ul>

        <h2>Your controls</h2>
        <ul>
          <li>Unpublish a page at any time, or stop search engines indexing it, from the editor.</li>
          <li>Turn comments off, hide or delete them.</li>
          <li>Delete a page, which removes its drafts, history, comments and analytics. Its handle answers “gone” for 30 days and then becomes available again.</li>
          <li>Delete your account from <strong>Settings</strong>. This removes your pages, uploads, comments and sessions.</li>
        </ul>

        <h2>Service providers</h2>
        <p>
          Resonant is designed to run on Cloudflare Workers with PostgreSQL (via Cloudflare Hyperdrive) and Cloudflare R2
          for images. If the operator enables them, Cloudflare Turnstile checks sign-in forms, Google provides “Continue with Google”, and an
          email provider sends password-reset messages. Those providers process data under their own terms.
        </p>
        <p>
          Security details are on the <Link to="/security">security page</Link>.
        </p>
        <Updated date="12 November 2026" />
      </article>
    </>
  );
}
