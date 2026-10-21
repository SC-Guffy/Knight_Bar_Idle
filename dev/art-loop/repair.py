# 수리 연산 (스펙 docs/specs/art-loop.md "수리 연산"): 원본 시트에 연산 목록을 차례로 적용해 새 판을 만든다. 무료·결정적.
#   python3 dev/art-loop/repair.py <in.png> <out.png> <frames> <ops.json>
#   ops.json: [{"op": "drop_crumbs", "n": 3}, {"op": "frames_order", "order": [5,6,0,1,2,3,4]}, ...]   (프레임 번호는 0부터)
# 연산은 원본 시트(로더 전)에 쓴다. 게임 모습은 검수(qa.py)가 다시 만든다.
# 프레임 수는 기본으로 유지한다(시트 등록 frames: 를 안 바꾸게). 바꾸는 연산(frames_drop·dup)은 결과에 새 프레임 수를 적는다.
# workbench 연산만 네트워크를 쓴다(PixelLab pixelart_workbench, 구독 무료·결정적): 새 픽셀을 그려야 하는 손질(별·먼지 덩어리·파편).
import sys, os, json, re, base64, urllib.request
import numpy as np
from PIL import Image

A = 24   # 로더가 그리는 알파 문턱 (src/vfx-tex.js)
PATCH_MAX = 48   # workbench patch_pixels 상한 (점 몇 개 손질용 — 코드로 그리기 우회 방지)


def split(im, n):
    fw = im.shape[1] // n
    return [im[:, i * fw:(i + 1) * fw].copy() for i in range(n)]


def join(fr):
    return np.concatenate(fr, axis=1)


def luma(rgb):
    return (0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]) / 255


def comps(mask):
    """8방향 덩어리 → 라벨 목록 [(픽셀 좌표 배열)]"""
    H, W = mask.shape; seen = np.zeros(mask.shape, bool); out = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]: continue
        st = [(y, x)]; seen[y, x] = True; c = []
        while st:
            a, b = st.pop(); c.append((a, b))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    p, q = a + dy, b + dx
                    if 0 <= p < H and 0 <= q < W and mask[p, q] and not seen[p, q]:
                        seen[p, q] = True; st.append((p, q))
        out.append(np.array(c))
    return out


# ───── 연산 (프레임 하나 f: H×W×4 uint8 → 같은 모양) ─────
def drop_crumbs(f, n=3, keep_largest=True):
    """n 픽셀 이하 떨어진 덩어리를 지운다 (가장 큰 덩어리는 늘 남김)"""
    cs = comps(f[..., 3] >= A)
    if not cs: return f
    big = max(len(c) for c in cs)
    for c in cs:
        if len(c) <= n and not (keep_largest and len(c) == big): f[c[:, 0], c[:, 1], 3] = 0
    return f


def drop_isolated(f):
    return drop_crumbs(f, 1)


def lift_dark(f, t=0.3):
    """밝기 t 미만 불투명 픽셀을 색상은 두고 밝기 t 로 끌어올린다"""
    op = f[..., 3] >= A; rgb = f[..., :3].astype(float); L = luma(rgb)
    m = op & (L < t) & (L > 0)
    k = np.where(m, t / np.maximum(L, 1e-3), 1.0)[..., None]
    rgb = np.clip(rgb * k, 0, 255)
    z = op & (L == 0); rgb[z] = t * 255
    f[..., :3] = rgb.astype(np.uint8); return f


def quantize_all(fr, n=12):
    """시트 전체를 같은 n 색 팔레트로 (중앙값 분할, 투명은 그대로)"""
    sheet = join(fr); op = sheet[..., 3] >= A
    rgb = Image.fromarray(sheet[..., :3]); q = rgb.quantize(colors=n, method=Image.Quantize.MEDIANCUT).convert('RGB')
    out = sheet.copy(); qa = np.asarray(q); out[op, :3] = qa[op]; out[~op] = 0; out[op, 3] = 255
    return split(out, len(fr))


def recolor(f, src, dst, tol=40):
    """src 색(±tol) 픽셀을 dst 색으로"""
    s = np.array(src); d = np.array(dst)
    m = (f[..., 3] >= A) & (np.abs(f[..., :3].astype(int) - s).max(-1) <= tol)
    f[m, :3] = d; return f


def recolor_gray(f, dst, sat=24, lo=0.15, hi=0.7):
    """채도 낮은 회색 얼룩(채도 < sat, 밝기 lo~hi)을 dst 색 밝기에 맞춰 칠한다"""
    rgb = f[..., :3].astype(int); op = f[..., 3] >= A; L = luma(rgb)
    m = op & ((rgb.max(-1) - rgb.min(-1)) < sat) & (L >= lo) & (L <= hi)
    d = np.array(dst, float); dl = max(1e-3, luma(d[None, None, :])[0, 0])
    f[m, :3] = np.clip(d * (L[m] / dl)[:, None], 0, 255).astype(np.uint8); return f


def erode(f, k=1):
    """테두리를 k 겹 깎는다"""
    for _ in range(k):
        op = f[..., 3] >= A; p = np.pad(op, 1)
        inner = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        f[op & ~inner, 3] = 0
    return f


def anchor(f, where='bottom', margin=0):
    """그림을 칸 바닥(또는 가운데)에 붙인다"""
    op = f[..., 3] >= A
    if not op.any(): return f
    ys, xs = np.nonzero(op); H, W = op.shape; out = np.zeros_like(f)
    if where == 'bottom': dy = (H - 1 - margin) - ys.max(); dx = 0
    else: dy = (H - 1 - ys.max() - ys.min()) // 2; dx = (W - 1 - xs.max() - xs.min()) // 2
    y0, x0 = max(0, dy), max(0, dx); sy, sx = max(0, -dy), max(0, -dx)
    h, w = H - abs(dy), W - abs(dx)
    out[y0:y0 + h, x0:x0 + w] = f[sy:sy + h, sx:sx + w]; return out


def fade_tail(fr, k=1):
    """끝 프레임 k 장을 앞 프레임을 침식한 것으로 바꾼다 (프레임 수 유지): 마지막 = 그 앞 프레임을 2겹·4겹… 깎은 것"""
    n = len(fr); base = fr[n - k - 1]
    for i in range(k):
        e = erode(base.copy(), 2 * (i + 1)); e = drop_crumbs(e, 2, keep_largest=False)
        fr[n - k + i] = e
    return fr


def deink(f, to=None):
    """거의 검은 무채색(밝기 최대 < 48, 채도 < 28 — 로더가 외곽선으로 보는 색)을 to 색으로 바꾼다.
    로더는 이 픽셀을 벗기거나(가장자리) 둘레 색 평균으로 메워(안쪽) 흐린 계조를 만든다. to 가 없으면 그림에서 가장 어두운 '외곽선 아닌' 색"""
    rgb = f[..., :3].astype(int); op = f[..., 3] >= A; mx = rgb.max(-1); mn = rgb.min(-1)
    ink = op & (mx < 48) & (mx - mn < 28)
    if not ink.any(): return f
    if to is None:
        rest = rgb[op & ~ink]
        if not len(rest): return f
        to = rest[np.argmin(luma(rest.astype(float)))]
    f[ink, :3] = np.array(to); return f


def fill_holes(f, n=12):
    """그림 안에 갇힌 n 픽셀 이하 투명 구멍을 둘레 불투명 색 중 가장 흔한 색으로 메운다 (눈 같은 구멍)"""
    tr = f[..., 3] < A; H, W = tr.shape
    for c in comps(tr):
        if len(c) > n or (c[:, 0].min() == 0 or c[:, 1].min() == 0 or c[:, 0].max() == H - 1 or c[:, 1].max() == W - 1): continue
        cols = []
        for y, x in c:
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                p, q = y + dy, x + dx
                if 0 <= p < H and 0 <= q < W and not tr[p, q]: cols.append(tuple(f[p, q, :3]))
        if not cols: continue
        col = max(set(cols), key=cols.count)
        f[c[:, 0], c[:, 1], :3] = col; f[c[:, 0], c[:, 1], 3] = 255
    return f


def tile_seam(f):
    """루프 타일: 오른쪽 끝 열 = 왼쪽 끝 열"""
    f[:, -1] = f[:, 0]; return f


def workbench(fr, changes=None, cleanup=None):
    """PixelLab pixelart_workbench 로 시트를 고친다 (dev/pixellab/mcpw.py 로 MCP 호출, 무료).
    changes: `edit --changes` 연산 목록 (brush·patch_pixels·flood_fill·map_colors·copy_region·outline·select_mask — 계약은 workbench `describe edits`).
      좌표는 프레임 안 좌표(0부터), 각 연산의 frames·source_frame 도 이 파일 규칙대로 0부터 쓴다(여기서 1을 더해 넘긴다). layer·reason 은 없으면 채운다.
    cleanup: `repair --ops` 값 (예 "stray,holes") — workbench 의 결정적 정리.
    시트를 n×1 격자로 잘라 애니로 올리고, 결과 frames.png(격자)를 받아 다시 가로로 잇는다."""
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pixellab'))
    import mcpw, io
    n = len(fr); H, W = fr[0].shape[:2]; buf = io.BytesIO(); Image.fromarray(join(fr)).save(buf, 'PNG')

    def call(argv):
        r = mcpw.rpc('tools/call', {'name': 'pixelart_workbench', 'arguments': {'argv': argv}})
        txt = '\n'.join(c.get('text', '') for c in ((r or {}).get('result') or {}).get('content', []) if c.get('type') == 'text')
        m = re.search(r'image_id:\s*([0-9a-f-]{36})', txt)
        if not m or ((r or {}).get('result') or {}).get('isError'): raise RuntimeError('workbench 실패: ' + (txt or json.dumps(r, ensure_ascii=False))[:800])
        return m.group(1), txt

    npx = sum(len(c.get('pixels', [])) for c in (changes or []))
    if npx > PATCH_MAX: raise ValueError(f'workbench patch_pixels {npx}개 > {PATCH_MAX} — 스크립트로 픽셀 목록을 만들어 그리기를 우회하지 않는다 (붓·채우기·색 바꾸기·복사로)')
    mcpw.init()
    iid, _ = call(['split', 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(), '--grid', f'{n}x1'])
    if changes:
        ch = []
        for c in changes:
            c = dict(c); c.setdefault('layer', 'image'); c.setdefault('reason', 'art-loop 수리')
            c['frames'] = [i + 1 for i in c.get('frames', range(n))]
            if 'source_frame' in c: c['source_frame'] += 1
            ch.append(c)
        iid, _ = call(['edit', iid, '--changes', json.dumps(ch, ensure_ascii=False)])
    if cleanup: iid, _ = call(['repair', iid, '--ops', cleanup])
    raw = urllib.request.urlopen(f'https://api.pixellab.ai/mcp/pixel-tools/{iid}/frames.png', context=mcpw._CTX, timeout=120).read()
    g = np.asarray(Image.open(io.BytesIO(raw)).convert('RGBA')); cols = g.shape[1] // W
    out = [g[(i // cols) * H:(i // cols + 1) * H, (i % cols) * W:(i % cols + 1) * W].copy() for i in range(n)]
    if any(f.shape != fr[0].shape for f in out): raise RuntimeError('workbench 결과 크기가 다름')
    return out


PER_FRAME = {'drop_crumbs': drop_crumbs, 'drop_isolated': drop_isolated, 'lift_dark': lift_dark, 'recolor': recolor,
             'recolor_gray': recolor_gray, 'deink': deink, 'fill_holes': fill_holes, 'erode': erode, 'anchor': anchor, 'tile_seam': tile_seam}


def apply(sheet, n, ops):
    fr = split(sheet, n); log = []
    for o in ops:
        op = o['op']; args = {k: v for k, v in o.items() if k not in ('op', 'frames')}
        sel = o.get('frames')   # 일부 프레임에만 (번호 목록), 없으면 전부
        if op in PER_FRAME:
            for i in range(len(fr)):
                if sel is None or i in sel: fr[i] = PER_FRAME[op](fr[i], **args)
        elif op == 'quantize': fr = quantize_all(fr, **args)
        elif op == 'frames_order': fr = [fr[i].copy() for i in o['order']]   # 같은 번호를 두 번 써도 따로 고칠 수 있게 복사
        elif op == 'frames_drop': fr = [f for i, f in enumerate(fr) if i not in o['drop']]
        elif op == 'frames_dup': fr = sum(([f, f.copy()] if i in o['dup'] else [f] for i, f in enumerate(fr)), [])
        elif op == 'fade_tail': fr = fade_tail(fr, o.get('k', 1))
        elif op == 'frame_copy': fr[o['to']] = fr[o['src']].copy()
        elif op == 'workbench': fr = workbench(fr, o.get('changes'), o.get('cleanup'))
        else: raise ValueError('모르는 연산: ' + op)
        log.append(op)
    return join(fr), len(fr), log


if __name__ == '__main__':
    src, dst, n, opsf = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    sheet = np.asarray(Image.open(src).convert('RGBA')).copy()
    out, n2, log = apply(sheet, n, json.load(open(opsf, encoding='utf8')))
    Image.fromarray(out).save(dst)
    print(json.dumps({'out': dst, 'frames': n2, 'applied': log}, ensure_ascii=False))
