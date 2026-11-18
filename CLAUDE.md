# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Resonant — project guide

## Working in this repo

Stack: React Router v8 framework mode on Cloudflare Workers (`@cloudflare/vite-plugin`), TypeScript, Tailwind v4, PostgreSQL via Hyperdrive using `postgres` (postgres.js) tagged templates — no ORM — Zod v4, R2 for uploads, `@dnd-kit` for the editor. `inspirations/` holds mood-reference screenshots only; never ship or copy them.

### Commands

```sh
npm run db:local       # embedded PostgreSQL on 127.0.0.1:54329 (data in .data/postgres); keep it running
npm run db:migrate     # apply migrations/*.sql in order (DATABASE_URL overrides the local default)
npm run dev            # dev server (http://localhost:5173), needs db:local + .dev.vars
npm run typecheck      # wrangler types + react-router typegen + tsc -b
npm test               # vitest unit tests (tests/**/*.test.ts)
npx vitest run tests/security.test.ts -t "origin check"   # single file / single test
npm run build && npx vite preview --port 4173            # production build in workerd (strict CSP)
node scripts/smoke.mjs [baseUrl]                         # ~60 end-to-end HTTP checks against a running server
node scripts/shoot.mjs <base> <outDir> [cookie] -- name:/path:width[:height] ...  # screenshots + overflow check (EVAL=<js> prints a value per page)
node scripts/editor-check.mjs <base> <cookie> </editor/:id> [width]                  # drives the editor: select, inspector overflow, library insert, drag-drop, autosave
npm run deploy:preview | deploy:production               # scripts/deploy.mjs: builds with CLOUDFLARE_ENV=<env>, then wrangler deploy
```

The Cloudflare Vite plugin bakes the target environment into `build/server/wrangler.json` at build time, so `wrangler deploy --env x` after a plain `npm run build` silently deploys the development config — always deploy through the npm scripts. Production uses Neon (Singapore) via Hyperdrive `resonant-prod` (caching disabled; stale reads would break sessions); `.env.local`/`.neon` from `neon init` are gitignored and only used to run migrations against Neon.

First-time setup: `npm install`, copy `.dev.vars.example` → `.dev.vars` with a 32+ byte `APP_SECRET`, `npm run db:local` (separate terminal), `npm run db:migrate`, `npm run dev`. Re-run `npm run cf-typegen` after editing `wrangler.jsonc`. Repeated smoke runs hit real rate limits (e.g. 6 sign-ups/hour per IP); clear the local `rate_limits` table between runs. In Git Bash, prefix commands that take `/route` arguments with `MSYS_NO_PATHCONV=1`.

### Architecture map

- `workers/app.ts` — Worker entry: Origin/`Sec-Fetch-Site` check on every non-GET (CSRF layer 1), per-request CSP nonce, security headers, default `Cache-Control: private, no-store`, per-request DB holder closed via `waitUntil`, daily `scheduled` cleanup.
- `app/server/context.ts` — typed `RouterContextProvider` contexts (bindings, nonce/db, session). `app/root.tsx` middleware loads the session once per request; the root loader exposes `user`, `csrf`, `origin`.
- `app/server/*.server.ts` — the only place that touches the database, R2, secrets or crypto. Sessions (hashed tokens, idle + absolute expiry, rotation), `requireUser`/`requireCsrf` (CSRF layer 2: per-session synchronizer token), Argon2id via `@noble/hashes` (pure JS; ~200 ms CPU, needs the Workers Paid plan), Postgres-backed fixed-window rate limiting with HMAC'd IP/email keys, profile data access (every write filters by `owner_id`), comments, Turnstile/email integrations (off unless configured). Route components must never import `.server` modules; shared client-safe constants live in `app/lib/limits.ts`.
- `app/lib/blocks.ts` — Zod schemas for the 25 block types and the document (strict objects, discriminated union, `version: 2`), shared by editor and server. `app/lib/block-registry.ts` is zod-free: block metadata/categories/defaults, `upgradeDocument` (v1 → v2; run on every read of stored drafts/published docs and before validation), title helpers. Public/marketing code must import from `block-registry`, not `blocks`, so Zod stays in the editor chunk.
- `themes.ts` (palettes, accents, fonts, button styles, effects) and `backdrops.ts` (built-in CSS backgrounds written in source, using theme CSS variables) are the only styling inputs; there is no user CSS. `components.ts` is the editor's preset library (block + variant + starter content). `templates.ts` defines base designs × colourways; all displayed counts are computed from these arrays — never hard-code them. `urls.ts` holds link/video/audio URL safety and platform detection, `handles.ts` handle rules.
- `app/components/profile/ProfileView.tsx` — the single renderer for public pages, editor preview, template previews and thumbnails; styled by the `.rp` CSS-variable system in `app/profile.css` (effects are data attributes on `.rp`; container queries keep preview widths accurate; everything animated is disabled under reduced motion). Editor canvas styles are at the end of `app/app.css`.
- Multi-page sites + music live in the document (`pages`, `nav`, `music`; defaults filled by `upgradeDocument`). `doc.blocks` is always the home page; `allBlocks()` covers every page, and block/page ids are unique site-wide. `nav.mode` "tabs" serves pages at `/@handle/:slug` (route id `routes/profile-page`, same module as `/:handle`); "stack" renders them as `.rp-sheet` cards on `/@handle` and 301s sub-addresses to `#slug`. The editor edits one page at a time through a "view" doc (`changeView` writes blocks back) with `PageStrip`/`PagesSection`/`MusicSection` in `components/editor/SitePanel.tsx`. Music plays only after the click-to-enter gate (`MusicPlayer`, rendered outside `.rp` because its container query captures `position: fixed`); audio uploads (migration 0003, `sniffAudioType`, 10 MB) are served with byte ranges, and CSP `media-src` allows `https:` for pasted links. Card hover effects are `theme.effects.card` (`CARD_SELECTOR` in ProfileView ↔ the "Card effects" list in profile.css); parallax is JS-driven via `--rp-par` on `.rp-par`.
- `app/components/editor/` — history reducer, `Library` (draggable presets, `lib:` ids), `Canvas` (renders `ProfileView` with a `renderBlock` wrapper; sortable `c:` ids), `Layers` (sortable `l:` ids), `BlockForms`, `DesignPanel`, media picker. One `DndContext` in `routes/workspace/editor.tsx` resolves drops by id prefix. Layout: 3 panes ≥1280px (inspector on the right); below that the inspector replaces Layers in the left panel ("Edit" tab); <1024px Edit/Preview tabs. The editor route also handles autosave (optimistic concurrency on `draft_version`), publish (writes the upgraded, validated doc), settings and moderation.
- Account profile + preferences (migration 0004): `users.avatar_media_id/bio/social_links` and `pref_*` columns, read/written only via `app/server/account.server.ts`; client-safe validation and `prefillDocument`/`introFromAccount`/`socialsFromAccount` in `app/lib/account.ts`. `routes/workspace/settings.tsx` has sections Profile · Preferences · Sign-in & security · Sessions · Delete account. New pages apply the profile and comment default in `new-profile.tsx`; the editor exposes it through `AccountProfileContext` ("Use my account profile" in the Intro/Social links forms). The account profile is private: comment listings expose the avatar only when `pref_comment_avatar` is on. The session carries `avatarId` for the workspace header.
- Google sign-in: `app/server/oauth.server.ts` + `routes/auth/google*.ts` (OIDC code flow + PKCE, HMAC-signed flow cookie). Never auto-link a Google identity to an existing email account; linking happens from Settings while signed in. `users.password_hash` is nullable for Google-only accounts.
- Custom code: `routes/api/sandbox.ts` (shell + strict CSP), `components/profile/CodeFrame.tsx` (iframe host: posts code after `rs:ready`, relays viewport for `data-reveal`/`resonant.onViewport`, accepts only `rs:height` from its own frame), `components/editor/CodeStudio.tsx` (CodeMirror loaded on demand). The Worker keeps route-supplied CSP/X-Frame-Options headers.
- Product-site motion: `components/ui/useReveal.ts` (root) blurs in any `[data-reveal]` element; `WheelPicker` is used on the home page and in the Design panel only.
- Routes are declared in `app/routes.ts`. Public profiles are `/:handle` (must start with `@`); `/@/:handle` 301s to it. Drafts are never read by public routes; only `profiles.published` is.
- `migrations/` — plain SQL, applied by `scripts/migrate.mjs` inside a transaction; never edit an applied migration.

### Current scope

There is no pricing route (no real plans), and no email verification for password accounts, 2FA, passkeys or custom domains; the marketing pages say so. Google sign-in needs `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (hidden otherwise). `PASSWORD_AUTH` (wrangler var: `"on"` locally, `"off"` in preview/production so the app fits the Workers Free plan's CPU limit) gates every email-and-password route and Settings action server-side via `passwordAuthEnabled()`; when off, the UI shows those features as "In development" (`PasswordsInDevelopment`). Override locally by adding `PASSWORD_AUTH=off` to `.dev.vars`. Password reset works only when `RESEND_API_KEY` + `MAIL_FROM` are set (in development, reset links are printed to the dev-server terminal). Keep `/features`, `/security` and `/privacy` accurate when behaviour changes.

Resonant is a polished link-in-bio and one-page portfolio platform. This file is the product brief and working agreement for Claude Code. Treat the checked-in project as the source of truth: inspect it before changing anything, preserve useful existing work, and keep this guide aligned with implementation.

## Product direction

Build a multi-page product website and authenticated creator workspace for making, publishing, and understanding personal bio pages. A creator's public page is a fast, responsive, single-page portfolio with a shareable route such as `https://example.com/@handle`. The marketing site, account flows, editor, public profiles, and documentation are distinct routes; do not collapse the whole product into one landing page.

The product takes category cues from Linktree, Beacons, Carrd, bio.link, guns.lol, and toxin.cc. Use them as references for familiar interactions only. Do not copy their branding, wording, layouts, or assets. The product name is **Resonant**. Do not add social-network links to the marketing site or demo profiles until the owner supplies them. Never invent testimonials, customer counts, integrations, prices, security certifications, analytics, or product capabilities. Mark unimplemented features as planned in internal notes rather than presenting them as live.

### Product principles

- **Distinctive but calm:** near-black foundations, a monochrome palette (white is the single highlight, greys carry hierarchy — the owner replaced the earlier lime accent), crisp grotesk type with grey "continuation" lines in headlines, strong spacing, motion-blur reveals, and readable contrast.
- **Creator first:** publishing a good-looking page should feel simple before the editor exposes advanced control.
- **Fast by default:** public pages load quickly on mobile, work without JavaScript where practical, and respect reduced-motion preferences.
- **Honest and private:** explain analytics and comment settings plainly; collect only what is needed and provide user control over public content.
- **Useful originality:** make the page feel alive with a signature “resonance” detail, such as a subtle audio-reactive-inspired pulse or connected visual motif. It must be decorative, accessible, lightweight, and never pretend to play audio or use a microphone.

## Experience and routes

Create real, linked pages with substantive content and clear calls to action. Include at minimum:

- `/` — landing page explaining the value, showing an accurate product preview, and directing visitors to build or explore.
- `/features` — editor, templates, customisation, publishing, comments, and analytics. Describe only implemented capabilities as available.
- `/templates` — browsable starter designs with filters and preview. Start with a curated set of genuinely distinct templates. Grow the catalog toward the requested ~100 templates through reusable design tokens and layouts; do not generate 100 near-duplicates or claim a count that does not exist.
- `/how-it-works` — clear step-by-step instructions: create an account, choose a starting design, add/reorder content, preview, publish, and share the profile URL. Match the actual UI and terminology.
- `/security` and `/privacy` — accurate descriptions of implemented safeguards, data handling, and user controls. Do not promise “attack-proof” security or legal compliance without substantiation.
- `/pricing` — only if real plan details are provided/implemented. Otherwise omit it or label the route/content as a genuine waitlist/coming-soon experience without made-up prices.
- `/login`, `/signup`, `/forgot-password`, `/dashboard`, `/editor/:profileId`, `/analytics/:profileId`, `/settings` — account and creator workspace routes, protected server-side where appropriate.
- `/@/:handle` — public, single-page profile route with metadata, theme, blocks, and optional comments. Validate and reserve handles; return proper 404/410 responses for missing or unpublished profiles.

Use a design preview that is clearly sample content. Do not populate it with fabricated claims or external social handles. Avoid empty placeholder routes and dead links. Navigation labels must point to working destinations.

## Page builder and templates

Make the editor a usable drag-and-drop builder, not a static mockup. Use keyboard-operable move controls and visible focus states as alternatives to dragging. Provide undo/redo where feasible, preview at mobile and desktop widths, save/publish state, and clear validation errors.

Model a profile as validated, versioned structured data. Define a typed block registry with a small initial component set (for example: intro, text, link/button, image, divider, video embed, gallery, FAQ, and callout), each with an explicit schema, editor, renderer, and safe defaults. Render only known block types; reject unknown fields/types on the server. Store design settings as constrained tokens/presets rather than arbitrary CSS or executable markup. Sanitize and validate URLs, allow only safe protocols, and never render user-supplied HTML or scripts in Resonant's own documents. The one owner-requested exception is the Custom code block: its HTML/CSS/JS run only in `/sandbox` (CSP `sandbox` without `allow-same-origin`, `connect-src 'none'`, `form-action 'none'`, iframe `sandbox="allow-scripts allow-popups…"`), delivered by postMessage — keep that isolation intact. A separate user-content domain would be stronger still if one becomes available.

Build templates from reusable block compositions and theme tokens, with individual previews and accessible names. Keep template data separate from renderer code so the catalog can grow without duplicating page logic. Prioritize quality and variety over a nominal template count.

## Suggested stack and deployment

Inspect the repository and its dependency constraints first. Unless the existing code gives a concrete reason to keep another stack, prefer:

- TypeScript, React, and **React Router framework mode on Cloudflare Workers**, using the Cloudflare Vite plugin for server rendering and route handling.
- Cloudflare Workers for the full-stack runtime and deploy previews. Prefer Workers for this dynamic product; do not assume Cloudflare Pages is the right target for a full-stack app.
- PostgreSQL as the primary relational database, connected from Workers through Cloudflare Hyperdrive. Use a migration-managed schema and parameterized queries through a Workers-compatible driver/ORM. The user explicitly wants PostgreSQL or MySQL; do not silently substitute D1/SQLite. D1 is an optional alternative only if the owner later changes that requirement and accepts its SQLite semantics and platform limits.
- Cloudflare R2 for user-uploaded media, with strict size/type limits and server-side authorization. Keep secrets, private data, and source assets out of public buckets.
- Wrangler configuration checked into the repository with safe local defaults, documented bindings, and separate development/preview/production configuration. Keep credentials in Cloudflare secrets or local ignored environment files, never in source control.

Cloudflare's current guide supports React Router as a full-stack Workers framework. Its Next.js route is currently described around `vinext`, which is marked beta; do not select it without checking compatibility and project needs. Hyperdrive supports PostgreSQL and MySQL. Re-check official documentation when configuring versions, bindings, and deployment because platform guidance changes.

Useful primary references:

- [Cloudflare React Router on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- [Cloudflare database connection options](https://developers.cloudflare.com/workers/databases/connecting-to-databases/)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)

## Authentication, security, and privacy

No web application can honestly be described as “attack-proof.” Design against a documented threat model, use defense in depth, and review the relevant OWASP ASVS requirements. Do not invent a guarantee. Implement and document security controls as the application is built:

- Use a maintained authentication solution compatible with the chosen Workers runtime, or implement auth only with reviewed, well-tested primitives. Prefer passkeys or a reputable OAuth provider if later configured; never imply a provider is connected before it is.
- Hash passwords with a modern password-hashing algorithm supported safely by the runtime (prefer Argon2id where supported; otherwise use an approved alternative with documented parameters). Never store plaintext or reversible passwords. Make login and password-reset responses resistant to account enumeration.
- Use server-managed sessions in `HttpOnly`, `Secure`, appropriately `SameSite` cookies; rotate session IDs after authentication or privilege changes; provide logout, expiry, and revocation. Do not store bearer credentials in browser local storage.
- Enforce authorization on every server action and data access, including object ownership checks. A hidden button is not an authorization control. Use least-privilege database credentials and parameterized SQL.
- Protect state-changing requests against CSRF. Validate input at trust boundaries; encode output; apply a restrictive Content Security Policy and appropriate security headers; prevent open redirects and unsafe URL schemes.
- Apply per-route rate limits to authentication, password recovery, publishing, comments, and other abuse-sensitive actions. Use Turnstile as an additional bot/friction signal where warranted, and validate tokens server-side. It is not a replacement for authorization or rate limits.
- Add secure account recovery, email verification only when a real mail provider is configured, and clear generic outcomes when delivery/configuration is unavailable. Never display fake “email sent” success when no message was sent.
- Escape and sanitize comment text; mitigate spam and abuse; offer moderation, deletion/reporting controls as applicable, and let profile owners disable comments. Only signed-in users may comment, as requested. Apply retention and privacy minimization.
- Keep secrets out of client bundles and logs. Avoid logging passwords, session tokens, private comment content, or unnecessary personal data. Set explicit upload limits and validate file signatures, not only extensions.
- Protect against XSS, CSRF, SQL injection, SSRF, IDOR, brute force, credential stuffing, unsafe uploads, and abuse of public endpoints. Add security headers and dependency review as part of release work.

Do not claim compliance, a security certification, encryption behavior, backups, moderation, or a provider integration unless it is actually configured and verified. Use the security page to state current behavior in plain language.

## Public profiles, comments, and analytics

- Public pages contain only fields the owner intentionally publishes. Drafts and private settings must never leak through server rendering, APIs, metadata, or caches.
- Ensure profile handles are normalized, unique, reserved for system routes, and safely encoded. Consider custom-domain support as a later capability; do not claim it is available until implemented.
- Cache published public pages carefully and invalidate/update cache on publish, unpublish, or visibility changes. Never cache authenticated dashboard responses publicly.
- Comments are optional per profile and require an authenticated commenter. Include moderation and anti-abuse paths before enabling the feature broadly; do not expose commenter email addresses publicly.
- Analytics should use a documented, privacy-conscious event model, avoid collecting sensitive fields, and distinguish measured data from estimates. Do not display fabricated charts or metrics in demos.

## SEO, accessibility, and motion

- Give public profiles and marketing routes server-rendered or prerendered, route-specific titles, descriptions, canonical URLs, Open Graph metadata, and meaningful heading structure. Add sitemap and robots rules based on actual published routes. Avoid indexing dashboards, drafts, and private pages.
- Use semantic HTML, keyboard access, visible focus, adequate contrast, reduced-motion support, descriptive image alternatives, and accessible form errors. Drag-and-drop must have keyboard alternatives.
- Use smooth scrolling and scroll-triggered reveals sparingly. Keep motion short and purposeful, avoid scroll hijacking, and disable/reduce nonessential motion under `prefers-reduced-motion`.
- Optimize responsive layouts from narrow screens upward. Check real content lengths, long handles, zoom, and touch target sizing. Avoid layout shifts and oversized client bundles.

## Implementation habits

- Before coding, inspect the existing files, package scripts, routes, and any local agent instructions. Reuse the established patterns and do not overwrite work you have not inspected.
- Keep components focused, types explicit, schemas shared between validation and rendering where practical, and database access behind a small server-only data layer.
- Use migrations for schema changes. Never make production schema changes implicitly during normal page requests.
- Add seed/sample data only when clearly marked as demo content and never present it as real users or usage.
- Do not add social links, fake logos, fabricated testimonials, dead CTAs, placeholder integrations, invented feature claims, or unsupported “best/most secure” claims.
- Follow the repo's existing formatting and scripts. When implementation is requested, run only relevant checks and report what actually ran; do not claim checks passed without evidence.

## Visual acceptance

The result should feel like a contemporary creator tool: dark, tactile, confident, and easy to scan. Use a limited monochrome color system (white highlight, grey hierarchy), typographic hierarchy, balanced negative space, subtle borders, and purposeful transitions. Make the editor dense enough for real work without sacrificing clarity. Avoid generic dashboard grids, excessive neon glow, decorative motion that competes with content, and repeated marketing phrases. Make each route useful on its own and ensure the public bio page still feels personal rather than like an admin panel.
