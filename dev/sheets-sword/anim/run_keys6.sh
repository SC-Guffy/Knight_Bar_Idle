#!/bin/bash
# 6단계 (로드맵 승인 56 안): 성좌기사(·검신) 평타 4 + 시전 3 + 걷기 3
cd "$(dirname "$0")/.."
declare -A K
K[archon]="Keep the same celestial archon: white and gold plate armor, big helmet with a dark visor slit and a ring of small gold stars above, star-emblem kite shield on the left arm, golden longsword in the right hand. Side view facing right, no effects."
K[swordsaint]="Keep the same sword saint: white haori, kabuto with big gold crescent horns, visible face with red eyes, red sash, one glowing cyan katana in each hand. Side view facing right, no effects."
K[squire]="Keep the same young squire: round steel cap with open face, brown leather jerkin, cream tunic, short plain sword in the right hand, small round wooden buckler on the left arm. Side view facing right, no effects."
K[tyrant]="Keep the same tyrant king: steel helmet with a spiked gold crown, crimson cape, spiked steel pauldrons, the same huge greatsword with a red rune held with both hands. Side view facing right, no effects."
K[paladin]="Legs only. The same single golden sword stays in the right hand at the same angle, the same kite shield stays on the left arm, same helmet, halo and armor. Side view facing right, no effects."
K[blademaster]="Legs only. The same two katanas stay in the same hands at the same angles, same horned kabuto, same face, same armor. Side view facing right, no effects."
K[greatswordsman]="Legs only. The same greatsword stays on the right shoulder held by the same hand, same helmet with orange crest, pauldrons and cape. Side view facing right, no effects."
run(){ cls=$1; name=$2; d="$3 ${K[$cls]}"; src=anim/${cls}64-src.png
  [ ${#d} -le 500 ] || { echo "TOO LONG $cls $name ${#d}"; exit 1; }
  [ -f work/$cls/$name-0.png ] && { echo "skip $cls $name"; return; }
  out=$(MSYS_NO_PATHCONV=1 python -I plx.py edit $cls $name $src "$d" 11 2>&1 | tail -2); echo "$cls $name $(echo $out | tr '\n' ' ' | cut -c1-80)"
  echo "$out" | grep -q "'generations': 1.0" || { echo "STOP $cls $name"; exit 1; }
}
for c in $CLASSES; do
  run $c key1 "Change only the pose: wind-up, knees bent, weapon pulled back behind the shoulder, blade pointing back."
  run $c key2 "Change only the pose: front foot stepping forward, weapon raised straight above the head."
  run $c key3 "Change only the pose: impact of a downward slash, deep lunge with the right foot forward, weapon in one piece swung down in front, pointing forward and down to the right."
  run $c key4 "Change only the pose: follow-through, rising from the lunge, weapon held low in front pointing forward."
  run $c cast1 "Change only the pose: weapon held vertically in front of the face like a salute, standing straight."
  run $c cast2 "Change only the arms: weapon raised straight up above the head. Head and body stay as they are."
  run $c cast3 "Change only the pose: stepping forward, weapon thrust straight forward at chest height."
  run $c walkA "Walking: right foot stepping forward, left foot behind, long stride."
  run $c walkB "Walking: passing pose, left knee raised forward, right foot under the body."
  run $c walkC "Walking: left foot stepping forward, right foot behind, long stride."
done
echo DONE
