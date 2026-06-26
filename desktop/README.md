你是在做：

👉 AI Native Spatial Operating System

它的本质是：

用空间结构驱动“知识 + 内容 + 生产 + 执行”

# Desktop Shell (Tauri × Excalidraw)

Phase 1 / P0 scaffold. Excalidraw is embedded as the **pure spatial engine**; cards / overlay / runtime land in later phases.

## Structure
```
desktop/
├─ src/                 React frontend (embeds <Excalidraw>)
├─ src-tauri/           Rust shell (needs Rust toolchain to build)
├─ index.html
├─ vite.config.mts      @excalidraw/* → source aliases
└─ tsconfig.json
```

## A. Frontend only (no Rust needed) — verifies Excalidraw integration
```bash
# from repo root
yarn install
yarn workspace desktop dev      # http://localhost:1420
```
Open http://localhost:1420 — the Excalidraw editor should render.

## B. Full Tauri desktop (needs Rust)
1. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Add JS deps (once): add to `desktop/package.json` devDeps
   `@tauri-apps/cli`, `@tauri-apps/api`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, then `yarn install`.
3. Generate icons (one-time, needs a 1024×1024 source PNG):
   `yarn workspace desktop tauri icon <path-to-png>`
   (or drop icons into `src-tauri/icons/`).
4. Run:
   ```bash
   yarn workspace desktop tauri dev     # desktop window + hot reload
   yarn workspace desktop tauri build   # production bundle
   ```

## Notes
- `@excalidraw/*` resolves to monorepo source (see `vite.config.mts`), so no package build is required.
- PWA / Service Worker and cloud env (Firebase / Sentry / Excalidraw+) are intentionally stripped — this is a local-first desktop shell.
- `convertFileSrc()` (Tauri) will be wired in P3 for local media playback.
