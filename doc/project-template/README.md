# Project Template & Policy

This directory is the **source of truth** for the standard project template and policy used
to structure every project in the AppFlowy portal (`projects.tinconnect.com`).

## Contents

- **[POLICY.md](./POLICY.md)** — the standard policy: project types, where projects live,
  the required page set, and step-by-step instructions for creating a new project.
- **[templates/shared/](./templates/shared/)** — the six core page templates every project gets.
- **[templates/source-code/](./templates/source-code/)** — Architecture and Deployment templates
  (Source Code programming projects).
- **[templates/client-facing/](./templates/client-facing/)** — Site Map / Assets and
  Support / Handover templates (Client-facing projects).
- **[manifest.json](./manifest.json)** — a `collab-sync` manifest mapping template files to page views.
- **[provision.sh](./provision.sh)** — provisions a project space (space + pages + seeded content).

## How to use

Create a new project by following **[POLICY.md](./POLICY.md#4-creating-a-new-project--step-by-step)**.
For a repeatable setup, run `./provision.sh` with a project config.

## Syncing to AppFlowy

The markdown here is the authority. Push changes to the portal with the `collab-sync` tool:

```bash
cd tools/doc-sync/collab-sync
cargo run -- sync --all --manifest doc/project-template/manifest.json --backup
```
