# 도트 품질 검수 0~2단 (스펙 docs/specs/pixel-qa.md): 게임 모습 만들기 → 규격 검사 → 자동 지표 → 검수 시트 PNG
#   python3 dev/pixel-qa/qa.py <시트.png> --id k22 [--color raw|#rrggbb] [--frames 5] [--scale 2] [--tile] [--intent "목표 모습"] [--out 폴더]
#   --scale: 게임에서 그리는 배율(2/3·1·4/3·2) — 장면 줄에서 기사 옆 크기를 맞춘다
#   --id 가 등록된 시트면 frames·soft·keepInk·inkColor 와 원래 색 여부를 src/ 에서 읽는다. --color 로 덮어쓴다.
# 결과: <out>/sheet.png (비평용 검수 시트), <out>/game.png (게임 모습 1배), <out>/metrics.json
# 3단 비평은 세션이 pixel-critic 서브에이전트(.claude/agents/pixel-critic.md)에 sheet.png + metrics.json 을 넘겨서 한다.
import sys, os, re, glob, json, argparse, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
CLASS = '#4da6ff'   # 직업색 시트를 칠해 볼 대표 색 (--color 가 없을 때)
KNIGHT = os.path.join(ROOT, 'dev/comfy/ref/squire-fight.png')   # 견습 기사 30×35 (1도트 = VFX 1도트)
BG_DARK, BG_FIELD = (17, 20, 28), (74, 98, 62)

# 경보 기준 (1차, VFX — 확정 시트 170장 분포에서. 사용자 판정이 쌓이면 다시 잡는다)
FLAGS = {
    'crumbs': (lambda g: g['crumbs'] > 5.2, '부스러기 덩어리가 많다 (프레임당 > 5.2)'),
    'strip': (lambda g: g['strip'] > 0.6, '로더가 그림 대부분을 벗겨 낸다 (> 60%)'),
    'lrange': (lambda g: g['lrange'] < 0.25, '밝기 폭이 좁아 한 덩어리로 뭉개진다 (< 0.25)'),
    'colors': (lambda g: g['colors'] > 24, '색이 너무 많다 — AI 흐림 계조·잡색 (> 24)'),
}


def sheet_opts():
    """src/ 에 등록된 시트 옵션 {id: {frames, soft?, keepInk?, inkColor?}}"""
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


def usage_raw():
    p = os.path.join(ROOT, 'dev/review/vfx-audit-usage.json')
    return {k: v.get('raw', False) for k, v in json.load(open(p)).items()} if os.path.exists(p) else {}


def render(items, tmp=None):
    """⓪ 게임 모습: items [(key, RGBA 배열, opts, color)] → {key: 로더·칠하기를 거친 RGBA 배열}. src/vfx-tex.js 를 그대로 돌린다"""
    tmp = tmp or tempfile.mkdtemp()
    jobs = []
    for i, (key, im, o, color) in enumerate(items):
        h, w = im.shape[:2]; a, b = os.path.join(tmp, f'{i}.in.rgba'), os.path.join(tmp, f'{i}.out.rgba')
        open(a, 'wb').write(np.ascontiguousarray(im, np.uint8).tobytes())
        jobs.append({'id': key, 'in': a, 'out': b, 'w': w, 'h': h, 'opts': o, 'color': color})
    jf = os.path.join(tmp, 'job.json'); json.dump(jobs, open(jf, 'w'))
    subprocess.run(['node', os.path.join(ROOT, 'dev/pixel-qa/render.js'), jf], check=True)
    return {j['id']: np.frombuffer(open(j['out'], 'rb').read(), np.uint8).reshape(j['h'], j['w'], 4).copy() for j in jobs}


def luma(rgb):
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255


def comps(mask):
    """8방향 연결 덩어리 크기 목록"""
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


def metrics(arr, frames=5):
    """② 자동 지표 (게임 모습 배열에 쓴다). 불투명 픽셀이 없으면 None"""
    im = arr.astype(np.int32); op = im[..., 3] >= 128; rgb = im[..., :3]; n = int(op.sum())
    if n == 0: return None
    L = luma(rgb); H, W = op.shape; fw = W // frames
    # 지글거림: 이웃(오른쪽·아래) 불투명 쌍 중 색 차 > 40
    e = t = 0
    for s0, s1 in (((slice(None), slice(None, -1)), (slice(None), slice(1, None))), ((slice(None, -1), slice(None)), (slice(1, None), slice(None)))):
        m = op[s0] & op[s1]; e += int((np.abs(rgb[s0] - rgb[s1]).max(-1)[m] > 40).sum()); t += int(m.sum())
    pad = np.pad(rgb, ((1, 1), (1, 1), (0, 0))); pop = np.pad(op, 1); sim = np.zeros(op.shape, bool)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nb = pad[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx]; nop = pop[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx]
        sim |= nop & (np.abs(nb - rgb).max(-1) <= 24)
    fr, ious, chg, area = [], [], [], []
    for i in range(frames):
        A = op[:, i * fw:(i + 1) * fw]; s = comps(A); fr.append(sum(1 for c in s if c <= 4)); area.append(int(A.sum()))
        if i < frames - 1:
            B = op[:, (i + 1) * fw:(i + 2) * fw]; u = (A | B).sum()
            if u: ious.append((A & B).sum() / u)
            both = A & B
            if both.sum(): chg.append(float((np.abs(rgb[:, i * fw:(i + 1) * fw] - rgb[:, (i + 1) * fw:(i + 2) * fw]).max(-1)[both] > 40).mean()))
    p5, p95 = np.percentile(L[op], [5, 95])
    return dict(
        crumbs=round(sum(fr) / frames, 2), lrange=round(float(p95 - p5), 3), colors=int(len(np.unique(rgb[op], axis=0))),
        low=round(float((L[op] <= L[op].min() + 0.08).sum()) / n, 3), edge=round(e / max(1, t), 3), lone=round(float((op & ~sim).sum()) / n, 3),
        flick=round(1 - float(np.mean(ious)), 3) if ious else 0, churn=round(float(np.mean(chg)), 3) if chg else 0,
        fill=round(n / op.size, 3), area=area, _n=n)


def gates(raw, game, frames, tile=False):
    """① 규격 검사 → (불통 목록, 주의 목록)"""
    fail, warn = [], []
    H, W = raw.shape[:2]
    if W % frames: fail.append(f'가로 {W} 가 프레임 {frames} 개로 나누어 떨어지지 않는다')
    fw = W // frames; a = raw[..., 3]
    semi = int(((a > 0) & (a < 255)).sum()); opq = int((a >= 24).sum())
    if opq and semi / opq > 0.02: warn.append(f'반투명 픽셀 {semi}개 ({semi / opq:.0%}) — 로더는 알파 24 이상을 불투명으로 그린다')
    gop = game[..., 3] >= 128
    for i in range(frames):
        c = gop[:, i * fw:(i + 1) * fw]
        if not c.any():
            if i == frames - 1 and frames > 1: warn.append(f'마지막({i + 1}번) 프레임이 게임 모습에서 비었다 — 사라지는 끝이면 괜찮지만 재생 시간 1/{frames} 동안 아무것도 안 보인다')
            else: fail.append(f'{i + 1}번 프레임이 게임 모습에서 비었다')
        elif not tile:
            sides = [('왼쪽', c[:, 0]), ('오른쪽', c[:, -1]), ('위', c[0, :])]
            hit = [s for s, v in sides if v.sum() >= 3]
            if hit: warn.append(f'{i + 1}번 프레임이 칸 {"·".join(hit)} 가장자리에 닿는다 (잘림?)')
    rn = int((raw[..., 3] >= 24).sum()); gn = int(gop.sum())
    strip = 1 - gn / rn if rn else 0
    if tile:
        for i in range(frames):
            c = game[:, i * fw:(i + 1) * fw].astype(int)
            d = np.abs(c[:, 0] - c[:, -1]).max(-1); m = (c[:, 0, 3] >= 128) | (c[:, -1, 3] >= 128)
            if m.any() and (d[m] > 40).mean() > 0.25: fail.append(f'{i + 1}번 프레임 좌우 끝 열이 이어지지 않는다 (타일 이음매)')
    return fail, warn, round(strip, 3)


def checker(w, h, a=BG_DARK, b=(26, 30, 40), s=4):
    yy, xx = np.mgrid[0:h, 0:w]; m = ((xx // s + yy // s) % 2).astype(bool)
    out = np.empty((h, w, 4), np.uint8); out[..., :3] = a; out[m, :3] = b; out[..., 3] = 255
    return Image.fromarray(out)


def qa_sheet(game, frames, knight=KNIGHT, scale=1.0):
    """비평용 검수 시트: ①1배 ②4배 프레임 나열(어두운 체크) ③4배 흑백 ④기사 옆 장면(가장 큰 프레임, 어두운 필드·풀밭) 3배"""
    H, W = game.shape[:2]; fw = W // frames; g = Image.fromarray(game)
    fr = [g.crop((i * fw, 0, (i + 1) * fw, H)) for i in range(frames)]
    sc = 4 if fw * frames * 4 + (frames + 1) * 8 <= 1400 else 3 if fw * frames * 3 <= 1400 else 2
    gap = 8; rowW = frames * fw * sc + (frames + 1) * gap
    gray = [Image.merge('RGBA', (*[f.convert('L')] * 3, f.getchannel('A'))) for f in fr]
    big = int(np.argmax([np.asarray(f)[..., 3].astype(bool).sum() for f in fr]))
    kn = Image.open(knight).convert('RGBA') if os.path.exists(knight) else None
    kw, kh = (kn.size if kn else (0, 0))
    bf = fr[big] if scale == 1 else fr[big].resize((max(1, round(fw * scale)), max(1, round(H * scale))), Image.NEAREST)
    sw, sh = kw + 6 + bf.width, max(kh, bf.height) + 6
    s3 = 3
    rows = []
    # ① 1배
    r = Image.new('RGBA', (W + 2 * gap, H + 2 * gap), BG_DARK + (255,)); r.alpha_composite(g, (gap, gap)); rows.append(('1x game', r))
    for label, fs in (('frames x%d' % sc, fr), ('grayscale x%d' % sc, gray)):
        r = checker(rowW, H * sc + 2 * gap)
        for i, f in enumerate(fs):
            r.alpha_composite(f.resize((fw * sc, H * sc), Image.NEAREST), (gap + i * (fw * sc + gap), gap))
        rows.append((label, r))
    # ④ 장면: 기사(왼쪽, 바닥 맞춤) + 가장 큰 프레임
    scene = Image.new('RGBA', (2 * (sw * s3) + 3 * gap, sh * s3 + 2 * gap), (12, 12, 16, 255))
    for k, bg in enumerate((BG_DARK, BG_FIELD)):
        sc_im = Image.new('RGBA', (sw, sh), bg + (255,))
        if kn: sc_im.alpha_composite(kn, (2, sh - kh - 3))
        sc_im.alpha_composite(bf, (kw + 4, (sh - bf.height) // 2))
        scene.alpha_composite(sc_im.resize((sw * s3, sh * s3), Image.NEAREST), (gap + k * (sw * s3 + gap), gap))
    rows.append((f'scene x{s3} (frame {big + 1} at game scale {scale:g}, knight 30x35)', scene))
    out = Image.new('RGBA', (max(r.width for _, r in rows) + 16, sum(r.height + 18 for _, r in rows) + 8), (8, 9, 12, 255))
    d = ImageDraw.Draw(out); y = 4
    for label, r in rows:
        d.text((8, y), label, fill=(170, 170, 190, 255)); y += 14
        out.alpha_composite(r, (8, y)); y += r.height + 4
    return out


def run(png, sid=None, color=None, frames=None, tile=False, intent='', out=None, opts=None, raw_flag=None, tmp=None, scale=1.0):
    opts = dict(opts or sheet_opts().get(sid, {}))
    if frames: opts['frames'] = frames
    opts.setdefault('frames', 5); fr = opts['frames']
    if color is None:
        rf = raw_flag if raw_flag is not None else usage_raw().get(sid, False)
        color = 'raw' if rf else CLASS
    raw = np.asarray(Image.open(png).convert('RGBA')).copy()
    game = render([('x', raw, opts, color)], tmp)['x']
    fail, warn, strip = gates(raw, game, fr, tile)
    m = metrics(game, fr) or {}
    if m: m.pop('_n'); m['strip'] = strip
    flags = [{'k': k, 'why': why} for k, (f, why) in FLAGS.items() if m and f(m)]
    res = dict(id=sid, file=os.path.relpath(png, ROOT), frames=fr, color=color, size=list(raw.shape[1::-1]), scale=scale, intent=intent,
               gate={'pass': not fail, 'fail': fail, 'warn': warn}, metrics=m, flags=flags)
    if out:
        os.makedirs(out, exist_ok=True)
        Image.fromarray(game).save(os.path.join(out, 'game.png'))
        qa_sheet(game, fr, scale=scale).save(os.path.join(out, 'sheet.png'))
        json.dump(res, open(os.path.join(out, 'metrics.json'), 'w'), ensure_ascii=False, indent=1)
    return res, game


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('png'); ap.add_argument('--id'); ap.add_argument('--color'); ap.add_argument('--frames', type=int)
    ap.add_argument('--tile', action='store_true'); ap.add_argument('--intent', default=''); ap.add_argument('--out'); ap.add_argument('--scale', type=float, default=1.0)
    a = ap.parse_args()
    sid = a.id or os.path.splitext(os.path.basename(a.png))[0]
    res, _ = run(a.png, sid, a.color, a.frames, a.tile, a.intent, a.out or os.path.join(ROOT, 'dev/pixel-qa/out', sid), scale=a.scale)
    print(json.dumps(res, ensure_ascii=False, indent=1))
