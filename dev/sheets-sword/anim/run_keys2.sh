#!/bin/bash
# 2단계 pixen 키 자세 (로드맵 승인 13 안: 성기사 시전 3 + 검사 평타 4 + 검사 시전 3). 설명 500자 검사, usage>1 이면 멈춤
cd "$(dirname "$0")/.."
KP="Keep the same beige helmet with black visor slit and gold band, golden halo, white armor, same golden longsword length, kite shield stays on the left forearm. Side view facing right, no effects."
KS="Keep the same silver visored helmet with blue plume, blue scarf and short blue cape, silver armor, same steel longsword length. Side view facing right, no effects."
run(){ cls=$1; name=$2; src=$3; d="$4"
  [ ${#d} -le 500 ] || { echo "TOO LONG $name ${#d}"; exit 1; }
  [ -f work/$cls/$name-0.png ] && { echo "skip $name"; return; }
  out=$(MSYS_NO_PATHCONV=1 python -I plx.py edit $cls $name $src "$d" 11 2>&1 | tail -2); echo "$name $out"
  echo "$out" | grep -q "'generations': 1.0" || { echo "STOP usage/err $name"; exit 1; }
}
run paladin cast1 anim/paladin64-src.png "Change only the pose: holding the sword vertically in front of the visor with the right hand like a salute, standing straight. $KP"
run paladin cast2 anim/paladin64-src.png "Change only the pose: right arm raised straight up, sword pointing straight up to the sky, body stretched tall, head tilted up. $KP"
run paladin cast3 anim/paladin64-src.png "Change only the pose: stepping forward, right arm thrust straight forward, sword pointing straight ahead at chest height. $KP"
run swordsman key1 anim/swordsman64-src.png "Change only the pose: wind-up, knees bent, body turned back, sword pulled back over the right shoulder with the tip pointing back. $KS"
run swordsman key2 anim/swordsman64-src.png "Change only the pose: front foot stepping forward, right arm raised above the head, sword pointing straight up. $KS"
run swordsman key3 anim/swordsman64-src.png "Change only the pose: impact of a downward slash, deep lunge, front knee bent, body leaning forward, sword swung down in front pointing forward and down. $KS"
run swordsman key4 anim/swordsman64-src.png "Change only the pose: follow-through, rising from the lunge, legs apart, sword held low in front pointing forward and down. $KS"
run swordsman cast1 anim/swordsman64-src.png "Change only the pose: holding the sword vertically in front of the visor with the right hand like a salute, standing straight. $KS"
run swordsman cast2 anim/swordsman64-src.png "Change only the pose: right arm raised straight up, sword pointing straight up to the sky, body stretched tall, head tilted up. $KS"
run swordsman cast3 anim/swordsman64-src.png "Change only the pose: stepping forward, right arm thrust straight forward, sword pointing straight ahead at chest height. $KS"
echo DONE
