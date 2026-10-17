#!/bin/bash
# 12단계 B: pixen 키 자세 (칼까지 모델이 그림). 원본 = newanim/<cls>-src.png (고른 디자인, 64칸 발 28,59). 설명 500자 검사
cd "$(dirname "$0")/.."
declare -A K
K[squire]="Keep the same young squire: messy brown hair, cream padded gambeson, brown belt, round wooden buckler on the back arm, short iron sword."
K[swordsman]="Keep the same knight: open-face steel helmet with a tall blue plume, short blue cape, steel breastplate, blue tabard, straight steel longsword."
K[paladin]="Keep the same paladin: white and gold full plate, great helm with gold cross visor, kite shield with golden sun on the back arm, short golden sword."
K[blademaster]="Keep the same ronin: long black high ponytail, red headband, indigo kimono, red sash, wide black hakama, slim curved katana."
K[greatswordsman]="Keep the same black swordsman: spiky black hair, dark iron armor, tattered black cape, iron left arm, enormous slab iron greatsword."
K[archon]="Keep the same archon: white and gold plate, great helm, ring of small gold stars above, small glowing gold wings, blue cape, golden longsword."
K[tyrant]="Keep the same berserker: black spiked armor, wolf-skull helmet with glowing red eyes, jagged crown ridge, tattered black cape, enormous slab iron greatsword with red cracks."
K[swordsaint]="Keep the same sword saint: long white high ponytail, gold crescent ornament, white and gold haori, dark hakama, glowing blue katana."
declare -A P
P[k1]="Change only the pose: wind-up, the sword raised high above and behind the head with both hands, body leaning back, weight on the back foot."
P[k2]="Change only the pose: mid slash, the sword swinging forward and down in front of the chest, arms extended forward, front foot stepping forward, body leaning in."
P[k3]="Change only the pose: follow-through after the slash, the sword low in front pointing forward and down, arms fully extended, deep forward lunge."
P[c1]="Change only the pose: focusing power, the sword held upright in front of the face with both hands, feet planted, calm."
P[c2]="Change only the pose: the sword thrust straight up toward the sky with the front hand, other hand open at the side, chest out."
for c in "$@"; do for k in k1 k2 k3 c1 c2; do d="${P[$k]} ${K[$c]} Side view facing right, the sword stays in the hand, no effects."
  [ ${#d} -le 500 ] || { echo "TOO LONG $c $k ${#d}"; continue; }
  [ -f work/$c/n$k-0.png ] && { echo "skip $c $k"; continue; }
  out=$(MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8 /c/AI/ComfyUI/.venv/Scripts/python.exe -I -B plx.py edit $c n$k newanim/$c-src.png "$d" 7 2>&1 | grep -E "usage|STOP|HTTP" | tr '\n' ' '); echo "$c $k $out"
  echo "$out" | grep -q "generations': 1.0" || { echo "STOP usage!=1"; exit 1; }
done; done
echo DONE
