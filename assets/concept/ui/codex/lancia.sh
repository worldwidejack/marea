#!/bin/zsh
# Rilancia i 3 gruppi Codex delle proposte di HUD (brief-comune + brief-gN). Uso: zsh lancia.sh [HH:MM per aspettare fino a quell'ora]
cd "${0:A:h}/../../../.." || exit 1
R=assets/concept/ui/codex; SHOT=tests/out/shots/boot_iphone_spawn.png; C=assets/concept/corse
if [[ -n "$1" ]]; then
  t=$(date -j -f "%Y-%m-%d %H:%M" "$(date -v+1d +%Y-%m-%d) $1" +%s); now=$(date +%s)
  (( t - now > 86400 )) && t=$(( t - 86400 ))
  (( t > now )) && { echo "aspetto fino alle $1 ($(( (t - now) / 60 )) min)"; sleep $(( t - now )); }
fi
cat $R/brief-comune.txt $R/brief-g1.txt | codex exec -C "$PWD" -s workspace-write --skip-git-repo-check -i $SHOT -i $C/hud_5_sonic_bis.jpg -i $C/menu_scelta_veicolo_mariokart.jpg -o $R/g1-risposta.md > $R/g1-log.txt 2>&1 &
cat $R/brief-comune.txt $R/brief-g2.txt | codex exec -C "$PWD" -s workspace-write --skip-git-repo-check -i $SHOT -o $R/g2-risposta.md > $R/g2-log.txt 2>&1 &
cat $R/brief-comune.txt $R/brief-g3.txt | codex exec -C "$PWD" -s workspace-write --skip-git-repo-check -i $SHOT -o $R/g3-risposta.md > $R/g3-log.txt 2>&1 &
wait
ls -la assets/concept/ui/*.png 2>/dev/null; grep -h "usage limit" $R/g?-log.txt | head -1
