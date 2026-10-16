# 순위 시험 (스펙 docs/specs/pixel-qa.md 수용 기준): ComfyUI 후보 48장(텍스처 3종 × 16)을 텍스처별로 순위 매긴다.
# 후보마다 qa.py 로 게임 모습·지표를 만들고, 텍스처별 대조 시트(16장, 섞은 번호 1~16, 원본 · 게임 모습 4배)를 만든다.
# 비평에는 대조 시트와 번호별 지표(cands.json)만 넘긴다. 정답(기존 "쓸 만함" 라벨)은 key.json 에 두고 채점 때만 연다.
#   python3 dev/pixel-qa/rank.py <출력 폴더> [seed=16]
#   채점: python3 dev/pixel-qa/rank.py --score <출력 폴더>   (각 텍스처 폴더의 rank.json = {"order": [번호 16개, 좋은 순]})
import sys, os, json, random
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa import ROOT, run, BG_DARK

CAND = os.path.join(ROOT, 'dev/comfy/out/cand')
# 쓰임은 dev/review/comfy-vs-pixellab.html SECTIONS 의 설명에서. 정답 = 같은 파일의 SECTIONS.ok (사용자 판정 "쓸 만함")
TEX = {
    'w1b': dict(use='W1b 초승달 검흔 (32×32 한 장) — 흰 바깥 날 + 몸, 끝이 가늘어지는 호. 직업색 시트',
                ok={'sdxl': [4, 6], 'zimg': [5, 6, 7, 8]}),
    'h1': dict(use='H1 평타 명중 키 그림 (32×32 한 장, 나중에 5프레임으로 애니) — 별 섬광. 직업색 시트',
               ok={'sdxl': [1, 2, 8], 'zimg': [1, 2, 3, 4, 7, 8]}),
    'c1': dict(use='C1 공용 초승달 참격파 + 속도선 (64×32 한 장) — 강철 베기 등 스킬 공용. 직업색 시트',
               ok={'sdxl': [2], 'zimg': [1, 4, 5, 6, 7, 8]}),
}


def contact(items, out_png, sc=4):
    """items [(번호, 원본 RGBA, 게임 모습 RGBA)] → 4열 대조 시트 (칸마다 원본 · 게임 모습을 어두운 바탕에 4배)"""
    h, w = items[0][1].shape[:2]
    cw, ch = (w * sc) * 2 + 12, h * sc + 22
    cols = 4; rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (cw + 10) + 10, rows * (ch + 10) + 10), (40, 44, 56))
    d = ImageDraw.Draw(sheet)
    for i, (no, raw, game) in enumerate(items):
        x0, y0 = 10 + (i % cols) * (cw + 10), 10 + (i // cols) * (ch + 10)
        for j, im in enumerate((raw, game)):
            bg = Image.new('RGB', (w, h), BG_DARK); bg.paste(Image.fromarray(im), (0, 0), Image.fromarray(im))
            sheet.paste(bg.resize((w * sc, h * sc), Image.NEAREST), (x0 + j * (w * sc + 12), y0 + 20))
        d.text((x0, y0 + 4), f'#{no}  raw | game', fill=(230, 230, 240))
    sheet.save(out_png)


def build(out, seed=16):
    key = {}
    for tex, t in TEX.items():
        files = [f'{tex}-{m}-s{i}' for m in ('sdxl', 'zimg') for i in range(1, 9)]
        random.Random(seed + len(tex)).shuffle(files)
        d = os.path.join(out, tex); os.makedirs(d, exist_ok=True)
        items, cands = [], {}
        for no, f in enumerate(files, 1):
            png = os.path.join(CAND, f + '.png')
            res, game = run(png, f, None, 1, False, t['use'], None, opts={'frames': 1})
            raw = np.asarray(Image.open(png).convert('RGBA'))
            items.append((no, raw, game))
            cands[no] = {'metrics': res['metrics'], 'flags': [x['k'] for x in res['flags']], 'gate_fail': res['gate']['fail']}
            m, s = f.split('-')[1], int(f.rsplit('-s', 1)[1])
            key[f'{tex}#{no}'] = {'file': f, 'ok': s in t['ok'][m]}
        contact(items, os.path.join(d, 'sheet.png'))
        json.dump({'use': t['use'], 'cands': cands}, open(os.path.join(d, 'cands.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    json.dump(key, open(os.path.join(out, 'key.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('built', len(key))


def metric_order(cands):
    """지표만으로 매긴 순위 (비교용): 경보 수 적은 순 → 부스러기 적은 순 → 밝기 폭 큰 순"""
    def k(no):
        c = cands[no]; m = c['metrics'] or {}
        return (len(c['flags']) + len(c['gate_fail']), m.get('crumbs', 99), -m.get('lrange', 0))
    return sorted(cands, key=k)


def score(out):
    key = json.load(open(os.path.join(out, 'key.json'), encoding='utf8'))
    res = {}
    for tex in TEX:
        d = os.path.join(out, tex)
        cands = json.load(open(os.path.join(d, 'cands.json'), encoding='utf8'))['cands']
        p = os.path.join(d, 'rank.json')
        orders = {'metric': metric_order(cands)}
        if os.path.exists(p): orders['critic'] = [str(x) for x in json.load(open(p, encoding='utf8'))['order']]
        res[tex] = {}
        for who, order in orders.items():
            top = set(order[:len(order) // 2])
            ok = [no for no in cands if key[f'{tex}#{no}']['ok']]
            res[tex][who] = {'ok_in_top': sum(no in top for no in ok), 'ok': len(ok), 'order': order}
    tot = {who: (sum(r[who]['ok_in_top'] for r in res.values() if who in r), sum(r[who]['ok'] for r in res.values() if who in r))
           for who in ('metric', 'critic')}
    json.dump({'per_tex': res, 'total': tot}, open(os.path.join(out, 'score.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    for tex, r in res.items():
        print(tex, {w: f"{v['ok_in_top']}/{v['ok']}" for w, v in r.items()})
    for who, (a, b) in tot.items():
        if b: print(f'{who}: 쓸 만함 {a}/{b} = {a / b:.0%} 상위 절반 (기준 70%)')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')   # Windows 콘솔(cp949)에 없는 '—' 등으로 죽지 않게
    if sys.argv[1] == '--score': score(sys.argv[2])
    else: build(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 16)
