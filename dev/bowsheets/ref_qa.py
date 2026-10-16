# 기준 그림 정리본 검수 준비: PixelLab image-to-pixelart 결과 work/<cls>/ref64-0.png →
#   design/ref/<cls>-clean.png (공용 polish.unbg: 바탕·잡점만 뗌) · design/ref/<cls>-polish.png (공용 polish 손질: 14색·외톨이 점·외곽선·위 하이라이트)
#   → 정식 dev/pixel-qa/qa.py --kind char 검수 시트 qa/ref-<cls>-{clean,polish}/  (공용 메모: 손질이 점수를 늘 올리지 않는다 — 둘 다 검수해 높은 쪽)
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/ref_qa.py [직업 ...]
import os, sys, json, importlib.util
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
CM = os.path.join(ROOT, 'dev', 'sheets-common')
load = lambda n: (lambda sp: (sp.loader.exec_module(m := importlib.util.module_from_spec(sp)), m)[1])(importlib.util.spec_from_file_location(n, os.path.join(CM, n + '.py')))
POL = load('polish')
sys.path.insert(0, os.path.join(ROOT, 'dev', 'pixel-qa'))
import qa as Q          # 정식 검수 도구 (--kind char: 캐릭터는 원본 그대로가 게임 모습, 2026-10-17 main 27641bd)
REF = os.path.join(HERE, 'design', 'ref'); QA = os.path.join(HERE, 'qa'); os.makedirs(REF, exist_ok=True)
IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest']

def despeck_white(im):
    """바탕 떼기 잔여 흰 점 지우기 (검수 fix, 저격수): 밝고(밝기 > 170) 채도 낮은(최대-최소 < 40) 칸 중 4방향 이웃의 3칸 이상이 투명이거나 아주 어두운(외곽선) 칸이면 투명으로.
    두 번 돌린다 (2칸짜리 잔여물). 얼굴·셔츠처럼 밝은 면 안쪽은 이웃이 밝아 건드리지 않는다"""
    P = im.load(); W, H = im.size; L = lambda c: c[0] * .3 + c[1] * .59 + c[2] * .11
    for _ in range(2):
        kill = []
        for y in range(H):
            for x in range(W):
                c = P[x, y]
                if not c[3] or L(c) <= 170 or max(c[:3]) - min(c[:3]) >= 40: continue
                nb = [P[x + a, y + b] if 0 <= x + a < W and 0 <= y + b < H else (0, 0, 0, 0) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if sum(1 for n in nb if not n[3] or L(n) < 40) >= 3: kill.append((x, y))
        for p in kill: P[p] = (0, 0, 0, 0)
    return im


def lift_dark(im, k=0.3):
    """어두운 몸 밝히기 (검수 fix, 저격수 명암 2: 몸 전체가 어두운 덩어리): 외곽선(밝기 < 40 이고 바깥·투명에 닿은 칸)은 두고,
    나머지 칸의 HSV 명도를 v → v + (1 - v) * k (어두운 칸일수록 많이 오른다). 색상·채도는 그대로"""
    import colorsys
    P = im.load(); W, H = im.size; L = lambda c: c[0] * .3 + c[1] * .59 + c[2] * .11
    edge = lambda x, y: any(not (0 <= x + a < W and 0 <= y + b < H) or not P[x + a, y + b][3] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    ch = []
    for y in range(H):
        for x in range(W):
            c = P[x, y]
            if not c[3] or (L(c) < 40 and edge(x, y)): continue
            h, s_, v = colorsys.rgb_to_hsv(*(t / 255 for t in c[:3])); v = v + (1 - v) * k
            ch.append(((x, y), tuple(round(t * 255) for t in colorsys.hsv_to_rgb(h, s_, v)) + (255,)))
    for p_, c in ch: P[p_] = c
    return im


FIX = {'marksman': lambda im: lift_dark(despeck_white(im)), 'arbalest': despeck_white}     # 직업별 무료 수리 (검수 판정 fix)

if __name__ == '__main__':
    out = {}
    for c in (sys.argv[1:] or IDS):
        raw = Image.open(os.path.join(HERE, 'work', c, 'ref64-0.png'))
        clean = POL.unbg(raw); clean = clean.crop(clean.getbbox())
        if c in FIX: clean = FIX[c](clean); clean = clean.crop(clean.getbbox())
        clean.save(os.path.join(REF, f'{c}-clean.png'))
        pol = POL.polish(clean.copy()); pol.save(os.path.join(REF, f'{c}-polish.png'))
        for tag in ('clean', 'polish'):
            r, _ = Q.run(os.path.join(REF, f'{c}-{tag}.png'), f'ref-{c}-{tag}', frames=1, intent=c, out=os.path.join(QA, f'ref-{c}-{tag}'), kind='char')
            out[f'{c}-{tag}'] = {'size': Image.open(os.path.join(REF, f'{c}-{tag}.png')).size, 'flags': [f['k'] for f in r.get('flags', [])],
                                 'colors': r.get('metrics', {}).get('colors'), 'lrange': r.get('metrics', {}).get('lrange')}
    for k, v in out.items(): print(k, json.dumps(v))
