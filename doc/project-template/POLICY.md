# AppFlowy Project Template — Standard Policy

**Version:** 1.0
**Status:** Adopted
**Source of truth:** this file and the `templates/` tree in this repo, synced to the AppFlowy portal via `collab-sync`.

This document defines the standard for creating and structuring every project tracked in
the AppFlowy portal (`projects.tinconnect.com`). Every project, including AppFlowy's own
product work, follows these rules.

---

## 1. Project types

There are exactly two types of project. Every new project must be classified as one.

| Type | What it is | Page set |
|------|-----------|----------|
| **Source Code programming** | A code project with a repo/build/deploy lifecycle (e.g. `appflowy-web`, `tin-mcp`) | Shared core + Architecture + Deployment |
| **Client-facing** | A delivered product/website for an external client (e.g. Equipment Balkans, Canada Lighting Supplies) | Shared core + Site Map / Assets + Support / Handover |

If in doubt, choose the type whose extra pages match the project's actual deliverables.

---

## 2. Where a project lives

- A project is a **top-level Space** inside a **workspace**.
- Projects are grouped by domain into workspaces (e.g. **"Clients"** for client work,
  **"AppFlowy"** for the product's own data). Reuse an existing workspace when the
  project belongs to its domain; only create a new workspace when no suitable one exists.

---

## 3. The standard page set

### 3.1 Shared core pages (every project, both types)

| Order | Page | Layout | Purpose |
|-------|------|--------|---------|
| 1 | **Project Home** | Document | Index/README: what the project is, links to sibling pages, quick-start, current status |
| 2 | **Overview** | Document | Purpose, goals, scope, stakeholders, links, current state |
| 3 | **Credentials** | Document | Sensitive-access page (URLs, logins, API tokens, notes) |
| 4 | **Programming Instructions** | Document | The thorough README: stack, repo, build/run/test commands, deploy, env setup, conventions |
| 5 | **Milestones and Tasks** | **Database (Grid)** | Queryable Milestone + Task records |
| 6 | **Meetings/Notes** | Document | Running meeting log and decisions |

### 3.2 Type-specific pages

| Type | Extra pages |
|------|-------------|
| **Source Code programming** | **Architecture**, **Deployment** |
| **Client-facing** | **Site Map / Assets**, **Support / Handover** |

> **Milestones and Tasks** is a Database (Grid), layout `1`, not a static page. See §5.

---

## 4. Creating a new project — step by step

1. **Classify** the project type (§1).
2. **Choose the workspace** (§2). Reuse an existing one if the domain matches; otherwise create it.
3. **Create a Space** named after the project in the chosen workspace.
4. **Provision the pages** from the templates in `templates/`:
   - Always the 6 shared core pages.
   - Plus the type-specific pages for the project's type.
5. **Seed each page** with its template content via `collab-sync`.
6. **Fill in real content**: Project Home / Overview with the project's actual details,
   Credentials with real access, and Milestones & Tasks with the project's plan.

Use `provision.sh` (in this directory) to perform steps 3–5 reproducibly. It reads the
templates and a small per-project config, creates the space + pages, and seeds content.

---

## 5. Milestones and Tasks database

The Milestones and Tasks page is a **Database (Grid)** whose records all share these fields:

`Type` (Milestone / Task) · `Title` · `Status` (To Do / In Progress / Done) ·
`Owner` · `Due Date` · `Priority` · `Link to Project/Space` · `Description/Notes` ·
`Recurring` · `Estimate (hours)` · `Tags`

Milestones and tasks share one table, distinguished by the `Type` field. Status defaults to
`To Do`; Owner defaults to the space owner until assigned.

---

## 6. Maintenance

- **Source of truth is this repo.** Edit the templates/policy here, then sync to the
  portal with `collab-sync` so the portal stays self-documenting.
- **The Credentials page is sensitive.** It must live in a non-public space and must not be
  published (multi-client confidentiality rule). Never commit credentials to this repo.
- When the template changes, existing project spaces should be brought up to date during
  normal maintenance (add missing pages, refresh seeded content).
