// The component library shown in the editor: ready-made presets built from
// the block registry. Each preset is a block type + variant + starter content.
// Adding a preset is data-only; the renderer and schema stay unchanged.
import { BLOCK_REGISTRY, newBlockId, type BlockCategory } from "./block-registry";
import type { Block, BlockOf, BlockType } from "./blocks";
import { CODE_STARTERS, type CodeStarterId } from "./code-starters";

export interface ComponentPreset {
  id: string;
  label: string;
  category: BlockCategory;
  type: BlockType;
  keywords: string;
  create(): Block;
}

function preset<T extends BlockType>(
  id: string,
  label: string,
  type: T,
  patch: Partial<Omit<BlockOf<T>, "id" | "type">> = {},
  keywords = "",
): ComponentPreset {
  return {
    id,
    label,
    type,
    category: BLOCK_REGISTRY[type].category,
    keywords: `${label} ${BLOCK_REGISTRY[type].label} ${keywords}`.toLowerCase(),
    create: () => ({ ...BLOCK_REGISTRY[type].create(), ...structuredClone(patch), id: newBlockId() }) as Block,
  };
}

const ex = (p: string) => `https://example.com/${p}`;
const starter = (id: CodeStarterId) => ({ html: CODE_STARTERS[id].html, css: CODE_STARTERS[id].css, js: CODE_STARTERS[id].js });

export const COMPONENTS: ComponentPreset[] = [
  // Profile
  preset("intro-classic", "Intro — centred", "intro"),
  preset("intro-left", "Intro — left aligned", "intro", { align: "left" }),
  preset("intro-hero", "Intro — big name", "intro", { variant: "hero", align: "left" }, "hero headline"),
  preset("intro-card", "Intro — profile card", "intro", { variant: "card" }, "card"),
  preset("intro-badge", "Intro — with availability badge", "intro", { badge: "Available for work" }, "status hire"),
  preset("intro-square", "Intro — square avatar", "intro", { avatarShape: "rounded" }),
  preset("intro-text", "Intro — no avatar", "intro", { avatarShape: "none", variant: "hero" }),
  preset("cover-holo", "Cover — holographic", "cover", { backdrop: "holographic" }, "banner"),
  preset("cover-aurora", "Cover — aurora, tall", "cover", { backdrop: "aurora", height: "tall" }, "banner"),
  preset("cover-electric", "Cover — electric arrows", "cover", { backdrop: "arrows" }, "banner"),
  preset("cover-sunset", "Cover — sunset with title", "cover", { backdrop: "sunset", title: "Studio" }, "banner"),
  preset("cover-photo", "Cover — your photo", "cover", { backdrop: "none" }, "banner image upload"),
  preset("contact-full", "Contact card", "contact", { location: "Your city", website: ex("") }),
  preset("contact-email", "Contact — email only", "contact", { title: "Say hello" }),

  // Links
  preset("link-default", "Link", "link"),
  preset("link-feature", "Featured link", "link", { label: "Latest release", variant: "feature" }, "highlight"),
  preset("link-card", "Link card with note", "link", { label: "Read my newsletter", note: "A short letter every Sunday", variant: "card" }),
  preset("link-minimal", "Minimal text link", "link", { label: "More about me", variant: "minimal" }),
  preset("link-icon", "Link with platform label", "link", { label: "Watch on YouTube", url: "https://www.youtube.com/", variant: "icon" }),
  preset("link-email", "Email button", "link", { label: "Email me", url: "mailto:hello@example.com", variant: "feature" }, "mail contact"),
  preset("link-phone", "Call button", "link", { label: "Call the studio", url: "tel:+10000000000" }, "phone"),
  preset("link-book", "Book a call", "link", { label: "Book a call", note: "20 minutes, free", url: ex("book"), variant: "feature" }, "calendar booking"),
  preset("link-cv", "Download CV", "link", { label: "Download my CV", url: ex("cv.pdf"), variant: "card", note: "PDF" }, "resume"),
  preset("link-shop", "Shop link", "link", { label: "Visit the shop", url: ex("shop") }, "store"),
  preset("link-newsletter", "Newsletter", "link", { label: "Join the newsletter", url: ex("newsletter"), variant: "card", note: "One email a month" }),
  preset("link-support", "Support my work", "link", { label: "Support my work", url: ex("support"), variant: "feature" }, "tip donate"),
  preset("link-portfolio", "Full portfolio", "link", { label: "See the full portfolio", url: ex("portfolio") }),
  preset("buttons-two", "Two buttons", "buttons"),
  preset("buttons-three", "Three buttons", "buttons", { items: [{ label: "Work", url: ex("work") }, { label: "About", url: ex("about") }, { label: "Contact", url: "mailto:hello@example.com" }] }),
  preset("buttons-stack", "Stacked buttons", "buttons", { variant: "stack" }),
  preset("socials-icons", "Social icons", "socials", { variant: "icons" }, "instagram tiktok youtube github"),
  preset("socials-pills", "Social pills", "socials", { variant: "pills" }),
  preset("socials-list", "Social list", "socials", { variant: "list" }),
  preset("tabs-two", "Link tabs — two", "tabs", {}, "categories"),
  preset("tabs-three", "Link tabs — three", "tabs", {
    tabs: [
      { label: "Hobbies", links: [{ label: "Photography notes", url: ex("photos") }] },
      { label: "Career", links: [{ label: "CV", url: ex("cv") }] },
      { label: "Bookmarks", links: [{ label: "Tools I use", url: ex("tools") }] },
    ],
  }, "categories"),

  // Text
  preset("heading-label", "Heading — small label", "heading"),
  preset("heading-title", "Heading — title", "heading", { text: "About me", variant: "title" }),
  preset("heading-display", "Heading — display", "heading", { text: "Selected work", variant: "display" }),
  preset("heading-hand", "Heading — handwritten", "heading", { text: "notes to self", variant: "handwritten" }, "script"),
  preset("text-plain", "Paragraph", "text"),
  preset("text-lead", "Lead paragraph", "text", { body: "I make things for the web and write about how they work.", variant: "lead" }),
  preset("text-note", "Notebook note", "text", { body: "Currently reading, learning and making…", variant: "note" }, "paper journal"),
  preset("text-centered", "Centred text", "text", { variant: "centered" }),
  preset("quote-large", "Quote — large", "quote"),
  preset("quote-card", "Quote — card", "quote", { variant: "card", cite: "A favourite teacher" }),
  preset("faq-one", "FAQ — one question", "faq"),
  preset("faq-three", "FAQ — three questions", "faq", {
    items: [
      { q: "Are you taking new work?", a: "Write a short answer here." },
      { q: "What's your process?", a: "Write a short answer here." },
      { q: "How do I get in touch?", a: "Write a short answer here." },
    ],
  }),
  preset("callout-accent", "Callout — accent", "callout"),
  preset("callout-quiet", "Callout — quiet", "callout", { tone: "quiet" }),
  preset("callout-sticky", "Sticky note", "callout", { tone: "sticky", title: "Note to visitors", body: "Leave a short message here." }, "post-it notebook"),
  preset("callout-booking", "Callout — bookings open", "callout", { title: "Bookings open", body: "A few dates left this season.", linkLabel: "Request a date", linkUrl: "mailto:hello@example.com" }),
  preset("callout-release", "Callout — new release", "callout", { title: "Something new is out", body: "Tell people what changed.", linkLabel: "Take a look", linkUrl: ex("new") }),

  // Media
  preset("image-landscape", "Image — landscape", "image"),
  preset("image-square", "Image — square", "image", { shape: "square" }),
  preset("image-portrait", "Image — portrait", "image", { shape: "portrait" }),
  preset("image-wide", "Image — wide", "image", { shape: "wide" }),
  preset("gallery-2", "Gallery — two columns", "gallery"),
  preset("gallery-3", "Gallery — three columns", "gallery", { columns: 3 }),
  preset("gallery-carousel", "Gallery — carousel", "gallery", { variant: "carousel" }, "slider swipe"),
  preset("gallery-polaroid", "Gallery — polaroids", "gallery", { variant: "polaroid" }, "scrapbook"),
  preset("video", "Video", "video", {}, "youtube vimeo"),
  preset("audio-spotify", "Spotify", "audio", {}, "music podcast"),
  preset("audio-soundcloud", "SoundCloud", "audio", { url: "https://soundcloud.com/example/track", title: "Listen on SoundCloud" }, "music"),

  // Portfolio
  preset("projects-cards", "Project cards", "projects"),
  preset("projects-list", "Project list", "projects", { variant: "list", columns: 1 }),
  preset("projects-feature", "Featured project", "projects", { variant: "feature", columns: 1, items: [{ title: "Flagship project", description: "Tell the story of your best work.", media: null, url: "", tag: "Case study" }] }),
  preset("projects-one", "Projects — single column", "projects", { columns: 1 }),
  preset("timeline-work", "Experience timeline", "timeline", {}, "cv resume career"),
  preset("timeline-edu", "Education", "timeline", { title: "Education", items: [{ period: "2018 — 2021", title: "Your degree", place: "Your school", description: "" }] }),
  preset("timeline-milestones", "Milestones", "timeline", { title: "Milestones", items: [{ period: "2025", title: "A moment worth marking", place: "", description: "" }] }),
  preset("skills-tags", "Skills — tags", "skills"),
  preset("skills-list", "Skills — list", "skills", { variant: "list" }),
  preset("skills-bars", "Skills — columns", "skills", { variant: "bars", title: "What I do" }),
  preset("skills-into", "Currently into", "skills", { title: "Currently into", items: ["Film photography", "Sourdough", "Long walks"] }, "interests hobbies"),
  preset("stats-two", "Highlights — two", "stats"),
  preset("stats-three", "Highlights — three", "stats", { items: [{ value: "12", label: "Years" }, { value: "80+", label: "Clients" }, { value: "3", label: "Countries" }] }),
  preset("stats-four", "Highlights — four", "stats", { items: [{ value: "4", label: "Books" }, { value: "26", label: "Talks" }, { value: "9", label: "Awards" }, { value: "1", label: "Cat" }] }),

  // Layout
  preset("countdown-launch", "Countdown — launch", "countdown"),
  preset("countdown-event", "Countdown — event", "countdown", { title: "Next show starts in", doneText: "We're live." }),
  preset("marquee-slow", "Marquee — slow", "marquee", { speed: "slow" }),
  preset("marquee-normal", "Marquee — announcement", "marquee", { text: "New work every week" }),
  preset("marquee-fast", "Marquee — fast", "marquee", { text: "Now booking", speed: "fast" }),
  preset("divider-line", "Divider — line", "divider"),
  preset("divider-wave", "Divider — resonance wave", "divider", { style: "wave" }),
  preset("divider-dots", "Divider — dots", "divider", { style: "dots" }),
  preset("divider-zigzag", "Divider — zigzag", "divider", { style: "zigzag" }),
  preset("divider-space", "Spacer", "divider", { style: "space" }),

  // Clock & labelled socials
  preset("clock-local", "Clock — my local time", "clock", { title: "My time" }, "time timezone"),
  preset("clock-24", "Clock — 24-hour, time only", "clock", { title: "", hour12: false, showDate: false }, "time timezone"),
  preset("socials-labelled", "Social links — custom labels", "socials", { variant: "list", items: [{ url: "mailto:hello@example.com", label: "Email me?" }, { url: "https://example.com/", label: "My website" }] }, "discord github spotify labels"),

  // Code
  preset("code-reveal", "Custom code — scroll reveal", "code", { title: "Scroll reveal" }, "html css javascript js animation"),
  preset("code-gradient", "Custom code — gradient headline", "code", { title: "Gradient headline", ...starter("gradient") }, "html css animation"),
  preset("code-typewriter", "Custom code — typewriter", "code", { title: "Typewriter", ...starter("typewriter") }, "html css javascript"),
  preset("code-parallax", "Custom code — parallax layers", "code", { title: "Parallax", ...starter("parallax") }, "scroll javascript"),
  preset("code-counter", "Custom code — count-up numbers", "code", { title: "Count-up", ...starter("counter") }, "javascript stats"),
  preset("code-blank", "Custom code — blank", "code", { title: "Custom section", html: "", css: "", js: "" }, "html css javascript empty"),

  // More portfolio & personal presets
  preset("link-podcast", "Podcast link", "link", { label: "Listen to the podcast", url: ex("podcast"), variant: "card", note: "New episodes weekly" }),
  preset("link-events", "Upcoming events", "link", { label: "See upcoming events", url: ex("events") }, "calendar"),
  preset("link-code", "View my code", "link", { label: "View my code", url: "https://github.com/", variant: "icon" }, "developer"),
  preset("buttons-contact", "Contact buttons", "buttons", { items: [{ label: "Email", url: "mailto:hello@example.com" }, { label: "Call", url: "tel:+10000000000" }, { label: "Book", url: ex("book") }] }),
  preset("heading-hello", "Hello headline", "heading", { text: "Hello!", variant: "display" }, "greeting"),
  preset("text-about", "About me paragraph", "text", { body: "A few sentences about who you are, what you do and what you care about.", variant: "lead" }, "bio"),
  preset("callout-todo", "To-do sticky note", "callout", { tone: "sticky", title: "on my list", body: "☐ finish the zine\n☐ learn to bind books\n☐ write back to everyone" }, "notebook list"),
  preset("callout-available", "Availability note", "callout", { tone: "quiet", title: "Currently available", body: "Taking on a small number of projects from next month.", linkLabel: "Start a conversation", linkUrl: "mailto:hello@example.com" }),
  preset("image-captioned", "Image with caption", "image", { shape: "portrait", caption: "A caption for this photo" }),
  preset("timeline-awards", "Awards & recognition", "timeline", { title: "Recognition", items: [{ period: "2025", title: "An award or feature", place: "Who gave it", description: "" }] }),
  preset("skills-languages", "Languages I speak", "skills", { title: "Languages", items: ["English", "Español"], variant: "list" }),
  preset("skills-tools", "Tools I use", "skills", { title: "Tools", items: ["Figma", "Notion", "Procreate"], variant: "bars" }),
  preset("stats-one", "One big number", "stats", { items: [{ value: "100+", label: "Things made this year" }] }),
  preset("tabs-four", "Link tabs — four", "tabs", {
    tabs: [
      { label: "Work", links: [{ label: "Portfolio", url: ex("work") }] },
      { label: "Writing", links: [{ label: "Blog", url: ex("blog") }] },
      { label: "Shop", links: [{ label: "Prints", url: ex("prints") }] },
      { label: "About", links: [{ label: "CV", url: ex("cv") }] },
    ],
  }),
];

export const COMPONENT_COUNT = COMPONENTS.length;

export function findComponent(id: string): ComponentPreset | undefined {
  return COMPONENTS.find((c) => c.id === id);
}
