#!/bin/sh
# 워크벤치 내보내기 받기: get.sh <image id> <내보낸 이름> <저장 이름>
cd "$(dirname "$0")/raw" && for f in png json; do curl -sf -o "$3.$f" "https://api.pixellab.ai/mcp/pixel-tools/$1/$2.$f" || echo "fail $f"; done; ls -la "$3.png"
