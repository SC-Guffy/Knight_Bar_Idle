# image-to-pixelart 입력판 (256×256): ComfyUI 원본 1024 → 바탕·발밑 그림자 떼기 → 몸 키(머리 꼭대기~발바닥, 활·깃털 제외)를 184칸(= 출력 64칸에서 46칸)으로 →
#  연회색 바탕(200,200,204) 가운데, 발바닥 y = 224 (출력 56). 전체가 판을 넘으면 넘지 않게 줄인다 (그때는 몸 키가 46 보다 작아진다 — 출력에 적는다)
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/bowsheets/board.py <raw 이름 ...>   (예: ranger-B5-23)  → design/board/<이름>.png
import os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-sword'))
from design import fg
RAW = os.path.join(HERE, 'design', 'raw'); OUT = os.path.join(HERE, 'design', 'board'); os.makedirs(OUT, exist_ok=True)
BG = (200, 200, 204)


def board(name, flip=False):
    im = Image.open(os.path.join(RAW, name + '.png')).convert('RGB')
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)     # 왼쪽을 보는 시안 → 오른쪽 (검수 판정 fix: 좌우 반전)
    a, m = fg(im)
    ys, xs = np.nonzero(m); yb0, yb1 = np.percentile(ys, [0.3, 99.9]); cut = int(yb1 - (yb1 - yb0) * 0.15)
    L = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11; sat = a.max(-1) - a.min(-1)
    sh = (L > 140) & (sat < 40); sh[:cut] = False; m = m & ~sh
    ys, xs = np.nonzero(m); y0, y1 = int(np.percentile(ys, 0.3)), int(np.percentile(ys, 99.9)) + 1; x0, x1 = int(np.percentile(xs, 0.3)), int(np.percentile(xs, 99.7)) + 1
    wid = m[y0:y1].sum(1); med = np.median(wid[int(len(wid) * 0.35):int(len(wid) * 0.75)])
    top = y0 + int(np.argmax(wid >= 0.35 * med)); foot = y1 - 1
    k = 184 / (foot - top)
    k = min(k, 248 / (x1 - x0), (224 - 4) / (foot - y0))          # 판을 넘지 않게
    rgba = np.dstack([a.astype(np.uint8), (m * 255).astype(np.uint8)])
    cut_im = Image.fromarray(rgba, 'RGBA').crop((x0, y0, x1, y1))
    cut_im = cut_im.resize((max(1, round(cut_im.width * k)), max(1, round(cut_im.height * k))), Image.LANCZOS)
    A = np.asarray(cut_im)[..., 3]; cut_im.putalpha(Image.fromarray(((A > 127) * 255).astype(np.uint8)))
    b = Image.new('RGBA', (256, 256), BG + (255,))
    b.alpha_composite(cut_im, (128 - cut_im.width // 2, 224 - cut_im.height))
    b.convert('RGB').save(os.path.join(OUT, name + ('-flip' if flip else '') + '.png'))
    return round((foot - top) * k / 4, 1)


if __name__ == '__main__':
    for n in sys.argv[1:]: print(n, 'body px at 64:', board(n.replace(':flip', ''), n.endswith(':flip')))      # 이름:flip 이면 좌우 반전
