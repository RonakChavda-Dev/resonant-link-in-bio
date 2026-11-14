// URL safety rules for user-supplied links. Shared by editor and server.

const ALLOWED_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:"]);

/**
 * Normalise a link typed by a creator. Bare domains get https://.
 * Returns null when the value is not an acceptable link.
 */
export function normalizeLink(input: string): string | null {
  const value = input.trim();
  if (!value || value.length > 2048) return null;
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return null;
  let candidate = value;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    // Looks like "example.com/path" — assume https.
    if (!/^[^/?#]+\.[^/?#]+/.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
  if (url.protocol === "http:" || url.protocol === "https:") {
    if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
    if (url.username || url.password) return null; // no embedded credentials
  }
  if (url.protocol === "mailto:" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(decodeURIComponent(url.pathname)))
    return null;
  if (url.protocol === "tel:" && !/^\+?[0-9().\- ]{3,32}$/.test(decodeURIComponent(url.pathname)))
    return null;
  return url.href;
}

export function isSafeLink(value: string): boolean {
  return normalizeLink(value) === value;
}

/** Display form: hostname for web links, address for mailto/tel. */
export function displayLink(href: string): string {
  try {
    const url = new URL(href);
    if (url.protocol === "mailto:" || url.protocol === "tel:") return decodeURIComponent(url.pathname);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

export type VideoRef = { provider: "youtube" | "vimeo"; id: string };

/** Accept only well-formed YouTube/Vimeo URLs and extract the video id. */
export function parseVideoUrl(input: string): VideoRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(\d{6,12})/)?.[1];
    return id ? { provider: "vimeo", id } : null;
  }
  return null;
}

export function videoEmbedUrl(ref: VideoRef): string {
  return ref.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${ref.id}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${ref.id}?autoplay=1&dnt=1`;
}

/** Hostname-only referrer, or "" (direct/unknown). */
export function referrerHost(input: unknown): string {
  if (typeof input !== "string" || !input) return "";
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.hostname.replace(/^www\./, "").slice(0, 100);
  } catch {
    return "";
  }
}

export type AudioRef = { provider: "spotify" | "soundcloud"; embed: string };

/** Accept only Spotify and SoundCloud links; build the provider's embed URL. */
export function parseAudioUrl(input: string): AudioRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  if (host === "open.spotify.com") {
    const m = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,40})/);
    return m ? { provider: "spotify", embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}` } : null;
  }
  if (host === "soundcloud.com" || host === "m.soundcloud.com") {
    if (!/^\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+){0,2}\/?$/.test(url.pathname)) return null;
    const clean = `https://soundcloud.com${url.pathname}`;
    return { provider: "soundcloud", embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(clean)}&visual=false&show_comments=false` };
  }
  return null;
}

/** Platform label for a social link, from its hostname. Never fetched. */
export function platformFor(href: string): { name: string; short: string } {
  let host = "";
  try {
    const url = new URL(href);
    if (url.protocol === "mailto:") return { name: "Email", short: "@" };
    if (url.protocol === "tel:") return { name: "Phone", short: "☎" };
    host = url.hostname.replace(/^(www|m)\./, "");
  } catch {
    return { name: "Link", short: "↗" };
  }
  const table: [RegExp, string, string][] = [
    [/(^|\.)instagram\.com$/, "Instagram", "IG"],
    [/(^|\.)(x|twitter)\.com$/, "X", "X"],
    [/(^|\.)tiktok\.com$/, "TikTok", "TT"],
    [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube", "YT"],
    [/(^|\.)github\.com$/, "GitHub", "GH"],
    [/(^|\.)linkedin\.com$/, "LinkedIn", "in"],
    [/(^|\.)facebook\.com$/, "Facebook", "f"],
    [/(^|\.)threads\.net$/, "Threads", "@"],
    [/(^|\.)bsky\.app$/, "Bluesky", "BS"],
    [/(^|\.)twitch\.tv$/, "Twitch", "TW"],
    [/(^|\.)discord\.(gg|com)$/, "Discord", "DC"],
    [/(^|\.)spotify\.com$/, "Spotify", "SP"],
    [/(^|\.)soundcloud\.com$/, "SoundCloud", "SC"],
    [/(^|\.)behance\.net$/, "Behance", "Bē"],
    [/(^|\.)dribbble\.com$/, "Dribbble", "Dr"],
    [/(^|\.)pinterest\.com$/, "Pinterest", "P"],
    [/(^|\.)substack\.com$/, "Substack", "S"],
    [/(^|\.)medium\.com$/, "Medium", "M"],
    [/(^|\.)patreon\.com$/, "Patreon", "Pa"],
    [/(^|\.)reddit\.com$/, "Reddit", "R"],
  ];
  for (const [re, name, short] of table) if (re.test(host)) return { name, short };
  return { name: host || "Website", short: "↗" };
}
