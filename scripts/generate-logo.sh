#!/usr/bin/env bash
# Renders the placeholder Kora mark: saffron block, white K, KORA beneath.
#
# A placeholder until real artwork exists. It is a PNG rather than an SVG because
# the payroll PDF embeds it through pdfmake's `image:`, which needs a raster data
# URL — an SVG there renders as nothing.
#
# Self-contained on purpose: the mark sits on zinc-900 in the navigation and on
# korablue-500 on the auth screens, so the saffron block travels with it.
#
# Needs ImageMagick. Fonts are named by path: magick here has no fontconfig, so
# `-font Helvetica` fails with "unable to read font".
set -euo pipefail

OUT="$(dirname "$0")/../src/assets/logos/kora_logo.png"
MARK="$(dirname "$0")/../src/assets/logos/kora_mark.png"
BOLD="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
LIGHT="/System/Library/Fonts/Supplemental/Arial.ttf"
SAFFRON="#F09D1C"
KORABLUE="#2C6FB5"   # korablue-500
PUBLIC="$(dirname "$0")/../public"

magick -size 480x528 xc:none \
  -fill "$SAFFRON" -draw "roundrectangle 0,0 479,527 88,88" \
  -fill white \
  -font "$BOLD"  -pointsize 268 -gravity North -annotate +0+100 "K" \
  -font "$LIGHT" -pointsize 58  -kerning 12 -gravity North -annotate +0+392 "KORA" \
  "$OUT"

# The K on its own, for anywhere the mark renders small. Below about 40px the
# wordmark in the full logo is a few pixels tall and reads as a smudge — the
# mobile top bar draws it at 28.
magick -size 480x480 xc:none \
  -fill "$SAFFRON" -draw "roundrectangle 0,0 479,479 88,88" \
  -fill white \
  -font "$BOLD" -pointsize 300 -gravity center -annotate +0+4 "K" \
  "$MARK"

# The browser-tab icon: a white K on korablue.
# Drawn at 256 and scaled down, so the favicon sizes all share one shape.
magick -size 256x256 xc:none \
  -fill "$KORABLUE" -draw "roundrectangle 0,0 255,255 52,52" \
  -fill white \
  -font "$BOLD" -pointsize 200 -gravity center -annotate +0+2 "K" \
  "$PUBLIC/favicon.png"
magick "$PUBLIC/favicon.png" -define icon:auto-resize=48,32,16 "$PUBLIC/favicon.ico"

echo "wrote $OUT, $MARK and $PUBLIC/favicon.{png,ico}"
