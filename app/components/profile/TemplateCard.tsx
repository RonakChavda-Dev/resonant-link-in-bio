import { useState } from "react";
import { Link } from "react-router";
import type { Template, TemplateBase } from "~/lib/templates";
import { ProfileThumb } from "./Frames";

/** A base design with its colourways as swatches; picking one updates the thumbnail. */
export function TemplateCard({
  base,
  variants = base.variants,
  href,
  width = 220,
  height = 360,
  selectedId,
  onPick,
}: {
  base: TemplateBase;
  variants?: Template[];
  href?: (t: Template) => string;
  width?: number;
  height?: number;
  selectedId?: string;
  onPick?: (t: Template) => void;
}) {
  const [activeId, setActiveId] = useState(variants[0]?.id);
  const current = variants.find((v) => v.id === (selectedId && variants.some((x) => x.id === selectedId) ? selectedId : activeId)) ?? variants[0];
  if (!current) return null;
  const thumb = (
    <div className="flex justify-center rounded-[1.4rem] border border-line bg-panel p-3 transition-colors group-hover:border-line-strong">
      <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <ProfileThumb doc={current.document} width={width} height={height} label={`${base.name} template, ${current.colourway} colourway`} />
      </div>
    </div>
  );
  return (
    <div className="group min-w-0">
      {href ? (
        <Link to={href(current)} className="block rounded-[1.4rem]">{thumb}</Link>
      ) : (
        <button type="button" onClick={() => onPick?.(current)} className="block w-full rounded-[1.4rem]" aria-label={`Use ${base.name}, ${current.colourway}`}>{thumb}</button>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate font-medium">{base.name}</h3>
        <span className="shrink-0 text-xs text-faint">{current.colourway}</span>
      </div>
      <div role="group" aria-label={`${base.name} colourways`} className="mt-2 flex flex-wrap gap-1.5">
        {variants.map((v) => {
          const checked = v.id === current.id;
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={checked}
              aria-label={`${v.colourway} colourway`}
              title={v.colourway}
              onClick={() => {
                setActiveId(v.id);
                onPick?.(v);
              }}
              className={`grid size-6 place-items-center rounded-full ring-1 ring-white/20 transition-transform hover:scale-110 ${checked ? "outline outline-2 outline-offset-2 outline-fg" : ""}`}
              style={{ background: v.swatch[0] }}
            >
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: v.swatch[1] }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
