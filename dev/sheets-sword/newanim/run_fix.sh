#!/bin/bash
# 12단계 B 수리 (비평 2개 미달분, 직업당 1회 다시): 키 이름 n<k>r — build_new.py 가 r 판을 먼저 쓴다. 설명 500자 검사
cd "$(dirname "$0")/.."
declare -A K D
K[paladin]="Keep the same paladin: white and gold full plate, grey great helm with gold cross visor, kite shield with golden sun, short golden sword."
K[archon]="Keep the same archon: white and gold plate, great helm, ring of small gold stars above, small glowing gold wings, blue cape, one golden longsword."
K[blademaster]="Keep the same ronin: long black high ponytail, red headband, indigo kimono, red sash, wide black hakama, one slim curved katana."
K[tyrant]="Keep the same berserker: black spiked armor, wolf-skull helmet with red eyes, tattered black cape, enormous slab iron greatsword with red cracks."
D[paladin:k2]="Change only the pose: mid slash, the sword arm reaches forward past the shield, the golden sword swings down in front of the body pointing to the right, front foot stepping forward."
D[paladin:k3]="Change only the pose: follow-through, the golden sword extended forward to the right at waist height beyond the shield, deep forward lunge, shield pulled back."
D[paladin:c1]="Change only the pose: the golden sword held upright in the front hand in front of the chest, shield on the back arm, feet planted, calm."
D[paladin:c2]="Change only the pose: the golden sword thrust straight up toward the sky in the front hand, shield lowered on the back arm, chest out."
D[archon:k1]="Change only the pose: wind-up, the golden longsword gripped firmly in both hands and raised above and behind the head, hands visible on the hilt, body leaning back."
D[archon:c1]="Change only the pose: focusing power, facing right, the golden longsword held upright in front of the face with both hands, wings spread, feet planted."
D[archon:c2]="Change only the pose: facing right, the golden longsword raised straight up in the front hand, hand gripping the hilt, wings spread, chest out."
D[blademaster:k1]="Change only the pose: wind-up, the katana gripped in both hands on the hilt raised above the right shoulder, blade pointing back, knees bent, ready to strike."
D[blademaster:c1]="Change only the pose: focusing, the katana held upright in front of the face with both hands on the hilt, feet planted, calm."
D[blademaster:c2]="Change only the pose: the katana held in the front hand raised straight up, hand gripping the hilt, other hand open forward."
D[tyrant:k1]="Change only the pose: wind-up, the enormous greatsword gripped in both hands and lifted above and behind the head, hands on the hilt, body leaning back."
for kk in "$@"; do c=${kk%%:*}; k=${kk##*:}; d="${D[$kk]} ${K[$c]} Side view facing right, the sword stays in the hand, no effects."
  [ ${#d} -le 500 ] || { echo "TOO LONG $kk ${#d}"; continue; }
  [ -f work/$c/n${k}r-0.png ] && { echo "skip $kk"; continue; }
  out=$(MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8 /c/AI/ComfyUI/.venv/Scripts/python.exe -I -B plx.py edit $c n${k}r newanim/$c-src.png "$d" 11 2>&1 | grep -E "usage|STOP|HTTP" | tr '\n' ' '); echo "$kk $out"
  echo "$out" | grep -q "generations': 1.0" || { echo "STOP usage!=1"; exit 1; }
done
echo DONE
