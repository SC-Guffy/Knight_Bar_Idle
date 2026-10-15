# 부위 가르기 (마네킹·입히기 공용). 캡처 3장(전체·몸 한 색·무기만, 96칸 발 (48,88))에서 픽셀마다 부위 이름.
#  띠는 땅에서 잰다 (기존 기사는 다리 높이가 같다): 투구 = 땅-19 위, 몸통 = 그 아래 ~ 땅-5, 그 아래 바지, 맨 아래 3줄 장화.
#  무기 옆 1칸 안의 몸 = 장갑. 외곽선(아주 어두운 색)은 'line'.
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_C = (0x0b, 0x0d, 0x14, 255)
lum = lambda c: c[0] * .3 + c[1] * .59 + c[2] * .11
PARTS = ['helm', 'torso', 'legs', 'boots', 'glove', 'blade']


def cap(name, full='guard'):
    """(전체, 몸 한 색, 무기만). full='noacc' 면 방패·망토를 뺀 그림을 전체로"""
    R = lambda k: Image.open(os.path.join(HERE, 'ref', f'{name}-{k}.png')).convert('RGBA')
    return R(full), R('body'), R('wpn')


def diff_mask(a, b):
    """두 캡처가 다른 칸 (a 에만 있는 소품: 방패·망토)"""
    A, B = a.load(), b.load()
    return {(x, y) for y in range(a.height) for x in range(a.width) if A[x, y][3] and A[x, y] != B[x, y]}


def bands(full):
    ground = full.getbbox()[3] - 1
    return ground - 19, ground - 5, ground


def parts(full, body, wpn):
    W, H = full.size; F, B, P = full.load(), body.load(), wpn.load()
    neck, belt, ground = bands(full)
    part = {}
    for y in range(H):
        for x in range(W):
            c = F[x, y]
            if c[3] == 0: continue
            if lum(c) < 24: part[x, y] = 'line'; continue
            if not B[x, y][3]: part[x, y] = 'blade'; continue
            near_w = any(P[x + dx, y + dy][3] and not B[x + dx, y + dy][3] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if 0 <= x + dx < W and 0 <= y + dy < H)
            if near_w and y < belt: part[x, y] = 'glove'
            elif y < neck: part[x, y] = 'helm'
            elif y < belt: part[x, y] = 'torso'
            elif y > ground - 3: part[x, y] = 'boots'
            else: part[x, y] = 'legs'
    return part
