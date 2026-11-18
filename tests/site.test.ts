// Multi-page sites, profile music and card effects: schema rules, the document
// upgrader, audio signature sniffing and pasted song links.
import { describe, expect, it } from "vitest";
import { blankDocument, documentSchema, referencedAudio, upgradeDocument, type ProfileDocument } from "~/lib/blocks";
import { DEFAULT_MUSIC, DEFAULT_NAV, hasMusic, slugify } from "~/lib/block-registry";
import { isSafeAudioUrl } from "~/lib/urls";
import { sniffAudioType } from "~/server/media.server";

const page = (id: string, slug: string, title = "Work"): ProfileDocument["pages"][number] => ({ id, slug, title, blocks: [] });
const valid = (doc: unknown) => documentSchema.safeParse(doc).success;

describe("pages", () => {
  it("accepts extra pages with unique addresses", () => {
    expect(valid({ ...blankDocument(), pages: [page("pageaaaaaa", "work"), page("pagebbbbbb", "about-me", "About")] })).toBe(true);
  });

  it("rejects duplicate addresses and bad slugs", () => {
    expect(valid({ ...blankDocument(), pages: [page("pageaaaaaa", "work"), page("pagebbbbbb", "work")] })).toBe(false);
    for (const slug of ["Work", "-work", "work-", "a b", "", "x".repeat(33), "../etc"]) {
      expect(valid({ ...blankDocument(), pages: [page("pageaaaaaa", slug)] }), slug).toBe(false);
    }
  });

  it("rejects block ids repeated across pages", () => {
    const doc = blankDocument();
    const dup = structuredClone(doc.blocks[0]);
    expect(valid({ ...doc, pages: [{ ...page("pageaaaaaa", "work"), blocks: [dup] }] })).toBe(false);
  });

  it("caps the number of pages and requires a name", () => {
    const many = Array.from({ length: 9 }, (_, i) => page(`page${i}aaaaa`, `p${i}`));
    expect(valid({ ...blankDocument(), pages: many })).toBe(false);
    expect(valid({ ...blankDocument(), pages: [page("pageaaaaaa", "work", "  ")] })).toBe(false);
  });

  it("only allows the two navigation modes", () => {
    expect(valid({ ...blankDocument(), nav: { mode: "stack", homeLabel: "Home" } })).toBe(true);
    expect(valid({ ...blankDocument(), nav: { mode: "grid", homeLabel: "Home" } })).toBe(false);
  });

  it("slugifies page names", () => {
    expect(slugify("About me!")).toBe("about-me");
    expect(slugify("Café Work")).toBe("cafe-work");
    expect(slugify("???")).toBe("page");
  });
});

describe("music", () => {
  const withMusic = (music: Partial<ProfileDocument["music"]>) => ({ ...blankDocument(), music: { ...DEFAULT_MUSIC, ...music } });

  it("needs a file or link for the chosen source", () => {
    expect(valid(withMusic({ source: "upload", media: null }))).toBe(false);
    expect(valid(withMusic({ source: "url", url: "" }))).toBe(false);
    expect(valid(withMusic({ source: "upload", media: "6f1c1d1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f" }))).toBe(true);
    expect(valid(withMusic({ source: "url", url: "https://cdn.example.com/song.mp3" }))).toBe(true);
  });

  it("refuses unsafe song links and out-of-range volume", () => {
    for (const url of ["http://example.com/a.mp3", "javascript:alert(1)", "data:audio/mp3;base64,AAAA", "https://u:p@example.com/a.mp3", "https://example.com/a.mp3#t"]) {
      expect(isSafeAudioUrl(url), url).toBe(false);
      expect(valid(withMusic({ source: "url", url })), url).toBe(false);
    }
    expect(valid(withMusic({ volume: 101 }))).toBe(false);
  });

  it("reports which upload the player uses", () => {
    const doc = withMusic({ source: "upload", media: "6f1c1d1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f" }) as ProfileDocument;
    expect(referencedAudio(doc)).toBe("6f1c1d1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f");
    expect(hasMusic(doc)).toBe(true);
    expect(hasMusic(blankDocument())).toBe(false);
  });

  it("recognises audio by signature, not name", () => {
    const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
    const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
    expect(sniffAudioType(bytes(...ascii("ID3")))).toBe("audio/mpeg");
    expect(sniffAudioType(bytes(0xff, 0xfb))).toBe("audio/mpeg");
    expect(sniffAudioType(bytes(0, 0, 0, 0x20, ...ascii("ftypM4A ")))).toBe("audio/mp4");
    expect(sniffAudioType(bytes(...ascii("OggS")))).toBe("audio/ogg");
    expect(sniffAudioType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))).toBe("audio/wav");
    expect(sniffAudioType(bytes(...ascii("<html>")))).toBeNull();
    expect(sniffAudioType(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
  });
});

describe("document upgrade", () => {
  it("fills in pages, navigation, music and the card effect for older drafts", () => {
    const { pages: _p, nav: _n, music: _m, ...old } = blankDocument();
    const oldEffects = { ...old.theme.effects } as Record<string, unknown>;
    delete oldEffects.card;
    const upgraded = upgradeDocument({ ...old, theme: { ...old.theme, effects: oldEffects } }) as ProfileDocument;
    expect(upgraded.pages).toEqual([]);
    expect(upgraded.nav).toEqual(DEFAULT_NAV);
    expect(upgraded.music).toEqual(DEFAULT_MUSIC);
    expect(upgraded.theme.effects.card).toBe("none");
    expect(valid(upgraded)).toBe(true);
  });

  it("rejects unknown card effects", () => {
    const doc = blankDocument();
    expect(valid({ ...doc, theme: { ...doc.theme, effects: { ...doc.theme.effects, card: "explode" } } })).toBe(false);
  });
});
