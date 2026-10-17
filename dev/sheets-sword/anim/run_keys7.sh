#!/bin/bash
# 7단계 예비 재편집 (계획서 예비 ≤5): 비평 s5 미달 키만. 설명 500자 검사, usage>1 이면 멈춤
cd "$(dirname "$0")/.."
source <(sed -n '/^declare -A K/,/^run(){/p' anim/run_keys6.sh | sed '$d')
source <(sed -n '/^K\[squire\]=/p;/^K\[tyrant\]=/p' anim/run_keys5.sh)
run(){ cls=$1; name=$2; d="$3 ${K[$cls]}"; src=anim/${cls}64-src.png
  [ ${#d} -le 500 ] || { echo "TOO LONG $cls $name ${#d}"; exit 1; }
  [ -f work/$cls/$name-0.png ] && { echo "skip $cls $name"; return; }
  out=$(MSYS_NO_PATHCONV=1 python -I plx.py edit $cls $name $src "$d" 11 2>&1 | tail -2); echo "$cls $name $(echo $out | tr '\n' ' ' | cut -c1-80)"
  echo "$out" | grep -q "'generations': 1.0" || { echo "STOP $cls $name"; exit 1; }
}
run archon key2r "Change only the pose: stepping forward, the ONE golden longsword raised straight above the head with the right hand, only one sword in the picture, shield stays on the left arm."
run archon key3r "Change only the pose: deep lunge, the ONE golden longsword swung down in front pointing forward and down, only one sword in the picture, shield stays on the left arm."
run squire cast1r "Change only the arms: the short sword held vertically in front of the face with the right hand like a salute, the round steel cap stays on, buckler on the left arm."
run tyrant cast2r "Change only the arms: the same huge greatsword with the red rune raised straight up above the head with both hands, same blade size and shape."
run tyrant key2r "Change only the pose: stepping forward, the same huge greatsword raised above the head, both hands gripping the hilt, same blade size and shape."
echo DONE
