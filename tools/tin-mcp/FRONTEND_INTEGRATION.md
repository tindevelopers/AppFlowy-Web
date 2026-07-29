# Frontend Integration: API Keys + MCP Server

## Overview

The Tin web app (`appflowy-web`) provides the **API access settings panel** (Phase 0, Part B) which lets users create, list, and revoke `afk_` API keys. These keys are used by `tin-mcp`, a standalone MCP server, to authenticate against `projects.tinconnect.com`.

## API Key Contract

- **Prefix**: `afk_` (server validates then strips this prefix before JWT fallback)
- **Format**: `afk_` + 32 hex chars (UUID without dashes)
- **Auth header**: `Authorization: Bearer afk_<key>`
- **Key creation**: `POST /api/workspace/{workspace_id}/api-key` returns `{ code: 0, data: { api_key: { id, name, key, created_at } } }`
- **Key listing**: `GET /api/workspace/{workspace_id}/api-key` returns `{ code: 0, data: { api_keys: [...] } }`
- **Key revocation**: `DELETE /api/workspace/{workspace_id}/api-key/{key_id}`

## What the Frontend Needs to Know

### 1. Key display format

The `key` field in the API response is the full token. The frontend should:
- Show it **once** at creation time with a "copy" button
- After dismissal, show only `afk_****` prefix and the key name/date
- Never log or store the full key in localStorage (the server handles storage)

### 2. Settings panel location

The API access panel lives at **Settings → API access** in the Tin web app UI. It renders:
- Key list (name, created date, masked key, revoke button)
- "Create key" form (name input + submit)

### 3. MCP server consumption

The `tin-mcp` binary expects:
- `TIN_MCP_API_KEY=afk_<key>` environment variable
- Or `~/.config/tin-mcp/config.toml` with `api_key = "afk_<key>"`

The key is used for:
- **REST calls**: `Authorization: Bearer afk_<key>` header
- **Collab sync**: `restore_token()` with the key as `access_token` (WebSocket auth)

### 4. No frontend changes needed for Phase 2

Phase 2 (write tools) does **not** require any frontend changes. The write tools:
- Call the same REST endpoints as the CLI (`appflowy-cli.js`)
- Use the same collab-sync protocol as `collab-sync` Rust tool
- Save backups locally on the user's machine (not on the server)

### 5. Rebranding note

The frontend code uses `AppFlowy` naming internally (e.g., `APPFLOWY_API_KEY` env var alias). The MCP server accepts both `TIN_MCP_API_KEY` and `APPFLOWY_API_KEY` for backward compatibility.

## Endpoints Used by tin-mcp

### Read endpoints

| Method | Path | Used by tool |
|---|---|---|
| GET | `/api/server-info` | `appflowy_server_info` |
| GET | `/api/user/profile` | `appflowy_server_info`, `doctor` |
| GET | `/api/workspace?include_member_count=true` | `appflowy_list_workspaces` |
| GET | `/api/workspace/{ws}/view/{view}?depth=N` | `appflowy_get_page_tree` |

### Write endpoints (REST)

| Method | Path | Used by tool |
|---|---|---|
| POST | `/api/workspace/{ws}/space` | `appflowy_create_space` |
| POST | `/api/workspace/{ws}/page-view` | `appflowy_create_page` |

### Write endpoints (collab-sync / WebSocket)

| Method | Protocol | Used by tool |
|---|---|---|
| `get_collab` | WebSocket via client-api | `appflowy_read_page`, `appflowy_update_page_section`, `appflowy_insert_section` |
| `create_collab` | WebSocket via client-api | `appflowy_update_page_section`, `appflowy_insert_section`, `appflowy_restore_page` |

## Key Rotation

If a key is revoked from the settings panel, any active MCP server using that key will fail on the next request with `401`. The user must:
1. Create a new key in Settings → API access
2. Run `tin-mcp auth set-key` to update
3. Restart the MCP server
