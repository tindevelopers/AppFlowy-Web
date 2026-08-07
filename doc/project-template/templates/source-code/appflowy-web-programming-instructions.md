<!-- BEGIN GENERATED:main -->
# Programming Instructions — AppFlowy Web

> The thorough README for the AppFlowy Web product project. Everything an engineer needs
> to build, run, test, and deploy.

## Stack

- Language / runtime: TypeScript / Node.js (Bun)
- Framework: React 18 + Vite
- Styling: Tailwind CSS
- Backend: AppFlowy Cloud (Rust, actix-web) at `projects.tinconnect.com`
- Package manager: pnpm (lockfile `pnpm-lock.yaml`)

## Repository

- Repo URL: `https://github.com/tindevelopers/AppFlowy-Web` (local: `/Users/gene/Projects/appflowy-web`)
- Branch strategy: trunk-based — merge to `main` → Vercel deploy
- Directory layout:
  - `src/` — React app (pages, components, lib, i18n, proto, styles)
  - `api/` — server API layer (link-preview, `_lib`)
  - `tools/` — `doc-sync` (collab-sync), `tin-mcp`
  - `playwright/` — e2e (BDD + specs, fixtures, support)
  - `deploy/`, `docker/` — deployment assets

## Environment setup

1. Prerequisites: Node.js + pnpm (or Bun).
2. Install dependencies: `pnpm install`
3. Configure environment: copy `dev.env` / `deploy.env` guidance; AppFlowy Cloud base URL
   is `https://projects.tinconnect.com`. Secrets (GoTrue credentials, API keys) are stored
   in `tools/doc-sync/.env` — never commit.
4. Verify: `pnpm dev` and open the local dev server.

## Build

```bash
pnpm build
```

## Run locally

```bash
pnpm dev          # start dev server with live reload
pnpm dev:server   # server-only dev
```

## Test

```bash
pnpm test                     # unit tests
pnpm test:e2e                 # Playwright end-to-end
pnpm test:http-api            # HTTP API contract tests
pnpm type-check               # TypeScript type check
pnpm lint                     # ESLint
```

## Deploy

- Pipeline: push to `main` → Vercel (frontend); backend deploys via GHCR + Watchtower.
- Deployed at: `https://projects.tinconnect.com`
- Backend repo: `/Users/gene/Projects/appflowy-cloud`

## Conventions

- Formatter: Prettier (`.prettierrc.cjs`)
- Linter: ESLint (`.eslintrc.cjs`)
- Testing: Jest for unit, Playwright for e2e/BDD
- Commit style: conventional (e.g. `test(tin-mcp): ...`, `feat: ...`)

## Troubleshooting

- Publish/share scope regressions: see `playwright/e2e/publish/share-scope-privacy.spec.ts`.
- API key provisioning: `scripts/appflowy-cli.js` (token from `APPFLOWY_TOKEN` or `.appflowy-token`).
- Config test hermeticity (tin-mcp): `tools/tin-mcp/crates/tin-doc-core/src/config.rs`.
<!-- END GENERATED:main -->
