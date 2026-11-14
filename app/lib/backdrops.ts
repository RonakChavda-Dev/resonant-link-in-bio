// Built-in procedural backgrounds. Each is a CSS `background` value written
// here in source (never user input) and mostly expressed through the theme's
// CSS variables, so a backdrop follows the chosen palette and accent.

export type BackdropGroup = "Subtle" | "Atmosphere" | "Patterns" | "Gradients" | "Vivid" | "Paper";

export interface Backdrop {
  label: string;
  group: BackdropGroup;
  css: string;
  /** Optional animation applied when the theme allows animated backgrounds. */
  anim?: "drift" | "pan" | "sweep" | "spin" | "pulse";
  /**
   * For "pan": the end background-position, one entry per layer. Each offset
   * must be a whole multiple of that layer's tile size so the loop is seamless;
   * use "0 0" for a layer that should stay still (e.g. a glow).
   */
  pan?: string;
  size?: string;
}

const svg = (markup: string) => `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
const mix = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`;
const A = "var(--rp-accent)";
const T = "var(--rp-text)";
const B = "var(--rp-bg)";

const topo = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'><g fill='none' stroke='#888' stroke-opacity='.28' stroke-width='1'><path d='M0 60c40-20 80 20 120 0s80-20 120 0'/><path d='M0 100c40-25 80 25 120 0s80-25 120 0'/><path d='M0 140c40-15 80 15 120 0s80-15 120 0'/><path d='M0 180c40-28 80 28 120 0s80-28 120 0'/><path d='M0 220c40-18 80 18 120 0s80-18 120 0'/><path d='M0 20c40-12 80 12 120 0s80-12 120 0'/></g></svg>`,
);
const waves = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40' viewBox='0 0 120 40'><path d='M0 20 Q15 5 30 20 T60 20 T90 20 T120 20' fill='none' stroke='#888' stroke-opacity='.3' stroke-width='1.4'/></svg>`,
);
const crosses = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><path d='M20 15v10M15 20h10' stroke='#888' stroke-opacity='.35' stroke-width='1.2'/></svg>`,
);
const grain = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 .2 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
);
const arrows = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='#fff' stroke-opacity='.16' stroke-width='6' stroke-linecap='square'><path d='M22 52 52 22M30 22h22v22'/><path d='M98 68 68 98M90 98H68V76'/></g></svg>`,
);

export const BACKDROPS = {
  none: { label: "Solid", group: "Subtle", css: "none" },
  glow: { label: "Glow", group: "Subtle", css: `radial-gradient(60% 40% at 50% -5%, ${mix(A, 24)}, transparent 70%), radial-gradient(40% 30% at 85% 15%, ${mix(A, 9)}, transparent 70%)` },
  spotlight: { label: "Spotlight", group: "Subtle", css: `radial-gradient(45% 55% at 50% 0%, ${mix(T, 14)}, transparent 75%)` },
  halo: { label: "Halo", group: "Subtle", css: `radial-gradient(circle at 50% 7rem, ${mix(A, 30)} 0 3.5rem, ${mix(A, 10)} 7rem, transparent 18rem)`, anim: "pulse" },
  rings: { label: "Rings", group: "Subtle", css: `repeating-radial-gradient(circle at 50% 7rem, transparent 0 46px, ${mix(T, 10)} 46px 47px)` },
  grain: { label: "Grain", group: "Subtle", css: `${grain}, radial-gradient(70% 50% at 30% 0%, ${mix(A, 14)}, transparent 70%)` },

  // Atmosphere: grain plus soft, out-of-focus light — reads like a blurred photo rather than a gradient.
  haze: { label: "Haze", group: "Atmosphere", css: `${grain}, radial-gradient(55% 45% at 15% 100%, ${mix(A, 26)}, transparent 70%), radial-gradient(50% 40% at 90% 0%, ${mix(T, 9)}, transparent 70%)` },
  lowlight: { label: "Lowlight", group: "Atmosphere", css: `${grain}, radial-gradient(38% 26% at 50% 22%, ${mix(A, 22)}, transparent 75%), linear-gradient(transparent 55%, ${mix("#000", 35)})`, anim: "pulse" },
  window: { label: "Window light", group: "Atmosphere", css: `${grain}, linear-gradient(115deg, transparent 20%, ${mix(T, 7)} 28%, transparent 36%, transparent 44%, ${mix(T, 5)} 50%, transparent 58%), radial-gradient(70% 50% at 100% 0%, ${mix(A, 16)}, transparent 70%)` },
  ember: { label: "Ember light", group: "Atmosphere", css: `${grain}, radial-gradient(60% 35% at 50% 105%, ${mix("#d9773a", 34)}, transparent 70%), radial-gradient(40% 30% at 10% 10%, ${mix(A, 10)}, transparent 70%)` },
  smoke: { label: "Smoke", group: "Atmosphere", css: `${grain}, radial-gradient(45% 30% at 25% 30%, ${mix(T, 8)}, transparent 70%), radial-gradient(40% 35% at 80% 65%, ${mix(T, 6)}, transparent 70%), radial-gradient(50% 30% at 40% 95%, ${mix(A, 12)}, transparent 70%)`, anim: "drift" },

  grid: { label: "Grid", group: "Patterns", css: `linear-gradient(${mix(T, 9)} 1px, transparent 1px), linear-gradient(90deg, ${mix(T, 9)} 1px, transparent 1px)`, size: "32px 32px" },
  dots: { label: "Dots", group: "Patterns", css: `radial-gradient(${mix(T, 22)} 1.2px, transparent 1.6px)`, size: "22px 22px" },
  crosses: { label: "Crosses", group: "Patterns", css: crosses, size: "40px 40px" },
  stripes: { label: "Stripes", group: "Patterns", css: `repeating-linear-gradient(135deg, ${mix(T, 6)} 0 2px, transparent 2px 18px)` },
  checker: { label: "Checker", group: "Patterns", css: `conic-gradient(${mix(T, 7)} 25%, transparent 0 50%, ${mix(T, 7)} 0 75%, transparent 0)`, size: "48px 48px" },
  topography: { label: "Topography", group: "Patterns", css: topo, size: "240px 240px", anim: "pan", pan: "480px 240px" },
  waves: { label: "Waves", group: "Patterns", css: waves, size: "120px 40px", anim: "pan", pan: "600px 280px" },
  arrows: { label: "Arrows", group: "Patterns", css: `${arrows}, linear-gradient(${mix(A, 18)}, transparent 60%)`, size: "120px 120px, auto" },

  ruled: {
    label: "Notebook (ruled)",
    group: "Paper",
    css: `linear-gradient(90deg, transparent 2.6rem, ${mix("#e5484d", 55)} 2.6rem 2.7rem, transparent 2.7rem), repeating-linear-gradient(${B} 0 1.9rem, ${mix("#3b82f6", 28)} 1.9rem calc(1.9rem + 1px))`,
  },
  graph: { label: "Graph paper", group: "Paper", css: `linear-gradient(${mix("#3b82f6", 18)} 1px, transparent 1px), linear-gradient(90deg, ${mix("#3b82f6", 18)} 1px, transparent 1px), linear-gradient(${mix("#3b82f6", 9)} 1px, transparent 1px), linear-gradient(90deg, ${mix("#3b82f6", 9)} 1px, transparent 1px)`, size: "80px 80px, 80px 80px, 16px 16px, 16px 16px" },
  dotgrid: { label: "Dot journal", group: "Paper", css: `radial-gradient(${mix(T, 30)} 1px, transparent 1.4px)`, size: "18px 18px" },
  kraft: { label: "Kraft", group: "Paper", css: `${grain}, linear-gradient(${mix("#b07a3c", 22)}, ${mix("#b07a3c", 22)})` },

  aurora: {
    label: "Aurora",
    group: "Gradients",
    css: `radial-gradient(40% 50% at 20% 20%, ${mix(A, 45)}, transparent 70%), radial-gradient(35% 45% at 80% 10%, ${mix("#7c5cff", 40)}, transparent 70%), radial-gradient(45% 40% at 60% 70%, ${mix("#18c6c9", 30)}, transparent 70%)`,
    anim: "drift",
  },
  sunset: { label: "Sunset mesh", group: "Gradients", css: `radial-gradient(60% 60% at 0% 0%, ${mix("#ff7a1a", 55)}, transparent 70%), radial-gradient(60% 60% at 100% 10%, ${mix("#ff3d8b", 45)}, transparent 70%), radial-gradient(70% 60% at 50% 100%, ${mix("#ffd23f", 40)}, transparent 70%)`, anim: "drift" },
  ocean: { label: "Ocean mesh", group: "Gradients", css: `radial-gradient(60% 60% at 10% 0%, ${mix("#2b6cff", 50)}, transparent 70%), radial-gradient(60% 60% at 90% 20%, ${mix("#18c6c9", 45)}, transparent 70%), radial-gradient(70% 60% at 50% 100%, ${mix("#6a3df0", 35)}, transparent 70%)`, anim: "drift" },
  candy: { label: "Candy mesh", group: "Gradients", css: `radial-gradient(55% 55% at 15% 10%, ${mix("#ff8fd0", 60)}, transparent 70%), radial-gradient(55% 55% at 85% 15%, ${mix("#a99bff", 55)}, transparent 70%), radial-gradient(60% 55% at 50% 95%, ${mix("#7ee0a6", 45)}, transparent 70%)`, anim: "drift" },
  forest: { label: "Forest mesh", group: "Gradients", css: `radial-gradient(60% 60% at 0% 0%, ${mix("#1f9d55", 50)}, transparent 70%), radial-gradient(60% 50% at 100% 30%, ${mix("#c4f04a", 30)}, transparent 70%), radial-gradient(70% 60% at 40% 100%, ${mix("#0f5132", 45)}, transparent 70%)`, anim: "drift" },
  dusk: { label: "Dusk", group: "Gradients", css: `linear-gradient(180deg, ${mix("#6a3df0", 35)} 0%, ${mix("#ff3d8b", 25)} 45%, transparent 85%)` },
  duotone: { label: "Duotone", group: "Gradients", css: `linear-gradient(160deg, ${mix(A, 40)} 0%, transparent 60%)` },
  horizon: { label: "Horizon", group: "Gradients", css: `radial-gradient(120% 60% at 50% 110%, ${mix(A, 55)}, transparent 60%)` },
  conic: { label: "Conic burst", group: "Gradients", css: `conic-gradient(from 200deg at 50% 0%, transparent, ${mix(A, 35)}, transparent 30%, ${mix("#7c5cff", 30)}, transparent 60%)`, anim: "spin" },

  holographic: {
    label: "Holographic",
    group: "Vivid",
    css: `linear-gradient(115deg, ${mix("#ff9bd2", 55)}, ${mix("#a0e9ff", 55)} 25%, ${mix("#d4ffa1", 50)} 45%, ${mix("#ffe49b", 55)} 65%, ${mix("#c7a6ff", 55)} 85%)`,
    size: "300% 300%",
    anim: "sweep",
  },
  lava: { label: "Lava", group: "Vivid", css: `radial-gradient(30% 35% at 25% 30%, ${mix("#ff5a1f", 70)}, transparent 70%), radial-gradient(30% 35% at 75% 60%, ${mix("#ff2d55", 60)}, transparent 70%), radial-gradient(25% 30% at 50% 90%, ${mix("#ffb21f", 60)}, transparent 70%)`, anim: "drift" },
  neon: { label: "Neon grid", group: "Vivid", css: `linear-gradient(transparent 60%, ${mix("#ff3df0", 30)}), repeating-linear-gradient(90deg, ${mix("#3df0ff", 22)} 0 1px, transparent 1px 48px), repeating-linear-gradient(${mix("#3df0ff", 16)} 0 1px, transparent 1px 48px)` },
  electric: { label: "Electric", group: "Vivid", css: `linear-gradient(135deg, ${mix("#2b4fe0", 75)}, ${mix("#6a3df0", 55)} 60%, ${mix("#18c6c9", 45)})`, size: "200% 200%", anim: "sweep" },
  starfield: { label: "Starfield", group: "Vivid", css: `radial-gradient(1px 1px at 20% 30%, ${T}, transparent), radial-gradient(1px 1px at 70% 15%, ${T}, transparent), radial-gradient(1.5px 1.5px at 40% 80%, ${T}, transparent), radial-gradient(1px 1px at 85% 60%, ${T}, transparent), radial-gradient(1px 1px at 10% 70%, ${T}, transparent), radial-gradient(1.5px 1.5px at 55% 45%, ${T}, transparent), radial-gradient(60% 40% at 50% 0%, ${mix(A, 22)}, transparent 70%)`, size: "260px 260px, 260px 260px, 260px 260px, 260px 260px, 260px 260px, 260px 260px, auto", anim: "pan", pan: "520px 260px, 520px 260px, 520px 260px, 520px 260px, 520px 260px, 520px 260px, 0 0" },
  confetti: { label: "Confetti", group: "Vivid", css: `radial-gradient(${mix("#ff8fd0", 70)} 2px, transparent 2.5px), radial-gradient(${mix("#6cb8ff", 70)} 2px, transparent 2.5px), radial-gradient(${mix("#ffbe4d", 70)} 2px, transparent 2.5px)`, size: "70px 70px, 90px 90px, 110px 110px" },
} as const satisfies Record<string, Backdrop>;

export type BackdropId = keyof typeof BACKDROPS;
export const BACKDROP_IDS = Object.keys(BACKDROPS) as [BackdropId, ...BackdropId[]];
export const BACKDROP_GROUPS: BackdropGroup[] = ["Subtle", "Atmosphere", "Patterns", "Paper", "Gradients", "Vivid"];
