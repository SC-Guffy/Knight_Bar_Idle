# 디자인 시안(ComfyUI 1024) → PixelLab image-to-pixelart 정리 (계열 공용, docs/specs/legacy-class-sheets.md "디자인 새로 그리기")
#  뭉개짐 원인: ComfyUI 픽셀 LoRA 그림은 1024 에서 도트 한 칸이 6~7px(키 약 120칸)라 46칸으로 바로 줄이면 디테일이 섞인다.
#  → 캐릭터를 256 정사각에 키 184px(=64 출력에서 46칸)로 앉혀 PixelLab 이 64칸으로 다시 그리게 한다(fixer=원본 충실).
#  값: 응답 usage 1.0/회 (검사 계열 2026-10-16, 256→64). 호출은 각 계열의 PixelLab 래퍼(plx.py raw)로 — 상한·사용량 기록은 계열마다.
#  쓰는 법:
#    python -I -B dev/sheets-common/to_pixel.py prep <원본1024.png> <req.json> [--h 184] [--out 64] [--seed 7]
#    MSYS_NO_PATHCONV=1 python -I <계열>/plx.py raw <cls> <이름> /image-to-pixelart <req.json>     (Git Bash 는 경로 변환을 꺼야 한다)
#    python -I -B dev/sheets-common/to_pixel.py clean <결과64.png> <정리본.png>                    → 바탕(테두리 색)·떨어진 잡점 떼고 바짝 자름
#    이어서 polish.py (손질) → qa_char.py + 비평(dev/pixel-qa/critic.md) 으로 검수
import os, sys, json, base64, io, argparse
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))


def fg_box(im, thr=40):
    """테두리 중앙값을 바탕으로 보고 그와 먼 칸의 상자 (numpy 없이)"""
    rgb = im.convert('RGB'); W, H = rgb.size; P = rgb.load()
    border = [P[x, 0] for x in range(W)] + [P[x, H - 1] for x in range(W)] + [P[0, y] for y in range(H)] + [P[W - 1, y] for y in range(H)]
    bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
    xs, ys = [], []
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            c = P[x, y]
            if abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2]) > thr: xs.append(x); ys.append(y)
    xs.sort(); ys.sort(); k = lambda v, q: v[min(len(v) - 1, int(len(v) * q))]
    return (k(xs, 0.003), k(ys, 0.003), k(xs, 0.997) + 2, k(ys, 0.999) + 2), bg


def prep(src, req, h=184, out=64, seed=7, strength=200):
    im = Image.open(src).convert('RGB'); box, bg = fg_box(im)
    ch = im.crop(box); s = h / ch.height; ch = ch.resize((max(1, round(ch.width * s)), h), Image.LANCZOS)
    if ch.width > 248: ch = ch.resize((248, round(ch.height * 248 / ch.width)), Image.LANCZOS)
    sq = Image.new('RGB', (256, 256), bg); sq.paste(ch, ((256 - ch.width) // 2, 256 - 12 - ch.height))
    sq.save(os.path.splitext(req)[0] + '-in.png')
    buf = io.BytesIO(); sq.save(buf, 'PNG')
    body = {'image': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'},
            'image_size': {'width': 256, 'height': 256}, 'output_size': {'width': out, 'height': out}, 'fixer': True,
            'init_image_strength': strength, 'seed': seed}
    json.dump(body, open(req, 'w'))
    return req


def clean(src, dst, thr=22):
    sys.path.insert(0, HERE)
    from polish import unbg
    c = unbg(Image.open(src), thr); c = c.crop(c.getbbox()); c.save(dst); return dst


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('a'); ap.add_argument('b')
    ap.add_argument('--h', type=int, default=184); ap.add_argument('--out', type=int, default=64); ap.add_argument('--seed', type=int, default=7)
    a = ap.parse_args()
    print(prep(a.a, a.b, a.h, a.out, a.seed) if a.cmd == 'prep' else clean(a.a, a.b))
