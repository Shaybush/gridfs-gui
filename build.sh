#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

(cd "$SCRIPT_DIR/gui" && pnpm install --frozen-lockfile && pnpm build)

rm -rf "$SCRIPT_DIR/server/public"
cp -r "$SCRIPT_DIR/gui/dist" "$SCRIPT_DIR/server/public"

echo "Build complete -- frontend copied to server/public/"
