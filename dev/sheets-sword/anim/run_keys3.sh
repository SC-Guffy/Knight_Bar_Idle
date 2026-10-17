#!/bin/bash
# 3단계 pixen 키 자세 (로드맵 승인 14: 검성·대검전사 평타 4 + 시전 3). 설명 500자 검사, usage>1 이면 멈춤
cd "$(dirname "$0")/.."
KB="Keep the same slate blue-gray samurai kabuto with gold crescent horns, red eye glow, crimson waist sash, one curved katana in each hand. Side view facing right, no effects."
KG="Keep the same steel helmet with orange crest, big steel pauldrons, orange belt, brown cape, the same huge wide greatsword held with both hands. Side view facing right, no effects."
run(){ cls=$1; name=$2; d="$3"; src=anim/${cls}64-src.png
  [ ${#d} -le 500 ] || { echo "TOO LONG $name ${#d}"; exit 1; }
  [ -f work/$cls/$name-0.png ] && { echo "skip $cls $name"; return; }
  out=$(MSYS_NO_PATHCONV=1 python -I plx.py edit $cls $name $src "$d" 11 2>&1 | tail -2); echo "$cls $name $(echo $out | tr '\n' ' ')"
  echo "$out" | grep -q "'generations': 1.0" || { echo "STOP $cls $name"; exit 1; }
}
run blademaster key1 "Change only the pose: wind-up, deep crouch, both katanas pulled back behind the body, blades pointing back. $KB"
run blademaster key2 "Change only the pose: stepping forward, front katana raised high above the head, back katana held low behind. $KB"
run blademaster key3 "Change only the pose: impact, deep lunge, front knee bent, both katanas slashed down in front pointing forward and down. $KB"
run blademaster key4 "Change only the pose: follow-through, rising from the lunge, both katanas held out to the sides, legs apart. $KB"
run blademaster cast1 "Change only the pose: both katanas crossed in an X in front of the chest, standing straight. $KB"
run blademaster cast2 "Change only the arms: both katanas raised straight up above the head. Head and body stay as they are. $KB"
run blademaster cast3 "Change only the pose: stepping forward, both katanas thrust straight forward at chest height. $KB"
run greatswordsman key1 "Change only the pose: wind-up, knees bent, the greatsword raised behind the head over the right shoulder, blade pointing back. $KG"
run greatswordsman key2 "Change only the pose: front foot stepping forward, the greatsword raised straight above the head with both hands. $KG"
run greatswordsman key3 "Change only the pose: impact of a heavy chop, deep lunge, body leaning forward, the greatsword swung down in front, tip near the ground. $KG"
run greatswordsman key4 "Change only the pose: follow-through, rising from the lunge, the greatsword held low in front pointing forward. $KG"
run greatswordsman cast1 "Change only the pose: the greatsword planted point-down in front, both hands resting on the hilt, standing tall. $KG"
run greatswordsman cast2 "Change only the arms: the greatsword raised straight up above the head with both hands. Head and body stay as they are. $KG"
run greatswordsman cast3 "Change only the pose: stepping forward, a wide horizontal swing, the greatsword held straight forward at chest height. $KG"
echo DONE
