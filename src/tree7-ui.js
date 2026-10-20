'use strict';
// 시즌7 스킬 빌드 트리 — 게임 스킬 탭 화면. 2안 (docs/specs/skill-tree-v3.md): 판 = 스킬 지도, 스킬 안 = 위력 / 모습 / 변형 3줄.
// 캐릭터 → 스킬 서브탭이 이 화면이 된다 (ui.js viewSkill 첫 줄).
//  위: 남은 🌟 · 장착 칸(1~4 + 궁극기, 칸 열기) · 배운 스킬 · 쓴 포인트 · ↩ 되돌리기 · 초기화
//  가운데: 스킬 지도 (메인 스킬에서 길 위 스탯 점을 따라 줄 3개). **누르면 바로 찍힌다** — 점·키스톤 = 찍기, 스킬 = 배우기/위력 +1 Lv (최대면 열어 보기만)
//  아래: 고른 스킬의 위력(Lv 눈금) · 모습(★ 카드, 누르면 찍기 · 쓸 모습 고르기 · ▶ 비주얼 확인) · 변형(카드, 택1은 "또는")
// 노드 그림은 src/tree7-art.js 가 canvas 에 도트로 그린다 (CSP 가 data: 이미지를 막는다) — renderCamp 뒤 paintTree7 이 칠한다.

// id → { n 이름, d 설명, cost 키스톤 대가, looks 옛 칸마다 모습 이름(0·1·3·4 번째가 기본·★·★★·★★★), ic 아이콘(없으면 id 로 tree7-art 그림), new 새 스킬 }
const T7_UI = {
  slash: {"n":"강철 베기","d":"1차 스킬 (검사 계열 공용 줄기). 앞을 크게 내려벤다.","looks":["강철 베기","강철 검풍","강철 검풍 (범위 +20%)","강철 대검","천강검"],"ic":"sk-steelCleave","a":"지금 그림 (★ 진화 모습 그대로)"},
  s_twin: {"n":"2연참","d":"강철 베기가 한 번 더 반대로 벤다 (두 번째 타 60%)","a":"같은 궤적 좌우 반전"},
  k_blade: {"n":"검의 길","d":"평타 3타마다 칼날이 번쩍이며 모든 스킬 쿨 −0.5초.","cost":"스킬 피해 −10%"},
  gale: {"n":"질풍난무","d":"적 사이를 지그재그로 오가며 벤다 (지금 검성 스킬).","looks":["삼연참","질풍난무","질풍난무 (타격 이펙트 커짐)","질풍난무·분신","월하난무"],"ic":"sk-gale","a":"지금 그림"},
  a_more: {"n":"난무 +3타","d":"타수 +3 (타당 피해 −15%) — 보호막에 강함","a":"같은 궤적 반복"},
  a_bleed: {"n":"출혈","d":"베인 적이 3초간 피를 흘린다 (붉은 점멸 + 지속 피해 40%)","a":"맞은 적 붉은 램프 점멸"},
  whirl: {"n":"검무 회오리","d":"새 스킬. 칼날 회오리가 4초간 기사 주위를 돌며 벤다.","looks":["검무","쌍 회오리","쌍 회오리 (크기 +20%)","칼날 회오리","천검무"],"a":"화염 회오리 시트(E35)를 은색 램프로","new":1,"ref":["pyromancer","flameVortex"]},
  a_follow: {"n":"쫓는 칼날","d":"회오리가 가장 가까운 적에게 날아가 붙는다 — 졸개·먼 적","a":"같은 시트, 이동 궤적만"},
  a_grow: {"n":"제자리 폭풍","d":"회오리가 움직이지 않고 그 자리에서 2배로 커진다 — 붙어 있는 보스","a":"같은 시트 ×2 크기"},
  a_key: {"n":"광란","d":"스킬이 맞힐 때마다 공속 +4% (최대 +40%), 몸에 붉은 기운이 짙어진다. 3초 안 맞히면 초기화.","cost":"평타 피해 −15%"},
  a_k3: {"n":"무한검","d":"3차. 질풍난무가 끝나면 30% 확률로 한 번 더 (분신이 이어 받는다).","cost":"질풍난무 쿨 +25%"},
  uv_a: {"n":"천검: 만검","d":"궁극기 변형 (셋 중 하나). 천검이 작은 칼날 수십 개로 쏟아진다 — 보호막에 강함","a":"천검 그림 작게 × 반복"},
  iaido: {"n":"일섬","d":"한 줄기 섬광으로 지나가며 벤다, 반드시 치명 (지금 검성 스킬).","looks":["발도","일섬","일섬 (검선 길어짐)","일섬·납도","적월일섬"],"ic":"sk-iaido","a":"지금 그림"},
  b_reset: {"n":"잔영","d":"일섬으로 처치하면 잔상이 되돌아와 가장 가까운 적을 한 번 더 벤다 (50%)","a":"기사 잔상 (반투명) + 같은 궤적"},
  b_exec: {"n":"처형","d":"체력 25% 이하 적은 일섬에 두 동강 (붉은 섬광, 보스는 피해 +100%)","a":"명중 섬광 붉은 램프"},
  flash: {"n":"섬광 베기","d":"새 스킬. 잠깐 멈췄다가 화면 끝까지 한 줄로 베어 지나간다.","looks":["섬광","섬광 베기","섬광 베기 (화면 멈춤 길어짐)","뇌광","천섬"],"a":"일섬 궤적을 길게 + 화면 정지","new":1,"ref":["blademaster","iaido"]},
  b_after: {"n":"잔상 베기","d":"0.5초 뒤 잔상이 같은 줄을 한 번 더 벤다 (50%) — 한 줄 강하게","a":"같은 궤적 반투명"},
  b_triple: {"n":"삼중 섬광","d":"한 줄 대신 위·가운데·아래 세 줄 (줄마다 45%) — 넓게","a":"같은 궤적 ×3"},
  b_key: {"n":"발도술","d":"일섬·섬광 베기 치명 피해 +50%, 칼을 거둘 때 금빛 섬광.","cost":"두 스킬 쿨 +30%"},
  b_k3: {"n":"무념","d":"3차. 모든 피해 +160%, 화면이 흑백으로 가라앉았다가 벤다.","cost":"치명 확률 0 (확정 치명 스킬도 일반타)"},
  uv_b: {"n":"천검: 일도양단","d":"궁극기 변형 (셋 중 하나). 하나의 거대한 칼이 화면을 가른다 — 광폭화에 강함","a":"천검 그림 ×2 크기, 한 번만"},
  wave: {"n":"비검","d":"새 스킬. 초승달 검기를 부채꼴로 날린다.","looks":["비검","삼연 비검","삼연 비검 (사거리 +20%)","오연 비검","비검 난무"],"a":"E43 참격을 투사체로","new":1,"ref":["swordsman","steelCleave",1]},
  k_wave: {"n":"참격파","d":"강철 베기 끝에도 검기가 한 발 날아간다","a":"E43"},
  k_pierce: {"n":"관통","d":"검기가 적을 뚫고 지나간다 (뚫을 때마다 −20%)","a":"같은 시트, 충돌만 바뀜"},
  storm: {"n":"검기 폭풍","d":"새 스킬. 사방으로 검기를 뿜는다.","looks":["검기 방사","팔방 검기","팔방 검기 (크기 +20%)","검기 폭풍","검기 대폭풍"],"a":"E43 방사형","new":1,"ref":["swordsman","steelCleave",2]},
  k_split: {"n":"분열","d":"검기가 처음 맞힌 적에서 두 갈래로 갈라진다 — 졸개 무리","a":"같은 시트 작게 ×2"},
  k_homing: {"n":"유도 검기","d":"검기가 휘어 날아가 가장 강한 적(보스)에 꽂힌다 — 보스 집중","a":"같은 시트, 휘는 궤적"},
  k_key: {"n":"심검","d":"평타가 푸른 검기로 바뀐다 (사거리 3배).","cost":"평타 피해 −20%"},
  k_k3: {"n":"만검귀종","d":"3차. 검기 스킬이 맞힐 때마다 다른 검기 스킬 쿨 −0.3초, 칼날이 기사 주위로 모여든다.","cost":"검기가 아닌 스킬 피해 −20%"},
  uv_k: {"n":"천검: 검우","d":"궁극기 변형 (셋 중 하나). 먹구름에서 검기가 비처럼 넓게 — 졸개에 강함","a":"천검 그림 + E43 낙하"},
  ult: {"n":"천검","d":"검신 궁극기 (궁극기 칸). 갈래 변형 셋 중 하나를 붙일 수 있다.","looks":["천검","천검·만화","천검·만화 (검선 늘어남)","천검·벚꽃폭풍","무명검·천지개벽"],"ic":"sk-thousandCuts","a":"지금 궁극기 그림"},
  f_ab: {"n":"질풍 일섬","d":"융합. 난무 마지막 타가 일섬으로 돌진한다.","a":"두 스킬 그림 이어 붙이기"},
  f_bk: {"n":"섬광 검기","d":"융합. 일섬이 지나간 줄에 검기가 남아 터진다.","a":"일섬 궤적 + E43"},
  f_ak: {"n":"칼날 폭풍","d":"융합. 회오리가 돌며 검기를 흩뿌린다.","a":"회오리 + E43 방사"},
};

const T7_LANE = { a: { name: '⚡ 연타 갈래', sub: '🛡️ 보호막에 강함' }, b: { name: '🗡️ 발도 갈래', sub: '🔥 광폭화에 강함' }, k: { name: '🌙 검기 갈래', sub: '👥 졸개에 강함' } };
// 줄기별 글: 기본(T7_UI = 검성 글) ← 1차 줄기 글(T7_STEMS) ← 줄기 글(T7_LINES[].ui) (src/tree7-l-*.js)
const t7U = (id) => { const L = t7L(), st = L && T7_STEMS[L.cls[0]]; return { ...T7_UI[id], ...(st && st.ui[id]), ...(L && L.ui[id]) }; };
const t7Lane = () => { const L = t7L(), o = {}; for (const l of ['a', 'b', 'k']) o[l] = { ...T7_LANE[l], ...(L && L.lanes && L.lanes[l]) }; return o; };
// 2차 전직 전엔 줄기(1차) 노드만 보인다 — 줄은 2차 직업마다 달라서
const t7Vis = (n) => t7Tier() >= 2 || n.tier <= 1;
const T7_KIND = { stat: '스탯', active: '액티브', mod: '변형', key: '키스톤', ult: '궁극기', uvar: '궁극기 변형', fusion: '융합 스킬', look: '모습' };
const T7_STATN = { atk: '공격 +2%', hp: '체력 +3%', aspd: '공격 속도 +2%', crit: '치명 확률 +1.5%', guard: '받는 피해 −2%' };
// 스킬 지도 자리 (칸 단위). 스탯 점은 노드의 path [앞, 뒤, 몇 번째] 로 두 스킬 사이에 고르게. 캠프 창(본문 약 330px)에 판이 거의 다 들어오게 약 850×340
const T7_MAP = { slash: [0, 2], k_blade: [0.95, 3.6], gale: [2.1, 0.55], iaido: [2.1, 2], wave: [2.1, 3.45], whirl: [4, 0.55], flash: [4, 2], storm: [4, 3.45],
  f_ab: [5.5, 1.28], f_bk: [5.5, 2.72], f_ak: [5.5, 4.15], a_key: [6.85, 0.55], b_key: [6.85, 2], k_key: [6.85, 3.45], a_k3: [7.75, 0.55], b_k3: [7.75, 2], k_k3: [7.75, 3.45], ult: [8.75, 2] };
const T7_G = { sx: 88, sy: 62, ox: 46, oy: 36, w: 46 * 2 + 8.75 * 88, h: 36 + 4.15 * 62 + 52 };
const t7OnMap = (n) => !!T7_MAP[n.id] || n.t === 'stat';
const t7XY = (n) => {
  if (T7_MAP[n.id]) return T7_MAP[n.id];
  const [a, b, i] = n.path, k = T7_NODES.filter((x) => x.path && x.path[0] === a && x.path[1] === b).length, f = (i + 1) / (k + 1), A = T7_MAP[a], B = T7_MAP[b];
  return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
};
const t7Px = (n) => { const [x, y] = t7XY(n); return [T7_G.ox + x * T7_G.sx, T7_G.oy + y * T7_G.sy]; };
const t7Icon = (id) => t7U(id).ic || id;
const t7ArtLane = (n) => (n.t === 'fusion' ? 'f' : n.lane);
const t7State = (n) => (t7Rank(n.id) > 0 ? 'got' : t7CanAdd(n.id) ? 'can' : 'lock');
const t7Max = (n) => T7_SPEC[n.t].max;
// 모습 이름·설명 (단계 0~3): 줄기 글 looks(옛 칸 5개) → 스킬 stageName. 설명은 지금 스킬의 stageDesc (새 스킬은 바탕 스킬 글이라 쓰지 않는다)
const T7_LOOK_IDX = [0, 1, 3, 4];
function t7LookName(n, st) {
  const u = t7U(n.id), k = SKILLS[n.sk];
  if (n.t !== 'fusion' && u.looks && u.looks[T7_LOOK_IDX[st]]) return u.looks[T7_LOOK_IDX[st]].split(' (')[0];
  return (k && k.stageName && k.stageName[st]) || u.n;
}
const t7LookDesc = (n, st) => { const k = SKILLS[n.sk]; return k && !k.t7 && k.stageDesc ? k.stageDesc[st] : ''; };
// 판 이름표 = 지금 쓰는 모습 이름 (궁극기 변형은 궁극기 칸에)
const t7Look = (n) => (n.slot && n.sk && t7Rank(n.id) > 0 ? t7LookName(n, t7Stage(n.sk)) : t7U(n.id).n);   // 안 배운 스킬은 스킬 이름
const t7Ui = { sel: null, scroll: null };
// 스킬 안에서 지금 찍을 수 있는 것 수 (판 노드의 숫자 배지)
const t7Inside = (n) => (t7Rank(n.id) > 0 ? T7_NODES.filter((x) => x.req.includes(n.id) && (x.t === 'look' || x.t === 'mod' || x.t === 'uvar') && t7CanAdd(x.id)).length + (t7Rank(n.id) < t7Max(n) && t7CanAdd(n.id) ? 1 : 0)
  + (T7_LOOKS[n.id] || []).filter((l) => l.req[0] !== n.id && t7CanAdd(l.id)).length : 0);
// 레드닷: 찍을 수 있는 노드가 있거나 장착 칸을 열 수 있을 때
const t7Dot = () => t7On() && (T7_NODES.some((n) => t7CanAdd(n.id)) || !t7SlotNeed());
const t7Canvas = (attr, id, cls = '') => `<canvas class="t7c ${cls}" data-${attr}="${id}"></canvas>`;
const T7_COL = { c: '#c9b8ff', a: '#ffe08a', b: '#9fe8ff', k: '#ff9a6a' };
// 잠긴 이유 (글)
function t7Why(n) {
  const T = t7Tier(), u = t7U(n.id);
  if (T < n.tier) return `${n.tier}차 전직 필요`;
  if (n.reqAll && !n.reqAll.every((r) => t7Rank(r) > 0)) return `${n.reqAll.map((r) => t7U(r).n).join(' + ')} 를 배우면 열려요`;
  if (n.t === 'uvar' && T7_NODES.some((x) => x.t === 'uvar' && x.id !== n.id && t7Rank(x.id) > 0)) return '셋 중 하나만 — 초기화하면 바꿀 수 있어요';
  if (t7PairTaken(n)) return '다른 쪽을 골랐어요 — 초기화하면 바꿀 수 있어요';
  if (n.last && t7Rank(n.of) < t7Max(T7_BY[n.of])) return `위력 Lv${t7Max(T7_BY[n.of])} 필요`;
  if (n.req.length && !n.req.some((r) => t7Rank(r) > 0)) {
    const r = T7_BY[n.req[0]];
    return n.t === 'look' ? '앞 모습 먼저' : r.t === 'stat' ? '앞의 점을 먼저 찍어요' : `${t7U(r.id).n} 먼저`;
  }
  if (t7Rank(n.id) >= t7Max(n)) return '';
  if (t7Left() < t7Cost(n)) return `🌟 ${t7Cost(n)} 필요 (남은 ${t7Left()})`;
  return u ? '' : '';
}

function viewTree7() {
  const s = t7S(), left = t7Left(), path = t7PathCost(), spent = t7Spent(), T = t7Tier();
  const head = `<div class="mhead"><div><h3>${ico('glow')} 스킬 트리</h3>
      <small>레벨이 오를 때마다 🌟 1 · 노드를 누르면 바로 찍혀요 · 스킬을 누르면 아래에 위력·모습·변형</small></div>
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
    } else slots.push(n ? `<button class="t7slot full" data-action="t7-eq" data-sk="${sk}" title="누르면 해제">${t7Canvas('t7icon', t7Icon(n.id))}<span>${t7Look(n)}</span><small>Lv${t7Rank(n.id)}</small></button>`
      : '<div class="t7slot">빈 칸</div>');
  }
  const ult = t7Rank('ult') > 0, uv = T7_NODES.find((x) => x.t === 'uvar' && t7Rank(x.id) > 0);
  slots.push(T >= 3 ? `<div class="t7slot ult${ult ? ' full' : ''}">${ult ? t7Canvas('t7icon', uv ? t7Icon(uv.id) : t7Icon('ult')) : '★'}<span>${ult ? (uv ? t7U(uv.id).n : t7Look(T7_BY.ult)) : '궁극기 칸'}</span></div>` : '<div class="t7slot lock">★ 궁극기 칸 (3차)</div>');
  const pool = T7_NODES.filter((n) => (n.t === 'active' || n.t === 'fusion') && t7Rank(n.id) > 0 && !s.eq.includes(n.sk));
  const poolHtml = pool.length ? `<div class="t7pool"><small>배운 스킬 (누르면 장착)</small>${pool.map((n) => `<button class="t7chip" data-action="t7-eq" data-sk="${n.sk}">${t7Canvas('t7icon', t7Icon(n.id))}${t7Look(n)}</button>`).join('')}</div>` : '';
  const camp = S.phase === 'camp', undo = (s.log || []).length;
  const bar = `<div class="t7bar"><span>쓴 <b>${spent}</b> / ${path} (${Math.round((100 * spent) / path)}%)</span>
    <span><button class="btn" data-action="t7-back" ${undo ? '' : 'disabled'} title="이번 캠프에서 찍은 것을 마지막 것부터 무료로 되돌려요">↩ 되돌리기</button>
    <button class="btn" data-action="t7-reset" ${camp && spent && S.gold >= t7ResetCost() ? '' : 'disabled'} title="찍은 포인트를 모두 돌려받아요 (캠프에서만)">초기화 <small><i class="gc"></i> ${fmt(t7ResetCost())}</small></button></span></div>`;
  // 스킬 지도
  const vis = T7_NODES.filter((n) => t7OnMap(n) && t7Vis(n));
  const lanes = T < 2 ? '' : Object.entries(t7Lane()).map(([l, v]) => { const y = T7_MAP[{ a: 'gale', b: 'iaido', k: 'wave' }[l]][1]; return `<div class="t7lane" style="top:${T7_G.oy + y * T7_G.sy - 30}px;left:${T7_G.ox + 2.75 * T7_G.sx}px"><b class="l-${l}">${v.name.replace(/ 갈래$/, '')}</b> <small>${v.sub}</small></div>`; }).join('');
  let edges = '';
  const line = (a, b, on, dash, col) => { const [x1, y1] = t7Px(a), [x2, y2] = t7Px(b); edges += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0b0a14" stroke-width="7"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${on ? col : '#3a3348'}" stroke-width="${on ? 4 : 2}"${dash ? ' stroke-dasharray="7 6"' : ''}/>`; };
  for (const n of vis) {
    for (const r of n.reqAll || n.req) { const p = T7_BY[r]; if (p && t7OnMap(p) && t7Vis(p)) line(p, n, t7Rank(r) > 0 && t7Rank(n.id) > 0, !!n.reqAll, n.reqAll ? '#ff9ff3' : T7_COL[n.t === 'stat' ? T7_BY[n.path[1]].lane : n.lane || 'c']); }
  }
  const nodes = vis.map((n) => {
    const [x, y] = t7Px(n), r = t7Rank(n.id), st = t7State(n), skill = !!n.slot;
    const col = n.t === 'fusion' ? '#ff9ff3' : n.t === 'ult' ? '#ffd257' : T7_COL[n.lane || 'c'];
    if (n.t === 'stat') return `<button class="t7n stat ${st}" style="left:${x}px;top:${y}px" data-action="t7-tap" data-id="${n.id}" title="${T7_STATN[Object.keys(n.fx.stat)[0]]}" aria-label="${T7_STATN[Object.keys(n.fx.stat)[0]]}">${t7Canvas('t7node', n.id)}</button>`;
    const b = skill ? t7Inside(n) : 0, sub = skill && r ? `Lv${r}${t7StageMax(n.sk) ? ' ' + '★'.repeat(t7StageMax(n.sk)) : ''}` : n.tier === 3 && n.t === 'key' ? '3차' : '';
    const tag = n.free ? `<span class="t7tag">${n.t === 'ult' ? '3차' : '시작'}</span>` : '';
    return `<button class="t7n ${n.t} ${st}${t7Ui.sel === n.id ? ' sel' : ''}" style="left:${x}px;top:${y}px;--c:${col}" data-action="t7-tap" data-id="${n.id}" aria-label="${t7U(n.id).n}">${t7Canvas('t7node', n.id)}${tag}${b ? `<span class="t7badge">${b}</span>` : ''}<i class="rk">${t7Look(n)}${sub ? `<small>${sub}</small>` : ''}</i></button>`;
  }).join('');
  const board = `<div class="t7wrap" id="t7wrap"><div class="t7board" style="width:${T7_G.w}px;height:${T7_G.h}px">${lanes}<svg class="t7edges" width="${T7_G.w}" height="${T7_G.h}">${edges}</svg>${nodes}</div></div>`;
  const moved = s.moved === 'reset' ? '<div class="gtip big">🔄 스킬 트리 구조가 바뀌어 찍은 포인트를 모두 돌려드렸어요 (초기화 1회 무료). 노드를 누르면 바로 찍혀요.</div>'
    : s.moved === 'ok' ? '<div class="gtip">🔄 스킬 트리가 바뀌었어요 — 스킬 Lv 은 위력·쿨만, 모습(★)과 변형은 스킬을 눌러 아래에서 찍어요. 찍은 것은 그대로 옮겼어요.</div>' : '';
  const auto = s.auto !== false ? `<div class="gtip">🤖 아직 직접 찍지 않아 남은 포인트를 추천 순서로 자동으로 찍고 있어요 — 한 칸이라도 직접 찍으면 자동이 꺼져요.${s.free ? ' 첫 초기화는 무료예요.' : ''}</div>` : '';
  const tier1 = T < 2 ? '<div class="gtip">2차 전직하면 점 길 끝에 그 직업의 스킬 줄 3개가 열려요.</div>' : '';
  const hint = !spent && left && !moved ? `<div class="gtip big">🌟 스킬 포인트가 ${left}개 있어요 — 빛나는 노드를 누르면 바로 찍혀요. 잘못 찍었으면 ↩ 되돌리기.</div>` : '';
  return `${head}${moved}${auto}${tier1}${hint}<div class="t7slots">${slots.join('')}</div>${poolHtml}${bar}${board}${viewTree7Detail()}`;
}
// 아래 상세: 스킬 = 위력 / 모습 / 변형 3줄, 키스톤 = 설명 + 대가
function viewTree7Detail() {
  const id = t7Ui.sel, n = id && T7_BY[id];
  if (!n || !t7OnMap(n) || n.t === 'stat') return '<div class="t7detail"><small>노드를 누르면 바로 찍혀요. 스킬을 누르면 여기에 위력 · 모습 · 변형이 나와요. 판은 옆으로 밀어서 볼 수 있어요.</small></div>';
  const u = t7U(id), r = t7Rank(id), camp = S.phase === 'camp', why = t7Why(n);
  const top = `<div class="t7dh">${t7Canvas('t7node', id, 'big')}<div><b>${u.n}</b> <small>${n.t === 'active' && n.free ? '메인 스킬' : T7_KIND[n.t]}${u.new ? ' · 새 스킬' : ''}${n.t === 'key' ? ` · 🌟 ${t7Cost(n)}` : ''}</small><small>${u.d || ''}</small></div></div>`;
  if (!n.slot) return `<div class="t7detail">${top}${u.cost ? `<p class="t7cost">대가: ${u.cost}</p>` : ''}${why && !r ? `<p class="t7why">🔒 ${why}</p>` : ''}
    <div class="t7act"><button class="btn${rd(t7CanAdd(id))}" data-action="t7-add" data-id="${id}" ${t7CanAdd(id) ? '' : 'disabled'}>${r ? '✓ 찍음' : `찍기 🌟 ${t7Cost(n)}`}</button></div></div>`;
  // ① 위력
  const mx = t7Max(n), R = n.t === 'fusion' ? T7_FUSE : T7_RANK, L = Math.max(1, r);
  const pips = Array.from({ length: mx }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('');
  const lvRow = `<div class="t7sec"><span class="t7lab">위력</span><div><span class="t7pips">${pips}</span> Lv ${r}/${mx} · 위력 ×${(1 + R.pow * (L - 1)).toFixed(2)} · 쿨 ×${(1 - R.cd * (L - 1)).toFixed(2)}
    <button class="btn${rd(t7CanAdd(id))}" data-action="t7-add" data-id="${id}" ${t7CanAdd(id) ? '' : 'disabled'}>${r ? '+1 Lv' : '배우기'} <small>🌟 ${t7Cost(n)}</small></button>${why && r < mx ? ` <small class="t7why">${why}</small>` : ''}
    <small class="t7note">Lv 마다 위력 +${Math.round(R.pow * 100)}% · 쿨 −${Math.round(R.cd * 100)}% — 모습은 바뀌지 않아요${n.free && !t7S().rk[id] ? ' · 1Lv 은 공짜' : ''}</small></div></div>`;
  // ② 모습
  const sk = n.sk, maxSt = t7StageMax(sk), use = t7Stage(sk);
  const cards = [`<div class="t7card base${r ? ' got' : ''}"><b>기본 · ${t7LookName(n, 0)}</b><small>${t7LookDesc(n, 0)}</small></div>`].concat((T7_LOOKS[id] || []).map((l) => {
    const got = t7Rank(l.id) > 0, w = got ? '' : t7Why(l), can = t7CanAdd(l.id);
    return `<span class="t7arrow">→</span><button class="t7card ${got ? 'got' : can ? 'can' : 'lock'}${rd(can)}" data-action="t7-add" data-id="${l.id}" ${can ? '' : 'disabled'}><b>${'★'.repeat(l.st)} ${t7LookName(n, l.st)}</b><small>${t7LookDesc(n, l.st) || '그림·타격 범위가 커진다'}</small><small>${got ? '✓ 찍음' : `🌟 ${t7Cost(l)}`}${w ? ` · <span class="t7why">${w}</span>` : ''}</small></button>`;
  })).join('');
  const stageCtl = maxSt ? `<span class="srem" title="전투에 쓸 모습 — 찍은 모습 안에서 고르고, 위력·쿨은 그대로">쓸 모습
      <button data-action="t7-use" data-sk="${sk}" data-s="${use - 1}" ${use > 0 ? '' : 'disabled'}>‹</button><span class="stars">${[1, 2, 3].map((i) => `<i class="${i <= maxSt ? (i <= use ? 'on' : 'have') : 'lock'}">${i <= maxSt ? '★' : '☆'}</i>`).join('')}</span>
      <button data-action="t7-use" data-sk="${sk}" data-s="${use + 1}" ${use < maxSt ? '' : 'disabled'}>›</button></span>` : '';
  const prev = r ? `<button class="btn mprev" data-action="preview" data-id="${sk}" ${camp ? '' : 'disabled'} title="${camp ? '아래 기사가 지금 모습으로 한 번 시전해요 (피해 없음)' : '캠프에 있을 때만 볼 수 있어요'}">▶ 비주얼 확인</button>` : '';
  const lookRow = `<div class="t7sec"><span class="t7lab">모습</span><div><div class="t7cards">${cards}</div><div class="t7act">${prev}${stageCtl}<small class="t7note">찍으면 시전 그림·타격 범위가 바뀌어요. 마지막 모습만 위력 Lv${mx} 필요</small></div></div></div>`;
  // ③ 변형 (택1은 "또는", 궁극기는 셋 중 하나)
  const mods = T7_NODES.filter((x) => (x.t === 'mod' || x.t === 'uvar') && x.req.includes(id));
  let prevPair = null;
  const modCards = mods.map((x) => {
    const got = t7Rank(x.id) > 0, can = t7CanAdd(x.id), w = got ? '' : t7Why(x), g = x.t === 'uvar' ? 'uv' : x.pair, xu = t7U(x.id);
    const or = g && prevPair === g ? '<span class="t7or">또는</span>' : '';
    prevPair = g || null;
    return `${or}<button class="t7card ${got ? 'got' : can ? 'can' : 'lock'}${rd(can)}" data-action="t7-add" data-id="${x.id}" ${can ? '' : 'disabled'}><b>${xu.n}</b><small>${xu.d}</small><small>${got ? '✓ 찍음' : `🌟 ${t7Cost(x)}`}${w ? ` · <span class="t7why">${w}</span>` : ''}</small></button>`;
  }).join('');
  const modRow = mods.length ? `<div class="t7sec"><span class="t7lab">변형${n.t === 'ult' ? '<small>셋 중 하나</small>' : ''}</span><div><div class="t7cards">${modCards}</div></div></div>` : '';
  return `<div class="t7detail">${top}${!r && why ? `<p class="t7why">🔒 ${why}</p>` : ''}${lvRow}${lookRow}${modRow}</div>`;
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
      const n = T7_BY[cv.dataset.t7node], k = n.t === 'stat' ? 2 : cv.classList.contains('big') ? 2 : n.t === 'key' ? 1.8 : 2.2;
      if (n.t === 'stat') TreeArt.paint(cv, 'dot', null, t7State(n));
      else TreeArt.paint(cv, n.t, t7Icon(n.id), t7State(n), t7ArtLane(n), n.slot ? t7Rank(n.id) : 0, n.slot ? t7Max(n) : 1);
      cv.style.width = cv.width * k + 'px'; cv.style.height = cv.height * k + 'px';
    });
    root.querySelectorAll('canvas[data-t7icon]').forEach((cv) => { TreeArt.paintIcon(cv, cv.dataset.t7icon); cv.style.width = cv.style.height = '28px'; });
  };
  go();
  TreeArt.ready().then(go);   // 아이콘 시트를 처음 불러오는 중이면 다 받은 뒤 한 번 더
}
// 찍기 공통 (판 누르기 · 상세 카드). 이번 캠프 기록(s.log)에 쌓아 ↩ 되돌리기가 마지막 것부터 되돌린다
function t7Buy(id) {
  const n = T7_BY[id], before = t7Rank(id);
  if (!t7Add(id)) return false;
  const s = t7S();
  s.auto = false; s.moved = null;   // 직접 찍었으니 자동 찍기 끝 (src/tree7.js t7AutoTick)
  (s.log = s.log || []).push(id);
  const u = t7U(id);
  if (n.t === 'look') toast(`✨ ${t7U(n.of).n} — 모습이 「${t7LookName(T7_BY[n.of], n.st)}」로 바뀌었어요`, 4000);
  else if (!before && (n.t === 'active' || n.t === 'fusion')) toast(`✨ ${u.n} 배움${s.eq.includes(n.sk) ? ' — 장착 칸에 넣었어요' : ' — 장착 칸이 모자라요. 배운 스킬에서 눌러 바꿔 끼우세요'}`, 4000);
  else if (n.slot) toast(`${u.n} 위력 Lv${before + 1}`, 2000);
  else if (n.t === 'stat') toast(`· ${T7_STATN[Object.keys(n.fx.stat)[0]]}`, 1500);
  else toast(`✨ ${u.n} — 다음 원정부터 바로 적용돼요`, 3000);
  return true;
}
// 버튼 동작 — ui.js 가 ACTIONS 를 만든 뒤 이어 붙인다 (이 파일은 ui.js 앞에 불러온다: ui.js 가 불러오자마자 부팅하며 t7Dot 을 부른다)
const T7_ACTIONS = ({
  // 판 노드: 누르면 바로 찍는다 (스킬은 아래 상세도 연다). 못 찍으면 이유를 한 줄
  't7-tap': (el) => {
    const id = el.dataset.id, n = T7_BY[id];
    if (n.t !== 'stat') t7Ui.sel = id;
    if (t7CanAdd(id)) { t7Buy(id); return; }
    if (n.t === 'stat' && !(t7Rank(id) > 0)) toast(`🔒 ${t7Why(n) || '찍을 수 없어요'}`, 2500);
  },
  't7-add': (el) => { t7Buy(el.dataset.id); },
  // 되돌리기: 이번 캠프에서 찍은 것을 마지막 것부터 (다른 것이 기대고 있으면 못 뺀다)
  't7-back': () => {
    const s = t7S(), id = (s.log || []).slice(-1)[0];
    if (!id) return;
    if (t7Undo(id)) { s.log.pop(); toast(`↩ ${T7_BY[id].t === 'stat' ? '스탯 점' : t7U(T7_BY[id].of || id).n} 되돌림`, 2000); }
    else toast('다른 노드가 이 노드를 거쳐 열려 있어서 되돌릴 수 없어요');
  },
  't7-reset': () => { if (t7Reset()) { t7Ui.sel = null; t7S().log = []; toast('↩ 트리를 초기화했어요 — 포인트를 모두 돌려받았어요', 4000); } },
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
