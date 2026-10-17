# 파이터 계열 7종 새 그림체 디자인 시안 (docs/specs/legacy-class-sheets.md 그림체 B · 3등신 · 게임 안 키 46, 로드맵 승인 2026-10-17)
#  마법사 계열 v2~v5 방식: 순수 txt2img(Z-Image + 픽셀 LoRA) → shrink2(키 46) → qa.py --kind char + 비평(critic.md).
#  첫 프레임으로 바로 쓰도록 "팔 내린 중립 대기·빈손" 으로 그린다 (관절 애니 교훈: 가드·겨눔 첫 프레임이면 팔이 관절을 안 따른다).
#  C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/boxer/b/design.py gen [직업 ...]  → dev/boxer/b/raw/<직업>_v1-<시드>.png (저장소 밖 아님 — .gitignore)
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'comfy'))
RAW = os.path.join(HERE, 'raw')

STYLE = ('Pixel art style. One single full-body 2D game character sprite, side view in profile, facing right, standing in a relaxed neutral pose '
         'with both arms hanging down at the sides and empty clenched fists, feet slightly apart. {who} '
         'Chibi-like stylized proportions exactly 3 heads tall: big head, short body, both arms and both legs clearly visible and separate. '
         'Plain flat light gray background, nothing else, no text, no ground shadow, no weapon, no effects. Crisp clean hard pixels, bold dark outline, '
         'limited palette of about 14 colors, large clean flat color areas, clear readable silhouette, light from the upper right. '
         'Mid-tone colors with clear 3-step shading on every cloth area, no pure black areas except the thin outline. '
         'A clearly readable face with skin tone and simple small dark eyes, short bangs that do not cover the face. No white rim light, no sparkles, no stray dots.')
WHO = {
    # 1차
    'fighter': 'A young street brawler boy: spiky black hair with a long red headband whose two tails flutter behind his head, a white sleeveless shirt, '
               'forearms wrapped in white bandages, a gold-yellow belt, short navy blue shorts to the knees, red sneakers.',
    # 2차
    'striker': 'A muscular heavyweight boxer man: short slicked black hair, a stern face, a black sleeveless tank top, big steel-plated boxing gauntlets on both hands '
               '(gray metal with gold rivets), a wide gold championship belt buckle, red boxing trunks with a white stripe, black boxing boots.',
    'kickboxer': 'A lean young woman kickboxer: a very high long brown ponytail swinging behind her, a white sports crop top, red hand wraps on the fists, '
                 'fitted white muay thai shorts, white shin guards over bare lower legs, barefoot.',
    'qigong': 'A calm young martial artist monk man: short black hair with a white headband, a deep navy blue kung fu jacket with frog buttons and wide short sleeves '
              'showing the forearms, a white sash belt, a string of large wooden prayer beads around the neck, loose navy trousers tucked into white wraps, cloth shoes.',
    # 3차 (2차 특징을 잇고 틀을 키운다)
    'champion': 'A heroic champion boxer man, the grown-up form of a heavyweight boxer: a huge spiky golden lion-mane hairstyle, a short dark red cape with gold trim on the shoulders, '
                'big shining gold boxing gauntlets, a bare muscular chest with a giant gold championship belt, dark red trunks with gold trim, red and gold boots.',
    'tempest': 'A storm kickboxer woman, the grown-up form of a kickboxer: long silver-white hair in two high twin tails with teal tips, a short teal wind mantle on the back, '
               'one steel shoulder pauldron, a fitted teal and white sleeveless top, white shorts, tall steel shin guards with teal trim, barefoot.',
    'grandmaster': 'An old wise grandmaster monk of qi, the grown-up form of a martial artist monk: long white hair and a long white beard, a golden halo ring floating behind his head, '
                   'a long navy blue robe with gold trim split at the front so both legs are visible, a huge string of glowing white beads over the shoulder, '
                   'a white sash, navy trousers and cloth shoes.',
}
SEEDS = [11, 23, 37, 51, 67, 83]


def gen(classes, seeds=SEEDS, tag='v1', extra=''):
    from comfy import gen as G
    os.makedirs(RAW, exist_ok=True)
    for cls in classes:
        for sd in seeds:
            out = os.path.join(RAW, f'{cls}_{tag}-{sd}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', STYLE.format(who=WHO[cls]) + extra, seed=sd)
            ims[0].save(out); print(cls, tag, sd, f'{dt:.1f}s', flush=True)


if __name__ == '__main__':
    if sys.argv[1] == 'gen': gen(sys.argv[2:] or list(WHO))


# ── 2라운드 (비평 r1: 챔피언 3.29 — 갈기가 눈을 가림·흑백에서 갈기와 몸이 뭉침 / 템페스트 3.29 — 머리 지글거림·얼굴 흐림·킥복서와 틀 차이 약함) ──
WHO2 = {
    'champion': 'A heroic champion boxer man: a big spiky golden lion-mane hairstyle that flows BACKWARD behind the head and leaves the whole face uncovered, '
                'a clearly visible tanned face with bold eyebrows and two dark eyes, a short dark crimson cape with gold trim hanging behind the shoulders, '
                'big shining gold boxing gauntlets, a bare muscular tanned chest with a giant gold championship belt, dark crimson trunks with gold trim, crimson and gold boots. '
                'The golden mane is clearly lighter than the darker skin.',
    'tempest': 'A storm kickboxer woman: silver-white hair tied in two very high and long twin tails that spread wide apart to the back and upward like wings, with teal tips, '
               'a clearly visible face with two dark eyes, a short teal wind mantle flaring behind her shoulders, one big steel shoulder pauldron, '
               'a fitted teal and white sleeveless top, white shorts, tall steel shin guards with teal trim, barefoot. Clean simple hair shapes.',
}
SEEDS2 = [101, 113, 127, 139, 151, 163]


def gen2(classes):
    from comfy import gen as G
    for cls in classes:
        for sd in SEEDS2:
            out = os.path.join(RAW, f'{cls}_v2-{sd}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', STYLE.format(who=WHO2[cls]), seed=sd)
            ims[0].save(out); print(cls, 'v2', sd, f'{dt:.1f}s', flush=True)


if __name__ == '__main__' and sys.argv[1] == 'gen2': gen2(sys.argv[2:] or list(WHO2))
