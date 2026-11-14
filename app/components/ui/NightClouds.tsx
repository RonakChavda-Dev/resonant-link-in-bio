// A procedural night sky with soft clouds (SVG turbulence) — no image assets.
export function NightClouds() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 [background:radial-gradient(120%_80%_at_70%_0%,#1b2440_0%,#0e1323_45%,#09090b_100%)]" />
      <svg className="absolute inset-0 h-full w-full opacity-70" preserveAspectRatio="none">
        <defs>
          <filter id="rs-clouds" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.0032 0.006" numOctaves="5" seed="7" />
            <feColorMatrix
              values="0 0 0 0 0.78
                      0 0 0 0 0.82
                      0 0 0 0 0.92
                      0 0 0 1.35 -0.62"
            />
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
          <linearGradient id="rs-cloud-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.15" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.35" />
          </linearGradient>
          <mask id="rs-cloud-mask">
            <rect width="100%" height="100%" fill="url(#rs-cloud-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" filter="url(#rs-clouds)" mask="url(#rs-cloud-mask)" />
      </svg>
      <div className="absolute inset-0 [background-image:radial-gradient(1px_1px_at_12%_18%,#fff,transparent),radial-gradient(1px_1px_at_42%_8%,#fff,transparent),radial-gradient(1.5px_1.5px_at_68%_22%,#fff,transparent),radial-gradient(1px_1px_at_85%_12%,#fff,transparent),radial-gradient(1px_1px_at_28%_35%,#fff,transparent)] opacity-60" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />
    </div>
  );
}
