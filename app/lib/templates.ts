// Template catalog: data only. A template is a *base design* (a distinct block
// composition + typography + layout + effects) offered in several *colourways*
// (palette, accent, backdrop and effect changes). The shared renderer draws
// all of them. Counts shown in the UI are computed from this file.
// All copy is sample content for fictional people; links are example.com.
import { DEFAULT_MUSIC, DEFAULT_NAV, DOCUMENT_VERSION, newBlockId } from "./block-registry";
import type { Block, ProfileDocument } from "./blocks";
import { ACCENTS, DEFAULT_EFFECTS, PRESETS, type AccentId, type EffectSettings, type PresetId, type ThemeSettings } from "./themes";
import type { BackdropId } from "./backdrops";

export const TEMPLATE_CATEGORIES = [
  { id: "creator", label: "Creators" },
  { id: "portfolio", label: "Portfolio" },
  { id: "personal", label: "Personal & notebook" },
  { id: "music", label: "Music & audio" },
  { id: "business", label: "Small business" },
  { id: "writing", label: "Writing" },
  { id: "minimal", label: "Minimal" },
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]["id"];

export const TEMPLATE_STYLES = ["glass", "animated", "notebook", "bold", "editorial", "minimal"] as const;
export type TemplateStyle = (typeof TEMPLATE_STYLES)[number];

export interface Template {
  /** `${baseId}-${colourwayId}` */
  id: string;
  baseId: string;
  name: string;
  colourway: string;
  category: TemplateCategory;
  styles: TemplateStyle[];
  summary: string;
  tone: "dark" | "light";
  swatch: [string, string];
  document: ProfileDocument;
}

export interface TemplateBase {
  id: string;
  name: string;
  category: TemplateCategory;
  styles: TemplateStyle[];
  summary: string;
  variants: Template[];
}

type BlockInput = Block extends infer B ? (B extends Block ? Omit<B, "id"> : never) : never;
type ThemePatch = Partial<Omit<ThemeSettings, "effects" | "background">> & { backdrop?: BackdropId; effects?: Partial<EffectSettings> };

interface Colourway extends ThemePatch {
  id: string;
  label: string;
  preset: PresetId;
  accent: AccentId;
}

interface BaseDef {
  id: string;
  name: string;
  category: TemplateCategory;
  styles: TemplateStyle[];
  summary: string;
  theme: Omit<ThemePatch, "preset" | "accent">;
  colourways: Colourway[];
  blocks: BlockInput[];
}

const ex = (path: string) => `https://example.com/${path}`;
const mail = (who = "hello") => `mailto:${who}@example.com`;
const FIXED_DATE = "2027-03-01T18:00:00Z";

type IntroExtra = Partial<Omit<Extract<Block, { type: "intro" }>, "id" | "type">>;
const intro = (name: string, tagline: string, extra: IntroExtra = {}): BlockInput => ({
  type: "intro", name, tagline, bio: "", avatar: null, align: "center", avatarShape: "circle", badge: "", variant: "classic", ...extra,
});
const link = (label: string, url: string, variant: Extract<Block, { type: "link" }>["variant"] = "default", note = ""): BlockInput => ({ type: "link", label, url, note, variant });
const heading = (text: string, variant: Extract<Block, { type: "heading" }>["variant"] = "label"): BlockInput => ({ type: "heading", text, variant });
const text = (body: string, variant: Extract<Block, { type: "text" }>["variant"] = "plain"): BlockInput => ({ type: "text", body, variant });
const divider = (style: Extract<Block, { type: "divider" }>["style"]): BlockInput => ({ type: "divider", style });
const socialRow = (variant: "icons" | "pills" | "list" = "icons"): BlockInput => ({ type: "socials", variant, items: [{ url: mail() }, { url: ex("") }] });
const clock = (title: string, timeZone: string): BlockInput => ({ type: "clock", title, timeZone, hour12: false, showDate: false });

// Copy guidelines: write like a real person would about themselves — specific,
// a little informal, no slogans. Colourways lean on muted palettes; a few bold
// ones stay for range.
const BASES: BaseDef[] = [
  // --- Profile cards (compact card on an atmospheric background) ----------------
  {
    id: "lowlight", name: "Lowlight", category: "creator", styles: ["glass", "minimal"],
    summary: "A small profile card on a dim, grainy background, with a soft glow on your name.",
    theme: { font: "sans", radius: "soft", buttons: "soft", layout: "card", backdrop: "lowlight", effects: { entrance: "fade", hover: "lift", nameStyle: "glow", resonance: false } },
    colourways: [
      { id: "ash", label: "Ash", preset: "ash", accent: "bone" },
      { id: "dusk", label: "Dusk", preset: "dusk", accent: "mauve" },
      { id: "pine", label: "Pine", preset: "pine", accent: "sage" },
      { id: "harbour", label: "Harbour", preset: "harbour", accent: "slate" },
      { id: "cocoa", label: "Cocoa", preset: "cocoa", accent: "sand" },
    ],
    blocks: [
      intro("mara", "she/they · draws on the train, mostly"),
      socialRow("icons"),
      link("sketchbook", ex("sketchbook"), "default", "updated whenever I fill a page"),
      link("commissions — 2 slots open", ex("commissions")),
      link("the playlist I draw to", ex("playlist")),
    ],
  },
  {
    id: "afterhours", name: "Afterhours", category: "creator", styles: ["glass", "minimal"],
    summary: "Monospace profile card over drifting smoke, with your local time and link groups.",
    theme: { font: "mono", radius: "soft", buttons: "soft", layout: "card", backdrop: "smoke", effects: { entrance: "fade", hover: "lift", resonance: false } },
    colourways: [
      { id: "ash", label: "Ash", preset: "ash", accent: "bone" },
      { id: "harbour", label: "Harbour", preset: "harbour", accent: "slate" },
      { id: "dusk", label: "Dusk", preset: "dusk", accent: "rose" },
      { id: "obsidian", label: "Black", preset: "obsidian", accent: "sage", backdrop: "haze" },
    ],
    blocks: [
      intro("nightjar", "streams tuesdays & fridays. bad at rhythm games, worse at sleeping.", { avatarShape: "rounded" }),
      clock("my time", "Europe/Lisbon"),
      { type: "tabs", tabs: [
        { label: "stream", links: [{ label: "watch live", url: ex("live") }, { label: "past streams", url: ex("vods") }] },
        { label: "community", links: [{ label: "the group chat", url: ex("chat") }] },
        { label: "setup", links: [{ label: "what I play on", url: ex("setup") }] },
      ] },
      socialRow("icons"),
    ],
  },
  {
    id: "darkroom", name: "Darkroom", category: "portfolio", styles: ["editorial", "minimal"],
    summary: "A serif profile card washed in window light — quiet and made for photographers.",
    theme: { font: "editorial", radius: "soft", buttons: "outline", layout: "card", backdrop: "window", effects: { entrance: "blur", hover: "fill", resonance: false } },
    colourways: [
      { id: "cocoa", label: "Cocoa", preset: "cocoa", accent: "sand" },
      { id: "ash", label: "Ash", preset: "ash", accent: "bone" },
      { id: "stone", label: "Stone", preset: "stone", accent: "smoke" },
      { id: "clay", label: "Clay", preset: "clay", accent: "rust" },
    ],
    blocks: [
      intro("Ilse Varga", "35mm, mostly black and white. Portraits of people who didn't want one."),
      divider("line"),
      link("Contact sheets", ex("contact-sheets")),
      link("Prints — small runs, signed", ex("prints")),
      link("Book a portrait", mail("ilse"), "default", "Saturdays, in the studio or your kitchen"),
    ],
  },
  {
    id: "ember-card", name: "Hearth", category: "personal", styles: ["glass"],
    summary: "Warm low light from below, a rounded card and a short note about you.",
    theme: { font: "bricolage", radius: "round", buttons: "soft", layout: "card", backdrop: "ember", effects: { entrance: "rise", hover: "lift", resonance: false } },
    colourways: [
      { id: "cocoa", label: "Cocoa", preset: "cocoa", accent: "sand" },
      { id: "ash", label: "Ash", preset: "ash", accent: "rose" },
      { id: "pine", label: "Pine", preset: "pine", accent: "sand" },
    ],
    blocks: [
      intro("Tomás Rhee", "home cook, bread obsessive, occasional dinner host"),
      text("I write down every recipe that works the second time. Most of them are here."),
      link("Recipes I actually make", ex("recipes")),
      link("Sourdough, start to finish", ex("sourdough"), "default", "a long post, sorry"),
      link("Supper club dates", ex("supper")),
      socialRow("icons"),
    ],
  },

  // --- Link stacks ------------------------------------------------------------
  {
    id: "signal", name: "Signal", category: "creator", styles: ["animated"],
    summary: "A dark stack of links with slow rings pulsing out from your initials.",
    theme: { font: "sans", radius: "soft", buttons: "soft", layout: "stack", backdrop: "rings", effects: { resonance: true, entrance: "rise", hover: "lift" } },
    colourways: [
      { id: "ash", label: "Ash", preset: "ash", accent: "bone" },
      { id: "dusk", label: "Dusk", preset: "dusk", accent: "mauve", backdrop: "halo" },
      { id: "harbour", label: "Harbour", preset: "harbour", accent: "slate" },
      { id: "lime", label: "Lime", preset: "obsidian", accent: "lime" },
      { id: "amber", label: "Amber", preset: "graphite", accent: "amber" },
    ],
    blocks: [
      intro("Rowan Vale", "I make videos about how ordinary things get made — pencils, bread, bridges."),
      link("Newest: where pencil lead comes from", ex("latest"), "default", "18 minutes"),
      link("Every video, oldest first", ex("archive")),
      link("Notes and sources", ex("notes")),
      link("Sponsorships and email", mail()),
      divider("wave"),
      socialRow("icons"),
    ],
  },
  {
    id: "categorized", name: "Shelves", category: "creator", styles: ["minimal"],
    summary: "Links sorted onto tabs — so the people who want your CV don't wade through your hobbies.",
    theme: { font: "sans", radius: "soft", buttons: "soft", layout: "stack", backdrop: "glow", effects: { entrance: "rise", hover: "lift", resonance: false } },
    colourways: [
      { id: "harbour", label: "Harbour", preset: "harbour", accent: "slate" },
      { id: "ash", label: "Ash", preset: "ash", accent: "sage" },
      { id: "midnight", label: "Midnight", preset: "midnight", accent: "sky" },
      { id: "dusk", label: "Dusk", preset: "dusk", accent: "rose" },
    ],
    blocks: [
      intro("Ronald Andersen", "Front-end developer in Aarhus. I like forms that don't fight you."),
      { type: "tabs", tabs: [
        { label: "Work", links: [{ label: "CV (PDF)", url: ex("cv") }, { label: "Things I've shipped", url: ex("shipped") }] },
        { label: "Off hours", links: [{ label: "Board game reviews", url: ex("games") }, { label: "Film photos", url: ex("photo") }] },
        { label: "Bookmarks", links: [{ label: "Tools I'd pay for again", url: ex("tools") }] },
      ] },
      socialRow("icons"),
    ],
  },
  {
    id: "halo", name: "Halo", category: "minimal", styles: ["minimal", "animated"],
    summary: "A soft halo behind your initials, two buttons and your profiles. Nothing else.",
    theme: { font: "sans", radius: "round", buttons: "soft", layout: "stack", backdrop: "halo", effects: { entrance: "scale", hover: "lift", resonance: false } },
    colourways: [
      { id: "ash", label: "Ash", preset: "ash", accent: "bone" },
      { id: "bone", label: "Bone", preset: "bone", accent: "rose" },
      { id: "dusk", label: "Dusk", preset: "dusk", accent: "mauve" },
      { id: "lagoon", label: "Lagoon", preset: "lagoon", accent: "cyan" },
    ],
    blocks: [
      intro("Noor Haddad", "Reading, making, recommending. Usually in that order."),
      { type: "buttons", variant: "row", items: [{ label: "What I'm making", url: ex("work") }, { label: "Say hi", url: mail() }] },
      socialRow("pills"),
    ],
  },
  {
    id: "plain", name: "Plain", category: "minimal", styles: ["minimal"],
    summary: "Just a name, a line and your links. No decoration.",
    theme: { font: "system", radius: "soft", buttons: "outline", layout: "stack", backdrop: "none", effects: { entrance: "none", hover: "none", resonance: false } },
    colourways: [
      { id: "chalk", label: "Chalk", preset: "chalk", accent: "ink" },
      { id: "black", label: "Black", preset: "ash", accent: "bone" },
      { id: "bone", label: "Bone", preset: "bone", accent: "smoke" },
      { id: "stone", label: "Stone", preset: "stone", accent: "moss" },
    ],
    blocks: [
      intro("Alex Kim", "Teacher. Runner. Slowly learning Korean."),
      link("Class resources", ex("class")),
      link("Race results (mostly mid-pack)", ex("races")),
      link("Email me", mail()),
    ],
  },

  // --- Paper & notebooks ----------------------------------------------------------
  {
    id: "notebook", name: "Notebook", category: "personal", styles: ["notebook"],
    summary: "Ruled paper, handwritten headings, a taped note and a sticky at the end.",
    theme: { font: "handwritten", radius: "sharp", buttons: "outline", layout: "stack", backdrop: "ruled", effects: { entrance: "fade", hover: "press", nameStyle: "marker", resonance: false } },
    colourways: [
      { id: "paper", label: "Paper", preset: "paper", accent: "coral" },
      { id: "lemon", label: "Lemon", preset: "lemon", accent: "amber" },
      { id: "mint", label: "Mint", preset: "mint", accent: "emerald" },
      { id: "bone", label: "Bone", preset: "bone", accent: "slate" },
      { id: "graph", label: "Graph", preset: "chalk", accent: "cobalt", backdrop: "graph" },
    ],
    blocks: [
      intro("Juniper Hale", "notes, sketches & things I'm learning", { avatarShape: "rounded", align: "left" }),
      text("Hi! This page is my notebook: half portfolio, half diary. Pull up a chair.", "note"),
      heading("currently", "handwritten"),
      { type: "skills", title: "", items: ["learning watercolour (badly)", "rereading Le Guin", "fixing a 1970s bike"], variant: "list" },
      heading("things I made", "handwritten"),
      link("Sketchbook scans", ex("sketchbook")),
      link("Zine #3 — Tiny gardens", ex("zine")),
      { type: "callout", tone: "sticky", title: "say hi", body: "Postcards welcome. Emails too.", linkLabel: "Write to me", linkUrl: mail() },
    ],
  },
  {
    id: "dot-journal", name: "Dot Journal", category: "personal", styles: ["notebook", "minimal"],
    summary: "A dotted journal page with a monospace log of your year.",
    theme: { font: "mono", radius: "sharp", buttons: "outline", layout: "stack", backdrop: "dotgrid", effects: { entrance: "slide", hover: "fill", resonance: false } },
    colourways: [
      { id: "chalk", label: "Chalk", preset: "chalk", accent: "ink" },
      { id: "paper", label: "Paper", preset: "paper", accent: "coral" },
      { id: "graphite", label: "Graphite", preset: "graphite", accent: "amber" },
      { id: "stone", label: "Stone", preset: "stone", accent: "moss" },
    ],
    blocks: [
      intro("sam.notes", "a running log of projects and small wins", { align: "left", avatarShape: "square" }),
      { type: "timeline", title: "2026 so far", items: [
        { period: "Jan", title: "Drew something every day (missed 4)", place: "", description: "" },
        { period: "Mar", title: "Shipped a tiny recipe app", place: "", description: "" },
        { period: "Jun", title: "First solo show", place: "Branch library, 2nd floor", description: "" },
      ] },
      { type: "skills", title: "Tools", items: ["Pencil", "Figma", "TypeScript", "Risograph"], variant: "tags" },
      link("Read the full log", ex("log"), "minimal"),
    ],
  },
  {
    id: "scrapbook", name: "Scrapbook", category: "personal", styles: ["notebook"],
    summary: "Kraft paper, a taped note and handwritten headings for a personal corner of the web.",
    theme: { font: "handwritten", radius: "sharp", buttons: "brutal", layout: "stack", backdrop: "kraft", effects: { entrance: "scale", hover: "press", resonance: false } },
    colourways: [
      { id: "kraft", label: "Kraft", preset: "paper", accent: "coral" },
      { id: "clay", label: "Clay", preset: "clay", accent: "rust" },
      { id: "lemon", label: "Lemon", preset: "lemon", accent: "orange", backdrop: "dotgrid" },
    ],
    blocks: [
      intro("Elio Marsh", "collector of small joys", { avatarShape: "rounded" }),
      { type: "callout", tone: "sticky", title: "this week", body: "Finished my first quilt. Started three more.", linkLabel: "", linkUrl: "" },
      heading("favourite things", "handwritten"),
      { type: "skills", title: "", items: ["quilting", "strong tea", "rainy walks", "radio plays"], variant: "tags" },
      { type: "quote", text: "Make it with your hands at least once.", cite: "my grandmother", variant: "card" },
      link("My craft blog", ex("blog")),
    ],
  },

  // --- Portfolio --------------------------------------------------------------------
  {
    id: "studio-notes", name: "Studio Notes", category: "portfolio", styles: ["editorial"],
    summary: "Light and editorial: a serif name, a short list of case studies and one way to reach you.",
    theme: { font: "editorial", radius: "sharp", buttons: "outline", layout: "editorial", backdrop: "none", effects: { entrance: "fade", hover: "fill", resonance: false } },
    colourways: [
      { id: "chalk", label: "Chalk", preset: "chalk", accent: "ink" },
      { id: "bone", label: "Bone", preset: "bone", accent: "smoke" },
      { id: "clay", label: "Clay", preset: "clay", accent: "rust" },
      { id: "blush", label: "Blush", preset: "blush", accent: "cobalt" },
    ],
    blocks: [
      intro("Ines Moreau", "Product designer, independent since 2019", { align: "left", bio: "Mostly booking systems, clinics and other software people use while stressed. Taking one new project in spring." }),
      heading("Selected work"),
      { type: "projects", title: "", variant: "list", columns: 1, items: [
        { title: "Rebooking a physio clinic", description: "Research, flows, UI", media: null, url: ex("work/booking"), tag: "Case study" },
        { title: "Field notes app", description: "iOS, small design system", media: null, url: ex("work/field"), tag: "Case study" },
      ] },
      heading("Contact"),
      link("Email the studio", mail("studio"), "feature"),
    ],
  },
  {
    id: "studio-card", name: "Studio Card", category: "portfolio", styles: ["minimal"],
    summary: "A grainy banner over a profile card, a few honest numbers and a contact card.",
    theme: { font: "sans", radius: "soft", buttons: "outline", layout: "stack", backdrop: "none", effects: { entrance: "rise", hover: "lift", resonance: false } },
    colourways: [
      { id: "bone", label: "Bone", preset: "bone", accent: "smoke" },
      { id: "stone", label: "Stone", preset: "stone", accent: "moss" },
      { id: "chalk", label: "Chalk", preset: "chalk", accent: "cobalt" },
      { id: "clay", label: "Clay", preset: "clay", accent: "rust" },
      { id: "ash", label: "Ash", preset: "ash", accent: "sand" },
    ],
    blocks: [
      { type: "cover", media: null, backdrop: "window", height: "short", title: "" },
      intro("Mina Park", "Design partner at Good Day Studio", { align: "left", bio: "I sit with early teams for a few months and help them decide what not to build." }),
      { type: "stats", items: [{ value: "8 yrs", label: "Designing products" }, { value: "40+", label: "Things launched" }, { value: "2", label: "Studios started" }] },
      link("Case studies", ex("work"), "card", "Fintech, health, a bakery"),
      { type: "contact", title: "Get in touch", email: "hello@example.com", phone: "", location: "Seoul, mostly", website: ex("") },
    ],
  },
  {
    id: "ember", name: "Ember", category: "portfolio", styles: ["editorial", "bold"],
    summary: "Warm, grainy colour with an oversized serif name, made for photographers.",
    theme: { font: "editorial", radius: "sharp", buttons: "soft", layout: "editorial", backdrop: "grain", effects: { entrance: "blur", hover: "fill", overlay: "vignette", resonance: false } },
    colourways: [
      { id: "amber", label: "Amber", preset: "ember", accent: "amber" },
      { id: "cocoa", label: "Cocoa", preset: "cocoa", accent: "sand" },
      { id: "oxblood", label: "Oxblood", preset: "oxblood", accent: "rose" },
      { id: "pine", label: "Pine", preset: "pine", accent: "sage" },
    ],
    blocks: [
      intro("Teo Alder", "Portrait and fashion photography", { align: "left", variant: "hero", avatarShape: "none", bio: "Natural light, strong colour, not much retouching. Between Porto and wherever the job is." }),
      divider("line"),
      link("Portfolio", ex("portfolio")),
      link("Editorial work", ex("editorial")),
      { type: "callout", tone: "quiet", title: "Booking autumn shoots", body: "A few dates left. Send a short brief and the days that work for you.", linkLabel: "Send a brief", linkUrl: mail("shoots") },
    ],
  },
  {
    id: "index", name: "Index", category: "portfolio", styles: ["minimal"],
    summary: "Monospace on a faint grid, with a note under each project. Built for developers.",
    theme: { font: "mono", radius: "sharp", buttons: "outline", layout: "stack", backdrop: "grid", effects: { entrance: "slide", hover: "fill", resonance: false } },
    colourways: [
      { id: "ash", label: "Ash", preset: "ash", accent: "bone" },
      { id: "amber", label: "Amber", preset: "graphite", accent: "amber" },
      { id: "harbour", label: "Harbour", preset: "harbour", accent: "slate" },
      { id: "paper", label: "Paper", preset: "chalk", accent: "ink" },
    ],
    blocks: [
      intro("kai.dev", "small tools for the web, mostly written on trains", { align: "left", avatarShape: "square" }),
      heading("Projects"),
      link("tiny-queue", ex("tiny-queue"), "default", "a 2 kB job queue for edge runtimes"),
      link("color-notes", ex("color-notes"), "default", "checks your palette against WCAG"),
      { type: "skills", title: "Stack", items: ["TypeScript", "Rust", "Postgres", "Workers"], variant: "tags" },
      { type: "faq", title: "FAQ", items: [{ q: "Available for contract work?", a: "Sometimes. Email me the scope and a rough timeline." }] },
    ],
  },
  {
    id: "case-study", name: "Case Study", category: "portfolio", styles: ["editorial"],
    summary: "Two columns on wide screens: a sticky intro beside a featured project and project cards.",
    theme: { font: "fraunces", radius: "soft", buttons: "solid", layout: "split", backdrop: "none", effects: { entrance: "rise", hover: "lift", resonance: false } },
    colourways: [
      { id: "bone", label: "Bone", preset: "bone", accent: "rust" },
      { id: "iris", label: "Iris", preset: "chalk", accent: "violetDeep" },
      { id: "ash", label: "Ash", preset: "ash", accent: "sand", backdrop: "haze" },
      { id: "sky", label: "Sky", preset: "sky", accent: "cobalt" },
    ],
    blocks: [
      intro("Priya Lane", "Product designer, accessibility first", { align: "left", badge: "Open to roles", bio: "Ten years on health and public-service software. I test with real people as early as I can." }),
      { type: "projects", title: "Featured", variant: "feature", columns: 1, items: [{ title: "Designing for one hand", description: "Rebuilding a clinic booking app for people holding a child, a bag or a cane.", media: null, url: ex("work/one-hand"), tag: "Case study" }] },
      { type: "projects", title: "More work", variant: "cards", columns: 2, items: [
        { title: "Contrast toolkit", description: "Open design tokens.", media: null, url: ex("work/contrast"), tag: "Tool" },
        { title: "Station signage", description: "A wayfinding study.", media: null, url: ex("work/signage"), tag: "Research" },
      ] },
      link("Download CV", ex("cv.pdf"), "card", "PDF, two pages"),
    ],
  },
  {
    id: "resume", name: "Résumé", category: "portfolio", styles: ["editorial", "minimal"],
    summary: "A whole CV on one page: experience, education, strengths and contact details.",
    theme: { font: "fraunces", radius: "sharp", buttons: "minimal", layout: "split", backdrop: "none", effects: { entrance: "fade", hover: "none", resonance: false } },
    colourways: [
      { id: "paper", label: "Paper", preset: "paper", accent: "coral" },
      { id: "bone", label: "Bone", preset: "bone", accent: "smoke" },
      { id: "stone", label: "Stone", preset: "stone", accent: "moss" },
      { id: "graphite", label: "Graphite", preset: "graphite", accent: "amber" },
    ],
    blocks: [
      intro("Daniel Okafor", "Operations lead · logistics & supply chain", { align: "left", avatarShape: "rounded" }),
      { type: "timeline", title: "Experience", items: [
        { period: "2022 — now", title: "Operations lead", place: "Harbour Freight Co.", description: "Twelve people across two depots. Cut late deliveries by a third." },
        { period: "2018 — 2022", title: "Planner", place: "Northline", description: "" },
      ] },
      { type: "timeline", title: "Education", items: [{ period: "2014 — 2018", title: "BSc Logistics", place: "City University", description: "" }] },
      { type: "skills", title: "Strengths", items: ["Planning", "Leading teams", "Forecasting", "Negotiation"], variant: "bars" },
      { type: "contact", title: "Contact", email: "daniel@example.com", phone: "", location: "Port city", website: "" },
    ],
  },

  // --- Bold -------------------------------------------------------------------------------
  {
    id: "poster", name: "Bold Poster", category: "creator", styles: ["bold"],
    summary: "Huge condensed type, chunky shadowed buttons and a scrolling line of text.",
    theme: { font: "condensed", radius: "round", buttons: "brutal", layout: "stack", backdrop: "none", effects: { entrance: "rise", hover: "press", resonance: false } },
    colourways: [
      { id: "bone", label: "Bone", preset: "bone", accent: "rust" },
      { id: "lime", label: "Lime", preset: "limelight", accent: "lime" },
      { id: "lemon", label: "Lemon", preset: "lemon", accent: "ink" },
      { id: "peach", label: "Peach", preset: "peach", accent: "orange" },
      { id: "black", label: "Black", preset: "ash", accent: "bone", backdrop: "dots" },
    ],
    blocks: [
      intro("Jesse Gold", "Strength coach. Lifts heavy things, explains why.", { variant: "hero" }),
      { type: "marquee", text: "New programme starts Monday", speed: "normal" },
      link("This week's video", ex("video"), "feature"),
      link("Free 4-week beginner plan", ex("plan")),
      link("The gear I actually use", ex("shop")),
      { type: "buttons", variant: "row", items: [{ label: "Email", url: mail() }, { label: "Website", url: ex("") }] },
    ],
  },
  {
    id: "electric", name: "Banner", category: "creator", styles: ["bold"],
    summary: "A bold patterned banner, a profile card and two big buttons.",
    theme: { font: "bricolage", radius: "soft", buttons: "solid", layout: "stack", backdrop: "glow", effects: { entrance: "scale", hover: "lift", resonance: false } },
    colourways: [
      { id: "cobalt", label: "Cobalt", preset: "cobalt", accent: "sand" },
      { id: "oxblood", label: "Oxblood", preset: "oxblood", accent: "rose" },
      { id: "forest", label: "Forest", preset: "forest", accent: "sage" },
      { id: "ash", label: "Ash", preset: "ash", accent: "bone" },
    ],
    blocks: [
      { type: "cover", media: null, backdrop: "arrows", height: "short", title: "" },
      intro("Lina Cho", "Type designer at Studio Else", { variant: "card" }),
      { type: "buttons", variant: "row", items: [{ label: "Hire me", url: mail() }, { label: "Typefaces", url: ex("work") }] },
      heading("Now"),
      link("Teaching a lettering workshop", ex("workshop"), "default", "Saturdays in March, 8 seats"),
      link("What I'm reading", ex("reading")),
      link("Process journal", ex("journal")),
    ],
  },
  {
    id: "confetti", name: "Confetti", category: "personal", styles: ["bold", "animated"],
    summary: "Confetti, rounded buttons and big friendly type — good for clubs, classes and events.",
    theme: { font: "bricolage", radius: "round", buttons: "solid", layout: "stack", backdrop: "confetti", effects: { entrance: "scale", hover: "lift", nameStyle: "shadow", resonance: false } },
    colourways: [
      { id: "bubblegum", label: "Bubblegum", preset: "bubblegum", accent: "pinkDeep" },
      { id: "lemon", label: "Lemon", preset: "lemon", accent: "orange" },
      { id: "sky", label: "Sky", preset: "sky", accent: "cobalt" },
      { id: "mint", label: "Mint", preset: "mint", accent: "emerald" },
    ],
    blocks: [
      intro("Room 14 Robotics", "We meet Thursdays after school. Snacks provided.", { badge: "Showcase in March" }),
      { type: "countdown", title: "Showcase day", target: FIXED_DATE, doneText: "See you there!" },
      link("Join the club", ex("join"), "feature"),
      link("Robots we've built (and broken)", ex("robots")),
      { type: "skills", title: "This term", items: ["Arduino", "3D printing", "Python"], variant: "tags" },
    ],
  },

  // --- Atmospheric & glass ---------------------------------------------------------
  {
    id: "glass-aurora", name: "Frosted", category: "creator", styles: ["glass", "animated"],
    summary: "Frosted cards over slowly moving colour, with link tabs and a short quote.",
    theme: { font: "grotesk", radius: "soft", buttons: "glass", layout: "stack", backdrop: "aurora", effects: { glass: true, parallax: true, entrance: "blur", hover: "lift" } },
    colourways: [
      { id: "ocean", label: "Ocean", preset: "deepsea", accent: "slate", backdrop: "ocean" },
      { id: "dusk", label: "Dusk", preset: "dusk", accent: "mauve", backdrop: "smoke" },
      { id: "forest", label: "Forest", preset: "forest", accent: "sage", backdrop: "forest" },
      { id: "aurora", label: "Aurora", preset: "obsidian", accent: "mint" },
    ],
    blocks: [
      intro("Aria Sol", "Creative coder. I stream while I build and take questions.", { variant: "card" }),
      { type: "tabs", tabs: [
        { label: "Streams", links: [{ label: "Live coding", url: ex("live") }, { label: "Replays", url: ex("replays") }] },
        { label: "Code", links: [{ label: "Open-source projects", url: ex("code") }] },
        { label: "Writing", links: [{ label: "Blog", url: ex("blog") }] },
      ] },
      { type: "quote", text: "Most of my best ideas started as bugs.", cite: "", variant: "card" },
      socialRow("pills"),
    ],
  },
  {
    id: "sunset-mesh", name: "Golden Hour", category: "personal", styles: ["glass", "animated"],
    summary: "Soft warm colour behind light glass cards — friendly, bright and personal.",
    theme: { font: "bricolage", radius: "round", buttons: "glass", layout: "stack", backdrop: "sunset", effects: { glass: true, entrance: "rise", hover: "lift", resonance: false } },
    colourways: [
      { id: "peach", label: "Peach", preset: "peach", accent: "orange" },
      { id: "clay", label: "Clay", preset: "clay", accent: "rust" },
      { id: "lilac", label: "Lilac", preset: "lilac", accent: "violetDeep", backdrop: "candy" },
      { id: "ocean", label: "Ocean", preset: "sky", accent: "cobalt", backdrop: "ocean" },
    ],
    blocks: [
      intro("Maya Lund", "I plan trips for friends and write up the good bits", { badge: "Next: Lisbon in May" }),
      { type: "skills", title: "", items: ["Train travel", "Film photos", "Cheap eats", "Maps"], variant: "tags" },
      link("My travel guides", ex("guides"), "card", "Free, honest, updated when I go back"),
      link("Photo diary", ex("photos")),
      link("Say hello", mail()),
    ],
  },
  {
    id: "starfield", name: "Starfield", category: "creator", styles: ["animated", "editorial"],
    summary: "A quiet night sky, a serif name and a countdown to your next release.",
    theme: { font: "playfair", radius: "round", buttons: "outline", layout: "stack", backdrop: "starfield", effects: { entrance: "blur", hover: "fill", overlay: "stars" } },
    colourways: [
      { id: "night", label: "Night", preset: "obsidian", accent: "sand" },
      { id: "harbour", label: "Harbour", preset: "harbour", accent: "slate" },
      { id: "dusk", label: "Dusk", preset: "dusk", accent: "mauve" },
      { id: "deepsea", label: "Deep sea", preset: "deepsea", accent: "sky" },
    ],
    blocks: [
      intro("Celeste Ray", "I draw very small planets and the people who live on them"),
      { type: "countdown", title: "New print series opens in", target: FIXED_DATE, doneText: "The shop is open." },
      link("Get a heads-up when it opens", ex("waitlist"), "feature"),
      link("Past series", ex("archive")),
      divider("dots"),
      { type: "quote", text: "Draw the thing you can't stop looking at.", cite: "", variant: "large" },
    ],
  },
  {
    id: "topo", name: "Topo", category: "personal", styles: ["minimal"],
    summary: "Contour lines and a milestones timeline for outdoorsy people.",
    theme: { font: "grotesk", radius: "soft", buttons: "outline", layout: "stack", backdrop: "topography", effects: { entrance: "rise", hover: "fill", resonance: false } },
    colourways: [
      { id: "pine", label: "Pine", preset: "pine", accent: "sage" },
      { id: "forest", label: "Forest", preset: "forest", accent: "lime" },
      { id: "stone", label: "Stone", preset: "stone", accent: "moss" },
      { id: "clay", label: "Clay", preset: "clay", accent: "rust" },
    ],
    blocks: [
      intro("Rafa Lindqvist", "Trail runner, amateur mapmaker, weekend guide", { align: "left" }),
      { type: "stats", items: [{ value: "38", label: "Peaks logged" }, { value: "4", label: "Ultras finished" }] },
      { type: "timeline", title: "Milestones", items: [
        { period: "2024", title: "First 100 km race (walked the last 20)", place: "", description: "" },
        { period: "2025", title: "Mapped a new trail above the reservoir", place: "", description: "" },
      ] },
      link("Trail guides", ex("guides")),
      link("Join a Sunday group run", ex("runs"), "feature"),
    ],
  },

  // --- Music & audio ---------------------------------------------------------------
  {
    id: "night-set", name: "Night Set", category: "music", styles: ["animated", "glass"],
    summary: "A dark sky, a featured mix, a countdown to the next show and a scrolling line.",
    theme: { font: "unbounded", radius: "round", buttons: "glass", layout: "stack", backdrop: "aurora", effects: { glass: true, entrance: "rise", hover: "lift" } },
    colourways: [
      { id: "violet", label: "Violet", preset: "midnight", accent: "violet" },
      { id: "dusk", label: "Dusk", preset: "dusk", accent: "rose", backdrop: "smoke" },
      { id: "harbour", label: "Harbour", preset: "harbour", accent: "slate", backdrop: "lowlight" },
      { id: "cyan", label: "Cyan", preset: "deepsea", accent: "cyan" },
    ],
    blocks: [
      intro("Halcyon", "House and ambient, played late and slow"),
      { type: "marquee", text: "New mix out now", speed: "slow" },
      { type: "video", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", title: "Featured set (sample video)" },
      { type: "countdown", title: "Next show starts in", target: FIXED_DATE, doneText: "We're on." },
      link("Fri — Warehouse 9", ex("dates/1"), "default", "Doors 22:00"),
      link("Booking enquiries", mail("booking"), "feature"),
    ],
  },
  {
    id: "synthwave", name: "Synthwave", category: "music", styles: ["animated", "bold"],
    summary: "A neon grid horizon and glowing outline buttons, for the retro-minded.",
    theme: { font: "unbounded", radius: "sharp", buttons: "neon", layout: "stack", backdrop: "neon", effects: { entrance: "scale", hover: "glow", nameStyle: "glow", overlay: "scanlines" } },
    colourways: [
      { id: "magenta", label: "Magenta", preset: "ultraviolet", accent: "pink" },
      { id: "cyan", label: "Cyan", preset: "midnight", accent: "cyan" },
      { id: "sunset", label: "Sunset", preset: "oxblood", accent: "orange" },
    ],
    blocks: [
      intro("NOVA RUSH", "Synth records made in a spare room"),
      { type: "audio", url: "https://open.spotify.com/track/0000000000000000000000", title: "Latest single (sample link)" },
      link("Tour dates", ex("tour")),
      link("Merch", ex("merch")),
      link("Press kit", ex("press")),
    ],
  },
  {
    id: "podcast", name: "Podcast", category: "music", styles: ["animated"],
    summary: "Episode player, listening links and show notes with a wave divider.",
    theme: { font: "syne", radius: "round", buttons: "soft", layout: "stack", backdrop: "rings", effects: { entrance: "rise", hover: "lift" } },
    colourways: [
      { id: "pine", label: "Pine", preset: "pine", accent: "sage" },
      { id: "moss", label: "Moss", preset: "moss", accent: "mint" },
      { id: "cocoa", label: "Cocoa", preset: "cocoa", accent: "sand" },
      { id: "ember", label: "Ember", preset: "ember", accent: "amber" },
    ],
    blocks: [
      intro("Undergrowth", "A podcast about the plants nobody planted", { avatarShape: "rounded" }),
      { type: "audio", url: "https://open.spotify.com/show/0000000000000000000000", title: "Latest episode (sample link)" },
      link("Listen in your podcast app", ex("listen"), "feature"),
      link("Episode notes and plant IDs", ex("notes")),
      divider("wave"),
      text("New episodes every other Wednesday. Recorded in a shed.", "centered"),
    ],
  },

  // --- Small business & writing ----------------------------------------------------
  {
    id: "storefront", name: "Storefront", category: "business", styles: ["minimal"],
    summary: "A featured shop link, a quick-action row and the questions people always ask.",
    theme: { font: "bricolage", radius: "round", buttons: "solid", layout: "stack", backdrop: "none", effects: { entrance: "rise", hover: "lift", resonance: false } },
    colourways: [
      { id: "clay", label: "Clay", preset: "clay", accent: "rust" },
      { id: "bone", label: "Bone", preset: "bone", accent: "moss" },
      { id: "blush", label: "Blush", preset: "blush", accent: "cobalt" },
      { id: "lemon", label: "Lemon", preset: "lemon", accent: "ink" },
    ],
    blocks: [
      intro("Little Kiln", "Mugs, bowls and the occasional vase, made by hand in a garage", { avatarShape: "rounded" }),
      link("Shop the spring batch", ex("shop"), "feature"),
      { type: "buttons", variant: "row", items: [{ label: "Custom orders", url: ex("custom") }, { label: "Studio visits", url: ex("visit") }] },
      { type: "faq", title: "Shop questions", items: [{ q: "How long does shipping take?", a: "Sample answer: orders leave the studio within five working days." }, { q: "Are pieces dishwasher safe?", a: "Sample answer: yes, though hand-washing keeps glazes brighter." }] },
    ],
  },
  {
    id: "coach", name: "Coach", category: "business", styles: ["glass"],
    summary: "A booking note up top, a few plain facts and answers before people book.",
    theme: { font: "grotesk", radius: "soft", buttons: "soft", layout: "stack", backdrop: "horizon", effects: { glass: true, entrance: "rise", hover: "lift", resonance: false } },
    colourways: [
      { id: "pine", label: "Pine", preset: "pine", accent: "sage" },
      { id: "lagoon", label: "Lagoon", preset: "lagoon", accent: "cyan" },
      { id: "harbour", label: "Harbour", preset: "harbour", accent: "slate" },
      { id: "sky", label: "Sky", preset: "sky", accent: "cobalt", backdrop: "ocean" },
    ],
    blocks: [
      intro("Sam Ortega", "Career coaching for designers and engineers who feel stuck"),
      { type: "callout", tone: "accent", title: "Free 20-minute intro call", body: "We talk about where you are. No pitch at the end, promise.", linkLabel: "Book a call", linkUrl: ex("book") },
      { type: "stats", items: [{ value: "1:1", label: "Sessions" }, { value: "6 wk", label: "Programme length" }] },
      link("Programmes", ex("programs")),
      { type: "faq", title: "Before you book", items: [{ q: "Who is this for?", a: "Sample answer: people two to ten years into a technical career." }] },
    ],
  },
  {
    id: "field-guide", name: "Field Guide", category: "writing", styles: ["editorial"],
    summary: "Paper tones and a generous reading width for newsletters and essays.",
    theme: { font: "playfair", radius: "soft", buttons: "solid", layout: "editorial", backdrop: "grain", effects: { entrance: "fade", hover: "lift", resonance: false } },
    colourways: [
      { id: "paper", label: "Paper", preset: "paper", accent: "coral" },
      { id: "bone", label: "Bone", preset: "bone", accent: "smoke" },
      { id: "stone", label: "Stone", preset: "stone", accent: "moss" },
      { id: "lilac", label: "Lilac", preset: "lilac", accent: "violetDeep" },
    ],
    blocks: [
      intro("The Field Guide", "A Sunday letter about walking, maps and small towns", { align: "left", avatarShape: "none" }),
      text("Each issue is one walk, one map and one question I couldn't stop thinking about. Free, and short enough for a coffee.", "lead"),
      link("Read the latest issue", ex("latest-issue"), "feature"),
      link("Browse the archive", ex("issues")),
      { type: "quote", text: "The best maps leave room for getting lost.", cite: "Issue 12", variant: "large" },
      { type: "callout", tone: "quiet", title: "Write in", body: "I read every reply. The best ones end up in the next letter.", linkLabel: "Send a note", linkUrl: mail("letters") },
    ],
  },
];

function buildTheme(base: BaseDef, cw: Colourway): ThemeSettings {
  return {
    preset: cw.preset,
    accent: cw.accent,
    font: cw.font ?? base.theme.font ?? "sans",
    radius: cw.radius ?? base.theme.radius ?? "soft",
    buttons: cw.buttons ?? base.theme.buttons ?? "soft",
    layout: cw.layout ?? base.theme.layout ?? "stack",
    background: { kind: "preset", preset: cw.backdrop ?? base.theme.backdrop ?? "none", media: null, dim: 40, blur: 0 },
    effects: { ...DEFAULT_EFFECTS, ...base.theme.effects, ...cw.effects },
  };
}

function buildDocument(base: BaseDef, cw: Colourway): ProfileDocument {
  return {
    version: DOCUMENT_VERSION,
    theme: buildTheme(base, cw),
    seo: { title: "", description: "" },
    // Stable ids keep server and client renders identical; they are re-issued on use.
    blocks: base.blocks.map((b, i) => ({ ...structuredClone(b), id: `tpl${String(i).padStart(4, "0")}` }) as Block),
    pages: [],
    nav: { ...DEFAULT_NAV },
    music: { ...DEFAULT_MUSIC },
  };
}

export const TEMPLATE_BASES: TemplateBase[] = BASES.map((base) => ({
  id: base.id,
  name: base.name,
  category: base.category,
  styles: base.styles,
  summary: base.summary,
  variants: base.colourways.map((cw) => {
    const palette = PRESETS[cw.preset];
    return {
      id: `${base.id}-${cw.id}`,
      baseId: base.id,
      name: base.name,
      colourway: cw.label,
      category: base.category,
      styles: base.styles,
      summary: base.summary,
      tone: palette.tone,
      swatch: [palette.bg, ACCENTS[cw.accent].color] as [string, string],
      document: buildDocument(base, cw),
    };
  }),
}));

export const TEMPLATES: Template[] = TEMPLATE_BASES.flatMap((b) => b.variants);
export const TEMPLATE_BASE_COUNT = TEMPLATE_BASES.length;
export const TEMPLATE_COUNT = TEMPLATES.length;

/** Accepts a variant id, or a base id (resolves to its first colourway). */
export function getTemplate(id: string | null | undefined): Template | undefined {
  if (!id) return undefined;
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATE_BASES.find((b) => b.id === id)?.variants[0];
}

export function getTemplateBase(baseId: string): TemplateBase | undefined {
  return TEMPLATE_BASES.find((b) => b.id === baseId);
}

/** Copy a template into a fresh document with new block ids. */
export function instantiateTemplate(template: Template, name?: string): ProfileDocument {
  const copy: ProfileDocument = structuredClone(template.document);
  copy.blocks = copy.blocks.map((b) => ({ ...b, id: newBlockId() }));
  if (name) {
    const first = copy.blocks.find((b) => b.type === "intro");
    if (first && first.type === "intro") first.name = name.slice(0, 60);
  }
  return copy;
}
