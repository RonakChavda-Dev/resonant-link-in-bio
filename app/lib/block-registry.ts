// Zod-free block metadata: labels, categories, safe defaults, the document
// upgrader and page-title helpers. Public and marketing pages import this
// instead of ./blocks so browsers never download the validation library.
import type { Block, BlockOf, BlockType, ProfileDocument } from "./blocks";
import { DEFAULT_EFFECTS, DEFAULT_THEME, type ThemeSettings } from "./themes";
import { CODE_STARTERS } from "./code-starters";

export const DOCUMENT_VERSION = 2;
export const MAX_BLOCKS = 80;

export type BlockCategory = "Profile" | "Links" | "Text" | "Media" | "Portfolio" | "Layout" | "Code";
export const BLOCK_CATEGORIES: BlockCategory[] = ["Profile", "Links", "Text", "Media", "Portfolio", "Layout", "Code"];

export interface BlockMeta<T extends BlockType = BlockType> {
  type: T;
  label: string;
  description: string;
  category: BlockCategory;
  create(): BlockOf<T>;
}

export function newBlockId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-2);
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");

export const BLOCK_REGISTRY: { [K in BlockType]: BlockMeta<K> } = {
  intro: {
    type: "intro", label: "Intro", category: "Profile", description: "Name, tagline, bio, badge and avatar.",
    create: () => ({ id: newBlockId(), type: "intro", name: "Your name", tagline: "", bio: "", avatar: null, align: "center", avatarShape: "circle", badge: "", variant: "classic" }),
  },
  cover: {
    type: "cover", label: "Cover banner", category: "Profile", description: "A wide banner above your intro: image or built-in art.",
    create: () => ({ id: newBlockId(), type: "cover", media: null, backdrop: "holographic", height: "short", title: "" }),
  },
  contact: {
    type: "contact", label: "Contact card", category: "Profile", description: "Email, phone, location and website in one card.",
    create: () => ({ id: newBlockId(), type: "contact", title: "Get in touch", email: "hello@example.com", phone: "", location: "", website: "" }),
  },
  socials: {
    type: "socials", label: "Social links", category: "Links", description: "A row of your profiles, labelled by platform.",
    create: () => ({ id: newBlockId(), type: "socials", items: [], variant: "icons" }),
  },
  link: {
    type: "link", label: "Link button", category: "Links", description: "A tappable link with an optional note.",
    create: () => ({ id: newBlockId(), type: "link", label: "New link", url: "https://example.com/", note: "", variant: "default" }),
  },
  buttons: {
    type: "buttons", label: "Button row", category: "Links", description: "Up to three compact buttons side by side.",
    create: () => ({ id: newBlockId(), type: "buttons", items: [{ label: "Email me", url: "mailto:hello@example.com" }, { label: "Website", url: "https://example.com/" }], variant: "row" }),
  },
  tabs: {
    type: "tabs", label: "Link tabs", category: "Links", description: "Group links into tabs, like categories.",
    create: () => ({
      id: newBlockId(), type: "tabs",
      tabs: [
        { label: "Work", links: [{ label: "Portfolio", url: "https://example.com/work" }] },
        { label: "Personal", links: [{ label: "Reading list", url: "https://example.com/reading" }] },
      ],
    }),
  },
  heading: {
    type: "heading", label: "Heading", category: "Text", description: "Introduce a section of your page.",
    create: () => ({ id: newBlockId(), type: "heading", text: "Section", variant: "label" }),
  },
  text: {
    type: "text", label: "Text", category: "Text", description: "A paragraph, a lead line or a notebook note.",
    create: () => ({ id: newBlockId(), type: "text", body: "Write something here.", variant: "plain" }),
  },
  quote: {
    type: "quote", label: "Quote", category: "Text", description: "A line you live by, with attribution.",
    create: () => ({ id: newBlockId(), type: "quote", text: "Make the thing you wish existed.", cite: "", variant: "large" }),
  },
  faq: {
    type: "faq", label: "FAQ", category: "Text", description: "Questions that expand to answers.",
    create: () => ({ id: newBlockId(), type: "faq", title: "Questions", items: [{ q: "A question visitors ask", a: "A short, clear answer." }] }),
  },
  callout: {
    type: "callout", label: "Callout", category: "Text", description: "Highlight one message, with an optional button.",
    create: () => ({ id: newBlockId(), type: "callout", tone: "accent", title: "Something worth noticing", body: "", linkLabel: "", linkUrl: "" }),
  },
  image: {
    type: "image", label: "Image", category: "Media", description: "One uploaded image with alt text.",
    create: () => ({ id: newBlockId(), type: "image", media: null, alt: "", caption: "", shape: "landscape" }),
  },
  gallery: {
    type: "gallery", label: "Gallery", category: "Media", description: "Grid, carousel or polaroids of up to 12 images.",
    create: () => ({ id: newBlockId(), type: "gallery", columns: 2, variant: "grid", items: [] }),
  },
  video: {
    type: "video", label: "Video", category: "Media", description: "YouTube or Vimeo, loaded only when played.",
    create: () => ({ id: newBlockId(), type: "video", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", title: "Video" }),
  },
  audio: {
    type: "audio", label: "Music & podcast", category: "Media", description: "Spotify or SoundCloud, loaded only when played.",
    create: () => ({ id: newBlockId(), type: "audio", url: "https://open.spotify.com/track/0000000000000000000000", title: "Listen" }),
  },
  projects: {
    type: "projects", label: "Projects", category: "Portfolio", description: "Cards for your work, with image, tag and link.",
    create: () => ({
      id: newBlockId(), type: "projects", title: "Selected work", variant: "cards", columns: 2,
      items: [
        { title: "Project one", description: "What it is and your part in it.", media: null, url: "", tag: "Design" },
        { title: "Project two", description: "A sentence about the outcome.", media: null, url: "", tag: "Research" },
      ],
    }),
  },
  timeline: {
    type: "timeline", label: "Timeline", category: "Portfolio", description: "Experience, education or milestones.",
    create: () => ({
      id: newBlockId(), type: "timeline", title: "Experience",
      items: [
        { period: "2024 — now", title: "Your current role", place: "Studio or company", description: "" },
        { period: "2021 — 2024", title: "A previous role", place: "", description: "" },
      ],
    }),
  },
  skills: {
    type: "skills", label: "Skills & tags", category: "Portfolio", description: "Tools, skills or interests as tags or a list.",
    create: () => ({ id: newBlockId(), type: "skills", title: "Toolkit", items: ["Writing", "Design", "Research"], variant: "tags" }),
  },
  stats: {
    type: "stats", label: "Highlights", category: "Portfolio", description: "Up to four figures you want people to notice.",
    create: () => ({ id: newBlockId(), type: "stats", items: [{ value: "10+", label: "Years making things" }, { value: "40", label: "Projects shipped" }] }),
  },
  countdown: {
    type: "countdown", label: "Countdown", category: "Layout", description: "Count down to a launch, show or date.",
    create: () => ({ id: newBlockId(), type: "countdown", title: "Something new arrives in", target: inDays(14), doneText: "It's here." }),
  },
  marquee: {
    type: "marquee", label: "Marquee", category: "Layout", description: "A line of text that scrolls across the page.",
    create: () => ({ id: newBlockId(), type: "marquee", text: "Open for new projects", speed: "normal" }),
  },
  clock: {
    type: "clock", label: "Clock", category: "Profile", description: "Your local time, live — so visitors know when you're around.",
    create: () => ({ id: newBlockId(), type: "clock", title: "My time", timeZone: "UTC", hour12: true, showDate: true }),
  },
  code: {
    type: "code", label: "Custom code", category: "Code", description: "Your own HTML, CSS and JavaScript, run in a secure sandbox.",
    create: () => ({ id: newBlockId(), type: "code", title: "Custom section", html: CODE_STARTERS.reveal.html, css: CODE_STARTERS.reveal.css, js: CODE_STARTERS.reveal.js, height: "auto", fixedHeight: 360 }),
  },
  divider: {
    type: "divider", label: "Divider", category: "Layout", description: "A line, wave, dots, zigzag or space.",
    create: () => ({ id: newBlockId(), type: "divider", style: "line" }),
  },
};

export const BLOCK_TYPES = Object.keys(BLOCK_REGISTRY) as BlockType[];

export function blankDocument(name = "Your name"): ProfileDocument {
  const intro = BLOCK_REGISTRY.intro.create();
  intro.name = name.slice(0, 60) || "Your name";
  return { version: DOCUMENT_VERSION, theme: structuredClone(DEFAULT_THEME), seo: { title: "", description: "" }, blocks: [intro] };
}

export function profileTitle(doc: ProfileDocument, handle: string): string {
  if (doc.seo.title.trim()) return doc.seo.title.trim();
  const intro = doc.blocks.find((b) => b.type === "intro");
  return intro ? intro.name : `@${handle}`;
}

export function profileDescription(doc: ProfileDocument): string {
  if (doc.seo.description.trim()) return doc.seo.description.trim();
  const intro = doc.blocks.find((b) => b.type === "intro");
  return (intro?.tagline || intro?.bio || "A personal page made with Resonant.").slice(0, 160);
}

// --- Version upgrades ----------------------------------------------------------

type Loose = Record<string, unknown>;
const isObj = (v: unknown): v is Loose => typeof v === "object" && v !== null && !Array.isArray(v);

const V1_BACKDROP: Record<string, string> = { plain: "none", glow: "glow", grid: "grid", rings: "rings", grain: "grain" };

function upgradeThemeV1(t: Loose): ThemeSettings {
  return {
    preset: t.preset as ThemeSettings["preset"],
    accent: t.accent as ThemeSettings["accent"],
    font: t.font as ThemeSettings["font"],
    radius: t.radius as ThemeSettings["radius"],
    buttons: t.buttons as ThemeSettings["buttons"],
    layout: t.layout as ThemeSettings["layout"],
    background: { kind: "preset", preset: (V1_BACKDROP[String(t.backdrop)] ?? "none") as ThemeSettings["background"]["preset"], media: null, dim: 40, blur: 0 },
    effects: { ...DEFAULT_EFFECTS, entrance: "none", resonance: t.resonance === true },
  };
}

function upgradeBlockV1(b: Loose): Loose {
  switch (b.type) {
    case "intro":
      return { ...b, avatarShape: "circle", badge: "", variant: "classic" };
    case "heading":
      return { ...b, variant: "label" };
    case "link": {
      const { emphasis, ...rest } = b;
      return { ...rest, variant: emphasis === "feature" ? "feature" : "default" };
    }
    case "text":
      return { ...b, variant: "plain" };
    case "gallery":
      return { ...b, variant: "grid" };
    default:
      return b;
  }
}

/**
 * Bring a stored document up to the current version. Pure and tolerant: it
 * never validates — callers run the strict schema on the result.
 */
export function upgradeDocument(input: unknown): unknown {
  if (!isObj(input)) return input;
  // v2 documents saved before newer effect options existed: fill in defaults.
  if (input.version === 2 && isObj(input.theme) && isObj(input.theme.effects)) {
    return { ...input, theme: { ...input.theme, effects: { ...DEFAULT_EFFECTS, ...input.theme.effects } } };
  }
  if (input.version === 1 && isObj(input.theme) && Array.isArray(input.blocks)) {
    return {
      ...input,
      version: 2,
      theme: upgradeThemeV1(input.theme),
      blocks: input.blocks.map((b) => (isObj(b) ? upgradeBlockV1(b) : b)),
    };
  }
  return input;
}

/** Upgrade a document already known to be valid (e.g. from the database). */
export function upgradeTrusted(doc: unknown): ProfileDocument {
  return upgradeDocument(doc) as ProfileDocument;
}

export type { Block };
