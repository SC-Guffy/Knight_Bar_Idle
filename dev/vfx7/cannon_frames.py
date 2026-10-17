# F28 공성포: 통 그림 키(raw/f28-whole.png, 48×32, 포구 왼쪽 위) → 좌우 뒤집어 포구를 오른쪽으로 → 11줄 위 = 포신, 아래 = 차대
#  프레임 0 = 차대 (48×24, 바닥 맞춤), 프레임 1 = 포신 (48×24, 세로 가운데). 포신은 시트 안에서 오른쪽 위로 약 13° 들려 있다 (코드가 빼고 돌린다)
import sys, numpy as np
from PIL import Image
k = np.array(Image.open('raw/f28-whole.png').convert('RGBA'))[:, ::-1]
SPLIT = 11
barrel, cart = k[:SPLIT], k[SPLIT:]
out = np.zeros((24, 96, 4), np.uint8)
out[24 - cart.shape[0]:, :48] = cart
oy = (24 - barrel.shape[0]) // 2
out[oy:oy + barrel.shape[0], 48:] = barrel
Image.fromarray(out, 'RGBA').save('raw/f28-strip.png')
ys, xs = np.nonzero(barrel[..., 3]); print('barrel rows', oy, oy + barrel.shape[0], 'x', xs.min(), xs.max())
