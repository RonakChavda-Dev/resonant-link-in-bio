import { useEffect, useState } from "react";
import { TiltCard } from "~/components/ui/TiltCard";
import { data, Link } from "react-router";
import type { Route } from "./+types/template-preview";
import { seo } from "~/lib/seo";
import { getTemplate, getTemplateBase, TEMPLATE_CATEGORIES } from "~/lib/templates";
import { ACCENTS, BUTTON_LABELS, FONTS, PRESETS } from "~/lib/themes";
import { BACKDROPS } from "~/lib/backdrops";
import { BLOCK_REGISTRY } from "~/lib/block-registry";
import { PhoneFrame } from "~/components/profile/Frames";
import { ProfileView } from "~/components/profile/ProfileView";
import { useRootData } from "~/root";

export function loader({ params }: Route.LoaderArgs) {
  const template = getTemplate(params.templateId);
  if (!template) throw data("Template not found", { status: 404 });
  return { templateId: template.id };
}

export const meta: Route.MetaFunction = ({ matches, loaderData }) => {
  const t = getTemplate(loaderData?.templateId);
  if (!t) return [{ title: "Template not found · Resonant" }];
  return seo(matches, { title: `${t.name} (${t.colourway}) template · Resonant`, description: t.summary, path: `/templates/${t.id}` });
};

export default function TemplatePreview({ loaderData }: Route.ComponentProps) {
  const t = getTemplate(loaderData.templateId)!;
  const base = getTemplateBase(t.baseId)!;
  const root = useRootData();
  const [width, setWidth] = useState<"mobile" | "desktop">("mobile");
  useEffect(() => {
    setWidth(window.matchMedia("(min-width: 1024px)").matches ? "desktop" : "mobile");
  }, []);
  const startHref = root?.user ? `/dashboard/new?template=${t.id}` : `/signup?template=${t.id}`;
  const theme = t.document.theme;
  const fx = theme.effects;
  const effects = [
    fx.glass && "Glass cards",
    fx.parallax && "Parallax",
    fx.entrance !== "none" && `${fx.entrance} entrance`,
    fx.hover !== "none" && `${fx.hover} hover`,
    fx.nameStyle !== "plain" && `${fx.nameStyle} name`,
    fx.overlay !== "none" && `${fx.overlay} overlay`,
    fx.resonance && "Resonance pulse",
  ].filter(Boolean) as string[];
  const blockCounts = t.document.blocks.reduce<Record<string, number>>((acc, b) => {
    acc[b.type] = (acc[b.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="wrap pt-10 pb-8">
      <nav aria-label="Breadcrumb" className="text-sm text-dim">
        <Link to="/templates" className="hover:text-fg">Templates</Link> <span aria-hidden="true">/</span> <span className="text-fg">{t.name}</span>
      </nav>
      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="min-w-0">
          <p className="eyebrow mb-3">{TEMPLATE_CATEGORIES.find((c) => c.id === t.category)?.label}</p>
          <h1 className="display text-[clamp(2.6rem,6vw,4.4rem)]">{t.name}</h1>
          <p className="mt-4 text-lg leading-relaxed text-dim">{t.summary}</p>

          <fieldset className="mt-8">
            <legend className="mb-3 text-sm font-medium">Colourway · <span className="text-dim">{t.colourway}</span></legend>
            <div className="flex flex-wrap gap-2">
              {base.variants.map((v) => (
                <Link
                  key={v.id} to={`/templates/${v.id}`} replace preventScrollReset
                  aria-current={v.id === t.id ? "true" : undefined}
                  aria-label={`${v.colourway} colourway`} title={v.colourway}
                  className={`grid size-9 place-items-center rounded-full ring-1 ring-white/20 transition-transform hover:scale-110 ${v.id === t.id ? "outline outline-2 outline-offset-2 outline-fg" : ""}`}
                  style={{ background: v.swatch[0] }}
                >
                  <span aria-hidden="true" className="size-3.5 rounded-full" style={{ background: v.swatch[1] }} />
                </Link>
              ))}
            </div>
          </fieldset>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={startHref} className="btn btn-volt">Use this template</Link>
            <Link to="/templates" className="btn btn-ghost">Back to all</Link>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-8 text-sm">
            <div><dt className="text-faint">Palette</dt><dd className="mt-1">{PRESETS[theme.preset].label}</dd></div>
            <div><dt className="text-faint">Accent</dt><dd className="mt-1 flex items-center gap-2"><span className="inline-block size-3 rounded-full ring-1 ring-white/25" style={{ background: ACCENTS[theme.accent].color }} />{ACCENTS[theme.accent].label}</dd></div>
            <div><dt className="text-faint">Type</dt><dd className="mt-1">{FONTS[theme.font].label}</dd></div>
            <div><dt className="text-faint">Background</dt><dd className="mt-1">{(BACKDROPS[theme.background.preset] as { label: string }).label}</dd></div>
            <div><dt className="text-faint">Buttons</dt><dd className="mt-1">{BUTTON_LABELS[theme.buttons]}</dd></div>
            <div><dt className="text-faint">Layout</dt><dd className="mt-1 capitalize">{theme.layout === "split" ? "Two-column" : theme.layout}</dd></div>
            {effects.length ? <div className="col-span-2"><dt className="text-faint">Effects</dt><dd className="mt-1 capitalize">{effects.join(" · ")}</dd></div> : null}
            <div className="col-span-2">
              <dt className="text-faint">Blocks</dt>
              <dd className="mt-1">
                {Object.entries(blockCounts).map(([type, n]) => `${BLOCK_REGISTRY[type as keyof typeof BLOCK_REGISTRY].label}${n > 1 ? ` ×${n}` : ""}`).join(" · ")}
              </dd>
            </div>
          </dl>
          <p className="mt-8 text-xs leading-relaxed text-faint">
            Sample content: the person, links and media are placeholders. Everything is editable after you start.
          </p>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex justify-end gap-1" role="group" aria-label="Preview width">
            {(["mobile", "desktop"] as const).map((w) => (
              <button key={w} type="button" aria-pressed={width === w} onClick={() => setWidth(w)}
                className={`rounded-full px-3.5 py-1.5 text-sm capitalize ${width === w ? "bg-white/[0.08] text-fg" : "text-dim hover:text-fg"}`}>
                {w}
              </button>
            ))}
          </div>
          {width === "mobile" ? (
            <TiltCard className="mx-auto max-w-[24rem]" glow={t.swatch[1]}>
              <PhoneFrame>
                <div className="h-[44rem] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <ProfileView key={t.id} doc={t.document} mode="preview" />
                </div>
              </PhoneFrame>
            </TiltCard>
          ) : (
            <TiltCard max={4} radius="1.4rem" glow={t.swatch[1]}>
            <div className="overflow-hidden rounded-[1.4rem] border border-line-strong bg-ink">
              <div className="flex h-9 items-center gap-1.5 border-b border-line bg-panel px-4" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" />
              </div>
              <div className="h-[42rem] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <ProfileView key={t.id} doc={t.document} mode="preview" />
              </div>
            </div>
            </TiltCard>
          )}
        </div>
      </div>
    </div>
  );
}
