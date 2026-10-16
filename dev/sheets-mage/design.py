# 마법사 계열 디자인 시안 (스펙 "기준 그림 = 새로 다시 그린 직업 디자인", 그림체 B 3등신 · 게임 안 키 46px — 2026-10-16 사용자 확정, PixelLab 0회)
#  검사 세션 dev/sheets-sword/design.py 방식 그대로: 지금 스프라이트의 머리는 두고 목 아래만 세로로 1.5배 늘린 밑그림을
#  ComfyUI Z-Image + 픽셀 LoRA 로 denoise 0.82 다시 그린다(글로만 "3등신" 이라 쓰면 모델이 무시함) → 1024px 를 키 46px 로 줄임(shrink 는 그 파일 것).
#  옷은 브리프대로 소매(팔뚝)·다리가 보이게 (통 로브는 관절 애니에서 팔·다리가 죽었다 — 검토 페이지 0절 몸 움직임 검사).
#  뇌전술사는 확정된 시안 B 머리(뻗친 금발 + 남색 관 + V 자 번개 뿔, mannequin.electro_head)를 밑그림 머리로 쓴다.
#  실행 (ComfyUI 가상환경 파이썬, 서버 8188 — GPU 를 네 세션이 같이 쓰니 한 장씩 차례로):
#    C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/sheets-mage/design.py gen [직업 ...]  → design/raw/<cls>-<seed>.png
#    ... design.py shrink → design/px/<cls>-<seed>-h46.png
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
STRETCH, DENOISE = 1.5, 0.82


def ref_img(cls):
    """지금 게임 그림 (96칸, 발 44·88). 뇌전술사는 시안 B 머리"""
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
        for s in SEEDS:
            out = os.path.join(RAW, f'{cls}-{s}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', STYLE.format(who=WHO[cls]), seed=s, denoise=DENOISE, init=init)
            ims[0].save(out); print(cls, s, f'{dt:.1f}s', flush=True)


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
