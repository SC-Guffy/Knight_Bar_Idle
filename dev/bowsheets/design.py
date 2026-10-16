# 레인저 계열 디자인 시안 (그림체 B 3등신 · 게임 안 키 46px, 2026-10-16 사용자 확정, PixelLab 0회)
#  검사 계열 dev/sheets-sword/design.py 의 B2 방식을 따른다: 지금 스프라이트(대기 자세)의 머리는 두고 목 아래만 세로 1.5배로 늘린 밑그림을
#  ComfyUI Z-Image + 픽셀 LoRA 로 denoise 0.82 다시 그린다 (글로만 "3등신" 이라 쓰면 모델이 무시) → 같은 shrink 로 키 46px.
#  모습은 디자인 브리프(dev/review/sheets-bow.html A-1)대로 바꿔도 된다 — 밑그림은 비율·자세만 잡는다.
#  실행 (ComfyUI 가상환경 파이썬, 서버 8188, 큐를 보고 한 번에 8장 이하):
#    C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/bowsheets/design.py gen <판 B|B3> [직업 ...]  → design/raw/<cls>-B-<seed>.png (1024, 저장소 밖으로 옮기지 않음 — .gitignore)
#    ... design.py shrink                                                                → design/px/<cls>-B-<seed>-h46.png
import os, sys, json, urllib.request
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'comfy')); sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-sword'))
D = os.path.join(HERE, 'design'); RAW = os.path.join(D, 'raw'); PXD = os.path.join(D, 'px')
CAP = os.path.join(HERE, 'cap')

STYLE = ('Pixel art style. One single full-body 2D game character sprite, side view, facing right, standing in a ready combat stance, '
         '{who} {body} Plain flat light gray background, nothing else. Crisp clean hard pixels, bold dark outline, limited palette, '
         'clear readable silhouette, light from the upper right.')
BODY_B = 'Stylized proportions about 3 heads tall, slightly bigger head than real, sturdy body, medium legs.'
# 디자인 브리프 A-1 (정체 색·실루엣·상징 소품)
WHO = {
    'ranger': 'A young forest ranger archer with auburn hair, a wide-brimmed green felt hat with one big white feather sticking out backward, '
              'a cream linen shirt under a brown leather vest, a quiver of arrows on the hip, brown boots, holding a short wooden recurve bow in the front hand.',
    'marksman': 'A cool sniper archer with black hair tied back, yellow-lens goggles pushed up on the forehead, a long dark green high-collared coat '
                'whose tails split in two behind the legs, a leather chest guard, a long red scarf whose tails flutter backward, '
                'holding a very tall dark wooden longbow, taller than the archer, upright in the front hand.',
    'arcaneArcher': 'A mystic arcane archer in a deep navy blue hood with a long pointed tip that bends backward, glowing cyan eyes in the shade of the hood, '
                    'a navy robe-like tunic with cyan rune trim, a short shoulder cape, two small glowing cyan rune shards floating beside the body, '
                    'holding a blue magic bow with a glowing cyan string.',
    'arbalest': 'A heavy crossbowman in a squared steel helmet with the visor raised showing a young face, a steel breastplate over a red tabard, a bandolier of bolts across the waist, '
                'a red cape, steel boots, holding a big medieval crossbow level at the waist with both hands: a wooden stock with wide curved steel bow arms crossing at the front end and a visible bowstring, not a gun.',
}
SEEDS = [11, 23, 37, 51]
SEEDS_F = [37, 61, 73, 89]   # B5f: 37 은 고른 구도 그대로 얼굴만, 나머지는 새 시드
STRETCH, DENOISE = 1.5, 0.82
# 재시안 B3 (2026-10-16 로드맵 검수: 레인저 노인·실사 비율, 저격수·마궁수 얼굴 작고 몸 김, 어두움, 뭉개짐) —
#  검사 계열 b46-four 처럼 머리 크게(3등신)·젊은 얼굴·밝게: 목 아래 늘림 1.3, denoise 0.72 (밑그림 비율을 더 따름), 프롬프트에 큰 머리·젊은 얼굴·밝은 색
VER = {'B': (1.5, 0.82, ''), 'B3': (1.3, 0.72, ' Big round head about one third of the total height, a young cheerful face with big eyes, bright saturated colors, clean flat shading.')}

# B4 (2026-10-16 사용자 "궁수는 몸이 왜 이렇게 통짜니"): 긴 코트·로브가 몸통~발 한 덩어리 → 허리 벨트로 상·하체 나눔, 무릎 위 짧은 상의 + 바지·부츠(두 다리 따로),
#  소매·팔뚝 보호대로 팔을 몸통과 분리, 망토·코트 자락은 뒤로 짧게, 날렵한 궁수 체형(넓은 어깨·가는 허리). 머리·밝기·얼굴은 B3 와 같다.
#  밑그림: 저격수·마궁수의 지금 그림은 망토가 몸을 덮어 → 다리가 따로 보이는 레인저 그림을 밑그림으로 쓴다 (INIT_FROM)
SPLIT = (' Athletic slim archer build with broad shoulders and a narrow waist. A belt clearly separates the upper and lower body, '
         'a short top that ends above the knees, fitted trousers and boots so both legs are clearly separate, '
         'sleeves and forearm bracers so the arms read apart from the torso, any cape or coat tails short and only behind the back.')
WHO4 = {
    'ranger': 'A young forest ranger archer with auburn hair, a wide-brimmed green felt hat with one big white feather sticking out backward, '
              'a cream shirt with rolled sleeves under a short brown leather vest, a belt with a quiver on the hip, brown trousers and boots, leather bracers, '
              'holding a short wooden recurve bow in the front hand.',
    'marksman': 'A young sniper archer with black hair tied back, yellow-lens goggles pushed up on the forehead, a short dark green high-collared jacket with '
                'two short coat tails behind, a leather chest guard and belt, dark trousers and tall boots, leather bracers, a long red scarf fluttering backward, '
                'holding a very tall dark wooden longbow upright in the front hand.',
    'arcaneArcher': 'A young arcane archer in a navy blue hood with a long pointed tip bending backward, glowing cyan eyes, a short navy tunic with cyan rune trim and a belt, '
                    'fitted navy trousers and boots, glowing cyan bracers, a short shoulder cape, two small cyan rune shards floating beside the body, '
                    'holding a blue magic bow with a glowing cyan string.',
    'arbalest': WHO['arbalest'],
}
INIT_FROM = {'marksman': 'ranger', 'arcaneArcher': 'ranger'}
VER['B4'] = (1.3, 0.76, VER['B3'][2] + SPLIT)

# B5 (2026-10-16 사용자 "기존 비주얼을 따라갈 필요 없이 컨셉에만 알맞게") — 밑그림 없이 txt2img. 컨셉(이름·역할·무기·정체 색·상징 소품)만 글로.
#  3등신·젊은 얼굴·밝기는 검사 B 시안과 맞추고, "통짜" 지적(허리·팔·다리 분리)·뭉개짐·노인/실사 비율 금지를 문장에 넣는다
BODY_B5 = ('Cute chibi game proportions exactly 3 heads tall: a big round head, a young face with big eyes, a compact torso, short but clearly separate legs. '
           'Bright saturated colors, clean flat cel shading with 3 tones per material.')
WHO5 = {
    'ranger': 'A young forest ranger archer: wide-brimmed green felt hat with one big white feather sticking out backward, auburn hair, '
              'cream shirt with rolled sleeves, short brown leather vest, belt with a quiver of arrows on the hip, brown trousers and boots, leather bracers, '
              'a short wooden recurve bow held in the front hand.',
    'marksman': 'A young sniper archer: black hair tied back, yellow-lens goggles on the forehead, short dark green high-collared jacket with two short tails behind, '
                'leather chest guard and belt, dark trousers and tall boots, leather bracers, a long red scarf fluttering backward, '
                'a very tall dark wooden longbow held upright in the front hand.',
    'arcaneArcher': 'A young arcane archer: navy blue hood with a long pointed tip bending backward, glowing cyan eyes, short navy tunic with cyan rune trim and a belt, '
                    'fitted navy trousers and boots, glowing cyan bracers, short shoulder cape, two small cyan rune shards floating beside the body, '
                    'a blue magic bow with a glowing cyan string held in the front hand.',
    'arbalest': 'A young heavy crossbowman: squared steel helmet with the visor raised, steel breastplate over a red tabard, belt with a bandolier of bolts, '
                'red short cape, steel greaves and boots, holding a big medieval crossbow level at the waist with both hands: '
                'wooden stock with wide curved steel bow arms crossing at the front and a visible bowstring, not a gun.',
}
VER['B5'] = (None, 1.0, BODY_B5 + SPLIT)

# B5f (2026-10-17 사용자 승인 뒤 수정): 석궁사수 B5-37 은 얼굴이 회색·붉은 눈이라 해골처럼 보인다 → 얼굴만 다시: 면갑 올린 투구 아래 밝은 피부의 젊은 사람 얼굴
WHO5F = dict(WHO5, arbalest=WHO5['arbalest'].replace('squared steel helmet with the visor raised,',
             'squared steel helmet with the visor fully raised so a young human face with light peach skin, rosy cheeks and friendly dark eyes is clearly visible (no red glowing eyes, not a skull, not a mask),'))
VER['B5f'] = VER['B5']


def init_stretch(cls, STRETCH=STRETCH):
    """지금 대기 그림(1배, 96칸, 땅 = 아래 끝)에서 목(땅-19) 아래만 STRETCH 배로 늘린 밑그림 (연회색 바탕 1024)"""
    im = Image.open(os.path.join(CAP, f'c-{cls}-full.png')).convert('RGBA')
    bb = im.getbbox(); im = im.crop(bb)
    neck = (bb[3] - 1 - 19) - bb[1]
    head, body = im.crop((0, 0, im.width, neck)), im.crop((0, neck, im.width, im.height))
    body = body.resize((body.width, round(body.height * STRETCH)), Image.NEAREST)
    st = Image.new('RGBA', (im.width, head.height + body.height)); st.alpha_composite(head); st.alpha_composite(body, (0, head.height))
    s = 900 / max(st.size); st = st.resize((round(st.width * s), round(st.height * s)), Image.NEAREST)
    bg = Image.new('RGBA', (1024, 1024), (200, 200, 204, 255)); bg.alpha_composite(st, ((1024 - st.width) // 2, (1024 - st.height) // 2))
    return bg.convert('RGB')


def queue_len():
    try:
        q = json.loads(urllib.request.urlopen('http://127.0.0.1:8188/queue', timeout=10).read())
        return len(q.get('queue_running', [])) + len(q.get('queue_pending', []))
    except Exception:
        return -1


def gen(classes, ver='B'):
    from comfy import gen as G
    os.makedirs(RAW, exist_ok=True)
    st, dn, extra = VER[ver]
    for cls in classes:
        init = None if st is None else init_stretch(INIT_FROM.get(cls, cls) if ver == 'B4' else cls, st)
        if init is not None: init.save(os.path.join(D, f'init-{cls}-{ver}.png'))
        who = {'B4': WHO4, 'B5': WHO5, 'B5f': WHO5F}.get(ver, WHO)[cls]
        for s in (SEEDS_F if ver == 'B5f' else SEEDS):
            out = os.path.join(RAW, f'{cls}-{ver}-{s}.png')
            if os.path.exists(out): continue
            body = extra if ver in ('B5', 'B5f') else BODY_B + extra
            ims, dt = (G('zimg', STYLE.format(who=who, body=body), seed=s) if init is None else
                       G('zimg', STYLE.format(who=who, body=body), seed=s, denoise=dn, init=init))
            ims[0].save(out); print(cls, s, f'{dt:.1f}s', 'queue', queue_len(), flush=True)


def shrink2(im, H=46, ncol=14, line_frac=0.3, cov=0.45, top=None, foot=None):
    """뭉개짐 줄인 축소 (로드맵 검수): 밝기·채도 조금 올림 → 칸마다 덮인 비율 cov 이상만 → 칸 안 어두운 선(밝기 < 60) 비율이 line_frac 이상이면 외곽선 →
    아니면 칸 안 최빈색(비슷한 색 묶음) → 팔레트 ncol 색 → 바깥 1칸 외곽선"""
    import numpy as np
    from PIL import ImageEnhance
    from design import fg, OUT_C
    im = ImageEnhance.Color(ImageEnhance.Brightness(im.convert('RGB')).enhance(1.12)).enhance(1.15)
    if foot is not None:     # 발밑 그림자·바닥: 발바닥 아래를 바탕색으로 (공용 dev/sheets-common/shrink.py shrink_body 와 같은 처리)
        arr = np.asarray(im).copy(); border = np.concatenate([arr[0], arr[-1], arr[:, 0], arr[:, -1]]); arr[foot + 1:] = np.median(border, axis=0); im = Image.fromarray(arr)
    a, m = fg(im)
    ys, xs = np.nonzero(m)
    if len(xs) == 0: return None
    # 발밑 그림자 타원(밝은 회·하늘빛, 채도 낮음)을 지운다: 그림 아래 15% 안의 밝고(밝기 > 140) 채도 낮은(최대-최소 < 40) 칸
    yb0, yb1 = np.percentile(ys, [0.3, 99.9]); cut = int(yb1 - (yb1 - yb0) * 0.15)
    Lm = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11; sat = a.max(-1) - a.min(-1)
    sh = (Lm > 140) & (sat < 40); sh[:cut] = False; m = m & ~sh
    ys, xs = np.nonzero(m)
    y0, y1 = np.percentile(ys, [0.3, 99.9]); x0, x1 = np.percentile(xs, [0.3, 99.7])
    y0, y1, x0, x1 = int(y0), int(y1) + 1, int(x0), int(x1) + 1
    # 몸 키 기준 (top·foot = 1024 원본의 머리 몸체 꼭대기·발바닥 y, 깃털·뿔·무기 제외): 그 높이가 H 칸이 되게 칸 크기를 정한다 — 긴 활을 세워 든 직업도 몸 키가 같다
    if top == 'auto':        # 몸 꼭대기 자동: 줄마다 불투명 폭 → 몸통 폭(가운데 줄들 중앙값)의 35% 이상인 첫 줄 = 머리 꼭대기 (가는 활대·깃털 줄은 걸러짐)
        wid = m[y0:y1].sum(1); med = np.median(wid[int(len(wid) * 0.35):int(len(wid) * 0.75)])
        top = y0 + int(np.argmax(wid >= 0.35 * med)); foot = y1 - 1
    cell = (foot - top) / H if top is not None and foot is not None else (y1 - y0) / H
    H = int(np.ceil((y1 - y0) / cell)); W = int(np.ceil((x1 - x0) / cell))
    L = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11; S_ = a.max(-1) - a.min(-1)
    q = (a // 20).astype(np.int32)
    out = np.zeros((H, W, 4), np.uint8); line = np.zeros((H, W), bool)
    for j in range(H):
        for i in range(W):
            ya, yb = int(y0 + j * cell), int(y0 + (j + 1) * cell); xa, xb = int(x0 + i * cell), int(x0 + (i + 1) * cell)
            mm = m[ya:yb, xa:xb]
            if mm.size == 0 or mm.mean() < cov: continue
            ink = (L[ya:yb, xa:xb][mm] < 38) & (S_[ya:yb, xa:xb][mm] < 30)          # 외곽선 = 아주 어둡고 채도 낮은 잉크색 (남색·짙은 초록 옷은 빼고)
            if ink.mean() >= line_frac: line[j, i] = True; out[j, i] = OUT_C + (255,); continue
            cs = a[ya:yb, xa:xb][mm]; key = q[ya:yb, xa:xb][mm]; kk = key[:, 0] * 10000 + key[:, 1] * 100 + key[:, 2]
            vals, cnt = np.unique(kk, return_counts=True); out[j, i, :3] = cs[kk == vals[cnt.argmax()]].mean(0); out[j, i, 3] = 255
    img = Image.fromarray(out, 'RGBA')
    rgb = img.convert('RGB').quantize(colors=ncol, method=Image.Quantize.MEDIANCUT).convert('RGBA'); rgb.putalpha(img.split()[3])
    P = rgb.load()
    for j in range(H):
        for i in range(W):
            if line[j, i]: P[i, j] = OUT_C + (255,)
    o = Image.new('RGBA', (W + 2, H + 2)); o.alpha_composite(rgb, (1, 1)); P = o.load()
    add = [(x, y) for y in range(H + 2) for x in range(W + 2) if not P[x, y][3] and any(0 <= x + dx < W + 2 and 0 <= y + dy < H + 2 and P[x + dx, y + dy][3] and P[x + dx, y + dy][:3] != OUT_C for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for p in add: P[p] = OUT_C + (255,)
    return o


def shrink_all(H=46, ver=None):
    from design import shrink          # 검사 계열 shrink (바탕 떼기 → 칸 최빈 → 20색 → 외곽선) — B 판. B3 판부터 shrink2
    os.makedirs(PXD, exist_ok=True)
    for f in sorted(os.listdir(RAW)):
        if not f.endswith('.png') or (ver and f'-{ver}-' not in f): continue
        im = Image.open(os.path.join(RAW, f))
        o = shrink2(im, H, top='auto') if ('-B5-' in f or '-B5f-' in f) else shrink2(im, H) if ('-B3-' in f or '-B4-' in f) else shrink(im, H)
        if o is not None: o.save(os.path.join(PXD, f[:-4] + f'-h{H}.png'))
    print('shrunk', len(os.listdir(PXD)))


if __name__ == '__main__':
    if sys.argv[1] == 'gen': gen([c for c in sys.argv[3:]] or list(WHO), sys.argv[2])       # gen <판 B|B3> [직업 ...]
    elif sys.argv[1] == 'shrink': shrink_all(ver=sys.argv[2] if len(sys.argv) > 2 else None)
    elif sys.argv[1] == 'queue': print(queue_len())
