import { createContext, useContext, useState, type ReactNode } from "react";
import { blockSchemas, type Block, type BlockOf } from "~/lib/blocks";
import { BACKDROPS, BACKDROP_IDS } from "~/lib/backdrops";
import { normalizeLink, parseAudioUrl, parseVideoUrl, platformFor } from "~/lib/urls";
import { IconButton, Icons, Segmented, SelectControl, SliderControl, TextControl } from "./controls";
import { CodeStudio } from "./CodeStudio";
import { MediaGrid, MediaPicker, uploadImage, type MediaItem } from "./MediaPicker";
import { introFromAccount, socialsFromAccount, type AccountProfile } from "~/lib/account";

/** The signed-in creator's account profile (Settings → Profile), provided by the editor route. */
export const AccountProfileContext = createContext<AccountProfile | null>(null);

export type FieldErrors = Record<string, string>;

/** Validate one block with its registry schema; errors keyed by dotted path. */
export function blockErrors(block: Block): FieldErrors {
  const schema = blockSchemas[block.type] as (typeof blockSchemas)[keyof typeof blockSchemas];
  const result = schema.safeParse(block);
  if (result.success) return {};
  const out: FieldErrors = {};
  for (const issue of result.error.issues) out[issue.path.join(".")] ??= issue.message;
  return out;
}

export interface MediaContext {
  library: MediaItem[];
  onUploaded: (item: MediaItem) => void;
  csrf: string;
}

interface FormProps<T extends Block["type"]> {
  block: BlockOf<T>;
  onChange: (patch: Partial<BlockOf<T>>, key: string) => void;
  errors: FieldErrors;
  media: MediaContext;
}

export function BlockForm(props: FormProps<Block["type"]>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = props as any;
  switch (props.block.type) {
    case "intro": return <IntroForm {...p} />;
    case "cover": return <CoverForm {...p} />;
    case "heading": return <HeadingForm {...p} />;
    case "link": return <LinkForm {...p} />;
    case "buttons": return <ButtonsForm {...p} />;
    case "socials": return <SocialsForm {...p} />;
    case "tabs": return <TabsForm {...p} />;
    case "text": return <TextForm {...p} />;
    case "quote": return <QuoteForm {...p} />;
    case "image": return <ImageForm {...p} />;
    case "gallery": return <GalleryForm {...p} />;
    case "video": return <VideoForm {...p} />;
    case "audio": return <AudioForm {...p} />;
    case "projects": return <ProjectsForm {...p} />;
    case "timeline": return <TimelineForm {...p} />;
    case "skills": return <SkillsForm {...p} />;
    case "stats": return <StatsForm {...p} />;
    case "contact": return <ContactForm {...p} />;
    case "countdown": return <CountdownForm {...p} />;
    case "marquee": return <MarqueeForm {...p} />;
    case "faq": return <FaqForm {...p} />;
    case "callout": return <CalloutForm {...p} />;
    case "code": return <CodeForm {...p} />;
    case "clock": return <ClockForm {...p} />;
    case "divider": return <DividerForm {...p} />;
  }
}

const Stack = ({ children }: { children: ReactNode }) => <div className="grid min-w-0 grid-cols-1 gap-4">{children}</div>;

/** URL field that normalises on blur (adds https://, rejects unsafe schemes). */
export function UrlControl({ label, value, onChange, error, optional = false, hint }: { label: string; value: string; onChange: (v: string) => void; error?: string; optional?: boolean; hint?: string }) {
  const [draft, setDraft] = useState(value);
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }
  return (
    <TextControl
      label={label}
      value={draft}
      max={2048}
      type="url"
      placeholder="https://"
      error={localError ?? error}
      hint={hint ?? (optional ? "Optional." : "Web address, mailto: or tel: link.")}
      onChange={(v) => {
        setDraft(v);
        setLocalError(null);
        const normalized = normalizeLink(v);
        if (normalized) onChange(normalized);
        else if (optional && v.trim() === "") onChange("");
      }}
      onBlur={() => {
        if (optional && draft.trim() === "") return;
        const normalized = normalizeLink(draft);
        if (normalized) {
          setDraft(normalized);
          onChange(normalized);
        } else setLocalError("Use a full web address (https://…), mailto: or tel: link.");
      }}
    />
  );
}

/** Generic editor for arrays of items: add, remove, reorder. */
function ListEditor<T>({
  label,
  items,
  onChange,
  render,
  create,
  min = 0,
  max,
  itemLabel,
}: {
  label: string;
  items: T[];
  onChange: (items: T[], key: string) => void;
  render: (item: T, i: number, set: (patch: Partial<T>, key: string) => void) => ReactNode;
  create: () => T;
  min?: number;
  max: number;
  itemLabel: (i: number) => string;
}) {
  const set = (i: number) => (patch: Partial<T>, key: string) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)), key);
  const move = (i: number, d: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next, "list-move");
  };
  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="mb-1 text-[0.8rem] font-medium text-dim">{label}</legend>
      <ol className="grid min-w-0 gap-3">
        {items.map((item, i) => (
          <li key={i} className="grid min-w-0 gap-3 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[0.7rem] text-faint">{itemLabel(i)}</span>
              <div className="flex">
                <IconButton label={`Move ${itemLabel(i)} up`} onClick={() => move(i, -1)} disabled={i === 0}>{Icons.up}</IconButton>
                <IconButton label={`Move ${itemLabel(i)} down`} onClick={() => move(i, 1)} disabled={i === items.length - 1}>{Icons.down}</IconButton>
                <IconButton label={`Remove ${itemLabel(i)}`} tone="danger" disabled={items.length <= min} onClick={() => onChange(items.filter((_, j) => j !== i), "list-remove")}>{Icons.trash}</IconButton>
              </div>
            </div>
            {render(item, i, set(i))}
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-ghost btn-sm justify-self-start" disabled={items.length >= max} onClick={() => onChange([...items, create()], "list-add")}>
        {Icons.plus} Add
      </button>
    </fieldset>
  );
}

function IntroForm({ block, onChange, errors, media }: FormProps<"intro">) {
  const account = useContext(AccountProfileContext);
  return (
    <Stack>
      {account ? (
        <FromAccount
          note={account.avatar || account.bio ? "Fills name, avatar and bio from Settings." : "Fills your display name. Add an avatar and bio in Settings."}
          onUse={() => onChange(introFromAccount(block, account), "from-account")}
        />
      ) : null}
      <MediaPicker label="Avatar" value={block.avatar} onChange={(avatar) => onChange({ avatar }, "avatar")} {...media} />
      <TextControl label="Name" value={block.name} max={60} error={errors.name} onChange={(name) => onChange({ name }, `${block.id}.name`)} />
      <TextControl label="Tagline" value={block.tagline} max={120} error={errors.tagline} onChange={(tagline) => onChange({ tagline }, `${block.id}.tagline`)} />
      <TextControl label="Bio" value={block.bio} max={400} multiline error={errors.bio} onChange={(bio) => onChange({ bio }, `${block.id}.bio`)} />
      <TextControl label="Badge (optional)" value={block.badge} max={40} placeholder="e.g. Available for work" error={errors.badge} onChange={(badge) => onChange({ badge }, `${block.id}.badge`)} />
      <Segmented label="Style" value={block.variant} options={[{ value: "classic", label: "Classic" }, { value: "card", label: "Card" }, { value: "hero", label: "Big name" }]} onChange={(variant) => onChange({ variant }, "variant")} />
      <Segmented label="Alignment" value={block.align} options={[{ value: "center", label: "Centre" }, { value: "left", label: "Left" }]} onChange={(align) => onChange({ align }, "align")} />
      <Segmented label="Avatar shape" value={block.avatarShape} options={[{ value: "circle", label: "Circle" }, { value: "rounded", label: "Rounded" }, { value: "square", label: "Square" }, { value: "none", label: "Hidden" }]} onChange={(avatarShape) => onChange({ avatarShape }, "avatarShape")} />
    </Stack>
  );
}

function FromAccount({ note, onUse }: { note: string; onUse: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5">
      <p className="min-w-0 flex-1 text-[0.78rem] text-faint">{note}</p>
      <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={onUse}>Use my account profile</button>
    </div>
  );
}

export function BackdropPicker({ value, onChange, label = "Built-in art" }: { value: string; onChange: (id: (typeof BACKDROP_IDS)[number]) => void; label?: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[0.8rem] font-medium text-dim">{label}</legend>
      <div className="grid grid-cols-4 gap-1.5">
        {BACKDROP_IDS.map((id) => {
          const b = BACKDROPS[id] as { label: string; css: string; size?: string };
          const checked = value === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={checked}
              title={b.label}
              aria-label={b.label}
              onClick={() => onChange(id)}
              className={`rp aspect-square min-w-0 overflow-hidden rounded-lg border-2 ${checked ? "border-volt" : "border-transparent hover:border-line-strong"}`}
              style={{ "--rp-bg": "#151716", "--rp-text": "#eef0ea", "--rp-accent": "#a1a1aa", backgroundColor: "#151716", backgroundImage: b.css === "none" ? undefined : b.css, backgroundSize: b.size } as React.CSSProperties}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

function CoverForm({ block, onChange, errors, media }: FormProps<"cover">) {
  return (
    <Stack>
      <MediaPicker label="Cover image (optional)" value={block.media} onChange={(m) => onChange({ media: m }, "media")} {...media} />
      {!block.media ? <BackdropPicker value={block.backdrop} onChange={(backdrop) => onChange({ backdrop }, "backdrop")} /> : null}
      <TextControl label="Text on the banner (optional)" value={block.title} max={60} error={errors.title} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
      <Segmented label="Height" value={block.height} options={[{ value: "short", label: "Short" }, { value: "tall", label: "Tall" }]} onChange={(height) => onChange({ height }, "height")} />
    </Stack>
  );
}

function HeadingForm({ block, onChange, errors }: FormProps<"heading">) {
  return (
    <Stack>
      <TextControl label="Heading" value={block.text} max={80} error={errors.text} onChange={(text) => onChange({ text }, `${block.id}.text`)} />
      <Segmented label="Style" value={block.variant} options={[{ value: "label", label: "Label" }, { value: "title", label: "Title" }, { value: "display", label: "Display" }, { value: "handwritten", label: "Handwritten" }]} onChange={(variant) => onChange({ variant }, "variant")} />
    </Stack>
  );
}

function LinkForm({ block, onChange, errors }: FormProps<"link">) {
  return (
    <Stack>
      <TextControl label="Label" value={block.label} max={80} error={errors.label} onChange={(label) => onChange({ label }, `${block.id}.label`)} />
      <UrlControl label="Link" value={block.url} error={errors.url} onChange={(url) => onChange({ url }, `${block.id}.url`)} />
      <TextControl label="Note (optional)" value={block.note} max={120} error={errors.note} onChange={(note) => onChange({ note }, `${block.id}.note`)} />
      <SelectControl label="Style" value={block.variant} options={[{ value: "default", label: "Standard" }, { value: "feature", label: "Featured (accent)" }, { value: "card", label: "Card" }, { value: "minimal", label: "Minimal text link" }, { value: "icon", label: "With platform label" }]} onChange={(variant) => onChange({ variant }, "variant")} />
    </Stack>
  );
}

function ButtonsForm({ block, onChange, errors }: FormProps<"buttons">) {
  return (
    <Stack>
      <Segmented label="Arrangement" value={block.variant} options={[{ value: "row", label: "Row" }, { value: "stack", label: "Stacked" }]} onChange={(variant) => onChange({ variant }, "variant")} />
      <ListEditor
        label="Buttons" items={block.items} min={1} max={3} itemLabel={(i) => `Button ${i + 1}`}
        create={() => ({ label: "New button", url: "https://example.com/" })}
        onChange={(items, key) => onChange({ items }, key)}
        render={(item, i, set) => (
          <>
            <TextControl label="Label" value={item.label} max={60} error={errors[`items.${i}.label`]} onChange={(label) => set({ label }, `${block.id}.l${i}`)} />
            <UrlControl label="Link" value={item.url} error={errors[`items.${i}.url`]} onChange={(url) => set({ url }, `${block.id}.u${i}`)} />
          </>
        )}
      />
    </Stack>
  );
}

function SocialsForm({ block, onChange, errors }: FormProps<"socials">) {
  const account = useContext(AccountProfileContext);
  return (
    <Stack>
      {account ? (
        account.socials.length ? (
          <FromAccount
            note={`Replaces these links with the ${account.socials.length} saved in Settings.`}
            onUse={() => onChange({ items: socialsFromAccount(account) }, "from-account")}
          />
        ) : (
          <p className="field-hint">Save your social links once in <a href="/settings#profile" target="_blank" rel="noopener" className="underline underline-offset-2">Settings</a> to reuse them on every page.</p>
        )
      ) : null}
      <Segmented label="Style" value={block.variant} options={[{ value: "icons", label: "Icons" }, { value: "pills", label: "Pills" }, { value: "list", label: "List" }]} onChange={(variant) => onChange({ variant }, "variant")} />
      <ListEditor
        label="Profiles" items={block.items} max={12} itemLabel={(i) => platformFor(block.items[i]?.url ?? "").name}
        create={(): { url: string; label?: string } => ({ url: "https://example.com/" })}
        onChange={(items, key) => onChange({ items }, key)}
        render={(item, i, set) => (
          <>
            <UrlControl label="Profile link" value={item.url} error={errors[`items.${i}.url`]} hint="Paste the full address of your profile; the platform is detected from it." onChange={(url) => set({ url }, `${block.id}.s${i}`)} />
            <TextControl label="Custom label (optional)" value={item.label ?? ""} max={40} placeholder={platformFor(item.url).name} error={errors[`items.${i}.label`]} onChange={(label) => set({ label: label || undefined }, `${block.id}.sl${i}`)} />
          </>
        )}
      />
      {block.items.length === 0 ? <p className="field-hint">Empty social rows are hidden on your live page.</p> : null}
    </Stack>
  );
}

function TabsForm({ block, onChange, errors }: FormProps<"tabs">) {
  return (
    <ListEditor
      label="Tabs" items={block.tabs} min={2} max={6} itemLabel={(i) => block.tabs[i]?.label || `Tab ${i + 1}`}
      create={() => ({ label: "New tab", links: [] })}
      onChange={(tabs, key) => onChange({ tabs }, key)}
      render={(tab, t, set) => (
        <>
          <TextControl label="Tab name" value={tab.label} max={30} error={errors[`tabs.${t}.label`]} onChange={(label) => set({ label }, `${block.id}.t${t}`)} />
          <ListEditor
            label="Links in this tab" items={tab.links} max={12} itemLabel={(i) => `Link ${i + 1}`}
            create={() => ({ label: "New link", url: "https://example.com/" })}
            onChange={(links, key) => set({ links }, `${key}.${t}`)}
            render={(l, i, setL) => (
              <>
                <TextControl label="Label" value={l.label} max={60} error={errors[`tabs.${t}.links.${i}.label`]} onChange={(label) => setL({ label }, `${block.id}.t${t}l${i}`)} />
                <UrlControl label="Link" value={l.url} error={errors[`tabs.${t}.links.${i}.url`]} onChange={(url) => setL({ url }, `${block.id}.t${t}u${i}`)} />
              </>
            )}
          />
        </>
      )}
    />
  );
}

function TextForm({ block, onChange, errors }: FormProps<"text">) {
  return (
    <Stack>
      <TextControl label="Text" value={block.body} max={2000} rows={5} multiline error={errors.body} hint="Plain text. Line breaks are kept." onChange={(body) => onChange({ body }, `${block.id}.body`)} />
      <Segmented label="Style" value={block.variant} options={[{ value: "plain", label: "Plain" }, { value: "lead", label: "Lead" }, { value: "note", label: "Notebook" }, { value: "centered", label: "Centred" }]} onChange={(variant) => onChange({ variant }, "variant")} />
    </Stack>
  );
}

function QuoteForm({ block, onChange, errors }: FormProps<"quote">) {
  return (
    <Stack>
      <TextControl label="Quote" value={block.text} max={400} multiline error={errors.text} onChange={(text) => onChange({ text }, `${block.id}.text`)} />
      <TextControl label="Attribution (optional)" value={block.cite} max={80} error={errors.cite} onChange={(cite) => onChange({ cite }, `${block.id}.cite`)} />
      <Segmented label="Style" value={block.variant} options={[{ value: "large", label: "Large" }, { value: "card", label: "Card" }]} onChange={(variant) => onChange({ variant }, "variant")} />
    </Stack>
  );
}

function ImageForm({ block, onChange, errors, media }: FormProps<"image">) {
  return (
    <Stack>
      <MediaPicker label="Image" value={block.media} onChange={(m) => onChange({ media: m }, "media")} {...media} />
      <TextControl label="Alt text" value={block.alt} max={200} error={errors.alt} hint="Describe the image for people using screen readers." onChange={(alt) => onChange({ alt }, `${block.id}.alt`)} />
      <TextControl label="Caption (optional)" value={block.caption} max={160} error={errors.caption} onChange={(caption) => onChange({ caption }, `${block.id}.caption`)} />
      <Segmented label="Shape" value={block.shape} options={[{ value: "landscape", label: "Landscape" }, { value: "square", label: "Square" }, { value: "portrait", label: "Portrait" }, { value: "wide", label: "Wide" }]} onChange={(shape) => onChange({ shape }, "shape")} />
      {!block.media ? <p className="field-hint">Image blocks without an image are hidden on your live page.</p> : null}
    </Stack>
  );
}

function GalleryForm({ block, onChange, errors, media }: FormProps<"gallery">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const full = block.items.length >= 12;
  return (
    <Stack>
      <Segmented label="Style" value={block.variant} options={[{ value: "grid", label: "Grid" }, { value: "carousel", label: "Carousel" }, { value: "polaroid", label: "Polaroids" }]} onChange={(variant) => onChange({ variant }, "variant")} />
      {block.variant !== "carousel" ? <Segmented label="Columns" value={block.columns} options={[{ value: 2, label: "2" }, { value: 3, label: "3" }]} onChange={(columns) => onChange({ columns }, "columns")} /> : null}
      {block.items.length ? (
        <ul className="grid gap-3">
          {block.items.map((item, i) => (
            <li key={item.media + i} className="flex min-w-0 items-start gap-3">
              <img src={`/media/${item.media}`} alt="" className="size-14 shrink-0 rounded-lg border border-line object-cover" />
              <div className="min-w-0 flex-1">
                <TextControl label={`Alt text ${i + 1}`} value={item.alt} max={200} error={errors[`items.${i}.alt`]} onChange={(alt) => onChange({ items: block.items.map((it, j) => (j === i ? { ...it, alt } : it)) }, `${block.id}.alt.${i}`)} />
              </div>
              <IconButton label={`Remove image ${i + 1}`} tone="danger" onClick={() => onChange({ items: block.items.filter((_, j) => j !== i) }, "items")}>{Icons.trash}</IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint">No images yet. Empty galleries are hidden on your live page.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className={`btn btn-ghost btn-sm ${full || busy ? "pointer-events-none opacity-50" : ""}`}>
          {busy ? "Uploading…" : "Upload images"}
          <input
            type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={full || busy}
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 12 - block.items.length);
              e.target.value = "";
              setBusy(true);
              setError(null);
              const added: string[] = [];
              for (const f of files) {
                const r = await uploadImage(f, media.csrf);
                if ("error" in r) { setError(r.error); break; }
                media.onUploaded({ id: r.id });
                added.push(r.id);
              }
              setBusy(false);
              if (added.length) onChange({ items: [...block.items, ...added.map((id) => ({ media: id, alt: "" }))] }, "items");
            }}
          />
        </label>
        {media.library.length && !full ? <button type="button" className="btn btn-quiet btn-sm" aria-expanded={browsing} onClick={() => setBrowsing((v) => !v)}>From uploads</button> : null}
      </div>
      {browsing ? <MediaGrid library={media.library} onPick={(id) => { onChange({ items: [...block.items, { media: id, alt: "" }] }, "items"); setBrowsing(false); }} /> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </Stack>
  );
}

function EmbedUrl({ label, value, valid, hint, onValid }: { label: string; value: string; valid: (v: string) => boolean; hint: string; onValid: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <TextControl
      label={label} value={draft} max={500} type="url" hint={hint}
      error={valid(draft) ? null : "That link isn't supported here."}
      onChange={(v) => { setDraft(v); if (valid(v)) onValid(v.trim()); }}
    />
  );
}

function VideoForm({ block, onChange, errors }: FormProps<"video">) {
  return (
    <Stack>
      <EmbedUrl label="Video link" value={block.url} valid={(v) => parseVideoUrl(v) !== null} hint="YouTube or Vimeo. Nothing loads from them until a visitor presses play." onValid={(url) => onChange({ url }, `${block.id}.url`)} />
      <TextControl label="Title" value={block.title} max={100} error={errors.title} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
    </Stack>
  );
}

function AudioForm({ block, onChange, errors }: FormProps<"audio">) {
  return (
    <Stack>
      <EmbedUrl label="Spotify or SoundCloud link" value={block.url} valid={(v) => parseAudioUrl(v) !== null} hint="Track, album, playlist, show or episode. Loads only when a visitor presses play." onValid={(url) => onChange({ url }, `${block.id}.url`)} />
      <TextControl label="Title" value={block.title} max={100} error={errors.title} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
    </Stack>
  );
}

function ProjectsForm({ block, onChange, errors, media }: FormProps<"projects">) {
  return (
    <Stack>
      <TextControl label="Section title (optional)" value={block.title} max={60} error={errors.title} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
      <Segmented label="Style" value={block.variant} options={[{ value: "cards", label: "Cards" }, { value: "list", label: "List" }, { value: "feature", label: "Featured" }]} onChange={(variant) => onChange({ variant }, "variant")} />
      {block.variant === "cards" ? <Segmented label="Columns" value={block.columns} options={[{ value: 1, label: "1" }, { value: 2, label: "2" }]} onChange={(columns) => onChange({ columns }, "columns")} /> : null}
      <ListEditor
        label="Projects" items={block.items} min={1} max={12} itemLabel={(i) => block.items[i]?.title || `Project ${i + 1}`}
        create={() => ({ title: "New project", description: "", media: null, url: "", tag: "" })}
        onChange={(items, key) => onChange({ items }, key)}
        render={(item, i, set) => (
          <>
            <MediaPicker label="Image (optional)" value={item.media} onChange={(m) => set({ media: m }, `${block.id}.m${i}`)} {...media} />
            <TextControl label="Title" value={item.title} max={80} error={errors[`items.${i}.title`]} onChange={(title) => set({ title }, `${block.id}.t${i}`)} />
            <TextControl label="Description" value={item.description} max={240} multiline rows={2} error={errors[`items.${i}.description`]} onChange={(description) => set({ description }, `${block.id}.d${i}`)} />
            <TextControl label="Tag (optional)" value={item.tag} max={30} onChange={(tag) => set({ tag }, `${block.id}.g${i}`)} />
            <UrlControl label="Link" value={item.url} optional error={errors[`items.${i}.url`]} onChange={(url) => set({ url }, `${block.id}.u${i}`)} />
          </>
        )}
      />
    </Stack>
  );
}

function TimelineForm({ block, onChange, errors }: FormProps<"timeline">) {
  return (
    <Stack>
      <TextControl label="Section title (optional)" value={block.title} max={60} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
      <ListEditor
        label="Entries" items={block.items} min={1} max={15} itemLabel={(i) => block.items[i]?.period || `Entry ${i + 1}`}
        create={() => ({ period: "", title: "New entry", place: "", description: "" })}
        onChange={(items, key) => onChange({ items }, key)}
        render={(item, i, set) => (
          <>
            <TextControl label="Period" value={item.period} max={30} placeholder="2024 — now" onChange={(period) => set({ period }, `${block.id}.p${i}`)} />
            <TextControl label="Role or milestone" value={item.title} max={80} error={errors[`items.${i}.title`]} onChange={(title) => set({ title }, `${block.id}.t${i}`)} />
            <TextControl label="Place (optional)" value={item.place} max={80} onChange={(place) => set({ place }, `${block.id}.l${i}`)} />
            <TextControl label="Details (optional)" value={item.description} max={240} multiline rows={2} onChange={(description) => set({ description }, `${block.id}.d${i}`)} />
          </>
        )}
      />
    </Stack>
  );
}

function SkillsForm({ block, onChange, errors }: FormProps<"skills">) {
  const [draft, setDraft] = useState(block.items.join(", "));
  return (
    <Stack>
      <TextControl label="Title (optional)" value={block.title} max={60} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
      <TextControl
        label="Items" value={draft} max={1000} multiline rows={3} hint="Separate items with commas. Up to 30."
        error={errors.items ?? Object.entries(errors).find(([k]) => k.startsWith("items."))?.[1]}
        onChange={(v) => {
          setDraft(v);
          const items = v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
          if (items.length) onChange({ items }, `${block.id}.items`);
        }}
      />
      <Segmented label="Style" value={block.variant} options={[{ value: "tags", label: "Tags" }, { value: "list", label: "List" }, { value: "bars", label: "Columns" }]} onChange={(variant) => onChange({ variant }, "variant")} />
    </Stack>
  );
}

function StatsForm({ block, onChange, errors }: FormProps<"stats">) {
  return (
    <ListEditor
      label="Figures" items={block.items} min={1} max={4} itemLabel={(i) => `Figure ${i + 1}`}
      create={() => ({ value: "0", label: "Label" })}
      onChange={(items, key) => onChange({ items }, key)}
      render={(item, i, set) => (
        <div className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-2">
          <TextControl label="Value" value={item.value} max={12} error={errors[`items.${i}.value`]} onChange={(value) => set({ value }, `${block.id}.v${i}`)} />
          <TextControl label="Label" value={item.label} max={30} error={errors[`items.${i}.label`]} onChange={(label) => set({ label }, `${block.id}.l${i}`)} />
        </div>
      )}
    />
  );
}

function ContactForm({ block, onChange, errors }: FormProps<"contact">) {
  return (
    <Stack>
      <TextControl label="Title (optional)" value={block.title} max={60} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
      <TextControl label="Email" value={block.email} max={254} type="email" error={errors.email} onChange={(email) => onChange({ email: email.trim() }, `${block.id}.email`)} />
      <TextControl label="Phone" value={block.phone} max={32} type="tel" error={errors.phone} onChange={(phone) => onChange({ phone }, `${block.id}.phone`)} />
      <TextControl label="Location" value={block.location} max={80} error={errors.location} onChange={(location) => onChange({ location }, `${block.id}.location`)} />
      <UrlControl label="Website" value={block.website} optional error={errors.website} onChange={(website) => onChange({ website }, `${block.id}.website`)} />
      <p className="field-hint">Anything you fill in here is public once you publish.</p>
    </Stack>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CountdownForm({ block, onChange, errors }: FormProps<"countdown">) {
  return (
    <Stack>
      <TextControl label="Title" value={block.title} max={80} error={errors.title} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
      <TextControl
        label="Counts down to (your local time)" type="datetime-local" max={40} value={toLocalInput(block.target)} error={errors.target}
        onChange={(v) => {
          const d = new Date(v);
          if (!Number.isNaN(d.getTime())) onChange({ target: d.toISOString().replace(/\.\d{3}Z$/, "Z") }, `${block.id}.target`);
        }}
      />
      <TextControl label="Text when it's over" value={block.doneText} max={80} onChange={(doneText) => onChange({ doneText }, `${block.id}.done`)} />
    </Stack>
  );
}

function MarqueeForm({ block, onChange, errors }: FormProps<"marquee">) {
  return (
    <Stack>
      <TextControl label="Text" value={block.text} max={80} error={errors.text} onChange={(text) => onChange({ text }, `${block.id}.text`)} />
      <Segmented label="Speed" value={block.speed} options={[{ value: "slow", label: "Slow" }, { value: "normal", label: "Normal" }, { value: "fast", label: "Fast" }]} onChange={(speed) => onChange({ speed }, "speed")} />
      <p className="field-hint">Visitors who prefer reduced motion see it standing still.</p>
    </Stack>
  );
}

function FaqForm({ block, onChange, errors }: FormProps<"faq">) {
  return (
    <Stack>
      <TextControl label="Title (optional)" value={block.title} max={80} error={errors.title} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
      <ListEditor
        label="Questions" items={block.items} min={1} max={20} itemLabel={(i) => `Q${i + 1}`}
        create={() => ({ q: "New question", a: "Answer" })}
        onChange={(items, key) => onChange({ items }, key)}
        render={(item, i, set) => (
          <>
            <TextControl label="Question" value={item.q} max={160} error={errors[`items.${i}.q`]} onChange={(q) => set({ q }, `${block.id}.q${i}`)} />
            <TextControl label="Answer" value={item.a} max={1000} multiline error={errors[`items.${i}.a`]} onChange={(a) => set({ a }, `${block.id}.a${i}`)} />
          </>
        )}
      />
    </Stack>
  );
}

function CalloutForm({ block, onChange, errors }: FormProps<"callout">) {
  return (
    <Stack>
      <Segmented label="Style" value={block.tone} options={[{ value: "accent", label: "Accent" }, { value: "quiet", label: "Quiet" }, { value: "sticky", label: "Sticky note" }]} onChange={(tone) => onChange({ tone }, "tone")} />
      <TextControl label="Title" value={block.title} max={80} error={errors.title} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
      <TextControl label="Body" value={block.body} max={400} multiline error={errors.body} onChange={(body) => onChange({ body }, `${block.id}.body`)} />
      <TextControl label="Button label (optional)" value={block.linkLabel} max={40} error={errors.linkLabel} onChange={(linkLabel) => onChange({ linkLabel }, `${block.id}.linkLabel`)} />
      <UrlControl label="Button link" value={block.linkUrl} optional error={errors.linkUrl} onChange={(linkUrl) => onChange({ linkUrl }, `${block.id}.linkUrl`)} />
    </Stack>
  );
}

const COMMON_ZONES = [
  "UTC", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Istanbul", "Africa/Lagos", "Africa/Johannesburg",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Perth", "Australia/Sydney",
  "Australia/Melbourne", "Pacific/Auckland", "America/Sao_Paulo", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Mexico_City",
];

function ClockForm({ block, onChange, errors }: FormProps<"clock">) {
  const local = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const zones = Array.from(new Set([block.timeZone, local, ...COMMON_ZONES]));
  return (
    <Stack>
      <TextControl label="Label (optional)" value={block.title} max={40} error={errors.title} onChange={(title) => onChange({ title }, `${block.id}.title`)} />
      <SelectControl label="Time zone" value={block.timeZone} options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") + (z === local ? " (yours)" : "") }))} onChange={(timeZone) => onChange({ timeZone }, "timeZone")} />
      <Segmented label="Format" value={block.hour12 ? "12" : "24"} options={[{ value: "12", label: "12-hour" }, { value: "24", label: "24-hour" }]} onChange={(v) => onChange({ hour12: v === "12" }, "hour12")} />
      <Segmented label="Date" value={block.showDate ? "show" : "hide"} options={[{ value: "show", label: "Show date" }, { value: "hide", label: "Time only" }]} onChange={(v) => onChange({ showDate: v === "show" }, "showDate")} />
      <p className="field-hint">Visitors also see how far ahead or behind you are.</p>
    </Stack>
  );
}

function CodeForm({ block, onChange, errors }: FormProps<"code">) {
  const [open, setOpen] = useState(false);
  const lines = (s: string) => (s ? s.split("\n").length : 0);
  return (
    <Stack>
      <TextControl label="Section name" value={block.title} max={60} error={errors.title} hint="Used as the accessible name of this section." onChange={(title) => onChange({ title }, `${block.id}.title`)} />
      <div className="grid gap-2 rounded-xl border border-line bg-ink-2 p-3">
        <p className="font-mono text-[0.72rem] text-faint">
          HTML {lines(block.html)} lines · CSS {lines(block.css)} lines · JS {lines(block.js)} lines
        </p>
        <button type="button" className="btn btn-volt btn-sm justify-self-start" onClick={() => setOpen(true)}>Open code studio</button>
        {errors.html || errors.css || errors.js ? <p className="field-error">{errors.html ?? errors.css ?? errors.js}</p> : null}
      </div>
      <Segmented label="Height" value={block.height} options={[{ value: "auto", label: "Fit content" }, { value: "fixed", label: "Fixed" }]} onChange={(height) => onChange({ height }, "height")} />
      {block.height === "fixed" ? <SliderControl label="Fixed height" value={block.fixedHeight} min={120} max={1600} step={20} unit="px" onChange={(fixedHeight) => onChange({ fixedHeight }, `${block.id}.fh`)} /> : null}
      <p className="field-hint">Your code runs in an isolated sandbox: it can't access visitors' accounts or Resonant itself.</p>
      {open ? <CodeStudio block={block} onChange={onChange} onClose={() => setOpen(false)} /> : null}
    </Stack>
  );
}

function DividerForm({ block, onChange }: FormProps<"divider">) {
  return (
    <SelectControl
      label="Style" value={block.style}
      options={[{ value: "line", label: "Line" }, { value: "wave", label: "Resonance wave" }, { value: "dots", label: "Dots" }, { value: "zigzag", label: "Zigzag" }, { value: "space", label: "Empty space" }]}
      onChange={(style) => onChange({ style }, "style")}
    />
  );
}

/** One-line summary shown in the layers list. */
export function blockSummary(block: Block): string {
  switch (block.type) {
    case "intro": return block.name;
    case "cover": return block.title || (block.media ? "Image" : (BACKDROPS[block.backdrop] as { label: string }).label);
    case "heading": return block.text;
    case "link": return block.label;
    case "buttons": return block.items.map((i) => i.label).join(" · ");
    case "socials": return block.items.length ? block.items.map((i) => platformFor(i.url).name).join(", ") : "No profiles yet";
    case "tabs": return block.tabs.map((t) => t.label).join(" · ");
    case "text": return block.body.slice(0, 60);
    case "quote": return block.text.slice(0, 60);
    case "image": return block.media ? block.alt || "Image" : "No image yet";
    case "gallery": return `${block.items.length} image${block.items.length === 1 ? "" : "s"}`;
    case "video": case "audio": return block.title;
    case "projects": return block.title || `${block.items.length} projects`;
    case "timeline": return block.title || `${block.items.length} entries`;
    case "skills": return block.title || block.items.slice(0, 3).join(", ");
    case "stats": return block.items.map((s) => s.value).join(" · ");
    case "contact": return block.title || block.email || "Contact";
    case "countdown": return block.title;
    case "marquee": return block.text;
    case "faq": return `${block.items.length} question${block.items.length === 1 ? "" : "s"}`;
    case "callout": return block.title;
    case "code": return block.title;
    case "clock": return block.title || block.timeZone;
    case "divider": return block.style;
  }
}
