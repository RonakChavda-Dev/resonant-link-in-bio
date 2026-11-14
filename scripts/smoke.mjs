// End-to-end smoke test against a running dev server (npm run dev).
// Usage: node scripts/smoke.mjs [baseUrl]
// Creates throwaway accounts with random emails in the local database.
const BASE = process.argv[2] ?? "http://localhost:5173";
const ORIGIN = new URL(BASE).origin;
let failures = 0;

function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
}

class Client {
  cookies = new Map();
  async req(path, { method = "GET", form, json, headers = {}, origin = ORIGIN } = {}) {
    const h = new Headers(headers);
    if (this.cookies.size) h.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    if (method !== "GET" && origin) h.set("origin", origin);
    let body;
    if (form) {
      body = new URLSearchParams(form);
      h.set("content-type", "application/x-www-form-urlencoded");
    }
    if (json) {
      body = JSON.stringify(json);
      h.set("content-type", "text/plain");
    }
    const res = await fetch(BASE + path, { method, headers: h, body, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      if (v) this.cookies.set(k, v);
      else this.cookies.delete(k);
    }
    return res;
  }
  async csrf(path = "/dashboard") {
    const html = await (await this.req(path)).text();
    return html.match(/name="_csrf" value="([^"]+)"/)?.[1] ?? null;
  }
}

const rand = Math.random().toString(36).slice(2, 8);

// --- Public routes -------------------------------------------------------------
const anon = new Client();
for (const path of ["/", "/features", "/templates", "/templates/signal", "/how-it-works", "/security", "/privacy", "/login", "/signup", "/forgot-password", "/robots.txt", "/sitemap.xml"]) {
  const res = await anon.req(path);
  check(`GET ${path} → 200`, res.status === 200, String(res.status));
}
const home = await anon.req("/");
check("CSP header with nonce or dev policy present", (home.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"));
check("nosniff header", home.headers.get("x-content-type-options") === "nosniff");
check("unknown route → 404", (await anon.req("/no/such/page")).status === 404);
check("unknown profile → 404", (await anon.req(`/@nobody${rand}`)).status === 404);
check("dashboard redirects anonymous users", (await anon.req("/dashboard")).status === 302);
check("templates/unknown → 404", (await anon.req("/templates/nope")).status === 404);

// --- CSRF origin check ------------------------------------------------------------
const cross = await anon.req("/login", { method: "POST", form: { email: "a@b.co", password: "x" }, origin: "https://evil.example" });
check("cross-origin POST refused", cross.status === 403, String(cross.status));

// --- Sign up ------------------------------------------------------------------------
const owner = new Client();
const email = `owner-${rand}@example.com`;
const weak = await owner.req("/signup", { method: "POST", form: { displayName: "Owner", email, password: "short" } });
check("weak password rejected", weak.status === 400, String(weak.status));
const signup = await owner.req("/signup", { method: "POST", form: { displayName: "Owner Test", email, password: "tidal-lantern-fig-42" } });
check("signup redirects", signup.status === 302, String(signup.status));
const cookieName = [...owner.cookies.keys()][0] ?? "";
check("session cookie set", cookieName.includes("rsn_session"));
const setCookie = signup.headers.get("set-cookie") ?? "";
check("cookie is HttpOnly + SameSite=Lax", /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie));
check("dashboard loads when signed in", (await owner.req("/dashboard")).status === 200);
const dupe = await new Client().req("/signup", { method: "POST", form: { displayName: "X", email, password: "another-good-pass-9" } });
check("duplicate email refused", dupe.status === 400);

// --- Login ---------------------------------------------------------------------------
const second = new Client();
const badLogin = await second.req("/login", { method: "POST", form: { email, password: "wrong-password-1" } });
check("wrong password → 400 generic", badLogin.status === 400 && (await badLogin.text()).includes("don&#x27;t match"));
const goodLogin = await second.req("/login?next=//evil.example", { method: "POST", form: { email, password: "tidal-lantern-fig-42" } });
check("login works and blocks open redirect", goodLogin.status === 302 && goodLogin.headers.get("location") === "/dashboard", goodLogin.headers.get("location"));

// --- Create profile --------------------------------------------------------------------
const csrf = await owner.csrf("/dashboard/new");
check("csrf token rendered", !!csrf);
const handle = `smoke${rand}`;
const noCsrf = await owner.req("/dashboard/new", { method: "POST", form: { handle, template: "signal" } });
check("profile create without CSRF token refused", noCsrf.status === 403, String(noCsrf.status));
const reserved = await owner.req("/dashboard/new", { method: "POST", form: { handle: "dashboard", template: "signal", _csrf: csrf } });
check("reserved handle refused", reserved.status === 400);
const create = await owner.req("/dashboard/new", { method: "POST", form: { handle, template: "signal", _csrf: csrf } });
const editorPath = create.headers.get("location") ?? "";
check("profile created → editor", create.status === 302 && editorPath.startsWith("/editor/"), editorPath);
const profileId = editorPath.split("/").pop();

check("draft not public before publish", (await anon.req(`/@${handle}`)).status === 404);

// IDOR: another account can't open the editor or analytics
const intruder = new Client();
await intruder.req("/signup", { method: "POST", form: { displayName: "Intruder", email: `intruder-${rand}@example.com`, password: "intruder-pass-123" } });
check("other user can't load editor (404)", (await intruder.req(editorPath)).status === 404);
check("other user can't load analytics (404)", (await intruder.req(`/analytics/${profileId}`)).status === 404);
const intruderCsrf = await intruder.csrf("/dashboard");
const idor = await intruder.req(editorPath, { method: "POST", form: { intent: "publish", _csrf: intruderCsrf } });
check("other user can't publish (404)", idor.status === 404, String(idor.status));

// --- Save draft ----------------------------------------------------------------------------
const editorHtml = await (await owner.req(editorPath)).text();
check("editor renders (library + canvas)", editorHtml.includes("components…") && editorHtml.includes("Page canvas"));
const doc = {
  version: 1,
  theme: { preset: "obsidian", accent: "lime", font: "sans", radius: "soft", buttons: "soft", backdrop: "rings", layout: "stack", resonance: true },
  seo: { title: "", description: "" },
  blocks: [
    { id: "intro00001", type: "intro", name: "Smoke Tester", tagline: "Testing <b>escape</b>", bio: "", avatar: null, align: "center" },
    { id: "link000001", type: "link", label: "A link", url: "https://example.com/a", note: "", emphasis: "default" },
  ],
};
const bad = await owner.req(editorPath, { method: "POST", form: { intent: "save", document: JSON.stringify({ ...doc, blocks: [...doc.blocks, { id: "evil000001", type: "html", html: "<script>" }] }), baseVersion: "1", _csrf: csrf } });
check("unknown block type rejected on save", bad.status === 400, String(bad.status));
const js = await owner.req(editorPath, { method: "POST", form: { intent: "save", document: JSON.stringify({ ...doc, blocks: [doc.blocks[0], { ...doc.blocks[1], url: "javascript:alert(1)" }] }), baseVersion: "1", _csrf: csrf } });
check("javascript: URL rejected on save", js.status === 400);
const save = await owner.req(editorPath, { method: "POST", form: { intent: "save", document: JSON.stringify(doc), baseVersion: "1", _csrf: csrf } });
check("valid draft saves", save.status === 200, String(save.status));
const stale = await owner.req(editorPath, { method: "POST", form: { intent: "save", document: JSON.stringify(doc), baseVersion: "1", _csrf: csrf } });
check("stale version → 409 conflict", stale.status === 409, String(stale.status));

// --- Publish / public page --------------------------------------------------------------------
const pub = await owner.req(editorPath, { method: "POST", form: { intent: "publish", _csrf: csrf } });
check("publish ok", pub.status === 200, String(pub.status));
const pubRes = await anon.req(`/@${handle}`);
const pubHtml = await pubRes.text();
check("public page 200", pubRes.status === 200);
check("public page escapes HTML", pubHtml.includes("Testing &lt;b&gt;escape&lt;/b&gt;") && !pubHtml.includes("<b>escape</b>"));
check("public page has canonical", pubHtml.includes(`rel="canonical" href="${ORIGIN}/@${handle}"`));
check("public page doesn't leak owner email", !pubHtml.includes(email));
check("/@/handle redirects to /@handle", (await anon.req(`/@/${handle}`)).headers.get("location") === `/@${handle}`);

// Draft changes don't leak
const draft2 = { ...doc, blocks: [...doc.blocks, { id: "text000001", type: "text", body: "SECRET-DRAFT-TEXT" }] };
await owner.req(editorPath, { method: "POST", form: { intent: "save", document: JSON.stringify(draft2), baseVersion: "2", _csrf: csrf } });
check("unpublished draft edits not public", !(await (await anon.req(`/@${handle}`)).text()).includes("SECRET-DRAFT-TEXT"));

// --- Analytics -----------------------------------------------------------------------------------
const ua = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36" };
const view = await anon.req("/api/events", { method: "POST", json: { h: handle, t: "view", r: "https://news.example.org/x" }, headers: ua });
check("view beacon accepted", view.status === 204);
await anon.req("/api/events", { method: "POST", json: { h: handle, t: "click", b: "link000001" }, headers: ua });
await anon.req("/api/events", { method: "POST", json: { h: handle, t: "click", b: "doesnotexist" }, headers: ua });
const analyticsHtml = await (await owner.req(`/analytics/${profileId}`)).text();
check("analytics shows referrer domain", analyticsHtml.includes("news.example.org"));
check("analytics shows link label", analyticsHtml.includes("A link"));

// --- Comments ------------------------------------------------------------------------------------
const commenterCsrf = intruderCsrf;
const offComment = await intruder.req(`/@${handle}`, { method: "POST", form: { intent: "comment", body: "hi", _csrf: commenterCsrf } });
check("comment refused while disabled", offComment.status === 403, String(offComment.status));
await owner.req(editorPath, { method: "POST", form: { intent: "settings", commentsEnabled: "true", _csrf: csrf } });
const anonComment = await anon.req(`/@${handle}`, { method: "POST", form: { intent: "comment", body: "hi" } });
check("anonymous comment refused", anonComment.status === 401, String(anonComment.status));
const okComment = await intruder.req(`/@${handle}`, { method: "POST", form: { intent: "comment", body: "<img src=x onerror=alert(1)> nice page", _csrf: commenterCsrf } });
check("signed-in comment accepted", okComment.status === 200, String(okComment.status));
const withComment = await (await anon.req(`/@${handle}`)).text();
check("comment rendered escaped", withComment.includes("&lt;img src=x onerror=alert(1)&gt; nice page"));
check("commenter email not exposed", !withComment.includes(`intruder-${rand}@example.com`));

// --- Upload validation -------------------------------------------------------------------------------
const svg = new FormData();
svg.append("file", new Blob(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"], { type: "image/png" }), "x.png");
const svgRes = await fetch(BASE + "/api/media", { method: "POST", body: svg, headers: { origin: ORIGIN, cookie: [...owner.cookies].map(([k, v]) => `${k}=${v}`).join("; "), "x-csrf-token": csrf } });
check("disguised SVG upload rejected", svgRes.status === 415, String(svgRes.status));
const png = new FormData();
png.append("file", new Blob([Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0))], { type: "image/png" }), "x.png");
const pngRes = await fetch(BASE + "/api/media", { method: "POST", body: png, headers: { origin: ORIGIN, cookie: [...owner.cookies].map(([k, v]) => `${k}=${v}`).join("; "), "x-csrf-token": csrf } });
const pngJson = await pngRes.json().catch(() => ({}));
check("PNG upload accepted", pngRes.status === 201 && !!pngJson.id, String(pngRes.status));
if (pngJson.id) {
  const m = await anon.req(`/media/${pngJson.id}`);
  check("media served with nosniff + image type", m.status === 200 && m.headers.get("content-type") === "image/png" && m.headers.get("x-content-type-options") === "nosniff");
}

// --- Unpublish → 410 ---------------------------------------------------------------------------------
await owner.req(editorPath, { method: "POST", form: { intent: "unpublish", _csrf: csrf } });
check("unpublished page → 410", (await anon.req(`/@${handle}`)).status === 410);

// --- Logout ---------------------------------------------------------------------------------------------
const getLogout = await owner.req("/logout");
check("GET /logout does not sign out", getLogout.status === 302 && (await owner.req("/dashboard")).status === 200);
await owner.req("/logout", { method: "POST", form: { _csrf: csrf } });
check("POST /logout signs out", (await owner.req("/dashboard")).status === 302);

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
