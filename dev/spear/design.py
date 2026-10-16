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


# ── 재시안 v3 (2026-10-16 사용자 검수: "창기사 잡졸 같다 / 용기병 장수풍뎅이 같다 / 할버디어 배불뚝이 / 랜서 창이 가늘다") ──
#  시드 11·23 = 목 아래 늘린 밑그림(밑그림 3: 용기병은 장수풍뎅이처럼 보인 입힌 그림 대신 지금 게임 그림), 37·51 = 검사 세션 B 시안 원본
#  (swordsman-B2-11, 그림체 기준)을 밑그림으로 직업만 바꿔 그림 — 계열이 달라도 비율·밝기가 같게. 모두 denoise 0.88
WHO3 = {
    'lancer': 'A young lancer knight warrior with a proud upright heroic stance, a steel breastplate and round steel shoulder pauldrons '
              'over a green tunic, an open-faced steel sallet helmet with a short green plume, a short dark green cape, steel gauntlets '
              'and greaves, holding a long steel-tipped spear upright-forward with a small green swallowtail pennant just below the spearhead.',
    'dragoon': 'A dragon knight warrior standing upright with a straight back, wearing a helmet shaped like a dragon skull with a long '
               'pointed snout, sharp white fangs and two long horns sweeping straight backward, glowing bright yellow eyes, purple scale-mail '
               'armor with bright lavender highlights on every scale and a pale cream armored belly, a tattered bat-wing cape with clawed '
               'membranes spreading behind the shoulders, a thin whip-like dragon tail, holding a long dragon spear with a serrated '
               'fang-shaped spearhead. Looks like a dragon, not an insect.',
    'halberdier': 'A heavy halberdier warrior with an inverted triangle body: very broad shoulders with large square steel pauldrons, '
                  'a broad chest, a narrow waist cinched by a thick leather belt, thick armored arms, slim legs, an orange surcoat with '
                  'diagonal stripes, a bucket helmet with one horizontal eye slit, holding a big halberd with a large axe blade, a back '
                  'hook and a top spike.',
    'cavalier': 'A cavalry lancer knight in a royal blue surcoat over silver plate armor, a crested helmet with a tall red feather plume, '
                'a kite shield with a red emblem on the left arm, holding a very thick cone-shaped steel jousting lance as thick as the arm, '
                'with a large round vamplate hand guard, the lance clearly visible and pointing forward.',
}
INIT3 = {'lancer': ('shot', 'p-lancer-guard-full.png'), 'dragoon': ('shot', 'p-dragoon-guard-full.png'),
         'halberdier': ('shot', 'p-halberdier-guard-full.png'), 'cavalier': ('dress', 'cavalier-guard-d0.png')}


def gen3(classes):
    from comfy import gen as G
    base = Image.open(os.path.join(RAW, '_base-swordsman-B2-11.png')).convert('RGB')
    for cls in classes:
        INIT[cls + '3'] = INIT3[cls]
        init = init_stretch(cls + '3'); init.save(os.path.join(RAW, f'_init-{cls}3.png'))
        for s in SEEDS:
            out = os.path.join(RAW, f'{cls}3-{s}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', SW.STYLE.format(who=WHO3[cls], body=BODY), seed=s, denoise=0.88, init=init if s in (11, 23) else base)
            ims[0].save(out); print(cls, 'v3', s, f'{dt:.1f}s', flush=True)


# ── 시안 v4 (2026-10-16 사용자: "기존 비주얼을 따라갈 필요 없이 컨셉에만 알맞게 새로") ──
#  지금 스프라이트 밑그림 img2img 는 그만둔다. 3등신 비율 가이드(회색 머리 원·몸통·다리 덩어리, 옆모습)만 깔고 denoise 0.92 로
#  컨셉 프롬프트대로 새로 그린다 (가이드: 굵은 도트 마네킹, denoise 0.85) (글로만 쓰면 5~6등신이 나온다 — 검사 세션 1차 시도). 가이드의 정수리·발 높이로 몸 키 46칸에 줄인다.
GUIDE = dict(top=170, foot=870)          # 가이드 정수리·발바닥 y (1024) → 몸 키 700, 머리 233 (3등신)
WHO4 = {
    'lancer': 'A young lancer knight warrior, proud upright heroic stance, chest out, a polished steel breastplate and round steel '
              'shoulder pauldrons over a forest green tunic, an open-faced steel sallet helmet with a short green plume, a short dark '
              'green cape, steel gauntlets and greaves, holding a long steel-tipped spear angled forward with a small green swallowtail '
              'pennant just below the spearhead. A disciplined soldier, not a peasant.',
    'dragoon': 'A dragon knight warrior standing upright with a straight back, wearing a helmet shaped like a dragon skull with a long '
               'pointed snout, sharp white fangs and two long horns sweeping straight backward, glowing bright yellow eyes, deep purple '
               'scale-mail armor with bright lavender highlights on every scale and a pale cream armored belly plate, a tattered bat-wing '
               'cape with clawed membranes spreading behind the shoulders, a thin whip-like dragon tail, holding a long dragon spear with '
               'a serrated fang-shaped spearhead. Clearly a dragon, not an insect or beetle, no round shell on the back.',
    'halberdier': 'A heavy halberdier warrior with an inverted triangle body: very broad shoulders with large square steel pauldrons, '
                  'a broad chest, a narrow waist cinched by a thick leather belt, thick armored arms, strong legs, an orange surcoat with '
                  'diagonal stripes, a bucket helmet with one horizontal eye slit, holding a big halberd with a large axe blade, a back '
                  'hook and a top spike. Muscular and armored, not fat, no belly.',
    'cavalier': 'A cavalry lancer knight in a royal blue surcoat over silver plate armor, a crested helmet with a tall red feather plume, '
                'a kite shield with a red emblem on the left arm, holding a very thick cone-shaped steel jousting lance as thick as the arm '
                'with a large round vamplate hand guard, the long lance clearly visible pointing forward.',
}


def guide():
    """3등신 옆모습 비율 가이드 (1024): 16px 굵은 도트로 그린 민무늬 마네킹 — 검은 외곽선·위 밝고 아래 어두운 명암.
    흐린 회색 덩어리(첫 시도)는 denoise 0.92 에서 무시돼 5~6등신 일러스트가 나왔다. 도트 그림처럼 보이는 가이드라야 비율·그림체를 따른다"""
    B = 16; Wc = 1024 // B
    t, f = GUIDE['top'] // B, GUIDE['foot'] // B; hh = (f - t) / 3; cx = 470 // B
    cells = {}
    def box(x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)): cells[(x, y)] = c
    skin, dark, mid, lite = (150, 150, 160), (95, 96, 108), (130, 131, 142), (175, 176, 186)
    for y in range(t, int(t + hh)):                                   # 머리 (원)
        for x in range(int(cx - hh * 0.6), int(cx + hh * 0.6) + 1):
            if ((x - cx) / (hh * 0.55)) ** 2 + ((y - t - hh / 2) / (hh / 2)) ** 2 <= 1: cells[(x, y)] = lite if y < t + hh * 0.45 else skin
    box(cx - hh * 0.5, t + hh * 0.95, cx + hh * 0.5, t + hh * 1.5, lite)          # 가슴
    box(cx - hh * 0.5, t + hh * 1.5, cx + hh * 0.5, t + hh * 2.0, mid)            # 배·허리
    box(cx - hh * 0.42, t + hh * 2.0, cx - hh * 0.05, f, dark)                     # 뒷다리
    box(cx + hh * 0.05, t + hh * 2.0, cx + hh * 0.42, f, mid)                      # 앞다리
    box(cx + hh * 0.3, t + hh * 1.05, cx + hh * 0.72, t + hh * 1.75, skin)         # 앞팔
    im = Image.new('RGB', (Wc, Wc), (200, 200, 204)); P = im.load()
    for (x, y), c in cells.items(): P[x, y] = c
    for (x, y) in list(cells):                                                     # 외곽선
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in cells and 0 <= q[0] < Wc and 0 <= q[1] < Wc: P[q] = (20, 22, 30)
    return im.resize((1024, 1024), Image.NEAREST)


def gen4(classes, seeds=SEEDS):
    from comfy import gen as G
    gd = guide(); gd.save(os.path.join(RAW, '_guide4.png'))
    for cls in classes:
        for s in seeds:
            out = os.path.join(RAW, f'{cls}4-{s}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', SW.STYLE.format(who=WHO4[cls], body=BODY), seed=s, denoise=0.85, init=gd)
            ims[0].save(out); print(cls, 'v4', s, f'{dt:.1f}s', flush=True)


def shrink4(name):
    sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
    from shrink import shrink_body, body_bounds
    im = Image.open(os.path.join(RAW, name + '.png'))
    top, foot = body_bounds(im) or (GUIDE['top'], GUIDE['foot'])      # 모델이 가이드보다 크거나 작게 그려도 실제 몸 높이로
    return shrink_body(im, top, foot, H)


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
    """대표 시안 → 몸 키 46칸 (공용 dev/sheets-common/shrink.py shrink_body)"""
    sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
    from shrink import shrink_body
    name, top, foot = PICK[cls]
    return shrink_body(Image.open(os.path.join(RAW, name + '.png')), top, foot, H)


# 용기병 명암 대비 (로드맵 검수 2026-10-16: 보라 한 톤 덩어리라 어두운 배경에 묻힘) — 고른 시안(dragoon-11)을 밑그림으로 낮은 denoise 로
#  밝은 비늘 하이라이트 · 배 쪽 밝은 판 · 투구 눈 빛을 더한다. 디자인(실루엣)은 그대로 둔다
CONTRAST = ('A dragon knight in deep purple plate armor with strong contrast: bright lavender and pale violet highlights on every scale edge, '
            'a light cream-colored armored belly and chest plates, glowing bright yellow eyes in the dragon-head helmet with a long snout visor '
            'and two horns curving back, layered dragon-scale pauldron with bright rim light, a bat-wing shaped cape with lighter violet membrane '
            'and dark ribs, holding a long purple dragon spear with a bright violet winged spearhead.')


def gen_contrast():
    from comfy import gen as G
    init = Image.open(os.path.join(RAW, 'dragoon-11.png')).convert('RGB')
    for dn in (0.5, 0.62):
        for sd in (11, 23, 37, 51):
            out = os.path.join(RAW, f'dragoonC{int(dn * 100)}-{sd}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', SW.STYLE.format(who=CONTRAST, body=BODY), seed=sd, denoise=dn, init=init)
            ims[0].save(out); print('contrast', dn, sd, f'{dt:.1f}s', flush=True)


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
    elif sys.argv[1] == 'contrast': gen_contrast()
    elif sys.argv[1] == 'gen3': gen3(sys.argv[2:] or list(WHO3))
    elif sys.argv[1] == 'gen4': gen4(sys.argv[2:] or list(WHO4))
    elif sys.argv[1] == 'shrink4':
        os.makedirs(PX, exist_ok=True)
        for f in sorted(os.listdir(RAW)):
            if f.endswith('.png') and '4-' in f and not f.startswith('_'):
                o = shrink4(f[:-4]); o.save(os.path.join(PX, f[:-4] + f'-h{H}.png')); print(f[:-4], o.size)
    elif sys.argv[1] == 'pick':
        os.makedirs(PX, exist_ok=True)
        for c in PICK: shrink_pick(c).save(os.path.join(PX, f'pick-{c}-h{H}.png'))
        print('pick', list(PICK))
