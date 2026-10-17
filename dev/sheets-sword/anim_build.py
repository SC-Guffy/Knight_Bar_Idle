# 2단계 키 자세 엮기 (cast2b = '고개 들기' 문구 빼고 다시 편집 — cast2 는 투구가 꺾임) (PixelLab 0): work/<cls>/<key>-0.png (pixen 편집) → 발 줄 59 맞춤 → 확정 그림 팔레트 고정 → 6프레임 띠·GIF
#  python -I -B anim_build.py → anim/<cls>-<act>-strip.png, anim/<cls>-<act>-x4.gif, anim/_build.png (전체 몽타주 3배)
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'anim')
JOBS = {
    ('paladin', 'cast'): (['src', 'cast1F', 'cast2b', 'cast2b', 'cast3', 'src'], [120, 140, 120, 200, 140, 140]),
    ('swordsman', 'atk'): (['src', 'key1', 'key2', 'key3', 'key3', 'src'], [120, 110, 70, 70, 160, 140]),
    ('swordsman', 'cast'): (['src', 'cast1', 'cast2b', 'cast2b', 'cast3', 'src'], [120, 140, 120, 200, 140, 140]),
    ('blademaster', 'atk'): (['src', 'key1', 'key2', 'key3', 'key3', 'src'], [120, 110, 70, 70, 160, 140]),
    ('blademaster', 'cast'): (['src', 'cast1', 'cast2', 'cast2', 'cast3', 'src'], [120, 140, 120, 200, 140, 140]),
    # 대검전사 평타: key3(내려찍기)는 칼끝이 떨어져 보여(비평 s3 A·B 수리) 스크립트로 못 이음 → 로드맵 대안 '좋은 프레임만': 타격 자리에 cast3(앞으로 휘둘러 뻗음)
    ('greatswordsman', 'atk'): (['src', 'key1', 'key2', 'key3c', 'key3c', 'src'], [140, 120, 80, 70, 180, 150]),   # 4단계: key3b(칼이 뒤로 끌림, 비평 미달) → key3c(칼끝 앞 오른쪽 아래 명시)
    ('greatswordsman', 'cast'): (['src', 'cast1', 'cast2', 'cast2', 'cast3', 'src'], [120, 140, 120, 200, 140, 140]),
    # 걷기: 성기사 walk1 은 작고 모양이 달라 빼고, 대검전사 walk2 는 대검이 앞뒤로 튀어 빼서 두 자세를 번갈아
    ('paladin', 'walk'): (['walk2', 'walk3', 'walk2', 'walk3'], [125, 125, 125, 125]),
    ('swordsman', 'walk'): (['walk1', 'walk2', 'walk3', 'walk2'], [125, 125, 125, 125]),
    ('blademaster', 'walk'): (['walk1', 'walk2', 'walk3', 'walk2'], [125, 125, 125, 125]),
    ('greatswordsman', 'walk'): (['walk1', 'walk3', 'walk1', 'walk3'], [125, 125, 125, 125]),
    ('squire', 'atk'): (['key4', 'key1', 'key2', 'key3', 'key3', 'key4'],   # 7단계: 준비 = key4 (확정 그림은 pixen 화풍과 달라 튐)
    [120, 110, 70, 70, 160, 140]),
    ('squire', 'cast'): (['key4', 'cast1r', 'cast2', 'cast2', 'cast3', 'key4'],
    [120, 140, 120, 200, 140, 140]),
    ('squire', 'walk'): (['walkA', 'walkB', 'walkC', 'walkB'], [125, 125, 125, 125]),
    ('tyrant', 'atk'): (['src', 'key1', 'key2r', 'key3', 'key3', 'src'],
    [120, 110, 70, 70, 160, 140]),
    ('tyrant', 'cast'): (['src', 'cast2r', 'cast3', 'src'], [140, 260, 160, 140]) if True else (None,   # 짧은 판: 2~4 가 같은 그림(비평 s6)
   
    [120, 140, 120, 200, 140, 140]),
    ('tyrant', 'walk'): (['walkA', 'walkB', 'walkC', 'walkB'], [125, 125, 125, 125]),
    ('archon', 'atk'): (['src', 'key1', 'key3r', 'key3r', 'src'], [120, 140, 70, 180, 140]) if True else (None,   # 짧은 판: key2r 좌우 뒤집힘(비평 s6) 뺌
   
    [120, 110, 70, 70, 160, 140]),
    ('archon', 'cast'): (['src', 'cast2', 'cast2', 'cast3', 'src'], [120, 160, 200, 140, 140]),   # 7단계: cast1≈cast2 라 뺌
    ('archon', 'walk'): (['walkA', 'walkB', 'walkC', 'walkB'], [125, 125, 125, 125]),
    # 5단계 걷기 재도전 (무기·투구 고정 문구): 성기사·검성·대검전사 → <cls>-walk2-strip.png
    ('paladin', 'walk2'): (['walkA', 'walkB', 'walkC', 'walkB'], [125, 125, 125, 125]),
    ('blademaster', 'walk2'): (['walkA', 'walkB', 'walkC', 'walkB'], [125, 125, 125, 125]),
    ('greatswordsman', 'walk2'): (['walkA', 'walkB', 'walkC', 'walkB'], [125, 125, 125, 125]),
    # 검신 짧은 판 (비평 s7: 준비 그림 비례가 키 자세와 다름·key2/cast1/cast2 칼이 떠 있음·이중 칼날): 준비 = key4, 떠 있는 자세 뺌
    ('swordsaint', 'atk'): (['key4', 'key1', 'key3', 'key3', 'key4'], [130, 120, 80, 180, 140]),
    ('swordsaint', 'cast'): (['key4', 'key1', 'cast3', 'cast3', 'key4'], [130, 160, 90, 200, 140]),
    ('swordsaint', 'walk'): (['walkA', 'walkB', 'walkC', 'walkB'], [125, 125, 125, 125]),
    # 8단계 걷기 재도전 (다리만·무기 고정, 시드 23): <cls>-walk3-strip.png  (walkF → walkG 복사: 이름 끝 F 는 좌우 반전 표시라서)
    ('paladin', 'walk3'): (['walkD', 'walkE', 'walkH', 'walkE'],   # 9단계: walkG(칼이 위로 튐) → walkH
    [125, 125, 125, 125]),
    ('squire', 'walk3'): (['walkD', 'walkH', 'walkG', 'walkE'],   # 9단계: 통과 자세 walkH 추가 (2포즈 반복 → 4포즈)
    [125, 125, 125, 125]),
    ('archon', 'walk3'): (['walkD', 'walkE', 'walkG', 'walkE'], [125, 125, 125, 125]),
    ('tyrant', 'walk3'): (['walkD', 'walkE', 'walkG', 'walkE'], [125, 125, 125, 125]),
}
ONLY = [a for a in __import__('sys').argv[1:]]


def load(cls, k):
    if k.endswith('F'):                     # pixen 이 왼쪽을 보게 그린 프레임(성기사 cast1) → 좌우 반전
        return load(cls, k[:-1]).transpose(Image.FLIP_LEFT_RIGHT)
    p = os.path.join(A, f'{cls}64-src.png') if k == 'src' else os.path.join(HERE, 'work', cls, f'{k}-0.png')
    im = Image.open(p).convert('RGBA'); P = im.load(); yb = max(y for y in range(64) if any(P[x, y][3] for x in range(64)))
    o = Image.new('RGBA', (64, 64)); o.alpha_composite(im, (0, 59 - yb)); return o


def solo(im, minc=40):
    """몸에서 떨어진 작은 덩어리(대검전사 key3 의 떠 있는 칼끝 조각 — 비평 s3 A) 지우기"""
    P = im.load(); pts = {(x, y) for y in range(64) for x in range(64) if P[x, y][3]}; comps = []
    while pts:
        st = [pts.pop()]; c = set(st)
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in pts: pts.discard(q); c.add(q); st.append(q)
        comps.append(c)
    big = max(comps, key=len)
    for c in comps:
        if c is not big and len(c) < minc:
            for p in c: P[p] = (0, 0, 0, 0)
    return im


def lock(im, pal):
    P = im.load()
    for y in range(64):
        for x in range(64):
            c = P[x, y]
            if c[3]: P[x, y] = min(pal, key=lambda q: sum((c[i] - q[i]) ** 2 for i in range(3)))[:3] + (255,)
    return im


if __name__ == '__main__':
    rows = []
    for (cls, act), (seq, dur) in JOBS.items():
        if ONLY and cls not in ONLY and act not in ONLY: continue
        if act == 'walk' and cls in ('paladin', 'squire', 'archon', 'tyrant', 'swordsaint'): continue   # 걷기 미달 → 임시 걷기: 띠를 다시 만들지 않는다 (시트가 <cls>-walk-strip.png 를 쓰므로)
        if not all(k == 'src' or os.path.exists(os.path.join(HERE, 'work', cls, f'{k.rstrip("F")}-0.png')) or k in ('keyC3s', 'srcL') for k in seq):
            print('skip', cls, act); continue
        src = load(cls, 'src'); pal = sorted({c for c in src.getdata() if c[3]})
        if len(pal) > 24:                   # 검사 확정 그림은 43색 → 22색으로 줄인 팔레트로 고정 (qa colors 경보)
            q = src.convert('RGB').quantize(colors=22, method=Image.Quantize.MEDIANCUT).convert('RGB')
            pal = sorted({q.getpixel((x, y)) + (255,) for y in range(64) for x in range(64) if src.getpixel((x, y))[3]})
        fr = [lock(load(cls, k), pal) for k in seq]      # solo() 는 대검전사 key3 에서 칼날 판을 지워 버려 안 씀
        strip = Image.new('RGBA', (64 * len(fr), 64)); [strip.alpha_composite(f, (64 * i, 0)) for i, f in enumerate(fr)]
        strip.save(os.path.join(A, f'{cls}-{act}-strip.png')); rows.append(strip)
        g = []
        for f in fr:
            b = Image.new('RGBA', (64, 64), (38, 40, 50, 255)); b.alpha_composite(f); g.append(b.convert('RGB').resize((256, 256), Image.NEAREST))
        g[0].save(os.path.join(A, f'{cls}-{act}-x4.gif'), save_all=True, append_images=g[1:], duration=dur, loop=0)
    m = Image.new('RGBA', (64 * 6, 64 * len(rows)), (38, 40, 50, 255))
    for i, r in enumerate(rows): m.alpha_composite(r, (0, 64 * i))
    m.resize((m.width * 3, m.height * 3), Image.NEAREST).save(os.path.join(A, '_build.png')); print('ok', len(rows))
