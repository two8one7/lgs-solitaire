import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";

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
