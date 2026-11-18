import { useMemo, useState, type CSSProperties } from "react";
import { ScrollStrip } from "~/components/ui/ScrollStrip";
import { Form, Link } from "react-router";
import type { Route } from "./+types/home";
import { rootOrigin, seo, SITE_NAME } from "~/lib/seo";
import { getTemplate, TEMPLATE_BASE_COUNT, TEMPLATE_COUNT } from "~/lib/templates";
import { BLOCK_CATEGORIES, BLOCK_REGISTRY, BLOCK_TYPES } from "~/lib/block-registry";
import { COMPONENT_COUNT } from "~/lib/components";
import { PRESETS, PRESET_IDS, type PresetId } from "~/lib/themes";
import { PhoneFrame, ProfileThumb } from "~/components/profile/Frames";
import { ProfileView } from "~/components/profile/ProfileView";
import { WheelPicker } from "~/components/ui/WheelPicker";
import { NightClouds } from "~/components/ui/NightClouds";
import { useRootData } from "~/root";

export const meta: Route.MetaFunction = ({ matches }) => {
  const origin = rootOrigin(matches);
  const description = `Build a personal profile or one-page portfolio with ${COMPONENT_COUNT} drag-and-drop components and ${TEMPLATE_COUNT} templates. Publish to your own @handle.`;
  return [
    ...seo(matches, { title: "Resonant — your personal page, portfolio and profile in one", description, path: "/" }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", "@id": `${origin}/#website`, url: `${origin}/`, name: SITE_NAME, description, publisher: { "@id": `${origin}/#org` } },
          { "@type": "Organization", "@id": `${origin}/#org`, name: SITE_NAME, url: `${origin}/`, logo: `${origin}/icon-512.png` },
        ],
      },
    },
  ];
};

const fan = ["sunset-mesh-peach", "notebook-paper", "glass-aurora-ocean"].map((id) => getTemplate(id)!);
const strip = ["night-set-violet", "notebook-paper", "sunset-mesh-peach", "lowlight-dusk", "poster-lime", "glass-aurora-ocean", "confetti-bubblegum", "ember-amber", "case-study-iris", "synthwave-magenta", "electric-cobalt", "storefront-lemon"].map((id) => getTemplate(id)!);
// The closing grid cell spans whatever is left on the last row, so the grid never shows gaps.
const FILL_SM = ["col-span-2", "col-span-1"];
const FILL_XL = ["xl:col-span-3", "xl:col-span-2", "xl:col-span-1"];
const lookBase = getTemplate("halo-ash")!;
const LOOKS: PresetId[] = ["ash", "paper", "midnight", "peach", "pine", "lilac", "cobalt", "clay", "plum", "sky", "ember", "bubblegum"].filter((p) => PRESET_IDS.includes(p as PresetId)) as PresetId[];

const PAGES = [
  { to: "/templates", title: "Templates", body: `${TEMPLATE_COUNT} starting points to make your own` },
  { to: "/features", title: "Features", body: "Everything the builder can do today" },
  { to: "/how-it-works", title: "How it works", body: "From sign-up to shared link in six steps" },
  { to: "/security", title: "Security", body: "How accounts and pages are protected" },
];

export default function Home() {
  const root = useRootData();
  const host = root?.origin ? new URL(root.origin).host : "resonant";
  const [look, setLook] = useState<PresetId>("midnight");
  const lookDoc = useMemo(() => ({ ...lookBase.document, theme: { ...lookBase.document.theme, preset: look, accent: PRESETS[look].defaultAccent } }), [look]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="wrap relative grid grid-cols-1 items-center gap-16 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-28">
          <div>
            <h1 className="display text-[clamp(3rem,7.4vw,6rem)]" data-reveal="blur">
              Your page.
              <br />
              <span className="serif-accent">Your whole story.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-dim" data-reveal style={{ "--rd": "120ms" } as CSSProperties}>
              Links, projects, experience, music and words on one fast page that feels like you. Start from{" "}
              {TEMPLATE_COUNT} templates, drag in components, bring your own background — or write your own code.
            </p>
            <Form method="get" action="/signup" className="mt-9 max-w-lg" data-reveal style={{ "--rd": "220ms" } as CSSProperties}>
              <label htmlFor="claim" className="sr-only">Choose your handle</label>
              <div className="flex items-center rounded-full border border-line-strong bg-ink-2 p-1.5 pl-5 transition-colors focus-within:border-white/50">
                <span className="flex min-w-0 shrink select-none text-[0.95rem] text-faint" title={`${host}/@`}>
                  <span className="truncate">{host}</span>
                  <span className="shrink-0">/@</span>
                </span>
                <input
                  id="claim" name="handle" placeholder="yourname" autoComplete="off" spellCheck={false} maxLength={30}
                  pattern="[A-Za-z0-9_\-]{3,30}" title="3–30 letters, numbers, hyphens or underscores" size={1}
                  className="w-0 min-w-[5.5rem] flex-1 bg-transparent px-1 text-[0.95rem] text-fg placeholder:text-faint focus:outline-none"
                />
                <button type="submit" className="btn btn-volt btn-sm shrink-0">Claim it</button>
              </div>
            </Form>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" data-reveal style={{ "--rd": "300ms" } as CSSProperties}>
              <Link to="/templates" className="text-fg underline decoration-white/30 underline-offset-4 hover:decoration-white">Browse templates</Link>
              <Link to="/how-it-works" className="text-dim hover:text-fg">See how it works →</Link>
            </div>
          </div>

          <div className="relative mx-auto h-[34rem] w-full max-w-[30rem] lg:scale-[0.82] xl:scale-100" data-reveal="blur" style={{ "--rd": "160ms" } as CSSProperties}>
            {fan.map((t, i) => (
              <Link
                key={t.id}
                to={`/templates/${t.id}`}
                aria-label={`${t.name} template, sample page`}
                className="absolute top-1/2 left-1/2 block rounded-[2.2rem] transition-[translate] duration-300 ease-out hover:-translate-y-1.5 motion-reduce:transition-none"
                style={{ transform: `translate(-50%, -50%) translateX(${(i - 1) * 9.5}rem) rotate(${(i - 1) * 7}deg) scale(${i === 1 ? 1 : 0.9})`, zIndex: i === 1 ? 10 : 1 }}
              >
                <PhoneFrame>
                  <ProfileThumb doc={t.document} width={232} height={440} />
                </PhoneFrame>
              </Link>
            ))}
          </div>
        </div>
        <p className="wrap -mt-10 pb-10 text-right text-xs text-faint">Sample pages from real templates. Fictional people.</p>
      </section>

      {/* Change your look */}
      <section className="border-t border-line">
        <div className="wrap grid grid-cols-1 items-center gap-14 py-24 lg:grid-cols-[1fr_0.9fr_0.8fr]">
          <div data-reveal>
            <h2 className="display text-[clamp(2.2rem,4.4vw,3.6rem)]">
              Change your look.
              <br />
              <span className="serif-accent">Keep everything else.</span>
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-dim">
              Every page is content plus a theme. Swap the palette, fonts, background or effects any time — your blocks stay exactly
              where you put them. Try it: drag the wheel.
            </p>
          </div>
          <div data-reveal style={{ "--rd": "100ms" } as CSSProperties}>
            <WheelPicker label="Palette" items={LOOKS.map((p) => ({ id: p, label: PRESETS[p].label }))} value={look} onChange={(id) => setLook(id as PresetId)} />
          </div>
          <div className="mx-auto w-full max-w-[17rem]" data-reveal style={{ "--rd": "180ms" } as CSSProperties}>
            <PhoneFrame>
              <div className="h-[30rem] overflow-hidden">
                <ProfileView doc={lookDoc} mode="thumbnail" className="h-full" />
              </div>
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* Builder */}
      <section className="border-t border-line">
        <div className="wrap grid grid-cols-1 gap-12 py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="self-start lg:sticky lg:top-28" data-reveal>
            <h2 className="display text-[clamp(2.2rem,4.4vw,3.6rem)]">
              {COMPONENT_COUNT} components.
              <br />
              <span className="serif-accent">One canvas.</span>
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-dim">
              Drag ready-made components onto a live canvas — {BLOCK_TYPES.length} block types across{" "}
              {BLOCK_CATEGORIES.map((c) => c.toLowerCase()).join(", ")}. Click to edit, drag to reorder, undo anything. Want full
              control? Drop in a custom code section and write HTML, CSS and JavaScript with a live preview.
            </p>
            <Link to="/features" className="btn btn-ghost mt-8">Explore the editor</Link>
          </div>
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.4rem] border border-line bg-line xl:grid-cols-3">
            {BLOCK_TYPES.map((type, i) => (
              <li key={type} className="min-w-0 bg-ink p-4 transition-colors sm:p-6 hover:bg-panel" data-reveal style={{ "--rd": `${(i % 3) * 60}ms` } as CSSProperties}>
                <span className="font-mono text-[0.7rem] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-medium">{BLOCK_REGISTRY[type].label}</h3>
                <p className="mt-1.5 text-[0.8rem] leading-relaxed text-dim sm:text-sm">{BLOCK_REGISTRY[type].description}</p>
              </li>
            ))}
            <li
              className={`flex flex-col justify-between gap-4 bg-ink p-4 sm:p-6 ${FILL_SM[BLOCK_TYPES.length % 2]} ${FILL_XL[BLOCK_TYPES.length % 3]}`}
              data-reveal
              style={{ "--rd": `${(BLOCK_TYPES.length % 3) * 60}ms` } as CSSProperties}
            >
              <p className="text-sm leading-relaxed text-dim">Every block works with every theme, and each one has variants you can switch between in the editor.</p>
              <Link to="/features" className="text-sm text-fg underline decoration-white/30 underline-offset-4 hover:decoration-white">See them in the editor →</Link>
            </li>
          </ul>
        </div>
      </section>

      {/* Templates strip: pinned while it slides sideways */}
      <section className="border-t border-line">
        <ScrollStrip
          header={
            <div className="flex flex-wrap items-end justify-between gap-6" data-reveal>
              <h2 className="display max-w-2xl text-[clamp(2.2rem,4.4vw,3.6rem)]">
                {TEMPLATE_COUNT} templates.
                <br />
                <span className="serif-accent">{TEMPLATE_BASE_COUNT} different ideas.</span>
              </h2>
              <Link to="/templates" className="btn btn-ghost">See all templates</Link>
            </div>
          }
        >
          {strip.map((t) => (
            <li key={t.id} className="shrink-0 snap-start">
              <Link to={`/templates/${t.id}`} className="group block rounded-[1.2rem]">
                <div className="transition-[translate] duration-300 ease-out group-hover:-translate-y-1">
                  <ProfileThumb doc={t.document} width={230} height={400} label={`${t.name} template preview`} />
                </div>
                <p className="mt-3 font-medium">{t.name}</p>
                <p className="max-w-[230px] text-sm text-dim">{t.summary}</p>
              </Link>
            </li>
          ))}
        </ScrollStrip>
      </section>

      {/* Principles */}
      <section className="border-t border-line">
        <div className="wrap py-24">
          <h2 className="display max-w-3xl text-[clamp(2.2rem,4.4vw,3.6rem)]" data-reveal>
            Quiet by design.
            <br />
            <span className="serif-accent">Honest by default.</span>
          </h2>
          <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3">
            <Principle title="Counts, not surveillance" body="Analytics are daily totals of views and link clicks. No cookies for visitors, no IP addresses, no fingerprints." href="/privacy" cta="Read the privacy notes" delay={0} />
            <Principle title="Drafts stay drafts" body="Edits save to a private draft. Visitors only ever see the version you explicitly publish, and you can unpublish at any time." href="/how-it-works" cta="See the publishing flow" delay={90} />
            <Principle title="Your code, sandboxed" body="Custom HTML, CSS and JavaScript run in an isolated sandbox that can't touch visitors' accounts or Resonant itself." href="/security" cta="How pages are protected" delay={180} />
          </div>
        </div>
      </section>

      {/* Night sky: one click to everything */}
      <section className="relative overflow-hidden border-t border-line">
        <NightClouds />
        <div className="wrap relative grid grid-cols-1 gap-12 py-28 lg:grid-cols-2 lg:items-center">
          <div data-reveal>
            <h2 className="display text-[clamp(2.4rem,5vw,4.2rem)]">
              Built in
              <br />
              the open.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-dim">
              No hidden tracking, no fake numbers, no surprise settings. Everything Resonant does is written down — have a look.
            </p>
          </div>
          <ul className="border-t border-white/10" data-reveal style={{ "--rd": "120ms" } as CSSProperties}>
            {PAGES.map((p) => (
              <li key={p.to} className="border-b border-white/10">
                <Link to={p.to} className="group grid grid-cols-[8rem_1fr_auto] items-center gap-4 py-5 text-fg">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-sm text-dim">{p.body}</span>
                  <span aria-hidden="true" className="text-dim transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="wrap py-24">
        <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1.3fr_1fr]" data-reveal>
          <h2 className="display text-[clamp(2.6rem,6vw,5rem)]">
            Your next page.
            <br />
            <span className="serif-accent">Start it in a minute.</span>
          </h2>
          <div className="lg:text-right">
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link to="/signup" className="btn btn-volt">Create your page</Link>
              <Link to="/templates" className="btn btn-ghost">Start from a template</Link>
            </div>
            <p className="mt-4 text-sm text-faint">Free to use. No paid plans exist yet.</p>
          </div>
        </div>
      </section>
    </>
  );
}

function Principle({ title, body, href, cta, delay }: { title: string; body: string; href: string; cta: string; delay: number }) {
  return (
    <div className="border-t border-line-strong pt-6" data-reveal style={{ "--rd": `${delay}ms` } as CSSProperties}>
      <h3 className="text-lg font-medium tracking-[-0.01em]">{title}</h3>
      <p className="mt-2.5 leading-relaxed text-dim">{body}</p>
      <Link to={href} className="mt-4 inline-block text-sm text-fg underline decoration-white/30 underline-offset-4 hover:decoration-white">{cta}</Link>
    </div>
  );
}
