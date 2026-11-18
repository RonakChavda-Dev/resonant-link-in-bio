import { Link } from "react-router";
import type { Route } from "./+types/security";
import { seo } from "~/lib/seo";
import { PageHeader, Updated } from "~/components/ui/PageHeader";

export const meta: Route.MetaFunction = ({ matches }) =>
  seo(matches, {
    title: "Security · Resonant",
    description: "The safeguards Resonant implements today: password hashing, sessions, CSRF and rate limits, content validation, upload checks and security headers.",
    path: "/security",
  });

export default function Security() {
  return (
    <>
      <PageHeader eyebrow="Security" title={<>What we do, <span className="serif-accent">in plain language.</span></>}>
        No website can promise it will never be attacked. Here is what Resonant does to make attacks harder and their
        impact smaller, as the software stands today.
      </PageHeader>
      <article className="wrap-narrow py-12 prose-plain">
        <h2>Accounts and passwords</h2>
        <ul>
          <li>Passwords are hashed with <strong>Argon2id</strong> (19 MiB memory, 2 passes, unique random salt per password). The original password is never stored.</li>
          <li>Passwords must be 10–128 characters; very common passwords are refused.</li>
          <li>Sign-in errors don't reveal whether an email address has an account, and failed attempts take similar time either way.</li>
          <li>Where the operator has configured it, you can sign in with Google using the OpenID Connect code flow with PKCE. Resonant checks the token's issuer, audience, expiry, one-time nonce and that Google has verified the email. A Google sign-in is never silently attached to an existing email-and-password account — you connect Google from Settings after logging in.</li>
          <li>An operator can switch email-and-password accounts off. Sign-up, login, reset and password changes are then refused on the server, not just hidden, and those forms are marked “In development”.</li>
          <li>Sign-in, sign-up and password reset are rate-limited per network address and per account to slow down guessing and credential stuffing. Where the operator has configured Cloudflare Turnstile, these forms also include a bot check.</li>
        </ul>

        <h2>Sessions</h2>
        <ul>
          <li>Signing in creates a new random session. Your browser keeps it in an <code>HttpOnly</code>, <code>SameSite=Lax</code> cookie, marked <code>Secure</code> on HTTPS, so page scripts can't read it.</li>
          <li>Only a SHA-256 digest of the session token is kept in the database.</li>
          <li>Sessions end after 7 days of inactivity or 30 days in total. You can see and revoke your sessions in <strong>Settings</strong>, and changing your password signs out every other session.</li>
        </ul>

        <h2>Requests and permissions</h2>
        <ul>
          <li>Every request that changes data must come from this site's own origin, and signed-in actions also carry a per-session anti-forgery token.</li>
          <li>Every editor, analytics and settings action checks on the server that the page or comment belongs to you. Hiding a button is never the only protection.</li>
          <li>Database queries use bound parameters, never string-built SQL.</li>
          <li>Redirects after sign-in only go to paths on this site.</li>
        </ul>

        <h2>Page content</h2>
        <ul>
          <li>Pages are structured data checked against a strict schema on the server. Unknown block types and unexpected fields are rejected.</li>
          <li>Backgrounds, effects and animations are chosen from built-in options; the page itself never contains creators' own CSS or HTML. All text in blocks is shown as text.</li>
          <li>The optional <strong>Custom code</strong> block runs a creator's HTML, CSS and JavaScript only inside an isolated sandbox frame. That frame has an opaque origin, so its code can't read cookies or storage, can't touch the surrounding page, and can't make network requests or submit forms; it may load scripts and styles from jsDelivr, cdnjs or unpkg and images over https. Each block is limited to 20,000 characters per language.</li>
          <li>Links must use <code>https:</code>, <code>http:</code>, <code>mailto:</code> or <code>tel:</code>; other schemes such as <code>javascript:</code> are refused.</li>
          <li>Videos only come from YouTube (privacy-enhanced domain) or Vimeo, and audio only from Spotify or SoundCloud. Embeds load only after a visitor presses play.</li>
          <li>Drafts are never served to visitors. Public pages show only the last version you published.</li>
        </ul>

        <h2>Uploads</h2>
        <ul>
          <li>Images up to 5 MB in PNG, JPEG, WebP or GIF format, and songs up to 10 MB in MP3, M4A, OGG or WAV format. The file's actual signature bytes are checked, not just its name.</li>
          <li>SVG and other active formats are refused. Files are stored in private object storage and served with <code>nosniff</code> and a locked-down content policy.</li>
        </ul>

        <h2>Profile music</h2>
        <ul>
          <li>Music never starts on its own: visitors choose to enter (with or without sound) and can pause or mute at any time.</li>
          <li>A pasted song link must be an <code>https://</code> address and is played by an audio element, which cannot run code.</li>
        </ul>

        <h2>Browser protections</h2>
        <ul>
          <li>A Content Security Policy with per-response nonces restricts which scripts can run, blocks plugins, and prevents other sites from framing Resonant.</li>
          <li>HTTPS-only transport (HSTS), <code>nosniff</code>, a strict referrer policy and a permissions policy that disables camera, microphone and location are sent on every response.</li>
          <li>Responses that may contain personal data are marked <code>no-store</code> so shared caches don't keep them.</li>
        </ul>

        <h2>What isn't in place yet</h2>
        <ul>
          <li>Two-factor authentication and passkeys.</li>
          <li>Email verification for email-and-password accounts. Those can be created without proving ownership of the address (Google sign-in requires an address Google has verified).</li>
          <li>An independent security audit or certification. Resonant does not claim any.</li>
        </ul>

        <h2>Reporting a problem</h2>
        <p>
          If you believe you've found a vulnerability, contact the operator of this deployment privately before
          disclosing it. Please don't test against other people's accounts or pages.
        </p>
        <p>
          For how data is collected and kept, see the <Link to="/privacy">privacy notes</Link>.
        </p>
        <Updated date="12 November 2026" />
      </article>
    </>
  );
}
