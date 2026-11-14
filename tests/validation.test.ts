import { describe, expect, it } from "vitest";
import { normalizeLink, parseVideoUrl, referrerHost, isSafeLink } from "~/lib/urls";
import { handleProblem, normalizeHandle } from "~/lib/handles";
import { safeRedirectPath } from "~/lib/safe-redirect";
import { BLOCK_REGISTRY, BLOCK_TYPES, blankDocument, documentSchema } from "~/lib/blocks";
import { TEMPLATES, instantiateTemplate } from "~/lib/templates";
import { screenComment } from "~/server/comments.server";
import { sniffImageType } from "~/server/media.server";

describe("normalizeLink", () => {
  it("adds https to bare domains", () => {
    expect(normalizeLink("example.com/shop")).toBe("https://example.com/shop");
  });
  it("accepts mailto and tel", () => {
    expect(normalizeLink("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    expect(normalizeLink("tel:+15551234567")).toBe("tel:+15551234567");
  });
  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "https://user:pass@example.com",
    "https://localhost",
    "java\tscript:alert(1)",
    "",
    "not a url",
  ])("rejects %s", (input) => {
    expect(normalizeLink(input)).toBeNull();
  });
  it("isSafeLink requires the normalised form", () => {
    expect(isSafeLink("https://example.com/")).toBe(true);
    expect(isSafeLink("example.com")).toBe(false);
  });
});

describe("parseVideoUrl", () => {
  it("parses YouTube and Vimeo", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=aqz-KE-bpKQ")).toEqual({ provider: "youtube", id: "aqz-KE-bpKQ" });
    expect(parseVideoUrl("https://youtu.be/aqz-KE-bpKQ")).toEqual({ provider: "youtube", id: "aqz-KE-bpKQ" });
    expect(parseVideoUrl("https://vimeo.com/76979871")).toEqual({ provider: "vimeo", id: "76979871" });
  });
  it("rejects other hosts and http", () => {
    expect(parseVideoUrl("https://evil.example/watch?v=aqz-KE-bpKQ")).toBeNull();
    expect(parseVideoUrl("http://www.youtube.com/watch?v=aqz-KE-bpKQ")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/watch?v=<script>")).toBeNull();
  });
});

describe("referrerHost", () => {
  it("keeps only the hostname", () => {
    expect(referrerHost("https://www.example.com/path?secret=1")).toBe("example.com");
    expect(referrerHost("javascript:alert(1)")).toBe("");
    expect(referrerHost(42)).toBe("");
  });
});

describe("handles", () => {
  it("normalises", () => expect(normalizeHandle("  @Ada_Lovelace ")).toBe("ada_lovelace"));
  it("reserves system routes", () => {
    for (const h of ["dashboard", "login", "api", "settings", "templates", "editor"]) expect(handleProblem(h)).not.toBeNull();
  });
  it("enforces format", () => {
    expect(handleProblem("ab")).not.toBeNull();
    expect(handleProblem("-abc")).not.toBeNull();
    expect(handleProblem("a".repeat(31))).not.toBeNull();
    expect(handleProblem("ada.l")).not.toBeNull();
    expect(handleProblem("ada-l_9")).toBeNull();
  });
});

describe("safeRedirectPath", () => {
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "/%0a//evil.com\n", "javascript:alert(1)"])(
    "blocks %s",
    (input) => {
      const out = safeRedirectPath(input);
      expect(out.startsWith("/")).toBe(true);
      expect(out.startsWith("//")).toBe(false);
      expect(new URL(out, "https://app.test").origin).toBe("https://app.test");
    },
  );
  it("keeps same-site paths", () => expect(safeRedirectPath("/editor/x?y=1#z")).toBe("/editor/x?y=1#z"));
});

describe("document schema", () => {
  it("accepts every block's default content", () => {
    for (const type of BLOCK_TYPES) {
      const doc = blankDocument();
      doc.blocks.push(BLOCK_REGISTRY[type].create());
      const result = documentSchema.safeParse(doc);
      expect(result.success, `${type}: ${result.success ? "" : JSON.stringify(result.error.issues)}`).toBe(true);
    }
  });
  it("rejects unknown block types and fields", () => {
    const doc = blankDocument() as any;
    doc.blocks.push({ id: "abcdef12", type: "html", html: "<script>" });
    expect(documentSchema.safeParse(doc).success).toBe(false);
    const doc2 = blankDocument() as any;
    doc2.blocks[0].onclick = "alert(1)";
    expect(documentSchema.safeParse(doc2).success).toBe(false);
    const doc3 = blankDocument() as any;
    doc3.theme.css = "body{}";
    expect(documentSchema.safeParse(doc3).success).toBe(false);
  });
  it("rejects unsafe link URLs and theme values", () => {
    const doc = blankDocument() as any;
    doc.blocks.push({ ...BLOCK_REGISTRY.link.create(), url: "javascript:alert(1)" });
    expect(documentSchema.safeParse(doc).success).toBe(false);
    const doc2 = blankDocument() as any;
    doc2.theme.preset = "url(evil)";
    expect(documentSchema.safeParse(doc2).success).toBe(false);
  });
  it("rejects duplicate block ids", () => {
    const doc = blankDocument();
    doc.blocks.push({ ...doc.blocks[0] });
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
});

describe("templates", () => {
  it("are all valid documents with unique ids", () => {
    const ids = new Set<string>();
    for (const t of TEMPLATES) {
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      const r = documentSchema.safeParse(t.document);
      expect(r.success, `${t.id}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true);
      const copy = instantiateTemplate(t, "Test Person");
      expect(documentSchema.safeParse(copy).success).toBe(true);
      expect(copy.blocks.map((b) => b.id)).not.toEqual(t.document.blocks.map((b) => b.id));
    }
  });
  it("link only to example.com placeholders or mailto", () => {
    for (const t of TEMPLATES)
      for (const b of t.document.blocks) {
        if (b.type === "link") expect(b.url).toMatch(/^(https:\/\/example\.com\/|mailto:[^@]+@example\.com)/);
      }
  });
});

describe("comment screening", () => {
  it("trims, strips control characters and caps links", () => {
    expect(screenComment("  hi\u0007 there \n\n\n\nok ")).toEqual(["hi there \n\nok", null]);
    expect(screenComment("   ")[1]).not.toBeNull();
    expect(screenComment("x".repeat(1001))[1]).not.toBeNull();
    expect(screenComment("https://a.co https://b.co https://c.co")[1]).not.toBeNull();
  });
});

describe("upload signature sniffing", () => {
  it("identifies real image headers", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("GIF89a...."))).toBe("image/gif");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  it("rejects SVG, HTML and disguised files", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<!doctype html><script>"))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });
});

import { COMPONENTS } from "~/lib/components";
import { TEMPLATE_BASES, TEMPLATE_COUNT } from "~/lib/templates";
import { upgradeDocument } from "~/lib/block-registry";

describe("v2 catalog", () => {
  it("every component preset creates a valid block", () => {
    const ids = new Set<string>();
    for (const c of COMPONENTS) {
      expect(ids.has(c.id), c.id).toBe(false);
      ids.add(c.id);
      const doc = blankDocument();
      doc.blocks.push(c.create());
      const r = documentSchema.safeParse(doc);
      expect(r.success, `${c.id}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true);
    }
    expect(COMPONENTS.length).toBeGreaterThanOrEqual(90);
  });
  it("template counts are computed from real variants", () => {
    expect(TEMPLATE_COUNT).toBe(TEMPLATE_BASES.reduce((n, b) => n + b.variants.length, 0));
    expect(TEMPLATE_BASES.length).toBeGreaterThanOrEqual(24);
    for (const b of TEMPLATE_BASES) expect(b.variants.length).toBeGreaterThanOrEqual(3);
  });
  it("template links are placeholders only (no real social handles)", () => {
    const urls = TEMPLATES.flatMap((t) => t.document.blocks.flatMap((b) => JSON.stringify(b).match(/https?:\/\/[^"]+|mailto:[^"]+/g) ?? []));
    for (const u of urls) expect(u).toMatch(/^(https:\/\/example\.com\/|mailto:[^@]+@example\.com|https:\/\/www\.youtube\.com\/watch\?v=aqz-KE-bpKQ|https:\/\/open\.spotify\.com\/(track|show)\/0{22})/);
  });
  it("upgrades version 1 documents", () => {
    const v1 = {
      version: 1,
      theme: { preset: "obsidian", accent: "lime", font: "sans", radius: "soft", buttons: "soft", backdrop: "rings", layout: "stack", resonance: true },
      seo: { title: "", description: "" },
      blocks: [
        { id: "intro00001", type: "intro", name: "A", tagline: "", bio: "", avatar: null, align: "center" },
        { id: "link000001", type: "link", label: "L", url: "https://example.com/", note: "", emphasis: "feature" },
        { id: "head000001", type: "heading", text: "H" },
        { id: "text000001", type: "text", body: "T" },
      ],
    };
    const r = documentSchema.safeParse(upgradeDocument(v1));
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    if (r.success) {
      expect(r.data.theme.background.preset).toBe("rings");
      expect(r.data.blocks[1]).toMatchObject({ type: "link", variant: "feature" });
    }
  });
  it("rejects background images without media and unsafe embeds", () => {
    const doc = blankDocument() as any;
    doc.theme.background = { kind: "image", preset: "none", media: null, dim: 40, blur: 0 };
    expect(documentSchema.safeParse(doc).success).toBe(false);
    const doc2 = blankDocument() as any;
    doc2.blocks.push({ id: "aud0000001", type: "audio", url: "https://evil.example/embed", title: "x" });
    expect(documentSchema.safeParse(doc2).success).toBe(false);
  });
});

describe("custom code, clock and effect backfill", () => {
  it("accepts code within limits and rejects oversize code", () => {
    const doc = blankDocument() as any;
    doc.blocks.push(BLOCK_REGISTRY.code.create());
    expect(documentSchema.safeParse(doc).success).toBe(true);
    doc.blocks[1].js = "x".repeat(20_001);
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
  it("validates clock time zones", () => {
    const doc = blankDocument() as any;
    doc.blocks.push({ ...BLOCK_REGISTRY.clock.create(), timeZone: "Australia/Melbourne" });
    expect(documentSchema.safeParse(doc).success).toBe(true);
    doc.blocks[1].timeZone = "Mars/Olympus";
    expect(documentSchema.safeParse(doc).success).toBe(false);
    doc.blocks[1].timeZone = "</script>";
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
  it("backfills effect options added after a v2 document was saved", () => {
    const doc = blankDocument() as any;
    delete doc.theme.effects.tilt;
    expect(documentSchema.safeParse(doc).success).toBe(false);
    expect(documentSchema.safeParse(upgradeDocument(doc)).success).toBe(true);
  });
});
