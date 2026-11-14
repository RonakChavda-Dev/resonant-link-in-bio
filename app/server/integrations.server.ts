// Optional third-party integrations. Each is OFF unless its configuration is
// present, and the UI reports the real state instead of pretending.
import type { CloudflareBindings } from "./context";
import { clientIp } from "./request.server";

type AppEnv = CloudflareBindings["env"];

// --- Email-and-password accounts ---------------------------------------------

/**
 * False when the deployment sets PASSWORD_AUTH="off" (e.g. on the Workers Free
 * plan, whose CPU limit is far below one Argon2id hash). Every password route
 * and action checks this server-side; the UI only mirrors it.
 */
export function passwordAuthEnabled(env: AppEnv): boolean {
  return env.PASSWORD_AUTH !== "off";
}

export const PASSWORD_AUTH_OFF_MESSAGE =
  "Email and password accounts are still in development. Please continue with Google for now.";

// --- Turnstile --------------------------------------------------------------

export function turnstileSiteKey(env: AppEnv): string | null {
  return env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY ? env.TURNSTILE_SITE_KEY : null;
}

/** Returns true when Turnstile is disabled, or when the token validates server-side. */
export async function verifyTurnstile(env: AppEnv, request: Request, form: FormData): Promise<boolean> {
  if (!turnstileSiteKey(env)) return true;
  const token = form.get("cf-turnstile-response");
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY!);
  body.append("response", token);
  const ip = clientIp(request);
  if (ip !== "local") body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const result = (await res.json()) as { success?: boolean; hostname?: string };
    return result.success === true;
  } catch {
    return false;
  }
}

// --- Email ------------------------------------------------------------------

export type MailMode = "resend" | "dev-console" | "unavailable";

export function mailMode(env: AppEnv): MailMode {
  if (env.RESEND_API_KEY && env.MAIL_FROM) return "resend";
  if (env.APP_ENV === "development") return "dev-console";
  return "unavailable";
}

export async function sendMail(
  env: AppEnv,
  message: { to: string; subject: string; text: string },
): Promise<boolean> {
  const mode = mailMode(env);
  if (mode === "dev-console") {
    // Development only: print to the local terminal instead of sending.
    console.log(`\n[dev mail] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
    return true;
  }
  if (mode === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  return false;
}
