# Installing AppFlowy Tools & MCP in Any IDE

This guide installs the AppFlowy tooling and MCP servers on a new machine so an IDE agent
(Claude Code, Cursor, Factory Droid, Claude Desktop) can read and write to
**`https://projects.tinconnect.com`** (the self-hosted AppFlowy Cloud portal).

> **Current status (2026-08-07):** neither `AppFlowy-Web` (for `tin-mcp`) nor `app-flowy-tin`
> (for the agent tools) has **published prebuilt release binaries yet**. The one-liner
> installers below are the intended path and will work once releases are published; until
> then, use the **build-from-source** sections which are fully tested. Everything here is
> copy-pasteable.

---

## 0. Prerequisite: get an API key (once per person)

You need an `afk_` API key. It is shown **only once** at creation.

1. Open `https://projects.tinconnect.com` → **Settings → API access**.
2. Click **Create key**, give it a name (e.g. `my-laptop`).
3. **Copy the `afk_…` key immediately** and store it in your password manager.

Base URL: `https://projects.tinconnect.com` (default everywhere, no change needed).

---

## Overview of the tools

| Tool | Repo / source | What it does | Type |
|------|---------------|--------------|------|
| **appflowy-pp-cli** | `app-flowy-tin/appflowy-agent-tools` (Go) | Structural REST CLI (workspaces, pages, search, members) | CLI |
| **appflowy-pp-mcp** | `app-flowy-tin/appflowy-agent-tools` (Go) | MCP server wrapping the CLI (stdio) | MCP |
| **tin-mcp** | `appflowy-web/tools/tin-mcp` (Rust) | MCP server: read/write pages, spaces, section-marked content, backups | MCP |
| **appflowy-mcp** | `app-flowy-tin/appflowy-mcp` (TypeScript) | MCP server: create notes, search pages, manage workspace | MCP |
| **collab-sync** | `appflowy-web/tools/doc-sync/collab-sync` (Rust) | Markdown ↔ workspace page sync (marker-based, in-place) | CLI |

You typically want **one MCP server** (pick `appflowy-pp-mcp` or `tin-mcp`; both expose
AppFlowy tools). Install `tin-mcp` if you need section-marked content writes and backups;
install `appflowy-pp-mcp` if you need the structural CLI too.

---

## 1. Install `appflowy-pp-cli` + `appflowy-pp-mcp` (Go)

### 1a. One-command setup (works once releases exist)

```bash
curl -fsSL https://raw.githubusercontent.com/tindevelopers/app-flowy-tin/main/appflowy-agent-tools/scripts/setup-new-machine.sh | bash
```

Non-interactive (auto-login / existing token):
```bash
APPFLOWY_EMAIL=you@tin.info APPFLOWY_PASSWORD='your-pass' \
  curl -fsSL .../setup-new-machine.sh | bash
# or
APPFLOWY_TOKEN=afk_... curl -fsSL .../setup-new-machine.sh | bash
```

This installs both binaries, authenticates, registers the `appflowy` MCP server in
Droid / Cursor / Claude Desktop configs, and runs a write round-trip smoke test.

### 1b. Build from source (reliable today)

Requires **Go ≥ 1.22**.

```bash
git clone https://github.com/tindevelopers/app-flowy-tin.git
cd app-flowy-tin/appflowy-agent-tools

go build -o "$HOME/.local/bin/appflowy-pp-cli" ./cmd/appflowy-pp-cli
go build -o "$HOME/.local/bin/appflowy-pp-mcp" ./cmd/appflowy-pp-mcp

# verify
export PATH="$HOME/.local/bin:$PATH"
appflowy-pp-cli --version
appflowy-pp-mcp --help
```

---

## 2. Install `tin-mcp` (Rust)

### 2a. One-liner (works once releases exist)

```bash
curl -fsSL https://raw.githubusercontent.com/tindevelopers/appflowy-web/main/tools/tin-mcp/install.sh | sh
# installs to ~/.local/bin/tin-mcp
```

### 2b. Build from source (reliable today)

Requires Rust toolchain (1.96+).

```bash
# From an appflowy-web checkout:
cd /path/to/appflowy-web/tools/tin-mcp
cargo build --release
# binary at target/release/tin-mcp
cp target/release/tin-mcp "$HOME/.local/bin/tin-mcp"

# configure + verify
tin-mcp auth set-key          # prompts for afk_ key
tin-mcp doctor                # checks connectivity + auth
```

---

## 3. Install `appflowy-mcp` (TypeScript) — optional

```bash
git clone https://github.com/tindevelopers/app-flowy-tin.git
cd app-flowy-tin/appflowy-mcp
npm install
npm run build
# entry: node /abs/path/to/app-flowy-tin/appflowy-mcp/dist/index.js
```

---

## 4. Install `collab-sync` (Rust CLI for markdown sync)

```bash
git clone https://github.com/tindevelopers/AppFlowy-Web.git
cd AppFlowy-Web/tools/doc-sync/collab-sync
cargo build
# binary at target/debug/collab-sync

# credentials: create tools/doc-sync/.env with:
#   APPFLOWY_BASE_URL=https://projects.tinconnect.com
#   APPFLOWY_EMAIL=you@tin.info
#   APPFLOWY_PASSWORD=your-pass
#   (or APPFLOWY_TOKEN=afk_...)
```

Usage: see `doc/APPFLOWY_PROJECTS.md` §4 and the repo's `doc/project-template/manifest.json`.

---

## 5. Register the MCP server in your IDE

Choose the binary path you installed (below, `<MCP_CMD>` is one of:
`/path/to/appflowy-pp-mcp`, `/path/to/tin-mcp serve`, or `node /path/to/appflowy-mcp/dist/index.js`).

### 5.1 Claude Code

```bash
claude mcp add appflowy --env TIN_MCP_API_KEY=afk_... -- <MCP_CMD>
# or for appflowy-pp-mcp:
claude mcp add appflowy -- <MCP_CMD>
```

### 5.2 Cursor

Edit `~/.cursor/mcp.json` (create if missing):

```json
{
  "mcpServers": {
    "appflowy": {
      "type": "stdio",
      "command": "<MCP_CMD>",
      "args": [],
      "disabled": false,
      "env": { "TIN_MCP_API_KEY": "afk_..." }
    }
  }
}
```
Then reload Cursor (Settings → MCP or restart).

### 5.3 Factory Droid

```bash
droid mcp add appflowy --env TIN_MCP_API_KEY=afk_... -- <MCP_CMD>
```

### 5.4 Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "appflowy": {
      "command": "<MCP_CMD>",
      "args": [],
      "env": { "TIN_MCP_API_KEY": "afk_..." }
    }
  }
}
```
Restart Claude Desktop.

### 5.5 Generic `.mcp.json` (workspace-level, any MCP-aware IDE)

```json
{
  "mcpServers": {
    "appflowy": {
      "command": "<MCP_CMD>",
      "args": [],
      "env": { "TIN_MCP_API_KEY": "afk_..." }
    }
  }
}
```

---

## 6. Verify it works

```bash
# tin-mcp
tin-mcp doctor

# appflowy-pp-cli
appflowy-pp-cli workspace list --json
```

In the IDE, ask the agent to call `appflowy_server_info` (tin-mcp) or
`appflowy_*` tools. A successful reply confirms the key is valid and the portal is reachable.

---

## 7. Environment variables reference

| Variable | Tool | Description | Default |
|----------|------|-------------|---------|
| `TIN_MCP_API_KEY` | tin-mcp | API key (`afk_…`) | required |
| `APPFLOWY_API_KEY` | tin-mcp | Alias for TIN_MCP_API_KEY | — |
| `TIN_MCP_BASE_URL` | tin-mcp | Base URL | `https://projects.tinconnect.com` |
| `TIN_MCP_WORKSPACE` | tin-mcp | Default workspace ID | — |
| `APPFLOWY_EMAIL` / `APPFLOWY_PASSWORD` | appflowy-pp, collab-sync | GoTrue login | — |
| `APPFLOWY_TOKEN` | appflowy-pp, collab-sync | Bearer token / afk_ key | — |
| `APPFLOWY_BASE_URL` | all | Base URL | `https://projects.tinconnect.com` |
