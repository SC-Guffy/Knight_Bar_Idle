#!/bin/bash
# 걷기 8f 6종 + 앉기 pixen 6장 (로드맵 승인 계획 안, 재시도 0)
cd "$(dirname "$0")/../../.."
for c in striker kickboxer qigong fighter tempest grandmaster; do
  MSYS_NO_PATHCONV=1 python -I dev/boxer/b/plx.py raw $c skelW /animate-with-skeleton-v3 dev/boxer/b/skel/$c/req-W.json 2>&1 | grep -E "saved|STOP|HTTP|FAILED"
  python -I -B dev/boxer/b/skelgen.py post $c W >/dev/null
done
for c in striker kickboxer qigong fighter tempest grandmaster; do
  MSYS_NO_PATHCONV=1 python -I dev/boxer/b/plx.py edit $c sit dev/boxer/b/skel/$c/sitin.png "the same character sitting on the ground resting with legs crossed, hands on knees, side view facing right, same outfit and colors, no effects" 2>&1 | grep -E "saved|STOP|HTTP|FAILED"
done
