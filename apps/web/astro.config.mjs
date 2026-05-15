import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";
import { execSync } from "child_process";

// Compute build SHA once; fall back to timestamp when git is unavailable
// (e.g. CI shallow clone). Set on process.env so it's available as
// import.meta.env.PUBLIC_BUILD_SHA in all client bundles.
let buildSha;
try {
  buildSha = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  buildSha = String(Date.now());
}
process.env.PUBLIC_BUILD_SHA = buildSha;

// Minimal Astro config for lgs-memory scaffold.
// Solid integration is included for parity with gravity-dash; v1 may drop it.
// Pixi is dedup'd because the @2817/* packages and the app share it; without
// dedupe, instanceof checks across boundaries can break.
export default defineConfig({
  output: "static",
  integrations: [solid()],
  devToolbar: { enabled: false },
  server: {
    port: 4321,
    host: true,
  },
  vite: {
    resolve: {
      dedupe: ["solid-js", "solid-js/store", "solid-js/web", "pixi.js"],
    },
    optimizeDeps: {
      include: ["solid-js", "solid-js/store", "solid-js/web"],
    },
    server: {
      allowedHosts: true,
    },
  },
});
