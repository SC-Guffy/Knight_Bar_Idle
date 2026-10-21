# 아트 루프 결과 페이지 (스펙 docs/specs/art-loop.md "결과와 적용"): 묶음 폴더 → dev/review/art-loop-<묶음>.html
#   python3 dev/art-loop/report.py <묶음 폴더>
# 일감마다 전후(게임 모습 1배·4배), 판별 점수·판정·만든 방법, 쓴 유료·비평 호출, 멈춘 이유를 한 장으로 보여 준다.
import sys, os, json, html
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pixel-qa'))
from qa import ROOT

KEYS = ('intent', 'read', 'clean', 'value', 'pixel', 'motion', 'rules')
NM = dict(intent='의도', read='읽힘', clean='깔끔', value='명암', pixel='도트', motion='움직임', rules='규칙')


def rd(p, d=None):
    return json.load(open(p, encoding='utf8')) if os.path.exists(p) else d


def main(bd):
    bd = os.path.abspath(bd); jobs = rd(os.path.join(bd, 'jobs.json')); name = jobs['batch']
    out = os.path.join(ROOT, 'dev/review', f'art-loop-{name}.html'); rel = lambda p: os.path.relpath(p, os.path.dirname(out))
    cards, paid, crit = [], 0, 0
    for j in jobs['jobs']:
        jd = os.path.join(bd, j['id']); st = rd(os.path.join(jd, 'state.json')); paid += st['paid']; crit += st['critic_calls']
        dn = st['done'] or {}; best = dn.get('best'); rows = []
        for v in st['versions']:
            vd = rd(os.path.join(jd, f"v{v['v']}", 'verdict.json'), {}); sc = vd.get('scores', {})
            mark = ' ★' if v['v'] == best else ''; sheet = rel(os.path.join(jd, 'v%d' % v['v'], 'sheet.png'))
            rows.append(f"<tr><td>v{v['v']}{mark}</td><td class='l'>{html.escape(v['by'])}</td>" +
                        ''.join(f"<td class='{'bad' if sc.get(k, 9) <= 2 else ''}'>{sc.get(k, '')}</td>" for k in KEYS) +
                        f"<td>{v.get('avg', '')}</td><td class='{'ok' if v.get('pass') else 'mid'}'>{v.get('verdict', '…')}</td>"
                        f"<td class='l'>{html.escape(vd.get('summary', ''))} <a href='{sheet}' target='_blank'>시트</a></td></tr>")
        g0 = os.path.join(jd, 'v0', 'game.png'); gb = os.path.join(jd, f'v{best}', 'game.png') if best is not None else g0
        changed = best not in (None, 0)
        cards.append(f"""
<div class="card job"><h3>{j['id']} <span class="sub">{html.escape(j['intent'])}</span></h3>
 <div class="sub">고친 이유: {html.escape(j.get('why', ''))} · 유료 {st['paid']}/{j.get('paid_cap', 0)} · 비평 {st['critic_calls']}회 · 수리 {sum(1 for v in st['versions'] if v['by'].startswith('수리'))} · 다시 뽑기 {st['regens']}</div>
 <div class="res {'ok' if dn.get('passed') else 'mid'}">{'결과: ' + html.escape(dn.get('why', '')) + (f" → v{best} (평균 {dn.get('avg')})" if dn else '') if dn else '진행 중'}{'' if changed or not dn else ' — 원래 그림 유지'}</div>
 <div class="ba"><div><div class="sub">전 (v0, 게임 모습)</div><img class="g" src="{rel(g0)}"></div>
 <div><div class="sub">후 (v{best if best is not None else '?'}, 게임 모습)</div><img class="g" src="{rel(gb)}"></div></div>
 <div class="scroll"><table><tr><th>판</th><th>만든 방법</th>{''.join(f'<th>{NM[k]}</th>' for k in KEYS)}<th>평균</th><th>판정</th><th>비평 요약</th></tr>{''.join(rows)}</table></div>
</div>""")
    page = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>아트 루프 결과 {name}</title>
<!-- dev/art-loop/report.py 가 만든다. 손으로 고치지 말 것 -->
<style>
@font-face {{ font-family: Galmuri11; src: url(../../src/skin/Galmuri11.woff2) format('woff2'); }}
:root {{ --bg:#17141f; --panel:#221e2d; --line:#3a3348; --ink:#ece6f6; --dim:#a59cb8; --gold:#ffd257; --red:#ff6b6b; --green:#7dffb0; --blue:#8fd8ff; }}
* {{ box-sizing: border-box; }} body {{ margin:0; background:var(--bg); color:var(--ink); font:13px/1.55 Galmuri11,-apple-system,sans-serif; }}
main {{ max-width:1100px; margin:0 auto; padding:16px; }} h1 {{ font-size:20px; margin:4px 0; }} h3 {{ margin:0 0 4px; font-size:15px; color:var(--gold); }}
h3 .sub {{ font-size:12px; font-weight:400; }} .sub {{ color:var(--dim); }}
.card {{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:10px 12px; margin:10px 0; }}
.res {{ margin:6px 0; font-size:14px; }} .ok {{ color:var(--green); }} .mid {{ color:var(--gold); }} .bad {{ color:var(--red); }}
.ba {{ display:flex; gap:16px; flex-wrap:wrap; background:#0f0d14; padding:8px; border-radius:4px; overflow-x:auto; }}
img.g {{ image-rendering:pixelated; display:block; background:#11141c; }}
table {{ border-collapse:collapse; width:100%; font-size:12px; margin-top:8px; }} th,td {{ border:1px solid var(--line); padding:3px 6px; text-align:center; }}
th {{ background:#2b2538; color:var(--dim); font-weight:400; }} td.l {{ text-align:left; }} .scroll {{ overflow-x:auto; }} a {{ color:var(--blue); }}
</style></head><body><main>
<h1>아트 루프 결과 — {name}</h1>
<div class="sub">스펙 docs/specs/art-loop.md · 승인: {html.escape(jobs.get('approved', ''))} · 유료 {paid}/{jobs.get('paid_cap', 0)}회 · 비평 {crit}회 · 합격선 A(전 항목 3+ · 평균 3.5+) · ★ = 결과로 고른 판</div>
<div class="card sub">게임 모습은 게임 로더를 그대로 거친 그림이다(직업색 시트는 대표색으로 칠함). 게임 적용은 사용자 확인 뒤에 한다 — 일감마다 "적용 / 원래대로 + 이유"를 알려 주면 된다.</div>
{''.join(cards)}
<script>document.querySelectorAll('img.g').forEach(i => i.onload = () => {{ i.width = i.naturalWidth * (i.naturalWidth > 300 ? 2 : 4); }});</script>
</main></body></html>"""
    open(out, 'w', encoding='utf8').write(page); print(out)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main(sys.argv[1])
