# 마법사 계열 디자인 시안 (스펙 "기준 그림 = 새로 다시 그린 직업 디자인", 그림체 B 3등신 · 게임 안 키 46px — 2026-10-16 사용자 확정, PixelLab 0회)
#  검사 세션 dev/sheets-sword/design.py 방식 그대로: 지금 스프라이트의 머리는 두고 목 아래만 세로로 1.5배 늘린 밑그림을
#  ComfyUI Z-Image + 픽셀 LoRA 로 denoise 0.82 다시 그린다(글로만 "3등신" 이라 쓰면 모델이 무시함) → 1024px 를 키 46px 로 줄임(shrink 는 그 파일 것).
#  옷은 브리프대로 소매(팔뚝)·다리가 보이게 (통 로브는 관절 애니에서 팔·다리가 죽었다 — 검토 페이지 0절 몸 움직임 검사).
#  뇌전술사는 확정된 시안 B 머리(뻗친 금발 + 남색 관 + V 자 번개 뿔, mannequin.electro_head)를 밑그림 머리로 쓴다.
#  실행 (ComfyUI 가상환경 파이썬, 서버 8188 — GPU 를 네 세션이 같이 쓰니 한 장씩 차례로):
#    C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/sheets-mage/design.py gen [직업 ...]  → design/raw/<cls>-<seed>.png
#    ... design.py shrink → design/px/<cls>-<seed>-h46.png (검사 세션 축소)
#    ... design.py shrink2 [색 수] → design/px2/ (뭉개짐 줄인 축소: 원본을 먼저 색 번호로, 칸마다 최빈 번호, 외곽선 칸 보존, 외톨이 점 정리)
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'comfy'))
D = os.path.join(HERE, 'design'); RAW = os.path.join(D, 'raw'); PXD = os.path.join(D, 'px')

STYLE = ('Pixel art style. One single full-body 2D game character sprite, side view, facing right, standing in a ready combat stance, '
         '{who} Stylized proportions about 3 heads tall, slightly bigger head than real, sturdy body, medium legs, both arms and both legs clearly visible. '
         'Plain flat light gray background, nothing else. Crisp clean hard pixels, bold dark outline, limited palette, '
         'clear readable silhouette, light from the upper right.')
WHO = {
    'mage': 'A young apprentice wizard with a big wide-brimmed blue pointed hat whose tip bends backward, short brown hair, '
            'a knee-length blue tunic robe with a leather belt and a small pouch and a scroll, wide sleeves showing the forearms, '
            'brown trousers and leather boots, holding a short wooden staff with a small sky-blue orb in the right hand.',
    'pyromancer': 'A fire mage with tall upswept flame-shaped orange hair in a high ponytail and a red headband, a sleeveless red vest showing bare muscular arms '
                  'with red bracers, a fiery orange sash flowing behind the waist, wide baggy dark red trousers and sandals, '
                  'holding a long dark wooden staff topped with a flame-shaped golden fork and a fire orb in the right hand.',
    'cryomancer': 'An ice mage in a deep round pale blue hood with a fluffy white fur collar, a short shoulder cape that leaves the arms visible, '
                  'long white gloves, ice crystal ornaments on the shoulders, slim navy trousers and white fur boots, '
                  'holding a long pale blue staff topped with an ice crystal fork in the right hand.',
    'electromancer': 'A storm mage with spiky swept-back blonde hair, a navy circlet with two tall light blue lightning-bolt horns spreading in a V shape, '
                     'a short navy coat with gold buttons and two split coat tails, sleeves rolled up showing the forearms, fingerless gloves, '
                     'navy trousers and boots, holding a long dark staff with a zigzag forked head and a violet crystal orb in the right hand.',
}
SEEDS = [11, 23, 37, 51]
# 2차 재시안 (로드맵 검수: 마법사 로브 무릎 위 · 빙결술사 얼굴 보이게) — 이름 <cls>2, 시드 따로
WHO['mage2'] = ('A young apprentice wizard with a big wide-brimmed blue pointed hat whose tip bends backward, short brown hair, a clearly visible face, '
                'a SHORT blue tunic that ends ABOVE THE KNEES with a leather belt, a small pouch and a scroll, wide sleeves showing the forearms, '
                'brown trousers and tall leather boots clearly visible below the tunic, holding a short wooden staff with a small sky-blue orb in the right hand.')
WHO['cryomancer2'] = ('An ice mage wearing a round pale blue hood pushed back so the FACE IS CLEARLY VISIBLE with eyes, nose and pale skin, white hair under the hood, '
                      'a fluffy white fur collar, a short shoulder cape that leaves the arms visible, long white gloves, ice crystal ornaments on the shoulders, '
                      'slim navy trousers and white fur boots, holding a long pale blue staff topped with an ice crystal fork in the right hand.')
SEEDS2 = [61, 73, 89, 97]
# 여성 마법사 시안 (2026-10-16 사용자 "조금만 더 여성스럽게") — 이름 <cls>_f. 부드러운 얼굴선·큰 눈, 머리 모양으로 실루엣 구분 유지,
#  가는 허리 + 무릎 위 치마형 짧은 로브 + 부츠(다리 보이게, 동작 위해). "조금만" — 과한 노출·과장 없이 3등신 그림체 그대로
FEM = 'a young woman mage with a soft rounded face and big expressive eyes, a slim waist, '
WHO['mage_f'] = (FEM + 'long brown hair flowing out from under a big wide-brimmed blue pointed hat whose tip bends backward, '
                 'a short blue skirted robe ending above the knees with a leather belt, a small pouch and a scroll, wide sleeves showing the forearms, '
                 'dark tights and brown leather boots clearly visible, holding a short wooden staff with a small sky-blue orb in the right hand.')
WHO['pyromancer_f'] = (FEM + 'very long fiery orange hair in a high ponytail flowing far behind her like flames, a red headband, '
                       'a sleeveless red top showing her arms with red bracers, an orange sash flowing behind the waist, a short dark red skirt above the knees '
                       'over fitted trousers and sandals, holding a long dark wooden staff topped with a flame-shaped golden fork and a fire orb in the right hand.')
WHO['cryomancer_f'] = (FEM + 'a round pale blue hood pushed back so her face is clearly visible, a long white braid falling over her shoulder, '
                       'a fluffy white fur collar, a short shoulder cape that leaves the arms visible, long white gloves, ice crystal ornaments on the shoulders, '
                       'a short pale blue skirted robe above the knees and white fur boots, holding a long pale blue staff topped with an ice crystal fork in the right hand.')
WHO['electromancer_f'] = (FEM + 'spiky swept-back blonde hair, a navy circlet with two tall light blue lightning-bolt horns spreading in a V shape, '
                          'a short fitted navy coat dress with gold buttons ending above the knees with two split coat tails, sleeves rolled up, fingerless gloves, '
                          'navy tights and boots, holding a long dark staff with a zigzag forked head and a violet crystal orb in the right hand.')
STRETCH, DENOISE = 1.5, 0.82


def ref_img(cls):
    """지금 게임 그림 (96칸, 발 44·88). 뇌전술사는 시안 B 머리"""
    cls = cls.split('_')[0].rstrip('2')
    if cls == 'electromancer':
        import mannequin
        im = mannequin.electro_head()
    else:
        im = Image.open(os.path.join(HERE, 'ref', f'{cls}.png'))
    return im.convert('RGBA')


def init_stretch(cls, f=STRETCH):
    im = ref_img(cls)
    bb = im.getbbox(); ground = bb[3] - 1; im = im.crop(bb)
    neck = (ground - 19) - bb[1]                      # 목 = 땅 - 19 (검사 세션 parts.bands 와 같은 띠)
    head, body = im.crop((0, 0, im.width, neck)), im.crop((0, neck, im.width, im.height))
    body = body.resize((body.width, round(body.height * f)), Image.NEAREST)
    st = Image.new('RGBA', (im.width, head.height + body.height)); st.alpha_composite(head); st.alpha_composite(body, (0, head.height))
    s = 900 / max(st.size); st = st.resize((round(st.width * s), round(st.height * s)), Image.NEAREST)
    bg = Image.new('RGBA', (1024, 1024), (200, 200, 204, 255)); bg.alpha_composite(st, ((1024 - st.width) // 2, (1024 - st.height) // 2))
    return bg.convert('RGB')


def gen(classes):
    from comfy import gen as G
    os.makedirs(RAW, exist_ok=True)
    for cls in classes:
        init = init_stretch(cls); init.save(os.path.join(RAW, f'_init-{cls}.png'))
        for s in (SEEDS2 if cls.endswith(('2', '_f')) else SEEDS):
            out = os.path.join(RAW, f'{cls}-{s}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', STYLE.format(who=WHO[cls]), seed=s, denoise=DENOISE, init=init)
            ims[0].save(out); print(cls, s, f'{dt:.1f}s', flush=True)


def shrink2(im, H, ncol=14, line_frac=0.45):          # 기본값: 12·14·16색 × 0.30·0.45·0.55 비교에서 14색·0.45 가 가장 깔끔
    """뭉개짐 줄인 축소 (로드맵 검수 "명암 덩어리·얼굴 흐림"): 칸 안 색을 평균하지 않는다.
    1) 1024 원본의 몸 칸만 먼저 ncol 색으로 줄인다(색 번호) — 같은 재질은 같은 색 번호라 축소 뒤 색이 들쭉날쭉하지 않다
    2) 칸마다: 아주 어두운(외곽선) 칸이 line_frac 이상이면 외곽선 #0b0d14 — 1~2px 선(눈·옷 경계)이 살아남는다. 아니면 최빈 색 번호
    3) 외톨이 점(상하좌우 네 이웃과 모두 다른 칸) 지우기 → 바깥 외곽선 1칸"""
    import numpy as np
    sys.path.insert(0, os.path.join(HERE, '..', 'sheets-sword'))
    import importlib.util
    sp = importlib.util.spec_from_file_location('sword_design', os.path.join(HERE, '..', 'sheets-sword', 'design.py'))
    sd = importlib.util.module_from_spec(sp); sp.loader.exec_module(sd)
    a, m = sd.fg(im)
    ys, xs = np.nonzero(m)
    if len(xs) == 0: return None
    y0, y1 = np.percentile(ys, [0.3, 99.9]); x0, x1 = np.percentile(xs, [0.3, 99.7])
    y0, y1, x0, x1 = int(y0), int(y1) + 1, int(x0), int(x1) + 1
    lum = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11
    dark = m & (lum < 45)
    # 1) 몸 칸 색 줄이기 (어두운 선 칸 제외)
    body = m & ~dark
    pix = a[body].astype(np.uint8)
    q = Image.fromarray(pix.reshape(-1, 1, 3), 'RGB').quantize(colors=ncol, method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:ncol * 3], np.uint8).reshape(-1, 3)
    idx = np.full(m.shape, -1, np.int32); idx[body] = np.asarray(q).reshape(-1)
    cell = (y1 - y0) / H; W = int(np.ceil((x1 - x0) / cell))
    out = np.zeros((H, W, 4), np.uint8)
    for j in range(H):
        for i in range(W):
            ya, yb = int(y0 + j * cell), int(y0 + (j + 1) * cell); xa, xb = int(x0 + i * cell), int(x0 + (i + 1) * cell)
            mm = m[ya:yb, xa:xb]
            if mm.size == 0 or mm.mean() < 0.5: continue
            if dark[ya:yb, xa:xb].sum() >= line_frac * mm.size:
                out[j, i] = (*sd.OUT_C, 255); continue
            ii = idx[ya:yb, xa:xb]; ii = ii[ii >= 0]
            if ii.size == 0: out[j, i] = (*sd.OUT_C, 255); continue
            out[j, i, :3] = pal[np.bincount(ii).argmax()]; out[j, i, 3] = 255
    # 3) 외톨이 점: 네 이웃(칠한 칸) 중 같은 색이 하나도 없고 이웃이 셋 이상이면 이웃 최빈색으로
    o = out.copy()
    for j in range(H):
        for i in range(W):
            if not out[j, i, 3]: continue
            nb = [tuple(out[j + b, i + a2]) for a2, b in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= i + a2 < W and 0 <= j + b < H and out[j + b, i + a2, 3]]
            if len(nb) >= 3 and tuple(out[j, i]) not in nb:
                o[j, i] = max(set(nb), key=nb.count)
    img = Image.fromarray(o, 'RGBA')
    # 바깥 외곽선 1칸
    P = img.load(); Wd, Hd = img.size
    res = Image.new('RGBA', (Wd + 2, Hd + 2)); res.alpha_composite(img, (1, 1)); R = res.load()
    for y in range(Hd + 2):
        for x in range(Wd + 2):
            if not R[x, y][3] and any(0 <= x + dx < Wd + 2 and 0 <= y + dy < Hd + 2 and R[x + dx, y + dy][3] and R[x + dx, y + dy][:3] != sd.OUT_C
                                      for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                R[x, y] = sd.OUT_C + (255,)
    return res


def shrink2_all(H=46, ncol=14):
    out = os.path.join(D, 'px2'); os.makedirs(out, exist_ok=True)
    for f in sorted(os.listdir(RAW)):
        if not f.endswith('.png') or f.startswith('_'): continue
        o = shrink2(Image.open(os.path.join(RAW, f)), H, ncol)
        if o is not None: o.save(os.path.join(out, f[:-4] + f'-h{H}.png'))
    print('shrunk2', len(os.listdir(out)))


def shrink_all(H=46):
    sys.path.insert(0, os.path.join(HERE, '..', 'sheets-sword'))
    import importlib.util
    sp = importlib.util.spec_from_file_location('sword_design', os.path.join(HERE, '..', 'sheets-sword', 'design.py'))
    sd = importlib.util.module_from_spec(sp); sp.loader.exec_module(sd)
    os.makedirs(PXD, exist_ok=True)
    for f in sorted(os.listdir(RAW)):
        if not f.endswith('.png') or f.startswith('_'): continue
        o = sd.shrink(Image.open(os.path.join(RAW, f)), H)
        if o is not None: o.save(os.path.join(PXD, f[:-4] + f'-h{H}.png'))
    print('shrunk', len(os.listdir(PXD)))


if __name__ == '__main__':
    if sys.argv[1] == 'gen': gen(sys.argv[2:] or list(WHO))
    elif sys.argv[1] == 'shrink': shrink_all()
    elif sys.argv[1] == 'shrink2': shrink2_all(ncol=int(sys.argv[2]) if len(sys.argv) > 2 else 14)
