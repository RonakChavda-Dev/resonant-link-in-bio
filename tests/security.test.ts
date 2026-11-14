import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, passwordProblem, verifyPassword } from "~/server/password.server";
import { isAllowedOrigin } from "~/server/request.server";
import { timingSafeEqual } from "~/server/crypto.server";
import { historyReducer, initHistory, moveBlock } from "~/components/editor/state";
import { blankDocument, BLOCK_REGISTRY } from "~/lib/blocks";

describe("password hashing", () => {
  it("hashes with argon2id and verifies", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "correct horse batterx")).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });
  it("uses a unique salt per hash", async () => {
    expect(await hashPassword("same password!")).not.toBe(await hashPassword("same password!"));
  });
  it("rejects malformed or hostile hashes", async () => {
    expect(await verifyPassword("plaintext", "x")).toBe(false);
    expect(await verifyPassword("$argon2id$v=19$m=999999999,t=1,p=1$AAAA$AAAA", "x")).toBe(false);
  });
  it("enforces policy", () => {
    expect(passwordProblem("short")).not.toBeNull();
    expect(passwordProblem("password123")).not.toBeNull();
    expect(passwordProblem("aaaaaaaaaaaa")).not.toBeNull();
    expect(passwordProblem("x".repeat(129))).not.toBeNull();
    expect(passwordProblem("adalovelace99", "adalovelace@example.com")).not.toBeNull();
    expect(passwordProblem("tidal-lantern-fig")).toBeNull();
  });
});

describe("origin check (CSRF layer 1)", () => {
  const req = (method: string, headers: Record<string, string>) =>
    new Request("https://app.test/login", { method, headers });
  it("allows safe methods", () => expect(isAllowedOrigin(req("GET", {}))).toBe(true));
  it("allows same-origin posts", () => {
    expect(isAllowedOrigin(req("POST", { origin: "https://app.test" }))).toBe(true);
    expect(isAllowedOrigin(req("POST", { "sec-fetch-site": "same-origin" }))).toBe(true);
  });
  it("blocks cross-origin and headerless posts", () => {
    expect(isAllowedOrigin(req("POST", { origin: "https://evil.test" }))).toBe(false);
    expect(isAllowedOrigin(req("POST", { origin: "null" }))).toBe(false);
    expect(isAllowedOrigin(req("POST", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isAllowedOrigin(req("DELETE", {}))).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("compares", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("editor history", () => {
  it("undoes and redoes, coalescing same-field typing", () => {
    const doc = blankDocument("A");
    let s = initHistory(doc);
    const d1 = { ...doc, seo: { ...doc.seo, title: "x" } };
    const d2 = { ...doc, seo: { ...doc.seo, title: "xy" } };
    s = historyReducer(s, { type: "change", doc: d1, key: "seo.title" });
    s = historyReducer(s, { type: "change", doc: d2, key: "seo.title" });
    expect(s.past.length).toBe(1);
    s = historyReducer(s, { type: "undo" });
    expect(s.present).toBe(doc);
    s = historyReducer(s, { type: "redo" });
    expect(s.present).toBe(d2);
  });
  it("moves blocks", () => {
    const doc = blankDocument();
    doc.blocks.push(BLOCK_REGISTRY.link.create(), BLOCK_REGISTRY.text.create());
    const moved = moveBlock(doc, 2, 0);
    expect(moved.blocks.map((b) => b.type)).toEqual(["text", "intro", "link"]);
    expect(moveBlock(doc, 0, -1)).toBe(doc);
  });
});
