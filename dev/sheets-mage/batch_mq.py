# 지팡이 원형 마네킹 애니 (PixelLab, 승인된 이름만 — approved.txt). python -I -B batch_mq.py [name ...]
#  첫 프레임 = mq/staff.png (96칸, 발 44·88, 부위색). 결과 work/mq/<name>-<i>.png
#  계획(로드맵 제출): idle 4f(1) · walk 8f(2) · atkA 4f(1) · atkB 4f(1) · cast 8f(2) = usage 7, 재시도 0
import sys, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
WHO = ('side view, body keeps facing right, small chibi pixel mannequin with a plain bald round head, red robe, blue pants, brown shoes, '
       'gold glove on the front hand holding a long green staff with a purple fork and a cyan orb at the top. Keep every color exactly the same')
NOFX = '. No spell effects, no projectiles, no glow, no background.'
ACT = {
    'idle': (4, 'standing idle, breathing slowly, staff held upright, feet stay planted'),
    'walk': (8, 'walk cycle to the right, legs clearly alternate step by step, staff held upright in the front hand'),
    'atkA': (4, 'quick spell attack: pulls the staff back, then thrusts the staff forward pointing the orb straight at an enemy to the right, then returns'),
    'atkB': (4, 'heavy spell attack: raises the staff high over the head, then swings it down to point at the ground in front'),
    'cast': (8, 'casting a big spell: lifts the staff high above the head, holds it upright to concentrate, thrusts it forward toward the right, then plunges it down toward the ground in front'),
}
names = sys.argv[1:] or list(ACT)
for i, n in enumerate(names):
    fc, a = ACT[n]
    r = subprocess.run([sys.executable, '-I', '-B', os.path.join(HERE, 'plx.py'), 'anim', 'mq', n, os.path.join(HERE, 'mq', 'staff.png'), f'{WHO}, {a}{NOFX}', str(fc), str(300 + i)])
    if r.returncode: sys.exit(r.returncode)
