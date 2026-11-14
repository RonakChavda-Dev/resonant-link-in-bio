// The Resonant mark: a bound notebook (your personal page) with a bookmark
// ribbon and three ruled lines. Monochrome, to match the product palette.
export function LogoMark({ size = 26, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className={pulse ? "mark-pulse" : undefined}>
      <rect x="6.5" y="3.5" width="20" height="25" rx="4" fill="#fafafa" />
      <path d="M19.5 3.5h4v10l-2-1.6-2 1.6z" fill="#09090b" />
      <g fill="none" stroke="#09090b" strokeWidth="1.7" strokeLinecap="round">
        <path d="M11 18h10" />
        <path d="M11 21.5h7.5" opacity=".7" />
        <path d="M11 25h5" opacity=".45" />
      </g>
      <g fill="#a1a1aa">
        <rect x="4" y="7.5" width="5" height="1.8" rx=".9" />
        <rect x="4" y="12.5" width="5" height="1.8" rx=".9" />
        <rect x="4" y="17.5" width="5" height="1.8" rx=".9" />
        <rect x="4" y="22.5" width="5" height="1.8" rx=".9" />
      </g>
    </svg>
  );
}

export function Logo({ pulse = false }: { pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-[1.08rem] font-semibold tracking-[-0.03em] text-fg">
      <LogoMark pulse={pulse} />
      Resonant
    </span>
  );
}
