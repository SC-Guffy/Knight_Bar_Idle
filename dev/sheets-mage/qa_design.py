# 디자인 후보 도트 검수 준비 (docs/specs/pixel-qa.md — 사용자 지시 2026-10-16 "사용자에게 보이기 전에 모든 후보를 검수에 통과시킨다").
#  design/raw/<이름>.png (1024) → shrink2 (키 46, 14색, 외곽선 보존) → design/qa/<이름>/ 에 qa.py 검수 시트·지표 (캐릭터 모드 kind='char', 로더 없이 그대로)
#  그다음 세션이 비평 서브에이전트(dev/pixel-qa/critic.md 지침)에 sheet.png + metrics.json + INTENT 를 넘겨 verdict.json 을 받는다.
#  ComfyUI 가상환경 파이썬으로 실행 (numpy):  C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/sheets-mage/qa_design.py [이름 접두 ...]
import os, sys, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'pixel-qa'))
import design as D
import qa

COMMON = ('3등신(머리가 키의 약 1/3) 여성 마법사 한 명의 옆모습 전신 도트, 오른쪽을 본다, 게임 안 키 약 46칸. '
          '사용자 지적 반영: 명암이 한 덩어리로 뭉개지지 않고 얼굴(눈)이 보인다 · 조금 더 여성스럽게(부드러운 얼굴선, 큰 눈, 과한 노출·과장 없이) · '
          '소매에서 팔뚝이 나오고 무릎 위 치마형 로브 아래로 두 다리·부츠가 보인다(관절 애니에서 팔·다리가 움직여야 함). '
          '지팡이는 시트에서 따로 덧그리므로 지팡이 모양은 감점하지 않는다. 바탕·글자·그림자 없음. 같은 계열 다른 직업과 머리 모양으로 실루엣이 갈린다.')
INTENT = {
    'mage': '견습 마법사: 끝이 뒤로 꺾인 챙 넓은 파란 원뿔 모자 + 긴 갈색 머리, 파란 튜닉 드레스·가죽 허리띠. ',
    'pyromancer': '화염술사: 뒤로 길게 휘날리는 불꽃 같은 주황 포니테일 + 붉은 머리띠, 민소매(팔 드러남)·토시, 뒤로 날리는 띠, 짧은 붉은 치마. ',
    'cryomancer': '빙결술사: 머리에 쓴 둥근 하늘색 후드 + 후드 아래로 어깨에 늘어진 흰 땋은 머리(로드맵 전달 컨셉 "후드 아래 흰 땋은 머리"), 흰 털 칼라, 어깨 망토, 긴 흰 장갑, 짧은 하늘색 치마·흰 털 부츠. ',
    'electromancer': '뇌전술사: 뒤로 뻗친 금발 + 남색 관에 V 자로 벌어진 하늘색 번개 뿔 둘, 금 단추 남색 코트 드레스와 갈라진 꼬리, 남색 스타킹·부츠. ',
    # 3차 (2026-10-17 안 A): 2차 특징을 잇되 실루엣 틀이 2차와 달라야 한다 — 2차와 색만 다른 것처럼 보이면 감점(색깔놀이)
    'archmage': '대마도사(화염술사 3차): 뒤로 길게 휘날리는 불꽃 포니테일 + 짧은 쌍뿔 금빛 불꽃 관, 머리 뒤 둥근 불꽃 고리, 앞이 트인 긴 검붉은 장포(다리·부츠 보임), 넓은 금 견갑, 금테 토시. 화염술사보다 장포·견갑·관으로 틀이 커져야 한다(색만 다르면 감점). ',
    'frostlord': '빙결의 군주(빙결술사 3차): 뾰족한 얼음 결정 왕관, 등 뒤로 긴 흰 생머리, 날카로운 결정 견갑, 뒤로 흐르는 고드름 끝단 흰 긴 망토, 하늘색 튜닉·긴 흰 장갑·하늘색 바지·흰 털 부츠. 빙결술사의 둥근 후드 실루엣과 달라야 한다(색만 다르면 감점). ',
    'thunderEmperor': '뇌제(뇌전술사 3차): 큰 금빛 번개 뿔 관, 뒤로 뻗친 흰 머리, 등 뒤 살 있는 번개 바퀴, 금테 남색 짧은 망토, 금 단추 긴 남색 코트와 긴 갈라진 꼬리, 걷은 소매, 남색 스타킹·부츠. 대마도사의 둥근 불꽃 고리와 바퀴(살)로 갈리고, 뇌전술사보다 관·망토·코트로 틀이 커져야 한다(색만 다르면 감점). ',
}
QA = os.path.join(D.D, 'qa')


def prep(names):
    os.makedirs(QA, exist_ok=True)
    out = []
    for n in names:
        raw = os.path.join(D.RAW, n + '.png')
        px = D.shrink2(Image.open(raw), 46)
        if px is None: continue
        d = os.path.join(QA, n); os.makedirs(d, exist_ok=True)
        pad = Image.new('RGBA', (px.width + 6, px.height + 2)); pad.alpha_composite(px, (3, 1)); px = pad      # 칸 가장자리 닿음 경고 없게 여백
        pp = os.path.join(d, 'px.png'); px.save(pp)
        cls = n.split('_')[0]
        res, _ = qa.run(pp, n, None, 1, False, INTENT[cls] + COMMON, d, scale=1.0, kind='char')      # 캐릭터 모드: 로더 없이 그대로
        out.append((n, res['gate']['pass'], [f['k'] for f in res['flags']], res['metrics'].get('colors')))
    return out


if __name__ == '__main__':
    pre = sys.argv[1:] or ['']
    names = sorted(f[:-4] for f in os.listdir(D.RAW) if f.endswith('.png') and not f.startswith('_') and ('_v2' in f or '_v3' in f or '_v4' in f or '_v5' in f) and '-113' not in f and any(f.startswith(p) for p in pre))
    for row in prep(names): print(*row)
