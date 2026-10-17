#!/bin/bash
# 창 계열 6종 키 자세 평타 일괄 (2026-10-18 로드맵 승인) — 직업마다 잔량 380 아래면 멈춤
PY=/c/AI/ComfyUI/.venv/Scripts/python.exe
for c in lancer dragoon halberdier cavalier warlord skyGeneral; do
  b=$(python -I -B plx.py bal | awk '/balance/{print int($2)}')
  if [ "$b" -lt 388 ]; then echo "STOP $c balance $b"; break; fi
  python -I -B spear_keys.py src $c
  for a in $(python -I -B -c "import sys; sys.path.insert(0,'.'); from spear_keys import ATK; print(' '.join(ATK['$c']))"); do python -I -B spear_keys.py edit $c $a; done
  $PY -I -B key_assemble.py $c | cut -c1-80
  $PY -I -B build.py $c --src gen 2>&1 | tail -1 | cut -c1-60
done
echo DONE
