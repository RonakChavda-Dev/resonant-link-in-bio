// Handle rules shared by the client (instant feedback) and server (authority).
// The database enforces the same pattern with a CHECK constraint.

export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

/** Route segments and words that must never become public profile handles. */
export const RESERVED_HANDLES = new Set([
  "about", "account", "admin", "administrator", "analytics", "api", "app", "assets", "auth",
  "billing", "blog", "build", "cdn", "contact", "dashboard", "docs", "editor", "explore",
  "features", "forgot-password", "help", "home", "how-it-works", "index", "login", "logout",
  "mail", "media", "moderator", "new", "official", "pricing", "privacy", "profile", "public",
  "reset-password", "resonant", "robots", "root", "sandbox", "security", "settings", "signin", "signup",
  "sitemap", "static", "status", "staff", "support", "system", "team", "templates", "terms",
  "test", "user", "users", "verify", "www", "null", "undefined",
]);

export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

/** Returns a user-facing problem, or null when the handle is acceptable. */
export function handleProblem(handle: string): string | null {
  if (handle.length < 3) return "Handles need at least 3 characters.";
  if (handle.length > 30) return "Handles can be at most 30 characters.";
  if (!HANDLE_PATTERN.test(handle))
    return "Use lowercase letters, numbers, hyphens or underscores, starting with a letter or number.";
  if (RESERVED_HANDLES.has(handle)) return "That handle is reserved. Try another.";
  return null;
}

export function profilePath(handle: string): string {
  return `/@${encodeURIComponent(handle)}`;
}
