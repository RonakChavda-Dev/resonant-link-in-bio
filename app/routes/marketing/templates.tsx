import { useSearchParams } from "react-router";
import type { Route } from "./+types/templates";
import { seo } from "~/lib/seo";
import { TEMPLATE_BASES, TEMPLATE_BASE_COUNT, TEMPLATE_CATEGORIES, TEMPLATE_COUNT, TEMPLATE_STYLES } from "~/lib/templates";
import { TemplateCard } from "~/components/profile/TemplateCard";

export const meta: Route.MetaFunction = ({ matches }) =>
  seo(matches, {
    title: "Templates · Resonant",
    description: `${TEMPLATE_COUNT} starting points for personal pages and one-page portfolios: ${TEMPLATE_BASE_COUNT} designs, each in several colourways.`,
    path: "/templates",
  });

const STYLE_LABELS: Record<(typeof TEMPLATE_STYLES)[number], string> = {
  glass: "Glass", animated: "Animated", notebook: "Notebook", bold: "Bold", editorial: "Editorial", minimal: "Minimal",
};

export default function Templates() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category");
  const tone = params.get("tone");
  const style = params.get("style");

  const shown = TEMPLATE_BASES.map((b) => ({
    base: b,
    variants: b.variants.filter((v) => !tone || v.tone === tone),
  })).filter(({ base, variants }) => variants.length > 0 && (!category || base.category === category) && (!style || base.styles.includes(style as never)));
  const variantCount = shown.reduce((n, s) => n + s.variants.length, 0);

  function setFilter(key: "category" | "tone" | "style", value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { preventScrollReset: true, replace: true });
  }

  return (
    <div className="wrap pt-16 pb-8">
      <p className="eyebrow mb-4">Templates</p>
      <h1 className="display text-[clamp(2.6rem,6vw,4.8rem)] max-w-3xl">
        {TEMPLATE_COUNT} ways to <span className="serif-accent text-volt">start.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-dim leading-relaxed">
        {TEMPLATE_BASE_COUNT} hand-made designs, each in several colourways — notebooks, glassy gradients, bold posters,
        editorial portfolios and more. Pick one, then change any block, colour, background or effect. Names and links shown
        are fictional sample content.
      </p>

      <div className="mt-10 grid gap-4 border-y border-line py-5">
        <FilterRow label="Category">
          <FilterChip active={!category} onClick={() => setFilter("category", null)}>All</FilterChip>
          {TEMPLATE_CATEGORIES.map((c) => (
            <FilterChip key={c.id} active={category === c.id} onClick={() => setFilter("category", c.id)}>{c.label}</FilterChip>
          ))}
        </FilterRow>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <FilterRow label="Style">
            <FilterChip active={!style} onClick={() => setFilter("style", null)}>Any style</FilterChip>
            {TEMPLATE_STYLES.map((s) => (
              <FilterChip key={s} active={style === s} onClick={() => setFilter("style", s)}>{STYLE_LABELS[s]}</FilterChip>
            ))}
          </FilterRow>
          <FilterRow label="Tone">
            <FilterChip active={!tone} onClick={() => setFilter("tone", null)}>Any tone</FilterChip>
            <FilterChip active={tone === "dark"} onClick={() => setFilter("tone", "dark")}>Dark</FilterChip>
            <FilterChip active={tone === "light"} onClick={() => setFilter("tone", "light")}>Light</FilterChip>
          </FilterRow>
        </div>
      </div>

      <p className="mt-6 text-sm text-dim" aria-live="polite">
        Showing {shown.length} design{shown.length === 1 ? "" : "s"} · {variantCount} colourway{variantCount === 1 ? "" : "s"}
      </p>

      {shown.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-dim">No templates match those filters yet.</p>
          <button type="button" className="btn btn-ghost mt-5" onClick={() => setParams({}, { replace: true })}>Clear filters</button>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map(({ base, variants }) => (
            <li key={base.id} className="min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_480px]">
              <TemplateCard base={base} variants={variants} href={(t) => `/templates/${t.id}`} />
              <p className="mt-2 text-sm leading-relaxed text-dim">{base.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-2">
      <legend className="sr-only">Filter by {label.toLowerCase()}</legend>
      {children}
    </fieldset>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" aria-pressed={active} onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${active ? "border-volt bg-volt text-ink" : "border-line-strong text-dim hover:border-white/30 hover:text-fg"}`}
    >
      {children}
    </button>
  );
}
