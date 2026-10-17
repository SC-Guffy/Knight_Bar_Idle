#!/bin/sh
# exp.sh <step id> <시트 id> [frames] [replace effect id]
#  워크벤치 내보내기(My effects 'knightbar-<시트>') → raw/<시트>.png·json 받기 → raw/<시트>-strip.png (가로 띠) → 수용 기준 측정
cd "$(dirname "$0")"
step=$1; id=$2; n=$3; rep=$4
if [ -n "$rep" ]; then extra="--replace $rep"; else extra=""; fi
out=$(python ../../pixellab/mcpw.py wb ../raw/$id-exp $step export --name knightbar-$id $extra 2>&1)
echo "$out" | grep -E "saved to|^download|effect id" | head -3
img=$(echo "$out" | grep -o 'image id: [0-9a-f-]*' | head -1 | cut -d' ' -f3)
[ -z "$img" ] && { echo "export failed"; echo "$out" | tail -5; exit 1; }
sh ../get.sh "$img" knightbar-$id $id > /dev/null
python ../../vfx5/strip.py ../raw/$id.png ../raw/$id.json ../raw/$id-strip.png $n
python ../measure.py ../raw/$id-strip.png ${n:-$(python -c "import json;f=json.load(open('../raw/$id.json'))['frames'];print(len(f))")}
