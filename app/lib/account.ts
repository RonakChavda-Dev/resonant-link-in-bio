// Account profile: the avatar, short bio and social links a creator sets once in
// Settings and can copy into any page. Zod-free and client-safe; shared by the
// settings route, page creation and the editor.
import type { BlockOf, ProfileDocument } from "./blocks";
import { normalizeLink } from "./urls";

export const BIO_MAX = 160;
export const SOCIAL_LINKS_MAX = 12;
export const SOCIAL_LABEL_MAX = 40;

export interface SocialLink {
  url: string;
  label?: string;
}

export interface AccountProfile {
  displayName: string;
  avatar: string | null;
  bio: string;
  socials: SocialLink[];
}

export interface AccountPreferences {
  prefillPages: boolean;
  newPageComments: boolean;
  commentAvatar: boolean;
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function bioProblem(bio: string): string | null {
  if (bio.length > BIO_MAX) return `Keep your bio under ${BIO_MAX} characters.`;
  if (CONTROL.test(bio)) return "Your bio contains invalid characters.";
  return null;
}

/**
 * Validate raw social rows (url + optional label). Empty rows are dropped;
 * links are normalised (bare domains get https://) and de-duplicated.
 */
export function parseSocialLinks(rows: { url: string; label: string }[]): { links: SocialLink[] } | { error: string } {
  const links: SocialLink[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const rawUrl = row.url.trim();
    const label = row.label.replace(/\s+/g, " ").trim();
    if (!rawUrl && !label) continue;
    if (!rawUrl) return { error: `Add a link for "${label.slice(0, 40)}", or remove that row.` };
    const url = normalizeLink(rawUrl);
    if (!url) return { error: `"${rawUrl.slice(0, 60)}" isn't a valid link. Use a full web address, mailto: or tel:.` };
    if (label.length > SOCIAL_LABEL_MAX) return { error: `Keep link labels under ${SOCIAL_LABEL_MAX} characters.` };
    if (CONTROL.test(label)) return { error: "A link label contains invalid characters." };
    if (seen.has(url)) continue;
    seen.add(url);
    links.push(label ? { url, label } : { url });
  }
  if (links.length > SOCIAL_LINKS_MAX) return { error: `You can add up to ${SOCIAL_LINKS_MAX} links.` };
  return { links };
}

/** Re-check links read back from storage (defence in depth before rendering). */
export function storedSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  const rows = value
    .filter((v): v is { url: unknown; label?: unknown } => !!v && typeof v === "object")
    .map((v) => ({ url: typeof v.url === "string" ? v.url : "", label: typeof v.label === "string" ? v.label : "" }));
  const parsed = parseSocialLinks(rows);
  return "links" in parsed ? parsed.links : [];
}

/** Intro fields that the account profile fills (only non-empty values overwrite). */
export function introFromAccount(block: BlockOf<"intro">, account: AccountProfile): Partial<BlockOf<"intro">> {
  const patch: Partial<BlockOf<"intro">> = { name: account.displayName.slice(0, 60) };
  if (account.avatar) {
    patch.avatar = account.avatar;
    if (block.avatarShape === "none") patch.avatarShape = "circle";
  }
  if (account.bio.trim()) patch.bio = account.bio.trim();
  return patch;
}

export function socialsFromAccount(account: AccountProfile): BlockOf<"socials">["items"] {
  return account.socials.map((s) => (s.label ? { url: s.url, label: s.label } : { url: s.url }));
}

/** Fill a freshly created page with the account profile (first intro + every socials block). */
export function prefillDocument(doc: ProfileDocument, account: AccountProfile): ProfileDocument {
  const fill = (blocks: ProfileDocument["blocks"], isHome: boolean) => {
    let introDone = !isHome;
    return blocks.map((b) => {
      if (b.type === "intro" && !introDone) {
        introDone = true;
        return { ...b, ...introFromAccount(b, account) };
      }
      if (b.type === "socials" && account.socials.length) return { ...b, items: socialsFromAccount(account) };
      return b;
    });
  };
  return {
    ...doc,
    blocks: fill(doc.blocks, true),
    pages: doc.pages.map((p) => ({ ...p, blocks: fill(p.blocks, false) })),
  };
}
