// Server-only data access entry point. Every query goes through postgres.js
// tagged templates, which send values as bind parameters (never string
// concatenation). A client is created lazily per request; Hyperdrive pools the
// underlying connections, so per-request clients are the recommended pattern.
import postgres, { type Sql } from "postgres";
import type { RouterContextProvider } from "react-router";
import { cloudflareContext, requestMetaContext, type DbHolder } from "./context";

export function createDbHolder(env: Env): DbHolder {
  let sql: Sql | null = null;
  return {
    get() {
      sql ??= postgres(env.HYPERDRIVE.connectionString, {
        max: 5,
        fetch_types: false,
        idle_timeout: 5,
        connect_timeout: 10,
        onnotice: () => {},
      });
      return sql;
    },
    async close() {
      if (sql) {
        const current = sql;
        sql = null;
        await current.end({ timeout: 5 });
      }
    },
  };
}

type Ctx = Readonly<RouterContextProvider>;

export function db(context: Ctx): Sql {
  return context.get(requestMetaContext).db.get();
}

export function getEnv(context: Ctx) {
  return context.get(cloudflareContext).env;
}

export function getExecutionContext(context: Ctx) {
  return context.get(cloudflareContext).ctx;
}

/** APP_SECRET is required everywhere except it may be absent in dev before setup. */
export function appSecret(context: Ctx): string {
  const secret = getEnv(context).APP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("APP_SECRET is missing or shorter than 32 characters. See .dev.vars.example.");
  }
  return secret;
}
