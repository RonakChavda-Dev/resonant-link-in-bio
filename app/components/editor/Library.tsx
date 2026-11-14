// Component library: searchable presets you can drag onto the canvas or the
// layers list, or click (Enter) to insert below the selected block.
import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { PRESETS, themeVars, type ThemeSettings } from "~/lib/themes";
import { BlockView } from "~/components/profile/ProfileView";
import { useDraggable } from "@dnd-kit/core";
import { BLOCK_CATEGORIES, type BlockCategory } from "~/lib/block-registry";
import { COMPONENTS, type ComponentPreset } from "~/lib/components";
import type { BlockType } from "~/lib/blocks";

const GLYPHS: Partial<Record<BlockType, string>> = {
  intro: "◉", cover: "▭", contact: "✉", socials: "◎", link: "↗", buttons: "▢▢", tabs: "⊟", heading: "H", text: "¶", quote: "❝",
  faq: "?", callout: "!", image: "▨", gallery: "▦", video: "▶", audio: "♪", projects: "◫", timeline: "┆", skills: "#", stats: "№",
  countdown: "◷", marquee: "⇉", divider: "—", code: "</>", clock: "◴",
};

export function Library({ onInsert, disabled, theme }: { onInsert: (preset: ComponentPreset) => void; disabled: boolean; theme: ThemeSettings }) {
  const previewStyle = useMemo(() => themeVars(theme) as CSSProperties, [theme]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BlockCategory | "All">("All");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMPONENTS.filter((c) => (category === "All" || c.category === category) && (!q || c.keywords.includes(q)));
  }, [query, category]);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div>
        <label htmlFor="lib-search" className="sr-only">Search components</label>
        <input
          id="lib-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${COMPONENTS.length} components…`} className="input !min-h-[2.4rem] text-[0.88rem]"
        />
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Component category">
        {(["All", ...BLOCK_CATEGORIES] as const).map((c) => (
          <button
            key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}
            className={`rounded-full px-2.5 py-1 text-[0.75rem] ${category === c ? "bg-volt text-ink" : "border border-line text-dim hover:text-fg"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="text-[0.75rem] text-faint">Drag onto the page, or select to add below the current block.</p>
      <p className="sr-only" aria-live="polite">{shown.length} components</p>
      {shown.length === 0 ? <p className="py-6 text-center text-sm text-faint">Nothing matches “{query}”.</p> : null}
      <ul className="grid min-w-0 grid-cols-2 gap-1.5">
        {shown.map((c) => <LibraryItem key={c.id} preset={c} onInsert={onInsert} disabled={disabled} theme={theme} previewStyle={previewStyle} />)}
      </ul>
    </div>
  );
}

/** A scaled, inert render of the component in the page's current theme. */
const PreviewTile = memo(function PreviewTile({ preset, theme, previewStyle }: { preset: ComponentPreset; theme: ThemeSettings; previewStyle: CSSProperties }) {
  // Client-only: presets get random ids and dates, which must not differ between server and client renders.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const block = useMemo(() => (ready ? preset.create() : null), [preset, ready]);
  if (!block) return <div className="h-[86px] rounded-lg border border-line bg-panel" />;
  return (
    <div
      className="rp pointer-events-none relative h-[86px] overflow-hidden rounded-lg border border-line"
      style={previewStyle}
      data-tone={PRESETS[theme.preset].tone}
      data-font={theme.font}
      data-buttons={theme.buttons}
      data-layout="stack"
      data-glass={theme.effects.glass ? "on" : "off"}
      data-hover="none"
      data-entrance="none"
      data-name={theme.effects.nameStyle}
      data-resonance="off"
      data-mode="thumbnail"
    >
      <div className="absolute left-0 top-0 w-[300px] origin-top-left scale-[0.5] p-4">
        <BlockView block={block} mode="thumbnail" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-5" style={{ background: "linear-gradient(transparent, var(--rp-bg))" }} />
    </div>
  );
});

function LibraryItem({ preset, onInsert, disabled, theme, previewStyle }: { preset: ComponentPreset; onInsert: (p: ComponentPreset) => void; disabled: boolean; theme: ThemeSettings; previewStyle: CSSProperties }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `lib:${preset.id}`, disabled });
  return (
    <li className="min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_118px]">
      <button
        ref={setNodeRef}
        type="button"
        disabled={disabled}
        {...attributes}
        {...listeners}
        onClick={() => onInsert(preset)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onInsert(preset);
          } else listeners?.onKeyDown?.(e);
        }}
        aria-label={`Add ${preset.label}`}
        className={`grid w-full min-w-0 touch-none gap-1.5 rounded-xl border border-line bg-ink-2 p-1.5 text-left transition-colors hover:border-line-strong hover:bg-panel-2 disabled:opacity-40 ${isDragging ? "opacity-40" : ""}`}
      >
        <PreviewTile preset={preset} theme={theme} previewStyle={previewStyle} />
        <span className="flex min-w-0 items-center gap-1.5 px-0.5">
          <span aria-hidden="true" className="shrink-0 font-mono text-[0.68rem] text-faint">{GLYPHS[preset.type] ?? "▪"}</span>
          <span className="min-w-0 truncate text-[0.74rem] leading-snug">{preset.label}</span>
        </span>
      </button>
    </li>
  );
}
