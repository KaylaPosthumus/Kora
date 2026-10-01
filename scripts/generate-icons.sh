#!/usr/bin/env bash
# Regenerates the PWA icons from the app logo.
#
# Run this after changing the logo.
#
#   ./scripts/generate-icons.sh [path-to-logo.png]
#
# The icons are saffron edge to edge. The logo is already a saffron block, so it
# is flattened onto saffron (which hides its rounded corners) and padded out in
# the same colour. The OS applies its own corner mask, so pre-rounded corners or
# a coloured border would show as a tile inside a tile. The maskable variant is
# scaled smaller to keep the mark inside the safe zone Android crops to.
#
# Needs ImageMagick.

set -euo pipefail

LOGO="${1:-src/assets/logos/kora_logo.png}"
OUT="public/icons"
BG="#F09D1C"   # saffron, the logo's own block

[ -f "$LOGO" ] || { echo "No logo at $LOGO" >&2; exit 1; }
mkdir -p "$OUT"

icon() { # size, mark size, output
  magick "$LOGO" -background "$BG" -flatten -resize "$2x$2" \
    -gravity center -extent "$1x$1" "$3"
}

icon 512 512 "$OUT/icon-512.png"
icon 192 192 "$OUT/icon-192.png"
icon 180 180 "$OUT/apple-touch-icon.png"
icon 512 400 "$OUT/icon-maskable-512.png"

echo "Wrote $OUT/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png from $LOGO"
