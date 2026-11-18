// Account profile (Settings → Profile): social link validation, stored-value
// re-checking and copying the profile into new pages.
import { describe, expect, it } from "vitest";
import { BLOCK_REGISTRY, blankDocument, documentSchema } from "~/lib/blocks";
import { bioProblem, BIO_MAX, parseSocialLinks, prefillDocument, SOCIAL_LINKS_MAX, storedSocialLinks, type AccountProfile } from "~/lib/account";

const row = (url: string, label = "") => ({ url, label });
const avatar = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("parseSocialLinks", () => {
  it("normalises bare domains, drops empty rows and duplicates", () => {
    const r = parseSocialLinks([row("instagram.com/me"), row(""), row("https://instagram.com/me"), row("mailto:hi@example.com", " Email  me ")]);
    expect(r).toEqual({ links: [{ url: "https://instagram.com/me" }, { url: "mailto:hi@example.com", label: "Email me" }] });
  });

  it("rejects unsafe or malformed links", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "https://user:pw@example.com", "not a link", "ftp://example.com"]) {
      expect("error" in parseSocialLinks([row(url)]), url).toBe(true);
    }
  });

  it("requires a link when a label is given, and caps count and label length", () => {
    expect("error" in parseSocialLinks([row("", "Shop")])).toBe(true);
    expect("error" in parseSocialLinks([row("https://example.com", "x".repeat(41))])).toBe(true);
    const many = Array.from({ length: SOCIAL_LINKS_MAX + 1 }, (_, i) => row(`https://example.com/${i}`));
    expect("error" in parseSocialLinks(many)).toBe(true);
    expect("links" in parseSocialLinks(many.slice(0, SOCIAL_LINKS_MAX))).toBe(true);
  });

  it("re-validates stored values and ignores junk", () => {
    expect(storedSocialLinks(null)).toEqual([]);
    expect(storedSocialLinks([{ url: "javascript:alert(1)" }])).toEqual([]);
    expect(storedSocialLinks([{ url: "https://github.com/x", label: 5 }, "nope"])).toEqual([{ url: "https://github.com/x" }]);
  });
});

describe("bioProblem", () => {
  it("limits length and control characters", () => {
    expect(bioProblem("Designer in Lisbon.\nAvailable for work.")).toBeNull();
    expect(bioProblem("x".repeat(BIO_MAX + 1))).not.toBeNull();
    expect(bioProblem("bad\u0007")).not.toBeNull();
  });
});

describe("prefillDocument", () => {
  const account: AccountProfile = {
    displayName: "Sam Rivera",
    avatar,
    bio: "Illustrator.",
    socials: [{ url: "https://github.com/sam" }, { url: "https://bsky.app/profile/sam", label: "Bluesky" }],
  };

  it("fills the first home intro and every socials block, and stays valid", () => {
    const doc = blankDocument("Sample");
    const intro = { ...BLOCK_REGISTRY.intro.create(), avatarShape: "none" as const };
    const socials = BLOCK_REGISTRY.socials.create();
    doc.blocks = [intro, socials];
    doc.pages = [{ id: "pageaaaaaa", slug: "work", title: "Work", blocks: [{ ...BLOCK_REGISTRY.socials.create(), id: "socpage001" }] }];
    const out = prefillDocument(doc, account);
    const filled = out.blocks[0];
    expect(filled.type === "intro" && [filled.name, filled.avatar, filled.bio, filled.avatarShape]).toEqual(["Sam Rivera", avatar, "Illustrator.", "circle"]);
    expect(out.blocks[1].type === "socials" && out.blocks[1].items).toEqual(account.socials);
    expect(out.pages[0].blocks[0].type === "socials" && out.pages[0].blocks[0].items.length).toBe(2);
    expect(documentSchema.safeParse(out).success).toBe(true);
  });

  it("keeps template text when the account has no bio, avatar or links", () => {
    const doc = blankDocument("Sample");
    const before = doc.blocks[0];
    const out = prefillDocument(doc, { displayName: "Sam", avatar: null, bio: "", socials: [] });
    const after = out.blocks[0];
    expect(after.type === "intro" && before.type === "intro" && [after.name, after.bio, after.avatar]).toEqual(["Sam", before.bio, before.avatar]);
  });
});
