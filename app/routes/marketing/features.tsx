import { Link } from "react-router";
import type { Route } from "./+types/features";
import { seo } from "~/lib/seo";
import { PageHeader } from "~/components/ui/PageHeader";
import { ACCENTS, BUTTON_STYLES, CARD_EFFECTS, ENTRANCES, FONTS, HOVERS, NAME_STYLES, OVERLAYS, PRESETS } from "~/lib/themes";
import { MAX_PAGES } from "~/lib/block-registry";
import { BACKDROP_IDS } from "~/lib/backdrops";
import { BLOCK_REGISTRY, BLOCK_TYPES } from "~/lib/block-registry";
import { COMPONENT_COUNT } from "~/lib/components";
import { TEMPLATE_BASE_COUNT, TEMPLATE_COUNT } from "~/lib/templates";

export const meta: Route.MetaFunction = ({ matches }) =>
  seo(matches, {
    title: "Features · Resonant",
    description: `A drag-and-drop page builder with ${COMPONENT_COUNT} components, ${TEMPLATE_COUNT} templates, image and animated backgrounds, glass and parallax effects, publishing, comments and privacy-first analytics.`,
    path: "/features",
  });

const SECTIONS = [
  {
    id: "editor",
    title: "A real builder, not a form",
    points: [
      `A library of ${COMPONENT_COUNT} ready-made components built from ${BLOCK_TYPES.length} block types — search it, then drag components onto your page.`,
      "Click any block on the live canvas to edit it in the side panel. Drag blocks to reorder them, or use the move buttons and keyboard instead.",
      "Every component in the library shows a live preview in your page's current theme.",
      "Custom code: write your own HTML, CSS and JavaScript in a code studio with a live, scrollable preview. Built-in data-reveal attributes and resonant.onViewport() make on-scroll animations easy. The code runs in an isolated sandbox.",
      "A quick-theme wheel to try palettes without touching your content.",
      "Undo and redo every change (Ctrl/⌘+Z, Shift+Ctrl/⌘+Z) during an editing session.",
      "The canvas opens at the width of the device you're editing on; switch between mobile and desktop at any time.",
      "Drafts save automatically a moment after you stop typing, and the save state is always shown.",
      "Every field is validated as you type and again on the server, with clear messages.",
      "Set your avatar, short bio and social links once in Settings, then drop them into any page's intro or social links with one click — or have new pages start with them.",
    ],
  },
  {
    id: "templates",
    title: "Templates built from the same parts",
    points: [
      `${TEMPLATE_COUNT} templates: ${TEMPLATE_BASE_COUNT} distinct designs, each offered in several colourways.`,
      "Notebooks and dot journals, glassy aurora gradients, bold posters, synthwave, editorial portfolios, résumés and more.",
      "Templates are block compositions plus theme tokens. Pick one and every block, colour and effect stays editable.",
      "Filter by category, style and tone, and preview each colourway at two widths before you start.",
    ],
  },
  {
    id: "customisation",
    title: "Customisation with guard rails",
    points: [
      `${Object.keys(PRESETS).length} palettes, ${Object.keys(ACCENTS).length} accent colours and ${Object.keys(FONTS).length} typefaces.`,
      `Backgrounds: upload your own image (with dim and blur), or choose from ${BACKDROP_IDS.length} built-in backgrounds — ruled notebook paper, aurora, holographic, mesh gradients, starfields and patterns.`,
      `Effects: glassmorphism cards, parallax backgrounds, animated backgrounds, ${ENTRANCES.length - 1} entrance animations, ${CARD_EFFECTS.length - 1} card hover effects (3D tilt, glare, holographic foil, magnetic and more), ${HOVERS.length - 1} button hover effects, ${NAME_STYLES.length - 1} name styles and ${OVERLAYS.length - 1} overlays.`,
      `${BUTTON_STYLES.length} button styles, three corner styles and three layouts, including a two-column portfolio layout on wide screens.`,
      "A glass panel layout that floats your whole page over your own background, an optional 3D tilt that follows the cursor, and a live clock block that shows visitors your local time.",
      "Blocks blur into view as visitors scroll. Every animation is decorative and switches off for visitors who prefer reduced motion.",
      "Choices are constrained tokens rather than free-form CSS, so pages stay readable and safe.",
    ],
  },
  {
    id: "publishing",
    title: "Publishing you control",
    points: [
      "Your page lives at a short address: /@yourhandle. Handles are checked for format and reserved words.",
      `Add up to ${MAX_PAGES} more pages. Give each its own address (/@yourhandle/work) with tabs to switch, or stack them as cards on one long scrolling page.`,
      "Optional music: upload a song or link an audio file. Visitors see a “click to enter” screen first (browsers only allow sound after a click) and can pause or mute at any time.",
      "Editing never changes the live page. Publish when you're ready; each publish is stored as a numbered revision.",
      "Unpublish at any time — the address then answers “gone” instead of showing old content.",
      "Choose whether search engines may index your page.",
    ],
  },
  {
    id: "comments",
    title: "Comments, off until you want them",
    points: [
      "Comments are disabled on every page by default. Turn them on per page in the editor.",
      "Only signed-in Resonant users can comment, and comments show the commenter's display name only — never an email address.",
      "Owners can hide or delete any comment on their page; commenters can delete their own; anyone signed in can report one.",
      "Posting is rate-limited and long or link-heavy comments are rejected to reduce spam.",
    ],
  },
  {
    id: "analytics",
    title: "Analytics without tracking",
    points: [
      "Daily counts of page views and link clicks, plus which sites referred visitors (domain only).",
      "No cookies are set for visitors, and no IP addresses or device fingerprints are stored.",
      "Views are counted from browsers that run JavaScript and obvious bots are filtered, so treat totals as a close measure, not an exact census.",
      "Your own visits while signed in are not counted.",
    ],
  },
];

export default function Features() {
  return (
    <>
      <PageHeader eyebrow="Features" title={<>Everything here <span className="serif-accent">works today.</span></>}>
        This page lists what Resonant actually does right now. Things that are still being built are not described as
        available.
      </PageHeader>
      <div className="wrap grid grid-cols-1 gap-12 py-16 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="On this page" className="lg:sticky lg:top-28 self-start">
          <ul className="flex flex-wrap gap-2 lg:grid lg:gap-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 text-sm text-dim hover:text-fg hover:bg-white/[0.04]">
                  {s.title.split(",")[0]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-16">
          {SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28 grid gap-6 md:grid-cols-[5rem_1fr]">
              <span className="font-mono text-sm text-faint">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.025em]">{s.title}</h2>
                <ul className="mt-5 grid gap-3">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-3 text-dim leading-relaxed">
                      <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-volt" />
                      {p}
                    </li>
                  ))}
                </ul>
                {s.id === "editor" ? (
                  <div className="mt-7 flex flex-wrap gap-2">
                    {BLOCK_TYPES.map((t) => (
                      <span key={t} className="rounded-full border border-line-strong px-3 py-1 text-xs text-dim">
                        {BLOCK_REGISTRY[t].label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ))}
          <section className="rounded-[1.4rem] border border-line bg-panel p-8">
            <h2 className="text-xl font-semibold tracking-[-0.02em]">Not available yet</h2>
            <p className="mt-3 text-dim leading-relaxed">
              Custom domains, team accounts, paid plans, passkeys and two-factor sign-in are not part of Resonant today.
              “Continue with Google” and password reset by email only appear on deployments where the operator has
              configured Google OAuth credentials and an email provider. Deployments can also switch
              email-and-password accounts off, in which case those forms are marked “In development” and Google is
              the only way to sign in.
            </p>
          </section>
          <div className="flex flex-wrap gap-3">
            <Link to="/signup" className="btn btn-volt">Create your page</Link>
            <Link to="/how-it-works" className="btn btn-ghost">Walk through the steps</Link>
          </div>
        </div>
      </div>
    </>
  );
}
