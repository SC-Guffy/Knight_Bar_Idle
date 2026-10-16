# 레인저 계열 디자인 시안 (그림체 B 3등신 · 게임 안 키 46px, 2026-10-16 사용자 확정, PixelLab 0회)
#  검사 계열 dev/sheets-sword/design.py 의 B2 방식을 따른다: 지금 스프라이트(대기 자세)의 머리는 두고 목 아래만 세로 1.5배로 늘린 밑그림을
#  ComfyUI Z-Image + 픽셀 LoRA 로 denoise 0.82 다시 그린다 (글로만 "3등신" 이라 쓰면 모델이 무시) → 같은 shrink 로 키 46px.
#  모습은 디자인 브리프(dev/review/sheets-bow.html A-1)대로 바꿔도 된다 — 밑그림은 비율·자세만 잡는다.
#  실행 (ComfyUI 가상환경 파이썬, 서버 8188, 큐를 보고 한 번에 8장 이하):
#    C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/bowsheets/design.py gen [직업 ...]  → design/raw/<cls>-B-<seed>.png (1024, 저장소 밖으로 옮기지 않음 — .gitignore)
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
    'arbalest': 'A heavy crossbowman in a squared steel helmet with the visor raised, a steel breastplate over a red tabard, a bandolier of bolts across the waist, '
                'a red cape, steel boots, holding a huge wooden and steel crossbow level at the waist with both hands, the crossbow as long as the torso, pointing forward.',
}
SEEDS = [11, 23, 37, 51]
STRETCH, DENOISE = 1.5, 0.82


def init_stretch(cls):
    """지금 대기 그림(1배, 96칸, 땅 = 아래 끝)에서 목(땅-19) 아래만 1.5배로 늘린 밑그림 (연회색 바탕 1024)"""
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


def gen(classes):
    from comfy import gen as G
    os.makedirs(RAW, exist_ok=True)
    for cls in classes:
        init = init_stretch(cls); init.save(os.path.join(D, f'init-{cls}.png'))
        for s in SEEDS:
            out = os.path.join(RAW, f'{cls}-B-{s}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', STYLE.format(who=WHO[cls], body=BODY_B), seed=s, denoise=DENOISE, init=init)
            ims[0].save(out); print(cls, s, f'{dt:.1f}s', 'queue', queue_len(), flush=True)


def shrink_all(H=46):
    from design import shrink          # 검사 계열 shrink (바탕 떼기 → 칸 최빈 → 20색 → 외곽선)
    os.makedirs(PXD, exist_ok=True)
    for f in sorted(os.listdir(RAW)):
        if not f.endswith('.png'): continue
        o = shrink(Image.open(os.path.join(RAW, f)), H)
        if o is not None: o.save(os.path.join(PXD, f[:-4] + f'-h{H}.png'))
    print('shrunk', len(os.listdir(PXD)))


if __name__ == '__main__':
    if sys.argv[1] == 'gen': gen(sys.argv[2:] or list(WHO))
    elif sys.argv[1] == 'shrink': shrink_all()
    elif sys.argv[1] == 'queue': print(queue_len())
