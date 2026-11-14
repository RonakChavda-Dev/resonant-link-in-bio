import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // Marketing & documentation
  layout("routes/marketing/layout.tsx", [
    index("routes/marketing/home.tsx"),
    route("features", "routes/marketing/features.tsx"),
    route("templates", "routes/marketing/templates.tsx"),
    route("templates/:templateId", "routes/marketing/template-preview.tsx"),
    route("how-it-works", "routes/marketing/how-it-works.tsx"),
    route("security", "routes/marketing/security.tsx"),
    route("privacy", "routes/marketing/privacy.tsx"),
  ]),

  // Account flows
  layout("routes/auth/layout.tsx", [
    route("login", "routes/auth/login.tsx"),
    route("signup", "routes/auth/signup.tsx"),
    route("forgot-password", "routes/auth/forgot-password.tsx"),
    route("reset-password", "routes/auth/reset-password.tsx"),
  ]),
  route("logout", "routes/auth/logout.tsx"),
  route("auth/google", "routes/auth/google.ts"),
  route("auth/google/callback", "routes/auth/google-callback.ts"),

  // Creator workspace (authorization enforced server-side in each loader/action)
  layout("routes/workspace/layout.tsx", [
    route("dashboard", "routes/workspace/dashboard.tsx"),
    route("dashboard/new", "routes/workspace/new-profile.tsx"),
    route("analytics/:profileId", "routes/workspace/analytics.tsx"),
    route("settings", "routes/workspace/settings.tsx"),
  ]),
  route("editor/:profileId", "routes/workspace/editor.tsx"),

  // Resource routes
  route("api/media", "routes/api/media-upload.ts"),
  route("api/events", "routes/api/events.ts"),
  route("media/:mediaId", "routes/api/media.ts"),
  route("sitemap.xml", "routes/api/sitemap.ts"),
  route("robots.txt", "routes/api/robots.ts"),
  route("sandbox", "routes/api/sandbox.ts"),

  // Public profiles: canonical /@handle, with /@/handle redirecting to it.
  route("@/:handle", "routes/profile-redirect.ts"),
  route(":handle", "routes/profile.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
