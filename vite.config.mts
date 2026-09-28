import react from "@vitejs/plugin-react";
import crypto from "crypto";
import { fileURLToPath } from "node:url";
import path from "path";
import { defineConfig } from "vite";

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(CONFIG_DIR, "./src");
const PUBLIC_DIR = path.resolve(CONFIG_DIR, "./public");
const BUILD_DIR = path.resolve(CONFIG_DIR, "./www");

export default defineConfig({
  plugins: [react()],
  root: SRC_DIR,
  // GitHub Pages serves this repo at https://reedable.github.io/lliwio-app/.
  // Kept the same in dev so the dev server URL matches production; vite prints
  // http://localhost:5173/lliwio-app/ on start.
  base: "/lliwio-app/",
  publicDir: PUBLIC_DIR,
  build: {
    outDir: BUILD_DIR,
    assetsInlineLimit: 0,
    emptyOutDir: true,
    rollupOptions: {
      treeshake: false,
    },
  },
  resolve: {
    alias: {
      "@": SRC_DIR,
    },
  },
  server: {
    host: true,
  },
  css: {
    modules: {
      // generateScopedName: "[name]__[local]___[hash:base64:5]",
      generateScopedName: (name, filename, css) => {
        const baseName = path.basename(filename, ".css");
        const cleanName = baseName.split(".")[0];
        const hash = crypto.createHash("md5").update(css).digest("base64url").substring(0, 5);
        return `__lliwio_${cleanName}_${name}_${hash}`;
      },
    },
  },
});
