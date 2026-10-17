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


# ── v2: 컨셉만 보고 새로 그리기 (2026-10-16 사용자 "기존 비주얼을 따라갈 필요없이 새롭게, 컨셉에만 알맞게" + "조금 더 여성스럽게") ──
#  지금 스프라이트 밑그림을 쓰지 않는다. 두 가지를 같이 뽑아 비교한다:
#   t = 순수 txt2img · s = 3등신 막대 인형(skel.py to_b 기준 자세)으로 만든 중립 회색 실루엣을 아주 약하게(denoise 0.9) 깐 판
#   (검사 세션 기록: 글로만 "3등신" 이면 모델이 5~6등신 실사로 그린다 — 실루엣은 비율만 잡고 모습은 정하지 않는다)
STYLE2 = ('Pixel art style. One single full-body 2D game character sprite of a cute young woman mage, side view in profile, facing right, standing in a ready pose, '
          '{who} Chibi-like stylized proportions exactly 3 heads tall: big head, short body, legs visible. Soft rounded face with big eyes, not exaggerated. '
          'Short skirted robe above the knees and boots so both legs are clearly visible, sleeves that show the forearms. '
          'Plain flat light gray background, nothing else, no text, no ground shadow. Crisp clean hard pixels, bold dark outline, limited palette of about 14 colors, '
          'large clean flat color areas, clear readable silhouette, light from the upper right.')
WHO2 = {
    'mage': 'Apprentice wizard: a big wide-brimmed blue pointed hat whose tip bends backward, long wavy brown hair, a blue tunic dress with a leather belt and a small pouch, '
            'holding a short wooden staff with a small sky-blue orb.',
    'pyromancer': 'Fire mage: very long fiery orange hair in a high ponytail streaming far behind her like flames, a red headband, a sleeveless red and gold top with bracers, '
                  'an orange sash flowing behind, a short dark red skirt, sandals, holding a long dark staff topped with a golden flame-shaped fork and a fire orb.',
    'cryomancer': 'Ice mage: a round pale blue hood pushed back so her face is clearly visible, a long white braid over the shoulder, a fluffy white fur collar, '
                  'a short shoulder cape, long white gloves, ice crystal ornaments, a short pale blue skirt, white fur boots, holding a long pale blue staff topped with an ice crystal fork.',
    'electromancer': 'Storm mage: spiky swept-back blonde hair, a navy circlet with two tall light blue lightning-bolt horns spreading in a V shape, '
                     'a short fitted navy coat dress with gold buttons and two split coat tails, fingerless gloves, navy tights and boots, '
                     'holding a long dark staff with a zigzag forked head and a violet crystal orb.',
}
SEEDS_T, SEEDS_S = [101, 113], [127, 139]
# v3 (비평 1차 결과 반영, 2026-10-17): 순흑 옷이 명암 없이 뭉침·얼굴 안 보임·흰 림라이트 1도트 잡점·바닥 그림자가 공통 지적.
#  모든 v3 에 공통 문구를 더하고, 직업별로 지적된 곳을 고친다. 시드 113 은 그림에 액자를 넣어 빼고 새 시드
STYLE3_ADD = (' Mid-tone colors with clear 3-step shading on every cloth area, no pure black areas except the thin outline. '
              'A clearly readable face with skin tone and two large dark eyes. No white rim light, no sparkles, no stray dots, no ground shadow, no base plate, no frame.')
WHO3 = {
    'pyromancer': 'Fire mage: very long fiery orange hair in a high ponytail streaming behind her, a red headband, a sleeveless crimson top with gold trim and bracers, '
                  'an orange sash, a short dark red skirt that is clearly darker and redder than the hair, sandals, '
                  'holding a long solid unbroken dark wooden staff topped with a golden flame-shaped fork.',
    'cryomancer': 'Ice mage: her pale blue hood is PULLED BACK onto her shoulders, a long white braid hanging over the front of her shoulder, a fluffy white fur collar, '
                  'a SHORT shoulder capelet only (no long cape), mid-tone ice-blue tunic with dark navy shading, long white gloves, a short ice-blue skirt, white fur boots, '
                  'holding a long pale blue staff topped with an ice crystal fork.',
    'electromancer': 'Storm mage: spiky swept-back blonde hair, a navy circlet with two tall light blue lightning-bolt horns spreading in a V shape, '
                     'a short fitted MID-TONE NAVY BLUE (not black) coat dress with a row of gold buttons, lighter blue cuffs, readable folds, two clean split coat tails, '
                     'sleeves rolled up showing the forearms, navy blue stockings and brown boots, holding a long dark staff with a zigzag forked head and a violet crystal orb.',
}
SEEDS3_T, SEEDS3_S = [151, 163], [173, 181]
# v4 (비평 3차: 빙결·뇌전 얼굴이 축소에서 검게 막힘 — 큰 검은 눈·앞머리 외곽선·3/4 정면 얼굴이 46px 한 칸에 겹친다. 일부는 왼쪽을 봄)
STYLE4_ADD = (' Strict side profile view facing to the right, the whole face visible and not covered by hair, short bangs, bright skin tone, '
              'simple small dark eyes, no thick black lines on the face.')
WHO4 = {
    'cryomancer': WHO3['cryomancer'].replace('her pale blue hood is PULLED BACK onto her shoulders',
                                             'her medium-blue hood is pulled back behind her neck with a visibly darker blue rim than her hair')
                  .replace('a long white braid hanging over the front of her shoulder', 'a long white braid with light gray shading on each section hanging over her shoulder'),
    'electromancer': WHO3['electromancer'].replace('spiky swept-back blonde hair', 'short spiky blonde hair swept back behind her head, short bangs')
                     .replace('navy blue stockings and brown boots', 'navy blue stockings with a visible gap between her two legs and brown boots'),
}
SEEDS4 = [201, 213, 227, 239, 241, 257]


# ── v5: 3차 3종 (로드맵 승인 2026-10-17 안 A — 안 B(2차 시트에 소품 붙이기)는 빙결의 군주 비평 3.43: 실루엣 차이가 왕관뿐이라 색깔놀이) ──
#  2차 특징을 잇되 틀부터 커진다 (CLAUDE.md 아트 규칙: 2차→3차는 특징을 잇고, 다른 계열과는 틀부터 다르게).
#  i = 2차 합격작(topix.PICK 원본 1024)을 밑그림으로 denoise 0.8 (얼굴·머리색을 잇는다) · t = 순수 txt2img
WHO5 = {
    'archmage': 'Archmage of fire, the grown-up form of a fire mage: very long fiery orange-red hair in a high ponytail streaming far behind her like flames, '
                'a golden flame crown with two short curved horns, a round ring of fire floating behind her head, '
                'a long dark crimson robe with gold trim split open at the front so both legs and dark boots are visible, broad golden shoulder pauldrons, '
                'gold-trimmed bracers on bare forearms, holding a long ornate black and gold staff topped with a blazing fire orb.',
    'frostlord': 'Frost queen, the grown-up form of an ice mage: a tall spiky ice-crystal crown, long straight white hair down her back, '
                 'sharp crystal shoulder pauldrons, a long flowing white cape with an icicle hem trailing behind her, a fitted mid-tone ice-blue tunic with dark navy shading, '
                 'long white gloves, ice-blue trousers tucked into white fur boots, holding a tall glacier staff topped with a large ice crystal.',
    'thunderEmperor': 'Thunder empress, the grown-up form of a storm mage: a big golden crown with two large lightning-bolt horns, spiky swept-back white hair, '
                      'a wheel of lightning with spokes floating behind her back, a short navy cape with gold trim, a long mid-tone navy coat with gold buttons and long split coat tails, '
                      'sleeves rolled up showing the forearms, navy stockings and boots, holding a golden scepter staff with a crackling lightning orb.',
}
# 뇌제 바퀴 빼기 (2026-10-17 사용자 "계속 진행해" = 추천안: 바퀴는 몸 그림에서 빼고 게임 VFX 로) — 같은 시드로 바퀴 문구만 빼 같은 구도를 노린다
WHO5['thunderEmperor_nw'] = WHO5['thunderEmperor'].replace('a wheel of lightning with spokes floating behind her back, ', '') + ' Nothing floating behind her.'
FROM5 = {'archmage': 'pyromancer', 'frostlord': 'cryomancer', 'thunderEmperor': 'electromancer'}
SEEDS5_I, SEEDS5_T = [301, 313, 327, 339], [341, 353, 367, 379]


def gen5nw(seeds=(353, 367, 341, 379)):
    from comfy import gen as G
    pr = STYLE2.format(who=WHO5['thunderEmperor_nw']) + STYLE3_ADD + STYLE4_ADD
    for sd in seeds:
        out = os.path.join(RAW, f'thunderEmperor_v5n-{sd}.png')
        if os.path.exists(out): continue
        ims, dt = G('zimg', pr, seed=sd); ims[0].save(out); print('thunderEmperor v5n', sd, f'{dt:.1f}s', flush=True)


def gen5(classes, n=None):
    from comfy import gen as G
    sys.path.insert(0, HERE); import topix
    for cls in classes:
        init = Image.open(os.path.join(RAW, topix.PICK[FROM5[cls]] + '.png')).convert('RGB')
        pr = STYLE2.format(who=WHO5[cls]) + STYLE3_ADD + STYLE4_ADD
        for mode, seeds in (('i', SEEDS5_I), ('t', SEEDS5_T)):
            for sd in seeds[:n]:
                out = os.path.join(RAW, f'{cls}_v5{mode}-{sd}.png')
                if os.path.exists(out): continue
                ims, dt = (G('zimg', pr, seed=sd, denoise=0.8, init=init) if mode == 'i' else G('zimg', pr, seed=sd))
                ims[0].save(out); print(cls, 'v5', mode, sd, f'{dt:.1f}s', flush=True)


def gen4(classes):
    from comfy import gen as G
    for cls in classes:
        for sd in SEEDS4:
            out = os.path.join(RAW, f'{cls}_v4t-{sd}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', STYLE2.format(who=WHO4[cls]) + STYLE3_ADD + STYLE4_ADD, seed=sd)
            ims[0].save(out); print(cls, 'v4', sd, f'{dt:.1f}s', flush=True)


def gen3(classes):
    from comfy import gen as G
    sil = Image.open(os.path.join(RAW, '_init-sil.png')).convert('RGB')
    for cls in classes:
        for mode, seeds in (('t', SEEDS3_T), ('s', SEEDS3_S)):
            for sd in seeds:
                out = os.path.join(RAW, f'{cls}_v3{mode}-{sd}.png')
                if os.path.exists(out): continue
                pr = STYLE2.format(who=WHO3[cls]) + STYLE3_ADD
                ims, dt = (G('zimg', pr, seed=sd) if mode == 't' else G('zimg', pr, seed=sd, denoise=0.9, init=sil))
                ims[0].save(out); print(cls, 'v3', mode, sd, f'{dt:.1f}s', flush=True)


def silhouette_init():
    """3등신 중립 실루엣 (skel.py 기준 자세 to_b(pose()), 192칸 → 1024): 회색 몸·큰 머리·지팡이. 모습(옷·머리)은 정하지 않는다"""
    import importlib.util
    from PIL import ImageDraw
    sys.path.insert(0, os.path.join(HERE, '..', 'sheets-sword'))
    sp = importlib.util.spec_from_file_location('mskel', os.path.join(HERE, 'skel.py')); sk = importlib.util.module_from_spec(sp); sp.loader.exec_module(sk)
    p = sk.to_b(sk.pose()); S = 1024 / 192 * 1.25; ox, oy = -60, -260          # 192칸 좌표 → 1024 (가운데로)
    T = lambda q: (q[0] * S + ox + 130, q[1] * S + oy)
    im = Image.new('RGB', (1024, 1024), (200, 200, 204)); d = ImageDraw.Draw(im); col = (120, 122, 132)
    for a, b, w in [('NECK', 'RIGHT HIP', 34), ('NECK', 'LEFT HIP', 34), ('RIGHT HIP', 'RIGHT KNEE', 20), ('RIGHT KNEE', 'RIGHT LEG', 18), ('LEFT HIP', 'LEFT KNEE', 20),
                    ('LEFT KNEE', 'LEFT LEG', 18), ('RIGHT SHOULDER', 'RIGHT ELBOW', 14), ('RIGHT ELBOW', 'RIGHT ARM', 13), ('LEFT SHOULDER', 'LEFT ELBOW', 14), ('LEFT ELBOW', 'LEFT ARM', 13)]:
        d.line([T(p[a]), T(p[b])], fill=col, width=int(w * 2.2))          # 굵게 — 몸이 이어져 보이게
    hx, hy = T((p['NECK'][0] + 3, p['NECK'][1] - 17)); R = 16 * S
    d.ellipse([hx - R, hy - R, hx + R, hy + R], fill=col)
    g = T(p['RIGHT ARM']); import math; a = math.radians(-80)
    d.line([(g[0] - 16 * S * math.cos(a), g[1] - 16 * S * math.sin(a)), (g[0] + 52 * S * math.cos(a), g[1] + 52 * S * math.sin(a))], fill=(100, 90, 80), width=12)
    return im


def gen2(classes):
    from comfy import gen as G
    os.makedirs(RAW, exist_ok=True)
    sil = silhouette_init(); sil.save(os.path.join(RAW, '_init-sil.png'))
    for cls in classes:
        for mode, seeds in (('t', SEEDS_T), ('s', SEEDS_S)):
            for sd in seeds:
                out = os.path.join(RAW, f'{cls}_v2{mode}-{sd}.png')
                if os.path.exists(out): continue
                pr = STYLE2.format(who=WHO2[cls])
                ims, dt = (G('zimg', pr, seed=sd) if mode == 't' else G('zimg', pr, seed=sd, denoise=0.9, init=sil))
                ims[0].save(out); print(cls, mode, sd, f'{dt:.1f}s', flush=True)


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


def shrink2(im, H, ncol=14, line_frac=0.7, body=None):           # 기본값: 14색. 외곽선 칸 기준은 지금 그림 밑그림판 0.45 → 컨셉 새 그림(두꺼운 선) 0.7 (비교 2026-10-17)
    """뭉개짐 줄인 축소 (로드맵 검수 "명암 덩어리·얼굴 흐림"): 칸 안 색을 평균하지 않는다.
    1) 1024 원본의 몸 칸만 먼저 ncol 색으로 줄인다(색 번호) — 같은 재질은 같은 색 번호라 축소 뒤 색이 들쭉날쭉하지 않다
    2) 칸마다: 아주 어두운(외곽선) 칸이 line_frac 이상이면 외곽선 #0b0d14 — 1~2px 선(눈·옷 경계)이 살아남는다. 아니면 최빈 색 번호
    3) 외톨이 점(상하좌우 네 이웃과 모두 다른 칸) 지우기 → 바깥 외곽선 1칸
    body = (top, foot): 1024 원본의 머리 꼭대기·발바닥 y (모자 장식·지팡이 제외) — 주면 그 몸 키가 H 칸이 되게 칸 크기를 정한다
      (공용 dev/sheets-common/shrink.py shrink_body 와 같은 생각: 지팡이를 머리 위로 세운 직업도 몸 키가 같게). 발바닥 아래 그림자는 지운다"""
    import numpy as np
    sys.path.insert(0, os.path.join(HERE, '..', 'sheets-sword'))
    import importlib.util
    sp = importlib.util.spec_from_file_location('sword_design', os.path.join(HERE, '..', 'sheets-sword', 'design.py'))
    sd = importlib.util.module_from_spec(sp); sp.loader.exec_module(sd)
    a, m = sd.fg(im)
    if body: m[body[1] + 1:] = False                 # 발밑 그림자·바닥 줄
    ys, xs = np.nonzero(m)
    if len(xs) == 0: return None
    y0, y1 = np.percentile(ys, [0.3, 99.9]); x0, x1 = np.percentile(xs, [0.3, 99.7])
    y0, y1, x0, x1 = int(y0), int(y1) + 1, int(x0), int(x1) + 1
    if body:
        cell = (body[1] + 1 - body[0]) / H
        H = int(np.ceil((y1 - y0) / cell))           # 지팡이·모자까지 담는 출력 높이
    lum = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11
    dark = m & (lum < 30)                            # 외곽선 = 아주 어두운 칸만 (45 면 남색 코트(밝기 ~41)까지 외곽선이 되어 검게 뭉침 — 비평 지적)
    # 1) 몸 칸 색 줄이기 (어두운 선 칸 제외)
    bm = m & ~dark
    pix = a[bm].astype(np.uint8)
    q = Image.fromarray(pix.reshape(-1, 1, 3), 'RGB').quantize(colors=ncol, method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:ncol * 3], np.uint8).reshape(-1, 3)
    idx = np.full(m.shape, -1, np.int32); idx[bm] = np.asarray(q).reshape(-1)
    cell = (y1 - y0) / H if not body else cell; W = int(np.ceil((x1 - x0) / cell))
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
    # 발밑 그림자·바닥 줄: 맨 아래 줄이 바로 위 줄보다 1.4배 넘게 넓으면 지운다 (최대 2줄, 공용 shrink_body 와 같은 규칙)
    for _ in range(2):
        rows = [j for j in range(o.shape[0]) if o[j, :, 3].any()]
        if len(rows) < 3: break
        wd = lambda j: (lambda xs: xs.max() - xs.min() if len(xs) else 0)(np.nonzero(o[j, :, 3])[0])
        if wd(rows[-1]) > 1.4 * max(1, wd(rows[-2])): o[rows[-1]] = 0
        else: break
    # 몸에서 떨어진 작은 조각(8방향 3칸 이하) 지우기 — 비평 지적 "머리카락 끝·챙 끝 외톨이 어두운 도트"
    al = o[..., 3] > 0; seen = np.zeros_like(al)
    for j in range(H):
        for i in range(W):
            if al[j, i] and not seen[j, i]:
                st, comp = [(j, i)], []; seen[j, i] = True
                while st:
                    y, x = st.pop(); comp.append((y, x))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < H and 0 <= xx < W and al[yy, xx] and not seen[yy, xx]: seen[yy, xx] = True; st.append((yy, xx))
                if len(comp) <= 3:
                    for y, x in comp: o[y, x] = 0
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
    elif sys.argv[1] == 'gen2': gen2(sys.argv[2:] or list(WHO2))
    elif sys.argv[1] == 'gen3': gen3(sys.argv[2:] or list(WHO3))
    elif sys.argv[1] == 'gen4': gen4(sys.argv[2:] or list(WHO4))
    elif sys.argv[1] == 'gen5': gen5(sys.argv[2:] or [k for k in WHO5 if '_' not in k])
    elif sys.argv[1] == 'gen5nw': gen5nw()
    elif sys.argv[1] == 'sil': silhouette_init().save(os.path.join(RAW, '_init-sil.png'))
    elif sys.argv[1] == 'shrink': shrink_all()
    elif sys.argv[1] == 'shrink2': shrink2_all(ncol=int(sys.argv[2]) if len(sys.argv) > 2 else 14)
