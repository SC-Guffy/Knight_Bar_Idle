#!/bin/bash
# 10단계 (로드맵 승인 5): 직업당 pixen 1 — 다리가 드러난 중립 서기 자세 (walk_script 원본). 설명 500자 검사
cd "$(dirname "$0")/.."
declare -A K S
K[paladin]="Keep the same beige visored helmet, golden halo, white and cream armor, golden longsword, white kite shield with gold cross on the left arm."
K[squire]="Keep the same round steel cap with open young face, brown leather jerkin, cream tunic, short sword, small round wooden buckler on the left arm."
K[archon]="Keep the same white and gold armor, big helmet with a dark visor slit and a ring of gold stars above, golden longsword, star kite shield on the left arm."
K[tyrant]="Keep the same steel helmet with a spiked gold crown, crimson cape, spiked steel pauldrons, huge greatsword with a red rune."
K[swordsaint]="Keep the same kabuto with huge gold crescent horns, visible face, long white hair and white scarf, dark navy armor with blue highlights, blue curved katana."
S[paladin]=anim/paladin64-src.png; S[squire]=anim/squire64-key4.png; S[archon]=anim/archon64-src.png; S[tyrant]=anim/tyrant64-src.png; S[swordsaint]=anim/swordsaint64-key4.png
P="Change only the pose to a calm neutral standing pose: feet slightly apart, both legs clearly visible and separate below a short hem above the knees, the weapon held upright close to the chest so nothing hangs over the legs."
for c in paladin squire archon tyrant swordsaint; do d="$P ${K[$c]} Side view facing right, no effects."
  [ ${#d} -le 500 ] || { echo "TOO LONG $c ${#d}"; continue; }
  [ -f work/$c/neutral-0.png ] && { echo "skip $c"; continue; }
  out=$(MSYS_NO_PATHCONV=1 python -I plx.py edit $c neutral ${S[$c]} "$d" 31 2>&1 | tail -2); echo "$c $(echo $out | tr '\n' ' ' | cut -c1-80)"
done
echo DONE
