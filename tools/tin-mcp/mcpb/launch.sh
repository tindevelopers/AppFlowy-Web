#!/bin/sh
set -e
# Linux arch shim — platform_overrides keys are per-platform (darwin/linux/win32),
# not per-arch, so we resolve x86_64 vs aarch64 here.
ARCH=$(uname -m)
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
case "$ARCH" in
  x86_64)  exec "$DIR/tin-mcp-linux-x64" serve "$@" ;;
  aarch64) exec "$DIR/tin-mcp-linux-arm64" serve "$@" ;;
  *)       echo "Unsupported Linux architecture: $ARCH" >&2; exit 1 ;;
esac
