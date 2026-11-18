// Site-level editor UI: the page switcher above the canvas, page management
// (names, addresses, order, how visitors move between pages) and the profile
// music settings. Everything here edits the draft document; nothing is live
// until the owner publishes.
import { useRef, useState } from "react";
import type { ProfileDocument } from "~/lib/blocks";
import { MAX_PAGES, newBlockId, slugify, type MusicSettings, type NavSettings } from "~/lib/block-registry";
import { mediaUrl } from "~/components/profile/ProfileView";
import { IconButton, Icons, Segmented, SliderControl, TextControl } from "./controls";
import type { MediaItem } from "./MediaPicker";

type Page = ProfileDocument["pages"][number];

/** A new page with a unique name and address. */
export function newPage(doc: ProfileDocument): Page {
  const taken = new Set(doc.pages.map((p) => p.slug));
  let n = doc.pages.length + 2;
  let title = `Page ${n}`;
  while (taken.has(slugify(title))) title = `Page ${++n}`;
  return { id: newBlockId(), slug: slugify(title), title, blocks: [] };
}

/** Keep only characters allowed in a page address while typing. */
function cleanSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").slice(0, 32);
}

// --- Page switcher (above the canvas) -----------------------------------------------

export function PageStrip({
  doc,
  pageId,
  onSelect,
  onAdd,
}: {
  doc: ProfileDocument;
  pageId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
}) {
  const items = [{ id: null as string | null, label: doc.nav.homeLabel || "Home" }, ...doc.pages.map((p) => ({ id: p.id as string | null, label: p.title || "Untitled" }))];
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Pages of your site">
      {items.map((item) => (
        <button
          key={item.id ?? "home"}
          type="button"
          role="tab"
          aria-selected={pageId === item.id}
          onClick={() => onSelect(item.id)}
          className={`max-w-[10rem] shrink-0 truncate rounded-full px-3 py-1 text-xs ${pageId === item.id ? "bg-white/[0.1] text-fg" : "text-dim hover:text-fg"}`}
        >
          {item.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onAdd}
        disabled={doc.pages.length >= MAX_PAGES}
        title={doc.pages.length >= MAX_PAGES ? `Up to ${MAX_PAGES} extra pages` : "Add a page"}
        className="shrink-0 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs text-dim hover:text-fg disabled:opacity-40"
      >
        + Page
      </button>
    </div>
  );
}

// --- Pages section (Page tab) --------------------------------------------------------

export function PagesSection({
  doc,
  liveUrl,
  onChange,
  onSelectPage,
}: {
  doc: ProfileDocument;
  liveUrl: string;
  onChange: (patch: { pages?: Page[]; nav?: NavSettings }, key: string) => void;
  onSelectPage: (id: string | null) => void;
}) {
  const pages = doc.pages;
  const setPage = (id: string, patch: Partial<Page>, key: string) =>
    onChange({ pages: pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }, key);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= pages.length) return;
    const next = [...pages];
    const [p] = next.splice(from, 1);
    next.splice(to, 0, p);
    onChange({ pages: next }, "pages.order");
  };
  const stacked = doc.nav.mode === "stack";

  return (
    <section className="grid min-w-0 gap-4">
      <div>
        <h2 className="text-sm font-semibold">Pages</h2>
        <p className="field-hint mt-1">
          Add pages for work, links, a bio — anything. Visitors switch between them with tabs at the top of your site.
        </p>
      </div>
      <Segmented
        label="How visitors move between pages"
        value={doc.nav.mode}
        options={[
          { value: "tabs", label: "Separate pages" },
          { value: "stack", label: "One long scroll" },
        ]}
        onChange={(mode) => onChange({ nav: { ...doc.nav, mode } }, "nav.mode")}
      />
      <p className="field-hint -mt-2">
        {stacked
          ? "Every page sits on your main address as its own card, one after another. The tabs jump to each card."
          : "Each page gets its own address you can share, like the ones below."}
      </p>
      <TextControl
        label="Home page name"
        value={doc.nav.homeLabel}
        max={40}
        onChange={(homeLabel) => onChange({ nav: { ...doc.nav, homeLabel } }, "nav.homeLabel")}
        hint="Shown as the first tab."
      />
      {pages.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[0.8rem] text-faint">
          Only your home page so far.
        </p>
      ) : (
        <ol className="grid gap-3">
          {pages.map((p, i) => (
            <li key={p.id} className="grid min-w-0 gap-2 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="min-w-0 truncate text-left text-[0.82rem] font-medium hover:underline" onClick={() => onSelectPage(p.id)}>
                  {p.title || "Untitled"} <span className="text-faint">· {p.blocks.length} block{p.blocks.length === 1 ? "" : "s"}</span>
                </button>
                <div className="flex shrink-0 gap-0.5">
                  <IconButton label="Move page up" onClick={() => move(i, i - 1)} disabled={i === 0}>{Icons.up}</IconButton>
                  <IconButton label="Move page down" onClick={() => move(i, i + 1)} disabled={i === pages.length - 1}>{Icons.down}</IconButton>
                  <IconButton
                    label="Delete page"
                    onClick={() => {
                      if (p.blocks.length === 0 || window.confirm(`Delete the "${p.title}" page and its ${p.blocks.length} block(s)? You can undo this.`)) {
                        onChange({ pages: pages.filter((x) => x.id !== p.id) }, "pages.remove");
                      }
                    }}
                  >
                    {Icons.trash}
                  </IconButton>
                </div>
              </div>
              <TextControl label="Name" value={p.title} max={40} onChange={(title) => setPage(p.id, { title }, `page.${p.id}.title`)} />
              <TextControl
                label="Address"
                value={p.slug}
                max={32}
                onChange={(v) => setPage(p.id, { slug: cleanSlug(v) }, `page.${p.id}.slug`)}
                onBlur={() => setPage(p.id, { slug: cleanSlug(p.slug).replace(/^-+|-+$/g, "") || slugify(p.title) }, `page.${p.id}.slug`)}
                hint={<span className="break-all font-mono">{stacked ? `${liveUrl}#${p.slug}` : `${liveUrl}/${p.slug}`}</span>}
              />
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm justify-self-start"
        disabled={pages.length >= MAX_PAGES}
        onClick={() => {
          const page = newPage(doc);
          onChange({ pages: [...pages, page] }, "pages.add");
          onSelectPage(page.id);
        }}
      >
        + Add page
      </button>
      {pages.length >= MAX_PAGES ? <p className="field-hint -mt-2">That's the maximum of {MAX_PAGES} extra pages.</p> : null}
    </section>
  );
}

// --- Music section (Page tab) --------------------------------------------------------

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

async function uploadAudio(file: File, csrf: string): Promise<{ id: string } | { error: string }> {
  if (file.size > MAX_AUDIO_BYTES) return { error: "Songs must be 10 MB or smaller." };
  if (file.type && !file.type.startsWith("audio/")) return { error: "Choose an MP3, M4A, OGG or WAV file." };
  const body = new FormData();
  body.append("kind", "audio");
  body.append("file", file);
  try {
    const res = await fetch("/api/media", { method: "POST", body, headers: { "X-CSRF-Token": csrf } });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok || !json.id) return { error: json.error ?? "Upload failed. Try again." };
    return { id: json.id };
  } catch {
    return { error: "Upload failed. Check your connection and try again." };
  }
}

export function MusicSection({
  music,
  onChange,
  audioLibrary,
  csrf,
  onUploaded,
}: {
  music: MusicSettings;
  onChange: (patch: Partial<MusicSettings>, key: string) => void;
  audioLibrary: MediaItem[];
  csrf: string;
  onUploaded: (item: MediaItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewSrc = music.source === "upload" && music.media ? mediaUrl(music.media) : music.source === "url" && music.url ? music.url : null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await uploadAudio(file, csrf);
    setBusy(false);
    if ("error" in result) setError(result.error);
    else {
      onUploaded({ id: result.id, kind: "audio" });
      onChange({ media: result.id, title: music.title || file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80) }, "music.media");
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="grid min-w-0 gap-4">
      <div>
        <h2 className="text-sm font-semibold">Music</h2>
        <p className="field-hint mt-1">
          Play a song when people visit. Browsers only allow sound after a click, so visitors first see a “click to enter”
          screen — and can always pause or mute.
        </p>
      </div>
      <Segmented
        label="Song"
        value={music.source}
        options={[
          { value: "none", label: "Off" },
          { value: "upload", label: "Upload" },
          { value: "url", label: "Link" },
        ]}
        onChange={(source) => onChange({ source }, "music.source")}
      />

      {music.source === "upload" ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? "Uploading…" : music.media ? "Replace song" : "Upload a song"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,audio/x-wav,.mp3,.m4a,.ogg,.wav"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          {audioLibrary.length > 1 || (audioLibrary.length === 1 && audioLibrary[0].id !== music.media) ? (
            <label className="grid gap-1 text-[0.8rem] text-dim">
              Or pick an earlier upload
              <select
                className="input !min-h-[2.4rem]"
                value={music.media ?? ""}
                onChange={(e) => onChange({ media: e.target.value || null }, "music.media")}
              >
                <option value="">Choose…</option>
                {audioLibrary.map((m, i) => (
                  <option key={m.id} value={m.id}>
                    Song upload {audioLibrary.length - i}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="field-hint">MP3, M4A, OGG or WAV, up to 10 MB. Only upload music you have the rights to share.</p>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {music.source === "url" ? (
        <TextControl
          label="Song link"
          value={music.url}
          max={2048}
          type="url"
          placeholder="https://example.com/song.mp3"
          onChange={(url) => onChange({ url: url.trim() }, "music.url")}
          hint="A direct link to an audio file (ending in .mp3, .m4a…). Spotify, YouTube and SoundCloud page links won't play here — use their blocks instead. The visitor's browser loads the file from that site."
        />
      ) : null}

      {music.source !== "none" ? (
        <>
          {previewSrc ? (
            <audio controls preload="none" src={previewSrc} className="w-full" aria-label="Preview your song">
              Your browser can't play this preview.
            </audio>
          ) : null}
          <TextControl label="Song title" value={music.title} max={80} placeholder="Optional" onChange={(title) => onChange({ title }, "music.title")} hint="Shown in the small player." />
          <TextControl
            label="Enter-screen text"
            value={music.enterText}
            max={60}
            placeholder="click to enter"
            onChange={(enterText) => onChange({ enterText }, "music.enterText")}
          />
          <SliderControl label="Volume" value={music.volume} min={0} max={100} unit="%" onChange={(volume) => onChange({ volume }, "music.volume")} />
          <p className="field-hint">The enter screen and player appear on your published page, not in this preview.</p>
        </>
      ) : null}
    </section>
  );
}
