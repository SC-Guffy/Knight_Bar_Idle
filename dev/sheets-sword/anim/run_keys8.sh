#!/bin/bash
# 8단계 걷기 재도전 (로드맵 승인, 상한 165): 검성·대검전사 합격 방식(다리만, 무기·투구 고정, 확정 그림 원본). 직업당 3 + 예비 1. 설명 500자 검사, usage>1 이면 멈춤
cd "$(dirname "$0")/.."
declare -A K S
K[paladin]="Legs only. The same single golden sword stays in the right hand at the same angle, the same kite shield stays on the left arm, same helmet, halo and armor. Side view facing right, no effects."
K[squire]="Legs only. The same short sword stays in the right hand at the same angle, the same round wooden buckler stays on the left arm, same round steel cap and face, same brown leather jerkin. Side view facing right, no effects."
K[archon]="Legs only. The same single golden longsword stays in the right hand at the same angle, the same star kite shield stays on the left arm, same helmet with the gold star ring above. Side view facing right, no effects."
K[tyrant]="Legs only. The same huge greatsword stays held at the same angle by the same hands, same spiked gold crown helmet, crimson cape and spiked pauldrons. Side view facing right, no effects."
S[paladin]=anim/paladin64-src.png; S[squire]=anim/squire64-key4.png; S[archon]=anim/archon64-src.png; S[tyrant]=anim/tyrant64-src.png
run(){ cls=$1; name=$2; d="$3 ${K[$cls]}"; src=${S[$cls]}
  [ ${#d} -le 500 ] || { echo "TOO LONG $cls $name ${#d}"; exit 1; }
  [ -f work/$cls/$name-0.png ] && { echo "skip $cls $name"; return; }
  out=$(MSYS_NO_PATHCONV=1 python -I plx.py edit $cls $name $src "$d" 23 2>&1 | tail -2); echo "$cls $name $(echo $out | tr '\n' ' ' | cut -c1-80)"
  echo "$out" | grep -q "'generations': 1.0" || { echo "FAIL $cls $name"; }
}
for c in paladin squire archon tyrant; do
  run $c walkD "Walking with a long stride: right foot far forward, left foot far behind, knees bent."
  run $c walkE "Walking, passing pose: left knee lifted high in front, right foot planted under the body."
  run $c walkF "Walking with a long stride: left foot far forward, right foot far behind, knees bent."
done
echo DONE
