#!/bin/bash
# 걷기 키 자세 2장 + 앉기 (edit-image-pixen, 로드맵 승인 계획 대안, 재시도 0)
cd "$(dirname "$0")/../../.."
W1="the same character walking to the right mid-stride, left leg stepping forward and right leg behind, arms swinging with loose fists, side view facing right, face visible, same outfit and colors, no effects"
W2="the same character walking to the right mid-stride, right leg stepping forward and left leg behind, arms swinging with loose fists, side view facing right, face visible, same outfit and colors, no effects"
ST="the same character sitting on the ground resting with legs crossed, hands on knees, side view facing right, same outfit and colors, no effects"
MSYS_NO_PATHCONV=1 python -I dev/boxer/b/plx.py edit striker walkK2 dev/boxer/b/skel/striker/sitin.png "$W2" 2>&1 | grep -E "saved|STOP|HTTP|FAILED"
for c in kickboxer qigong fighter tempest grandmaster; do
  for k in walkK1 walkK2 sit; do
    d="$W1"; [ $k = walkK2 ] && d="$W2"; [ $k = sit ] && d="$ST"
    MSYS_NO_PATHCONV=1 python -I dev/boxer/b/plx.py edit $c $k dev/boxer/b/skel/$c/sitin.png "$d" 2>&1 | grep -E "saved|STOP|HTTP|FAILED" | sed "s/^/$c $k /"
  done
done
