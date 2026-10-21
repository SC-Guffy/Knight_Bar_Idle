# 아트 자동 루프 상태 기계 (스펙 docs/specs/art-loop.md): 일감마다 상태를 파일로 들고 "다음에 할 일"을 알려 준다.
#   python3 dev/art-loop/loop.py init <묶음 폴더>      jobs.json → 일감 폴더·v0(원래 그림) 만들기
#   python3 dev/art-loop/loop.py next <묶음 폴더>      자동 단계(검수 시트·수리 적용)는 스스로 하고, 에이전트가 할 일 목록을 JSON 으로 낸다
#   python3 dev/art-loop/loop.py status <묶음 폴더>
#   python3 dev/art-loop/loop.py task <묶음 폴더> <일감>   그 일감의 지금 할 일 지시문 (에이전트에게 "이걸 실행해 나온 지시를 따르라"고 넘길 때)
# 세션은 next 가 낸 일(task)마다 에이전트를 부르고(task.agent, task.prompt), 에이전트가 task.out 파일을 쓰면 다시 next 를 부른다.
# 끊겨도 다시 next 를 부르면 이어 간다 — 모든 상태는 <묶음>/<일감>/state.json 과 판 폴더의 파일에 있다.
import sys, os, json, shutil, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pixel-qa'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa import ROOT, run as qa_run
import numpy as np
from PIL import Image
import repair

MAX_REPAIR, MAX_REGEN = 3, 2
KEYS = ('intent', 'read', 'clean', 'value', 'pixel', 'motion', 'rules')
CRITIC = os.path.join(ROOT, 'dev/pixel-qa/critic.md')
REPAIRER = os.path.join(ROOT, '.claude/agents/art-repairer.md')
GENERATOR = os.path.join(ROOT, '.claude/agents/art-generator.md')


def passes(sc):
    """합격선 A (pixel-qa.md): 전 항목 3 이상 + 평균 3.5 이상"""
    return all(sc[k] >= 3 for k in KEYS) and sum(sc[k] for k in KEYS) / len(KEYS) >= 3.5


def avg(sc): return round(sum(sc[k] for k in KEYS) / len(KEYS), 2)


def rd(p, d=None):
    return json.load(open(p, encoding='utf8')) if os.path.exists(p) else d


def wr(p, o):
    json.dump(o, open(p, 'w', encoding='utf8'), ensure_ascii=False, indent=1)


def log(jd, **kw):
    kw['t'] = time.strftime('%Y-%m-%d %H:%M:%S')
    with open(os.path.join(jd, 'log.jsonl'), 'a', encoding='utf8') as f: f.write(json.dumps(kw, ensure_ascii=False) + '\n')


def init(bd):
    jobs = rd(os.path.join(bd, 'jobs.json'))
    for j in jobs['jobs']:
        jd = os.path.join(bd, j['id'])
        if os.path.exists(os.path.join(jd, 'state.json')): continue
        os.makedirs(os.path.join(jd, 'v0'), exist_ok=True)
        shutil.copy(os.path.join(ROOT, j['file']), os.path.join(jd, 'v0', 'sheet-raw.png'))
        wr(os.path.join(jd, 'state.json'), dict(job=j, versions=[dict(v=0, frames=j['frames'], by='원래 그림')], repairs=0, regens=0, paid=0, critic_calls=0, done=None))
        log(jd, step='init', v=0)
    print('init', len(jobs['jobs']))


def vdir(jd, v): return os.path.join(jd, f'v{v}')


def qa(jd, st, ver):
    j = st['job']; d = vdir(jd, ver['v'])
    if os.path.exists(os.path.join(d, 'metrics.json')): return
    qa_run(os.path.join(d, 'sheet-raw.png'), j['id'], j.get('color'), ver['frames'], j.get('tile', False), j['intent'], d,
           scale=j.get('scale', 1), kind=j.get('kind', 'vfx'), anchor=j.get('anchor', 'c'))
    log(jd, step='qa', v=ver['v'])


def critic_task(jd, st, ver):
    j = st['job']; d = vdir(jd, ver['v'])
    return dict(job=j['id'], v=ver['v'], agent='pixel-critic', out=os.path.join(d, 'verdict.json'), prompt=(
        f"먼저 {CRITIC} 를 Read 로 읽고 그 지침(프론트매터 아래 본문)대로 검수하라.\n"
        f"검수 대상: {d}/sheet.png (검수 시트), {d}/metrics.json (규격·지표·경보, 쓰임은 intent, 게임 배율은 scale).\n"
        f"쓰임: {j['intent']}\n"
        "위 파일만 Read 한다. 다른 판(v 폴더)·저장소의 다른 파일은 열지 않는다.\n"
        f"판정 JSON 을 지침의 출력 양식대로 Write 로 {d}/verdict.json 에 저장하고(순수 JSON), 최종 답으로 같은 JSON 을 돌려줘."))


def ops_path(jd, st, base):
    k = st['repairs'] + 1
    return os.path.join(vdir(jd, base['v']), 'ops.json' if k == 1 else f'ops-r{k}.json')


def repair_task(jd, st, ver, latest=None):
    j = st['job']; d = vdir(jd, ver['v']); out = ops_path(jd, st, ver)
    worse = ''
    if latest and latest['v'] != ver['v']:
        lv = rd(os.path.join(vdir(jd, latest['v']), 'verdict.json'), {})
        worse = (f"앞 수리 결과 v{latest['v']}({latest['by']}) 는 평균 {latest.get('avg')} 로 이 판(v{ver['v']}, 평균 {ver.get('avg')})보다 나빠져서 버렸다. "
                 f"그 판 비평 요약: {lv.get('summary', '')} — 같은 실수를 되풀이하지 마라.\n")
    return dict(job=j['id'], v=ver['v'], agent='art-repairer', out=out, prompt=(
        f"먼저 {REPAIRER} 를 Read 로 읽고 그 지침대로 수리 연산 목록을 만들어라.\n"
        f"고칠 판: {d}/sheet-raw.png (원본 시트, 프레임 {ver['frames']}장, 가로로 이어 붙임) · 게임 모습 {d}/game.png · 검수 시트 {d}/sheet.png · 비평 판정 {d}/verdict.json · 지표 {d}/metrics.json\n"
        f"일감: {j['id']} — {j['intent']} (색 {j.get('color')}, 게임 배율 {j.get('scale', 1)}, 고치는 이유: {j.get('why', '')})\n"
        f"이 일감에서 수리는 {st['repairs'] + 1}번째(최대 {MAX_REPAIR}).\n" + worse +
        f"작업 폴더(시험용): {d}/try{st['repairs'] + 1}/ — 여기서만 시험 파일을 만든다.\n"
        f"결과: 연산 목록 JSON 배열을 Write 로 {out} 에 저장하고, 최종 답으로 같은 JSON 과 한 줄 이유를 돌려줘."))


def gen_task(jd, st, ver, budget):
    j = st['job']; k = st['regens'] + 1; d = os.path.join(jd, f'gen{k}')
    return dict(job=j['id'], v=ver['v'], agent='art-generator', out=os.path.join(d, 'gen.json'), prompt=(
        f"먼저 {GENERATOR} 를 Read 로 읽고 그 지침대로 새 그림을 만들어라.\n"
        f"일감: {j['id']} — {j['intent']}\n규격: 프레임 {j['frames']}장, 칸 {j['cell'][0]}×{j['cell'][1]} 도트, 가로로 이어 붙인 시트 {j['cell'][0] * j['frames']}×{j['cell'][1]}. 색: {j.get('color')} (직업색이면 게임이 밝기만 읽어 다시 칠한다), 게임 배율 {j.get('scale', 1)}.\n"
        f"지금 그림과 비평: {vdir(jd, ver['v'])}/sheet-raw.png · {vdir(jd, ver['v'])}/sheet.png · {vdir(jd, ver['v'])}/verdict.json (\"fix.how\" 가 다시 뽑을 때 바꿀 것).\n"
        f"다시 뽑기 {k}번째(최대 {MAX_REGEN}). 유료(PixelLab 생성) 남은 한도: {budget}회 — 0 이면 무료 도구만 쓴다.\n"
        f"작업 폴더: {d}/ (원자료·시험 파일은 여기). 결과 시트는 {d}/out.png.\n"
        f"끝나면 {d}/gen.json 에 {{\"png\": \"{d}/out.png\", \"frames\": {j['frames']}, \"paid\": <쓴 유료 호출 수(응답 usage 합)>, \"tool\": \"...\", \"notes\": \"...\"}} 를 Write 로 저장하고 같은 JSON 을 돌려줘."))


def new_version(jd, st, png, frames, by):
    v = len(st['versions']); d = vdir(jd, v); os.makedirs(d, exist_ok=True)
    shutil.copy(png, os.path.join(d, 'sheet-raw.png'))
    ver = dict(v=v, frames=frames, by=by); st['versions'].append(ver); log(jd, step='new', v=v, by=by)
    return ver


def finish(jd, st, why):
    scored = [x for x in st['versions'] if 'avg' in x]
    def lows(x):   # 2 이하 항목 수 (평균이 같으면 큰 흠이 적은 판)
        sc = rd(os.path.join(vdir(jd, x['v']), 'verdict.json'), {}).get('scores', {})
        return sum(1 for k in KEYS if sc.get(k, 3) <= 2)
    best = max(scored, key=lambda x: (x.get('pass', False), x['avg'], -lows(x), x['v'])) if scored else st['versions'][0]
    v0 = st['versions'][0]
    if best['v'] != 0 and not best.get('pass') and best['avg'] <= v0.get('avg', 0): best = v0
    shutil.copy(os.path.join(vdir(jd, best['v']), 'sheet-raw.png'), os.path.join(jd, 'final.png'))
    st['done'] = dict(why=why, best=best['v'], frames=best['frames'], avg=best.get('avg'), passed=best.get('pass', False))
    log(jd, step='done', why=why, best=best['v'])


def step_job(bd, jd, budget_left):
    """일감 하나를 자동으로 진행할 수 있는 만큼 진행하고, 에이전트 일이 필요하면 그 task 를 돌려준다"""
    st = rd(os.path.join(jd, 'state.json'))
    try:
        while not st['done']:
            ver = st['versions'][-1]; d = vdir(jd, ver['v'])
            qa(jd, st, ver)
            if 'avg' not in ver:
                vd = rd(os.path.join(d, 'verdict.json'))
                if not vd: return critic_task(jd, st, ver)
                sc = vd['scores']; ver['avg'] = avg(sc)
                ver['pass'] = passes(sc); ver['verdict'] = 'pass' if ver['pass'] else (vd['verdict'] if vd['verdict'] != 'pass' else 'fix')
                st['critic_calls'] += 1; log(jd, step='critic', v=ver['v'], avg=ver['avg'], verdict=ver['verdict'])
            if ver['pass']:
                finish(jd, st, '합격' if ver['v'] else '원래 그림이 이미 합격'); break
            # 줄기(마지막 다시 뽑기 이후) 안에서 두 판 연속 점수가 오르지 않으면 수리를 그만두고 다시 뽑기로 (2026-10-21 결정, 예전엔 여기서 멈췄다)
            line = [x for x in st['versions'] if x['v'] >= st.get('line_start', 0) and 'avg' in x]
            if st['repairs'] < MAX_REPAIR and len(line) >= 3 and max(x['avg'] for x in line[-2:]) <= max(x['avg'] for x in line[:-2]):
                st['repairs'] = MAX_REPAIR; st['stalled'] = st.get('stalled', 0) + 1; log(jd, step='stall', v=ver['v'])
            if ver['verdict'] == 'fix' and st['repairs'] < MAX_REPAIR:
                # 수리는 이번 줄기에서 점수가 가장 높은 판에 한다 — 나빠진 수리 위에 덧대지 않게
                base = max(line, key=lambda x: (x['avg'], x['v']))
                ops = rd(ops_path(jd, st, base))
                if ops is None: return repair_task(jd, st, base, ver)
                if not ops:   # 수리 담당이 "연산으로 못 고침" → 다시 뽑기로
                    st['repairs'] = MAX_REPAIR; log(jd, step='repair-skip', v=base['v']); continue
                bd_ = vdir(jd, base['v']); tmp = os.path.join(bd_, f"repaired-r{st['repairs'] + 1}.png")
                sheet = np.asarray(Image.open(os.path.join(bd_, 'sheet-raw.png')).convert('RGBA')).copy()
                out, n2, applied = repair.apply(sheet, base['frames'], ops)
                Image.fromarray(out).save(tmp); st['repairs'] += 1
                new_version(jd, st, tmp, n2, f"수리 v{base['v']}: " + ', '.join(applied)); continue
            # regen (비평 regen, 또는 수리를 다 씀)
            if st['regens'] >= MAX_REGEN:
                finish(jd, st, '다시 뽑기·수리 횟수를 다 씀' + (' (수리 줄기 점수 정체 포함)' if st.get('stalled') else '')); break
            k = st['regens'] + 1; gd = os.path.join(jd, f'gen{k}'); os.makedirs(gd, exist_ok=True)
            g = rd(os.path.join(gd, 'gen.json'))
            cap = min(st['job'].get('paid_cap', 0) - st['paid'], budget_left)
            if g is None: return gen_task(jd, st, ver, max(0, cap))
            st['paid'] += int(g.get('paid', 0)); st['regens'] += 1
            log(jd, step='gen', k=k, paid=g.get('paid', 0), tool=g.get('tool'))
            if not g.get('png') or not os.path.exists(g['png']):
                continue   # 생성 실패 — 다음 바퀴에 다시 뽑기 횟수로 판단
            nv = new_version(jd, st, g['png'], int(g.get('frames', ver['frames'])), f"다시 뽑기 {k}: {g.get('tool', '')}")
            st['line_start'] = nv['v']; st['repairs'] = 0   # 새 줄기는 수리 횟수를 새로 센다 (생성 실패면 그대로 → 바로 다음 다시 뽑기)
        return None
    finally:
        wr(os.path.join(jd, 'state.json'), st)


def jobs_dirs(bd):
    return [os.path.join(bd, j['id']) for j in rd(os.path.join(bd, 'jobs.json'))['jobs']]


def nxt(bd):
    cap = rd(os.path.join(bd, 'jobs.json')).get('paid_cap', 0); tasks = []
    for jd in jobs_dirs(bd):
        used = sum(rd(os.path.join(x, 'state.json'))['paid'] for x in jobs_dirs(bd))
        t = step_job(bd, jd, cap - used)
        if t: tasks.append(t)
    print(json.dumps({'tasks': tasks, 'done': not tasks}, ensure_ascii=False, indent=1))


def task(bd, job):
    """일감 하나의 지금 할 일 지시문만 출력 (에이전트가 직접 불러 읽는다)"""
    jd = os.path.join(bd, job); cap = rd(os.path.join(bd, 'jobs.json')).get('paid_cap', 0)
    used = sum(rd(os.path.join(x, 'state.json'))['paid'] for x in jobs_dirs(bd))
    t = step_job(bd, jd, cap - used)
    print(t['prompt'] if t else '이 일감은 할 일이 없다 (끝났거나 다른 단계 대기). 아무것도 하지 말고 그렇게 답하라.')


def status(bd):
    for jd in jobs_dirs(bd):
        st = rd(os.path.join(jd, 'state.json'))
        print(st['job']['id'], '·', ' → '.join(f"v{x['v']}:{x.get('avg', '?')}{'✓' if x.get('pass') else ''}" for x in st['versions']),
              '· 유료', st['paid'], '· 비평', st['critic_calls'], '·', st['done'] or '진행 중')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    cmd, bd = sys.argv[1], os.path.abspath(sys.argv[2])
    if cmd == 'task': task(bd, sys.argv[3])
    else: {'init': init, 'next': nxt, 'status': status}[cmd](bd)
