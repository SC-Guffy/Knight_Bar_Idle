# ⑤-3 레인저 계열 시안: ComfyUI(Z-Image + 픽셀 LoRA)로 후보를 여러 장 뽑아 한 장 비교판으로 만든다.
# 실행 (ComfyUI 가상환경 파이썬, 서버 127.0.0.1:8188):
#   C:\AI\ComfyUI\.venv\Scripts\python.exe dev/vfx3/draft.py <id> [장수=8] [seed0=1]
# 원본(1024px)은 저장소 밖 C:\AI\comfy-raw\vfx3, 비교판은 dev/vfx3/cand/<id>-grid.png
import sys, os, json
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'comfy'))
from comfy import gen
from prompts import DRAFT

RAW = r'C:\AI\comfy-raw\vfx3'
os.makedirs(RAW, exist_ok=True); os.makedirs(os.path.join(HERE, 'cand'), exist_ok=True)
STYLE = ('Pixel art style. 2D game VFX sprite: {}. Isolated on a pure flat black background, nothing else in the image, '
         'crisp hard pixels, limited palette, dark outline.')


def main(tid, n=8, seed0=1):
    desc, dots, res = DRAFT[tid]
    pos = STYLE.format(desc)
    out = []
    for s in range(seed0, seed0 + n, 4):
        ims, dt = gen('zimg', pos, '', seed=s, w=res[0], h=res[1], batch=min(4, seed0 + n - s))
        for i, im in enumerate(ims):
            im.save(os.path.join(RAW, f'{tid}-s{s + i}.png')); out.append((s + i, im))
        print(tid, s, f'{dt:.1f}s', flush=True)
    # 비교판: 원본 축소(가로 256) + 도트 크기로 줄였다 4배로 키운 것
    tw = 256; th = round(tw * res[1] / res[0])
    dw, dh = dots; z = max(1, min(6, 256 // max(dw, dh)))
    cell_w = tw + dw * z + 24; cell_h = max(th, dh * z) + 22
    cols = 2; rows = (len(out) + 1) // 2
    sheet = Image.new('RGB', (cols * cell_w, rows * cell_h), (30, 32, 40)); d = ImageDraw.Draw(sheet)
    for k, (s, im) in enumerate(out):
        x, y = (k % cols) * cell_w, (k // cols) * cell_h
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (x + 4, y + 18))
        sm = im.resize((dw, dh), Image.LANCZOS).resize((dw * z, dh * z), Image.NEAREST)
        sheet.paste(sm, (x + tw + 12, y + 18))
        d.text((x + 4, y + 3), f'{tid} s{s}', fill=(255, 230, 120))
    sheet.save(os.path.join(HERE, 'cand', f'{tid}-grid.png'))
    print('grid', os.path.join(HERE, 'cand', f'{tid}-grid.png'))


if __name__ == '__main__':
    a = sys.argv[1:]
    main(a[0], int(a[1]) if len(a) > 1 else 8, int(a[2]) if len(a) > 2 else 1)
