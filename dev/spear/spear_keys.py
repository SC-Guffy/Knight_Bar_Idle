# 창 계열 평타 키 자세 (로드맵 승인 2026-10-18: 검사 12단계 B 방식 — 코드 덧그리기 없이 모델이 창까지 몸과 같이 그린 프레임)
#  합격 정지 그림(work/pl/<그림>-polish.png, 창 든 채) → 64칸(발 32,60) → edit-image-pixen 으로 평타마다 키 자세 4개
#  → 평타 6프레임 [원본, 키1, 키2, 키3, 키3, 키4]. 잔량은 plx.py 가 매 호출 전 바닥을 본다(여기서는 380 아래면 멈춤).
#   python -I -B spear_keys.py src <cls>          → skel/<cls>-key-src64.png
#   python -I -B spear_keys.py edit <cls> <atk>   → work/<cls>/key-<atk>-<1..4>-0.png (pixen 4회)
import os, sys, subprocess
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
PIC = {'lancer': 'lancer12-11', 'dragoon': 'dragoon12-51', 'halberdier': 'halberdier11-51', 'cavalier': 'cavalier11-11',
       'dragonlord': 'dragonlord13-37', 'warlord': 'warlord13-51', 'skyGeneral': 'skyGeneral13-11'}
WHO = {
    'lancer': 'young chibi lancer knight with an open-faced steel helmet, green plume, green tabard, short green cape, and the same long wooden spear with a green pennant',
    'dragoon': 'young chibi human dragoon knight with a dragon-shaped purple helmet showing his face, indigo and lavender plate armor, bat-wing cloth cape, and the same long purple dragon spear',
    'halberdier': 'young chibi heavy halberdier knight with a steel bucket helmet, big square pauldrons, orange cloth tabard, and the same big halberd with a crescent axe blade',
    'cavalier': 'young chibi cavalry lancer knight with a red plume helmet, blue surcoat, red kite shield on the far arm, and the same thick silver conical lance with a blue vamplate',
    'dragonlord': 'young chibi dragon lord knight king with a golden dragon crown helmet and visible face, lavender and gold plate armor, big double bat-wing cape, and the same long purple dragon spear',
    'warlord': 'young chibi heavy warlord knight with a bull-horned iron helmet and half mask, spiked pauldrons, grey iron plate, blood red cape, and the same big axe halberd',
    'skyGeneral': 'young chibi sky general knight with a white and gold winged helmet and golden halo, white and gold plate, round gold-rimmed shield on the far arm, and the same thick golden conical lance',
}
# 키 자세 (평타 종류별). thrust = 찌르기형 평타A, slam = 내리찍기형 평타B, sweep/chop = 할버드형
POSE = {
    'thrust': ['crouching and pulling the weapon far back with both hands, getting ready to thrust',
               'stepping forward and thrusting the weapon forward horizontally with both hands',
               'full lunge with the front foot far forward, both arms fully extended, the weapon tip thrust far forward',
               'recovering back to a ready stance, holding the weapon forward at waist height'],
    'slam': ['raising the weapon up above the head with both hands, the tip pointing up and back',
             'holding the weapon high overhead, body leaning back, ready to slam',
             'slamming the weapon down hard in front, the tip hitting the ground ahead, body bent forward',
             'recovering to a ready stance, holding the weapon forward at waist height'],
    'sweep': ['twisting the body and pulling the halberd far back behind with both hands, ready to sweep',
              'swinging the halberd horizontally forward at waist height with both hands',
              'finishing a wide horizontal sweep, the halberd far forward, body twisted forward',
              'recovering to a ready stance, holding the halberd upright beside the body'],
    'chop': ['raising the halberd straight up overhead with both hands',
             'holding the halberd high overhead, body leaning back, ready to chop',
             'chopping the halberd down hard in front, the axe blade hitting the ground ahead, body bent forward',
             'recovering to a ready stance, holding the halberd upright beside the body'],
}
ATK = {c: ('sweep', 'chop') if c in ('halberdier', 'warlord') else ('thrust', 'slam') for c in PIC}
FLOOR_STOP = 50          # 2026-10-18 로드맵: 310 → 50


def src(cls):
    im = Image.open(os.path.join(HERE, 'work', 'pl', f'{PIC[cls]}-polish.png')).convert('RGBA')
    s = min(1.0, 62 / im.width, 62 / im.height)
    if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.NEAREST)
    c = Image.new('RGBA', (64, 64)); c.alpha_composite(im, (32 - im.width // 2, 60 - im.height)); c.save(os.path.join(HERE, 'skel', f'{cls}-key-src64.png'))


def balance():
    out = subprocess.run([sys.executable, '-I', '-B', os.path.join(HERE, 'plx.py'), 'bal'], capture_output=True, text=True).stdout
    return float(out.split()[1]) if out.startswith('balance') else 0


def edit(cls, atk, keys=(1, 2, 3, 4)):
    for k in keys:
        b = balance()
        if b < FLOOR_STOP: print('STOP balance', b); return False
        desc = f'same {WHO[cls]}, same face, same colors and outfit, facing right, side view, {POSE[atk][k - 1]}, single weapon, no effects'
        r = subprocess.run([sys.executable, '-I', '-B', os.path.join(HERE, 'plx.py'), 'edit', cls, f'key-{atk}-{k}',
                            os.path.join(HERE, 'skel', f'{cls}-key-src64.png'), desc], capture_output=True, text=True)
        print(cls, atk, k, (r.stdout.strip().splitlines() or ['?'])[-1])
    return True


if __name__ == '__main__':
    a = sys.argv
    if a[1] == 'src': src(a[2])
    elif a[1] == 'edit': edit(a[2], a[3], tuple(int(x) for x in a[4].split(',')) if len(a) > 4 else (1, 2, 3, 4))
