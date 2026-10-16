# 창기사 계열 새 디자인 시안 (스펙: 그림체 B 3등신 · 게임 안 키 1.3배 ≈ 46px, 2026-10-16 사용자 확정). PixelLab 0회.
#  검사 세션 dev/sheets-sword/design.py 방식: 지금 그림의 머리는 두고 목 아래만 세로 1.5배 늘린 밑그림 → ComfyUI Z-Image + 픽셀 LoRA,
#  denoise 0.82 로 다시 그림 (글로만 등신을 쓰면 모델이 무시) → 1024 → 키 46px 도트 (줄이기는 검사 세션 shrink 그대로).
#  밑그림: 용기병·창기사는 확정된 실루엣 장식(날개꼴 망토·비늘 견갑 / 깃발)을 입힌 그림(dress.py out/dress/*-guard-new.png),
#          할버디어·랜서는 지금 게임 그림(capture.js spearParts shots/p-<직업>-guard-full.png).
#  실행 (ComfyUI 가상환경 파이썬, 서버 127.0.0.1:8188, 큐 보고 번갈아):
#    C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/spear/design.py gen [직업 ...]   → design/raw/<직업>-<시드>.png
#    ... design.py shrink                                                            → design/px/<직업>-<시드>-h46.png
import os, sys, importlib.util
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'comfy')); sys.path.insert(0, HERE)
_sp = importlib.util.spec_from_file_location('sw_design', os.path.join(HERE, '..', 'sheets-sword', 'design.py'))
SW = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(SW)          # STYLE · shrink (검사 세션과 같은 그림체)
D = os.path.join(HERE, 'design'); RAW = os.path.join(D, 'raw'); PX = os.path.join(D, 'px')
H = 46
STRETCH, DENOISE = 1.5, 0.82                     # 검사 세션 B2 와 같음
BODY = 'Stylized proportions about 3 heads tall, slightly bigger head than real, sturdy body, medium legs.'     # SW.DIRS['B']
SEEDS = [11, 23, 37, 51]

# 디자인 브리프 (검토 sheets-spear.html 0-1절)
WHO = {
    'lancer': 'A young spearman squire knight in a green quilted vest over chainmail with brass buckles, a wide-brimmed iron kettle hat, '
              'leather boots, holding a long wooden spear with a green swallowtail pennant tied just below the steel spearhead.',
    'dragoon': 'A dragon knight in deep purple plate armor, a dragon-head helmet with a long snout visor and two horns curving back, '
               'glowing golden eyes, layered dragon-scale pauldron on the shoulder, a bat-wing shaped cape spreading behind the back, '
               'holding a long purple dragon spear with a winged spearhead.',
    'halberdier': 'A heavy halberdier guard in steel plate armor with an orange surcoat with diagonal stripes, a plain bucket helmet with one '
                  'horizontal eye slit, very wide square shoulder plates, a stocky broad body, holding a big halberd with a large axe blade, '
                  'a back hook and a spike on top.',
    'cavalier': 'A cavalry lancer knight in a royal blue surcoat over silver armor, a crested helmet with a tall red feather plume, '
                'a long kite shield with a red emblem on the left arm, holding a thick cone-shaped jousting lance with a round hand guard.',
}
INIT = {'lancer': ('dress', 'lancer-guard-new.png'), 'dragoon': ('dress', 'dragoon-guard-new.png'),
        'halberdier': ('shot', 'p-halberdier-guard-full.png'), 'cavalier': ('shot', 'p-cavalier-guard-full.png'),
        # 랜서 2차: 지금 그림의 돌격창이 칼처럼 생겨(굵은 흰 날) 모델이 랜스를 못 그림 → 덧그린 원뿔 랜스·방패를 입힌 그림을 밑그림으로
        'cavalier2': ('dress', 'cavalier-guard-d0.png')}
WHO['cavalier2'] = WHO['cavalier']


def ref(cls):
    kind, f = INIT[cls]
    p = os.path.join(HERE, 'out', 'dress', f) if kind == 'dress' else os.path.join(HERE, 'shots', f)
    im = Image.open(p).convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]; px[x, y] = c[:3] + (255,) if c[3] >= 160 else (0, 0, 0, 0)
    return im


def init_stretch(cls, f=STRETCH):
    """머리는 두고 목(땅 − 19칸) 아래만 세로 f 배 → 1024 연회색 바탕 (검사 세션 init_stretch 와 같은 규칙)"""
    im = ref(cls); bb = im.getbbox(); im = im.crop(bb)
    neck = (bb[3] - 1 - 19) - bb[1]
    head, body = im.crop((0, 0, im.width, neck)), im.crop((0, neck, im.width, im.height))
    body = body.resize((body.width, round(body.height * f)), Image.NEAREST)
    st = Image.new('RGBA', (im.width, head.height + body.height)); st.alpha_composite(head); st.alpha_composite(body, (0, head.height))
    s = 900 / max(st.size); st = st.resize((round(st.width * s), round(st.height * s)), Image.NEAREST)
    bg = Image.new('RGBA', (1024, 1024), (200, 200, 204, 255)); bg.alpha_composite(st, ((1024 - st.width) // 2, (1024 - st.height) // 2))
    return bg.convert('RGB')


def weapon_mask(cls, im):
    """밑그림(1배)의 무기 칸: 지금 게임 무기 색(무기 색만 바꿔 찍은 캡처와 다른 칸의 색)인 칸"""
    base = cls.rstrip('0123456789')
    a = Image.open(os.path.join(HERE, 'shots', f'p-{base}-guard-noacc.png')).convert('RGBA'); b = Image.open(os.path.join(HERE, 'shots', f'p-{base}-guard-wcol.png')).convert('RGBA')
    A, B = a.load(), b.load()
    cols = {A[x, y][:3] for y in range(a.height) for x in range(a.width) if A[x, y][3] >= 160 and A[x, y] != B[x, y]} - {(0x0b, 0x0d, 0x14)}
    P = im.load()
    return {(x, y) for y in range(im.height) for x in range(im.width) if P[x, y][3] and P[x, y][:3] in cols}


def body_height(cls):
    """지금 게임 그림의 몸 키(투구 꼭대기 ~ 발, 1배) — 검사 세션 부위 가르기(parts)의 투구 칸 꼭대기. 무기 색 섞임(빛번짐)과 상관없다"""
    import dress as DR
    base = cls.rstrip('0123456789'); arch = DR.ARCH[base]
    full = DR.cap('p-' + base, 'guard', 'noacc', arch); wpn = DR.wpn_of('p-' + base, 'guard', arch)
    CP = DR.parts(full, DR.body_of(full, wpn), wpn)
    top = min(y for (x, y), k in CP.items() if k == 'helm'); g = full.getbbox()[3] - 1
    return top - 1, g                     # 투구 외곽선 1칸 포함


def body_cell(cls):
    """1024 시안에서 도트 한 칸 크기: 무기를 뺀 몸 키(투구 꼭대기 ~ 발)가 46칸이 되게. 밑그림 배치(머리 그대로·목 아래 ×1.5·900 맞춤)로 계산"""
    im = ref(cls); bb = im.getbbox()
    top_c, g_c = body_height(cls); bh = g_c - top_c + 1           # 몸 키 (밑그림과 같은 1배 — 입힌 그림도 머리는 직업 그림 그대로)
    g = bb[3] - 1; neck = g - 19
    st_h = (neck - bb[1]) + round((bb[3] - neck) * STRETCH)
    s = 900 / max(st_h, bb[2] - bb[0])
    body_h = ((bh - 20) + 20 * STRETCH) * s                       # 목(땅 − 19) 위는 그대로, 아래 20칸은 ×1.5
    return body_h / H


def shrink_body(im, cls):
    """검사 세션 shrink 를 몸 키 기준 칸 크기로 (무기가 높거나 길어도 몸은 46칸)"""
    import numpy as np
    a, m = SW.fg(im); ys, xs = np.nonzero(m)
    if len(ys) == 0: return None
    y0, y1 = np.percentile(ys, [0.3, 99.9])
    return SW.shrink(im, max(8, round((int(y1) + 1 - int(y0)) / body_cell(cls))))


def gen(classes):
    from comfy import gen as G
    os.makedirs(RAW, exist_ok=True)
    for cls in classes:
        init = init_stretch(cls); init.save(os.path.join(RAW, f'_init-{cls}.png'))
        for s in SEEDS:
            out = os.path.join(RAW, f'{cls}-{s}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', SW.STYLE.format(who=WHO[cls], body=BODY), seed=s, denoise=DENOISE, init=init)
            ims[0].save(out); print(cls, s, f'{dt:.1f}s', flush=True)


# 대표 시안: 원본(1024)에서 눈으로 읽은 투구 몸체 꼭대기 · 발바닥 (깃털·뿔 장식 제외). 모델이 밑그림보다 인물을 키우거나 줄여 그려서
#  밑그림 기하(body_cell)로는 키가 들쭉날쭉했다 → 대표는 이 값으로 몸 키를 정확히 46칸에 맞춘다
PICK = {'lancer': ('lancer-23', 204, 843), 'dragoon': ('dragoon-11', 312, 750), 'halberdier': ('halberdier-51', 337, 951), 'cavalier': ('cavalier2-23', 250, 941)}


def shrink_pick(cls):
    import numpy as np
    name, top, foot = PICK[cls]
    im = Image.open(os.path.join(RAW, name + '.png')).convert('RGB'); a = np.asarray(im).copy()
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]); a[foot + 1:] = np.median(border, axis=0)     # 발밑 그림자 지우기
    im = Image.fromarray(a)
    _, m = SW.fg(im); ys, _x = np.nonzero(m); y0, y1 = np.percentile(ys, [0.3, 99.9])
    o = SW.shrink(im, max(8, round((int(y1) + 1 - int(y0)) / ((foot - top) / H))))
    # 발밑에 남은 바닥 줄: 맨 아래 줄이 위 줄보다 1.4배 넘게 넓으면 지운다 (두 번까지)
    P = o.load(); W_, H_ = o.size
    for _ in range(2):
        bb = o.getbbox(); yb = bb[3] - 1
        w = lambda y: [x for x in range(W_) if P[x, y][3]]
        a_, b_ = w(yb), w(yb - 1)
        if a_ and b_ and (max(a_) - min(a_)) > 1.4 * (max(b_) - min(b_)):
            for x in range(W_): P[x, yb] = (0, 0, 0, 0)
    return o.crop(o.getbbox())


def shrink_all():
    os.makedirs(PX, exist_ok=True)
    for f in sorted(os.listdir(RAW)):
        if not f.endswith('.png') or f.startswith('_'): continue
        o = shrink_body(Image.open(os.path.join(RAW, f)), f.rsplit('-', 1)[0])
        if o is not None: o.save(os.path.join(PX, f[:-4] + f'-h{H}.png'))
    print('shrunk', len(os.listdir(PX)))


if __name__ == '__main__':
    if sys.argv[1] == 'gen': gen(sys.argv[2:] or list(WHO))
    elif sys.argv[1] == 'shrink': shrink_all()
    elif sys.argv[1] == 'pick':
        os.makedirs(PX, exist_ok=True)
        for c in PICK: shrink_pick(c).save(os.path.join(PX, f'pick-{c}-h{H}.png'))
        print('pick', list(PICK))
