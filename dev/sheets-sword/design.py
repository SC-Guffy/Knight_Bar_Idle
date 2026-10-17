# 디자인 시안 (스펙 "기준 그림 = 새로 다시 그린 직업 디자인", PixelLab 0회): ComfyUI Z-Image + 픽셀 LoRA 로 성기사·검사를
#  그림체 방향 3가지(A 2.5등신 지금 비율 · B 3등신 · C 4등신 날렵)로 뽑고, 게임 크기(키 35 · 46 · 52px = 1 · 1.3 · 1.5배)로 줄인다.
#  실행 (ComfyUI 가상환경 파이썬, 서버 8188):
#    C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/sheets-sword/design.py gen [방향 ...]   → design/raw/<cls>-<방향>-<seed>.png (1024)
#    ... design.py shrink                                                                     → design/px/<cls>-<방향>-<seed>-h<키>.png
#  큐: 한 번에 8장 이하 (다른 세션과 GPU 공유)
import os, sys, json, time
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'comfy'))
D = os.path.join(HERE, 'design'); RAW = os.path.join(D, 'raw'); PX = os.path.join(D, 'px')
OUT_C = (0x0b, 0x0d, 0x14)

STYLE = ('Pixel art style. One single full-body 2D game character sprite, side view, facing right, standing in a ready combat stance, '
         '{who} {body} Plain flat light gray background, nothing else. Crisp clean hard pixels, bold dark outline, limited palette, '
         'clear readable silhouette, light from the upper right.')
WHO = {
    'paladin': 'A holy paladin knight in cream white and gold plate armor, a golden halo floating above a crested helmet with a visor, '
               'a gold kite shield with a cross on the left arm, a golden longsword in the right hand, a short white cape.',
    'swordsman': 'A swordsman knight in polished silver plate armor with a royal blue tabard, a blue plume on a visored helmet, '
                 'a short blue cape, a steel longsword in the right hand.',
}
WHO.update({
    'blademaster': 'A dual-wielding blade master in sleek black lacquered armor with crimson trim, a horned black helmet with a red eye slit, '
                   'a long red scarf flowing behind, a slim crimson katana in each hand.',
    'greatswordsman': 'A rugged greatsword warrior with spiky black hair and a scarred face, dark iron armor with orange-brown leather, '
                      'bare muscular arms, a huge heavy dark iron greatsword resting on the shoulder, gripped with both hands.',
})
# 재시안 (로드맵: 검성은 덩어리·얼굴 안 보임, 대검전사는 실사 비율) — 검사·성기사와 같은 밝기·대비
WHO_R = {
    'blademaster': 'A dual-wielding blade master in charcoal gray lacquered armor with bright crimson trim, a horned helmet with a glowing red eye slit, '
                   'a long bright red scarf flowing behind, holding two slim crimson katanas, one in each hand, both blades clearly visible. '
                   'Bright rim light on the armor edges, high contrast, readable on a dark background.',
    'greatswordsman': 'A stylized game hero greatsword warrior with spiky black hair and a confident face, steel shoulder plates and brown leather armor '
                      'with bright orange accents, a huge greatsword with a wide steel blade resting on his right shoulder, gripped with both hands. '
                      'Bright rim light on the armor edges, high contrast, readable on a dark background.',
}
# 새로 그리기 (2026-10-17 사용자: "기존 비주얼을 따라갈 필요 없이 컨셉에만 알맞게") — 직업 이름·역할·무기만 보고, 지금 스프라이트는 안 쓴다.
#  밑그림은 직업과 무관한 3등신 회색 마네킹(design/mannequin-3h.png, 48칸 격자) — 비율·옆모습·큰 도트만 잡아 준다
STYLE_N = ('Pixel art style. One single full-body 2D side-scroller game character sprite, about 48 pixels tall, big chunky pixels, '
           '3 heads tall stylized proportions with a large head, strict side profile facing right, standing in a ready stance. '
           '{who} Simple clean shading with 3 tones per material, bright readable colors, bold 1-pixel dark outline, '
           'plain flat light gray background, nothing else.')
WHO_N = {
    'swordsman': 'A young swordsman knight: polished silver half-plate armor over a royal blue tunic, a visored helmet with a blue plume, a short blue cape, a straight steel longsword held forward in the right hand.',
    'paladin': 'A holy paladin: white and cream plate armor with gold trim, a glowing golden halo floating above the helmet, a gold kite shield with a white cross on the left arm, a golden longsword in the right hand.',
    'blademaster': 'A sword saint dual wielder: black and crimson samurai armor, a horned kabuto helmet with a red visor slit, a long red scarf flowing behind, two curved katanas, one in each hand, blades bright silver with red edge.',
    'greatswordsman': 'A greatsword berserker: spiky dark hair, rugged face, steel pauldrons and brown leather armor with orange accents, a huge wide steel greatsword resting on the right shoulder, gripped with both hands.',
}
# 2차 (비평 반영): 46칸에서 머리가 작아 보여 마네킹 머리를 키움(22/48), 어두운 몸은 짙은 남회색 3단, 다리 짧고 굵게
STYLE_N2 = ('Pixel art style. One single full-body 2D side-scroller game character sprite, big chunky pixels, '
            'super deformed chibi with an oversized head about one third of the total height, short stocky body, short thick legs, '
            'strict side profile facing right, standing in a ready stance. {who} Flat cel shading with exactly 3 tones per material '
            '(light, mid, shadow), no dithering, no noise, no scattered highlight pixels, bright readable colors, bold 1-pixel dark outline, '
            'plain flat light gray background, nothing else.')
WHO_N2 = {
    'swordsman': 'A young swordsman knight: bright polished silver plate armor (light gray, not blue), a big visored helmet with one clear horizontal visor slit and a blue plume, a royal blue tabard, a short blue cape darker than the tabard, a straight steel longsword held forward in the right hand.',
    'paladin': 'A holy paladin: white plate armor with cream mid tones and gold trim on the chest and shoulders, a golden halo ring floating above the big helmet, a white kite shield with a gold rim and a gold cross on the left arm, a golden longsword in the right hand.',
    'blademaster': 'A sword saint dual wielder: dark slate blue-gray samurai armor plates (not pure black) laced with bright crimson cords, a big horned kabuto helmet with a red visor slit, a long red scarf flowing behind, two curved katanas with gold guards, one held forward low and one held up behind.',
    'greatswordsman': 'A greatsword berserker: big head with spiky black hair, steel pauldrons, mid-brown leather armor with a few wide orange bands, a huge greatsword with a very wide steel blade resting on the right shoulder, both fists on the hilt in front of the chest.',
}
# 대검전사 3차 (비평: 대검이 가는 막대·머리 검정 덩어리) — 날 폭을 몸통만큼, 밝은 회백 강철, 머리는 짙은 남색 램프
WHO_N3 = {'greatswordsman': 'A greatsword berserker: big head with spiky dark navy hair with lighter blue highlights, a clearly visible face, '
          'one large light gray steel pauldron, mid-brown leather armor with one wide bright orange belt, an enormous flat greatsword whose blade is as wide '
          'as the torso and longer than the body, light gray steel with a bright edge, carried diagonally on the right shoulder with the blade pointing up and back, '
          'both fists gripping the long hilt in front of the chest. Not a spear, not a thin pole.'}
# 4차 (비평: 검성 칼 수평 겹침·하반신 어두움 / 대검전사 대검 좁아짐·빈손·적갈색 덩어리)
WHO_N4 = {
    'blademaster': 'A sword saint dual wielder in medium slate blue-gray samurai armor with bright crimson lacing, light gray highlights on every plate, '
                   'a big horned kabuto helmet with a dark face mask and a glowing red eye slit, a long bright red scarf flowing behind. '
                   'Two curved silver katanas clearly separated: the front hand holds one katana pointing forward and down, '
                   'the back hand holds the other katana raised high behind the back pointing up, the two blades form a wide V and never overlap.',
    'greatswordsman': 'A greatsword berserker with spiky dark navy hair and a clearly visible face, one big light steel pauldron, '
                      'medium brown leather armor (not maroon) with one very wide bright orange belt, both fists together in front of the chest gripping a long hilt, '
                      'the enormous greatsword blade rests on the right shoulder pointing up and back, the blade is wider than the torso, flat light gray steel with a dark edge line.',
}
# 6차 검성 (비평 p13: 스카프가 검은 망토 덩어리·떠 있는 빨간 끝·판갑 조각남·얼굴 빨간 덩어리·4등신) — 머리 1/3, 목에서 이어진 진홍 스카프 한 줄, 큰 판 몇 장, 눈 틈만 빨강, 몸 안 검정 금지
WHO_N6 = {'blademaster': 'A sword saint dual wielder with a very big round head (one third of the total height), a horned kabuto helmet in medium slate blue-gray '
          'with a light gray face guard and one thin glowing red eye slit (no other red on the face), a short crimson scarf tied at the neck whose one continuous tail '
          'flows straight back from the neck, simple chest armor of three large smooth slate blue-gray plates with light gray tops and crimson lacing, '
          'light gray hakama trousers, short legs, two curved silver katanas: one held forward pointing down, one raised behind the back pointing up, blades never overlap. '
          'No black areas inside the body, no cape.',
          # 대검전사 6차 (비평 N5w: 칼이 붙여 놓은 물체·손/자루 없음·갑옷 없음·얼굴 밋밋)
          'greatswordsman': 'A chibi warrior with a big head, short messy dark navy hair, a scowling face with thick eyebrows and a frowning mouth, '
          'resting a huge broad greatsword on his right shoulder: both gloved fists grip the long hilt at the chest, a visible cross-guard next to the shoulder, '
          'the wide flat blade goes behind the head diagonally up and back, pointed tip, center fuller, the blade never covers the face. '
          'Light gray steel pauldrons and breastplate, clearly lighter than the dark brown leather tunic underneath, one wide orange sash belt, brown boots. No motion lines.'}
# 7차 검성 (비평 N6: 면갑이 어둡게 나옴·스카프가 떠 있음·칼 한 자루) — 흰 가면 면갑을 맨 앞에, 스카프는 목에 감김, 칼 둘
WHO_N7 = {'blademaster': 'A sword saint samurai whose face is a bright white porcelain mask with one thin horizontal red eye slit, '
          'wearing a big horned kabuto helmet in medium slate blue-gray above the white mask, a crimson scarf wrapped around the neck with one tail streaming back from the neck, '
          'simple medium slate blue-gray chest plates with light gray edges, light gray hakama trousers, '
          'two long curved silver katanas clearly visible: one in each hand, one pointing forward and down, one raised up behind the back. '
          'The face is white, not black. No cape, no dark mass.'}
# 9차 (로드맵 검수 탈락: 검성 얼굴 없음·납작한 덩어리·성의 없음 / 대검전사 큰 얼굴 정면이라 그림체 다름)
#  → 검사 N2-23 과 같은 옆모습·같은 머리 비율·같은 판금 디테일 밀도 (N2 밑그림·문체 그대로, 직업 설명만)
WHO_N9 = {
    'blademaster': 'A sword saint samurai knight in detailed lacquered plate armor: a big horned kabuto helmet in slate blue-gray with gold crescent horns, '
                   'a dark face guard with one glowing red horizontal eye slit, layered rectangular shoulder plates and a segmented chest plate in slate blue-gray '
                   'with light gray highlights and crimson lacing, a crimson scarf tied at the neck, gray armored legs, '
                   'two curved silver katanas with gold guards, one in each hand, clearly apart: the front katana pointing forward and down, the back katana raised up behind.',
    'greatswordsman': 'A heavy greatsword knight in thick polished steel plate armor: a rounded steel helmet with a horizontal visor slit and a short orange plume, '
                      'huge rounded layered pauldrons, a thick breastplate, brown leather under-armor, one wide orange belt, steel armored legs, '
                      'holding an enormous wide greatsword with both hands at the chest, the wide blade resting on the right shoulder pointing up and back.',
}
# 10차 대검전사 (9차는 은색 판금·면갑·깃털이라 검사와 실루엣이 같음 = 색깔놀이) → 투구 없이 머리띠, 거대한 견갑, 어깨에 멘 대검
WHO_N10 = {'greatswordsman': 'A battle-hardened greatsword warrior with no helmet: short spiky dark brown hair tied with a long orange headband whose tails fly back, '
           'a stern face with a scar seen in profile, huge layered dark iron pauldrons much wider than the head, a thick dark iron breastplate over a brown leather tunic, '
           'one wide orange belt, dark iron gauntlets and greaves, both fists gripping the long hilt at the chest, an enormous wide greatsword resting on the right shoulder pointing up and back, '
           'the blade wider than the head with a dark edge line. Not silver, not a knight helmet, no plume.'}
# 11차 대검전사 (10차 비평: 얼굴 정면·어두운 철이 검정 덩어리·칼날 가늘거나 두 자루) → 옆모습 밑그림(mannequin_gs2) + 중간 회색 철 + 밝은 강철 대검 한 자루
WHO_N11 = {'greatswordsman': 'A greatsword warrior seen in strict side profile facing right, small face in profile with a stern eyebrow, short spiky dark brown hair '
           'tied with an orange headband whose short tails hang back, big rounded medium gray iron pauldron with light gray highlights, '
           'medium gray iron breastplate over a brown leather tunic, one wide orange belt, gray iron greaves, '
           'both fists gripping one long hilt at the chest, one single enormous greatsword with a very wide bright silver blade resting on the right shoulder pointing up and back. '
           'No helmet, no plume, no black areas, only one sword.'}
# 12차 대검전사 (11차: 옆모습은 됐지만 큰 맨얼굴·디테일 적음 → 로드맵이 탈락시킨 그림체) → 검사 N2 밑그림·밀도 + 검사와 다른 투구 실루엣
WHO_N12 = {'greatswordsman': 'A heavy greatsword knight: an open steel barbute helmet with a T-shaped face opening and a short bristly orange crest on top, '
           'huge layered steel pauldrons with brass rims much wider than the helmet, a thick steel breastplate with brass trim, one wide orange sash belt, '
           'a short brown leather skirt, steel greaves, no cape, both gauntlets gripping one long hilt at the chest, '
           'one enormous greatsword with a very wide bright steel blade resting on the right shoulder pointing up and back.'}
# 13차 (로드맵 승인: 검사 N2-23 합격 그림을 init 으로, denoise 0.68 — 같은 옆모습·머리 비율·디테일 밀도 보장, 실루엣 차이는 투구·견갑·무기)
WHO_N13 = {
    'blademaster': 'A samurai sword saint: a slate blue-gray lacquered kabuto helmet with big gold crescent horns and a dark face guard with one glowing red eye slit, '
                   'layered rectangular slate blue-gray shoulder plates with crimson lacing, a crimson scarf at the neck, '
                   'two curved silver katanas, one in each hand, one held forward low and one raised behind. No cape, no plume.',
    'greatswordsman': 'A heavy greatsword knight: a dark steel helmet with a T-shaped face opening and a bristly orange crest, '
                      'huge round layered pauldrons with brass rims, orange sash belt, brown leather skirt, '
                      'both hands gripping one enormous wide-bladed greatsword resting on the right shoulder. No cape, no plume.',
}
# 14차: 13차(0.68)는 검사 그대로 나옴 → init 의 파랑을 직업 색(검성 진홍·대검전사 주황)으로 바꾸고 denoise 0.80 / 0.86 (씨앗 앞 4개 / 뒤 4개)
def init_recolor(hue):
    import colorsys
    im = Image.open(os.path.join(RAW, 'swordsman-N2-23.png')).convert('RGB'); P = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = P[x, y]; h, l, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if sat > 0.35 and 0.55 < h < 0.75:                 # 파랑 계열만
                r2, g2, b2 = colorsys.hls_to_rgb(hue, l, sat); P[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255))
    return im


# 15차 대검전사: 14차(색만 바꾼 검사) → init 을 스크립트로 바꿈: 깃털·장검 지우고, 손에서 머리 뒤로 넘어가는 넓은 대검을 바탕 칸에만 그림 + 파랑→주황
def init_gs():
    from PIL import ImageDraw
    im = init_recolor(0.07); P = im.load(); bg = P[5, 5]; d = ImageDraw.Draw(im)
    d.polygon([(235, 300), (300, 230), (360, 150), (430, 90), (520, 85), (525, 130), (470, 150), (400, 210), (330, 300)], fill=bg)   # 깃털
    d.polygon([(690, 560), (975, 455), (995, 480), (720, 640)], fill=bg)                                                             # 장검 날
    base = im.copy(); B = base.load(); m = Image.new('RGB', im.size, bg); dm = ImageDraw.Draw(m)
    hx, hy = 650, 630; ex, ey = 170, 90; w = 52                                                                                       # 손 → 왼쪽 위(머리 뒤)
    import math
    L = math.hypot(ex - hx, ey - hy); ux, uy = (ex - hx) / L, (ey - hy) / L; nx, ny = -uy, ux
    pt = lambda t, s_: (hx + ux * t + nx * s_, hy + uy * t + ny * s_)
    dm.polygon([pt(60, -w - 10), pt(L - 60, -w - 10), pt(L + 10, 0), pt(L - 60, w + 10), pt(60, w + 10)], fill=(11, 13, 20))
    dm.polygon([pt(60, -w), pt(L - 60, -w), pt(L - 5, 0), pt(L - 60, w), pt(60, w)], fill=(206, 212, 224))
    dm.polygon([pt(60, 4), pt(L - 60, 4), pt(L - 5, 0), pt(L - 60, w), pt(60, w)], fill=(150, 158, 178))
    dm.polygon([pt(30, -w - 40), pt(60, -w - 40), pt(60, w + 40), pt(30, w + 40)], fill=(150, 110, 40))                             # 코등이
    M = m.load()
    for y in range(im.height):
        for x in range(im.width):
            if M[x, y] != bg and sum(abs(B[x, y][i] - bg[i]) for i in range(3)) < 30: P[x, y] = M[x, y]
    return im


# T3 (로드맵 2026-10-18, PixelLab 0): 견습 기사·3차 3종 — 부모 확정 원본을 init 으로 (같은 그림체·옆모습·밀도), 특징은 부모에서 잇고 키움
T3_INIT = {'squire': 'swordsman-N2-23.png', 'archon': 'paladin-N2-51.png', 'swordsaint': 'blademaster-N14-97.png', 'tyrant': 'greatswordsman-N15-37.png'}
WHO_T3 = {
    'squire': 'A young squire apprentice: a simple round steel cap with an open face showing a young boy face, padded brown leather jerkin over a cream tunic, '
              'brown belt, a short plain sword in the right hand and a small round wooden buckler on the left arm. No plume, no cape, no full plate.',
    'archon': 'A celestial archon knight: ornate white and gold plate armor, a big visored helmet with a glowing ring of small gold stars floating above it, '
              'a flowing deep navy cape sprinkled with gold stars, a large gold-trimmed kite shield with a star emblem, a radiant golden longsword.',
    'swordsaint': 'A sword saint master samurai: a kabuto with very large gold crescent horns, a white haori coat over slate blue-gray armor with crimson lacing, '
                  'a long white scarf flowing back, two glowing pale cyan curved katanas, one raised high and one held low.',
    'tyrant': 'A tyrant greatsword king: a dark steel helmet topped with a spiked gold crown, a long crimson royal cape, huge spiked dark steel pauldrons with gold rims, '
              'an enormous wide dark greatsword with glowing red runes resting on the shoulder, both hands on the hilt.',
}


# T3b (비평 t3: 얼굴 없는 흰/어두운 덩어리·정면 시점·잔디테일로 46px 뭉개짐·성좌기사가 성기사 색만 바꿈) → 옆모습 고정·얼굴/면갑 틈·큰 단순 덩어리·밝은 중간톤
T3B = ' Strict side profile facing right with a clearly visible face or visor slit. Big simple shapes, bright mid tones with one highlight per plate, no tiny details, no dark masses.'
WHO_T3B = {
    'archon': 'A celestial archon knight: white and gold plate armor, a big helmet with a dark horizontal visor slit, a large ring of eight bright gold stars floating above the head, '
              'a wide deep navy cape with a few big gold stars flowing far behind, a kite shield with a big gold star, a glowing golden longsword held forward.',
    'swordsaint': 'A sword saint samurai: a kabuto with huge bold gold crescent horns, a visible pale face with red eyes, a bright white haori coat over light gray armor, '
                  'a long white scarf streaming behind, two thick glowing cyan katanas, one raised high above and one held low forward.',
    'tyrant': 'A tyrant greatsword king: a steel helmet with a tall spiked gold crown and a visor slit with red eyes, a long bright crimson cape, two huge round steel pauldrons with three big spikes, '
              'gold belt, both hands gripping one enormous wide steel greatsword with a glowing red rune line, resting on the right shoulder.',
}


# T3c (성좌기사·검신 2회 미달: 얼굴 없는 덩어리·정면 시점) → 2차 확정 46칸 그림을 20배로 키워 init (옆모습·비율·얼굴 자리 고정), denoise 0.8
T3C_SRC = {'archon': 'fix-paladin.png', 'swordsaint': 'fix-blademaster-n14.png'}


def init_t3c(cls):
    im = Image.open(os.path.join(HERE, 'design', 'pl2', T3C_SRC[cls])).convert('RGBA'); im = im.crop(im.getbbox())
    k = 840 // max(im.size); im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    bg = Image.new('RGBA', (1024, 1024), (200, 200, 204, 255)); bg.alpha_composite(im, ((1024 - im.width) // 2, 1024 - 60 - im.height)); return bg.convert('RGB')


# T3d: T3c(0.8)는 부모를 거의 복사(IoU 0.87~0.95) → 같은 init 에 denoise 0.88, 검신은 흰 하오리·흰 스카프를 앞세움
WHO_T3D = dict(WHO_T3B, swordsaint='A sword saint samurai wearing a long bright white haori coat that covers the body down to the knees, a long white scarf streaming far behind, '
               'a kabuto with huge bold gold crescent horns, a visible pale face with red eyes, two thick glowing cyan katanas, one raised high and one held low forward.')


# T3e 검신 (T3~T3d 4라운드 미달: 얼굴 없음·비율·하오리·곡도) → 검성 확정 46칸 그림의 청회색 갑옷을 흰색으로, 칼날 흰색을 청록으로 '색만' 바꿔 20배 init, denoise 0.8
def init_t3e():
    import colorsys
    im = Image.open(os.path.join(HERE, 'design', 'pl2', 'fix-blademaster-n14.png')).convert('RGBA'); P = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = P[x, y]
            if not a: continue
            h, l, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if 0.55 < h < 0.72 and 0.15 < l < 0.75: v = int(150 + l * 120); P[x, y] = (v, v, min(255, v + 6), 255)     # 청회색 판금 → 흰 하오리
            elif l > 0.9 and y > im.height // 2: P[x, y] = (110, 240, 230, 255)                                       # 아래쪽 흰 칼날 → 청록
    im = im.crop(im.getbbox()); k = 840 // max(im.size); im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    bg = Image.new('RGBA', (1024, 1024), (200, 200, 204, 255)); bg.alpha_composite(im, ((1024 - im.width) // 2, 1024 - 60 - im.height)); return bg.convert('RGB')


# S1 검신 재디자인 (사용자 "개선해라"): 어두운 남색·흑철 갑옷 + 흰 스카프·흰 머리로 명암 대비, 큰 금 뿔, 길고 밝은 곡도, 넓은 어깨판·넓은 하카마로 검성과 틀이 다르게
WHO_S1 = ('A sword saint samurai in dark navy and black iron armor: very wide layered shoulder plates (o-sode) much wider than the head, a kabuto with huge bold gold crescent horns, '
          'long white hair tied in a high ponytail flowing back, a visible pale face with red eyes, a long bright white scarf streaming behind, wide dark navy hakama trousers flaring at the bottom, '
          'two long bright silver katanas with a cyan glow, one raised high and one held low forward.')


# S2 검신 2라운드 (S1 비평: 어두운 몸이 46칸에서 검은 덩어리·뿔 작고 어두움·스카프가 얼굴 가림·비율)
WHO_S2 = ('A chibi sword saint samurai with a very big head (one third of the height): a kabuto with huge bright gold crescent horns as wide as the head, '
          'a large clearly visible pale face with two red eyes, long white hair in a ponytail behind, a white scarf tied at the neck trailing only behind, '
          'medium steel-blue lacquered armor plates with bright light-blue highlights on every plate (not black), very wide square shoulder plates, '
          'wide navy hakama with light folds, two long bright silver katanas with cyan edges, one raised high behind and one held low forward.')


def init_t3(cls):
    if cls == 'squire': return init_recolor(0.08)          # 파랑 → 갈색
    return Image.open(os.path.join(RAW, T3_INIT[cls])).convert('RGB')


DIRS = {
    'A': 'Cute chibi proportions, about 2.5 heads tall, big helmet, short legs, compact body.',
    'B': 'Stylized proportions about 3 heads tall, slightly bigger head than real, sturdy body, medium legs.',
    'C': 'Heroic slender proportions about 4 heads tall, long legs, broad shoulders, narrow waist, elegant pose.',
}
SEEDS = [11, 23, 37, 51]
SEEDS_N3 = [11, 23, 37, 51, 63, 77, 89, 97]
HEIGHTS = [35, 46, 52]


def init_img(cls):
    """A 방향 밑그림: 지금 게임 스프라이트(96칸)를 연회색 바탕에 크게"""
    im = Image.open(os.path.join(HERE, 'ref', f'{cls}-guard.png')).convert('RGBA')
    bb = im.getbbox(); im = im.crop((bb[0] - 6, bb[1] - 6, bb[2] + 6, bb[3] + 6))
    s = 900 // max(im.size); im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    bg = Image.new('RGBA', (1024, 1024), (200, 200, 204, 255)); bg.alpha_composite(im, ((1024 - im.width) // 2, (1024 - im.height) // 2))
    return bg.convert('RGB')


# 2차 시도: 등신은 밑그림으로 강제 — 지금 스프라이트의 머리는 두고 목 아래(몸·다리)만 세로로 늘린 그림을 높은 denoise 로 다시 그린다
STRETCH = {'A2': (1.0, 0.82), 'B2': (1.5, 0.82), 'C2': (2.1, 0.85), 'R': (1.5, 0.82)}      # (목 아래 늘림, denoise)
DIRS.update({'A2': DIRS['A'], 'B2': DIRS['B'], 'C2': DIRS['C'], 'R': DIRS['B'], 'S': DIRS['B'], 'N': DIRS['B'], 'N2': DIRS['B'], 'N3': DIRS['B'], 'N4': DIRS['B'], 'N5': DIRS['B'], 'N6': DIRS['B'], 'N7': DIRS['B'], 'N8': DIRS['B'], 'N9': DIRS['B'], 'N10': DIRS['B'], 'N11': DIRS['B'], 'N12': DIRS['B'], 'N13': DIRS['B'], 'N14': DIRS['B'], 'N15': DIRS['B'], 'T3': DIRS['B'], 'T3b': DIRS['B'], 'T3c': DIRS['B'], 'T3d': DIRS['B'], 'T3e': DIRS['B'], 'S1a': DIRS['B'], 'S1b': DIRS['B'], 'S2': DIRS['B']})


def init_stretch(cls, f):
    im = Image.open(os.path.join(HERE, 'ref', f'{cls}-guard.png')).convert('RGBA')
    bb = im.getbbox(); im = im.crop(bb)
    neck = (88 - bb[1]) - 19                       # parts.bands: 목 = 땅 - 19
    head, body = im.crop((0, 0, im.width, neck)), im.crop((0, neck, im.width, im.height))
    body = body.resize((body.width, round(body.height * f)), Image.NEAREST)
    st = Image.new('RGBA', (im.width, head.height + body.height)); st.alpha_composite(head); st.alpha_composite(body, (0, head.height))
    s = 900 / max(st.size); st = st.resize((round(st.width * s), round(st.height * s)), Image.NEAREST)
    bg = Image.new('RGBA', (1024, 1024), (200, 200, 204, 255)); bg.alpha_composite(st, ((1024 - st.width) // 2, (1024 - st.height) // 2))
    return bg.convert('RGB')


def gen(dirs):
    from comfy import gen as G
    os.makedirs(RAW, exist_ok=True)
    for cls in (CLS_ONLY or (WHO_N if dirs in (['N'], ['N2']) else WHO)):
        for dk in dirs:
            todo = [s for s in (SEEDS_N3 if dk in ('N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15', 'T3', 'T3b', 'T3c', 'T3d', 'T3e', 'S1a', 'S1b', 'S2') else SEEDS) if not os.path.exists(os.path.join(RAW, f'{cls}-{dk}-{s}.png'))]
            for s in todo:
                prompt = STYLE.format(who=(WHO_R if dk == 'R' else WHO).get(cls, ''), body=DIRS[dk])
                if dk == 'N5':         # 대검전사: 넓은 대검을 그려 넣은 밑그림 (글로는 46칸에서 칼이 가늘어짐)
                    init = Image.open(os.path.join(D, 'mannequin-gs.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N4[cls]), seed=s, denoise=0.8, init=init)
                elif dk == 'S2':
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_S2 + T3B), seed=s, denoise=0.92, init=Image.open(os.path.join(D, 'mannequin-3h-b.png')).convert('RGB'))
                elif dk == 'S1a':      # 검사 N2 와 같은 3등신 마네킹 밑그림
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_S1 + T3B), seed=s, denoise=0.92, init=Image.open(os.path.join(D, 'mannequin-3h-b.png')).convert('RGB'))
                elif dk == 'S1b':      # 검성 원본 밑그림
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_S1 + T3B), seed=s, denoise=0.86, init=Image.open(os.path.join(RAW, 'blademaster-N14-97.png')).convert('RGB'))
                elif dk == 'T3e':
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_T3D[cls] + T3B), seed=s, denoise=0.8, init=init_t3e())
                elif dk == 'T3d':
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_T3D[cls] + T3B), seed=s, denoise=0.88, init=init_t3c(cls))
                elif dk == 'T3c':
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_T3B[cls] + T3B), seed=s, denoise=0.8, init=init_t3c(cls))
                elif dk == 'T3b':
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_T3B[cls] + T3B), seed=s, denoise=0.86, init=init_t3(cls))
                elif dk == 'T3':
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_T3[cls]), seed=s, denoise=0.86, init=init_t3(cls))
                elif dk == 'N15':
                    init = init_gs(); init.save(os.path.join(D, 'init-gs15.png'))
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N13[cls]), seed=s, denoise=0.86, init=init)
                elif dk == 'N14':
                    init = init_recolor(0.99 if cls == 'blademaster' else 0.07)
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N13[cls]), seed=s, denoise=0.80 if s in SEEDS_N3[:4] else 0.86, init=init)
                elif dk == 'N13':
                    init = Image.open(os.path.join(RAW, 'swordsman-N2-23.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N13[cls]), seed=s, denoise=0.68, init=init)
                elif dk == 'N12':
                    init = Image.open(os.path.join(D, 'mannequin-3h-b.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N12[cls]), seed=s, denoise=0.92, init=init)
                elif dk == 'N11':
                    init = Image.open(os.path.join(D, 'mannequin-gs2.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N11[cls]), seed=s, denoise=0.85, init=init)
                elif dk == 'N10':
                    init = Image.open(os.path.join(D, 'mannequin-3h-b.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N10[cls]), seed=s, denoise=0.92, init=init)
                elif dk == 'N9':        # 검사 N2 와 같은 밑그림·문체
                    init = Image.open(os.path.join(D, 'mannequin-3h-b.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N9[cls]), seed=s, denoise=0.92, init=init)
                elif dk == 'N8':        # 대검전사: 두 주먹이 자루를 쥔 밑그림 (mannequin_gs2.py)
                    init = Image.open(os.path.join(D, 'mannequin-gs2.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N6[cls]), seed=s, denoise=0.8, init=init)
                elif dk == 'N7':
                    init = Image.open(os.path.join(D, 'mannequin-3h-b.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N7[cls]), seed=s, denoise=0.92, init=init)
                elif dk == 'N6':
                    init = Image.open(os.path.join(D, 'mannequin-gs.png' if cls == 'greatswordsman' else 'mannequin-3h-b.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N6[cls]), seed=s, denoise=0.85 if cls == 'greatswordsman' else 0.92, init=init)
                elif dk == 'N4':
                    init = Image.open(os.path.join(D, 'mannequin-3h-b.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N4[cls]), seed=s, denoise=0.92, init=init)
                elif dk == 'N3':
                    init = Image.open(os.path.join(D, 'mannequin-3h-b.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N3[cls]), seed=s, denoise=0.92, init=init)
                elif dk == 'N2':
                    init = Image.open(os.path.join(D, 'mannequin-3h-b.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N2[cls]), seed=s, denoise=0.92, init=init)
                elif dk == 'N':          # 컨셉만 보고 새로: 직업 무관 3등신 마네킹 밑그림
                    init = Image.open(os.path.join(D, 'mannequin-3h.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N.format(who=WHO_N[cls]), seed=s, denoise=0.92, init=init)
                elif dk == 'S':          # 같은 비율·밝기: 형태가 좋은 검사 B2-11 원본을 밑그림으로, 직업만 바꿔 그린다
                    init = Image.open(os.path.join(RAW, 'swordsman-B2-11.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE.format(who=WHO_R[cls], body=DIRS['B']), seed=s, denoise=0.88, init=init)
                elif dk in STRETCH:
                    f, dn = STRETCH[dk]
                    ims, dt = G('zimg', prompt, seed=s, denoise=dn, init=init_stretch(cls, f))
                elif dk == 'A':
                    ims, dt = G('zimg', prompt, seed=s, denoise=0.68, init=init_img(cls))
                else:
                    ims, dt = G('zimg', prompt, seed=s)
                ims[0].save(os.path.join(RAW, f'{cls}-{dk}-{s}.png'))
                print(cls, dk, s, f'{dt:.1f}s', flush=True)


def fg(im, thr=40):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]); bgc = np.median(border, axis=0)
    m = np.sqrt(((a - bgc) ** 2).sum(-1)) > thr
    return a, m


def shrink(im, H, ncol=20):
    """1024 그림 → 키 H px 도트: 바탕 떼기 → 상자 → 칸마다 덮인 비율 0.5 이상만, 색은 칸 안 최빈(뭉개짐 방지) → 색 줄이기 → 외곽선"""
    a, m = fg(im)
    ys, xs = np.nonzero(m)
    if len(xs) == 0: return None
    y0, y1 = np.percentile(ys, [0.3, 99.9]); x0, x1 = np.percentile(xs, [0.3, 99.7])
    y0, y1, x0, x1 = int(y0), int(y1) + 1, int(x0), int(x1) + 1
    cell = (y1 - y0) / H
    W = int(np.ceil((x1 - x0) / cell))
    out = np.zeros((H, W, 4), np.uint8)
    q = (a // 24).astype(np.int32)      # 최빈 고를 때 비슷한 색 묶기
    for j in range(H):
        for i in range(W):
            ya, yb = int(y0 + j * cell), int(y0 + (j + 1) * cell); xa, xb = int(x0 + i * cell), int(x0 + (i + 1) * cell)
            mm = m[ya:yb, xa:xb]
            if mm.size == 0 or mm.mean() < 0.5: continue
            cs = a[ya:yb, xa:xb][mm]; key = q[ya:yb, xa:xb][mm]
            kk = key[:, 0] * 10000 + key[:, 1] * 100 + key[:, 2]
            vals, cnt = np.unique(kk, return_counts=True); best = vals[cnt.argmax()]
            out[j, i, :3] = cs[kk == best].mean(0); out[j, i, 3] = 255
    img = Image.fromarray(out, 'RGBA')
    # 색 줄이기 (투명 제외)
    rgb = img.convert('RGB').quantize(colors=ncol, method=Image.Quantize.MEDIANCUT).convert('RGB')
    r = rgb.convert('RGBA'); r.putalpha(img.split()[3])
    # 외곽선: 아주 어두운 칸은 외곽선 색으로, 바깥 가장자리에 1칸
    P = r.load(); Wd, Hd = r.size
    for y in range(Hd):
        for x in range(Wd):
            c = P[x, y]
            if c[3] and c[0] * .3 + c[1] * .59 + c[2] * .11 < 40: P[x, y] = OUT_C + (255,)
    add = [(x, y) for y in range(Hd) for x in range(Wd) if not P[x, y][3] and any(0 <= x + dx < Wd and 0 <= y + dy < Hd and P[x + dx, y + dy][3] and P[x + dx, y + dy][:3] != OUT_C for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    o = Image.new('RGBA', (Wd + 2, Hd + 2)); o.alpha_composite(r, (1, 1)); P = o.load()
    for x, y in add: P[x + 1, y + 1] = OUT_C + (255,)
    for x in range(Wd + 2):
        for y in range(Hd + 2):
            if not P[x, y][3] and any(0 <= x + dx < Wd + 2 and 0 <= y + dy < Hd + 2 and P[x + dx, y + dy][3] and P[x + dx, y + dy][:3] != OUT_C for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                P[x, y] = OUT_C + (255,)
    return o


def shrink_all():
    os.makedirs(PX, exist_ok=True)
    for f in sorted(os.listdir(RAW)):
        if not f.endswith('.png'): continue
        im = Image.open(os.path.join(RAW, f))
        for H in HEIGHTS:
            o = shrink(im, H)
            if o is not None: o.save(os.path.join(PX, f[:-4] + f'-h{H}.png'))
    print('shrunk', len(os.listdir(PX)))


CLS_ONLY = [c for c in os.environ.get('DESIGN_CLS', '').split(',') if c]


if __name__ == '__main__':
    if sys.argv[1] == 'gen': gen(sys.argv[2:] or list(DIRS))
    elif sys.argv[1] == 'shrink': shrink_all()
