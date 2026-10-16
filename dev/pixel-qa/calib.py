# 도트 품질 지표 보정 실험 (스펙 docs/specs/pixel-qa.md "보정") — 판정이 이미 난 그림으로 지표가 합격/탈락을 가르는지 본다.
#   python3 dev/pixel-qa/calib.py > dev/review/pixel-qa/calib.json
# 세트: regen_old(탈락 6) · regen_new(합격 6) · vfx_all(확정된 src/vfx 전부)
import sys, os, glob, json
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')

def luma(rgb):
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255

def comps(mask):
    # 8방향 연결 덩어리 크기 목록
    H, W = mask.shape; lab = np.zeros(mask.shape, np.int32); sizes = []; n = 0
    for y, x in zip(*np.nonzero(mask)):
        if lab[y, x]: continue
        n += 1; st = [(y, x)]; lab[y, x] = n; c = 0
        while st:
            a, b = st.pop(); c += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    p, q = a + dy, b + dx
                    if 0 <= p < H and 0 <= q < W and mask[p, q] and not lab[p, q]:
                        lab[p, q] = n; st.append((p, q))
        sizes.append(c)
    return sizes

def metrics_arr(arr, frames=5):
    im = arr.astype(np.int32)
    a = im[..., 3]; rgb = im[..., :3]; op = a >= 128; n = int(op.sum())
    if n == 0: return None
    L = luma(rgb)
    # 이웃 차: 오른쪽·아래 이웃 둘 다 불투명한 쌍에서 색 차(채널 최대) > 40 비율 = 지글거림
    d = []
    for sl0, sl1 in (((slice(None), slice(None, -1)), (slice(None), slice(1, None))), ((slice(None, -1), slice(None)), (slice(1, None), slice(None)))):
        m = op[sl0] & op[sl1]; diff = np.abs(rgb[sl0] - rgb[sl1]).max(-1)
        d.append((int((diff[m] > 40).sum()), int(m.sum())))
    edge = sum(x for x, _ in d) / max(1, sum(y for _, y in d))
    # 외톨이: 4이웃 중 비슷한 색(차 ≤ 24)이 하나도 없는 불투명 픽셀
    H, W = op.shape; lone = 0
    pad = np.pad(rgb, ((1, 1), (1, 1), (0, 0))); pop = np.pad(op, 1)
    sim = np.zeros(op.shape, bool)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nb = pad[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx]; nop = pop[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx]
        sim |= nop & (np.abs(nb - rgb).max(-1) <= 24)
    lone = float((op & ~sim).sum()) / n
    # 어두움: 불투명 중 밝기 < 0.2 (검은 외곽선·검은 몸)
    dark = float((L[op] < 0.2).sum()) / n
    # 무채색 검정 테: 투명과 맞닿은 불투명 픽셀 중 어둡고 채도 낮은 것
    nbT = np.zeros(op.shape, bool)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nbT |= ~pop[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx]
    rim = op & nbT
    sat = rgb.max(-1) - rgb.min(-1)
    inkrim = float((rim & (L < 0.2) & (sat < 40)).sum()) / max(1, rim.sum())
    # 조각: 프레임마다 덩어리 수, 4픽셀 이하 부스러기 수
    fw = W // frames; fr = []
    for i in range(frames):
        s = comps(op[:, i * fw:(i + 1) * fw]); fr.append((len(s), sum(1 for c in s if c <= 4)))
    crumbs = sum(c for _, c in fr) / frames
    # 색 수와 '거의 같은 색' 쌍 (AI 흐림 계조)
    cols = np.unique(rgb[op], axis=0); nc = len(cols)
    near = 0
    if nc <= 400:
        dd = np.abs(cols[:, None, :] - cols[None, :, :]).max(-1)
        near = float(((dd > 0) & (dd <= 10)).any(1).mean())
    # 밝기 폭: 불투명 밝기 5~95 백분위 차
    p5, p95 = np.percentile(L[op], [5, 95])
    # 가장 어두운 단 비중: 불투명 픽셀 중 그림 안 밝기 하위(최저+0.08 이내) 비율 → 큰 어두운 덩어리 = 뭉개짐
    lo = float((L[op] <= L[op].min() + 0.08).sum()) / n
    # 깜빡임: 이웃 프레임끼리 불투명 영역 IoU 의 1 - 평균, 겹친 곳 중 색이 바뀐(>40) 비율의 평균
    ious, chg = [], []
    for i in range(frames - 1):
        A = op[:, i * fw:(i + 1) * fw]; B = op[:, (i + 1) * fw:(i + 2) * fw]
        u = (A | B).sum()
        if u: ious.append((A & B).sum() / u)
        both = A & B
        if both.sum(): chg.append(float((np.abs(rgb[:, i * fw:(i + 1) * fw] - rgb[:, (i + 1) * fw:(i + 2) * fw]).max(-1)[both] > 40).mean()))
    flick = round(1 - float(np.mean(ious)), 3) if ious else 0
    churn = round(float(np.mean(chg)), 3) if chg else 0
    return dict(low=round(lo, 3), flick=flick, churn=churn, edge=round(edge, 3), lone=round(lone, 3), dark=round(dark, 3), inkrim=round(inkrim, 3),
                crumbs=round(crumbs, 2), colors=nc, near=round(near, 3), lrange=round(float(p95 - p5), 3), fill=round(n / op.size, 3), _n=n)


import re, subprocess, tempfile, sys as _s
SCR = os.environ.get('QA_TMP') or tempfile.mkdtemp()
def opts():
    o = {}
    for f in glob.glob(os.path.join(ROOT, 'src/**/*.js'), recursive=True):
        for m in re.finditer(r'\b([a-z]+[0-9]+[a-z]?): \{([^}]*frames: ?[0-9]+[^}]*)\}', open(f, encoding='utf8').read()):
            body = m.group(2); d = {'frames': int(re.search(r'frames: ?(\d+)', body).group(1))}
            for k in ('soft', 'keepInk'):
                if re.search(k + r': ?true', body): d[k] = True
            ic = re.search(r"inkColor: ?'([^']+)'", body)
            if ic: d['inkColor'] = ic.group(1)
            o[m.group(1)] = d
    return o
OPTS = opts()
USE = json.load(open(os.path.join(ROOT, 'dev/review/vfx-audit-usage.json')))
CLASS = '#4da6ff'   # 직업색 시트를 칠해 볼 대표 색
OLD_RAW = {'k22': True, 'k37': True}

def render(items):
    # items: [(key, png, opts, color)] → {key: (raw RGBA, 로더 거친 RGBA)}
    jobs, res = [], {}
    for i, (key, png, o, color) in enumerate(items):
        im = np.asarray(Image.open(png).convert('RGBA')); h, w = im.shape[:2]
        a, b = os.path.join(SCR, f'{i}.in.rgba'), os.path.join(SCR, f'{i}.out.rgba')
        open(a, 'wb').write(im.tobytes()); jobs.append(dict(id=key, **{'in': a}, out=b, w=w, h=h, opts=o, color=color)); res[key] = (im, None, b)
    jf = os.path.join(SCR, 'job.json'); json.dump(jobs, open(jf, 'w'))
    subprocess.run(['node', os.path.join(ROOT, 'dev/pixel-qa/render.js'), jf], check=True)
    return {k: (im, np.frombuffer(open(b, 'rb').read(), np.uint8).reshape(im.shape)) for k, (im, _, b) in res.items()}

def save_png(arr, path): Image.fromarray(arr).save(path)

items = []
for k in ('k22', 'e18', 'e14', 'k36', 'k32', 'k37'):
    col = 'raw' if OLD_RAW.get(k) else CLASS
    items.append(('old/' + k, os.path.join(ROOT, 'dev/vfx5/old', k + '.png'), OPTS.get(k, {'frames': 5}), col))
for k, o in sorted(OPTS.items()):
    f = os.path.join(ROOT, 'src/vfx', k + '.png')
    if os.path.exists(f): items.append(('vfx/' + k, f, o, 'raw' if USE.get(k, {}).get('raw') else CLASS))
R = render(items)
outdir = os.path.join(ROOT, 'dev/review/pixel-qa/rendered'); os.makedirs(outdir, exist_ok=True)
out = {}
for key, (raw, ren) in R.items():
    fr = OPTS.get(key.split('/')[1], {'frames': 5})['frames']
    mr = metrics_arr(raw, fr); mg = metrics_arr(ren, fr)
    if not mr or not mg: continue
    mg['strip'] = round(1 - mg['_n'] / mr['_n'], 3)
    for m in (mr, mg): m.pop('_n')
    out[key] = dict(raw=mr, game=mg, frames=fr)
    if key.split('/')[1] in ('k22', 'e18', 'e14', 'k36', 'k32', 'k37'): save_png(ren, os.path.join(outdir, key.replace('/', '-') + '.png'))
json.dump(out, sys.stdout, ensure_ascii=False, indent=0)
