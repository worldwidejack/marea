#!/bin/zsh
# Giro attorno all'avatar (vedi tools/avatar_giro.py). Uso: tools/avatar_giro.sh [indice_look] → tests/out/avatar/giro.png e viso.png
cd "$(dirname "$0")/.."
OUT=tests/out/avatar
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/avatar_giro.py -- assets/atlas/atlas.png $OUT "$@" > $OUT.log 2>&1 || { tail -20 $OUT.log; exit 1; }
F=$OUT/_pezzi
ffmpeg -v error -y -i $F/v0.png -i $F/v1.png -i $F/v2.png -i $F/v3.png -i $F/p0.png -i $F/p1.png -i $F/p2.png -filter_complex hstack=inputs=7 $OUT/giro.png
ffmpeg -v error -y -i $F/f0.png -i $F/f1.png -i $F/f2.png -filter_complex hstack=inputs=3 $OUT/viso.png
echo "$OUT/giro.png $OUT/viso.png"
