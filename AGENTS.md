# AGENTS.md

Compact guide for working in this repo. Verified against `package.json`, configs, and CI.

## Commands

Verification mirrors CI (`.github/workflows/lint.yml` + `test.yml`). Run before considering work done:

```bash
yarn test:other      # prettier --list-different (format check)
yarn test:code       # eslint --max-warnings=0  (warnings = errors)
yarn test:typecheck  # tsc over the whole repo (root tsconfig path aliases)
yarn test:app        # vitest — WATCH MODE by default (see below)
yarn fix             # prettier --write && eslint --fix
```

- `yarn test` / `yarn test:app` open **vitest watch mode**. For one-shot, add `--watch=false` (this is what `yarn test:all` and `yarn test:update` do).
- Run a single test: `yarn test:app <path-or-pattern>` (still watch mode) or `yarn test:app --watch=false packages/excalidraw/tests/clipboard.test.tsx`.
- Update snapshots: `yarn test:update` (= `test:app --update --watch=false`). Run this whenever snapshots change.
- Typecheck is repo-wide via root `tsconfig.json` path mappings — there is no per-package typecheck script.

## Repo layout

Yarn workspaces monorepo. Internal `@excalidraw/*` packages resolve to **source** (`src/index.ts`) via TS path aliases and `vitest.config.mts` aliases — so dev and tests do **not** require building packages.

- `packages/excalidraw/` — the published `@excalidraw/excalidraw` React component library. Entry: `index.tsx`.
- `excalidraw-app/` — excalidraw.com web app (Vite). `yarn start` runs it.
- `packages/{common,element,math,utils,fractional-indexing,laser-pointer}` — core libraries consumed by the editor.
- `examples/` — integration examples (not typechecked/linted with the rest; excluded in tsconfig).

`build:packages` order matters (dependency chain): `common → fractional-indexing → laser-pointer → math → element → excalidraw`. Packages build via esbuild (`scripts/buildPackage.js` / `buildBase.js`) producing `dist/dev` + `dist/prod`; types via `tsc --emitDeclarationOnly`.

## Conventions that are enforced (will fail CI)

- **Never import `jotai` directly.** Use `editor-jotai` (`packages/excalidraw/editor-jotai.ts`) inside the editor, or `app-jotai` inside `excalidraw-app/`. Enforced by `no-restricted-imports`.
- **Inside `packages/excalidraw/`, do not import from the barrel** (`@excalidraw/excalidraw` index). Use direct relative imports; type-only barrel imports are allowed. Enforced by an override in `.eslintrc.json`.
- **Type imports must be separate.** `@typescript-eslint/consistent-type-imports` with `fixStyle: separate-type-imports` — write `import type { Foo } from "..."`, not inline `import { type Foo }`.
- `import/order` requires `newlines-between: always-and-inside-groups`; `@excalidraw/**` is grouped as external (after node/3rd-party, blank line separating).
- For math code, use the `Point` type from `packages/math/src/types.ts`, not `{ x, y }`.
- Pre-commit husky hook exists but is commented out — do not rely on it; CI is the gate.

## PR / release flow

- **PR titles must be semantic with a required scope**: `app`, `editor`, `packages/excalidraw`, `packages/utils`, `docker`, or `repo` (e.g. `feat(editor): add foo`). Enforced by `semantic-pr-title.yml`; add label `skip-semantic-title` to bypass.
- Releases are driven by `scripts/release.js`: `yarn release --tag=test|next|latest`. Pushes to the `release` branch auto-publish `next`. `--tag=latest` requires `--version=<x.y.z>`. Only `common`, `fractional-indexing`, `math`, `element`, `excalidraw` are released this way (not `utils`).

## Test environment notes

- Vitest with jsdom, globals enabled, setup in root `setupTests.ts`. It globally mocks `@excalidraw/common`'s `throttleRAF`, `fake-indexeddb`, `FontFace`/`document.fonts`, and reads font assets from disk via `file://` so snapshot/font-subsetting tests run without a server.
- Coverage thresholds are enforced: lines 60 / branches 70 / functions 63 / statements 60.
- `VITE_DEBUG_DOM=true yarn test` re-enables full DOM dumps in testing-library failure messages (stripped by default to reduce noise).

## Generated code (do not hand-edit)

- `packages/excalidraw/subset/{harfbuzz,woff2}/*-wasm.ts` are generated (base64-encoded harfbuzz + woff2 binaries) for font subsetting. Regenerate via `scripts/buildWasm.js` if inputs change (note: that script's dest paths still point to the old `fonts/wasm/` location and need aligning to `subset/` before rerunning).

## Project docs

- In-depth project docs (startup, architecture, UI layout, media-canvas refactor plan) live in [`docs/`](./docs/README.md). This file stays at repo root so agent tooling can auto-discover it.

## Environment

- Node `>=18`; CI uses Node 20. Yarn 1 (`yarn@1.22.22`, set via `packageManager`).
