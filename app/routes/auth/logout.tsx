import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { destroySession, verifyCsrf } from "~/server/session.server";

// Sign-out is POST-only (with the session's CSRF token) so other sites can't
// log people out with a link or image.
export function loader() {
  throw redirect("/");
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  if (!verifyCsrf(context, form.get("_csrf"))) throw redirect("/");
  const cookie = await destroySession(context);
  throw redirect("/", { headers: { "Set-Cookie": cookie } });
}
