# 아트 퀄업 (AI 생성 → 도트 복원)

- 상태: 진행 중
- 관련 코드: `dev/bggen/` (gen.py·batch.py·post2.py), `src/bg/*.png`, `src/world.js` `drawZoneBg`
- 최종 갱신: 2026-10-13

## 목표

캐릭터는 코드로 그리는 저해상도 픽셀아트, UI 프레임은 SVG다. 여기에 AI 이미지 생성을 써서 배경·UI·아이콘의 퀄리티를 올린다. 사용자 취향은 "AI 티 안 나는, 저해상도지만 고퀄 도트"다.

## 규칙

- 생성: OpenRouter (키는 사용자 환경변수 `OPENROUTER_API_KEY`, 값 출력 금지). 현재 모델 `openai/gpt-5.4-image-2`, 장당 약 $0.11. 2026-10-13 등록 시점 잔액 약 $9.65.
- OpenRouter에는 픽셀 전용 모델이 없다. 그래서 생성 후 후처리가 필수다:
  - 생성물의 실제 격자(약 5px)를 찾아, 그 격자 단위 **최빈색**으로 복원한다. 평균 축소는 금지 (뭉개짐).
  - 세로 56줄 상한, 밝기 자동 보정 (목표 84), 위쪽 40% 바이엘 디더로 페이드한다.
  - 게임 팔레트 양자화, 필요하면 배경을 제거한다.
- 원본은 `dev/bggen/raw/` 에 둔다 (git 제외). 결과는 `src/bg/<deco>.png` 에 둔다.
- 화면 적용: `drawZoneBg` 가 2배(`BG_PX`)로 좌우반전 타일링한다.
- 직업 캐릭터 스프라이트는 별도 도구(PixelLab 1순위)로 진행한다: [character-sprites.md](character-sprites.md).
- [색깔놀이 금지](../../CLAUDE.md) 규칙은 그대로 적용한다.

## 수용 기준

- [x] 필드 원경 15종 적용, 스테이지 화면에서 타일링 이음새 없음
- [ ] UI 프레임·아이콘 시험 생성 → 후처리 → 적용 → 기존 대비 스크린샷 비교, 사용자 확인

## 진행 기록

- 2026-10-13: OpenRouter 사용 결정. 필드 원경 15장 생성·적용 (커밋 e7fc871).
- 2026-10-13: 큰 창 테두리 시험. 시안 A(남보라 돌+은 장식)·B(어두운 나무+철)·C(참나무+철 브래킷) 생성 (`dev/uigen/`, 장당 ~$0.23).
  `dev/uigen/slice.py` 로 9-slice PNG 변환: 원본 ~4px 격자 최빈색(반올림 색으로 골라야 철판이 바탕 남색에 안 묻힘) → 모서리 그대로·변은 1/4 지점 조각 반복, 안쪽 바탕색은 투명.
  C → `src/skin/frame-wood.png` (31 / 31px, border 14px), A → `src/skin/frame-stone-ai.png` (20 / 20px). 2배 도트 버전은 리벳이 뭉개져 폐기.
  A 는 변의 사슬 무늬가 잔점 노이즈가 됨 → 사용자가 "노이즈 같다"며 탈락, 나무 톤 통일 요청.
- 2026-10-13: UI 전체 나무 톤 통일 시안. `dev/make-skin.js` 팔레트를 호두나무·황동으로 바꿔 작은 SVG 프레임 재생성
  (노드: `ELECTRON_RUN_AS_NODE=1 "<VS Code>/Code.exe" dev/make-skin.js`), `pixel.css` 의 남보라 색(--px-* 와 하드코딩 값)을 갈색 계열로 1:1 치환.
  의미 있는 강조색(보라 스킬 버튼, 경고 빨강 등)은 유지.
  → 사용자: "기존이 더 깔끔하다". 전부 되돌림 (커밋 안 함). 이유 정리: 차가운 남보라 바탕이라야 초록 맵·금화·주황 버튼 같은
  따뜻한 강조색이 튄다. 갈색은 강조색과 같은 계열이라 탁해지고, 나뭇결 질감은 정보량만 늘린다.
  **결론: UI 톤(남보라+바랜 은)은 유지. 큰 창 테두리를 AI 생성으로 바꾸는 방향도 보류.**
- 2026-10-13: 원경이 하단바를 많이 덮어 데스크탑 위에서 노이즈하다는 피드백 → "땅에서 피어난" 낮은 띠로 변경.
  `post2.py ... c5 32 0.7 0.8 18`: 아래 18줄(2배 = 36px)만 남기고, 열마다 높이가 다른 윗선(폭 주기 사인 합, 높이 45~100%)으로 깎은 뒤
  윗선 3줄을 바이엘 디더. 결과 `dev/bggen/low/` → `src/bg/`. 미리보기 `dev/bgtest/low_ingame.png`.
  → 사용자: "원경이 잘려 보인다" (큰 장면 아래만 잘라 나무 기둥·절벽 중간이 끊김). 장면 전체를 18줄로 축소도 시험했으나 뭉개져 탈락.
- 2026-10-13: 낮은 지면 띠를 처음부터 다시 생성 (`batch.py --low` → `dev/bggen/raw_low/`, 15장 ~$1.7).
  프롬프트: 땅 위 키 작은 물체(덤불·바위·풀숲·필드 소품)만, 전부 온전한 모양, 이미지 아래 14%.
  후처리 `post2.py raw_low/raw_<k>.png low2/<k>.png c5 32 0.7 0.8 0 0.15` → `trimground.py low2/<k>.png ../../src/bg/<k>.png 0.85`
  (`trimground.py`: 바닥 여백 줄 제거 — 안 하면 띠가 땅에서 뜬다 — 후 AI 가 그린 꽉 찬 땅 판 줄을 2줄만 남기고 깎는다. 게임 자체 땅이 있으므로).
  결과 10~24줄(화면 20~48px). 미리보기 `dev/bgtest/low2_ingame.png`. 사용자 확인 → 0.19.19 로 배포.
- UI 퀄업 방향 확정 (톤 유지, 어긋난 곳 맞추기, 1→4 전부): 1) 이모지 아이콘 → 12~16px 도트 아이콘,
  2) 큰 창 모서리 은색 장식(직접 도트, make-skin.js), 3) 섹션 제목·구분선·창 제목 명판, 4) 주요 버튼 하이라이트·눌림.
- 2026-10-13: UI 퀄업 1) 이모지 → 도트 아이콘 1단계 시안 (캠프 탭 6개, 직접 도트). 상세·이모지 조사표·남은 단계는 [ui-icons.md](ui-icons.md).
  `dev/make-icons.js` → `src/skin/icons.svg`·`icons.css`, HTML 은 `ico('이름')`. 사용자 확인 → 0.19.20 배포(다른 세션).
  이어서 2·3단계(창 머리·재화·HUD·말풍선·h3·버튼·비용 칩·웹 상단 띠) + 금화 `.gc` 도트화, 4단계로 문장·데이터·캔버스 이모지까지 자동 변환.
  아이콘 184개, 0.19.21 배포. 상세는 ui-icons.md.
- 2026-10-13: UI 퀄업 2)~4) 적용 (단계마다 800x680 1:1 전후 스크린샷으로 사용자 확인). 질감·잔점 없이 기존 은회색 3색 + 잉크만 쓴다.
  - 2) `make-skin.js` `frame()` 에 `cap` 인자(왼쪽 위 기준 패턴, 세 모서리는 거울상, `'h'` = 판 베벨로 빛은 늘 왼쪽 위).
    `frame-panel` 네 모서리에 5px 은 판 + 리벳 구멍. 판 안쪽 끝 픽셀은 은 안선(`B`)으로 이어야 선이 안 끊겨 보인다. 슬라이스 6 안이라 변 타일 영향 없음.
  - 3) 창 제목 글자를 `<span class="ttl">` 로 감싸 은 베벨 명판(`frame-plate.svg`, 2 / 4px). 동기화 문구는 판 밖.
    명판 때문에 헤더가 넓어져 `.res` 가 두 줄로 갈라졌다 → `.res > span` nowrap, 대신 긴 동기화 문구(오프라인 경고)는 h2 에서 … 말줄임.
    섹션 제목 밑 2px 구분선(은 머리 6px + 2px 간격 도트 `--px-hi`), `.shead` 는 줄 전체 밑에 긋는다 (`--px-rule`).
  - 4) `.go`: 안쪽 위 1px 하이라이트·아래 2px 그늘, hover 는 밝기 필터 대신 `#c08a34`, 눌림은 그림자 높이(3px)만큼 내려앉고
    `frame-gold-down.svg`(베벨 반전) + 위쪽 안 그늘. 비활성 버튼은 hover·눌림에 반응하지 않게(`:disabled:hover` 원래 색, `:not(:disabled):active`),
    `.x`·`.mailbtn` 에도 눌림 추가. 버튼 상태 견본: `dev/ui-buttons.html` (상태를 클래스로 고정해 한 화면에 비교).

- 2026-10-13: 캐릭터 폴리싱 비용 조사. 대상은 직업 29·필드 몬스터 76·레이드 보스 약 10·월드 보스 3, 합계 약 118종. 이후 [character-sprites.md](character-sprites.md) 로 이어짐.
  현재 모델로 동작 시트를 생성하면 약 $60~70가 들고 프레임 간 일관성이 약하다.
  Retro Diffusion 공식 API(github.com/Retro-Diffusion/api-examples) 조사 결과:
  `rd_advanced_animation__*` 는 시작 프레임(`input_image`, 32~256px)을 받아 walking·idle·attack 등을 장당 $0.14로 만든다.
  프롬프트만 쓰는 애니메이션은 $0.07~0.25, RD Pro 정지 이미지는 최대 $0.18이다. 잔액은 USD 선불이고 실패한 생성은 환불된다.
  Replicate 에는 rd-plus·rd-animation 등이 있지만 advanced animation(시작 프레임 입력)이 있는지는 확인하지 못했다. 공식 API 직결을 권장한다.
- 2026-10-13: 로컬 생성(ComfyUI) 시험. SDXL+pixel-art-xl 과 Z-Image Turbo+픽셀 LoRA 로 W1b·H1·C1·W1 을 PixelLab 과 같은 조건으로 비교했다 (위 "로컬 생성(ComfyUI) 시험" 절, 검토 페이지 `dev/review/comfy-vs-pixellab.html`).
  품질은 PixelLab 우위, Z-Image 가 SDXL 보다 낫고, 기준 그림 고정 img2img 로 프레임 일관성이 나온다. 섞어 쓰기를 제안했고 사용자 결정 대기.

## 로컬 생성(ComfyUI) 시험 (2026-10-13, 사용자 확인 대기)

PixelLab Tier 1(월 2,000회)은 VFX 텍스처 121장 + 권투가 스프라이트로 하루 이틀이면 다 쓴다. 그래서 횟수 제한이 없는 로컬 생성이 PixelLab 만큼 쓸 만한지 같은 텍스처로 비교했다.

- 검토 페이지: `dev/review/comfy-vs-pixellab.html` (서버 `python -m http.server 8818 -d <저장소 루트>` → `http://localhost:8818/dev/review/comfy-vs-pixellab.html`).
  텍스처마다 PixelLab·SDXL·Z-Image 를 1×·4×·견습 기사 옆 재생으로 나란히 두고, 후보 8장씩 전부와 속도·횟수 표를 넣었다.
- 설치 (이 PC 만, 저장소·OneDrive 밖): `C:\AI\ComfyUI` (공식 git), Python 3.13 가상환경 `.venv`, PyTorch 2.14 cu130. 모델 약 26GB 는 `C:\AI\ComfyUI\models`.
  서버: `C:\AI\ComfyUI\.venv\Scripts\python.exe main.py --listen 127.0.0.1 --port 8188`. 원본 1024px 그림은 `C:\AI\comfy-raw`.
- 모델 (모두 Hugging Face 공식 저장소, 상업 사용 가능 라이선스):
  - SDXL: `stabilityai/sd_xl_base_1.0` + `madebyollin/sdxl-vae-fp16-fix` + LoRA `nerijs/pixel-art-xl` (dpmpp_2m karras 25스텝 cfg 6).
  - Z-Image Turbo: `Comfy-Org/z_image_turbo` bf16 + `qwen_3_4b_fp8_mixed` + `ae` + LoRA `tarn59/pixel_art_style_lora_z_image_turbo` (res_multistep 8스텝 cfg 1, AuraFlow shift 3). Apache 2.0.
- 스크립트 `dev/comfy/` (ComfyUI 가상환경 파이썬으로 실행 — 시스템 파이썬 3.14 에는 numpy 가 없다):
  `comfy.py`(HTTP API, 업로드·img2img) · `post.py`(후처리) · `trial.py cands|anim|sheet`(후보·기준 그림 고정 프레임·한 장 시트) · `bench.py`(속도) · `look.py`(밀착 시트).
  결과 `dev/comfy/out/{cand,anim,thumb}`, 비교용 PixelLab 원본 `dev/comfy/pixellab/`, 견습 기사 도트(30×35) `dev/comfy/ref/`.
- 후처리: 테두리 중앙값을 바탕색으로 보고 뗀다 → 도트 칸마다 덮인 비율 40% 이상이면 칠하고 색은 칸 안 **최빈 밝기 단계** →
  그림 안 밝기 순위(15·20·25·20·20%)로 5단 램프(PixelLab W1b·H1·C1 에서 뽑은 흰~하늘색) → 3칸 미만 덩어리 지우기 → 바깥 외곽선 `#0b0d14`.
  고정 밝기로 자르면 생성물의 흰색이 넓어 거의 한 단이 되므로 순위로 나눴다. 여러 프레임은 자르기 상자를 같이 쓰고, 마지막 두 프레임은 밝기 상한(3·2단)으로 사라지게 한다.
- **결과**
  - 품질: **PixelLab 이 확실히 위다.** PixelLab 은 32px 를 직접 그려 1도트 하이라이트·가늘어지는 끝·정돈된 파편이 있다. ComfyUI 는 1024px → 32칸 축소라 가장자리 계단 잡음이 생기고 반짝이·가는 속도선이 뭉치거나 사라진다.
  - 모델: **Z-Image 가 SDXL 보다 낫다.** 쓸 만한 후보 W1b 4/8·H1 6/8·C1 6/8 (SDXL 2/8·3/8·1/8). SDXL 은 도트 질감·명암은 좋지만 회색 바탕·그림자·엉뚱한 구도(칼, 산, 고리)를 넣는다. "sword" 를 넣으면 칼을 그려서 "energy slash arc" 로 바꿨다.
  - 여러 프레임: **기준 그림 고정 img2img 가 된다.** 키 그림을 코드로 바꾸고(H1: 0.7배 → 원본 → 조각 밀어내기 3단계, W1: 호 중심 기준 각도로 위부터 드러내기 → 꼬리 부수기) denoise 0.45 로 다시 그리게 하면 모양·색이 이어진다.
    흩어지는 끝 프레임은 덩어리로 남는다. W1 은 회색 연기·주황 테두리 없이 나왔다. 키 그림 바탕(SDXL 회색)은 먼저 검정으로 지워야 하고, W1 각도 중심은 상자 가운데가 아니라 호의 원 중심 근처여야 한다.
  - 한 장에 5프레임: Z-Image C1 은 프레임끼리 일관되지만 변화가 거의 없다. H1 은 흰 판·크기 들쭉날쭉, W1 은 프레임이 붙어 실패 (PixelLab 과 같은 실패). SDXL 은 전부 실패.
  - 속도 (같은 모델 연속, `bench.py`): 1024px 한 장 SDXL 6.5초·Z-Image 7.4초, 4장 배치도 장당 같음, 768px 는 4.2~4.6초. 모델 교체·첫 로드 +8~18초, VRAM 약 14GB.
    8시간이면 약 3,900장. 텍스처 1장(키 후보 4~8장 + 프레임 4장)이 1~1.5분이라 121장 시안이 2~3시간이다.
- **제안 (사용자 결정 대기): 섞어 쓰기.** 최종 텍스처(특히 평타 H·W, 궁극기 F)는 PixelLab. 콘셉트가 안 정해진 것은 ComfyUI(Z-Image)로 수십 장 시안을 뽑아 모양을 고른 뒤 그 그림을 PixelLab 기준 그림으로 넣어 횟수를 아낀다.
  모양이 크고 단순해 축소에 강한 것(C1 초승달·C3 고리·C5 큰 폭발·C15 먹구름)은 ComfyUI 결과를 바로 써 볼 만하다.

## 남은 일 / 미정

- ComfyUI 시험 결과를 사용자가 검토 페이지로 확인 → PixelLab 만 / ComfyUI 만 / 섞어 쓰기 결정. 섞어 쓰기면 skill-vfx.md 텍스처 목록에 텍스처별 도구를 적는다.
- (ComfyUI 를 더 쓴다면) 후처리 개선 후보: 축소 전 가장자리 정리(계단 잡음), 1도트 반짝이 살리기, 의도된 디더. Z-Image 로 시안 → PixelLab `animate-with-text-v3` 기준 그림으로 넣는 연결 시험.

- 다음 대상: UI 프레임·아이콘 시험 생성 (순서: 배경 → UI → 아이콘).
- 직업 캐릭터 통짜 스프라이트 전환은 [character-sprites.md](character-sprites.md) 로 분리했다 (PixelLab 시험 예정).
