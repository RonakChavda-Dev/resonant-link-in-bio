import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="wrap pt-16 pb-12 border-b border-line">
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h1 className="display text-[clamp(2.6rem,6vw,4.8rem)] max-w-4xl">{title}</h1>
      {children ? <div className="mt-5 max-w-2xl text-lg leading-relaxed text-dim">{children}</div> : null}
    </header>
  );
}

export function Updated({ date }: { date: string }) {
  return <p className="text-xs text-faint mt-6">Last reviewed {date}. This page describes the software as currently built.</p>;
}
