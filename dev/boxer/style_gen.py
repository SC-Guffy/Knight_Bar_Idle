# 7:3 v2: 기존 기사 스프라이트를 스타일 참고로 넣어 PixelLab generate-with-style-v2 로 직업마다 변형 16장을 뽑는다.
# 기존 기사와 같은 도트 크기·꼬마 비율·외곽선이 목표 (축소 대신 직접 생성 — 로드맵 세션 지시, 2026-10-14).
#   python -I dev/boxer/style_gen.py <직업> [seed=1] [k]  →  dev/boxer/v2/<직업>-s<seed>-<n>.png (k: 42×42 키 맞춤판 <직업>-k<seed>-<n>.png) + 밀착 시트
import sys, os, json, base64, io, time
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'pixellab'))
from pl import call

OUT = os.path.join(HERE, 'v2'); os.makedirs(OUT, exist_ok=True)
REFS = ['paladin', 'blademaster', 'dragoon', 'ranger']     # 기존 기사 (dev/boxer/raw/hero-*.png, 1칸=1px)
# 키 맞춤판: 출력 크기 = 스타일 그림 크기라서, 기존 기사를 42×42 에 꽉 맞게 자른 그림을 넣으면 출력도 기존 기사 키(35~40칸)가 된다.
# 무기가 길어 42 를 넘는 직업(검성·용기병)은 빼고 폭이 맞는 넷을 쓴다. 42 이하면 한 번에 64장.
REFS42 = ['paladin', 'ranger', 'greatswordsman', 'mage']
SIZE42 = 42

STYLE = ('tiny chibi side-scroller knight sprites: big head about one third of the body, short stubby limbs, 1 pixel dark navy outline around the whole figure, '
         'flat colors with 2 to 3 shades per material, simple dot eyes, facing right in side view, feet on the bottom')
# 3차 키 맞춤판 (2026-10-14): 2차의 특징을 잇고 더 화려하게 — 스타일 참고 4장 중 1장을 부모 2차의 v2 마무리 그림으로 바꾼다 (PARENT)
PARENT = {'champion': 'striker', 'tempest': 'kickboxer', 'grandmaster': 'qigong'}
DESC3 = {
    'champion': 'the same heavyweight boxer as the reference striker but now a champion: wild golden spiky hair like a lion mane, a gold circlet, '
                'a flowing red cape over the shoulders, black sleeveless top, huge shining golden armored gauntlets, big gold champion belt, red shorts, black boots, '
                'more ornate and heroic, front gauntlet raised at the chin',
    'tempest': 'the same kickboxer as the reference but now a wind master: long ponytail flowing back, a long green wind scarf streaming behind, '
               'white chest wrap, wide white pants with a green sash, steel shin guards with small wing ornaments, barefoot, front knee raised high, '
               'small green wind swirls around the feet, more ornate',
    'grandmaster': 'the same qigong martial artist as the reference but now a grandmaster: white headband with long tails, black hair, '
                   'dark blue robe with gold trim and very wide sleeves, a glowing golden halo ring behind the back, floating prayer beads, '
                   'one open palm pushed forward with a golden glow, more ornate',
    # 스트라이커 보강: 권투 글러브가 아니라 금속 판 장갑
    'striker_g': 'a fierce heavyweight boxer with very broad shoulders and big arms, black flat-top haircut, black sleeveless tank top, '
                 'huge angular steel plate gauntlets like armored knight gauntlets with riveted metal plates and short spikes on the knuckles, not boxing gloves, '
                 'gold champion belt, red shorts, black boots, front gauntlet raised at the chin',
    'kickboxer_knee': 'a lean kickboxer with long brown hair in a high ponytail flowing behind, white chest bandage wrap, bare arms, loose wide white martial arts pants '
                      'with a black belt, steel shin guards, barefoot, standing on one leg with the front knee raised high to the chest, fists in guard',
}
DESC = {
    'fighter': 'a young boxer martial artist, short spiky black hair with a red headband whose two tails flow behind the head, white short sleeve shirt, '
               'dark blue shorts with a yellow waistband, white bandage wraps on both fists raised in a boxing guard, red sneakers',
    'striker': 'a fierce heavyweight boxer with very broad shoulders and big arms, black flat-top haircut, black sleeveless tank top, '
               'huge steel armored gauntlets on both fists, gold champion belt, red shorts, black boots, front gauntlet raised at the chin',
    'kickboxer': 'a lean kickboxer with long brown hair in a high ponytail flowing behind, white chest bandage wrap, bare arms, loose wide white martial arts pants '
                 'with a black belt, steel shin guards, barefoot, front knee raised ready to kick',
    'qigong': 'a qigong martial artist with black bob hair and a white headband with tails, long dark blue kung fu robe with very wide sleeves hanging down, '
              'wooden prayer beads necklace, one open palm pushed forward with a small light blue glow',
    'champion': 'a champion boxer with wild spiky golden hair like a lion mane and a gold circlet, a torn red cape over the shoulders, '
                'huge golden gauntlets, bare muscular chest, gold belt, red pants',
    'tempest': 'a wind master kickboxer with long green hair in a ponytail flowing back, a long flowing green scarf, short dark vest, '
               'steel shin guards, dark wide pants, barefoot, front knee raised',
    'grandmaster': 'a grandmaster of qi with black hair in a topknot, long white and gold robe with wide sleeves, a glowing golden ring behind the back, '
                   'prayer beads, one palm raised forward',
}


def b64(im):
    buf = io.BytesIO(); im.save(buf, 'PNG'); return base64.b64encode(buf.getvalue()).decode()


def ref64(name):
    im = Image.open(os.path.join(HERE, 'raw', f'hero-{name}.png')).convert('RGBA'); bb = im.getbbox(); c = im.crop(bb)
    o = Image.new('RGBA', (64, 64)); o.paste(c, (32 - c.width // 2, 59 - c.height), c); return o


def ref42(name):
    im = Image.open(os.path.join(HERE, 'raw', f'hero-{name}.png')).convert('RGBA'); bb = im.getbbox(); c = im.crop(bb)
    o = Image.new('RGBA', (SIZE42, SIZE42)); o.paste(c, (SIZE42 // 2 - c.width // 2, SIZE42 - 1 - c.height), c); return o


def images(o, out):
    if isinstance(o, dict):
        if isinstance(o.get('base64'), str) and len(o['base64']) > 100: out.append(o['base64']); return
        for v in o.values(): images(v, out)
    elif isinstance(o, list):
        for v in o: images(v, out)


def fin42(name):
    """v2 마무리 그림(64 판, 발 y=58)을 42×42 로 꽉 맞게 자른다 — 3차의 부모 참고용."""
    im = Image.open(os.path.join(HERE, f'v2fin-{name}.png')).convert('RGBA'); bb = im.getbbox(); c = im.crop(bb)
    o = Image.new('RGBA', (SIZE42, SIZE42)); o.paste(c, (SIZE42 // 2 - c.width // 2, SIZE42 - 1 - c.height), c); return o


def run(cls, seed=1, small=False):
    base = cls.split('_')[0]
    if small:
        names = REFS42[:3] if base in PARENT else REFS42
        refs = [{'image': {'type': 'base64', 'base64': b64(ref42(n))}, 'width': SIZE42, 'height': SIZE42} for n in names]
        if base in PARENT:
            refs.append({'image': {'type': 'base64', 'base64': b64(fin42(PARENT[base]))}, 'width': SIZE42, 'height': SIZE42})
    else:
        refs = [{'image': {'type': 'base64', 'base64': b64(ref64(n))}, 'width': 64, 'height': 64} for n in REFS]
    desc = DESC3.get(cls) if small and cls in DESC3 else DESC[cls]
    body = {'style_images': refs,
            'description': desc, 'style_description': STYLE, 'seed': seed, 'no_background': True}
    st, r = call('POST', '/generate-with-style-v2', body)
    if st not in (200, 202): print('HTTP', st, str(r)[:800]); return []
    job = r.get('background_job_id') if isinstance(r, dict) else None
    if job:
        for _ in range(200):
            time.sleep(5); st, r = call('GET', f'/background-jobs/{job}')
            if isinstance(r, dict) and r.get('status') in ('completed', 'failed'): break
        if r.get('status') != 'completed': print('job', r.get('status'), str(r)[:400]); return []
    imgs = []; images(r, imgs)
    seen = set(); uniq = []
    for b in imgs:                       # 응답에 같은 그림이 두 벌 들어 있다 (그리드 + 낱장) — 내용으로 거른다
        k = b[-200:]
        if k not in seen: seen.add(k); uniq.append(b)
    imgs = uniq
    paths = []
    for i, b in enumerate(imgs):
        if ',' in b[:40]: b = b.split(',', 1)[1]
        im = Image.open(io.BytesIO(base64.b64decode(b))).convert('RGBA')
        tag = 'k' if small else 's'
        p = os.path.join(OUT, f'{cls}-{tag}{seed}-{i}.png'); im.save(p); paths.append(p)
    if paths:
        cols = 8; rows = (len(paths) + cols - 1) // cols
        sh = Image.new('RGBA', (cols * 66, rows * 66), (40, 40, 48, 255))
        for i, p in enumerate(paths): sh.alpha_composite(Image.open(p).convert('RGBA').resize((64, 64), Image.NEAREST), ((i % cols) * 66, (i // cols) * 66))
        sh.resize((sh.width * 3, sh.height * 3), Image.NEAREST).save(os.path.join(OUT, f'_sheet-{cls}-{"k" if small else "s"}{seed}.png'))
    return paths


if __name__ == '__main__':
    cls = sys.argv[1]; seed = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    small = len(sys.argv) > 3 and sys.argv[3] == 'k'     # k: 기존 기사 키 맞춤판 (42×42)
    st, b = call('GET', '/balance'); b0 = b['subscription']['generations'] if st == 200 else None
    ps = run(cls, seed, small)
    st, b = call('GET', '/balance'); b1 = b['subscription']['generations'] if st == 200 else None
    print(cls, 'images', len(ps), 'size', Image.open(ps[0]).size if ps else None, 'generations', b0, '->', b1)
