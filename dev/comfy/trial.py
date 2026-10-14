# ComfyUI 시험 생성: 후보 뽑기 → 후처리 → 비교용 시트
# 실행 (ComfyUI 가상환경 파이썬, 서버가 8188 에 떠 있어야 함):
#   C:\AI\ComfyUI\.venv\Scripts\python.exe dev/comfy/trial.py cands w1b sdxl 8
#   ... trial.py anim h1 zimg <seed>      (기준 그림 고정 img2img 로 프레임 만들기)
#   ... trial.py sheet h1 zimg 4          (한 장에 프레임 여러 개 — 비교용)
# 원본(1024px)은 저장소 밖 C:\AI\comfy-raw 에 둔다. 결과는 dev/comfy/out/.
import sys, os, json, math, time
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
sys.path.insert(0, os.path.dirname(__file__))
from comfy import gen
from post import post, sheet, fg_mask, bbox, union, clean_bg, split_sheet

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
RAW = r'C:\AI\comfy-raw'
os.makedirs(OUT, exist_ok=True); os.makedirs(RAW, exist_ok=True)

STYLE = {
    'sdxl': ('pixel art, 2d game vfx sprite, {}, isolated on pure black background, flat colors, clean pixels, limited palette',
             '3d render, realistic, photo, blurry, gradient background, pattern background, rain, character, person, sword, weapon, '
             'hilt, handle, knife, text, watermark, frame, border'),
    'zimg': ('Pixel art style. 2D game VFX sprite: {}. Isolated on a pure flat black background, nothing else in the image, '
             'crisp hard pixels, limited palette of white and pale icy blue.', ''),
}
# 텍스처 = (설명, 도트 크기, 생성 해상도)
TEX = {
    'w1b': ('a single white crescent moon shaped energy slash arc effect, curving like a C opening to the right, thick bright white outer edge, '
            'pale icy blue inner body, tapering to sharp thin pointed tips at top and bottom, centered', (32, 32), (1024, 1024)),
    'h1': ('a small melee hit impact flash, one four-pointed white star burst with long thin sharp rays, a few tiny square sparkles around it, '
           'pale icy blue glow, centered', (32, 32), (1024, 1024)),
    'c1': ('one big crescent moon shaped energy slash wave opening to the right, thick bright white edge, pale steel blue body '
           'tapering to thin pointed tips at top and bottom, several straight horizontal speed lines trailing behind it on the left', (64, 32), (1344, 768)),
    'w1': ('a swing smear trail effect, a wide curved arc sweeping from top to bottom on the right side like a quarter moon, '
           'thick white leading edge on the outside, body fading into pale steel blue, tail breaking into small fragments', (32, 32), (1024, 1024)),
}
LOG = os.path.join(OUT, 'log.jsonl')


def log(**k):
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(json.dumps(k, ensure_ascii=False) + '\n')


def prompt(model, desc):
    p, n = STYLE[model]
    return p.format(desc), n


def cands(tex, model, n, seed0=1):
    desc, size, (W, H) = TEX[tex]
    pos, neg = prompt(model, desc)
    res = []
    B = 4  # 한 번에 4장 (모델·LoRA 준비 시간을 나눠 낸다)
    for s in range(seed0, seed0 + n, B):
        ims, dt = gen(model, pos, neg, seed=s, w=W, h=H, batch=min(B, seed0 + n - s))
        for i, im in enumerate(ims):
            name = f'{tex}-{model}-s{s + i}'
            im.save(os.path.join(RAW, name + '.png'))
            im.resize((W // 4, H // 4), Image.LANCZOS).save(os.path.join(OUT, 'thumb', name + '.jpg'), quality=85)
            px, _, _ = post(im, size)
            px.save(os.path.join(OUT, 'cand', name + '.png'))
            res.append(name)
        log(kind='cand', tex=tex, model=model, seed=s, n=len(ims), sec=round(dt, 2), per=round(dt / len(ims), 2), w=W, h=H)
        print(tex, model, s, len(ims), f'{dt:.1f}s', f'{dt / len(ims):.1f}s/장', flush=True)
    return res


# ---- 기준 그림 고정 프레임: 키 그림을 코드로 살짝 바꾼 뒤 img2img 로 다시 그리게 한다 ----
def _scale(im, k, bright=1.0):
    W, H = im.size
    s = im.resize((max(1, int(W * k)), max(1, int(H * k))), Image.LANCZOS)
    c = Image.new('RGB', (W, H)); c.paste(s, ((W - s.size[0]) // 2, (H - s.size[1]) // 2))
    return ImageEnhance.Brightness(c).enhance(bright) if bright != 1 else c


def _shatter(im, push, keep, seed, dim=1.0):
    """중심에서 바깥으로 조각을 밀어내고 일부만 남긴다 (흩어짐)."""
    rng = np.random.default_rng(seed)
    a = np.asarray(im).astype(np.float32) * dim
    H, W = a.shape[:2]; cy, cx = H / 2, W / 2
    out = np.zeros_like(a); B = W // 16
    for y in range(0, H, B):
        for x in range(0, W, B):
            blk = a[y:y + B, x:x + B]
            if blk.max() < 30 or rng.random() > keep:
                continue
            dx, dy = x + B / 2 - cx, y + B / 2 - cy
            r = math.hypot(dx, dy) + 1e-3
            nx, ny = int(x + dx / r * push * r / (W / 2)), int(y + dy / r * push * r / (W / 2))
            if 0 <= nx < W - B and 0 <= ny < H - B:
                out[ny:ny + B, nx:nx + B] = np.maximum(out[ny:ny + B, nx:nx + B], blk)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def _reveal(im, a0, a1, fade_from=None):
    """호의 원 중심 기준 각도 a0~a1(도, 위=-90, 오른쪽=0) 부분만 보이게. 휘두르기 궤적이 자라는 모습.
    ')' 모양 호의 원 중심은 상자 왼쪽 끝 근처라서 (x0 + 0.1w, 세로 가운데) 로 잡는다."""
    a = np.asarray(im).astype(np.float32)
    H, W = a.shape[:2]
    x0, y0, x1, y1 = bbox(fg_mask(im)[1])
    cx, cy = x0 + 0.1 * (x1 - x0), (y0 + y1) / 2
    yy, xx = np.mgrid[0:H, 0:W]
    ang = np.degrees(np.arctan2(yy - cy, xx - cx))
    m = ((ang >= a0) & (ang <= a1)).astype(np.float32)
    if fade_from is not None:  # 꼬리 쪽을 어둡게
        m *= np.clip((ang - fade_from) / max(1, a1 - fade_from), 0.15, 1)
    return Image.fromarray((a * m[..., None]).clip(0, 255).astype(np.uint8))


def init_frames(tex, key, seed):
    if tex == 'h1':  # 별 섬광 → 커짐 → 깨짐 → 흩어짐 (PixelLab H1 과 같은 흐름)
        return [_scale(key, 0.7), _scale(key, 1.0, 1.15), _shatter(_scale(key, 1.1), 40, 0.85, seed),
                _shatter(_scale(key, 1.15), 140, 0.55, seed + 1, 0.8), _shatter(_scale(key, 1.2), 260, 0.3, seed + 2, 0.6)]
    if tex == 'w1':  # 위에서 아래로 자라는 호 → 꼬리 흩어짐
        return [_reveal(key, -120, -40), _reveal(key, -120, 30, -120), _reveal(key, -120, 120, -60),
                _shatter(_reveal(key, -30, 130), 60, 0.7, seed), _shatter(_reveal(key, 20, 130), 140, 0.35, seed + 1, 0.7)]
    if tex == 'c1':
        return [_scale(key, 0.85, 1.2), _scale(key, 1.0), _shatter(key, 30, 0.8, seed), _shatter(key, 90, 0.5, seed + 1, 0.8),
                _shatter(key, 180, 0.25, seed + 2, 0.6)]
    raise ValueError(tex)


# 프레임별 밝기 상한 (마지막 두 프레임은 사라지는 중이라 흰 단을 뺀다)
CAP = [4, 4, 4, 3, 2]
# 한 장 시트용 프레임 설명
SHEET = {
    'h1': ('frame 1 a small star spark, frame 2 the biggest and brightest star burst, frame 3 the rays start breaking apart, '
           'frame 4 broken rays scattering into small sparks, frame 5 only a few tiny fading sparks'),
    'w1': ('a sword swing smear arc on the right side curving like a closing parenthesis, frame 1 a thin bright sliver at the top, '
           'frame 2 the arc grows downward, frame 3 the full crescent arc with thick white leading edge, '
           'frame 4 the tail end breaks into small fragments, frame 5 only small fading fragments at the bottom'),
    'c1': ('frame 1 the crescent wave flashes bright white with speed lines, frame 2 it stretches forward, '
           'frame 3 the crescent thins, frame 4 it breaks into small glittering sparks, frame 5 a few fading sparks'),
}


def anim(tex, model, key_seed, denoise=0.45, fseed=7):
    desc, size, (W, H) = TEX[tex]
    pos, neg = prompt(model, desc)
    if tex == 'w1':  # 휘두르기 궤적은 W1b 초승달을 기준 그림으로 쓴다 (PixelLab 시험과 같은 방식). 좌우 반전 → ')' 모양
        key = Image.open(os.path.join(RAW, f'w1b-{model}-s{key_seed}.png')).convert('RGB').transpose(Image.FLIP_LEFT_RIGHT)
    else:
        key = Image.open(os.path.join(RAW, f'{tex}-{model}-s{key_seed}.png')).convert('RGB')
    key = clean_bg(key)
    inits = init_frames(tex, key, fseed)
    frames, times = [], []
    for i, ini in enumerate(inits):
        if i == 1 and tex == 'h1':
            im, dt = key, 0  # 가장 큰 프레임은 키 그림 그대로
        else:
            (im,), dt = gen(model, pos, neg, seed=fseed, w=W, h=H, init=ini, denoise=denoise)
        im.save(os.path.join(RAW, f'{tex}-{model}-anim{key_seed}-{i}.png'))
        ini.save(os.path.join(RAW, f'{tex}-{model}-anim{key_seed}-{i}-init.png'))
        frames.append(im); times.append(dt)
    # 프레임끼리 같은 자르기 상자·밝기 배율 → 크기·위치가 일정
    box = union([bbox(fg_mask(f)[1]) for f in frames])
    out = [post(f, size, box, cap=c)[0] for f, c in zip(frames, CAP)]
    name = f'{tex}-{model}-anim{key_seed}-d{int(denoise * 100)}'
    sheet(out).save(os.path.join(OUT, 'anim', name + '.png'))
    log(kind='anim', tex=tex, model=model, key=key_seed, denoise=denoise, sec=[round(t, 2) for t in times])
    print(name, [f'{t:.1f}' for t in times])


def sheetgen(tex, model, n, seed0=100):
    """한 장에 5프레임을 그리게 한다 (PixelLab 에서 실패한 방식). 빈 열로 프레임을 나눈다."""
    desc, size, _ = TEX[tex]
    d = (f'a horizontal sprite sheet strip of exactly 5 animation frames from left to right, evenly spaced with empty black gaps '
         f'between frames, all frames the same size and centered on the same line: {SHEET[tex]}. Subject: {desc}')
    pos, neg = prompt(model, d)
    hh = 448 if size[0] == size[1] else 320
    for s in range(seed0, seed0 + n):
        (im,), dt = gen(model, pos, neg, seed=s, w=1792 if model == 'zimg' else 1536, h=hh if model == 'zimg' else 384)
        name = f'{tex}-{model}-sheet-s{s}'
        im.save(os.path.join(RAW, name + '.png'))
        frames, ok = split_sheet(im, 5)
        box = union([bbox(fg_mask(f)[1]) for f in frames])
        sheet([post(f, size, box, cap=c)[0] for f, c in zip(frames, CAP)]).save(os.path.join(OUT, 'anim', name + '.png'))
        print(' split', 'gaps' if ok else 'equal')
        im.resize((im.size[0] // 4, im.size[1] // 4), Image.LANCZOS).save(os.path.join(OUT, 'thumb', name + '.jpg'), quality=85)
        log(kind='sheet', tex=tex, model=model, seed=s, sec=round(dt, 2))
        print(name, f'{dt:.1f}s')


if __name__ == '__main__':
    for d in ('cand', 'anim', 'thumb'):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    cmd, tex, model = sys.argv[1:4]
    if cmd == 'cands':
        cands(tex, model, int(sys.argv[4]), int(sys.argv[5]) if len(sys.argv) > 5 else 1)
    elif cmd == 'anim':
        anim(tex, model, int(sys.argv[4]), float(sys.argv[5]) if len(sys.argv) > 5 else 0.45)
    elif cmd == 'sheet':
        sheetgen(tex, model, int(sys.argv[4]))
