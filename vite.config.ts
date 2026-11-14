import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Pre-declare deps so the first dev request doesn't trigger a mid-request
// re-optimisation (which briefly loads two React copies).
const sharedDeps = ["zod", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"];

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
  optimizeDeps: { include: sharedDeps },
  environments: {
    ssr: { optimizeDeps: { include: [...sharedDeps, "postgres", "isbot", "@noble/hashes/argon2.js"] } },
  },
});
