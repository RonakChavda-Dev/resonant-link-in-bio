// Applies pending SQL migrations from ./migrations in filename order.
// Usage: DATABASE_URL=postgres://... node scripts/migrate.mjs
// Defaults to the local development database started by `npm run db:local`.
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const url =
  process.env.DATABASE_URL ?? "postgres://resonant:resonant@127.0.0.1:54329/resonant";
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const applied = new Set((await sql`SELECT name FROM schema_migrations`).map((r) => r.name));
  const files = readdirSync(resolve("migrations"))
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(resolve("migrations", file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    console.log(`applied ${file}`);
    count++;
  }
  console.log(count ? `${count} migration(s) applied.` : "Database is up to date.");
} finally {
  await sql.end();
}
