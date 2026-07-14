# Regeneration & Pipeline

<!-- BEGIN GENERATED:main -->

The doc regeneration pipeline turns live codebase structure into AppFlowy documentation.

## Pipeline Overview

```
[Codebase scan] ──► regenerate-docs.py ──► markdown files ──► git commit/PR ──► collab-sync ──► AppFlowy
```

## regenerate-docs.py

Located at `tools/doc-sync/collab-sync/regenerate-docs.py`.

Currently regenerates the three **Overview** pages automatically by scanning the codebase:

| Page | Scan Target | What It Produces |
|------|-------------|------------------|
| Flutter Frontend | `frontend/appflowy_flutter/lib/` | Directory listing under `lib/` |
| Rust Backend | `frontend/rust-lib/` | Crate listing from Cargo.toml files |
| Agent Tools | `tools/doc-sync/` | Directory listing |

Other pages (Operations, Confidential, Droid Automation) preserve their existing content until custom regenerators are added.

### Adding a New Regenerator

1. Add a function to `regenerate-docs.py` that scans the relevant code directory.
2. Add an entry to the `REGENERATORS` dict at the bottom.
3. Run `python3 regenerate-docs.py` to verify.

Example:

```python
def regenerate_build_deploy():
    ci_dir = os.path.join(REPO_ROOT, ".github", "workflows")
    files = os.listdir(ci_dir) if os.path.isdir(ci_dir) else []
    lines = ["# Build & Deploy", "", "## CI Workflows", ""]
    for f in sorted(files):
        lines.append(f"* `{f}`")
    return "\n".join(lines) + "\n"

REGENERATORS["operations/Build & Deploy.md"] = regenerate_build_deploy
```

## sync-pipeline.sh

End-to-end script: regenerate → commit (if changed) → sync.

```bash
./tools/doc-sync/collab-sync/sync-pipeline.sh [--dry-run]
```

Steps:
1. Runs `regenerate-docs.py`
2. If markdown files changed, stages them with git and prints stats (exits so you can review/PR)
3. If no changes, runs `cargo run -- sync --all --manifest manifest.json --backup`

## Scheduling

### Cron (recommended)

```cron
0 7 * * * cd /Users/gene/Projects/appflowy-web/tools/doc-sync/collab-sync && cargo build && cargo run -- sync --all --manifest manifest.json --backup 2>&1 | logger -t appflowy-sync
```

This runs daily at 7 AM, rebuilding and syncing all 11 pages with automatic backups.

### From Cursor / Claude

Either tool can run the pipeline with a single instruction:

> "Sync AppFlowy docs: cd tools/doc-sync/collab-sync && cargo run -- sync --all --manifest manifest.json --backup"

Or with regeneration:

> "Regenerate docs and sync to AppFlowy: cd tools/doc-sync/collab-sync && python3 regenerate-docs.py && cargo run -- sync --all --manifest manifest.json --backup"

## Backup & Recovery

Every sync with `--backup` saves the pre-change state to `artifacts/backups/<view_id>-<timestamp>.doc_state`.

To restore:

```bash
cargo run -- restore <view_id> artifacts/backups/<view_id>-<timestamp>.doc_state
```

Backup files are git-ignored (local only).
<!-- END GENERATED:main -->
