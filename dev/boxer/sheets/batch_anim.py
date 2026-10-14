# 반복 동작 묶음 호출 (순서대로 하나씩). python -I batch_anim.py <cls> [name ...]
import sys, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
SV = 'side view, body keeps facing right, '
WHO = {
    'striker': 'heavyweight boxer with huge steel gauntlets',
    'kickboxer': 'lean kickboxer with a long ponytail',
    'qigong': 'qigong martial artist in a wide-sleeved robe',
    'champion': 'champion boxer with golden gauntlets and a red cape',
    'tempest': 'wind kickboxer with a long ponytail and a green scarf',
    'grandmaster': 'qigong grandmaster in a long robe with a golden halo ring',
}
ACT = {
    'idle': (4, 'standing relaxed, breathing slowly, chest rises and falls, arms lowered loosely, feet stay planted'),
    'walk': (6, 'walk cycle to the right, legs clearly cross and alternate step by step, arms in a loose guard'),
    'dash': (4, 'sprints forward to the right very fast, torso leaning far forward, long running strides'),
    'charge': (4, 'crouches low in a wide stance and pulls both hands back to the hip, gathering power, trembling slightly'),
    'hurt': (4, 'gets hit hard and recoils, head and upper body snap backward to the left, then recovers'),
    'death': (6, 'gets knocked out: staggers, knees buckle, collapses and lies flat on the ground'),
    'sit': (4, 'sits down cross-legged on the ground and rests, sitting calmly'),
}
cls = sys.argv[1]; names = sys.argv[2:] or list(ACT)
for i, n in enumerate(names):
    fc, a = ACT[n]
    act = SV + f'{WHO[cls]} ' + a
    r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'plx.py'), 'anim', cls, n, os.path.join(HERE, '..', f'v2fin-{cls}.png'), act, str(fc), str(100 + i)])
    if r.returncode: sys.exit(r.returncode)
