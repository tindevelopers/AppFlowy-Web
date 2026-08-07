<!-- BEGIN GENERATED:main -->
# AppFlowy Project Family — Identification & How To Use

This document identifies the projects that make up the Tin AppFlowy deployment and explains
how to use each one. Everything talks to the same hosted portal, **`https://projects.tinconnect.com`**
(self-hosted AppFlowy Cloud on a Hetzner VPS).

## Quick overview

| Project | Local path | Remote repo | What it is |
|---------|-----------|-------------|------------|
| **AppFlowy Web** | `appflowy-web` | `tindevelopers/AppFlowy-Web` | Frontend web app (React/TS/Vite) |
| **AppFlowy Cloud** | `appflowy-cloud` | `tindevelopers/AppFlowy-Cloud` | Backend (Rust, actix-web) |
| **app-flowy-tin** | `app-flowy-tin` | `tindevelopers/app-flowy-tin` | Agent tooling (CLI + MCP) |
| **doc-sync / collab-sync** | `appflowy-web/tools/doc-sync` | part of AppFlowy-Web | Markdown ↔ workspace page sync |
| **tin-mcp** | `appflowy-web/tools/tin-mcp` | part of AppFlowy-Web | MCP server for IDE agents |

## 1. AppFlowy Web (`appflowy-web`)

The browser client. React + TypeScript + Vite, Tailwind CSS, pnpm. Deployed to **Vercel**
(trunk-based: merge to `main` → auto-deploy to `https://projects.tinconnect.com`).

- `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm type-check && pnpm lint`
- Structure: `src/`, `api/`, `tools/` (doc-sync, tin-mcp), `playwright/`, `deploy/`

## 2. AppFlowy Cloud (`appflowy-cloud`)

The backend. Rust + actix-web, Postgres, SQLx. Deployed to Hetzner VPS via **GHCR + Watchtower**.

- `make run`, `make test`
- Services: `appflowy-collaborate`, `appflowy-worker`, `ai-proxy`
- Docs: `doc/LOCAL_BUILD.md`, `doc/DEPLOYMENT.md`, `doc/AUTHENTICATION.md`

## 3. app-flowy-tin (`app-flowy-tin`) — Agent tooling

Structural REST operations only (no Yjs/CRDT body writes). Contains Go CLI `appflowy-pp-cli`,
MCP `appflowy-pp-mcp`, an `importer/`, and a TS `appflowy-mcp`.

- One-command setup: `curl .../setup-new-machine.sh | bash`
- Manual: `go build -o appflowy-pp-cli ./cmd/appflowy-pp-cli`, then `./appflowy-pp-cli workspace list --json`

## 4. doc-sync / collab-sync

Rust tool syncing workspace pages with markdown in a git repo, in place via section markers.
- `cargo build`
- `collab-sync list <workspace_id>`, `seed <view_id> <file.md>`, `sync <view_id> <file.md> --section main --backup`, `sync --all --manifest manifest.json --backup`, `restore <view_id> <backup.bin>`

## 5. tin-mcp

MCP server for IDE agents. Auth is a single `afk_` API key (Settings → API access).
- `droid mcp add tin-mcp --env TIN_MCP_API_KEY=afk_... -- tin-mcp serve`

## Relationship

```
[AppFlowy Web] (browser UI, Vercel)
      │  REST + collab
      ▼
[AppFlowy Cloud] (Rust backend, Hetzner VPS)
      ▲
      │  structural REST / document collab
      │
[app-flowy-tin] ─ CLI + MCP   [tin-mcp] ─ MCP   [doc-sync/collab-sync] ─ markdown sync
```

All five talk to the same portal at `https://projects.tinconnect.com`.
<!-- END GENERATED:main -->
