#!/bin/bash
# Build site/demo.mp4 (1920x1080) and site/demo-vertical.mp4 (1080x1920): a 42 s motion-designed promo.
#   scripts/demo/promo/promo.html — the animation (deterministic window.__render(t) timeline)
#   scripts/demo/promo/render.mjs — renders it frame-by-frame in headless Chrome
#   scripts/demo/promo/music.py   — original music bed + UI clicks, cut to the same 2 s bars
set -euo pipefail
cd "$(dirname "$0")/../.."

FRAMES=out/promo/frames
CLICKS=9.3,12.92,33.12,33.92   # must match window.__clicks in promo.html

node scripts/demo/promo/render.mjs landscape "$FRAMES" &
node scripts/demo/promo/render.mjs portrait "$FRAMES"
wait
python3 scripts/demo/promo/music.py out/promo/music.wav "$CLICKS"

encode() { # $1 frames dir, $2 output
  ffmpeg -y -v error -stats -framerate 30 -i "$1/%05d.jpg" -i out/promo/music.wav \
    -map 0:v -map 1:a -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -tune animation \
    -c:a aac -b:a 192k -shortest -movflags +faststart "$2"
}
encode "$FRAMES/landscape" site/demo.mp4
encode "$FRAMES/portrait" site/demo-vertical.mp4

echo "built site/demo.mp4 and site/demo-vertical.mp4"
