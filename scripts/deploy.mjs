// Build and deploy one Cloudflare environment: node scripts/deploy.mjs <preview|production> [--dry-run]
// The Cloudflare Vite plugin bakes the environment's bindings and vars into
// build/server/wrangler.json at build time (selected by CLOUDFLARE_ENV), and
// `wrangler deploy` then uses that generated file — passing `--env` to
// wrangler afterwards does NOT switch environments.
import { spawnSync } from "node:child_process";

const [target, ...rest] = process.argv.slice(2);
if (target !== "preview" && target !== "production") {
  console.error("Usage: node scripts/deploy.mjs <preview|production> [--dry-run]");
  process.exit(1);
}
const env = { ...process.env, CLOUDFLARE_ENV: target };
const run = (args) => {
  const r = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(["node_modules/@react-router/dev/bin.cjs", "build"]);
run(["node_modules/wrangler/bin/wrangler.js", "deploy", ...rest]);
