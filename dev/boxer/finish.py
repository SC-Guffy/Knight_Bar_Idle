# 7:3 v2 손 마무리: generate-with-style-v2 로 고른 그림 → 게임 규격.
#   1) 바탕 찌꺼기(반투명) 정리  2) 색 램프 정리 (stylize.prequant: 재질 계열마다 밝기 4단)
#   3) 바깥 외곽선 통일: 실루엣 가장자리의 어두운 칸(밝기 < 70)은 #0b0d14, 밝은 가장자리 바깥에는 1칸 덧댄다
#   4) 발 바닥 y=58, 발 가운데 x=32  5) 눈 찍기 (EYES 에 좌표가 있으면 — 뭉친 얼굴만 손으로)
#   python -I dev/boxer/finish.py  →  dev/boxer/v2fin-<직업>.png
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from stylize import prequant

OUT_C = (0x0b, 0x0d, 0x14, 255)
lum = lambda c: (c[0] * 3 + c[1] * 6 + c[2]) / 10
# 고른 변형 (v2/<직업>-s<seed>-<n>.png) — 검토 페이지 5절 "7:3 v2" 와 같다
# 모두 42×42 키 맞춤판 (k1). 2026-10-14 3차 키 맞춤 + 보강: 스트라이커 금속판 장갑(striker_g), 킥복서 무릎 든 자세(47)
# 이전 v2 (스트라이커 k1-0 · 킥복서 k1-16 · 3차 64판 s1) 는 v2a-*.png 로 남겨 비교한다
PICK = {'fighter': 'fighter-k1-0.png', 'striker': 'striker_g-k1-28.png', 'kickboxer': 'kickboxer-k1-47.png', 'qigong': 'qigong-k1-0.png',
        'champion': 'champion-k1-16.png', 'tempest': 'tempest-k1-45.png', 'grandmaster': 'grandmaster-k1-16.png'}
# 손으로 찍는 눈: {직업: [(x, y, '#rrggbb'), ...]} (마무리한 그림 좌표)
EYES = {}


def finish(src, tones=4):
    im = Image.open(src).convert('RGBA'); w, h = im.size; px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 128: px[x, y] = (0, 0, 0, 0)
            else: px[x, y] = px[x, y][:3] + (255,)
    im = prequant(im, n=28, tones=tones); px = im.load()
    edge = lambda x, y: any(not (0 <= x + dx < w and 0 <= y + dy < h) or px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    dark, lit = [], []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and edge(x, y): (dark if lum(px[x, y]) < 70 else lit).append((x, y))
    for x, y in dark: px[x, y] = OUT_C
    add = set()
    for x, y in lit:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0: add.add((x + dx, y + dy))
    for x, y in add: px[x, y] = OUT_C
    bb = im.getbbox()
    feet = [x for x in range(w) if px[x, bb[3] - 1][3]]
    fx = (feet[0] + feet[-1]) // 2 if feet else (bb[0] + bb[2]) // 2
    out = Image.new('RGBA', (64, 64)); out.paste(im, (32 - fx, 58 - (bb[3] - 1)))
    return out


if __name__ == '__main__':
    for cls, src in PICK.items():
        im = finish(os.path.join(HERE, 'v2', src))
        for x, y, c in EYES.get(cls, []):
            im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
        im.save(os.path.join(HERE, f'v2fin-{cls}.png'))
    print('ok', len(PICK))
