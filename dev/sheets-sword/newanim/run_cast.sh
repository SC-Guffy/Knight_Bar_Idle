#!/bin/bash
# 13단계 (시즌7, 사용자 "개선해"): 짧은 판 개선 — 원본 = 시트 대기 그림(옆모습 c1, newanim/<cls>-c1src.png) 그대로라 모습이 안 바뀜. 키 이름 n<k>s. 설명 500자 검사
cd "$(dirname "$0")/.."
declare -A K D
K[paladin]="Keep exactly the same paladin as the reference: white and gold plate, grey great helm, kite shield with golden sun on the back arm, short golden sword in the front hand, same facing."
K[archon]="Keep exactly the same archon as the reference: white and gold plate, great helm, ring of gold stars, glowing gold wings, blue cape, golden longsword, same facing."
K[tyrant]="Keep exactly the same berserker as the reference: black spiked armor, wolf-skull helmet with red eyes, tattered black cape, enormous slab greatsword with red cracks, same facing."
D[paladin:c3]="Change only the pose: casting a holy spell, the golden sword raised straight up above the head in the front hand, shield held forward on the back arm, chest out."
D[paladin:k0]="Change only the pose: wind-up, the golden sword pulled back and raised above the shoulder in the front hand, shield kept on the back arm, knees bent."
D[archon:c3]="Change only the pose: casting a celestial spell, the golden longsword raised straight up above the head with both hands, wings spread wide, chest out."
D[tyrant:c3]="Change only the pose: unleashing rage, the greatsword raised high above the head with both hands, legs wide, leaning slightly back."
for kk in "$@"; do c=${kk%%:*}; k=${kk##*:}; d="${D[$kk]} ${K[$c]} Side view facing right, the sword stays in the hand, no effects."
  [ ${#d} -le 500 ] || { echo "TOO LONG $kk ${#d}"; continue; }
  [ -f work/$c/n${k}s-0.png ] && { echo "skip $kk"; continue; }
  out=$(MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8 /c/AI/ComfyUI/.venv/Scripts/python.exe -I -B plx.py edit $c n${k}s newanim/$c-c1src.png "$d" 17 2>&1 | grep -E "usage|STOP|HTTP|bal" | tr '\n' ' '); echo "$kk $out"
  echo "$out" | grep -q "generations': 1.0" || { echo "STOP usage!=1"; exit 1; }
done
echo DONE
