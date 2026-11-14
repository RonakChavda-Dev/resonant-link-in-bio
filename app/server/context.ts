// Typed request context shared between the Worker entry, middleware, loaders
// and actions. Imported by both server and (type-only) client code, so it must
// not import server-only modules.
import { createContext } from "react-router";
import type { Sql } from "postgres";

export interface CloudflareBindings {
  env: Env & OptionalSecrets;
  ctx: ExecutionContext;
}

export interface OptionalSecrets {
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export interface DbHolder {
  get(): Sql;
  close(): Promise<void>;
}

export interface RequestMeta {
  /** Per-response CSP nonce for inline scripts emitted by React Router. */
  nonce: string;
  secure: boolean;
  db: DbHolder;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

export interface SessionInfo {
  /** sha256 digest of the cookie token (the sessions.id primary key). */
  id: string;
  csrfToken: string;
  user: SessionUser;
}

export const cloudflareContext = createContext<CloudflareBindings>();
export const requestMetaContext = createContext<RequestMeta>();
export const sessionContext = createContext<SessionInfo | null>(null);
