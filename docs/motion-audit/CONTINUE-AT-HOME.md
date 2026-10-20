# 집에서 이어가기 · 견습기사 모션 작업

이 파일은 대화의 작업 요약이다. 전체 대화 기록을 내보낸 파일은 아니다.

## 현재 작업 위치

프로젝트: knight-bar. 현재 컴퓨터 경로 /Users/goodpy/Supercent/knight-bar.
최신 기준 포즈: docs/motion-audit/generated/squire-original-base/index.html 및 base.png.
보고서: docs/motion-audit/index.html (#squire).

미리보기는 프로젝트 루트에서 `python3 -m http.server 8765 --bind 127.0.0.1` 실행 후 http://127.0.0.1:8765/docs/motion-audit/generated/squire-original-base/ 를 연다. localhost 주소는 컴퓨터마다 다르므로 주소만 복사해도 파일이 옮겨지지 않는다.

## 사용자 확정 방향 · 최우선

- 최우선 아트 레퍼런스는 Skul: The Hero Slayer. Dead Cells는 리그·저해상도 렌더·핵심 포즈/타이밍을 위한 제작 파이프라인 참고다.
- 원래 견습기사의 픽셀 외형, 약간 정면이 보이는 3/4 방향, 작은 비율, 머리·얼굴·크림색 의상·검·둥근 방패를 유지한다. 옆모습/목각인형 같은 새 캐릭터로 바꾸지 않는다.
- 평타는 작은 기본 베기다. 왼손 검·반대 팔 방패를 전 구간 유지하고, 좌상단 준비→우하단 베기. 팔이 중간에 바뀌거나 수평 찌르기가 섞이면 미달이다.
- 상완·팔꿈치와 뒷다리→골반/허리→어깨→팔→앞다리 연결이 읽혀야 한다. 검 궤적만 돌리면 안 된다.
- 손잡이 접점, 발 접지, 무기 길이, 앞뒤 가림, 준비/타격/복귀를 실제로 본다. 뼈 길이 계산은 시각 품질 검증이 아니다.
- 프레임 수를 7개로 맞출 필요 없다. 휘두른 뒤 프레임이 너무 길다는 피드백이 있었다. 짧은 여운 뒤 빠르게 회수해 가드로 돌아온다.
- 스킬은 실제 행동을 나타내는 독립 애니메이션을 가져야 하며 공용 cast에 VFX만 바꾸면 안 된다. 견습기사 고유 등록 스킬은 현재 0개다.
- 게임 에셋/게임 코드 실제 교체는 별도 요청 전 진행하지 않는다. 검사는 건드리지 않는다.
- 사용자에게 승인 문구나 다음 작업 약속만 남기고 멈추지 말고, 승인된 범위의 구체적 작업을 수행한다. 과장된 완성/품질 검증 주장은 하지 않는다.

## 성공/미달 구분

현재 완료: 원본 idle F0를 픽셀 변경 없이 추출한 기준 포즈. squire-original-base/base.png는 src/sprites/squire.png의 첫 64×64 셀과 RGBA 픽셀 동일. 관절 표식은 별도 SVG로 분리했으며 가려진 부위는 수동 추정이다.

생성 시안 squire-basic-cut-v1~v5는 팔/장비 교환, 과도한 머리 위 준비, 불연속/외형 문제로 미채택. squire-rig-v1은 고정 관절 구조 실험이지 완성 아트가 아니다. squire-rig-asset-v1/v2는 코드로 도형을 칠한 결과이며 옆모습/목각인형/원본 외형 상실/부자연스러운 움직임으로 미채택. 이것들을 후속 외형 기준으로 사용하지 않는다.

아직 미완료: 원본 외형을 보존한 새로운 준비·타격·회수 원화와 실제 연속 동작. 최신 페이지는 새 공격 에셋을 완성한 것이 아니다.

## 바로 다음 작업

원본 외형을 기준으로 준비·타격·복귀의 최소 핵심 포즈를 만든다. 기존 캐릭터를 재설계하거나 실패한 도형 리그 외형을 다시 사용하지 않는다. 표정/의상 보존과 팔/장비의 같은 정체성을 먼저 육안 비교한다. 핵심 포즈가 성립한 후 필요한 중간 동작과 시간 배분을 붙인다.

시간 배분은 미구현 제안: 최저 swing 약385ms 기준 준비0~100ms, 베기100~135ms, 짧은 여운135~150ms, 회수150~220ms, 가드220~385ms. 현재 코드의 명중35%에 근접시킨 참고이며 실제 제작 후 조정한다. 프레임 수 고정 명령이 아니다.

## 저장소 보존

사용자 변경이 많다. 현재 tracked 변경 src/sprites/meta.js, swordsman.png, swordsman.json은 이전 사용자가 승인한 검사 v3다. 이 대화의 견습기사 실험은 이 파일들을 수정하지 않았다. 사용자 변경을 reset/clean/덮어쓰기 하지 않는다.

docs/motion-audit/와 여러 dev/build*, dev/preview*, dev/audit-squire.py는 아직 untracked일 수 있다. Git push만 하면 미추적 자료가 빠질 수 있으므로 옮길 때 프로젝트 폴더의 실제 파일까지 보존해야 한다.

검사 승인 기준: docs/motion-audit/generated/README.md 및 swordsman-basic-cut-v3-body.png, swordsman-basic-v3-ingame.gif. 검사 리소스 수정 금지.

참고 문서: references/skul-art-direction.md, references/dead-cells-direction.md, references/reference-review.md. 이전 문서와 상충하면 이 파일에 기록한 최신 사용자 피드백을 우선한다.

## 집에서 새 대화에 붙일 문장

"이 프로젝트의 docs/motion-audit/CONTINUE-AT-HOME.md를 읽고 견습기사 평타 작업을 이어가. 최신 기준은 원본 외형을 그대로 추출한 squire-original-base이고, 생성 v1~v5와 도형 픽셀 에셋 v1/v2는 미채택이야. 원본 외형 보존, 같은 검팔/방패팔, 작은 대각 베기, 짧은 여운과 빠른 복귀가 필수야. 게임 적용과 검사 변경은 하지 말고, 승인된 범위의 작업을 실제로 진행해."
