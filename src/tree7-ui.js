'use strict';
// 시즌7 스킬 빌드 트리 — 게임 스킬 탭 화면 (2단계, docs/specs/skill-tree-swordsaint.md "UI").
// 검사 계열 시제품 캐릭터(src/tree7.js t7On)면 캐릭터 → 스킬 서브탭이 이 화면이 된다 (ui.js viewSkill 첫 줄).
//  위: 남은 🌟 · 장착 칸(1~4 + 궁극기, 칸 열기) · 배운 스킬 · 쓴 포인트 · 초기화 / 가운데: 트리 판(가로로 밀어 보기) / 아래: 고른 노드 상세(찍기 · 되돌리기 · 모습 · ▶ 비주얼 확인)
// 노드 그림은 src/tree7-art.js 가 canvas 에 도트로 그린다 (CSP 가 data: 이미지를 막는다) — renderCamp 뒤 paintTree7 이 칠한다.
// 노드 배치·이름·설명은 시안 dev/review/skill-build-tree.html 의 N 과 같다 (규칙·수치는 src/tree7.js T7_NODES).

// id → { n 이름, x·y 칸 좌표, d 설명, cost 키스톤 대가, looks 칸마다 모습, ic 아이콘(없으면 id 로 tree7-art 그림), a 그림 출처 }
const T7_UI = {
  c_atk: {"n":"단련","x":0,"y":2.5,"d":"공격력 +2% / 칸","ic":"muscle"},
  c_hp: {"n":"강인함","x":0,"y":3.5,"d":"체력 +3% / 칸","ic":"heart"},
  c_spd: {"n":"날렵함","x":1,"y":2,"d":"공격 속도 +2% / 칸","ic":"boot"},
  c_crit: {"n":"급소","x":1,"y":3.5,"d":"치명 확률 +1.5% / 칸","ic":"target"},
  c_def: {"n":"철벽","x":1,"y":4.5,"d":"받는 피해 −2% / 칸","ic":"shield"},
  slash: {"n":"강철 베기","x":2,"y":3,"d":"1차 스킬 (검사 계열 공용 줄기). 앞을 크게 내려벤다.","looks":["강철 베기","강철 검풍","강철 검풍 (범위 +20%)","강철 대검","천강검"],"ic":"sk-steelCleave","a":"지금 그림 (★ 진화 모습 그대로)"},
  s_twin: {"n":"2연참","x":3,"y":2.5,"d":"강철 베기가 한 번 더 반대로 벤다 (두 번째 타 60%)","a":"같은 궤적 좌우 반전"},
  k_blade: {"n":"검의 길","x":3,"y":3.5,"d":"평타 3타마다 칼날이 번쩍이며 모든 스킬 쿨 −0.5초.","cost":"스킬 피해 −10%"},
  gale: {"n":"질풍난무","x":4,"y":0.5,"d":"적 사이를 지그재그로 오가며 벤다 (지금 검성 스킬).","looks":["삼연참","질풍난무","질풍난무 (타격 이펙트 커짐)","질풍난무·분신","월하난무"],"ic":"sk-gale","a":"지금 그림"},
  a_more: {"n":"난무 +3타","x":5,"y":0,"d":"타수 +3 (타당 피해 −15%) — 보호막에 강함","a":"같은 궤적 반복"},
  a_bleed: {"n":"출혈","x":5,"y":1,"d":"베인 적이 3초간 피를 흘린다 (붉은 점멸 + 지속 피해 40%)","a":"맞은 적 붉은 램프 점멸"},
  whirl: {"n":"검무 회오리","x":6,"y":0.5,"d":"새 스킬. 칼날 회오리가 4초간 기사 주위를 돌며 벤다.","looks":["검무","쌍 회오리","쌍 회오리 (크기 +20%)","칼날 회오리","천검무"],"a":"화염 회오리 시트(E35)를 은색 램프로","new":1,"ref":["pyromancer","flameVortex"]},
  a_follow: {"n":"쫓는 칼날","x":7,"y":0,"d":"회오리가 가장 가까운 적에게 날아가 붙는다 — 졸개·먼 적","a":"같은 시트, 이동 궤적만"},
  a_grow: {"n":"제자리 폭풍","x":7,"y":1,"d":"회오리가 움직이지 않고 그 자리에서 2배로 커진다 — 붙어 있는 보스","a":"같은 시트 ×2 크기"},
  a_key: {"n":"광란","x":8,"y":0.5,"d":"스킬이 맞힐 때마다 공속 +4% (최대 +40%), 몸에 붉은 기운이 짙어진다. 3초 안 맞히면 초기화.","cost":"평타 피해 −15%"},
  a_k3: {"n":"무한검","x":9,"y":0.5,"d":"3차. 질풍난무가 끝나면 30% 확률로 한 번 더 (분신이 이어 받는다).","cost":"질풍난무 쿨 +25%"},
  uv_a: {"n":"천검: 만검","x":10,"y":0.5,"d":"궁극기 변형 (셋 중 하나). 천검이 작은 칼날 수십 개로 쏟아진다 — 보호막에 강함","a":"천검 그림 작게 × 반복"},
  iaido: {"n":"일섬","x":4,"y":3,"d":"한 줄기 섬광으로 지나가며 벤다, 반드시 치명 (지금 검성 스킬).","looks":["발도","일섬","일섬 (검선 길어짐)","일섬·납도","적월일섬"],"ic":"sk-iaido","a":"지금 그림"},
  b_reset: {"n":"잔영","x":5,"y":2.5,"d":"일섬으로 처치하면 잔상이 되돌아와 가장 가까운 적을 한 번 더 벤다 (50%)","a":"기사 잔상 (반투명) + 같은 궤적"},
  b_exec: {"n":"처형","x":5,"y":3.5,"d":"체력 25% 이하 적은 일섬에 두 동강 (붉은 섬광, 보스는 피해 +100%)","a":"명중 섬광 붉은 램프"},
  flash: {"n":"섬광 베기","x":6,"y":3,"d":"새 스킬. 잠깐 멈췄다가 화면 끝까지 한 줄로 베어 지나간다.","looks":["섬광","섬광 베기","섬광 베기 (화면 멈춤 길어짐)","뇌광","천섬"],"a":"일섬 궤적을 길게 + 화면 정지","new":1,"ref":["blademaster","iaido"]},
  b_after: {"n":"잔상 베기","x":7,"y":2.5,"d":"0.5초 뒤 잔상이 같은 줄을 한 번 더 벤다 (50%) — 한 줄 강하게","a":"같은 궤적 반투명"},
  b_triple: {"n":"삼중 섬광","x":7,"y":3.5,"d":"한 줄 대신 위·가운데·아래 세 줄 (줄마다 45%) — 넓게","a":"같은 궤적 ×3"},
  b_key: {"n":"발도술","x":8,"y":3,"d":"일섬·섬광 베기 치명 피해 +50%, 칼을 거둘 때 금빛 섬광.","cost":"두 스킬 쿨 +30%"},
  b_k3: {"n":"무념","x":9,"y":3,"d":"3차. 모든 피해 +160%, 화면이 흑백으로 가라앉았다가 벤다.","cost":"치명 확률 0 (확정 치명 스킬도 일반타)"},
  uv_b: {"n":"천검: 일도양단","x":10,"y":3,"d":"궁극기 변형 (셋 중 하나). 하나의 거대한 칼이 화면을 가른다 — 광폭화에 강함","a":"천검 그림 ×2 크기, 한 번만"},
  wave: {"n":"비검","x":4,"y":5.5,"d":"새 스킬. 초승달 검기를 부채꼴로 날린다.","looks":["비검","삼연 비검","삼연 비검 (사거리 +20%)","오연 비검","비검 난무"],"a":"E43 참격을 투사체로","new":1,"ref":["swordsman","steelCleave",1]},
  k_wave: {"n":"참격파","x":5,"y":5,"d":"강철 베기 끝에도 검기가 한 발 날아간다","a":"E43"},
  k_pierce: {"n":"관통","x":5,"y":6,"d":"검기가 적을 뚫고 지나간다 (뚫을 때마다 −20%)","a":"같은 시트, 충돌만 바뀜"},
  storm: {"n":"검기 폭풍","x":6,"y":5.5,"d":"새 스킬. 사방으로 검기를 뿜는다.","looks":["검기 방사","팔방 검기","팔방 검기 (크기 +20%)","검기 폭풍","검기 대폭풍"],"a":"E43 방사형","new":1,"ref":["swordsman","steelCleave",2]},
  k_split: {"n":"분열","x":7,"y":5,"d":"검기가 처음 맞힌 적에서 두 갈래로 갈라진다 — 졸개 무리","a":"같은 시트 작게 ×2"},
  k_homing: {"n":"유도 검기","x":7,"y":6,"d":"검기가 휘어 날아가 가장 강한 적(보스)에 꽂힌다 — 보스 집중","a":"같은 시트, 휘는 궤적"},
  k_key: {"n":"심검","x":8,"y":5.5,"d":"평타가 푸른 검기로 바뀐다 (사거리 3배).","cost":"평타 피해 −20%"},
  k_k3: {"n":"만검귀종","x":9,"y":5.5,"d":"3차. 검기 스킬이 맞힐 때마다 다른 검기 스킬 쿨 −0.3초, 칼날이 기사 주위로 모여든다.","cost":"검기가 아닌 스킬 피해 −20%"},
  uv_k: {"n":"천검: 검우","x":10,"y":5.5,"d":"궁극기 변형 (셋 중 하나). 먹구름에서 검기가 비처럼 넓게 — 졸개에 강함","a":"천검 그림 + E43 낙하"},
  ult: {"n":"천검","x":11,"y":3,"d":"검신 궁극기 (궁극기 칸). 갈래 변형 셋 중 하나를 붙일 수 있다.","looks":["천검","천검·만화","천검·만화 (검선 늘어남)","천검·벚꽃폭풍","무명검·천지개벽"],"ic":"sk-thousandCuts","a":"지금 궁극기 그림"},
  f_ab: {"n":"질풍 일섬","x":6.5,"y":1.75,"d":"융합. 난무 마지막 타가 일섬으로 돌진한다.","a":"두 스킬 그림 이어 붙이기"},
  f_bk: {"n":"섬광 검기","x":6.5,"y":4.25,"d":"융합. 일섬이 지나간 줄에 검기가 남아 터진다.","a":"일섬 궤적 + E43"},
  f_ak: {"n":"칼날 폭풍","x":2.6,"y":0.6,"d":"융합. 회오리가 돌며 검기를 흩뿌린다.","a":"회오리 + E43 방사"},
};
const T7_LANE = { a: { name: '⚡ 연타 갈래', sub: '🛡️ 보호막에 강함', y: [-0.5, 1.4] }, b: { name: '🗡️ 발도 갈래', sub: '🔥 광폭화에 강함', y: [2.05, 3.95] }, k: { name: '🌙 검기 갈래', sub: '👥 졸개에 강함', y: [4.6, 6.5] } };
const T7_KIND = { stat: '스탯', active: '액티브', mod: '변형', key: '키스톤', ult: '궁극기', uvar: '궁극기 변형', fusion: '융합 스킬' };
// 캠프 창(데스크톱 앱 기준 본문 약 330px)에 판이 거의 다 들어오게: 모든 노드 2배, 칸 간격 62×42 → 판 약 760×340.
//  변형·스탯은 위아래로 붙어 있어 이름표를 숨기고(누르면 아래 상세), 액티브·융합·궁극기·키스톤·궁극기 변형만 이름표를 단다
const T7_SCALE = { active: 2, fusion: 2, ult: 2, uvar: 2, mod: 2, key: 2, stat: 2 };
const T7_G = { sx: 62, sy: 42, ox: 34, oy: 28, w: 758, h: 342 };
const t7Px = (id) => [T7_G.ox + T7_UI[id].x * T7_G.sx, T7_G.oy + T7_UI[id].y * T7_G.sy];
const t7Icon = (id) => T7_UI[id].ic || id;
const t7ArtLane = (n) => (n.t === 'fusion' ? 'f' : n.lane);
const t7State = (n) => (t7Rank(n.id) > 0 ? 'got' : t7CanAdd(n.id) ? 'can' : 'lock');
const t7Look = (n) => { const u = T7_UI[n.id], r = t7Rank(n.id); return u.looks && r ? u.looks[r - 1].split(' (')[0] : n.t === 'uvar' ? u.n.replace('천검: ', '') : u.n; };   // 궁극기 변형 이름표는 짧게 (만검·일도양단·검우)
const t7Ui = { sel: null, scroll: null };
// 레드닷: 찍을 수 있는 노드가 있거나 장착 칸을 열 수 있을 때
const t7Dot = () => t7On() && (T7_NODES.some((n) => t7CanAdd(n.id)) || !t7SlotNeed());
const t7Canvas = (attr, id, cls = '') => `<canvas class="t7c ${cls}" data-${attr}="${id}"></canvas>`;
const T7_COL = { c: '#c9b8ff', a: '#ffe08a', b: '#9fe8ff', k: '#ff9a6a' };

function viewTree7() {
  const s = t7S(), left = t7Left(), path = t7PathCost(), spent = t7Spent(), T = t7Tier();
  const head = `<div class="mhead"><div><h3>${ico('glow')} 스킬 트리</h3>
      <small>레벨이 오를 때마다 🌟 1 · 스탯 말고는 찍을 때마다 기술 모양이 바뀌어요 · 장착 칸의 스킬만 전투에 나와요</small></div>
    <span class="mchip${left ? '' : ' none'}" title="남은 스킬 포인트">🌟 <b>${left}</b><small>/ ${t7Pts()}</small></span></div>`;
  // 장착 칸 (순서 = 시전 순서) + 궁극기 칸
  const slots = [];
  for (let i = 0; i < 4; i++) {
    const sk = s.eq[i], n = sk && t7NodeOf(sk);
    if (i >= t7Slots()) {
      const next = i === t7Slots(), need = next ? t7SlotNeed() : null, c = next ? t7SlotCost() : {}, r = T7_SLOTS[i + 1];
      const cost = c.gold ? `<i class="gc"></i> ${fmt(c.gold)}` : c.mana ? `${ico('mana')} ${fmt(c.mana)}` : '';
      const cond = r.tier ? '2차 전직' : `Lv ${r.lv}`;
      slots.push(next && !need
        ? `<button class="t7slot buy${rd(true)}" data-action="t7-slot">🔓 칸 열기 <small>${cost}</small></button>`
        : `<div class="t7slot lock">🔒 ${cond}${next && need ? ` <small>${need}</small>` : ''}${next && cost ? ` <small>${cost}</small>` : ''}</div>`);
    } else slots.push(n ? `<button class="t7slot full" data-action="t7-eq" data-sk="${sk}" title="누르면 해제">${t7Canvas('t7icon', t7Icon(n.id))}<span>${t7Look(n)}</span><small>${t7Rank(n.id)}/${T7_SPEC[n.t].max}</small></button>`
      : '<div class="t7slot">빈 칸</div>');
  }
  const ult = t7Rank('ult') > 0, uv = T7_NODES.find((x) => x.t === 'uvar' && t7Rank(x.id) > 0);
  slots.push(T >= 3 ? `<div class="t7slot ult${ult ? ' full' : ''}">${ult ? t7Canvas('t7icon', uv ? t7Icon(uv.id) : 'sk-thousandCuts') : '★'}<span>${ult ? (uv ? T7_UI[uv.id].n : t7Look(T7_BY.ult)) : '궁극기 칸'}</span></div>` : '<div class="t7slot lock">★ 궁극기 칸 (3차)</div>');
  const pool = T7_NODES.filter((n) => (n.t === 'active' || n.t === 'fusion') && t7Rank(n.id) > 0 && !s.eq.includes(n.sk));
  const poolHtml = pool.length ? `<div class="t7pool"><small>배운 스킬 (누르면 장착)</small>${pool.map((n) => `<button class="t7chip" data-action="t7-eq" data-sk="${n.sk}">${t7Canvas('t7icon', t7Icon(n.id))}${t7Look(n)}</button>`).join('')}</div>` : '';
  const camp = S.phase === 'camp';
  const bar = `<div class="t7bar"><span>쓴 <b>${spent}</b> / ${path} (${Math.round((100 * spent) / path)}%)</span>
    <button class="btn" data-action="t7-reset" ${camp && spent && S.gold >= t7ResetCost() ? '' : 'disabled'} title="찍은 포인트를 모두 돌려받아요 (캠프에서만)">↩ 초기화 <small><i class="gc"></i> ${fmt(t7ResetCost())}</small></button></div>`;
  // 트리 판
  const lanes = Object.entries(T7_LANE).map(([l, v]) => `<div class="t7lane" style="top:${T7_G.oy + v.y[0] * T7_G.sy}px;left:${T7_G.ox + 3.55 * T7_G.sx}px;width:${6.95 * T7_G.sx}px;height:${(v.y[1] - v.y[0]) * T7_G.sy}px"><b class="l-${l}">${v.name}</b> <small>${v.sub} · 쓴 ${t7LanePts(l)}</small></div>`).join('');
  let edges = '';
  const line = (a, b, on, dash, col) => { const [x1, y1] = t7Px(a), [x2, y2] = t7Px(b); edges += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0b0a14" stroke-width="6"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${on ? col : '#3a3348'}" stroke-width="${on ? 3 : 2}"${dash ? ' stroke-dasharray="6 5"' : ''}/>`; };
  for (const n of T7_NODES) for (const r of n.req) line(r, n.id, t7Rank(r) > 0 && t7Rank(n.id) > 0, false, T7_COL[n.lane || 'c']);
  const anchor = { a: 'whirl', b: 'flash', k: 'storm' };
  for (const n of T7_NODES.filter((x) => x.t === 'fusion')) for (const l of n.lanes) line(anchor[l], n.id, t7Rank(n.id) > 0, true, '#ff9ff3');
  const LN = { a: '연타', b: '발도', k: '검기' };
  const nodes = T7_NODES.map((n) => {
    const [x, y] = t7Px(n.id), r = t7Rank(n.id), mx = T7_SPEC[n.t].max, st = t7State(n);
    const gate = !r && n.t === 'fusion' ? ' · ' + n.lanes.map((l) => `${LN[l]} ${Math.min(6, t7LanePts(l))}/6`).join(' ') : !r && n.min ? ` ${Math.min(n.min, t7LanePts(n.lane))}/${n.min}` : '';   // 3차 키스톤: 그 갈래 포인트 (갈래 이름은 띠에 있다)
    const col = n.t === 'fusion' ? '#ff9ff3' : n.t === 'ult' ? '#ffd257' : T7_COL[n.lane || 'c'];
    return `<button class="t7n ${n.t} ${st}${t7Ui.sel === n.id ? ' sel' : ''}${n.t === 'fusion' && T7_UI[n.id].x < 4 ? ' lbl-l' : ''}" style="left:${x}px;top:${y}px;--c:${col}" data-action="t7-sel" data-id="${n.id}" aria-label="${T7_UI[n.id].n}">${t7Canvas('t7node', n.id)}<i class="rk">${t7Look(n)}${mx > 1 ? ` ${r}/${mx}` : ''}${gate}</i></button>`;
  }).join('');
  const pairs = ['pa', 'pb', 'pk'].map((p) => { const [u, v] = T7_NODES.filter((n) => n.pair === p), [x1, y1] = t7Px(u.id), [x2, y2] = t7Px(v.id); return `<span class="t7pair" style="left:${(x1 + x2) / 2 + 34}px;top:${(y1 + y2) / 2}px">택1</span>`; }).join('');
  const board = `<div class="t7wrap" id="t7wrap"><div class="t7board" style="width:${T7_G.w}px;height:${T7_G.h}px">${lanes}<svg class="t7edges" width="${T7_G.w}" height="${T7_G.h}">${edges}</svg>${nodes}${pairs}</div></div>`;
  const hint = !spent && left ? `<div class="gtip big">🌟 스킬 포인트가 ${left}개 있어요 — 빛나는 노드를 누르고 <b>찍기</b>를 눌러 보세요. 이번 캠프에서 찍은 칸은 무료로 되돌릴 수 있어요.</div>` : '';
  return `${head}${hint}<div class="t7slots">${slots.join('')}</div>${poolHtml}${bar}${board}${viewTree7Detail()}`;
}
function viewTree7Detail() {
  const id = t7Ui.sel;
  if (!id || !T7_BY[id]) return '<div class="t7detail"><small>노드를 누르면 여기에 하는 일·칸마다 모습·찍기 버튼이 나와요. 판은 옆으로 밀어서 볼 수 있어요.</small></div>';
  const n = T7_BY[id], u = T7_UI[id], r = t7Rank(id), mx = T7_SPEC[n.t].max, cost = T7_SPEC[n.t].cost;
  let why = '';
  if (!t7Open(n)) {
    if (t7Tier() < n.tier) why = `${['', '1차 (검사)', '2차 (검성)', '3차 (검신)'][n.tier]} 전직 필요`;
    else if (n.t === 'fusion') why = n.lanes.map((l) => `${T7_LANE[l].name} ${t7LanePts(l)}/6`).join(' · ') + ' 포인트 필요';
    else if (n.t === 'uvar' && T7_NODES.some((x) => x.t === 'uvar' && x.id !== id && t7Rank(x.id) > 0)) why = '궁극기 변형은 하나만 — 초기화해야 바꿀 수 있어요';
    else if (t7PairTaken(n)) why = `택1 — ${T7_UI[T7_NODES.find((x) => x.pair === n.pair && x.id !== id).id].n} 를 골랐어요 (초기화해야 바꿀 수 있어요)`;
    else if (n.min && t7LanePts(n.lane) < n.min) why = `이 갈래에 ${n.min}포인트 필요 (지금 ${t7LanePts(n.lane)})`;
    else why = `앞 노드 필요: ${n.req.map((x) => T7_UI[x].n).join(' 또는 ')}`;
  } else if (r < mx && t7Left() < cost) why = `🌟 ${cost} 필요 (남은 ${t7Left()})`;
  const kind = T7_KIND[n.t] + (u.new ? ' · 새 스킬' : '') + (n.pair ? ' · 택1' : '');
  const looks = u.looks ? `<ol class="t7looks">${u.looks.map((l, i) => `<li class="${i === r - 1 ? 'on' : ''}">${i + 1}칸 · ${l}</li>`).join('')}</ol>` : '';
  const sk = n.sk, camp = S.phase === 'camp';
  // 모습 고르기: 칸이 연 모습 안에서 낮은 모습으로 (위력·쿨은 그대로)
  const maxSt = sk ? T7_STAGE_AT[Math.min(5, r)] || 0 : 0, use = sk ? t7Stage(sk) : 0;
  const stageCtl = sk && r && maxSt ? `<span class="srem" title="전투에 쓸 모습 — 칸이 연 모습 안에서 고르고, 위력·쿨은 그대로">
      <button data-action="t7-use" data-sk="${sk}" data-s="${use - 1}" ${use > 0 ? '' : 'disabled'}>‹</button><span class="stars">${[1, 2, 3].map((i) => `<i class="${i <= maxSt ? (i <= use ? 'on' : 'have') : 'lock'}">${i <= maxSt ? '★' : '☆'}</i>`).join('')}</span>
      <button data-action="t7-use" data-sk="${sk}" data-s="${use + 1}" ${use < maxSt ? '' : 'disabled'}>›</button></span>` : '';
  const prev = sk && r ? `<button class="btn mprev" data-action="preview" data-id="${sk}" ${camp ? '' : 'disabled'} title="${camp ? '아래 기사가 지금 모습으로 한 번 시전해요 (피해 없음)' : '캠프에 있을 때만 볼 수 있어요'}">▶ 비주얼 확인</button>` : '';
  const canUndo = (t7S().camp[id] || 0) > 0;
  const btns = `<div class="t7act">
      <button class="btn${rd(t7CanAdd(id))}" data-action="t7-add" data-id="${id}" ${t7CanAdd(id) ? '' : 'disabled'}>${r ? '+1칸' : '찍기'} <small>🌟 ${cost}</small></button>
      <button class="btn" data-action="t7-undo" data-id="${id}" ${canUndo ? '' : 'disabled'} title="이번 캠프에서 찍은 칸만 무료로 되돌려요">↩ 되돌리기</button>${prev}${stageCtl}</div>`;
  return `<div class="t7detail">
    <div class="t7dh">${t7Canvas('t7node', id, 'big')}<div><b>${u.n}</b> <small>${kind} · 🌟 ${cost}${mx > 1 ? ` / 칸 · ${r}/${mx}칸` : r ? ' · 찍음' : ''}</small></div></div>
    <p>${u.d}</p>${u.cost ? `<p class="t7cost">대가: ${u.cost}</p>` : ''}${looks}${why ? `<p class="t7why">🔒 ${why}</p>` : ''}${btns}</div>`;
}
// renderCamp 뒤: 노드·아이콘 canvas 를 도트로 칠하고, 트리 판 가로 위치를 되살린다
function paintTree7(root) {
  if (!root || !window.TreeArt) return;
  const wrap = root.querySelector('#t7wrap');
  if (!wrap) return;
  if (t7Ui.scroll != null) wrap.scrollLeft = t7Ui.scroll;
  wrap.onscroll = () => { t7Ui.scroll = wrap.scrollLeft; };
  const go = () => {
    root.querySelectorAll('canvas[data-t7node]').forEach((cv) => {
      const n = T7_BY[cv.dataset.t7node], k = T7_SCALE[n.t];
      TreeArt.paint(cv, n.t, t7Icon(n.id), t7State(n), t7ArtLane(n), t7Rank(n.id), T7_SPEC[n.t].max);
      cv.style.width = cv.width * k + 'px'; cv.style.height = cv.height * k + 'px';
    });
    root.querySelectorAll('canvas[data-t7icon]').forEach((cv) => { TreeArt.paintIcon(cv, cv.dataset.t7icon); cv.style.width = cv.style.height = '28px'; });
  };
  go();
  TreeArt.ready().then(go);   // 아이콘 시트를 처음 불러오는 중이면 다 받은 뒤 한 번 더
}
// 버튼 동작 — ui.js 가 ACTIONS 를 만든 뒤 이어 붙인다 (이 파일은 ui.js 앞에 불러온다: ui.js 가 불러오자마자 부팅하며 t7Dot 을 부른다)
const T7_ACTIONS = ({
  't7-sel': (el) => { t7Ui.sel = t7Ui.sel === el.dataset.id ? null : el.dataset.id; },
  't7-add': (el) => {
    const id = el.dataset.id, n = T7_BY[id], before = t7Rank(id);
    if (!t7Add(id)) return;
    const u = T7_UI[id];
    if (u.looks && before >= 1 && u.looks[before] !== u.looks[before - 1]) toast(`✨ ${u.n} ${before + 1}칸 — 모습이 「${u.looks[before]}」로 바뀌었어요`, 4000);
    else if (!before && (n.t === 'active' || n.t === 'fusion')) toast(`✨ ${u.n} 배움${t7S().eq.includes(n.sk) ? ' — 장착 칸에 넣었어요' : ' — 장착 칸이 모자라요. 배운 스킬에서 눌러 바꿔 끼우세요'}`, 4000);
    else if (!before && n.t !== 'stat') toast(`✨ ${u.n} — 다음 원정부터 바로 적용돼요`, 3000);
  },
  't7-undo': (el) => { if (!t7Undo(el.dataset.id)) toast('다른 노드가 이 노드를 거쳐 열려 있어서 되돌릴 수 없어요'); },
  't7-reset': () => { if (t7Reset()) { t7Ui.sel = null; toast('↩ 트리를 초기화했어요 — 포인트를 모두 돌려받았어요', 4000); } },
  't7-slot': () => { if (t7BuySlot()) toast(`🔓 장착 칸 ${t7Slots()}칸`, 3000); },
  't7-eq': (el) => { if (!t7Equip(el.dataset.sk)) toast('장착 칸이 다 찼어요 — 장착한 스킬을 눌러 먼저 빼세요'); },
  't7-use': (el) => { const s = t7S(); s.use[el.dataset.sk] = Number(el.dataset.s); },
});

// 귀환 보고: 보스 벽 (4단계) — 뚫었으면 큰 배너, 막혔으면 기믹과 추천 갈래 한 줄
function t7WallReport(r) {
  const out = [];
  for (const st of r.wallBreak || []) out.push(`<div class="reason t7-break">⚔️ 벽 돌파! ${st}스테이지 ${st % 20 ? '중간' : '지역'} 보스를 쓰러뜨렸습니다</div>`);
  const w = r.wall;
  if (w) {
    const tip = t7WallTip(w), g = w.gims.map((x) => T7_GIM[x].icon + ' ' + T7_GIM[x].name).join(' · ');
    out.push(`<div class="reason warn">👑 ${esc(MONSTERS[w.type] ? MONSTERS[w.type].name : '보스')} 체력 ${Math.round(w.left * 100)}% 까지 · ${g}${tip ? ` — 추천: ${tip.icon} ${esc(tip.tip)}` : ''}</div>`);
  }
  return out.join('');
}
