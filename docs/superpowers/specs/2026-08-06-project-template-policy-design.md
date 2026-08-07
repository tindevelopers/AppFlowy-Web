# AppFlowy Workspace + Standard Project Template & Policy

**Status:** Implemented
**Date:** 2026-08-06
**Related:** `docs/project-template/` (source-of-truth markdown), `tools/doc-sync/collab-sync` (sync tooling)

---

## 1. Summary

Establish a **standard project template and policy** for every project tracked in the
AppFlowy portal (`projects.tinconnect.com`), and stand up a dedicated **"AppFlowy"**
workspace that holds the product's own data (the `appflowy-web` repo, releases, etc.)
separate from client work.

Two project types are supported, each with the shared core page set plus type-specific
pages:

- **Source Code programming** — a code project with a repo/build/deploy lifecycle.
- **Client-facing** — a delivered product/website for an external client.

The policy is the **source of truth in this repo** (`docs/project-template/`), written as
markdown, and **synced into AppFlowy via `collab-sync`** so the portal is self-documenting.

---

## 2. Standard project template

Each project maps to a **top-level Space** in a workspace. The space contains a fixed set
of pages.

### 2.1 Shared core pages (every project, both types)

| Order | Page | Layout | Purpose |
|-------|------|--------|---------|
| 1 | **Project Home** | Document | Index/README: what the project is, links to sibling pages, quick-start, current status |
| 2 | **Overview** | Document | Purpose, goals, scope, stakeholders, links, current state |
| 3 | **Credentials** | Document | Sensitive-access page (URLs, logins, API tokens, notes) — follows the Equipment-Balkans credentials pattern |
| 4 | **Programming Instructions** | Document | The thorough README: stack, repo, build/run/test commands, deploy, env setup, conventions |
| 5 | **Milestones and Tasks** | **Database (Grid)** | Queryable Milestone + Task records |
| 6 | **Meetings/Notes** | Document | Running meeting log and decisions |

### 2.2 Type-specific pages

| Type | Extra pages |
|------|-------------|
| **Source Code programming** | **Architecture**, **Deployment** |
| **Client-facing** | **Site Map / Assets** (brand assets, domains, third-party accounts), **Support / Handover** (support contacts, runbook, client expectations) |

---

## 3. Milestones and Tasks database schema

A single Grid table (layout `1`) whose records all share these fields:

`Type` (Milestone / Task) · `Title` · `Status` (To Do / In Progress / Done) ·
`Owner` · `Due Date` · `Priority` · `Link to Project/Space` · `Description/Notes` ·
`Recurring` · `Estimate (hours)` · `Tags`

Milestones and tasks live in the same table, distinguished by the `Type` field.

---

## 4. Policy (how to create a new project)

The policy is documented in `docs/project-template/POLICY.md` and covers:

1. **Determine the project type** (Source Code vs Client-facing) from the two-page trees above.
2. **Create the workspace** if none exists for the project's domain (or reuse the workspace
   matching the project).
3. **Create a Space** named after the project in the correct workspace.
4. **Provision the pages** from the template: shared core set always; add type-specific pages.
5. **Seed each page** with the template content via `collab-sync`.
6. **Fill in the fields**: Overview/Home with real project data; Credentials with actual
   access; Milestones & Tasks rows as needed.

---

## 5. Implementation approach

### 5.1 Source of truth (this repo)

A new `docs/project-template/` tree containing:

- `POLICY.md` — the standard policy (rules above).
- `README.md` — index pointing at the policy and templates.
- `templates/shared/*.md` — the six core page templates.
- `templates/source-code/*.md` — Architecture, Deployment templates.
- `templates/client-facing/*.md` — Site Map / Assets, Support / Handover templates.
- `manifest.json` — a `collab-sync` manifest mapping template files to page views.
- `provision.sh` — a repeatable script that provisions a project space from the templates.

### 5.2 AppFlowy workspace

Create the **"AppFlowy"** workspace on `projects.tinconnect.com` and provision the product
project space from the template (using the same process every future project uses).

---

## 6. Constraints & notes

- **Workspace creation:** verified live. `POST /api/workspace/` with `{"workspace_name","workspace_icon"}` creates a workspace; the "AppFlowy" workspace was created this way (id `931619d9-ed0a-4b47-90b0-b36bc5e8f485`).
- **Credentials:** `tools/doc-sync/.env` provides `APPFLOWY_TOKEN` (bearer) + `APPFLOWY_BASE_URL` for authenticated API calls; no `afk_` key is needed for this workflow.
- **Security:** the Credentials page is per-project sensitive access. It lives in a
  workspace/space that is not publicly published (the multi-client confidentiality rule).
- **Ordering:** the template + policy must exist before provisioning the "AppFlowy"
  workspace, so the product project itself follows the standard.

---

## 7. Success criteria

- The policy document clearly describes how to create a project of either type.
- The shared + type-specific page templates exist in `docs/project-template/` and are
  valid markdown accepted by `collab-sync`.
- A provisioning script provisions a project space (space + pages + seeded content).
- The "AppFlowy" workspace exists on `projects.tinconnect.com` and contains at least the
  product project space provisioned per the standard.
