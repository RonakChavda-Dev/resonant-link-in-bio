// Starter snippets for the custom-code block. They run inside the sandbox
// (/sandbox), which adds `in-view` to any element with `data-reveal` as it
// scrolls into view and exposes `resonant.onViewport(cb)` for custom effects.

export interface CodeStarter {
  label: string;
  html: string;
  css: string;
  js: string;
}

export const CODE_STARTERS = {
  reveal: {
    label: "Scroll reveal cards",
    html: `<section class="wrap">
  <h2 data-reveal="blur">Made with my own code</h2>
  <p data-reveal="up">Every card below fades in as you scroll.</p>
  <div class="grid">
    <article data-reveal="up" style="--d:0ms">Idea</article>
    <article data-reveal="up" style="--d:120ms">Sketch</article>
    <article data-reveal="up" style="--d:240ms">Ship</article>
  </div>
</section>`,
    css: `.wrap { font-family: system-ui, sans-serif; color: #f2f2f2; padding: 24px 4px; }
h2 { font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; }
p { color: #a1a1aa; margin: 0 0 20px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
article {
  padding: 28px 12px; border-radius: 14px; text-align: center; font-weight: 600;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  transition-delay: var(--d);
}`,
    js: `// Elements with data-reveal animate automatically ("up", "blur", "zoom", "left", "right").
// Add your own scripts here.`,
  },
  gradient: {
    label: "Animated gradient headline",
    html: `<h1 class="glow">Hello, I'm you.</h1>
<p class="sub">Change this text in the HTML tab.</p>`,
    css: `body { font-family: system-ui, sans-serif; text-align: center; padding: 32px 8px; }
.glow {
  margin: 0; font-size: 44px; line-height: 1; letter-spacing: -0.04em; font-weight: 800;
  background: linear-gradient(90deg, #f472b6, #a78bfa, #38bdf8, #f472b6);
  background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: pan 6s linear infinite;
}
.sub { color: #a1a1aa; }
@keyframes pan { to { background-position: 300% 0; } }
@media (prefers-reduced-motion: reduce) { .glow { animation: none; } }`,
    js: ``,
  },
  typewriter: {
    label: "Typewriter intro",
    html: `<p class="type"><span id="out"></span><span class="caret">|</span></p>`,
    css: `body { font-family: ui-monospace, monospace; color: #e4e4e7; padding: 24px 6px; }
.type { font-size: 20px; }
.caret { animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }`,
    js: `const lines = ["I design things.", "I write code.", "I make pages like this one."];
const out = document.getElementById("out");
let line = 0, i = 0, deleting = false;
function tick() {
  const text = lines[line];
  out.textContent = text.slice(0, i);
  if (!deleting && i < text.length) i++;
  else if (deleting && i > 0) i--;
  else if (!deleting) { deleting = true; return setTimeout(tick, 1200); }
  else { deleting = false; line = (line + 1) % lines.length; }
  setTimeout(tick, deleting ? 35 : 70);
}
tick();`,
  },
  parallax: {
    label: "Parallax layers",
    html: `<div class="scene">
  <div class="layer back"></div>
  <div class="layer mid"></div>
  <h2 class="title">Scroll me</h2>
</div>`,
    css: `body { margin: 0; }
.scene { position: relative; height: 320px; overflow: hidden; border-radius: 18px; background: #0b1020; font-family: system-ui, sans-serif; }
.layer { position: absolute; inset: -40px; will-change: transform; }
.back { background: radial-gradient(circle at 30% 30%, #6d28d9 0, transparent 45%), radial-gradient(circle at 70% 60%, #0ea5e9 0, transparent 40%); }
.mid { background: radial-gradient(circle at 60% 20%, rgba(255,255,255,.18) 0 2px, transparent 3px) 0 0 / 40px 40px; }
.title { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: #fff; font-size: 34px; letter-spacing: -0.03em; }`,
    js: `// resonant.onViewport gives how far this block is through the visitor's screen (0 → 1).
const back = document.querySelector(".back"), mid = document.querySelector(".mid");
resonant.onViewport(({ progress }) => {
  back.style.transform = \`translateY(\${(progress - 0.5) * 60}px)\`;
  mid.style.transform = \`translateY(\${(progress - 0.5) * 120}px)\`;
});`,
  },
  counter: {
    label: "Count-up numbers",
    html: `<div class="stats">
  <div><strong data-to="128">0</strong><span>sketches</span></div>
  <div><strong data-to="42">0</strong><span>projects</span></div>
  <div><strong data-to="7">0</strong><span>years</span></div>
</div>`,
    css: `.stats { display: flex; gap: 12px; font-family: system-ui, sans-serif; color: #fafafa; padding: 12px 2px; }
.stats div { flex: 1; padding: 18px; border-radius: 14px; background: rgba(255,255,255,.06); }
strong { display: block; font-size: 32px; letter-spacing: -0.03em; }
span { color: #a1a1aa; font-size: 13px; }`,
    js: `let started = false;
resonant.onViewport(({ visible }) => {
  if (!visible || started) return;
  started = true;
  document.querySelectorAll("[data-to]").forEach((el) => {
    const to = Number(el.dataset.to), t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1200);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
});`,
  },
} satisfies Record<string, CodeStarter>;

export type CodeStarterId = keyof typeof CODE_STARTERS;
