# AppFlowy Project Family — Identification & How To Use

This document identifies the projects that make up the Tin AppFlowy deployment and explains
how to use each one. Everything talks to the same hosted portal, **`https://projects.tinconnect.com`**
(self-hosted AppFlowy Cloud on a Hetzner VPS).

Local repos live under `/Users/gene/Projects/`. Each is an independent git repository with its
own deploy pipeline.

---

## Quick overview

| Project | Local path | Remote repo | What it is |
|---------|-----------|-------------|------------|
| **AppFlowy Web** | `appflowy-web` | `github.com/tindevelopers/AppFlowy-Web` | Frontend web app (React/TS/Vite) |
| **AppFlowy Cloud** | `appflowy-cloud` | `github.com/tindevelopers/AppFlowy-Cloud` | Backend (Rust, actix-web) |
| **app-flowy-tin** | `app-flowy-tin` | `github.com/tindevelopers/app-flowy-tin` | Agent tooling (CLI + MCP) that talks to the Cloud |
| **doc-sync / collab-sync** | `app-flowy-tin/doc-sync` | part of app-flowy-tin | Markdown ↔ workspace page sync tool |
| **tin-projects.mcp** | `app-flowy-tin/tin-projects-mcp` | part of app-flowy-tin | MCP server for IDE agents |

The deployed, user-facing product is the **AppFlowy Web** app served by **AppFlowy Cloud**.
The **agent tools**, **collab-sync**, and **tin-projects.mcp** are developer/AI tooling layered on top.

---

## 1. AppFlowy Web (`appflowy-web`)

The browser client. React + TypeScript + Vite, Tailwind CSS, pnpm. Deployed to **Vercel**
(trunk-based: merge to `main` → auto-deploy to `https://projects.tinconnect.com`).

**Structure:**
- `src/` — React app (pages, components, lib, i18n, proto, styles)
- `api/` — server API layer (link-preview, `_lib`)
- `tools/` — `doc-sync` and `tin-projects.mcp` (see below)
- `playwright/` — e2e tests (BDD + specs)
- `deploy/`, `docker/` — deployment assets

**How to use:**
```bash
cd appflowy-web
pnpm install          # install dependencies
pnpm dev              # local dev server
pnpm dev:server       # server-only dev
pnpm build            # production build
pnpm test             # unit tests
pnpm test:e2e         # Playwright end-to-end
pnpm type-check && pnpm lint
```

Deploy: push to `main` → Vercel. The backend is the AppFlowy Cloud instance (below).

---

## 2. AppFlowy Cloud (`appflowy-cloud`)

The backend that AppFlowy Web talks to. Rust + actix-web, Postgres, SQLx. Deployed to the
Hetzner VPS via **GHCR + Watchtower** (push to `main` → GHCR build → auto-deploy).

**Structure:**
- `services/` — runnable services: `appflowy-collaborate` (main), `appflowy-worker`, `ai-proxy`
- `migrations/` — SQLx migrations
- `admin_frontend/` — admin panel
- `docker/`, `docker-compose*.yml` — deployment orchestration
- `doc/` — deployment, local-build, and auth guides

**How to use:**
```bash
cd appflowy-cloud
make run     # run local server (script/run_local_server.sh)
make test    # run local tests (script/run_local_test.sh)
```

Key local docs: `doc/LOCAL_BUILD.md`, `doc/DEPLOYMENT.md`, `doc/AUTHENTICATION.md`,
`doc/SELF_HOST_GUIDE.md`. Env templates: `dev.env`, `deploy.env`, `env.dev.secret.example`,
`env.deploy.secret.example`.

---

## 3. app-flowy-tin (`app-flowy-tin`) — Agent tooling

The integration layer that lets AI agents / CLIs safely manage the portal. It only performs
**structural** REST operations (workspace, page/view, search, members, invites, publish,
trash) and deliberately **excludes Yjs/CRDT body-content write endpoints** to avoid corruption.

**Sub-projects inside:**
- `appflowy-agent-tools/` — a Go CLI (`appflowy-pp-cli`) and MCP server (`appflowy-pp-mcp`),
  plus an `importer/` for seeding markdown into the workspace.
- `appflowy-mcp/` — a TypeScript MCP server.
- `appflowy-api-spec.yaml` — OpenAPI spec of the structural API.

**How to use (one-command new-machine setup):**
```bash
curl -fsSL https://raw.githubusercontent.com/tindevelopers/app-flowy-tin/main/appflowy-agent-tools/scripts/setup-new-machine.sh | bash
```
Authenticate non-interactively with `APPFLOWY_EMAIL` / `APPFLOWY_PASSWORD`, or `APPFLOWY_TOKEN=afk_...`.
Afterward, agent tools `appflowy__*` are registered and write to `projects.tinconnect.com`.

**Manual CLI usage:**
```bash
cd app-flowy-tin/appflowy-agent-tools
go build -o appflowy-pp-cli ./cmd/appflowy-pp-cli
go build -o appflowy-pp-mcp ./cmd/appflowy-pp-mcp

./appflowy-pp-cli workspace list --json
./appflowy-pp-cli appflowy-cloud-search --workspace-id <uuid> --query "meeting notes" --json
```

---

## 4. doc-sync / collab-sync (`app-flowy-tin/doc-sync`)

A Rust tool that keeps AppFlowy workspace pages in sync with markdown files in a git repo.
It updates pages **in place** (preserving view IDs, comments, and human edits) by replacing
only content between `<!-- BEGIN GENERATED:<key> -->` / `<!-- END GENERATED:<key> -->` markers.
Backups are taken before every write by default.

**Prerequisites:** Rust toolchain; credentials in `tools/doc-sync/.env`
(`APPFLOWY_EMAIL`, `APPFLOWY_PASSWORD`, `APPFLOWY_BASE_URL`, or `APPFLOWY_TOKEN`).

**How to use:**
```bash
cd app-flowy-tin/doc-sync/collab-sync
cargo build

./target/debug/collab-sync list <workspace_id>                    # print page hierarchy + view IDs
./target/debug/collab-sync seed <view_id> <file.md>               # initial full write of a page
./target/debug/collab-sync sync <view_id> <file.md> --section main --backup
./target/debug/collab-sync sync --all --manifest manifest.json --backup
./target/debug/collab-sync restore <view_id> <backup.bin>
```

Related: the repo's **project template** (`doc/project-template/`) defines the standard
page set, and `provision.sh` provisions a project space (space + pages + seeded content)
using `collab-sync`. `docs/` in the repo is gitignored; `doc/` is tracked.

---

## 5. tin-projects.mcp (`app-flowy-tin/tin-projects-mcp`)

A turnkey MCP server for IDE agents (Factory Droid, Claude Desktop, Claude Code) to read and
write pages/workspaces on `projects.tinconnect.com`. Auth is a single `afk_` API key created in
**Settings → API access** (shown once).

**How to use:**
```bash
# Prerequisite: create an afk_ key in the web app Settings → API access.

# Factory Droid
curl -fsSL https://github.com/tindevelopers/tin-projects.mcp/releases/latest/download/install.sh | sh
droid mcp add tin-projects.mcp --env TIN_MCP_API_KEY=afk_... -- tin-projects.mcp serve

# Claude Code
claude mcp add tin-projects.mcp --env TIN_MCP_API_KEY=afk_... -- tin-projects.mcp serve

# Claude Desktop: download tin-projects-mcp.mcpb and double-click; prompt for API key.
```
Tools include `appflowy_server_info`, `appflowy_list_workspaces`, `appflowy_get_page_tree`,
`appflowy_read_page`, and write tools with optimistic concurrency (`doc_state_hash`).

---

## Relationship summary

```
  [AppFlowy Web] (browser UI, Vercel)
        │  REST + collab
        ▼
  [AppFlowy Cloud] (Rust backend, Hetzner VPS)
        ▲
        │  structural REST / document collab
        │
  [app-flowy-tin] ─ agent CLI + MCP   [tin-projects.mcp] ─ MCP   [doc-sync/collab-sync] ─ markdown sync
```

All five talk to the same portal at `https://projects.tinconnect.com`. Which one you use
depends on what you're doing: browse/edit → **Web**; API/backend work → **Cloud**;
agent/automation → **app-flowy-tin**, **tin-projects.mcp**, or **doc-sync**.
