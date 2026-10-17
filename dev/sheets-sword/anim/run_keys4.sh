#!/bin/bash
# 4단계 (로드맵 승인 14: 대검전사 key3 재편집 ≤2 + 걷기 키 3 × 4종). 설명 500자 검사, usage>1 이면 멈춤
cd "$(dirname "$0")/.."
declare -A K
K[paladin]="Keep the same beige helmet with black visor slit and gold band, golden halo, white armor, golden longsword held low, kite shield on the left forearm. Side view facing right, no effects."
K[swordsman]="Keep the same silver visored helmet with blue plume, blue scarf and short blue cape, silver armor, steel longsword held low. Side view facing right, no effects."
K[blademaster]="Keep the same slate blue-gray samurai kabuto with gold crescent horns, red eye glow, crimson waist sash, one curved katana in each hand held low. Side view facing right, no effects."
K[greatswordsman]="Keep the same steel helmet with orange crest, big steel pauldrons, orange belt, brown cape, the same huge wide greatsword resting on the shoulder. Side view facing right, no effects."
run(){ cls=$1; name=$2; d="$3 ${K[$cls]}"; src=anim/${cls}64-src.png
  [ ${#d} -le 500 ] || { echo "TOO LONG $cls $name ${#d}"; exit 1; }
  [ -f work/$cls/$name-0.png ] && { echo "skip $cls $name"; return; }
  out=$(MSYS_NO_PATHCONV=1 python -I plx.py edit $cls $name $src "$d" 11 2>&1 | tail -2); echo "$cls $name $(echo $out | tr '\n' ' ' | cut -c1-90)"
  echo "$out" | grep -q "'generations': 1.0" || { echo "STOP $cls $name"; exit 1; }
}
run greatswordsman key3b "Change only the pose: impact of a heavy overhead chop, deep lunge, front knee bent, both hands on the hilt in front of the chest, the whole wide greatsword in one piece swung down in front, blade pointing forward and down."
for c in paladin swordsman blademaster greatswordsman; do
  run $c walk1 "Change only the legs: walking, right foot stepping forward, left foot behind, long stride, arms swing slightly."
  run $c walk2 "Change only the legs: walking, passing pose, left knee raised forward, right foot under the body, body slightly higher."
  run $c walk3 "Change only the legs: walking, left foot stepping forward, right foot behind, long stride, arms swing slightly."
done
echo DONE
