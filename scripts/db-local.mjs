// Starts a throwaway local PostgreSQL for development (no Docker or system
// install needed). Data lives in .data/postgres (git-ignored).
// Connection: postgres://resonant:resonant@127.0.0.1:54329/resonant
// This is a local-only credential. Production uses Hyperdrive + secrets.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dataDir = resolve(".data/postgres");
const fresh = !existsSync(resolve(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "resonant",
  password: "resonant",
  port: 54329,
  persistent: true,
  onLog: () => {},
});

if (fresh) {
  console.log("Initialising local Postgres in .data/postgres …");
  await pg.initialise();
}
await pg.start();
if (fresh) await pg.createDatabase("resonant");

console.log("Local Postgres ready on 127.0.0.1:54329 (db: resonant). Ctrl+C to stop.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
