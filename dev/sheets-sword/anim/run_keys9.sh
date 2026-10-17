#!/bin/bash
# 9단계 걷기 마지막 1회씩 (직업당 최대 4 중 남은 1): 성기사 왼발 내딛기(칼 낮게), 견습 통과 자세
cd "$(dirname "$0")/.."
source <(sed -n '/^declare -A K S/,/^S\[paladin\]/p' anim/run_keys8.sh)
run(){ cls=$1; name=$2; d="$3 ${K[$cls]}"; src=${S[$cls]}
  [ ${#d} -le 500 ] || { echo "TOO LONG $cls $name ${#d}"; exit 1; }
  [ -f work/$cls/$name-0.png ] && { echo "skip $cls $name"; return; }
  out=$(MSYS_NO_PATHCONV=1 python -I plx.py edit $cls $name $src "$d" 23 2>&1 | tail -2); echo "$cls $name $(echo $out | tr '\n' ' ' | cut -c1-80)"
}
run paladin walkH "Walking with a long stride: left foot far forward, right foot far behind. The sword hangs low pointing down and back exactly as in the original, never raised."
run squire walkH "Walking, passing pose: both feet close together under the body, right knee slightly lifted, body one pixel higher."
echo DONE
