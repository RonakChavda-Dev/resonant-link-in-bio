// The one renderer for profile documents: public pages, editor canvas,
// template previews and thumbnails. It renders only registered block types and
// only plain text — no user HTML is ever injected. Visual effects are driven by
// data attributes + CSS (see .rp in app.css) and all respect reduced motion.
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Block, BlockOf, ProfileDocument } from "~/lib/blocks";
import { hasMusic, type MusicSettings } from "~/lib/block-registry";
import { PRESETS, themeVars } from "~/lib/themes";
import { BACKDROPS, type BackdropId } from "~/lib/backdrops";
import { displayLink, parseAudioUrl, parseVideoUrl, platformFor, videoEmbedUrl } from "~/lib/urls";
import { CodeFrame } from "./CodeFrame";

export type ProfileMode = "public" | "preview" | "thumbnail";

interface Props {
  doc: ProfileDocument;
  mode: ProfileMode;
  footer?: ReactNode;
  className?: string;
  /** Editor hook: wrap each rendered block (selection, drag handles). */
  renderBlock?: (block: Block, index: number, node: ReactNode) => ReactNode;
  /** Editor hook: rendered after the last block (drop zone). */
  after?: ReactNode;
  /** Which page to show: null/undefined = home, otherwise a page id from doc.pages. */
  pageId?: string | null;
  /** Public address of the home page (e.g. /@handle); sub-pages link to `${basePath}/${slug}`. */
  basePath?: string;
  /** Editor hook: page tab clicked (instead of following the link). */
  onNavigate?: (pageId: string | null) => void;
}

/**
 * Elements that receive the per-card hover effect (theme.effects.card).
 * Keep in sync with the "Card effects" selector list in profile.css.
 */
const CARD_SELECTOR =
  ".rp-link, .rp-btn, .rp-social, .rp-project, .rp-video, .rp-callout, .rp-quote[data-variant='card'], .rp-faq-item, .rp-stat, .rp-contact, .rp-countdown, .rp-clock, .rp-intro[data-variant='card'], .rp-gallery li, .rp-figure";
/** Card effects that follow the pointer (the rest are pure CSS :hover). */
const POINTER_CARD_EFFECTS = new Set(["tilt", "glare", "holo", "depth", "magnetic", "spotlight", "border"]);

/** Nearest scrolling ancestor, or null for the window. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

export function mediaUrl(id: string) {
  return `/media/${id}`;
}

function backdropStyle(id: BackdropId): CSSProperties {
  const b = BACKDROPS[id] as { css: string; size?: string; pan?: string };
  return {
    backgroundImage: b.css === "none" ? undefined : b.css,
    backgroundSize: b.size,
    ...(b.pan ? { "--rp-pan": b.pan } : null),
  } as CSSProperties;
}

export function ProfileView({ doc, mode, footer, className, renderBlock, after, pageId, basePath, onNavigate }: Props) {
  const { theme } = doc;
  const fx = theme.effects;
  const rootRef = useRef<HTMLDivElement>(null);
  const style = themeVars(theme) as CSSProperties;
  const pages = mode === "thumbnail" ? [] : doc.pages;
  const activePage = pageId ? pages.find((p) => p.id === pageId) ?? null : null;
  // Stacked pages: visitors scroll through every page on one address. The editor
  // always edits one page at a time, so it renders the active page only.
  const stacked = doc.nav.mode === "stack" && mode === "public" && pages.length > 0;
  const visible = (list: Block[]) => (mode === "public" ? list.filter(isRenderablePublicly) : list);
  const blocks = visible(activePage && !stacked ? activePage.blocks : doc.blocks);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const bg = theme.background;
  const backdropAnim = bg.kind === "preset" ? (BACKDROPS[bg.preset] as { anim?: string }).anim : undefined;

  // 3D tilt: the content panel leans towards the pointer.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !fx.tilt || mode === "thumbnail" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const inner = el.querySelector<HTMLElement>(".rp-inner");
    if (!inner) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / Math.min(r.height, window.innerHeight) - 0.5;
      inner.style.setProperty("--tx", `${(-y * 6).toFixed(2)}deg`);
      inner.style.setProperty("--ty", `${(x * 8).toFixed(2)}deg`);
    };
    const leave = () => {
      inner.style.setProperty("--tx", "0deg");
      inner.style.setProperty("--ty", "0deg");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [fx.tilt, mode]);

  // Per-card hover effects that follow the pointer: set --px/--py (0–1) on the hovered card.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || mode === "thumbnail" || !POINTER_CARD_EFFECTS.has(fx.card)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let current: HTMLElement | null = null;
    let frame = 0;
    let last: PointerEvent | null = null;
    const reset = (card: HTMLElement) => {
      card.classList.remove("rp-fx-on");
      card.style.removeProperty("--px");
      card.style.removeProperty("--py");
    };
    const paint = () => {
      frame = 0;
      if (!last) return;
      const target = (last.target as HTMLElement | null)?.closest<HTMLElement>(CARD_SELECTOR) ?? null;
      const card = target && el.contains(target) ? target : null;
      if (card !== current) {
        if (current) reset(current);
        current = card;
      }
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--px", Math.min(1, Math.max(0, (last.clientX - r.left) / r.width)).toFixed(3));
      card.style.setProperty("--py", Math.min(1, Math.max(0, (last.clientY - r.top) / r.height)).toFixed(3));
      card.classList.add("rp-fx-on");
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      last = e;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const leave = () => {
      last = null;
      if (current) reset(current);
      current = null;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
      if (current) reset(current);
    };
  }, [fx.card, mode]);

  // Parallax: the background layer lags behind the content as you scroll — on the
  // public page (window scroll) and in the editor preview (its scroll container).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !fx.parallax || mode === "thumbnail") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const scroller = mode === "public" ? null : scrollParent(el);
    const target: HTMLElement | Window = scroller ?? window;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const top = scroller ? scroller.getBoundingClientRect().top : 0;
      const scrolled = Math.max(0, top - el.getBoundingClientRect().top);
      el.style.setProperty("--rp-par", `${(scrolled * 0.55).toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
      el.style.removeProperty("--rp-par");
    };
  }, [fx.parallax, mode]);

  // Stacked pages: highlight the nav item of the page card in view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !stacked || !("IntersectionObserver" in window)) return;
    const sections = [...el.querySelectorAll<HTMLElement>("[data-rp-section]")];
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActiveSection((hit.target as HTMLElement).dataset.rpSection ?? null);
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [stacked, pages.length]);

  // Scroll-triggered entrances: blocks animate (with motion blur) as they come into view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || mode === "thumbnail" || fx.entrance === "none" || !("IntersectionObserver" in window)) return;
    el.classList.add("rp-io");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 },
    );
    const scan = () => el.querySelectorAll(".rp-b:not(.in)").forEach((b) => io.observe(b));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [fx.entrance, mode]);

  // Cursor spotlight overlay: a CSS variable follows the pointer.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || fx.overlay !== "spotlight" || mode === "thumbnail") return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, [fx.overlay, mode]);

  const wrap = (block: Block, index: number) => {
    const node = <BlockView block={block} mode={mode} />;
    if (renderBlock) return <Fragment key={block.id}>{renderBlock(block, index, node)}</Fragment>;
    return (
      <div key={block.id} className="rp-b" style={{ "--i": index } as CSSProperties}>
        {node}
      </div>
    );
  };

  // Split layout: cover/intro (and anything before the intro) form a sticky side column on wide screens.
  const introIndex = blocks.findIndex((b) => b.type === "intro");
  const split = theme.layout === "split" && introIndex >= 0;
  const aside = split ? blocks.slice(0, introIndex + 1) : [];
  const main = split ? blocks.slice(introIndex + 1) : blocks;

  // Site navigation (only when there are extra pages).
  const navItems = pages.length
    ? [{ id: null as string | null, slug: "", label: doc.nav.homeLabel || "Home" }, ...pages.map((p) => ({ id: p.id as string | null, slug: p.slug, label: p.title }))]
    : [];
  const navHref = (slug: string) =>
    stacked ? (slug ? `#${slug}` : "#top") : `${basePath ?? ""}${slug ? `/${slug}` : ""}` || "/";
  const nav = navItems.length ? (
    <nav className="rp-nav" aria-label="Pages">
      <ul>
        {navItems.map((item) => {
          const current = stacked ? (activeSection ?? "") === item.slug : (activePage?.id ?? null) === item.id;
          return (
            <li key={item.id ?? "home"}>
              <a
                href={navHref(item.slug)}
                aria-current={current ? (stacked ? "location" : "page") : undefined}
                onClick={
                  onNavigate
                    ? (e) => {
                        e.preventDefault();
                        onNavigate(item.id);
                      }
                    : undefined
                }
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  ) : null;

  // Stacked mode: every extra page follows the home page as its own card.
  let offset = blocks.length;
  const sheets = stacked
    ? pages.map((p) => {
        const list = visible(p.blocks);
        const start = offset;
        offset += list.length;
        return (
          <section key={p.id} id={p.slug} className="rp-sheet" data-rp-section={p.slug} aria-labelledby={`rp-sheet-${p.id}`}>
            <h2 id={`rp-sheet-${p.id}`} className="rp-sheet-title">{p.title}</h2>
            {list.map((b, i) => wrap(b, start + i))}
          </section>
        );
      })
    : null;

  return (
    <>
    <div
      ref={rootRef}
      className={`rp ${className ?? ""}`}
      style={style}
      data-tone={PRESETS[theme.preset].tone}
      data-font={theme.font}
      data-buttons={theme.buttons}
      data-layout={theme.layout}
      data-glass={fx.glass ? "on" : "off"}
      data-parallax={fx.parallax ? "on" : "off"}
      data-entrance={fx.entrance}
      data-hover={fx.hover}
      data-name={fx.nameStyle}
      data-resonance={fx.resonance ? "on" : "off"}
      data-tilt={fx.tilt ? "on" : "off"}
      data-card={fx.card}
      data-mode={mode}
      data-rp-section={stacked ? "" : undefined}
      id={stacked ? "top" : undefined}
    >
      <div className="rp-backdrop" aria-hidden="true">
        <div className="rp-par">
          {bg.kind === "image" && bg.media ? (
            <>
              <div
                className="rp-backdrop-img"
                style={{ backgroundImage: `url("${mediaUrl(bg.media)}")`, filter: bg.blur ? `blur(${bg.blur}px)` : undefined }}
              />
              <div className="rp-backdrop-dim" style={{ opacity: bg.dim / 100 }} />
            </>
          ) : (
            <div
              className="rp-backdrop-art"
              data-anim={fx.animateBackground && backdropAnim ? backdropAnim : undefined}
              style={backdropStyle(bg.kind === "preset" ? bg.preset : "none")}
            />
          )}
        </div>
      </div>
      {fx.overlay !== "none" ? <div className="rp-overlay" data-overlay={fx.overlay} aria-hidden="true" /> : null}
      <div className={`rp-inner ${split ? "rp-split" : ""}`}>
        {nav}
        {split ? (
          <>
            <div className="rp-aside">{aside.map((b, i) => wrap(b, i))}</div>
            <div className="rp-main">
              {main.map((b, i) => wrap(b, i + aside.length))}
              {after}
            </div>
          </>
        ) : (
          <>
            {main.map((b, i) => wrap(b, i))}
            {after}
          </>
        )}
        {sheets}
        {blocks.length === 0 && mode !== "public" && !after ? <p className="rp-empty">Add a block to start your page.</p> : null}
        {footer}
      </div>
    </div>
    {/* Outside .rp: its container query makes it the containing block for fixed elements. */}
    {mode === "public" && hasMusic(doc) ? (
      <div className="rp-music" style={style} data-tone={PRESETS[theme.preset].tone} data-font={theme.font}>
        <MusicPlayer music={doc.music} />
      </div>
    ) : null}
    </>
  );
}

/**
 * Profile music. Browsers only allow sound after the visitor interacts with
 * the page, so visitors first see a "click to enter" screen; that click starts
 * the song. A small player then lets them pause or mute at any time. Without
 * JavaScript the screen is hidden (see the <noscript> style) and no audio loads.
 */
function MusicPlayer({ music }: { music: MusicSettings }) {
  const src = music.source === "upload" && music.media ? mediaUrl(music.media) : music.url;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [entered, setEntered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  // Keep the page from scrolling behind the enter screen.
  useEffect(() => {
    if (entered) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [entered]);

  const play = () => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = Math.min(1, Math.max(0, music.volume / 100));
    a.play().catch(() => setPlaying(false));
  };
  const enter = (withSound: boolean) => {
    setEntered(true);
    if (withSound) play();
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setFailed(true);
          setPlaying(false);
        }}
      />
      <noscript>
        <style>{".rp-gate{display:none!important}"}</style>
      </noscript>
      {!entered ? (
        <div className="rp-gate" role="dialog" aria-modal="true" aria-label="Enter page">
          {/* The whole screen is the button, as visitors expect. */}
          <button type="button" className="rp-gate-btn" autoFocus onClick={() => enter(true)}>
            <span className="rp-gate-text">{music.enterText.trim() || "click to enter"}</span>
            <span className="rp-gate-note">♪ This page plays music{music.title ? ` · ${music.title}` : ""}</span>
          </button>
          <button type="button" className="rp-gate-quiet" onClick={() => enter(false)}>
            Enter without sound
          </button>
        </div>
      ) : (
        <div className="rp-player" role="group" aria-label="Music">
          <button
            type="button"
            className="rp-player-btn"
            onClick={() => (playing ? audioRef.current?.pause() : play())}
            aria-label={playing ? "Pause music" : "Play music"}
            disabled={failed}
          >
            {playing ? (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>
            )}
          </button>
          <span className="rp-player-title" data-playing={playing ? "on" : "off"}>
            {failed ? "Song unavailable" : music.title || (playing ? "Now playing" : "Music")}
          </span>
          <button
            type="button"
            className="rp-player-btn"
            onClick={() => {
              const a = audioRef.current;
              if (!a) return;
              a.muted = !a.muted;
              setMuted(a.muted);
            }}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
            disabled={failed}
          >
            {muted ? (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" /><path d="m11 6 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.4" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" /><path d="M11.5 5.5a3.5 3.5 0 0 1 0 5M13 4a6 6 0 0 1 0 8" stroke="currentColor" strokeWidth="1.3" fill="none" /></svg>
            )}
          </button>
        </div>
      )}
    </>
  );
}

function isRenderablePublicly(block: Block) {
  if (block.type === "image") return block.media !== null;
  if (block.type === "gallery") return block.items.length > 0;
  if (block.type === "socials") return block.items.length > 0;
  return true;
}

export function BlockView({ block, mode }: { block: Block; mode: ProfileMode }) {
  switch (block.type) {
    case "intro": return <IntroBlock block={block} mode={mode} />;
    case "cover": return <CoverBlock block={block} />;
    case "heading": return <h2 className="rp-heading" data-variant={block.variant}>{block.text}</h2>;
    case "link": return <LinkBlock block={block} mode={mode} />;
    case "buttons": return <ButtonsBlock block={block} mode={mode} />;
    case "socials": return <SocialsBlock block={block} mode={mode} />;
    case "tabs": return <TabsBlock block={block} mode={mode} />;
    case "text": return <p className="rp-text" data-variant={block.variant}>{block.body}</p>;
    case "quote": return <QuoteBlock block={block} />;
    case "image": return <ImageBlock block={block} mode={mode} />;
    case "gallery": return <GalleryBlock block={block} mode={mode} />;
    case "video": return <VideoBlock block={block} mode={mode} />;
    case "audio": return <AudioBlock block={block} mode={mode} />;
    case "projects": return <ProjectsBlock block={block} mode={mode} />;
    case "timeline": return <TimelineBlock block={block} />;
    case "skills": return <SkillsBlock block={block} />;
    case "stats": return <StatsBlock block={block} />;
    case "contact": return <ContactBlock block={block} mode={mode} />;
    case "countdown": return <CountdownBlock block={block} mode={mode} />;
    case "marquee": return <MarqueeBlock block={block} />;
    case "faq": return <FaqBlock block={block} mode={mode} />;
    case "callout": return <CalloutBlock block={block} mode={mode} />;
    case "code": return <CodeBlock block={block} mode={mode} />;
    case "clock": return <ClockBlock block={block} mode={mode} />;
    case "divider": return <DividerBlock block={block} />;
    default: return null; // Unknown types are never rendered.
  }
}

// --- helpers -------------------------------------------------------------------

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function Arrow() {
  return (
    <svg className="rp-arrow" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Line icons for email and plain websites; other platforms keep their short text mark. */
function Glyph({ platform }: { platform: { name: string; short: string } }) {
  const common = { viewBox: "0 0 20 20", width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (platform.name === "Email") return <svg {...common}><rect x="3" y="4.5" width="14" height="11" rx="2" /><path d="m3.5 6 6.5 5 6.5-5" /></svg>;
  if (platform.name === "Phone") return <svg {...common}><path d="M6 3.5h2l1 3.5-1.6 1.2a8 8 0 0 0 4.4 4.4L13 11l3.5 1v2a2 2 0 0 1-2 2A11.5 11.5 0 0 1 4 5.5a2 2 0 0 1 2-2Z" /></svg>;
  if (platform.short === "↗") return <svg {...common}><circle cx="10" cy="10" r="7" /><path d="M3 10h14M10 3c2 2.2 2.8 4.5 2.8 7s-.8 4.8-2.8 7c-2-2.2-2.8-4.5-2.8-7S8 5.2 10 3Z" /></svg>;
  return <>{platform.short}</>;
}

/** Anchor props by mode: thumbnails are inert, previews don't navigate. */
function linkProps(url: string, blockId: string, mode: ProfileMode) {
  if (mode === "thumbnail") return { "aria-hidden": true, tabIndex: -1 } as const;
  return {
    href: url,
    rel: "noopener noreferrer nofollow ugc",
    "data-rp-block": blockId,
    ...(mode === "preview" ? { onClick: (e: React.MouseEvent) => e.preventDefault(), title: url } : {}),
  };
}

function A({ url, blockId, mode, className, children, ...rest }: { url: string; blockId: string; mode: ProfileMode; className?: string; children: ReactNode; [k: string]: unknown }) {
  if (mode === "thumbnail") return <span className={className}>{children}</span>;
  return (
    <a className={className} {...linkProps(url, blockId, mode)} {...rest}>
      {children}
    </a>
  );
}

function MediaPlaceholder({ label }: { label: string }) {
  return <div className="rp-media-placeholder">{label}</div>;
}

// --- blocks --------------------------------------------------------------------

function IntroBlock({ block, mode }: { block: BlockOf<"intro">; mode: ProfileMode }) {
  const avatar =
    block.avatarShape === "none" ? null : (
      <div className="rp-avatar-wrap" data-shape={block.avatarShape}>
        <span className="rp-ring" aria-hidden="true" />
        <span className="rp-ring" aria-hidden="true" />
        <span className="rp-ring" aria-hidden="true" />
        {block.avatar ? (
          <img className="rp-avatar" src={mediaUrl(block.avatar)} alt="" width={96} height={96} loading={mode === "thumbnail" ? "lazy" : "eager"} decoding="async" />
        ) : (
          <span className="rp-avatar rp-monogram" aria-hidden="true">{initials(block.name)}</span>
        )}
      </div>
    );
  return (
    <header className="rp-intro" data-align={block.align} data-variant={block.variant}>
      {avatar}
      <div className="rp-intro-text">
        {block.badge ? (
          <p className="rp-badge"><span aria-hidden="true" className="rp-badge-dot" />{block.badge}</p>
        ) : null}
        <h1 className="rp-name"><span className="rp-name-text">{block.name}</span></h1>
        {block.tagline ? <p className="rp-tagline">{block.tagline}</p> : null}
        {block.bio ? <p className="rp-bio">{block.bio}</p> : null}
      </div>
    </header>
  );
}

function CoverBlock({ block }: { block: BlockOf<"cover"> }) {
  return (
    <div className="rp-cover" data-height={block.height} style={block.media ? undefined : backdropStyle(block.backdrop)}>
      {block.media ? <img src={mediaUrl(block.media)} alt="" loading="eager" decoding="async" /> : null}
      {block.title ? <span className="rp-cover-title">{block.title}</span> : null}
    </div>
  );
}

function LinkBlock({ block, mode }: { block: BlockOf<"link">; mode: ProfileMode }) {
  const platform = block.variant === "icon" ? platformFor(block.url) : null;
  return (
    <A url={block.url} blockId={block.id} mode={mode} className="rp-link rp-hoverable" data-variant={block.variant}>
      {platform ? <span className="rp-chip" aria-hidden="true"><Glyph platform={platform} /></span> : null}
      <span className="rp-link-text">
        <span className="rp-link-label">{block.label}</span>
        {block.note ? <span className="rp-link-note">{block.note}</span> : null}
        {mode !== "thumbnail" ? <span className="sr-only"> ({displayLink(block.url)})</span> : null}
      </span>
      {block.variant === "card" ? <span className="rp-arrow-circle"><Arrow /></span> : <Arrow />}
    </A>
  );
}

function ButtonsBlock({ block, mode }: { block: BlockOf<"buttons">; mode: ProfileMode }) {
  return (
    <div className="rp-buttons" data-variant={block.variant}>
      {block.items.map((item, i) => (
        <A key={i} url={item.url} blockId={block.id} mode={mode} className="rp-btn rp-hoverable">
          {item.label}
        </A>
      ))}
    </div>
  );
}

function SocialsBlock({ block, mode }: { block: BlockOf<"socials">; mode: ProfileMode }) {
  if (block.items.length === 0) return mode === "public" ? null : <MediaPlaceholder label="Add your profile links" />;
  return (
    <ul className="rp-socials" data-variant={block.variant} role="list">
      {block.items.map((item, i) => {
        const p = platformFor(item.url);
        return (
          <li key={i}>
            <A url={item.url} blockId={block.id} mode={mode} className="rp-social rp-hoverable" aria-label={block.variant === "icons" ? item.label || p.name : undefined}>
              <span className="rp-chip" aria-hidden="true"><Glyph platform={p} /></span>
              {block.variant !== "icons" ? <span>{item.label || p.name}</span> : null}
              {block.variant === "list" ? <span className="rp-social-host">{displayLink(item.url)}</span> : null}
            </A>
          </li>
        );
      })}
    </ul>
  );
}

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

function TabsBlock({ block, mode }: { block: BlockOf<"tabs">; mode: ProfileMode }) {
  const [active, setActive] = useState(0);
  const hydrated = useHydrated();
  const interactive = hydrated && mode !== "thumbnail";
  // Without JavaScript every group is shown with its own heading.
  if (!interactive && mode !== "thumbnail") {
    return (
      <div className="rp-tabs-static">
        {block.tabs.map((tab, t) => (
          <section key={t}>
            <h3 className="rp-heading" data-variant="label">{tab.label}</h3>
            <div className="rp-stack">
              {tab.links.map((l, i) => (
                <A key={i} url={l.url} blockId={block.id} mode={mode} className="rp-link rp-hoverable" data-variant="default"><span className="rp-link-label">{l.label}</span><Arrow /></A>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }
  const current = block.tabs[Math.min(active, block.tabs.length - 1)];
  return (
    <div className="rp-tabs">
      <div role={interactive ? "tablist" : undefined} aria-label={interactive ? "Link groups" : undefined} className="rp-tablist">
        {block.tabs.map((tab, t) => !interactive ? (
          <span key={t} data-selected={t === active || undefined}>{tab.label}</span>
        ) : (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${block.id}-tab-${t}`}
            aria-selected={t === active}
            aria-controls={`${block.id}-panel`}
            tabIndex={t === active ? 0 : -1}
            onClick={() => setActive(t)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setActive((a) => (a + 1) % block.tabs.length);
              if (e.key === "ArrowLeft") setActive((a) => (a - 1 + block.tabs.length) % block.tabs.length);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div id={interactive ? `${block.id}-panel` : undefined} role={interactive ? "tabpanel" : undefined} aria-labelledby={interactive ? `${block.id}-tab-${active}` : undefined} className="rp-stack">
        {current.links.length === 0 ? <p className="rp-text" data-variant="centered">No links in this tab yet.</p> : null}
        {current.links.map((l, i) => (
          <A key={`${active}-${i}`} url={l.url} blockId={block.id} mode={mode} className="rp-link rp-hoverable" data-variant="default">
            <span className="rp-link-label">{l.label}</span>
            <Arrow />
          </A>
        ))}
      </div>
    </div>
  );
}

function QuoteBlock({ block }: { block: BlockOf<"quote"> }) {
  return (
    <figure className="rp-quote" data-variant={block.variant}>
      <blockquote>{block.text}</blockquote>
      {block.cite ? <figcaption>— {block.cite}</figcaption> : null}
    </figure>
  );
}

function ImageBlock({ block, mode }: { block: BlockOf<"image">; mode: ProfileMode }) {
  return (
    <figure className="rp-figure" data-shape={block.shape}>
      {block.media ? <img src={mediaUrl(block.media)} alt={block.alt} loading="lazy" decoding="async" /> : <MediaPlaceholder label={mode === "preview" ? "Upload an image" : "Image"} />}
      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
    </figure>
  );
}

function GalleryBlock({ block, mode }: { block: BlockOf<"gallery">; mode: ProfileMode }) {
  if (block.items.length === 0) return <MediaPlaceholder label={mode === "preview" ? "Add images to this gallery" : "Gallery"} />;
  return (
    <ul className="rp-gallery" data-columns={block.columns} data-variant={block.variant} role="list" tabIndex={block.variant === "carousel" && mode === "public" ? 0 : undefined} aria-label={block.variant === "carousel" ? "Image carousel, scroll sideways" : undefined}>
      {block.items.map((item, i) => (
        <li key={item.media + i} style={{ "--r": `${((i * 37) % 7) - 3}deg` } as CSSProperties}>
          <img src={mediaUrl(item.media)} alt={item.alt} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  );
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>;
}

/** Privacy facade: nothing loads from the provider until a visitor presses play. */
function EmbedFacade({ url, title, provider, mode, onPlay }: { url: string; title: string; provider: string; mode: ProfileMode; onPlay: () => void }) {
  const Tag = mode === "thumbnail" ? "span" : "a";
  return (
    <Tag
      className="rp-video rp-video-facade rp-hoverable"
      {...(mode === "thumbnail" ? {} : { href: url, rel: "noopener noreferrer nofollow", onClick: (e: React.MouseEvent) => { e.preventDefault(); if (mode === "public") onPlay(); } })}
    >
      <span className="rp-play" aria-hidden="true"><PlayIcon /></span>
      <span className="rp-video-title">
        {title}
        <span className="rp-video-provider">{provider} · loads when played</span>
      </span>
    </Tag>
  );
}

function VideoBlock({ block, mode }: { block: BlockOf<"video">; mode: ProfileMode }) {
  const [playing, setPlaying] = useState(false);
  const ref = parseVideoUrl(block.url);
  if (!ref) return null;
  if (playing && mode === "public") {
    return (
      <div className="rp-video">
        <iframe src={videoEmbedUrl(ref)} title={block.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
      </div>
    );
  }
  return <EmbedFacade url={block.url} title={block.title} provider={ref.provider === "youtube" ? "YouTube" : "Vimeo"} mode={mode} onPlay={() => setPlaying(true)} />;
}

function AudioBlock({ block, mode }: { block: BlockOf<"audio">; mode: ProfileMode }) {
  const [playing, setPlaying] = useState(false);
  const ref = parseAudioUrl(block.url);
  if (!ref) return null;
  if (playing && mode === "public") {
    return (
      <div className="rp-audio">
        <iframe src={ref.embed} title={block.title} allow="autoplay; encrypted-media; clipboard-write" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" />
      </div>
    );
  }
  return (
    <div className="rp-audio-facade">
      <EmbedFacade url={block.url} title={block.title} provider={ref.provider === "spotify" ? "Spotify" : "SoundCloud"} mode={mode} onPlay={() => setPlaying(true)} />
    </div>
  );
}

function ProjectsBlock({ block, mode }: { block: BlockOf<"projects">; mode: ProfileMode }) {
  return (
    <section className="rp-projects" data-variant={block.variant} data-columns={block.columns} aria-label={block.title || "Projects"}>
      {block.title ? <h2 className="rp-heading" data-variant="label">{block.title}</h2> : null}
      <ul role="list">
        {block.items.map((p, i) => {
          const inner = (
            <>
              <div className="rp-project-media">
                {p.media ? <img src={mediaUrl(p.media)} alt="" loading="lazy" decoding="async" /> : <span className="rp-project-art" aria-hidden="true" style={{ "--h": `${(i * 47) % 360}deg` } as CSSProperties} />}
              </div>
              <div className="rp-project-body">
                {p.tag ? <span className="rp-tag">{p.tag}</span> : null}
                <h3>{p.title}</h3>
                {p.description ? <p>{p.description}</p> : null}
              </div>
              {p.url ? <Arrow /> : null}
            </>
          );
          return (
            <li key={i}>
              {p.url ? <A url={p.url} blockId={block.id} mode={mode} className="rp-project rp-hoverable">{inner}</A> : <div className="rp-project">{inner}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TimelineBlock({ block }: { block: BlockOf<"timeline"> }) {
  return (
    <section className="rp-timeline" aria-label={block.title || "Timeline"}>
      {block.title ? <h2 className="rp-heading" data-variant="label">{block.title}</h2> : null}
      <ol>
        {block.items.map((item, i) => (
          <li key={i}>
            <span className="rp-tl-dot" aria-hidden="true" />
            {item.period ? <p className="rp-tl-period">{item.period}</p> : null}
            <h3>{item.title}{item.place ? <span className="rp-tl-place"> · {item.place}</span> : null}</h3>
            {item.description ? <p className="rp-tl-desc">{item.description}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function SkillsBlock({ block }: { block: BlockOf<"skills"> }) {
  return (
    <section className="rp-skills" data-variant={block.variant} aria-label={block.title || "Skills"}>
      {block.title ? <h2 className="rp-heading" data-variant="label">{block.title}</h2> : null}
      <ul role="list">
        {block.items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </section>
  );
}

function StatsBlock({ block }: { block: BlockOf<"stats"> }) {
  return (
    <dl className="rp-stats" data-count={block.items.length}>
      {block.items.map((s, i) => (
        <div key={i} className="rp-stat">
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ContactBlock({ block, mode }: { block: BlockOf<"contact">; mode: ProfileMode }) {
  const rows: { label: string; value: string; href?: string }[] = [];
  if (block.email) rows.push({ label: "Email", value: block.email, href: `mailto:${block.email}` });
  if (block.phone) rows.push({ label: "Phone", value: block.phone, href: `tel:${block.phone.replace(/[^+0-9]/g, "")}` });
  if (block.location) rows.push({ label: "Based in", value: block.location });
  if (block.website) rows.push({ label: "Website", value: displayLink(block.website), href: block.website });
  return (
    <section className="rp-contact" aria-label={block.title || "Contact"}>
      {block.title ? <h2>{block.title}</h2> : null}
      <dl>
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.href ? <A url={r.href} blockId={block.id} mode={mode}>{r.value}</A> : r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CountdownBlock({ block, mode }: { block: BlockOf<"countdown">; mode: ProfileMode }) {
  const target = Date.parse(block.target);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (mode === "thumbnail") return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mode]);
  const remaining = now === null ? null : Math.max(0, target - now);
  const parts = remaining === null ? null : [
    ["days", Math.floor(remaining / 86_400_000)],
    ["hours", Math.floor(remaining / 3_600_000) % 24],
    ["min", Math.floor(remaining / 60_000) % 60],
    ["sec", Math.floor(remaining / 1000) % 60],
  ] as const;
  const dateText = new Date(target).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  return (
    <section className="rp-countdown" aria-label={block.title}>
      <p className="rp-countdown-title">{block.title}</p>
      {remaining === 0 ? (
        <p className="rp-countdown-done">{block.doneText || "Now."}</p>
      ) : (
        <div className="rp-countdown-grid" aria-hidden={parts === null ? undefined : true}>
          {(parts ?? [["days", "–"], ["hours", "–"], ["min", "–"], ["sec", "–"]]).map(([k, v]) => (
            <span key={k}><strong>{typeof v === "number" ? String(v).padStart(2, "0") : v}</strong>{k}</span>
          ))}
        </div>
      )}
      <p className="rp-countdown-date"><time dateTime={block.target}>{dateText}</time></p>
    </section>
  );
}

function MarqueeBlock({ block }: { block: BlockOf<"marquee"> }) {
  const items = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div className="rp-marquee" data-speed={block.speed}>
      <span className="sr-only">{block.text}</span>
      <div className="rp-marquee-track" aria-hidden="true">
        {[0, 1].map((half) => (
          <span key={half} className="rp-marquee-half">
            {items.map((i) => <span key={i}>{block.text}<span className="rp-marquee-sep">✦</span></span>)}
          </span>
        ))}
      </div>
    </div>
  );
}

function FaqBlock({ block, mode }: { block: BlockOf<"faq">; mode: ProfileMode }) {
  // Thumbnails sit inside buttons and links, so they use non-interactive elements.
  const thumb = mode === "thumbnail";
  return (
    <section className="rp-faq" aria-label={block.title || "Questions"}>
      {block.title ? <h2 className="rp-heading" data-variant="label">{block.title}</h2> : null}
      {block.items.map((item, i) =>
        thumb ? (
          <div key={i} className="rp-faq-item">
            <div className="rp-faq-q">{item.q}</div>
          </div>
        ) : (
          <details key={i} className="rp-faq-item">
            <summary className="rp-faq-q">{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ),
      )}
    </section>
  );
}

function CalloutBlock({ block, mode }: { block: BlockOf<"callout">; mode: ProfileMode }) {
  return (
    <aside className="rp-callout" data-tone={block.tone}>
      <h3>{block.title}</h3>
      {block.body ? <p>{block.body}</p> : null}
      {block.linkUrl && block.linkLabel ? (
        <A url={block.linkUrl} blockId={block.id} mode={mode} className="rp-callout-btn">{block.linkLabel}</A>
      ) : null}
    </aside>
  );
}

function ClockBlock({ block, mode }: { block: BlockOf<"clock">; mode: ProfileMode }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (mode === "thumbnail") return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [mode]);
  let time = "--:--";
  let date = "";
  let diff = "";
  if (now) {
    time = new Intl.DateTimeFormat(undefined, { timeZone: block.timeZone, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: block.hour12 }).format(now);
    date = new Intl.DateTimeFormat(undefined, { timeZone: block.timeZone, weekday: "short", day: "numeric", month: "short" }).format(now);
    // Offset between the owner's zone and the visitor's, in hours.
    const there = new Date(now.toLocaleString("en-US", { timeZone: block.timeZone })).getTime();
    const here = new Date(now.toLocaleString("en-US")).getTime();
    const h = Math.round(((there - here) / 3_600_000) * 2) / 2;
    diff = h === 0 ? "same time as you" : `${h > 0 ? "+" : "−"}${Math.abs(h)}h from you`;
  }
  return (
    <div className="rp-clock" role="group" aria-label={block.title || "Local time"}>
      <span className="rp-clock-face" aria-hidden="true"><span /></span>
      <div className="min-w-0">
        {block.title ? <p className="rp-clock-title">{block.title}</p> : null}
        <p className="rp-clock-time">{time}</p>
        <p className="rp-clock-meta">{[block.showDate ? date : "", block.timeZone.replace(/_/g, " "), diff].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}

function CodeBlock({ block, mode }: { block: BlockOf<"code">; mode: ProfileMode }) {
  if (mode === "thumbnail") {
    return (
      <div className="rp-code-placeholder" aria-hidden="true">
        <span>&lt;/&gt;</span> {block.title}
      </div>
    );
  }
  return (
    <section className="rp-code" aria-label={block.title}>
      <CodeFrame html={block.html} css={block.css} js={block.js} title={block.title} height={block.height} fixedHeight={block.fixedHeight} live={mode === "preview"} />
    </section>
  );
}

function DividerBlock({ block }: { block: BlockOf<"divider"> }) {
  if (block.style === "space") return <div className="rp-space" aria-hidden="true" />;
  if (block.style === "wave") return <Wave />;
  if (block.style === "dots") return <div className="rp-dots" aria-hidden="true"><span /><span /><span /></div>;
  if (block.style === "zigzag") return <div className="rp-zigzag" aria-hidden="true" />;
  return <hr className="rp-rule" />;
}

/** The resonance motif: bars that breathe in a travelling wave. Decorative. */
export function Wave({ bars = 28 }: { bars?: number }) {
  return (
    <div className="rp-wave" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        const h = 0.25 + 0.75 * Math.abs(Math.sin((i / bars) * Math.PI * 2.2 + 0.6)) * (0.55 + 0.45 * Math.sin(i * 1.7) ** 2);
        return <span key={i} style={{ "--h": h.toFixed(3), "--i": i } as CSSProperties} />;
      })}
    </div>
  );
}
