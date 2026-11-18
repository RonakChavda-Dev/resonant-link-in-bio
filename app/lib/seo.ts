import type { MetaDescriptor } from "react-router";

interface MatchLike {
  id: string;
  loaderData?: unknown;
}

export const SITE_NAME = "Resonant";

/** The default social preview (public/og.png, 1200×630). */
export const DEFAULT_SHARE_IMAGE = {
  path: "/og.png",
  width: 1200,
  height: 630,
  alt: "Resonant: your page, your whole story. Three phone screens showing sample pages.",
};

export function rootOrigin(matches: readonly (MatchLike | undefined)[]): string {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { origin?: string } | undefined;
  return root?.origin ?? "";
}

export interface ShareImage {
  /** Absolute URL, or a path starting with "/" that is resolved against the site origin. */
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /** "large" shows a wide card on X/Twitter; "small" a square thumbnail (avatars). */
  size?: "large" | "small";
}

/** Open Graph + Twitter tags for a share image. */
export function shareImageTags(origin: string, image: ShareImage): MetaDescriptor[] {
  const url = image.url.startsWith("/") ? origin + image.url : image.url;
  const tags: MetaDescriptor[] = [
    { property: "og:image", content: url },
    { property: "og:image:alt", content: image.alt },
    { name: "twitter:card", content: image.size === "small" ? "summary" : "summary_large_image" },
    { name: "twitter:image", content: url },
    { name: "twitter:image:alt", content: image.alt },
  ];
  if (image.width && image.height) {
    tags.push({ property: "og:image:width", content: String(image.width) }, { property: "og:image:height", content: String(image.height) });
  }
  return tags;
}

export function defaultShareImage(): ShareImage {
  const { path, ...rest } = DEFAULT_SHARE_IMAGE;
  return { url: path, size: "large", ...rest };
}

/** Route-specific title, description, canonical URL, Open Graph and Twitter tags. */
export function seo(
  matches: readonly (MatchLike | undefined)[],
  opts: { title: string; description: string; path: string; noindex?: boolean; type?: string; image?: ShareImage },
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
    { property: "og:site_name", content: SITE_NAME },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: opts.description },
    ...shareImageTags(origin, opts.image ?? defaultShareImage()),
  ];
  if (opts.noindex) tags.push({ name: "robots", content: "noindex, nofollow" });
  return tags;
}

export function privateMeta(title: string): MetaDescriptor[] {
  return [{ title: `${title} · ${SITE_NAME}` }, { name: "robots", content: "noindex, nofollow" }];
}
