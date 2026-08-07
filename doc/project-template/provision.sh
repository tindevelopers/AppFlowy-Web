#!/usr/bin/env bash
#
# provision.sh — provision an AppFlowy project space from the standard template.
#
# Creates a Space (named after the project) in the given workspace, creates the
# standard page set for the project type, and seeds each page with its template
# content using the collab-sync tool.
#
# Usage:
#   ./provision.sh <workspace_id> <project_name> <type> [--icon <icon>] [--color <color>] [--private]
#
#   workspace_id   UUID of the workspace that will hold the project space.
#   project_name   Name of the project (also the Space name).
#   type           "source-code" | "client-facing"
#   --icon         Space icon emoji (default 📁)
#   --color        Space icon color (default blue)
#   --private      Create a private space (default public-to-all like the CLI default).
#
# Requires:
#   - A built collab-sync binary (tools/doc-sync/collab-sync) or cargo.
#   - APPFLOWY_BASE_URL / APPFLOWY_TOKEN (or APPFLOWY_EMAIL/PASSWORD) in env
#     or in tools/doc-sync/.env (loaded automatically by the tool? No — load it here).
#
# Examples:
#   ./provision.sh 11111111-... "AppFlowy" source-code --icon 🧩
#   ./provision.sh 11111111-... "Acme Site" client-facing --private

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOL_DIR="$ROOT/tools/doc-sync/collab-sync"
BIN="${COLLAB_SYNC_BIN:-$TOOL_DIR/target/debug/collab-sync}"
ENV_FILE="$ROOT/tools/doc-sync/.env"

# Load collab-sync credentials if present.
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# Default base URL matches the tool default.
export APPFLOWY_BASE_URL="${APPFLOWY_BASE_URL:-https://projects.tinconnect.com}"

WS_ID="${1:?workspace_id required}"
PROJECT_NAME="${2:?project_name required}"
TYPE="${3:?type required (source-code | client-facing)}"
ICON="${4:-📁}"
COLOR="${5:-blue}"
PERM="0"

# Parse flags
shift 3 || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --icon) ICON="$2"; shift 2;;
    --color) COLOR="$2"; shift 2;;
    --private) PERM="1"; shift;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

case "$TYPE" in
  source-code|client-facing) ;;
  *) echo "type must be 'source-code' or 'client-facing'" >&2; exit 1;;
esac

# Ensure the collab-sync binary exists.
if [[ ! -x "$BIN" ]]; then
  echo "[build] collab-sync binary not found; building..." >&2
  (cd "$TOOL_DIR" && cargo build)
fi

echo "==> Workspace: $WS_ID"
echo "==> Project space: $PROJECT_NAME (type: $TYPE, perm: $PERM)"

# 1. Create the space.
echo "==> Creating space '$PROJECT_NAME'..."
"$BIN" create-space "$PROJECT_NAME" "$ICON" "$COLOR" "$PERM" --workspace "$WS_ID"

# 2. Find the new space's view_id by listing and matching the name.
echo "==> Locating new space view_id..."
space_line="$("$BIN" list "$WS_ID" --workspace "$WS_ID" | grep -E "\[SPACE\]" | grep "$PROJECT_NAME" | head -n1 || true)"
SPACE_ID="$(echo "$space_line" | awk '{print $1}')"
if [[ -z "$SPACE_ID" ]]; then
  echo "!! Could not locate the newly created space. The space may be listed differently." >&2
  echo "!! Run: $BIN list $WS_ID" >&2
  exit 1
fi
echo "==> Space view_id: $SPACE_ID"

# 3. Define the page set for this type.
CORE_PAGES=(
  "project-home:0:doc/project-template/templates/shared/01-project-home.md"
  "overview:0:doc/project-template/templates/shared/02-overview.md"
  "credentials:0:doc/project-template/templates/shared/03-credentials.md"
  "programming-instructions:0:doc/project-template/templates/shared/04-programming-instructions.md"
  "milestones-and-tasks:1:doc/project-template/templates/shared/05-milestones-and-tasks.md"
  "meetings-notes:0:doc/project-template/templates/shared/06-meetings-notes.md"
)

TYPE_PAGES=()
if [[ "$TYPE" == "source-code" ]]; then
  TYPE_PAGES=(
    "architecture:0:doc/project-template/templates/source-code/07-architecture.md"
    "deployment:0:doc/project-template/templates/source-code/08-deployment.md"
  )
else
  TYPE_PAGES=(
    "site-map-assets:0:doc/project-template/templates/client-facing/07-site-map-assets.md"
    "support-handover:0:doc/project-template/templates/client-facing/08-support-handover.md"
  )
fi

ALL_PAGES=("${CORE_PAGES[@]}" "${TYPE_PAGES[@]}")

# 4. Create each page, then seed it with the template content.
for entry in "${ALL_PAGES[@]}"; do
  IFS=':' read -r page_name layout md_rel <<< "$entry"
  md_path="$ROOT/$md_rel"
  echo "==> Creating page '$page_name' (layout $layout)..."
  out="$("$BIN" create-page "$SPACE_ID" "$page_name" "$layout" --workspace "$WS_ID")"
  page_id="$(echo "$out" | sed -n 's/.*page_view_created: //p' | tail -n1)"
  if [[ -z "$page_id" ]]; then
    echo "!! Could not parse page id for '$page_name'." >&2
    echo "   output: $out" >&2
    exit 1
  fi
  echo "   page view_id: $page_id"
  echo "==> Seeding '$page_name' from $md_rel..."
  "$BIN" seed "$page_id" "$md_path" --workspace "$WS_ID" >/dev/null
done

echo
echo "[done] Project space '$PROJECT_NAME' provisioned."
echo "  Space view_id : $SPACE_ID"
echo "  Pages         : $(for e in "${ALL_PAGES[@]}"; do IFS=':' read -r n _ _ <<< "$e"; printf '%s ' "$n"; done)"
echo
echo "Fill in placeholders ({{...}}) on each page with real content, then record the"
echo "page view_ids in doc/project-template/manifest.json to enable 'sync --all'."
