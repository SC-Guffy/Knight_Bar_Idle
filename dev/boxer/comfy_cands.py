# 파이터 계열 기준 그림 시안: ComfyUI(Z-Image Turbo + 픽셀 LoRA)로 직업마다 후보를 여러 장 뽑는다.
# 실행 (ComfyUI 가상환경 파이썬, 서버 127.0.0.1:8188):
#   C:\AI\ComfyUI\.venv\Scripts\python.exe dev/boxer/comfy_cands.py [직업,...] [장수=12] [seed0=1]
# 원본 1024px 는 저장소 밖 C:\AI\comfy-raw\boxer, 저장소에는 256px 축소본(dev/boxer/comfy/)과 직업별 밀착 시트만 둔다.
import sys, os, json, time
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'comfy'))
from comfy import gen

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'comfy'); RAW = r'C:\AI\comfy-raw\boxer'
os.makedirs(OUT, exist_ok=True); os.makedirs(RAW, exist_ok=True)

BASE = ('Pixel art style. 2D side-scrolling fantasy game character sprite, cute chibi proportions with a big head and a short body, '
        'full body visible from head to feet, standing in side view facing right, {}. Detailed pixel shading with 4 to 5 tones, '
        'muscle and cloth fold highlights, dark selective outline, centered, plain flat light gray background, nothing else in the image.')
DESC = {
    'fighter': 'a young boxer martial artist, short spiky black hair, a red headband with two long tails flowing behind the head, '
               'white short sleeve training shirt, dark blue shorts with a yellow waistband, white bandage wraps on both fists, red sneakers, '
               'both fists raised in a boxing guard in front of the face',
    'striker': 'a muscular brawler boxer with very broad shoulders and a big chest, black buzz cut hair, black sleeveless tank top, '
               'huge heavy steel armored gauntlets on both fists, a gold champion belt, red boxing shorts, black boots, fists raised in guard',
    'kickboxer': 'a lean kickboxer with long brown hair tied in a high ponytail flowing behind, shirtless with white bandage wraps around the chest, '
                 'loose wide white martial arts pants with a black belt, steel shin guards, barefoot, front knee raised high ready to kick',
    'qigong': 'a qigong martial artist, black bob hair with a white headband, long blue kung fu robe with very wide sleeves hanging down to the knees, '
              'wooden prayer beads necklace, cloth shoes, one open palm pushed forward, faint glowing light blue qi aura around the hands',
    'champion': 'a champion boxer, wild spiky golden hair like a lion mane with a gold circlet on the forehead, a torn red champion robe worn as a cape over the shoulders, '
                'huge golden gauntlets shaped like lion heads, muscular chest, gold champion belt, fists raised',
    'tempest': 'a wind master kickboxer, very long twin ponytails flowing in the wind, a long flowing green scarf, short vest covering one shoulder, '
               'winged steel shin guards, wide pants, barefoot, high kick pose with the front leg extended',
    'grandmaster': 'a grandmaster of qi, black hair in a topknot, long white and gold monk robe with wide sleeves, prayer beads floating and orbiting around the body, '
                   'a glowing golden ring of qi behind the back, calm palm strike pose',
}


def run(cls, n, seed0):
    paths = []
    for k in range(0, n, 4):
        ims, dt = gen('zimg', BASE.format(DESC[cls]), seed=seed0 + k, w=1024, h=1024, batch=min(4, n - k))
        for j, im in enumerate(ims):
            s = seed0 + k + j
            im.save(os.path.join(RAW, f'{cls}-{s}.png'))
            t = im.resize((256, 256), Image.LANCZOS); p = os.path.join(OUT, f'{cls}-{s}.png'); t.save(p); paths.append(p)
        print(cls, f'{k + len(ims)}/{n}', f'{dt:.1f}s', flush=True)
    # 밀착 시트 (번호 = seed)
    cols = 6; rows = (len(paths) + cols - 1) // cols
    sh = Image.new('RGB', (cols * 256, rows * 256), (30, 30, 36))
    for i, p in enumerate(paths): sh.paste(Image.open(p), ((i % cols) * 256, (i // cols) * 256))
    sh.save(os.path.join(OUT, f'_sheet-{cls}.png'))


if __name__ == '__main__':
    clss = sys.argv[1].split(',') if len(sys.argv) > 1 and sys.argv[1] != 'all' else list(DESC)
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 12
    s0 = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    t0 = time.time()
    for c in clss: run(c, n, s0)
    print('done', f'{time.time() - t0:.0f}s')
