#!/usr/bin/env bash
# Regenerates the PWA icons from the app logo.
#
# Run this after changing the logo.
#
#   ./scripts/generate-icons.sh [path-to-logo.png]
#
# The mark is near-square and already carries its own saffron block, so it is
# scaled to fit and padded out on zinc-900 (#18181b) — the colour it sits on in
# the sidebar. The maskable variant is scaled smaller because Android crops it
# to a circle.

set -euo pipefail

LOGO="${1:-src/assets/logos/kora_logo.png}"
OUT="public/icons"
BG="18181B"

[ -f "$LOGO" ] || { echo "No logo at $LOGO" >&2; exit 1; }
mkdir -p "$OUT"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

sips -Z 400 "$LOGO" --out "$tmp/wide.png" >/dev/null
sips --padToHeightWidth 512 512 --padColor "$BG" "$tmp/wide.png" --out "$OUT/icon-512.png" >/dev/null
sips -z 192 192 "$OUT/icon-512.png" --out "$OUT/icon-192.png" >/dev/null

sips -Z 290 "$LOGO" --out "$tmp/narrow.png" >/dev/null
sips --padToHeightWidth 512 512 --padColor "$BG" "$tmp/narrow.png" --out "$OUT/icon-maskable-512.png" >/dev/null

echo "Wrote $OUT/icon-192.png, icon-512.png, icon-maskable-512.png from $LOGO"
