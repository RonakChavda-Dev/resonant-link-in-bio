// GET /@/:handle → 301 to the canonical /@handle.
import { data, redirect } from "react-router";
import type { Route } from "./+types/profile-redirect";
import { HANDLE_PATTERN, normalizeHandle, profilePath } from "~/lib/handles";

export function loader({ params }: Route.LoaderArgs) {
  const handle = normalizeHandle(params.handle ?? "");
  if (!HANDLE_PATTERN.test(handle)) throw data("Not found", { status: 404 });
  throw redirect(profilePath(handle), 301);
}
