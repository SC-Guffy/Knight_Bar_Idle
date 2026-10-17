#!/bin/bash
# 12단계 C (로드맵 승인, 사용자 "남은일도 지금 처리해"): 임시 걷기 6종 — 다리가 드러난 옆모습 서기 원본 pixen 1회 (칼 든 채, 새 디자인 그대로)
#  원본 그림 = 시트 기준 그림 (옆모습 통일 4종은 c1 판, 나머지는 src). 설명 500자 검사, 호출 직전 잔량은 plx.py 가 FLOOR 310 으로 확인
cd "$(dirname "$0")/.."
declare -A K S
K[paladin]="Keep the same paladin: white and gold full plate, grey great helm with gold cross visor, kite shield with golden sun, short golden sword."
K[archon]="Keep the same archon: white and gold plate, great helm, ring of small gold stars above, small glowing gold wings, blue cape, golden longsword."
K[blademaster]="Keep the same ronin: long black high ponytail, red headband, indigo kimono, red sash, slim curved katana. Hakama hem short above the ankles."
K[greatswordsman]="Keep the same black swordsman: spiky black hair, dark iron armor, tattered black cape behind, iron left arm, enormous slab iron greatsword."
K[tyrant]="Keep the same berserker: black spiked armor, wolf-skull helmet with red eyes, tattered black cape behind, enormous slab iron greatsword with red cracks."
K[swordsaint]="Keep the same sword saint: long white high ponytail, gold crescent ornament, white and gold haori, glowing blue katana. Hakama hem short above the ankles."
P="Change only the pose: calm standing pose in side view facing right, feet slightly apart, both legs clearly visible and separate with a gap between them, the sword held upright close to the chest so nothing hangs over the legs."
for c in "$@"; do
  src=work/$c/nc1r-0.png; [ -f $src ] || src=work/$c/nc1-0.png
  case $c in greatswordsman|swordsaint) src=newanim/$c-src.png;; esac
  d="$P ${K[$c]} No effects."
  [ ${#d} -le 500 ] || { echo "TOO LONG $c ${#d}"; continue; }
  [ -f work/$c/nstand-0.png ] && { echo "skip $c"; continue; }
  out=$(MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8 /c/AI/ComfyUI/.venv/Scripts/python.exe -I -B plx.py edit $c nstand $src "$d" 13 2>&1 | grep -E "usage|STOP|HTTP|bal" | tr '\n' ' '); echo "$c $out"
  echo "$out" | grep -q "generations': 1.0" || { echo "STOP usage!=1"; exit 1; }
done
echo DONE
