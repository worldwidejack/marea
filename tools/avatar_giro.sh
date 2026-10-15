#!/bin/zsh
# Giro attorno all'avatar (vedi tools/avatar_giro.py). Uso: tools/avatar_giro.sh [indice_look | json] [--pixel]
# → tests/out/avatar/giro.png e viso.png; con --pixel anche giro_pixel.png (avatar alto ~112 px, pixel ingranditi ×4 come nel gioco)
cd "$(dirname "$0")/.."
OUT=tests/out/avatar
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/avatar_giro.py -- assets/atlas/atlas.png $OUT "$@" > $OUT.log 2>&1 || { tail -20 $OUT.log; exit 1; }
F=$OUT/_pezzi
ffmpeg -v error -y -i $F/v0.png -i $F/v1.png -i $F/v2.png -i $F/v3.png -i $F/p0.png -i $F/p1.png -i $F/p2.png -filter_complex hstack=inputs=7 $OUT/giro.png
ffmpeg -v error -y -i $F/f0.png -i $F/f1.png -i $F/f2.png -filter_complex hstack=inputs=3 $OUT/viso.png
if [[ " $* " == *" --pixel "* ]]; then
  for i in v0 v1 v3 p0 p1 p2; do ffmpeg -v error -y -i $F/$i.png -vf "scale=60:112:flags=neighbor,scale=240:448:flags=neighbor" $F/px_$i.png; done
  ffmpeg -v error -y -i $F/px_v0.png -i $F/px_v1.png -i $F/px_v3.png -i $F/px_p0.png -i $F/px_p1.png -i $F/px_p2.png -filter_complex hstack=inputs=6 $OUT/giro_pixel.png
fi
echo "$OUT/giro.png $OUT/viso.png"
