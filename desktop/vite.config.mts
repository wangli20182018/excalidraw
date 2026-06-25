import path from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";

import { woff2BrowserPlugin } from "../scripts/woff2/woff2-vite-plugins";

// Tauri runs the dev server on a fixed port and expects strictPort so it can
// hook the webview up to it reliably.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // Tauri requires a deterministic dev port; allow host override for mobile.
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    fs: {
      // allow importing from the monorepo root (packages/* live one level up)
      allow: [".."],
    },
  },
  resolve: {
    alias: [
      // Resolve internal @excalidraw/* packages to SOURCE so the desktop shell
      // stays in sync with the monorepo without building packages first.
      {
        find: /^@excalidraw\/common$/,
        replacement: path.resolve(__dirname, "../packages/common/src/index.ts"),
      },
      {
        find: /^@excalidraw\/common\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/common/src/$1"),
      },
      {
        find: /^@excalidraw\/element$/,
        replacement: path.resolve(__dirname, "../packages/element/src/index.ts"),
      },
      {
        find: /^@excalidraw\/element\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/element/src/$1"),
      },
      {
        find: /^@excalidraw\/excalidraw$/,
        replacement: path.resolve(__dirname, "../packages/excalidraw/index.tsx"),
      },
      {
        find: /^@excalidraw\/excalidraw\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/excalidraw/$1"),
      },
      {
        find: /^@excalidraw\/math$/,
        replacement: path.resolve(__dirname, "../packages/math/src/index.ts"),
      },
      {
        find: /^@excalidraw\/math\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/math/src/$1"),
      },
      {
        find: /^@excalidraw\/utils$/,
        replacement: path.resolve(__dirname, "../packages/utils/src/index.ts"),
      },
      {
        find: /^@excalidraw\/utils\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/utils/src/$1"),
      },
      {
        find: /^@excalidraw\/fractional-indexing$/,
        replacement: path.resolve(
          __dirname,
          "../packages/fractional-indexing/src/index.ts",
        ),
      },
      {
        find: /^@excalidraw\/laser-pointer$/,
        replacement: path.resolve(
          __dirname,
          "../packages/laser-pointer/src/index.ts",
        ),
      },
    ],
  },
  plugins: [
    woff2BrowserPlugin(),
    react(),
    svgrPlugin(),
  ],
  // serve the monorepo's public/ at dev-server root (fonts: Virgil.woff2,
  // Cascadia.woff2, Assistant-Regular.woff2; app icons) so the dynamic font
  // loader (EXCALIDRAW_ASSET_PATH = window.origin) resolves them locally
  // instead of falling back to the esm.sh CDN.
  publicDir: "../public",
  build: {
    outDir: "dist",
    target: "esnext",
    sourcemap: true,
  },
  clearScreen: false,
});
