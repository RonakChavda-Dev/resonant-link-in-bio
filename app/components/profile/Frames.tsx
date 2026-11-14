import type { CSSProperties, ReactNode } from "react";
import type { ProfileDocument } from "~/lib/blocks";
import { ProfileView } from "./ProfileView";

/**
 * Renders a profile at a real mobile width (390px) and scales it down, so the
 * thumbnail is a faithful miniature rather than a separate design.
 */
export function ProfileThumb({
  doc,
  width = 220,
  height = 380,
  label,
}: {
  doc: ProfileDocument;
  width?: number;
  height?: number;
  label?: string;
}) {
  const scale = width / 390;
  return (
    <div
      className="relative overflow-hidden rounded-[1.1rem] border border-line bg-ink-2"
      style={{ width, height }}
      role="img"
      aria-label={label}
    >
      <div
        style={{ width: 390, height: height / scale, transform: `scale(${scale})`, transformOrigin: "top left" } as CSSProperties}
      >
        <ProfileView doc={doc} mode="thumbnail" className="h-full" />
      </div>
    </div>
  );
}

export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-[2.6rem] border border-line-strong bg-[#050605] p-2.5 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9),inset_0_0_0_1px_rgba(255,255,255,0.03)] ${className}`}
    >
      <div className="relative overflow-hidden rounded-[2.1rem] bg-ink-2">
        <div className="pointer-events-none absolute left-1/2 top-2.5 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
