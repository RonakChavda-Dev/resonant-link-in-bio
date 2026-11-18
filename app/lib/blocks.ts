// The block schema: one strict Zod object per block type. Shared by the editor
// (client validation) and the server (authoritative validation on save and
// publish). Unknown fields and unknown block types are rejected, so only
// registered blocks can be stored or rendered. Zod-free metadata, defaults and
// the version upgrader live in ./block-registry.
import { z } from "zod";
import { isSafeAudioUrl, isSafeLink, parseAudioUrl, parseVideoUrl } from "./urls";
import {
  ACCENT_IDS,
  BUTTON_STYLES,
  CARD_EFFECTS,
  ENTRANCES,
  FONT_IDS,
  HOVERS,
  LAYOUTS,
  NAME_STYLES,
  OVERLAYS,
  PRESET_IDS,
  RADIUS_IDS,
  type ThemeSettings,
} from "./themes";
import { BACKDROP_IDS } from "./backdrops";
import { BLOCK_REGISTRY, DOCUMENT_VERSION, MAX_BLOCKS, MAX_PAGES, PAGE_SLUG_PATTERN } from "./block-registry";
export * from "./block-registry";

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
export const CODE_MAX = 20_000;
function isTimeZone(tz: string) {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+){0,2}$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
const blockId = z.string().regex(/^[a-z0-9]{6,16}$/, "Invalid block id");
const line = (max: number, label: string) =>
  z.string().max(max, `${label} can be at most ${max} characters`).refine((v) => !CONTROL.test(v), `${label} contains invalid characters`);
const required = (max: number, label: string) => line(max, label).refine((v) => v.trim().length > 0, `${label} is required`);
const link = z.string().refine(isSafeLink, "Use a full web address (https://…), mailto: or tel: link");
const optionalLink = z.union([z.literal(""), link]);
const mediaRef = z.uuid().nullable();
const linkItem = z.strictObject({ label: required(60, "Label"), url: link });

export const blockSchemas = {
  intro: z.strictObject({
    id: blockId,
    type: z.literal("intro"),
    name: required(60, "Name"),
    tagline: line(120, "Tagline"),
    bio: line(400, "Bio"),
    avatar: mediaRef,
    align: z.enum(["center", "left"]),
    avatarShape: z.enum(["circle", "rounded", "square", "none"]),
    badge: line(40, "Badge"),
    variant: z.enum(["classic", "card", "hero"]),
  }),
  cover: z.strictObject({
    id: blockId,
    type: z.literal("cover"),
    media: mediaRef,
    backdrop: z.enum(BACKDROP_IDS),
    height: z.enum(["short", "tall"]),
    title: line(60, "Cover text"),
  }),
  heading: z.strictObject({
    id: blockId,
    type: z.literal("heading"),
    text: required(80, "Heading"),
    variant: z.enum(["label", "title", "display", "handwritten"]),
  }),
  link: z.strictObject({
    id: blockId,
    type: z.literal("link"),
    label: required(80, "Label"),
    url: link,
    note: line(120, "Note"),
    variant: z.enum(["default", "feature", "card", "minimal", "icon"]),
  }),
  buttons: z.strictObject({
    id: blockId,
    type: z.literal("buttons"),
    items: z.array(linkItem).min(1, "Add at least one button").max(3, "Up to 3 buttons"),
    variant: z.enum(["row", "stack"]),
  }),
  socials: z.strictObject({
    id: blockId,
    type: z.literal("socials"),
    items: z.array(z.strictObject({ url: link, label: line(40, "Label").optional() })).max(12, "Up to 12 links"),
    variant: z.enum(["icons", "pills", "list"]),
  }),
  tabs: z.strictObject({
    id: blockId,
    type: z.literal("tabs"),
    tabs: z
      .array(z.strictObject({ label: required(30, "Tab name"), links: z.array(linkItem).max(12, "Up to 12 links per tab") }))
      .min(2, "Add at least two tabs")
      .max(6, "Up to 6 tabs"),
  }),
  text: z.strictObject({
    id: blockId,
    type: z.literal("text"),
    body: required(2000, "Text"),
    variant: z.enum(["plain", "lead", "note", "centered"]),
  }),
  quote: z.strictObject({
    id: blockId,
    type: z.literal("quote"),
    text: required(400, "Quote"),
    cite: line(80, "Attribution"),
    variant: z.enum(["large", "card"]),
  }),
  image: z.strictObject({
    id: blockId,
    type: z.literal("image"),
    media: mediaRef,
    alt: line(200, "Alt text"),
    caption: line(160, "Caption"),
    shape: z.enum(["landscape", "square", "portrait", "wide"]),
  }),
  gallery: z.strictObject({
    id: blockId,
    type: z.literal("gallery"),
    columns: z.union([z.literal(2), z.literal(3)]),
    variant: z.enum(["grid", "carousel", "polaroid"]),
    items: z.array(z.strictObject({ media: z.uuid(), alt: line(200, "Alt text") })).max(12, "Galleries hold up to 12 images"),
  }),
  video: z.strictObject({
    id: blockId,
    type: z.literal("video"),
    url: z.string().refine((v) => parseVideoUrl(v) !== null, "Use a YouTube or Vimeo video link"),
    title: required(100, "Video title"),
  }),
  audio: z.strictObject({
    id: blockId,
    type: z.literal("audio"),
    url: z.string().refine((v) => parseAudioUrl(v) !== null, "Use a Spotify or SoundCloud link"),
    title: required(100, "Title"),
  }),
  projects: z.strictObject({
    id: blockId,
    type: z.literal("projects"),
    title: line(60, "Title"),
    variant: z.enum(["cards", "list", "feature"]),
    columns: z.union([z.literal(1), z.literal(2)]),
    items: z
      .array(
        z.strictObject({
          title: required(80, "Project title"),
          description: line(240, "Description"),
          media: mediaRef,
          url: optionalLink,
          tag: line(30, "Tag"),
        }),
      )
      .min(1, "Add at least one project")
      .max(12, "Up to 12 projects"),
  }),
  timeline: z.strictObject({
    id: blockId,
    type: z.literal("timeline"),
    title: line(60, "Title"),
    items: z
      .array(
        z.strictObject({
          period: line(30, "Period"),
          title: required(80, "Role or milestone"),
          place: line(80, "Place"),
          description: line(240, "Description"),
        }),
      )
      .min(1, "Add at least one entry")
      .max(15, "Up to 15 entries"),
  }),
  skills: z.strictObject({
    id: blockId,
    type: z.literal("skills"),
    title: line(60, "Title"),
    items: z.array(required(30, "Skill")).min(1, "Add at least one item").max(30, "Up to 30 items"),
    variant: z.enum(["tags", "list", "bars"]),
  }),
  stats: z.strictObject({
    id: blockId,
    type: z.literal("stats"),
    items: z
      .array(z.strictObject({ value: required(12, "Value"), label: required(30, "Label") }))
      .min(1, "Add at least one figure")
      .max(4, "Up to 4 figures"),
  }),
  contact: z.strictObject({
    id: blockId,
    type: z.literal("contact"),
    title: line(60, "Title"),
    email: z.union([z.literal(""), z.email("Enter a valid email address").max(254)]),
    phone: z.string().max(32).refine((v) => v === "" || /^\+?[0-9().\- ]{3,32}$/.test(v), "Enter a valid phone number"),
    location: line(80, "Location"),
    website: optionalLink,
  }),
  countdown: z.strictObject({
    id: blockId,
    type: z.literal("countdown"),
    title: required(80, "Title"),
    target: z.iso.datetime({ offset: true, message: "Choose a date and time" }),
    doneText: line(80, "Finished text"),
  }),
  marquee: z.strictObject({
    id: blockId,
    type: z.literal("marquee"),
    text: required(80, "Text"),
    speed: z.enum(["slow", "normal", "fast"]),
  }),
  faq: z.strictObject({
    id: blockId,
    type: z.literal("faq"),
    title: line(80, "Title"),
    items: z.array(z.strictObject({ q: required(160, "Question"), a: required(1000, "Answer") })).min(1, "Add at least one question").max(20, "Up to 20 questions"),
  }),
  callout: z.strictObject({
    id: blockId,
    type: z.literal("callout"),
    tone: z.enum(["accent", "quiet", "sticky"]),
    title: required(80, "Title"),
    body: line(400, "Body"),
    linkLabel: line(40, "Button label"),
    linkUrl: optionalLink,
  }),
  clock: z.strictObject({
    id: blockId,
    type: z.literal("clock"),
    title: line(40, "Label"),
    timeZone: z.string().max(64).refine(isTimeZone, "Choose a valid time zone"),
    hour12: z.boolean(),
    showDate: z.boolean(),
  }),
  code: z.strictObject({
    id: blockId,
    type: z.literal("code"),
    title: required(60, "Section name"),
    // Runs only inside a sandboxed, opaque-origin frame (/sandbox). Never injected into Resonant's own pages.
    html: z.string().max(CODE_MAX, `HTML can be at most ${CODE_MAX} characters`),
    css: z.string().max(CODE_MAX, `CSS can be at most ${CODE_MAX} characters`),
    js: z.string().max(CODE_MAX, `JavaScript can be at most ${CODE_MAX} characters`),
    height: z.enum(["auto", "fixed"]),
    fixedHeight: z.number().int().min(120).max(1600),
  }),
  divider: z.strictObject({
    id: blockId,
    type: z.literal("divider"),
    style: z.enum(["line", "space", "wave", "dots", "zigzag"]),
  }),
} as const;

export const blockSchema = z.discriminatedUnion("type", [
  blockSchemas.intro, blockSchemas.cover, blockSchemas.heading, blockSchemas.link, blockSchemas.buttons,
  blockSchemas.socials, blockSchemas.tabs, blockSchemas.text, blockSchemas.quote, blockSchemas.image,
  blockSchemas.gallery, blockSchemas.video, blockSchemas.audio, blockSchemas.projects, blockSchemas.timeline,
  blockSchemas.skills, blockSchemas.stats, blockSchemas.contact, blockSchemas.countdown, blockSchemas.marquee,
  blockSchemas.faq, blockSchemas.callout, blockSchemas.clock, blockSchemas.code, blockSchemas.divider,
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

export const themeSchema = z.strictObject({
  preset: z.enum(PRESET_IDS),
  accent: z.enum(ACCENT_IDS),
  font: z.enum(FONT_IDS),
  radius: z.enum(RADIUS_IDS),
  buttons: z.enum(BUTTON_STYLES),
  layout: z.enum(LAYOUTS),
  background: z.strictObject({
    kind: z.enum(["preset", "image"]),
    preset: z.enum(BACKDROP_IDS),
    media: mediaRef,
    dim: z.number().int().min(0).max(90),
    blur: z.number().int().min(0).max(24),
  }),
  effects: z.strictObject({
    glass: z.boolean(),
    parallax: z.boolean(),
    entrance: z.enum(ENTRANCES),
    hover: z.enum(HOVERS),
    nameStyle: z.enum(NAME_STYLES),
    overlay: z.enum(OVERLAYS),
    resonance: z.boolean(),
    animateBackground: z.boolean(),
    tilt: z.boolean(),
    card: z.enum(CARD_EFFECTS),
  }),
}) satisfies z.ZodType<ThemeSettings>;

const pageSchema = z.strictObject({
  id: blockId,
  slug: z.string().regex(PAGE_SLUG_PATTERN, "Page addresses use lowercase letters, numbers and dashes (up to 32)"),
  title: required(40, "Page name"),
  blocks: z.array(blockSchema).max(MAX_BLOCKS, `A page can hold up to ${MAX_BLOCKS} blocks`),
});

export const navSchema = z.strictObject({
  mode: z.enum(["tabs", "stack"]),
  homeLabel: required(40, "Home page name"),
});

export const musicSchema = z.strictObject({
  source: z.enum(["none", "upload", "url"]),
  media: mediaRef,
  url: z.string().refine((v) => v === "" || isSafeAudioUrl(v), "Song link must be a full https:// address of an audio file"),
  title: line(80, "Song title"),
  enterText: line(60, "Enter-screen text"),
  volume: z.number().int().min(0).max(100),
});

export const documentSchema = z
  .strictObject({
    version: z.literal(DOCUMENT_VERSION),
    theme: themeSchema,
    seo: z.strictObject({ title: line(70, "Page title"), description: line(160, "Page description") }),
    blocks: z.array(blockSchema).max(MAX_BLOCKS, `A page can hold up to ${MAX_BLOCKS} blocks`),
    pages: z.array(pageSchema).max(MAX_PAGES, `A site can have up to ${MAX_PAGES} extra pages`),
    nav: navSchema,
    music: musicSchema,
  })
  .superRefine((doc, ctx) => {
    // Block (and page) ids are unique across the whole site.
    const seen = new Set<string>();
    doc.blocks.forEach((b, i) => {
      if (seen.has(b.id)) ctx.addIssue({ code: "custom", path: ["blocks", i, "id"], message: "Duplicate block id" });
      seen.add(b.id);
    });
    const slugs = new Set<string>();
    doc.pages.forEach((p, pi) => {
      if (seen.has(p.id)) ctx.addIssue({ code: "custom", path: ["pages", pi, "id"], message: "Duplicate page id" });
      seen.add(p.id);
      if (slugs.has(p.slug)) ctx.addIssue({ code: "custom", path: ["pages", pi, "slug"], message: `Two pages use the address "${p.slug}"` });
      slugs.add(p.slug);
      p.blocks.forEach((b, i) => {
        if (seen.has(b.id)) ctx.addIssue({ code: "custom", path: ["pages", pi, "blocks", i, "id"], message: "Duplicate block id" });
        seen.add(b.id);
      });
    });
    if (doc.music.source === "upload" && !doc.music.media) {
      ctx.addIssue({ code: "custom", path: ["music", "media"], message: "Upload a song or turn music off" });
    }
    if (doc.music.source === "url" && !doc.music.url) {
      ctx.addIssue({ code: "custom", path: ["music", "url"], message: "Paste a song link or turn music off" });
    }
    if (doc.theme.background.kind === "image" && !doc.theme.background.media) {
      ctx.addIssue({ code: "custom", path: ["theme", "background", "media"], message: "Upload a background image or choose a built-in background" });
    }
  });

export type ProfileDocument = z.infer<typeof documentSchema>;

/** Every block on every page of the site. */
export function allBlocks(doc: ProfileDocument): Block[] {
  return [...doc.blocks, ...doc.pages.flatMap((p) => p.blocks)];
}

/** Image media ids referenced by a document (for ownership and type checks on save). */
export function referencedMedia(doc: ProfileDocument): string[] {
  const ids = new Set<string>();
  if (doc.theme.background.media) ids.add(doc.theme.background.media);
  for (const b of allBlocks(doc)) {
    if (b.type === "intro" && b.avatar) ids.add(b.avatar);
    if ((b.type === "image" || b.type === "cover") && b.media) ids.add(b.media);
    if (b.type === "gallery") b.items.forEach((i) => ids.add(i.media));
    if (b.type === "projects") b.items.forEach((i) => i.media && ids.add(i.media));
  }
  return [...ids];
}

/** Audio media id referenced by a document's music player, if any. */
export function referencedAudio(doc: ProfileDocument): string | null {
  return doc.music.source === "upload" ? doc.music.media : null;
}

type IssueDoc = { blocks?: { type?: string }[]; pages?: { title?: string; blocks?: { type?: string }[] }[] };

/** Flatten zod issues to "Block #n: message" strings suitable for display. */
export function describeIssues(error: z.ZodError, doc?: IssueDoc): string[] {
  const label = (type: string | undefined) => (type && type in BLOCK_REGISTRY ? BLOCK_REGISTRY[type as BlockType].label : "Block");
  return error.issues.slice(0, 12).map((issue) => {
    const [root, index, sub, subIndex] = issue.path;
    if (root === "blocks" && typeof index === "number") {
      return `${label(doc?.blocks?.[index]?.type)} #${index + 1}: ${issue.message}`;
    }
    if (root === "pages" && typeof index === "number") {
      const page = doc?.pages?.[index];
      const name = page?.title?.trim() ? `"${page.title.trim()}" page` : `Page ${index + 2}`;
      if (sub === "blocks" && typeof subIndex === "number") {
        return `${name}, ${label(page?.blocks?.[subIndex]?.type)} #${subIndex + 1}: ${issue.message}`;
      }
      return `${name}: ${issue.message}`;
    }
    return issue.message;
  });
}
