# 무기 원형 마네킹 (와이어프레임 시험, 로드맵 지시): 기존 스프라이트 대기 자세에서 직업 장식을 빼고 부위마다 다른 색으로 칠한다.
#  PixelLab 애니가 이 색을 유지하면 프레임마다 부위(투구·몸통·바지·장화·장갑·칼날)를 색으로 다시 가를 수 있다 → ComfyUI 로 직업 입히기.
#  입력 ref/<cls>-guard.png(전체) · -body.png(무기 뺀 몸, 한 색) · -wpn.png(무기만), 96칸 발 (48,88) → 출력 mq/<원형>.png (64 또는 96칸)
#  python -I mannequin.py
import os
from PIL import Image
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parts import cap, parts, lum, OUT_C
HERE = os.path.dirname(os.path.abspath(__file__))
R = lambda n: Image.open(os.path.join(HERE, 'ref', n + '.png')).convert('RGBA')
RAMP = {
    'helm': [(0x4a, 0x52, 0x60), (0x7d, 0x87, 0x98), (0xb8, 0xc0, 0xcc)],
    'torso': [(0x6a, 0x1f, 0x22), (0xa8, 0x32, 0x3a), (0xd9, 0x55, 0x5c)],
    'legs': [(0x22, 0x30, 0x5a), (0x3a, 0x4f, 0x8c), (0x5c, 0x75, 0xb8)],
    'boots': [(0x3a, 0x26, 0x18), (0x5e, 0x3e, 0x26), (0x86, 0x60, 0x3c)],
    'glove': [(0x8a, 0x6a, 0x2a), (0xc9, 0x9a, 0x3a), (0xec, 0xc7, 0x60)],
    'blade': [(0x8a, 0x96, 0xa8), (0xd0, 0xd8, 0xe4), (0xfa, 0xfc, 0xff)],
}
# 원형: (기준 직업, 칸, 투구 줄 수 보정)
ARCH = {'sword': ('mq-sword', 64), 'dual': ('mq-dual', 64), 'great': ('mq-great', 96)}   # 검사 몸(장식 없음)에 무기만 바꿔 끼운 캡처


def make(cls, N):
    full, body, wpn = cap(cls); F = full.load(); W, H = full.size
    part = parts(full, body, wpn)
    # 부위마다 원래 밝기 3단 → 램프
    o = Image.new('RGBA', (W, H)); O = o.load()
    groups = {}
    for p, k in part.items(): groups.setdefault(k, []).append(p)
    for k, ps in groups.items():
        if k == 'line':
            for p in ps: O[p] = OUT_C
            continue
        ls = sorted(lum(F[p]) for p in ps); t1, t2 = ls[len(ls) // 3], ls[2 * len(ls) // 3]
        for p in ps:
            L = lum(F[p]); i = 0 if L < t1 else 1 if L < t2 else 2
            O[p] = RAMP[k][i] + (255,)
    # 96칸 발 (48,88) → N칸 발 (N/2, N-6)
    fx, fy = N // 2, N - 6
    c = o.crop((48 - fx, 88 - fy, 48 - fx + N, 88 - fy + N))
    return c


if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, 'mq'), exist_ok=True)
    S = 6; tiles = []
    for s in (15, 30, 45, 70):   # 입히기 시험용 가짜 동작 프레임 (리그 평타, 최종에는 안 씀)
        make(f'mq-sword-s{s}', 96).save(os.path.join(HERE, 'mq', f'test-sword-s{s}.png'))
    for a, (cls, N) in ARCH.items():
        im = make(cls, N); im.save(os.path.join(HERE, 'mq', a + '.png'))
        orig = R(cls + '-guard').crop((48 - N // 2, 88 - (N - 6), 48 + N // 2, 88 + 6))
        tiles += [orig, im]
    pv = Image.new('RGBA', (sum(t.width * S for t in tiles) + 10 * len(tiles), 96 * S), (30, 33, 42, 255))
    x = 0
    for t in tiles:
        pv.alpha_composite(t.resize((t.width * S, t.height * S), Image.NEAREST), (x, 96 * S - t.height * S)); x += t.width * S + 10
    pv.save(os.path.join(HERE, 'mq', '_preview.png'))
