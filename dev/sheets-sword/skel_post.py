# 스켈레톤 시험 후처리: 192칸 결과 → 가는 선(모델이 그린 칼) 지우기 → 2×2 칸 최빈색으로 96칸 → 성기사 팔레트 고정·외곽선 → 손목 좌표에 성검 덧그리기
#  python -I -B skel_post.py → skel/A96-*.png (덧그림), skel/B96-*.png, skel/C96-*.png(③ 기존 4f), 비교 몽타주·GIF → dev/review/sheets-sword/skel-*
import os, sys, json, math
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'boxer', 'sheets')); sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
import dress as D
import skel as SKL
from common import tidy
from wpn import overlay
SK = os.path.join(HERE, 'skel'); RV = os.path.join(ROOT, 'dev', 'review', 'sheets-sword')
PAL = D.palette_of(Image.open(os.path.join(HERE, 'out', 'paladin-orig.png')).convert('RGBA'))


def thin_off(im, win=2, need=10):
    """가는 선(칼 1~2칸) 지우기: (2·win+1)² 창 안 칠한 칸이 need 개 미만이면 지운다 — 몸은 두껍게 남는다"""
    P = im.load(); W, H = im.size; o = im.copy(); O = o.load()
    for y in range(H):
        for x in range(W):
            if not P[x, y][3]: continue
            n = sum(1 for a in range(-win, win + 1) for b in range(-win, win + 1) if 0 <= x + a < W and 0 <= y + b < H and P[x + a, y + b][3] >= 128)
            if n < need: O[x, y] = (0, 0, 0, 0)
    return o


def half(im):
    """2×2 → 1칸: 칠한 칸이 2개 이상이면 그중 최빈색 (평균 금지)"""
    W, H = im.size[0] // 2, im.size[1] // 2; P = im.load(); o = Image.new('RGBA', (W, H)); O = o.load()
    for y in range(H):
        for x in range(W):
            cs = [P[2 * x + a, 2 * y + b] for a in (0, 1) for b in (0, 1) if P[2 * x + a, 2 * y + b][3] >= 128]
            if len(cs) >= 2: O[x, y] = max(set(cs), key=cs.count)
    return o


def keep_main(im, minc=20):
    pts = {(x, y) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}
    cs = D.comps(pts); o = im.copy(); O = o.load()
    for c in cs:
        if len(c) < minc:
            for p in c: O[p] = (0, 0, 0, 0)
    return o


def gif(frames, path, S, fps):
    fr = []
    for f in frames:
        b = Image.new('RGBA', f.size, (0x14, 0x16, 0x1d, 255)); b.alpha_composite(f); fr.append(b.convert('RGB').resize((f.width * S, f.height * S), Image.NEAREST))
    fr[0].save(path, save_all=True, append_images=fr[1:], duration=round(1000 / fps), loop=0, disposal=1)


if __name__ == '__main__':
    ws = D.weapon_sprite('paladin', 96)
    angs = json.load(open(os.path.join(SK, 'angles-A.json')))
    A = []
    for i, (p, a) in enumerate(SKL.FRAMES):
        im = Image.open(os.path.join(HERE, 'work', 'paladin', f'skelA-{i}.png')).convert('RGBA')
        im = keep_main(thin_off(im), 40)
        im = tidy(half(im), PAL, minc=6)
        g = (p['RIGHT ARM'][0] / 2, p['RIGHT ARM'][1] / 2); r = math.radians(angs[i])
        im = overlay(im, set(), g, (g[0] + 10 * math.cos(r), g[1] + 10 * math.sin(r)), ws, line=False)
        im = tidy(im, PAL, minc=6)
        im.save(os.path.join(SK, f'A96-{i}.png')); A.append(im)
    B = []
    for i in range(1, 9):
        im = Image.open(os.path.join(HERE, 'work', 'paladin', f'textB-{i}.png')).convert('RGBA')
        im = tidy(half(im), PAL, minc=6); im.save(os.path.join(SK, f'B96-{i}.png')); B.append(im)
    # ③ 기존 직접(96칸 4f, 1번 이펙트 프레임 뺌)
    C = []
    for i in (0, 2, 3, 4):
        im = Image.open(os.path.join(HERE, 'work', 'paladin', f'atkA-{i}.png')).convert('RGBA'); C.append(tidy(im, PAL, minc=6))
    base = Image.open(os.path.join(HERE, 'ref', 'paladin-guard.png')).convert('RGBA')
    os.makedirs(RV, exist_ok=True)
    crop = lambda f: f.crop((8, 6, 88, 92))           # 96칸에서 캐릭터·칼 들어가는 곳만
    for tag, fr in (('C', C), ('A', A), ('B', B)):
        gif([crop(f) for f in fr], os.path.join(RV, f'skel-{tag}-x4.gif'), 4, 8)       # 크게
        gif([crop(f) for f in fr], os.path.join(RV, f'skel-{tag}-x2.gif'), 2, 8)       # 게임에 가까운 크기 (1칸 = 화면 1.5px 의 약 1.3배)
        strip = Image.new('RGBA', ((80 + 4) * len(fr), 86), (0x14, 0x16, 0x1d, 255))
        for k, f in enumerate(fr): strip.alpha_composite(crop(f), (k * 84, 0))
        strip.resize((strip.width * 3, strip.height * 3), Image.NEAREST).save(os.path.join(RV, f'skel-{tag}-strip.png'))
    # 192칸 원본 (가공 전)
    for tag, files in (('Araw', [f'skelA-{i}.png' for i in range(8)]), ('Braw', [f'textB-{i}.png' for i in range(1, 9)])):
        fr = [Image.open(os.path.join(HERE, 'work', 'paladin', f)).convert('RGBA').crop((24, 12, 184, 184)) for f in files]
        strip = Image.new('RGBA', ((160 + 6) * len(fr), 172), (0x14, 0x16, 0x1d, 255))
        for k, f in enumerate(fr): strip.alpha_composite(f, (k * 166, 0))
        strip.resize((strip.width * 3 // 2, strip.height * 3 // 2), Image.NEAREST).save(os.path.join(RV, f'skel-{tag}.png'))
    for k in range(9):
        im = Image.open(os.path.join(SK, f'stick-{k}.png')); im.save(os.path.join(RV, f'skel-stick-{k}.png'))
    Image.open(os.path.join(SK, 'stick-all.png')).save(os.path.join(RV, 'skel-stick-all.png'))
    print('A', len(A), 'B', len(B), 'C', len(C))
