# Frontend Integration: API Keys + MCP Server

## Overview

The Tin web app (`appflowy-web`) provides the **API access settings panel** (Phase 0, Part B) which lets users create, list, and revoke `afk_` API keys. These keys are used by `tin-mcp`, a standalone MCP server, to authenticate against `projects.tinconnect.com`.

## Backend Status

The AppFlowy-Cloud backend (`appflowy-cloud`) at https://github.com/tindevelopers/AppFlowy-Cloud has the full API key system implemented:

| Component | File | Status |
|---|---|---|
| Database migration | `migrations/20260727000000_api_keys.sql` | Deployed on startup via sqlx |
| API handlers | `src/api/api_key.rs` | Registered at `POST/GET/DELETE /api/api-key` |
| Business logic | `src/biz/api_key.rs` | Create, list, revoke, validate, touch_last_used |
| Auth middleware | `src/biz/authentication/api_key_auth.rs` | Recognizes `afk_` Bearer tokens |
| Auth integration | `src/biz/authentication/jwt.rs` | Routes `afk_` tokens through API key flow |
| Limit | `MAX_ACTIVE_KEYS_PER_USER = 20` | Enforced at create time |

## API Key Contract (Confirmed)

The frontend and backend use these matching contracts:

### Create Key
- **Frontend**: `POST /api/api-key` → `{ name: string, workspace_id?: string, expires_at?: string }`
- **Backend**: `POST /api/api-key` → `{ name: String, workspace_id: Option<Uuid>, expires_at: Option<DateTime> }`
- **Response**: `{ id, name, key, key_prefix, workspace_id, created_at, expires_at }`
  - `key` is returned **exactly once** at creation (the plaintext `afk_...` token)

### List Keys  
- **Frontend**: `GET /api/api-key`
- **Backend**: `GET /api/api-key`
- **Response**: `[{ id, name, key_prefix, workspace_id, created_at, expires_at, last_used_at, revoked_at }]`

### Revoke Key
- **Frontend**: `DELETE /api/api-key/{id}`
- **Backend**: `DELETE /api/api-key/{key_id}`
- **Response**: 200 Ok or 404 if not found (without leaking existence)

### Auth
- Key management requires a **session JWT** (not an API key)
- API keys cannot manage other API keys — the backend rejects `afk_` tokens on the api-key routes
- The backend stores `key_hash = SHA-256(plaintext)`, never the plaintext key

## Key Format
- Prefix: `afk_`
- Full format: `afk_` + 48 alphanumeric characters  
- Displayed once at creation, then only the 12-character prefix (e.g. `afk_aB3dEf...`)

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

### Key management endpoints (REST)

| Method | Path | Auth | Used by |
|---|---|---|---|
| GET | `/api/api-key` | Session JWT | Settings → API access panel |
| POST | `/api/api-key` | Session JWT | Settings → API access panel (create) |
| DELETE | `/api/api-key/{id}` | Session JWT | Settings → API access panel (revoke) |

### Write endpoints (collab-sync / WebSocket)

| Method | Protocol | Used by tool |
|---|---|---|
| `get_collab` | WebSocket via client-api | Read page, replace section, insert section |
| `create_collab` | WebSocket via client-api | Update section, insert section, restore page |

## Deployment Flow

1. Push code to `appflowy-cloud` main branch
2. GitHub Actions `build_ghcr.yml` builds Docker image → pushes to GHCR
3. Watchtower on VPS detects new `latest` tag → pulls and restarts server
4. On startup, `sqlx::migrate!("./migrations")` applies pending migrations including `af_api_keys` table
5. `/api/api-key` endpoint goes live
