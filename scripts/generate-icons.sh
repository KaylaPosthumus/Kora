#!/usr/bin/env bash
# Regenerates the PWA icons from the app logo.
#
# Run this after dropping in the new Kora logo — the icons currently in
# public/icons/ are built from src/assets/logos/cori_logo_green.png and still
# read "Coriander".
#
#   ./scripts/generate-icons.sh [path-to-logo.png]
#
# The logo is a wide wordmark, so it is scaled to fit and then padded out to a
# square on zinc-900 (#18181b) — the colour it already sits on in the sidebar.
# The maskable variant is scaled smaller because Android crops it to a circle.

set -euo pipefail

LOGO="${1:-src/assets/logos/cori_logo_green.png}"
OUT="public/icons"
BG="18181B"

[ -f "$LOGO" ] || { echo "No logo at $LOGO" >&2; exit 1; }
mkdir -p "$OUT"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

sips -Z 460 "$LOGO" --out "$tmp/wide.png" >/dev/null
sips --padToHeightWidth 512 512 --padColor "$BG" "$tmp/wide.png" --out "$OUT/icon-512.png" >/dev/null
sips -z 192 192 "$OUT/icon-512.png" --out "$OUT/icon-192.png" >/dev/null

sips -Z 300 "$LOGO" --out "$tmp/narrow.png" >/dev/null
sips --padToHeightWidth 512 512 --padColor "$BG" "$tmp/narrow.png" --out "$OUT/icon-maskable-512.png" >/dev/null

echo "Wrote $OUT/icon-192.png, icon-512.png, icon-maskable-512.png from $LOGO"
