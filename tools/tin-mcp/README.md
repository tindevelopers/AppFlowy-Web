# tin-mcp

A turnkey, distributable MCP server that lets IDE agents (Factory Droid, Claude Desktop, Claude Code) read and write pages and workspaces on the AppFlowy-Cloud instance at `https://projects.tinconnect.com`.

## Quick Start

### Prerequisite: Get an API key

1. Open **Settings → API access** in the Tin web app
2. Click **Create key**, give it a name (e.g. `factory-prod`)
3. Copy the shown-once `afk_…` key

### Install (Factory Droid)

```bash
# Download and install
curl -fsSL https://github.com/tindevelopers/tin-mcp/releases/latest/download/install.sh | sh
# → installs to ~/.local/bin/tin-mcp

# Register with Factory Droid
droid mcp add tin-mcp --env TIN_MCP_API_KEY=afk_… -- tin-mcp serve
```

### Install (Claude Desktop)

Download `tin-mcp.mcpb` from the latest release and double-click it. The install dialog prompts for your API key.

### Install (Claude Code)

```bash
claude mcp add tin-mcp --env TIN_MCP_API_KEY=afk_… -- tin-mcp serve
```

## MCP Tools

### Read tools

| Tool | Description |
|---|---|
| `appflowy_server_info` | Check connectivity, identity, and key validity |
| `appflowy_list_workspaces` | List workspaces the API key can access, with member counts |
| `appflowy_get_page_tree` | Get the space/page tree of a workspace (`depth` controls recursion) |
| `appflowy_read_page` | Read a page as markdown. Returns `doc_state_hash` for optimistic concurrency on writes. |

### Write tools

| Tool | Description |
|---|---|
| `appflowy_create_space` | Create a new space (top-level folder) in a workspace |
| `appflowy_create_page` | Create a page under a parent view. Optionally seed with `markdown` content. |
| `appflowy_update_page_section` | Replace a `<!-- BEGIN GENERATED:key --> / <!-- END GENERATED:key -->` marked section in-place. Supports `dry_run` (preview without writing) and `if_unmodified` (optimistic-concurrency hash). |
| `appflowy_insert_section` | Append a new marked section to a page. Markers are generated automatically. |
| `appflowy_list_backups` | List local pre-write snapshots for a page (timestamped `.doc_state` files) |
| `appflowy_restore_page` | Restore a page from a local backup by timestamp/filename prefix |

### Section markers (for `update_page_section` / `insert_section`)

Pages use HTML comments to mark regions that can be programmatically replaced:

```markdown
## Some section

<!-- BEGIN GENERATED:overview -->
* This content is auto-generated
* It will be replaced when the agent calls `update_page_section` with key `overview`
<!-- END GENERATED:overview -->

This content is outside the markers and is never touched by updates.
```

Only content **between** matching `BEGIN`/`END` markers is replaced. Everything else is preserved verbatim.

### Backup safety

Before every write, `tin-mcp` saves a snapshot to:
`~/.local/share/tin-mcp/backups/<viewId>/<timestamp>-<hash>.doc_state`

Use `appflowy_list_backups` to list them and `appflowy_restore_page` with the timestamp prefix to roll back.

## CLI

```
tin-mcp serve            Start the MCP server (for IDEs)
tin-mcp auth set-key     Configure your afk_ API key
tin-mcp auth status      Show current configuration
tin-mcp doctor           Verify connectivity and auth
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `TIN_MCP_API_KEY` | API key (starts with `afk_`) | (required) |
| `APPFLOWY_API_KEY` | Fallback alias for TIN_MCP_API_KEY | — |
| `TIN_MCP_BASE_URL` | AppFlowy-Cloud base URL | `https://projects.tinconnect.com` |
| `TIN_MCP_WORKSPACE` | Default workspace ID | — |
| `TIN_MCP_TIMEOUT` | HTTP timeout in seconds | `30` |
| `TIN_MCP_BACKUP` | Enable pre-write backups (`true`/`false`) | `true` |
| `TIN_MCP_ALLOW_INSECURE` | Allow `http://` URLs (local dev only) | — |

Config file at `~/.config/tin-mcp/config.toml` (0600 permissions).

## Build from Source

```bash
git clone https://github.com/tindevelopers/tin-mcp.git
cd tin-mcp
cargo build --release
# binary at target/release/tin-mcp
```

## Architecture

```
tools/tin-mcp/
  Cargo.toml                   Workspace root
  crates/
    tin-doc-core/              Shared library
      config.rs                Env/file config with 0600 key storage
      rest.rs                  Structural REST client (workspace, page, space)
      collab.rs                Document read/write via client-api + collab_document
      merge.rs                 Section-marker parser and in-place merge engine
      backup.rs                Local doc_state snapshots
      error.rs                 Structured error types
    tin-mcp/                   Binary crate
      server.rs                MCP server (10 tools via rmcp v3)
      auth.rs                  auth set-key / auth status
      doctor.rs                Connectivity + auth health check
      main.rs                  clap CLI entry point
  mcpb/                        MCP bundle manifest + launch script
  install.sh                   One-liner installer
```

## License

MIT
