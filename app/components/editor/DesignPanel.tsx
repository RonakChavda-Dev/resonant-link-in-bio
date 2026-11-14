import { useState, type ReactNode } from "react";
import type { ThemeSettings, EffectSettings, BackgroundSettings } from "~/lib/themes";
import {
  ACCENTS, ACCENT_IDS, BUTTON_LABELS, BUTTON_STYLES, ENTRANCES, FONTS, FONT_IDS, HOVERS, NAME_STYLES, OVERLAYS, PRESETS, PRESET_IDS,
} from "~/lib/themes";
import { Segmented, SelectControl, SliderControl, Toggle } from "./controls";
import { BackdropPicker, type MediaContext } from "./BlockForms";
import { MediaPicker } from "./MediaPicker";
import { WheelPicker } from "~/components/ui/WheelPicker";

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="min-w-0 border-b border-line pb-5 last:border-0">
      <h3>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between py-1 text-left text-[0.82rem] font-semibold">
          {title}
          <span aria-hidden="true" className={`text-faint transition-transform ${open ? "rotate-45" : ""}`}>+</span>
        </button>
      </h3>
      {open ? <div className="mt-3 grid min-w-0 grid-cols-1 gap-4">{children}</div> : null}
    </section>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function DesignPanel({
  theme,
  onChange,
  media,
}: {
  theme: ThemeSettings;
  onChange: (patch: Partial<ThemeSettings>, key: string) => void;
  media: MediaContext;
}) {
  const fx = (patch: Partial<EffectSettings>) => onChange({ effects: { ...theme.effects, ...patch } }, "effects");
  const bg = (patch: Partial<BackgroundSettings>, key = "background") => onChange({ background: { ...theme.background, ...patch } }, key);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <Section title="Quick theme">
        <p className="-mt-1 text-[0.78rem] text-faint">Scroll the wheel to try palettes. Your content doesn't change.</p>
        <WheelPicker
          size="sm"
          label="Palette"
          itemHeight={38}
          visible={5}
          items={PRESET_IDS.map((id) => ({ id, label: PRESETS[id].label }))}
          value={theme.preset}
          onChange={(id) => {
            const p = PRESETS[id as keyof typeof PRESETS];
            onChange({ preset: id as keyof typeof PRESETS, accent: p.defaultAccent }, "preset");
          }}
        />
      </Section>

      <Section title="Colours" defaultOpen={false}>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[0.8rem] font-medium text-dim">Palette · {PRESETS[theme.preset].label}</legend>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_IDS.map((id) => {
              const p = PRESETS[id];
              const checked = theme.preset === id;
              return (
                <button
                  key={id} type="button" aria-pressed={checked} aria-label={`${p.label} palette`} title={p.label}
                  onClick={() => onChange({ preset: id, accent: p.defaultAccent }, "preset")}
                  className={`relative aspect-square min-w-0 overflow-hidden rounded-lg border-2 transition-colors ${checked ? "border-volt" : "border-transparent hover:border-line-strong"}`}
                  style={{ background: p.bg }}
                >
                  <span className="absolute inset-x-1.5 bottom-1.5 h-1.5 rounded-full" style={{ background: p.surface, boxShadow: `inset 0 0 0 1px ${p.border}` }} />
                  <span className="absolute left-1.5 top-1.5 size-2 rounded-full" style={{ background: p.text }} />
                  <span className="absolute right-1.5 top-1.5 size-2 rounded-full" style={{ background: ACCENTS[p.defaultAccent].color }} />
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[0.8rem] font-medium text-dim">Accent · {ACCENTS[theme.accent].label}</legend>
          <div className="flex flex-wrap gap-1.5">
            {ACCENT_IDS.map((id) => {
              const a = ACCENTS[id];
              const checked = theme.accent === id;
              return (
                <button
                  key={id} type="button" aria-pressed={checked} aria-label={`${a.label} accent`} title={a.label}
                  onClick={() => onChange({ accent: id }, "accent")}
                  className={`size-7 rounded-full border-2 ring-1 ring-white/15 transition-transform hover:scale-110 ${checked ? "border-fg" : "border-transparent"}`}
                  style={{ background: a.color }}
                />
              );
            })}
          </div>
        </fieldset>
      </Section>

      <Section title="Background">
        <Segmented
          label="Source" value={theme.background.kind}
          options={[{ value: "preset", label: "Built-in art" }, { value: "image", label: "My image" }]}
          onChange={(kind) => bg({ kind })}
        />
        {theme.background.kind === "preset" ? (
          <BackdropPicker value={theme.background.preset} label="Choose a background" onChange={(preset) => bg({ preset })} />
        ) : (
          <>
            <MediaPicker label="Background image" value={theme.background.media} allowClear={false} onChange={(m) => bg({ media: m })} {...media} />
            <SliderControl label="Dim" value={theme.background.dim} min={0} max={90} unit="%" onChange={(dim) => bg({ dim }, "bg.dim")} />
            <SliderControl label="Blur" value={theme.background.blur} min={0} max={24} unit="px" onChange={(blur) => bg({ blur }, "bg.blur")} />
            <p className="field-hint">Dim keeps text readable over busy photos.</p>
          </>
        )}
        <Toggle label="Animate background" description="Slow drift or pan for backgrounds that support it." checked={theme.effects.animateBackground} onChange={(animateBackground) => fx({ animateBackground })} />
        <Toggle label="Parallax" description="The background stays behind while your content scrolls over it." checked={theme.effects.parallax} onChange={(parallax) => fx({ parallax })} />
      </Section>

      <Section title="Typography & layout">
        <SelectControl label="Font" value={theme.font} options={FONT_IDS.map((id) => ({ value: id, label: FONTS[id].label }))} onChange={(font) => onChange({ font }, "font")} />
        <Segmented label="Layout" value={theme.layout} options={[{ value: "stack", label: "Stack" }, { value: "editorial", label: "Editorial" }, { value: "split", label: "Two-column" }, { value: "panel", label: "Panel" }, { value: "card", label: "Card" }]} onChange={(layout) => onChange({ layout }, "layout")} />
        {theme.layout === "panel" ? <p className="field-hint -mt-2">Your whole page sits in one frosted card — great over your own background image.</p> : null}
        {theme.layout === "card" ? <p className="field-hint -mt-2">A compact profile card centred on your background. Works best with a short page.</p> : null}
        {theme.layout === "split" ? <p className="field-hint -mt-2">On wide screens, everything up to your intro sits in a sticky left column.</p> : null}
        <SelectControl label="Name style" value={theme.effects.nameStyle} options={NAME_STYLES.map((n) => ({ value: n, label: cap(n) }))} onChange={(nameStyle) => fx({ nameStyle })} />
      </Section>

      <Section title="Buttons & cards">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[0.8rem] font-medium text-dim">Button style</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {BUTTON_STYLES.map((b) => (
              <button
                key={b} type="button" aria-pressed={theme.buttons === b} onClick={() => onChange({ buttons: b }, "buttons")}
                className={`min-w-0 truncate rounded-lg border px-1 py-2 text-[0.75rem] ${theme.buttons === b ? "border-volt bg-volt/10 text-fg" : "border-line text-dim hover:text-fg"}`}
              >
                {BUTTON_LABELS[b]}
              </button>
            ))}
          </div>
        </fieldset>
        <Segmented label="Corners" value={theme.radius} options={[{ value: "sharp", label: "Sharp" }, { value: "soft", label: "Soft" }, { value: "round", label: "Round" }]} onChange={(radius) => onChange({ radius }, "radius")} />
        <Toggle label="Glassmorphism" description="Frosted, see-through cards. Looks best over gradients and images." checked={theme.effects.glass} onChange={(glass) => fx({ glass })} />
      </Section>

      <Section title="Effects & motion">
        <SelectControl label="Entrance animation" value={theme.effects.entrance} options={ENTRANCES.map((e) => ({ value: e, label: e === "none" ? "None" : cap(e) }))} onChange={(entrance) => fx({ entrance })} />
        <SelectControl label="Hover effect" value={theme.effects.hover} options={HOVERS.map((h) => ({ value: h, label: h === "none" ? "None" : cap(h) }))} onChange={(hover) => fx({ hover })} />
        <SelectControl label="Overlay" value={theme.effects.overlay} options={OVERLAYS.map((o) => ({ value: o, label: o === "none" ? "None" : cap(o) }))} onChange={(overlay) => fx({ overlay })} />
        <Toggle label="3D tilt" description="The page leans gently towards the visitor's cursor. Best with the glass panel layout." checked={theme.effects.tilt} onChange={(tilt) => fx({ tilt })} />
        <Toggle label="Resonance pulse" description="Soft rings around your avatar and moving wave dividers." checked={theme.effects.resonance} onChange={(resonance) => fx({ resonance })} />
        <p className="field-hint">All motion switches off for visitors who ask their device for reduced motion.</p>
      </Section>
    </div>
  );
}
