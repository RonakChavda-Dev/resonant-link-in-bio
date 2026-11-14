import type { MetaDescriptor } from "react-router";

interface MatchLike {
  id: string;
  loaderData?: unknown;
}

export function rootOrigin(matches: readonly (MatchLike | undefined)[]): string {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { origin?: string } | undefined;
  return root?.origin ?? "";
}

/** Route-specific title, description, canonical URL and Open Graph tags. */
export function seo(
  matches: readonly (MatchLike | undefined)[],
  opts: { title: string; description: string; path: string; noindex?: boolean; type?: string },
): MetaDescriptor[] {
  const origin = rootOrigin(matches);
  const url = origin + opts.path;
  const tags: MetaDescriptor[] = [
    { title: opts.title },
    { name: "description", content: opts.description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:url", content: url },
    { property: "og:type", content: opts.type ?? "website" },
    { property: "og:site_name", content: "Resonant" },
    { name: "twitter:card", content: "summary" },
  ];
  if (opts.noindex) tags.push({ name: "robots", content: "noindex, nofollow" });
  return tags;
}

export function privateMeta(title: string): MetaDescriptor[] {
  return [{ title: `${title} · Resonant` }, { name: "robots", content: "noindex, nofollow" }];
}
