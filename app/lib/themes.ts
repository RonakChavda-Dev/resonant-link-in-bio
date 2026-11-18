// Theme tokens. Creators choose from constrained presets and options — never
// arbitrary CSS — so every combination stays legible and safe to render.
import { BACKDROP_IDS, type BackdropId } from "./backdrops";

export interface Palette {
  label: string;
  /** "dark" or "light" governs focus ring and subtle overlays. */
  tone: "dark" | "light";
  bg: string;
  surface: string;
  surfaceHover: string;
  text: string;
  muted: string;
  border: string;
  defaultAccent: AccentId;
}

export const PRESETS = {
  // Dark
  obsidian: { label: "Obsidian", tone: "dark", bg: "#0b0c0b", surface: "#151716", surfaceHover: "#1c1f1d", text: "#eef0ea", muted: "#9aa19b", border: "rgba(255,255,255,0.09)", defaultAccent: "lime" },
  midnight: { label: "Midnight", tone: "dark", bg: "#0d0f1a", surface: "#161a2a", surfaceHover: "#1d2236", text: "#e9ebf5", muted: "#9aa0bb", border: "rgba(255,255,255,0.09)", defaultAccent: "violet" },
  moss: { label: "Moss", tone: "dark", bg: "#0e1410", surface: "#16201a", surfaceHover: "#1c2a21", text: "#e8efe8", muted: "#93a597", border: "rgba(220,255,225,0.10)", defaultAccent: "mint" },
  graphite: { label: "Graphite", tone: "dark", bg: "#18191b", surface: "#222326", surfaceHover: "#2a2b2f", text: "#f1f1f2", muted: "#a2a3a8", border: "rgba(255,255,255,0.10)", defaultAccent: "amber" },
  lagoon: { label: "Lagoon", tone: "dark", bg: "#061416", surface: "#0c2124", surfaceHover: "#112b2f", text: "#e6f3f2", muted: "#8fb0ad", border: "rgba(190,255,250,0.11)", defaultAccent: "cyan" },
  ember: { label: "Ember", tone: "dark", bg: "#2a1206", surface: "#3a1b0b", surfaceHover: "#46220f", text: "#fff1e6", muted: "#e0b597", border: "rgba(255,220,190,0.16)", defaultAccent: "amber" },
  cobalt: { label: "Cobalt", tone: "dark", bg: "#0a1240", surface: "#121d5a", surfaceHover: "#18246a", text: "#eef1ff", muted: "#a9b3e8", border: "rgba(200,210,255,0.16)", defaultAccent: "lime" },
  plum: { label: "Plum", tone: "dark", bg: "#1a0b1f", surface: "#26112d", surfaceHover: "#30163a", text: "#f8ecfb", muted: "#c3a2cc", border: "rgba(255,210,255,0.12)", defaultAccent: "pink" },
  oxblood: { label: "Oxblood", tone: "dark", bg: "#1c0708", surface: "#2a0d0f", surfaceHover: "#361215", text: "#fdeceb", muted: "#d19f9c", border: "rgba(255,200,200,0.12)", defaultAccent: "coral" },
  deepsea: { label: "Deep sea", tone: "dark", bg: "#04111f", surface: "#0a1d33", surfaceHover: "#0f2640", text: "#e5f1ff", muted: "#8eaacb", border: "rgba(180,215,255,0.12)", defaultAccent: "sky" },
  forest: { label: "Forest", tone: "dark", bg: "#07160f", surface: "#0e241a", surfaceHover: "#133022", text: "#e9f7ee", muted: "#90b79f", border: "rgba(190,255,215,0.11)", defaultAccent: "lime" },
  ultraviolet: { label: "Ultraviolet", tone: "dark", bg: "#12082e", surface: "#1d1046", surfaceHover: "#261656", text: "#f1ecff", muted: "#b1a4e6", border: "rgba(210,195,255,0.15)", defaultAccent: "cyan" },
  // Dark, muted: warm and cool near-blacks for quieter, photographic pages.
  ash: { label: "Ash", tone: "dark", bg: "#111110", surface: "#1a1a19", surfaceHover: "#222220", text: "#ecebe6", muted: "#8f8d86", border: "rgba(236,235,230,0.09)", defaultAccent: "bone" },
  cocoa: { label: "Cocoa", tone: "dark", bg: "#16110e", surface: "#201915", surfaceHover: "#2a211c", text: "#f2e9e0", muted: "#a8968a", border: "rgba(242,233,224,0.10)", defaultAccent: "sand" },
  dusk: { label: "Dusk", tone: "dark", bg: "#131218", surface: "#1c1a23", surfaceHover: "#25222e", text: "#ece9f1", muted: "#9893a6", border: "rgba(236,233,241,0.10)", defaultAccent: "mauve" },
  pine: { label: "Pine", tone: "dark", bg: "#0e1311", surface: "#161e1a", surfaceHover: "#1e2823", text: "#e4ebe6", muted: "#8d9c93", border: "rgba(228,235,230,0.10)", defaultAccent: "sage" },
  harbour: { label: "Harbour", tone: "dark", bg: "#0d1015", surface: "#161a21", surfaceHover: "#1e232c", text: "#e6eaf0", muted: "#8b94a1", border: "rgba(230,234,240,0.10)", defaultAccent: "slate" },
  // Light
  chalk: { label: "Chalk", tone: "light", bg: "#f4f4f0", surface: "#ffffff", surfaceHover: "#ecece6", text: "#141513", muted: "#5d615c", border: "rgba(20,21,19,0.12)", defaultAccent: "ink" },
  paper: { label: "Paper", tone: "light", bg: "#f3ede2", surface: "#fbf8f2", surfaceHover: "#ebe3d4", text: "#231d15", muted: "#6b5f4f", border: "rgba(35,29,21,0.14)", defaultAccent: "coral" },
  blush: { label: "Blush", tone: "light", bg: "#f6e9e6", surface: "#fdf6f4", surfaceHover: "#f0dcd7", text: "#2b1616", muted: "#775a57", border: "rgba(43,22,22,0.13)", defaultAccent: "cobalt" },
  limelight: { label: "Limelight", tone: "light", bg: "#f2f3ee", surface: "#ffffff", surfaceHover: "#e8eae0", text: "#101110", muted: "#5b5f58", border: "rgba(16,17,16,0.12)", defaultAccent: "lime" },
  lilac: { label: "Lilac", tone: "light", bg: "#efeafd", surface: "#faf8ff", surfaceHover: "#e4dcfb", text: "#1b1238", muted: "#655b86", border: "rgba(27,18,56,0.12)", defaultAccent: "violetDeep" },
  sky: { label: "Sky", tone: "light", bg: "#e8f2fd", surface: "#f7fbff", surfaceHover: "#d9e9fb", text: "#0b1b30", muted: "#506483", border: "rgba(11,27,48,0.12)", defaultAccent: "cobalt" },
  peach: { label: "Peach", tone: "light", bg: "#fdebdc", surface: "#fff7f0", surfaceHover: "#f9dcc4", text: "#2c1608", muted: "#80604a", border: "rgba(44,22,8,0.12)", defaultAccent: "orange" },
  mint: { label: "Mint", tone: "light", bg: "#e5f6ee", surface: "#f6fdf9", surfaceHover: "#d3efe2", text: "#0a2318", muted: "#4e7262", border: "rgba(10,35,24,0.12)", defaultAccent: "emerald" },
  lemon: { label: "Lemon", tone: "light", bg: "#fbf6d6", surface: "#fffdf0", surfaceHover: "#f4ecbf", text: "#24200a", muted: "#6f6845", border: "rgba(36,32,10,0.13)", defaultAccent: "ink" },
  bubblegum: { label: "Bubblegum", tone: "light", bg: "#fde6f1", surface: "#fff6fa", surfaceHover: "#f9d2e5", text: "#2e0a1d", muted: "#86506b", border: "rgba(46,10,29,0.12)", defaultAccent: "pinkDeep" },
  // Light, muted: paper, clay and stone.
  bone: { label: "Bone", tone: "light", bg: "#eeeae3", surface: "#f8f6f1", surfaceHover: "#e5e0d6", text: "#1f1c18", muted: "#6c655b", border: "rgba(31,28,24,0.12)", defaultAccent: "smoke" },
  clay: { label: "Clay", tone: "light", bg: "#e9ddd0", surface: "#f5ede4", surfaceHover: "#e0d1c1", text: "#2a1e16", muted: "#776353", border: "rgba(42,30,22,0.13)", defaultAccent: "rust" },
  stone: { label: "Stone", tone: "light", bg: "#e4e6e3", surface: "#f2f3f1", surfaceHover: "#d9dcd8", text: "#1a1d1b", muted: "#5f6661", border: "rgba(26,29,27,0.12)", defaultAccent: "moss" },
} as const satisfies Record<string, Palette>;

export type PresetId = keyof typeof PRESETS;
export const PRESET_IDS = Object.keys(PRESETS) as [PresetId, ...PresetId[]];

/** Accent colour plus the ink colour that keeps text on it at WCAG AA contrast. */
export const ACCENTS = {
  lime: { label: "Lime", color: "#c4f04a", ink: "#0b0c0b" },
  mint: { label: "Mint", color: "#7ee0a6", ink: "#08140d" },
  emerald: { label: "Emerald", color: "#0f8a5f", ink: "#ffffff" },
  cyan: { label: "Cyan", color: "#4fd6e0", ink: "#041416" },
  sky: { label: "Sky", color: "#6cb8ff", ink: "#04121f" },
  cobalt: { label: "Cobalt", color: "#2b4fe0", ink: "#ffffff" },
  violet: { label: "Violet", color: "#a99bff", ink: "#120d2a" },
  violetDeep: { label: "Iris", color: "#6a3df0", ink: "#ffffff" },
  pink: { label: "Pink", color: "#ff8fd0", ink: "#2a0619" },
  pinkDeep: { label: "Magenta", color: "#d61f7f", ink: "#ffffff" },
  coral: { label: "Coral", color: "#c8452f", ink: "#ffffff" },
  orange: { label: "Orange", color: "#ff7a1a", ink: "#1f0c00" },
  amber: { label: "Amber", color: "#ffbe4d", ink: "#1f1300" },
  ink: { label: "Ink", color: "#141513", ink: "#f4f4f0" },
  // Muted, natural tones.
  bone: { label: "Bone", color: "#e6e0d4", ink: "#1a1714" },
  sand: { label: "Sand", color: "#d6b88e", ink: "#1f1609" },
  rose: { label: "Dusty rose", color: "#d4a19c", ink: "#2a1210" },
  sage: { label: "Sage", color: "#a9bd9f", ink: "#121a0e" },
  slate: { label: "Slate", color: "#a3b4c8", ink: "#0d1520" },
  mauve: { label: "Mauve", color: "#b9a0c0", ink: "#1d1222" },
  rust: { label: "Rust", color: "#a9532f", ink: "#ffffff" },
  moss: { label: "Moss", color: "#4f6645", ink: "#ffffff" },
  smoke: { label: "Smoke", color: "#383735", ink: "#f2f0eb" },
} as const;

export type AccentId = keyof typeof ACCENTS;
export const ACCENT_IDS = Object.keys(ACCENTS) as [AccentId, ...AccentId[]];

const GEIST = "'Geist Variable', ui-sans-serif, system-ui, sans-serif";
export const FONTS = {
  sans: { label: "Geist", display: GEIST, body: GEIST, weight: 650 },
  editorial: { label: "Instrument Serif", display: "'Instrument Serif', ui-serif, Georgia, serif", body: GEIST, weight: 400 },
  grotesk: { label: "Space Grotesk", display: "'Space Grotesk Variable', ui-sans-serif, sans-serif", body: "'Space Grotesk Variable', ui-sans-serif, sans-serif", weight: 650 },
  bricolage: { label: "Bricolage", display: "'Bricolage Grotesque Variable', ui-sans-serif, sans-serif", body: GEIST, weight: 720 },
  condensed: { label: "Anton", display: "'Anton', Impact, ui-sans-serif, sans-serif", body: GEIST, weight: 400 },
  fraunces: { label: "Fraunces", display: "'Fraunces Variable', ui-serif, Georgia, serif", body: GEIST, weight: 600 },
  playfair: { label: "Playfair", display: "'Playfair Display Variable', ui-serif, Georgia, serif", body: GEIST, weight: 650 },
  syne: { label: "Syne", display: "'Syne Variable', ui-sans-serif, sans-serif", body: GEIST, weight: 760 },
  unbounded: { label: "Unbounded", display: "'Unbounded Variable', ui-sans-serif, sans-serif", body: GEIST, weight: 600 },
  handwritten: { label: "Caveat", display: "'Caveat Variable', 'Comic Sans MS', cursive", body: GEIST, weight: 650 },
  mono: { label: "Mono", display: "'Geist Mono Variable', ui-monospace, monospace", body: "'Geist Mono Variable', ui-monospace, monospace", weight: 600 },
  system: { label: "System", display: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif", body: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif", weight: 650 },
} as const;
export type FontId = keyof typeof FONTS;
export const FONT_IDS = Object.keys(FONTS) as [FontId, ...FontId[]];

export const RADII = { sharp: "2px", soft: "12px", round: "999px" } as const;
export type RadiusId = keyof typeof RADII;
export const RADIUS_IDS = Object.keys(RADII) as [RadiusId, ...RadiusId[]];

export const BUTTON_STYLES = ["soft", "solid", "outline", "glass", "brutal", "gradient", "minimal", "neon"] as const;
export type ButtonStyle = (typeof BUTTON_STYLES)[number];
export const BUTTON_LABELS: Record<ButtonStyle, string> = {
  soft: "Soft", solid: "Solid", outline: "Outline", glass: "Glass", brutal: "Brutal", gradient: "Gradient", minimal: "Minimal", neon: "Neon",
};

export const LAYOUTS = ["stack", "editorial", "split", "panel", "card"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const ENTRANCES = ["none", "fade", "rise", "scale", "blur", "slide"] as const;
export const HOVERS = ["lift", "glow", "shine", "press", "fill", "none"] as const;
export const NAME_STYLES = ["plain", "gradient", "shimmer", "outline", "marker", "shadow", "glow"] as const;
export const OVERLAYS = ["none", "grain", "vignette", "scanlines", "stars", "spotlight"] as const;
/** Per-card hover effects (links, projects, callouts, stats, media…). See profile.css "Card effects". */
export const CARD_EFFECTS = ["none", "tilt", "glare", "holo", "depth", "magnetic", "spotlight", "border", "float", "lean", "swing"] as const;
export const CARD_EFFECT_LABELS: Record<(typeof CARD_EFFECTS)[number], { label: string; hint: string }> = {
  none: { label: "None", hint: "Cards stay still." },
  tilt: { label: "3D tilt", hint: "Each card tilts in 3D towards the cursor." },
  glare: { label: "Tilt + glare", hint: "3D tilt with a light sheen that follows the cursor." },
  holo: { label: "Holographic", hint: "3D tilt with a shifting rainbow foil." },
  depth: { label: "Depth", hint: "The card tilts and its contents float forward." },
  magnetic: { label: "Magnetic", hint: "Cards drift towards the cursor." },
  spotlight: { label: "Spotlight", hint: "A soft light follows the cursor across the card." },
  border: { label: "Glow border", hint: "The card's edge lights up near the cursor." },
  float: { label: "Float", hint: "Cards rise with a soft shadow on hover." },
  lean: { label: "Lean back", hint: "Cards tip back in 3D on hover." },
  swing: { label: "Swing", hint: "Cards swing slightly, like hanging from a pin." },
};

export interface BackgroundSettings {
  kind: "preset" | "image";
  preset: BackdropId;
  /** Uploaded image (kind "image"). */
  media: string | null;
  /** 0–90: darkens (or lightens on light palettes) an image for legibility. */
  dim: number;
  /** 0–24 px blur applied to the image. */
  blur: number;
}

export interface EffectSettings {
  /** Frosted-glass cards (backdrop blur). */
  glass: boolean;
  /** Background drifts slower than content while scrolling. */
  parallax: boolean;
  entrance: (typeof ENTRANCES)[number];
  hover: (typeof HOVERS)[number];
  nameStyle: (typeof NAME_STYLES)[number];
  overlay: (typeof OVERLAYS)[number];
  /** The signature pulse rings around the avatar and moving wave dividers. */
  resonance: boolean;
  /** Animate the backdrop itself where the preset supports it. */
  animateBackground: boolean;
  /** The page panel tilts in 3D towards the visitor's pointer. */
  tilt: boolean;
  /** Hover effect applied to each card on the page. */
  card: (typeof CARD_EFFECTS)[number];
}

export interface ThemeSettings {
  preset: PresetId;
  accent: AccentId;
  font: FontId;
  radius: RadiusId;
  buttons: ButtonStyle;
  layout: Layout;
  background: BackgroundSettings;
  effects: EffectSettings;
}

export const DEFAULT_EFFECTS: EffectSettings = {
  glass: false,
  parallax: false,
  entrance: "rise",
  hover: "lift",
  nameStyle: "plain",
  overlay: "none",
  resonance: true,
  animateBackground: true,
  tilt: false,
  card: "none",
};

export const DEFAULT_THEME: ThemeSettings = {
  preset: "obsidian",
  accent: "lime",
  font: "sans",
  radius: "soft",
  buttons: "soft",
  layout: "stack",
  background: { kind: "preset", preset: "glow", media: null, dim: 40, blur: 0 },
  effects: DEFAULT_EFFECTS,
};

export { BACKDROP_IDS };

/** CSS custom properties consumed by the profile stylesheet (.rp). */
export function themeVars(theme: ThemeSettings): Record<string, string> {
  const p = PRESETS[theme.preset];
  const a = ACCENTS[theme.accent];
  const f = FONTS[theme.font];
  return {
    "--rp-bg": p.bg,
    "--rp-surface": p.surface,
    "--rp-surface-hover": p.surfaceHover,
    "--rp-text": p.text,
    "--rp-muted": p.muted,
    "--rp-border": p.border,
    "--rp-accent": a.color,
    "--rp-accent-ink": a.ink,
    "--rp-radius": RADII[theme.radius],
    "--rp-font-display": f.display,
    "--rp-font-body": f.body,
    "--rp-display-weight": String(f.weight),
  };
}
