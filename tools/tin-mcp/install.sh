#!/usr/bin/env bash
set -euo pipefail

# tin-mcp installer
# Usage: curl -fsSL https://raw.githubusercontent.com/tindevelopers/appflowy-web/main/tools/tin-mcp/install.sh | bash

REPO="tindevelopers/appflowy-web"
BINARY="tin-mcp"
VERSION="${TIN_MCP_VERSION:-latest}"

# ── Platform detection ────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)  OS="unknown-linux-musl" ;;
  Darwin) OS="apple-darwin" ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x86_64" ;;
  aarch64|arm64) ARCH="aarch64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

TARGET="${ARCH}-${OS}"

# ── Install directory ─────────────────────────────────────────────────────
INSTALL_DIR="${TIN_MCP_INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$INSTALL_DIR"

# ── Download ──────────────────────────────────────────────────────────────
if [ "$VERSION" = "latest" ]; then
  URL="https://github.com/$REPO/releases/latest/download/tin-mcp-${TARGET}.tar.gz"
else
  URL="https://github.com/$REPO/releases/download/${VERSION}/tin-mcp-${TARGET}.tar.gz"
fi

echo "Downloading tin-mcp for ${TARGET}..."
TMPDIR="$(mktemp -d)"
curl -fsSL "$URL" -o "$TMPDIR/tin-mcp.tar.gz"
tar xzf "$TMPDIR/tin-mcp.tar.gz" -C "$TMPDIR"

cp "$TMPDIR/tin-mcp-${TARGET}/$BINARY" "$INSTALL_DIR/$BINARY"
chmod +x "$INSTALL_DIR/$BINARY"
rm -rf "$TMPDIR"

echo ""
echo "tin-mcp installed to $INSTALL_DIR/$BINARY"
echo ""

# ── PATH check ────────────────────────────────────────────────────────────
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo "Add $INSTALL_DIR to your PATH:"
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  echo ""
  echo "Or add this to your ~/.bashrc / ~/.zshrc:"
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  echo ""
fi

echo "Next step: configure your API key"
echo "  tin-mcp auth set-key"
echo ""
echo "Check connectivity:"
echo "  tin-mcp doctor"
