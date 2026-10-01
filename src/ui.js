'use strict';
// HUD, 캠프 말풍선, 캠프 창(정산·마을·훈련·보급·랭킹·출정), 계정 창, 그리고 부팅/메인 루프.

const $ = (id) => document.getElementById(id);
let campOpen = false;
let acctOpen = false;                 // 계정 창 (첫 실행 닉네임 입력 · 계정 변경)
let campTab = 'report';
let revealed = [];                    // 이번에 캠프 창에서 챙긴 전리품들 [{ it, got, fresh }]
let openAllTimer = null;
const departOpts = { charm: false, elixir: false };

// ───────────────────────── 클릭 통과 제어 ─────────────────────────
// 평소엔 HUD/말풍선 위에서만 클릭을 받고, 캠프 창이 열리면 창 전체가 클릭을 받는다.
let interactive = false;
function setInteractive(on) {
  if (on === interactive) return;
  interactive = on;
  if (window.bar) window.bar.setInteractive(on);
}
const modalOpen = () => campOpen || acctOpen;
document.addEventListener('mousemove', (e) => { if (!modalOpen()) setInteractive(!!e.target.closest('.interactive')); });
document.addEventListener('mouseleave', () => { if (!modalOpen()) setInteractive(false); });

// ───────────────────────── 공통 ─────────────────────────
function toast(msg, ms = 4000) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function campStatus() {
  if (duelActive()) return { icon: '⚔️', text: '결투 중' };
  if (S.report || S.bag.length) return { icon: '❗', text: '정산 대기' };
  if (S.stamina < maxStamina() - 0.5) return { icon: '💤', text: `휴식 ${Math.floor((100 * S.stamina) / maxStamina())}%` };
  return { icon: '🚩', text: '출정 준비 완료' };
}

// data-live="키" 요소는 틱마다 LIVE[키]() 로 글자만 갱신한다 (버튼을 다시 만들지 않도록)
const LIVE = {
  expLeft: () => fmtTime(S.stamina / STAMINA_DRAIN),
  expKills: () => (S.trip ? S.trip.kills : 0),
  expBoxes: () => (S.trip ? S.trip.boxes.reduce((a, b) => a + b, 0) : 0),
  build: () => (S.build ? `🔨 ${BUILDINGS[S.build.id].name} Lv ${S.bld[S.build.id] + 1} 건설 중 · ${fmtTime(S.build.remain)}` : ''),
  buildLeft: () => (S.build ? fmtTime(S.build.remain) : ''),
  gold: () => fmt(S.gold),
  wood: () => fmt(S.mats.wood),
  ore: () => fmt(S.mats.ore),
  mana: () => fmt(S.mats.mana),
  stamina: () => `${Math.floor(S.stamina)} / ${maxStamina()} · 약 ${fmtTime(S.stamina / STAMINA_DRAIN)} 원정`,
  hpLine: () => `❤️ ${fmt(S.hp)} / ${fmt(stats().maxHp)}`,
  blocker: () => departBlocker() || '',
  campStatus: () => campStatus().text,
  sync: () => (!activeNick() ? '' : sync.error ? `⚠️ ${sync.error} — 이 기기에 저장 중` : sync.lastOk ? '☁️ 서버에 저장됨' : '☁️ 연결 중…'),
};
function tickLive(root = document) {
  root.querySelectorAll('[data-live]').forEach((el) => {
    const v = String(LIVE[el.dataset.live]());
    if (el.textContent !== v) el.textContent = v;
  });
  root.querySelectorAll('[data-bar]').forEach((el) => {
    const r = el.dataset.bar === 'stamina' ? S.stamina / maxStamina()
      : el.dataset.bar === 'build' && S.build ? 1 - S.build.remain / S.build.total : 0;
    el.style.width = (100 * Math.max(0, Math.min(1, r))) + '%';
  });
  const go = root.querySelector('[data-action="depart"]');
  if (go) go.disabled = !!departBlocker();
}

// ───────────────────────── HUD ─────────────────────────
let panelKey = '';
function renderHud() {
  const st = stats();
  $('cls').textContent = heroClass().icon;
  $('cls').title = heroClass().name;
  $('lv').textContent = S.level;
  $('stage').textContent = `${zoneOf(S.stage).icon} ${S.stage}-${Math.min(S.run.kills + 1, S.run.total)}${S.run.farm && S.phase !== 'camp' ? ' 🔁' : ''}`;
  $('gold').textContent = fmt(S.gold);
  $('bag').textContent = `${S.bag.length}/${bagCap()}`;
  $('hpfill').style.width = (100 * Math.max(0, S.hp) / st.maxHp) + '%';
  $('stfill').style.width = (100 * S.stamina / maxStamina()) + '%';
  $('xpfill').style.width = (100 * S.exp / expToNext()) + '%';
  $('status').textContent =
    S.phase === 'expedition' ? `⚔️ ${fmtTime(S.stamina / STAMINA_DRAIN)}`
      : S.phase === 'returning' ? '🏃 귀환 중'
        : `${campStatus().icon} ${campStatus().text}`;

  const key = S.phase + (S.build ? 'b' : '');
  if (key !== panelKey) {
    panelKey = key;
    const build = S.build ? '<div class="pline" data-live="build"></div>' : '';
    $('panelBody').innerHTML =
      S.phase === 'expedition' ? `
        <div class="pline">⏳ 남은 원정 <b data-live="expLeft"></b> · 처치 <b data-live="expKills"></b> · 📦 <b data-live="expBoxes"></b></div>
        ${build}
        <button class="pbtn" data-action="recall">🏕 귀환 명령</button>`
      : S.phase === 'returning' ? `<div class="pline">캠프로 돌아가는 중…</div>${build}`
      : `<div class="pline" data-live="campStatus"></div>${build}
         <button class="pbtn" data-action="open-camp">🏕 캠프 열기</button>`;
  }
  tickLive($('hud'));

  // 캠프 말풍선
  const bubble = $('bubble');
  if (S.phase === 'camp' && !modalOpen() && !duelActive()) {
    bubble.hidden = false;
    bubble.style.left = (CAMP_X - 14) + 'px';
    bubble.textContent = campStatus().icon;
    bubble.classList.toggle('alert', campStatus().icon === '❗' || campStatus().icon === '🚩');
  } else {
    bubble.hidden = true;
  }
}

// ───────────────────────── 캠프 창 ─────────────────────────
function openCamp() {
  if (!activeNick()) { openAccount(); return; }
  if (S.phase !== 'camp' || campOpen || acctOpen) return;
  skipDuel();                          // 결투를 보는 중이었으면 결과만 알리고 끝낸다
  campOpen = true;
  revealed = [];
  campTab = S.report || S.bag.length ? 'report' : 'town';
  if (window.bar) window.bar.setCampMode(true);
  interactive = true;
  $('camp').hidden = false;
  renderCamp();
  renderHud();
}

function closeCamp() {
  if (!campOpen) return;
  clearInterval(openAllTimer); openAllTimer = null;
  campOpen = false;
  S.report = null;                     // 창을 닫으면 보고는 읽은 것으로 처리
  $('camp').hidden = true;
  interactive = false;
  if (window.bar) window.bar.setCampMode(false);
  save();
  renderHud();
}

const costChip = (icon, need, have) =>
  need ? `<span class="chip ${have < need ? 'lack' : ''}">${icon} ${fmt(need)}</span>` : '';

function gainText(got) {
  const parts = [];
  if (got.gold) parts.push(`<i class="gc"></i> ${fmt(got.gold)}`);
  if (got.wood) parts.push(`🪵 ${fmt(got.wood)}`);
  if (got.ore) parts.push(`🪨 ${fmt(got.ore)}`);
  if (got.mana) parts.push(`💎 ${fmt(got.mana)}`);
  return parts.join(' ');
}

// 챙긴 전리품 카드 아래에 보여 줄 결과
function claimedText(b) {
  if (b.it.k === 'curio') return '+' + gainText(b.got);
  if (b.it.k === 'use') return '보급품 +1';
  const g = gearById(b.got.gearId);
  if (!g) return '판매됨';
  return `${gearStatText(gearStat(g))}<br>${isEquipped(g) ? '<em class="on">장착!</em>' : '창고로'}`;
}

const LOOT_KIND = { gear: '장비', curio: '골동품', use: '소비' };
const isMystery = (it) => it.k === 'gear' && it.g >= 3;

// ── 장비 도트 아이콘 ──
// <canvas data-gi="도감 키"> 를 HTML 에 넣어 두고, 그린 뒤 paintGearIcons 가 스프라이트를 찍는다
const gearIcon = (it, cls = '') => `<canvas class="gicon g${it.g} ${cls}" width="14" height="14" data-gi="${it.t}"></canvas>`;
const lootIconHtml = (it) => (it.k === 'gear' ? gearIcon(it) : `<span class="lic">${lootIcon(it)}</span>`);

const gearSprCache = {};
function gearSprite(t) {
  if (gearSprCache[t]) return gearSprCache[t];
  const def = GEAR_ITEMS[t], rows = GEAR_SPR[def.spr];
  const cv = document.createElement('canvas');
  cv.width = cv.height = 14;
  const g = cv.getContext('2d');
  const each = (fn) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') fn(x + 1, y + 1, ch); }));
  g.fillStyle = '#14151c';                    // 외곽선: 칠해진 칸의 상하좌우
  each((x, y) => { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); });
  each((x, y, ch) => { g.fillStyle = def.pal[ch] || '#ff00ff'; g.fillRect(x, y, 1, 1); });
  return (gearSprCache[t] = cv);
}
function paintGearIcons(root) {
  root.querySelectorAll('canvas[data-gi]').forEach((cv) => {
    if (!GEAR_ITEMS[cv.dataset.gi]) return;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 14, 14);
    g.drawImage(gearSprite(cv.dataset.gi), 0, 0);
  });
}

function viewReport() {
  const r = S.report;
  const cell = (label, value) => `<div class="cell"><span>${label}</span><b>${value}</b></div>`;
  const report = r ? `
    <div class="reason">${REASON_TEXT[r.reason]}${r.trips > 1 ? ` <em>(원정 ${r.trips}회 합산)</em>` : ''}</div>
    ${r.bossFail ? `<div class="reason warn">👑 ${r.stageTo}스테이지 보스에게 패배해서 이후엔 파밍만 했습니다. 강해진 뒤 다시 출정하면 재도전합니다.</div>` : ''}
    <div class="stats">
      ${cell('⏱ 원정 시간', fmtTime(r.dur))}
      ${cell('⚔️ 처치', fmt(r.kills))}
      ${cell('👑 보스 격파', r.bosses)}
      ${cell('🏰 스테이지', `${r.stageFrom} → ${r.stageTo}`)}
      ${cell('<i class="gc"></i> 골드', fmt(r.gold))}
      ${cell('✨ 경험치', fmt(r.xp) + (r.levels ? ` · Lv +${r.levels}` : ''))}
      ${cell('🧪 물약 사용', r.potions)}
      ${cell('⚠️ 위기', r.crises + (r.deaths ? ` · 쓰러짐 ${r.deaths}` : ''))}
    </div>` : '<div class="empty">새 원정 보고가 없습니다.</div>';

  const opened = revealed.map((b) => `
    <div class="box opened ${b.fresh ? (isMystery(b.it) ? 'fresh epic' : 'fresh') : ''}" style="--c:${GRADES[lootGrade(b.it)].color}"
      title="${b.it.k === 'gear' ? gearDesc(b.it) : ''}">
      ${lootIconHtml(b.it)}<div class="lname ${b.it.k === 'gear' ? 'gn g' + b.it.g : ''}">${lootName(b.it)}</div><div class="loot">${claimedText(b)}</div>
    </div>`).join('');
  // 영웅·전설 장비는 챙기기 전까지 실루엣만 보인다
  const closed = S.bag.map((it, i) => isMystery(it) ? `
    <button class="box mystery g${it.g}" data-action="claim" data-i="${i}" style="--c:${GRADES[it.g].color}" title="챙겨서 정체를 확인하세요">
      ${gearIcon(it, 'sil')}<span class="lname">???</span>
      <span class="grade">${GRADES[it.g].name} ${GEAR_SLOTS[it.slot].name}</span>
    </button>` : `
    <button class="box" data-action="claim" data-i="${i}" style="--c:${GRADES[lootGrade(it)].color}" title="${it.k === 'gear' ? gearDesc(it) : LOOT_KIND[it.k]}">
      ${lootIconHtml(it)}<span class="lname">${lootName(it)}</span>
      <span class="grade">${it.k === 'use' ? LOOT_KIND.use : GRADES[it.g].name + ' ' + LOOT_KIND[it.k]}</span>
    </button>`).join('');
  revealed.forEach((b) => { b.fresh = false; });

  const sum = revealed.reduce((a, b) => {
    for (const k of ['gold', 'wood', 'ore', 'mana']) a[k] += b.got[k];
    if (b.it.k === 'gear') a.gear++;
    if (b.it.k === 'use') a.items[b.it.id] = (a.items[b.it.id] || 0) + 1;
    return a;
  }, { gold: 0, wood: 0, ore: 0, mana: 0, gear: 0, items: {} });
  const sumItems = Object.entries(sum.items).map(([id, n]) => `${SUPPLIES[id].icon} ×${n}`).join(' ');
  const sumLine = [gainText(sum), sum.gear ? `🗡️ 장비 ${sum.gear}개` : '', sumItems].filter(Boolean).join(' · ');

  return `
    <h3>📜 원정 일지</h3>
    ${report}
    <div class="shead">
      <h3>🎒 가방 <small>${S.bag.length} / ${bagCap()}</small></h3>
      <button class="btn" data-action="claim-all" ${S.bag.length ? '' : 'disabled'}>모두 챙기기</button>
    </div>
    <div class="hint">장비는 창고로 가고, 골동품은 팔려서 재화가 되고, 소비 아이템은 보급품에 더해집니다.</div>
    <div class="boxes">${opened}${closed || (opened ? '' : '<div class="empty">가방이 비어 있습니다.</div>')}</div>
    ${revealed.length ? `<div class="gain">획득 합계 — ${sumLine || '없음'}${sum.gear ? ' <button class="btn" data-action="tab" data-tab="gear">🗡️ 장비 보기</button>' : ''}</div>` : ''}`;
}

function viewTown() {
  const cards = Object.entries(BUILDINGS).map(([id, b]) => {
    const lv = S.bld[id];
    let act;
    if (S.build && S.build.id === id) {
      act = `<div class="prog"><div data-bar="build"></div></div><div class="small">건설 중 · <span data-live="buildLeft"></span></div>`;
    } else if (lv >= BUILD_MAX) {
      act = '<div class="small">최대 레벨</div>';
    } else {
      const c = buildCost(id, lv);
      act = `<div class="costs">${costChip('<i class="gc"></i>', c.gold, S.gold)}${costChip('🪵', c.wood, S.mats.wood)}${costChip('🪨', c.ore, S.mats.ore)}${costChip('💎', c.mana, S.mats.mana)}</div>
        <button class="btn" data-action="build" data-id="${id}" ${S.build || !canAfford(c) ? 'disabled' : ''}>
          ${S.build ? '다른 건물 건설 중' : `건설 · ${fmtTime(buildTimeAt(lv))}`}</button>`;
    }
    return `
      <div class="card">
        <div class="ic">${b.icon}</div>
        <div class="info">
          <b>${b.name} <small>Lv ${lv}</small></b>
          <div class="eff">${b.effect(lv)}</div>
          ${lv < BUILD_MAX ? `<div class="eff next">다음 → ${b.effect(lv + 1)}</div>` : ''}
        </div>
        <div class="act">${act}</div>
      </div>`;
  }).join('');
  return `<h3>🏘 마을</h3><div class="hint">한 번에 한 건물만 지을 수 있고, 원정 중에도 공사는 계속됩니다.</div>${cards}`;
}

function viewTrain() {
  const st = stats();
  const cap = trainCapAt(S.bld.training);
  const cards = TRAINING.map((u) => {
    const lv = S.train[u.id], max = trainMax(u), cost = trainCost(u);
    const maxed = lv >= max;
    return `
      <button class="tcard" data-action="train" data-id="${u.id}" ${maxed || S.gold < cost ? 'disabled' : ''}>
        <span class="nm">${u.name}</span>
        <span class="val">${u.show(st)}</span>
        <span class="small">Lv ${lv} / ${max === Infinity ? '∞' : max}</span>
        <span class="cost">${maxed ? (lv >= u.max ? 'MAX' : '훈련장 필요') : '<i class="gc"></i> ' + fmt(cost)}</span>
      </button>`;
  }).join('');
  const c = heroClass(), w = heroWeapon();
  const next = Object.keys(CLASSES).filter(id => CLASSES[id].from === S.cls);
  const nextLine = next.length ? `다음 전직: Lv ${CLASS_REQ[CLASSES[next[0]].tier].level}` : '최종 직업';
  return `
    <h3>🎯 훈련 <small>최대 Lv ${cap} (훈련장 Lv ${S.bld.training})</small></h3>
    <div class="tgrid">${cards}</div>
    <h3>🗡 직업 · 무기</h3>
    <div class="card">
      <div class="ic">${c.icon}</div>
      <div class="info"><b>${c.name} · ${w.name}</b>
        <div class="eff">대장간 보정 ×${forgeMultAt(S.bld.forge).toFixed(2)} · DPS ${fmt(dpsOf(st))} · ${nextLine}</div></div>
      <div class="act"><button class="btn" data-action="tab" data-tab="class">⚜️ 전직 트리</button></div>
    </div>`;
}

// ───────────────────────── 전직 ─────────────────────────
let classSel = null;        // 트리에서 고른 직업 (상세 패널)
let classConfirm = null;    // 전직 확인 단계에 있는 직업

const CLASS_STATE_LABEL = {
  current: '현재 직업', done: '거쳐 온 직업', ready: '전직 가능!', next: '조건 미달', future: '이후 단계', closed: '다른 계열',
};
function classState(id) {
  const c = CLASSES[id];
  if (id === S.cls) return 'current';
  if (classPath().includes(id)) return 'done';
  if (c.from === S.cls) return classBlocker(id) === '' ? 'ready' : 'next';
  if (classPath(id).includes(S.cls)) return 'future';
  return 'closed';
}
// 한 번도 선택지로 나온 적 없는 직업은 이름까지 가린다 (다음 단계 이후, 또는 고르지 않은 계열의 하위 직업)
function classMasked(id) {
  const st = classState(id);
  return st === 'future' || (st === 'closed' && !classPath().includes(CLASSES[id].from));
}
const anyClassReady = () => Object.keys(CLASSES).some(id => CLASSES[id].from === S.cls && classBlocker(id) === '');

function modChips(id) {
  const c = CLASSES[id], m = c.mods, w = WEAPONS[c.weapon], out = [];
  const pct = (v) => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
  if (m.atk) out.push(`⚔️ 공격 ${pct(m.atk)}`);
  if (m.hp) out.push(`🛡️ 체력 ${pct(m.hp)}`);
  if (m.aspd) out.push(`💨 공속 ${pct(m.aspd)}`);
  if (m.crit) out.push(`💥 치명 +${Math.round(m.crit * 100)}%`);
  if (m.critMult) out.push(`💥 치명 피해 +${Math.round(m.critMult * 100)}%`);
  if (m.guard) out.push(`🛡 받는 피해 -${Math.round(m.guard * 100)}%`);
  if (m.heal) out.push(`💚 타격마다 회복 ${Math.round(m.heal * 100)}%`);
  if (c.leap) out.push(`🐉 ${c.leap.every}초마다 도약 ×${c.leap.mult}`);
  if (w.kind === 'ranged') out.push(`🏹 사거리 ${w.range}`);
  else if (w.range > 20) out.push(`📏 사거리 ${w.range}`);
  if (w.shots > 1) out.push(`✨ ${w.shots}연발`);
  else if (w.targets >= 9) out.push('🌀 범위 휩쓸기');
  else if (w.targets > 1) out.push(`➰ ${w.targets}마리 관통`);
  return out.map(t => `<span class="chip">${t}</span>`).join('');
}

function reqChips(id) {
  const req = CLASS_REQ[CLASSES[id].tier];
  const chip = (ok, text) => `<span class="chip ${ok ? 'ok' : 'lack'}">${text}</span>`;
  return chip(S.level >= req.level, `Lv ${req.level}`) + chip(S.mats.mana >= req.mana, `💎 ${req.mana}`) + chip(S.gold >= req.gold, `<i class="gc"></i> ${fmt(req.gold)}`);
}

function viewClass() {
  if (!classSel || !CLASSES[classSel]) {
    const next = Object.keys(CLASSES).filter(id => CLASSES[id].from === S.cls);
    classSel = next.find(id => classBlocker(id) === '') || next[0] || S.cls;
  }
  const node = (id) => {
    const c = CLASSES[id], st = classState(id), hidden = classMasked(id);
    return `
      <button class="cnode t${c.tier} ${st} ${id === classSel ? 'sel' : ''}" data-action="class-sel" data-id="${id}">
        <canvas class="cprev" data-cls="${id}"></canvas>
        <span class="cname">${hidden ? '???' : `${c.icon} ${c.name}`}</span>
        <span class="cstate">${CLASS_STATE_LABEL[st]}</span>
      </button>`;
  };
  const tree = CLASS_TREE.map(row => `<div class="crow">${row.map(node).join('')}</div>`).join('');

  const id = classSel, c = CLASSES[id], st = classState(id), w = WEAPONS[c.weapon];
  const hidden = classMasked(id);
  let act = '';
  if (st === 'ready' || st === 'next') {
    const blocker = classBlocker(id);
    act = classConfirm === id
      ? `<div class="small warn">전직은 되돌릴 수 없고, 같은 단계의 다른 직업은 닫힙니다.</div>
         <div class="row"><button class="btn" data-action="class-cancel">취소</button>
           <button class="go compact" data-action="class-do" data-id="${id}">${c.icon} ${c.name} 전직</button></div>`
      : `<button class="go compact" data-action="class-ask" data-id="${id}" ${blocker ? 'disabled' : ''}>⚜️ 전직하기</button>
         <div class="blocker">${blocker || ''}</div>`;
  } else if (st === 'future') {
    act = `<div class="small">${CLASSES[c.from].name}(으)로 전직하면 정체가 드러납니다</div>`;
  } else if (st === 'closed') {
    act = '<div class="small">다른 계열을 골라서 갈 수 없어요</div>';
  }
  const req = c.tier && st !== 'current' && st !== 'done' ? `<div class="req">조건 ${reqChips(id)}</div>` : '';

  return `
    <h3>⚜️ 전직 <small>현재 ${heroClass().icon} ${heroClass().name}</small></h3>
    <div class="tree">${tree}</div>
    <div class="cdetail">
      <canvas class="cprev big" data-cls="${id}"></canvas>
      <div class="info">
        ${hidden ? `
          <b>???</b> <small>${c.tier}차 직업</small>
          <div class="eff">어렴풋한 실루엣만 보인다… 어떤 힘을 쓰는지는 아직 알 수 없다.</div>`
        : `
          <b>${c.icon} ${c.name}</b> <small>${c.tier ? c.tier + '차 직업' : '기본'} · ${w.name}</small>
          <div class="eff">${c.desc}</div>
          <div class="chips">${modChips(id) || '<span class="small">기본 능력치</span>'}</div>`}
        ${req}
      </div>
      <div class="act">${act}</div>
    </div>`;
}

// 전직 탭이 열려 있는 동안 매 프레임 각 직업의 전투 모습을 그린다.
// 아직 되지 않은 직업은 실루엣만 보여 준다. 움직임으로 전투 방식만 짐작할 수 있다.
//  - 다음 단계(next/ready): 직업 색이 테두리에 번지고, 조건을 채우면(ready) 맥동한다
//  - 그 이후(future): 회색 실루엣 + 물음표
//  - 전직한 순간: 하얗게 번쩍이며 실루엣이 실제 모습으로 바뀐다 (revealAt)
const revealAt = {};
const silCanvas = document.createElement('canvas');
const REVEAL_SEC = 1.4;

function drawClassPreviews() {
  const dpr = window.devicePixelRatio || 1;
  document.querySelectorAll('canvas.cprev').forEach((cv, i) => {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w) return;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (cv.width !== pw) { cv.width = pw; cv.height = ph; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(4, h - 8, w - 8, 1);

    const id = cv.dataset.cls, c = CLASSES[id], st = classState(id), masked = classMasked(id);
    const tt = clock + i * 0.37;
    let swing = tt % 1.4; if (swing >= 1) swing = -1;
    let lift = 0;
    if (c.leap) { const q = tt % 3.5; if (q < 0.7) { lift = Math.sin((Math.PI * q) / 0.7) * 16; swing = -1; } }
    const k = cv.classList.contains('big') ? 1.5 : 1;
    const paint = (gg) => {
      gg.save();
      gg.translate(Math.round(w * 0.36), h - 8);
      gg.scale(k, k);
      drawHero(gg, id, 0, 0, { mode: 'fight', swing, t: tt, lift, walkT: 0 });
      gg.restore();
    };

    const known = st === 'current' || st === 'done';
    const reveal = revealAt[id] != null ? Math.min(1, (clock - revealAt[id]) / REVEAL_SEC) : 1;
    if (known && reveal >= 1) { paint(g); return; }

    // 실루엣: 따로 그린 뒤 형체만 남기고 어두운 색으로 채운다
    if (silCanvas.width < pw || silCanvas.height < ph) { silCanvas.width = Math.max(pw, 300); silCanvas.height = Math.max(ph, 240); }
    const sg = silCanvas.getContext('2d');
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, silCanvas.width, silCanvas.height);
    sg.setTransform(dpr, 0, 0, dpr, 0, 0);
    sg.imageSmoothingEnabled = false;
    paint(sg);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = masked ? '#1a1d27' : '#0b0d14';
    sg.fillRect(0, 0, w, h);
    sg.globalCompositeOperation = 'source-over';

    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (masked) { g.shadowColor = 'rgba(255,255,255,0.35)'; g.shadowBlur = 3 * dpr; }
    else if (st === 'ready') { g.shadowColor = c.look.fx; g.shadowBlur = (9 + 6 * Math.sin(clock * 4)) * dpr; }
    else { g.shadowColor = c.look.fx; g.shadowBlur = 5 * dpr; }
    g.globalAlpha = known ? 1 - reveal : 1;
    g.drawImage(silCanvas, 0, 0, pw, ph, 0, 0, pw, ph);
    g.restore();

    if (masked) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.font = `bold ${Math.round(16 * k)}px -apple-system, sans-serif`;
      g.textAlign = 'center';
      g.fillText('?', Math.round(w * 0.36) + 2, h - 8 - 26 * k);
    }

    // 공개 연출: 실루엣 위로 실제 모습이 떠오르고 흰 빛이 번졌다 사라진다
    if (known) {
      g.save();
      g.globalAlpha = reveal;
      paint(g);
      g.restore();
      const flash = Math.max(0, 1 - reveal * 1.6);
      if (flash > 0) {
        const cx = Math.round(w * 0.36), cy = h - 8 - 24 * k;
        const grad = g.createRadialGradient(cx, cy, 2, cx, cy, 46 * k);
        grad.addColorStop(0, `rgba(255,255,255,${flash})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      }
    }
  });
}

// ───────────────────────── 장비 ─────────────────────────
const gearUi = { filter: 'all', sellGrade: 0, protect: false, last: null };   // last: 마지막 강화 결과 { slot, result, from, to, fresh }
const GEAR_LIST_MAX = 120;                     // 창고가 아주 커져도 한 번에 그리는 개수

const ENH_RESULT = {
  up: (r) => `✨ 성공! +${r.to}`,
  keep: () => '💨 실패 — 단계 유지',
  down: (r) => `💔 실패 — +${r.from} → +${r.to} 하락`,
  reset: (r) => `💥 실패 — +${r.from} → +0 초기화`,
  saved: () => '📜 보호 주문서가 부서지며 단계를 지켰다',
};

// 창고에 지금 낀 것보다 좋은 장비가 있으면 탭에 표시
function gearBadge() {
  for (const slot of Object.keys(GEAR_SLOTS)) {
    const cur = equipped(slot), score = cur ? gearScore(cur) : -1;
    if (S.gear.inv.some((x) => x.slot === slot && gearScore(x) > score)) return '<i>▲</i>';
  }
  return '';
}

function enhOdds(L) {
  const e = ENHANCE[L], fail = 1 - e.rate;
  const pct = (v) => (v * 100 < 1 && v > 0 ? (v * 100).toFixed(1) : Math.round(v * 100)) + '%';
  const risk = [];
  if (e.down) risk.push(`<span class="warn">하락 ${pct(fail * e.down)}</span>`);
  if (e.reset) risk.push(`<span class="bad">초기화 ${pct(fail * e.reset)}</span>`);
  return `성공 <b>${pct(e.rate)}</b>${risk.length ? ' · ' + risk.join(' · ') : ' · 실패해도 유지'}`;
}

function slotCard(slot) {
  const def = GEAR_SLOTS[slot], it = equipped(slot), L = S.gear.enh[slot];
  const item = it ? `
      <div class="gtop" style="--c:${GRADES[it.g].color}">
        ${gearIcon(it, 'big')}
        <div><div class="gname gn g${it.g}">${gearName(it)}</div><small>${GRADES[it.g].name} · S${it.s}</small></div>
      </div>
      <div class="gdesc">${gearDesc(it)}</div>
      <div class="gstat">${gearStatText(gearStat(it))}${L < ENHANCE_MAX ? ` <small>→ ${gearStatText(gearStat(it, L + 1))}</small>` : ''}</div>`
    : '<div class="gtop"><div class="gicon big empty"></div><div class="gname empty">비어 있음</div></div><div class="gstat small">강화 단계는 장비를 끼면 적용돼요</div>';
  let enh;
  if (L >= ENHANCE_MAX) {
    enh = '<div class="small">최대 강화 달성!</div>';
  } else {
    const c = enhanceCostOf(slot), blocker = enhanceBlocker(slot);
    enh = `
      <div class="odds">+${L} → +${L + 1} · ${enhOdds(L)}</div>
      <div class="costs">${costChip('<i class="gc"></i>', c.gold, S.gold)}${costChip('🪨', c.ore, S.mats.ore)}${costChip('💎', c.mana, S.mats.mana)}</div>
      <button class="btn enh" data-action="enhance" data-slot="${slot}" ${blocker ? 'disabled' : ''}>⚒️ 강화</button>`;
  }
  const last = gearUi.last && gearUi.last.slot === slot ? gearUi.last : null;
  const res = last ? `<div class="enhres ${last.result} ${last.fresh ? 'fresh' : ''}">${ENH_RESULT[last.result](last)}</div>` : '';
  const top = S.gear.top[slot] > L ? ` <small>최고 +${S.gear.top[slot]}</small>` : '';
  return `
    <div class="gslot ${last && last.fresh ? 'flash-' + last.result : ''}">
      <div class="ghead"><span>${def.icon} ${def.name}</span><b class="lvl l${Math.min(5, Math.floor(L / 5))}">+${L}</b>${top}</div>
      ${item}
      <div class="genh">${enh}${res}</div>
    </div>`;
}

function gearRow(it) {
  const cur = equipped(it.slot);
  const on = isEquipped(it);
  let cmp = '';
  if (!on) {
    const d = cur ? gearScore(it) / gearScore(cur) - 1 : 1;
    cmp = d > 0.005 ? `<span class="up">▲${cur ? Math.round(d * 100) + '%' : ''}</span>` : d < -0.005 ? `<span class="down">▼${Math.round(-d * 100)}%</span>` : '<span>＝</span>';
  }
  return `
    <button class="gitem ${on ? 'on' : ''}" data-action="equip" data-id="${it.id}" style="--c:${GRADES[it.g].color}" ${on ? 'disabled' : ''}
      title="${gearDesc(it)} — 판매가 ${fmt(gearSellPrice(it))} 골드">
      ${gearIcon(it)}
      <span class="gi"><span class="gname gn g${it.g}">${gearName(it)}</span><span class="small">${GRADES[it.g].name} · S${it.s}</span></span>
      <span class="gstat">${gearStatText(gearStat(it))}</span>
      <span class="gcmp">${on ? '<em class="on">장착 중</em>' : cmp}</span>
    </button>`;
}

function viewGear() {
  const st = stats(true);
  const slots = Object.keys(GEAR_SLOTS);
  const f = gearUi.filter;
  const list = S.gear.inv
    .filter((x) => f === 'all' || x.slot === f)
    .sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot) || isEquipped(b) - isEquipped(a) || gearScore(b) - gearScore(a));
  const count = (slot) => S.gear.inv.filter((x) => x.slot === slot).length;
  const filters = [['all', '전체', S.gear.inv.length], ...slots.map((id) => [id, GEAR_SLOTS[id].icon + ' ' + GEAR_SLOTS[id].name, count(id)])]
    .map(([id, label, n]) => `<button class="${f === id ? 'on' : ''}" data-action="gear-filter" data-id="${id}">${label} <small>${n}</small></button>`).join('');

  const sell = bulkSellList(gearUi.sellGrade, f === 'all' ? null : f);
  const sellGold = sell.reduce((a, x) => a + gearSellPrice(x), 0);
  const grades = GRADES.map((g, i) => `<button class="${i === gearUi.sellGrade ? 'on' : ''}" style="--c:${g.color}" data-action="gear-sell-grade" data-g="${i}">${g.name}</button>`).join('');

  const slotCards = slots.map(slotCard).join('');
  if (gearUi.last) gearUi.last.fresh = false;       // 결과 연출은 한 번만
  return `
    <h3>🗡️ 장착 장비 <small>전투력 ${fmt(powerOf(st))} · 강화 단계는 부위에 남아서 장비를 바꿔 껴도 유지돼요</small></h3>
    <div class="gslots">${slotCards}</div>
    <div class="grow">
      <button class="chk ${gearUi.protect ? 'on' : ''}" data-action="gear-protect" ${S.items.protect ? '' : 'disabled'}>
        ${gearUi.protect && S.items.protect ? '☑' : '☐'} 📜 보호 주문서 사용 <small>(${S.items.protect || 0}) · 하락·초기화가 나올 때만 소모</small></button>
    </div>

    <div class="shead">
      <h3>📦 장비 창고 <small>${S.gear.inv.length}개</small></h3>
      <div class="row">
        <button class="chk ${S.gear.auto ? 'on' : ''}" data-action="gear-auto-toggle">${S.gear.auto ? '☑' : '☐'} 챙길 때 자동 장착</button>
        <button class="btn" data-action="gear-auto">✨ 자동 장착</button>
      </div>
    </div>
    <div class="gfilter">${filters}</div>
    <div class="gsell">
      <span>일괄 판매</span><div class="ggrades">${grades}</div><span>등급 이하 · 장착 중 제외</span>
      <button class="btn" data-action="gear-sell" ${sell.length ? '' : 'disabled'}>${sell.length}개 판매 <i class="gc"></i> ${fmt(sellGold)}</button>
    </div>
    <div class="glist">${list.slice(0, GEAR_LIST_MAX).map(gearRow).join('') || '<div class="empty">창고가 비어 있습니다. 원정에서 장비를 주워 오세요.</div>'}</div>
    ${list.length > GEAR_LIST_MAX ? `<div class="hint">좋은 순으로 ${GEAR_LIST_MAX}개만 보여요 — 나머지는 일괄 판매로 정리하세요.</div>` : ''}`;
}

function viewShop() {
  const rows = Object.entries(SUPPLIES).map(([id, s]) => {
    const p = supplyPrice(id);
    let extra = '';
    if (id === 'lunch') extra = `<button class="btn" data-action="eat" ${S.items.lunch && S.stamina < maxStamina() ? '' : 'disabled'}>먹기</button>`;
    return `
      <div class="card">
        <div class="ic">${s.icon}</div>
        <div class="info"><b>${s.name} <small>보유 ${S.items[id]}</small></b><div class="eff">${s.desc}</div></div>
        <div class="act row">${extra}<button class="btn" data-action="buy" data-id="${id}" ${S.gold < p ? 'disabled' : ''}>구매 <i class="gc"></i> ${fmt(p)}</button></div>
      </div>`;
  }).join('');
  return `<h3>🎒 보급품</h3><div class="hint">가격은 최고 스테이지에 따라 오릅니다. 원정 가방에서도 가끔 나옵니다.</div>${rows}`;
}

// 필드 선택: 앞 필드의 마지막 보스를 잡아야 다음 필드가 열린다
function viewFields() {
  const cur = zoneIndex(S.stage);
  return ZONES.map((z, i) => {
    const open = zoneUnlocked(i, S.best), done = zoneCleared(i, S.best);
    const range = z.to === Infinity ? `${z.from}~` : `${z.from}~${z.to}`;
    const state = !open ? '🔒 잠김' : done ? '✅ 클리어' : '⚔️ 도전 중';
    const mobs = [...z.mobs.map((id) => MONSTERS[id].name), `👑 ${MONSTERS[z.boss].name}`].join(' · ');
    return `<button class="field ${i === cur ? 'on' : ''} ${done ? 'done' : ''}" data-action="field" data-i="${i}" ${open ? '' : 'disabled'}
      title="${open ? esc(mobs) : '앞 필드의 마지막 보스를 잡으면 열립니다'}">
      <b>${z.icon} ${z.name}</b><small>${range} · ${state}</small></button>`;
  }).join('');
}

function viewDepart() {
  const opt = (id) => {
    if (!S.items[id]) departOpts[id] = false;
    return `<label class="opt ${S.items[id] ? '' : 'off'}">
      <input type="checkbox" data-opt="${id}" ${departOpts[id] ? 'checked' : ''} ${S.items[id] ? '' : 'disabled'}>
      ${SUPPLIES[id].icon} ${SUPPLIES[id].name} <small>(${S.items[id]})</small></label>`;
  };
  return `
    <div class="fields">${viewFields()}</div>
    <div class="drow">
    <div class="dstat">
      <div class="meter big"><div class="stbar" data-bar="stamina"></div></div>
      <div class="small">⚡ <span data-live="stamina"></span></div>
      <div class="small" data-live="hpLine"></div>
    </div>
    <div class="opts">${opt('charm')}${opt('elixir')}<span class="small">🧪 물약 ${S.items.potion}개 자동 사용</span></div>
    <div class="gobox">
      <button class="go" data-action="depart">🚩 출정</button>
      <div class="blocker" data-live="blocker"></div>
    </div>
    </div>`;
}

// ───────────────────────── 랭킹 ─────────────────────────
const rank = { sort: 'stage', data: null, at: 0, loading: false, error: null };
const clsOf = (id) => CLASSES[id] || CLASSES.squire;

// 랭킹 탭을 열 때 불러온다 (15초 안에 불러온 게 있으면 그대로). 내 최신 기록을 먼저 올린다.
function loadRanking(force = false) {
  if (rank.loading || !activeNick()) return;
  if (!force && rank.data && rank.data.sort === rank.sort && Date.now() - rank.at < 15000) return;
  rank.loading = true;
  rank.error = null;
  const sort = rank.sort;
  pushSave(true)
    .then(() => fetchRanking(sort))
    .then((d) => { if (sort === rank.sort) { rank.data = d; rank.at = Date.now(); } }, (e) => { rank.error = e.message; })
    .finally(() => { rank.loading = false; if (campOpen && campTab === 'rank') renderCamp(); });
}

function viewRank() {
  loadRanking();
  const d = rank.data && rank.data.sort === rank.sort ? rank.data : null;
  const seg = (id, label) => `<button class="seg ${rank.sort === id ? 'on' : ''}" data-action="rank-sort" data-sort="${id}">${label}</button>`;
  const row = (p, rk) => {
    const me = p.nickname === activeNick(), c = clsOf(p.cls);
    return `
      <div class="rrow ${me ? 'me' : ''}">
        <span class="rk r${rk}">${rk}</span>
        <span class="rnm"><b>${esc(p.nickname)}</b><small>${c.icon} ${c.name} · Lv ${p.level}</small></span>
        <span class="rv"><small>최고 스테이지</small><b>🏰 ${p.best}</b></span>
        <span class="rv"><small>전투력</small><b>${fmt(p.power)}</b></span>
        <span class="rv"><small>결투 ${p.wins}승 ${p.losses}패</small><b>⚔️ ${p.rating}</b></span>
        ${me ? '<span class="rme">나</span>'
          : `<button class="btn duel" data-action="duel" data-nick="${esc(p.nickname)}" ${duelBusy || duelActive() ? 'disabled' : ''}>⚔️ 결투</button>`}
      </div>`;
  };
  let body;
  if (d) {
    body = d.players.map((p, i) => row(p, i + 1)).join('') || '<div class="empty">아직 등록된 기사가 없어요.</div>';
    if (d.me && !d.players.some(p => p.nickname === d.me.nickname)) body += '<div class="rgap">⋯</div>' + row(d.me, d.me.rank);
  } else if (rank.error) {
    body = `<div class="empty">⚠️ ${esc(rank.error)} <button class="btn" data-action="rank-refresh">다시 시도</button></div>`;
  } else {
    body = '<div class="empty">랭킹을 불러오는 중… <small>서버가 잠들어 있었다면 깨어나는 데 1분쯤 걸려요</small></div>';
  }
  return `
    <div class="shead">
      <h3>🏆 랭킹 <small>${d ? `기사 ${d.total}명${d.me ? ` · 내 순위 ${d.me.rank}위` : ''}` : ''}</small></h3>
      <div class="segs">${seg('stage', '🏰 스테이지')}${seg('duel', '⚔️ 결투 점수')}
        <button class="btn" data-action="rank-refresh" title="새로고침" ${rank.loading ? 'disabled' : ''}>↻</button></div>
    </div>
    <div class="hint">결투는 서로의 저장된 능력치로 자동으로 싸우고, 캠프 앞 하단바에서 벌어져요. 이기면 상대의 결투 점수를 가져오고, 상대가 접속해 있지 않아도 도전할 수 있어요.</div>
    ${lastDuel ? `<div class="reason ${lastDuel.won ? '' : 'warn'}">최근 결투 — ${esc(duelResultText(lastDuel))}</div>` : ''}
    <div class="rlist">${body}</div>`;
}

// ───────────────────────── 결투 ─────────────────────────
// 서버에 결투를 신청하고, 받은 기록은 캠프 창을 닫고 하단바에서 재생한다 (world.js playDuel).
let duelBusy = false;        // 서버 응답을 기다리는 중
let lastDuel = null;         // 마지막 결투 결과 (랭킹 탭 위에 보여 준다)

const duelResultText = (r) =>
  `${r.won ? '🏆 승리!' : '💀 패배…'} vs ${r.opponent.nickname}${r.fight.timeout ? ' (시간 종료 · 남은 체력 판정)' : ''} — 결투 점수 ${r.me.rating} (${r.won ? '+' : '-'}${r.delta})`;

function startDuel(nick) {
  if (duelBusy || duelActive() || S.phase !== 'camp') return;
  duelBusy = true;
  const who = activeNick();
  closeCamp();
  toast(`⚔️ ${nick}에게 결투를 신청하는 중…`, 70000);
  requestDuel(nick).then((res) => {
    rank.at = 0;                              // 다음에 랭킹 탭을 열면 바뀐 점수로 다시 불러온다
    if (activeNick() !== who || S.phase !== 'camp' || campOpen || acctOpen) {
      toast(duelResultText(res), 6000);       // 그사이 다른 화면으로 갔으면 결과만 알린다
      lastDuel = res;
      return;
    }
    $('toast').classList.remove('show');
    playDuel(res, (r) => { lastDuel = r; toast(duelResultText(r), 6000); renderHud(); });
  }, (e) => {
    toast(`⚠️ ${e.message}`, 5000);
  }).finally(() => { duelBusy = false; renderHud(); });
}

function renderCamp() {
  if (!campOpen) return;
  const tabs = [
    ['report', '📜 원정 보고', S.bag.length ? `<i>${S.bag.length}</i>` : S.report ? '<i>!</i>' : ''],
    ['town', '🏘 마을', S.build ? '<i>🔨</i>' : ''],
    ['train', '🎯 훈련', ''],
    ['shop', '🎒 보급품', ''],
    ['gear', '🗡️ 장비', gearBadge()],
    ['class', '⚜️ 전직', anyClassReady() ? '<i>!</i>' : ''],
    ['rank', '🏆 랭킹', ''],
  ];
  const view = { report: viewReport, town: viewTown, train: viewTrain, gear: viewGear, shop: viewShop, class: viewClass, rank: viewRank }[campTab]();
  const scroll = $('campBody') ? $('campBody').scrollTop : 0;
  $('campModal').innerHTML = `
    <header>
      <h2>🏕 ${esc(activeNick())}의 캠프 <small class="sync" data-live="sync"></small></h2>
      <div class="res">
        <span><i class="gc"></i> <b data-live="gold"></b></span><span>🪵 <b data-live="wood"></b></span>
        <span>🪨 <b data-live="ore"></b></span><span>💎 <b data-live="mana"></b></span>
      </div>
      <button class="x" data-action="close" title="닫기 (Esc)">✕</button>
    </header>
    <nav>${tabs.map(([id, label, badge]) => `<button class="${id === campTab ? 'on' : ''}" data-action="tab" data-tab="${id}">${label}${badge}</button>`).join('')}</nav>
    <section id="campBody">${view}</section>
    <footer>${viewDepart()}</footer>`;
  $('campBody').scrollTop = scroll;
  tickLive($('campModal'));
  paintGearIcons($('campModal'));
}

// ───────────────────────── 행동 ─────────────────────────
function claimOne(i) {
  const it = S.bag.splice(i, 1)[0];
  if (!it) return;
  revealed.push({ it, got: claimLoot(it), fresh: true });
  if (isMystery(it)) toast(`${it.g >= 4 ? '🌟 전설' : '✨ 영웅'} 장비 — ${gearName(it)}!`);
}

function depart() {
  if (!startExpedition(departOpts)) return;
  departOpts.charm = departOpts.elixir = false;
  monsters = [];
  lapReady = false;
  knight.x = toWorld(CAMP_X);
  knight.facing = 1;
  closeCamp();
  $('toast').classList.remove('show');
  showBanner('출정!');
  save();
}

const ACTIONS = {
  'hud': () => { if (S.phase === 'camp') openCamp(); },
  'open-camp': openCamp,
  'recall': () => { endExpedition('manual'); save(); },
  'close': closeCamp,
  'tab': (el) => { campTab = el.dataset.tab; $('campBody').scrollTop = 0; },
  'rank-sort': (el) => { rank.sort = el.dataset.sort; },
  'rank-refresh': () => loadRanking(true),
  'duel': (el) => startDuel(el.dataset.nick),
  'acct-close': closeAccount,
  'quit': () => window.bar.quit(),
  'acct-create': acctCreate,
  'acct-switch': (el) => acctSwitch(el.dataset.nick),
  'acct-import': acctImport,
  'acct-show-code': () => { showCode = !showCode; renderAccount(); },
  'acct-copy': () => {
    navigator.clipboard.writeText(activeToken()).then(() => toast('🔑 복구 코드를 복사했어요'), () => toast('복사하지 못했어요'));
  },
  'claim': (el) => claimOne(Number(el.dataset.i)),
  'claim-all': () => {
    if (openAllTimer) return;
    openAllTimer = setInterval(() => {
      if (!S.bag.length || !campOpen) { clearInterval(openAllTimer); openAllTimer = null; save(); return; }
      claimOne(0);
      renderCamp();
    }, 110);
  },
  'build': (el) => startBuild(el.dataset.id),
  'train': (el) => doTrain(el.dataset.id),
  'buy': (el) => buySupply(el.dataset.id),
  'eat': eatLunch,
  'equip': (el) => equipGear(Number(el.dataset.id)),
  'gear-auto': () => { const n = autoEquip(); toast(n ? `✨ ${n}부위 장비를 바꿔 꼈어요` : '이미 가장 좋은 장비를 끼고 있어요'); },
  'gear-auto-toggle': () => { S.gear.auto = !S.gear.auto; if (S.gear.auto) autoEquip(); },
  'gear-filter': (el) => { gearUi.filter = el.dataset.id; },
  'gear-sell-grade': (el) => { gearUi.sellGrade = Number(el.dataset.g); },
  'gear-sell': () => {
    const r = sellGear(bulkSellList(gearUi.sellGrade, gearUi.filter === 'all' ? null : gearUi.filter));
    if (r.n) toast(`💰 장비 ${r.n}개를 ${fmt(r.gold)} 골드에 팔았어요`);
  },
  'gear-protect': () => { gearUi.protect = !gearUi.protect; },
  'enhance': (el) => {
    const slot = el.dataset.slot;
    const r = enhance(slot, gearUi.protect);
    if (!r) return;
    gearUi.last = { slot, ...r, fresh: true };
    if (r.result === 'up' && r.to % 5 === 0) toast(`⚒️ ${GEAR_SLOTS[slot].name} +${r.to} 달성!`);
  },
  'depart': depart,
  'field': (el) => {
    const i = Number(el.dataset.i);
    if (!selectZone(i)) return;
    toast(`${ZONES[i].icon} ${ZONES[i].name} ${S.stage}스테이지에서 출정합니다`);
  },
  'class-sel': (el) => { classSel = el.dataset.id; classConfirm = null; },
  'class-ask': (el) => { classConfirm = el.dataset.id; },
  'class-cancel': () => { classConfirm = null; },
  'class-do': (el) => {
    const id = el.dataset.id;
    if (!changeClass(id)) return;
    classConfirm = null;
    classSel = id;                 // 상세 패널에서 공개 연출을 보여 준다
    revealAt[id] = clock;
  },
};

// ───────────────────────── 계정 창 ─────────────────────────
// 닉네임이 곧 계정이다. 첫 실행 때는 닫을 수 없고, 이후엔 메뉴바의 "계정 변경…"으로 연다.
const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;
let acctBusy = false;
let showCode = false;

function openAccount() {
  if (acctOpen) return;
  closeCamp();
  acctOpen = true;
  showCode = false;
  if (window.bar) window.bar.setCampMode(true);
  interactive = true;
  $('acct').hidden = false;
  renderAccount();
  renderHud();
}
function closeAccount() {
  if (!acctOpen || !activeNick() || acctBusy) return;
  acctOpen = false;
  $('acct').hidden = true;
  interactive = false;
  if (window.bar) window.bar.setCampMode(false);
  renderHud();
}

function setMsg(id, text, kind = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'fmsg ' + kind;
}

function renderAccount() {
  const cur = activeNick();
  const mine = Object.keys(accounts.list);
  const knights = mine.map((n) => `
    <div class="card">
      <div class="ic">🛡</div>
      <div class="info"><b>${esc(n)}</b> ${n === cur ? '<small>플레이 중</small>' : ''}</div>
      ${n === cur ? '' : `<button class="btn" data-action="acct-switch" data-nick="${esc(n)}">이 기사로 플레이</button>`}
    </div>`).join('');
  $('acctModal').innerHTML = `
    <header>
      <h2>${cur ? '👤 계정 변경' : '⚔️ 기사의 이름을 지어 주세요'}</h2>
      <div class="res"></div>
      ${cur ? '<button class="x" data-action="acct-close" title="닫기 (Esc)">✕</button>'
        : window.bar ? '<button class="x" data-action="quit" title="게임 끄기">✕</button>' : ''}
    </header>
    <section class="abody">
      <h3>🆕 새 기사 키우기</h3>
      <div class="hint">닉네임이 곧 계정이에요. 다른 기사와 겹칠 수 없고, 랭킹에 이 이름으로 올라갑니다.</div>
      <div class="frow">
        <input id="nickIn" maxlength="12" placeholder="한글·영문·숫자·_ 2~12자" autocomplete="off" spellcheck="false">
        <button class="go compact" data-action="acct-create">🚩 시작</button>
      </div>
      <div id="nickMsg" class="fmsg"></div>
      ${mine.length ? `<h3>🛡 이 기기의 기사</h3>${knights}` : ''}
      <h3>📥 다른 기기의 기사 가져오기</h3>
      <div class="hint">원래 기기에서 이 창을 열면 복구 코드를 볼 수 있어요.</div>
      <div class="frow">
        <input id="impNick" maxlength="12" placeholder="닉네임" autocomplete="off" spellcheck="false">
        <input id="impCode" placeholder="복구 코드" autocomplete="off" spellcheck="false">
        <button class="btn" data-action="acct-import">가져오기</button>
      </div>
      <div id="impMsg" class="fmsg"></div>
      ${cur ? `
        <h3>🔑 ${esc(cur)}의 복구 코드</h3>
        <div class="hint">다른 기기에서 이 기사를 이어 하려면 필요해요. 다른 사람에게 알려 주지 마세요.</div>
        <div class="frow">
          <code class="code">${showCode ? esc(activeToken()) : '•'.repeat(16)}</code>
          <button class="btn" data-action="acct-show-code">${showCode ? '숨기기' : '보기'}</button>
          <button class="btn" data-action="acct-copy">복사</button>
        </div>` : ''}
    </section>`;
  const input = $('nickIn');
  input.addEventListener('input', onNickInput);
  setTimeout(() => input.focus(), 50);
}

// 입력하는 동안 닉네임 사용 가능 여부를 확인한다
let nickTimer = null;
function onNickInput() {
  clearTimeout(nickTimer);
  const nick = $('nickIn').value.trim();
  if (!nick) return setMsg('nickMsg', '');
  if (!NICK_RE.test(nick)) return setMsg('nickMsg', '한글·영문·숫자·_ 2~12자로 지어 주세요', 'bad');
  setMsg('nickMsg', '확인 중…');
  nickTimer = setTimeout(async () => {
    try {
      const r = await checkNickname(nick);
      if ($('nickIn') && $('nickIn').value.trim() === nick) {
        setMsg('nickMsg', r.available ? '✓ 사용할 수 있는 닉네임이에요' : '✗ 이미 사용 중인 닉네임이에요', r.available ? 'ok' : 'bad');
      }
    } catch (e) {
      setMsg('nickMsg', `⚠️ ${e.message}`, 'bad');
    }
  }, 400);
}

async function acctCreate() {
  const nick = $('nickIn').value.trim();
  if (!NICK_RE.test(nick)) return setMsg('nickMsg', '한글·영문·숫자·_ 2~12자로 지어 주세요', 'bad');
  if (acctBusy) return;
  acctBusy = true;
  setMsg('nickMsg', '⏳ 기사를 등록하는 중… 서버가 잠들어 있었다면 1분쯤 걸려요');
  try {
    if (activeNick()) { save(); await pushSave(); }
    // 새 기사의 첫 세이브는 항상 새로 시작
    const prev = S, prevKey = saveKey;
    loadState(null);
    const state = S, prof = profile();
    S = prev; saveKey = prevKey;
    await createAccount(nick, state, prof);
    await enterAccount(nick, state);
    acctBusy = false;
    closeAccount();
    toast(`⚔️ ${nick}, 모험을 시작합니다! 캠프의 기사를 클릭해 첫 원정을 보내보세요`, 8000);
  } catch (e) {
    acctBusy = false;
    setMsg('nickMsg', `✗ ${e.message}`, 'bad');
  }
}

async function acctSwitch(nick) {
  if (acctBusy || !accounts.list[nick]) return;
  acctBusy = true;
  save();
  await pushSave();
  await enterAccount(nick);
  acctBusy = false;
  closeAccount();
  toast(`🛡 ${nick}(으)로 바꿨어요`);
}

async function acctImport() {
  const nick = $('impNick').value.trim(), code = $('impCode').value.trim();
  if (!nick || !code) return setMsg('impMsg', '닉네임과 복구 코드를 모두 넣어 주세요', 'bad');
  if (acctBusy) return;
  acctBusy = true;
  setMsg('impMsg', '⏳ 확인 중…');
  try {
    if (activeNick()) { save(); await pushSave(); }
    const r = await importAccount(nick, code);
    await enterAccount(r.nickname, r.state);
    acctBusy = false;
    closeAccount();
    toast(`📥 ${r.nickname}을(를) 가져왔어요`);
  } catch (e) {
    acctBusy = false;
    setMsg('impMsg', `✗ ${e.message}`, 'bad');
  }
}

// ───────────────────────── 계정 불러오기 ─────────────────────────
// 전투 화면을 새 상태에 맞춰 비운다
function resetWorld() {
  monsters = []; coins = []; floaters = []; shots = []; effects = [];
  lapReady = false;
  Object.assign(knight, { down: 0, fighting: false, pending: false, leapT: -1, swing: -1, facing: 1 });
  knight.x = S.phase === 'expedition' ? toWorld(CAMP_X + 90) : toWorld(CAMP_X);
  rank.data = null; duelPlay = null; lastDuel = null; revealed = []; classSel = null; classConfirm = null;
}

// 꺼져 있던 동안의 원정·휴식·건설을 한 번에 계산한다
function catchUp() {
  const away = (Date.now() - (S.lastSeen || Date.now())) / 1000;
  if (away <= 5) return;
  const wasOut = S.phase !== 'camp';
  const kills0 = S.trip ? S.trip.kills : 0;
  simulate(away * TIME_SCALE);
  if (wasOut && S.phase === 'camp') toast('🌙 자리를 비운 사이 원정이 끝났어요 — 캠프에서 정산하세요', 7000);
  else if (S.phase === 'expedition') toast(`🌙 자리를 비운 사이 ${fmtTime(away)} 동안 ${S.trip.kills - kills0}마리 처치!`, 6000);
}

function applyState(o) {
  loadState(o);
  resetWorld();
  catchUp();
  save();
  renderHud();
}

// known: 서버에서 이미 받은 세이브 (없으면 undefined → 서버에 물어본다)
// 이 기기에 세이브가 있으면 바로 그걸로 시작하고, 서버 쪽이 더 최근이면 받아서 바꾼다.
async function enterAccount(nick, known) {
  closeCamp();
  setActiveAccount(nick);
  saveKey = null;                            // 불러오는 동안 이전 기사의 상태를 새 계정에 쓰지 않도록
  const key = accountSaveKey(nick);
  const local = readLocalSave(key);
  const localSeen = local ? local.lastSeen || 0 : -1;
  if (window.bar) window.bar.setAccount(nick);
  sync.error = null; sync.lastOk = 0;

  if (known !== undefined) {
    saveKey = key;
    applyState(known && (known.lastSeen || 0) >= localSeen ? known : local);
    pushSave(true);
    return;
  }
  const remote = fetchMe().then((r) => r.state, (e) => {
    sync.error = e.message;
    if (e.status === 401) toast('⚠️ 서버에서 이 기사를 찾을 수 없어요 — 이 기기의 기록으로 계속합니다', 7000);
    return undefined;
  });
  if (local) {
    saveKey = key;
    applyState(local);
    remote.then((st) => {
      if (activeNick() !== nick) return;
      if (st && (st.lastSeen || 0) > localSeen) { applyState(st); toast('☁️ 다른 기기에서 진행한 기록을 불러왔어요'); }
      pushSave(true);
    });
    return;
  }
  loadState(null);
  resetWorld();
  toast('☁️ 서버에서 기록을 불러오는 중…', 60000);
  const st = await remote;
  if (activeNick() !== nick) return;
  saveKey = key;
  applyState(st || null);
  if (st) toast('☁️ 기록을 불러왔어요', 2500);
  else toast(`⚠️ 기록을 불러오지 못했어요 (${sync.error}) — 새 기록으로 시작합니다`, 7000);
  pushSave(true);
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'camp') { closeCamp(); return; }      // 바깥 어두운 영역
  if (e.target.id === 'acct') { closeAccount(); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  ACTIONS[el.dataset.action](el);
  save();
  if (campOpen) renderCamp();
  renderHud();
});
document.addEventListener('change', (e) => {
  const id = e.target.dataset && e.target.dataset.opt;
  if (id) departOpts[id] = e.target.checked;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeCamp(); closeAccount(); }
  if (e.key === 'Enter' && !e.isComposing && acctOpen) {
    if (e.target.id === 'nickIn') acctCreate();
    if (e.target.id === 'impNick' || e.target.id === 'impCode') acctImport();
  }
});

// ───────────────────────── 알림 / 메뉴바 ─────────────────────────
hooks.onArrive = () => {
  const r = S.report;
  toast('🏕 캠프에 도착했어요 — 기사를 클릭해 정산하세요', 6000);
  try {
    new Notification('⚔️ 기사가 캠프로 돌아왔어요', {
      body: `${REASON_TEXT[r.reason]} 처치 ${fmt(r.kills)} · 전리품 ${S.bag.length}개`,
    });
  } catch {}
};
hooks.onBuilt = (id) => {
  toast(`🔨 ${BUILDINGS[id].name} Lv ${S.bld[id]} 완공!`);
  if (campOpen) renderCamp();
};

let trayText = '';
function updateTray() {
  const text = S.phase === 'expedition' ? `⚔ ${Math.ceil(S.stamina / STAMINA_DRAIN / 60)}m`
    : S.phase === 'returning' ? '🏃' : campStatus().icon;
  if (text !== trayText && window.bar) { trayText = text; window.bar.setTrayTitle(text); }
}

// ───────────────────────── 설치 가이드 (웹) ─────────────────────────
// 서명·공증 전이라 처음 실행할 때 OS 경고가 뜬다. 받기 버튼을 누르면 넘기는 방법을 바로 보여 준다.
function setupGuide(os) {
  const show = (tab) => {
    document.querySelectorAll('[data-guide-tab]').forEach((b) => b.classList.toggle('on', b.dataset.guideTab === tab));
    document.querySelectorAll('[data-guide-pane]').forEach((p) => { p.hidden = p.dataset.guidePane !== tab; });
    $('guide').hidden = false;
  };
  document.querySelectorAll('#webPromo a[data-os]').forEach((a) => a.addEventListener('click', () => show(a.dataset.os)));
  document.querySelectorAll('[data-guide]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    show(a.dataset.guide || os || 'mac');
  }));
  document.querySelectorAll('[data-guide-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.guideTab)));
  $('guide').addEventListener('click', (e) => { if (e.target.id === 'guide' || e.target.closest('[data-guide-close]')) $('guide').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('guide').hidden = true; });
  document.querySelector('[data-guide-copy]').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    navigator.clipboard.writeText($('guideCmd').textContent).then(() => {
      btn.textContent = '복사됨 ✓';
      setTimeout(() => { btn.textContent = '복사'; }, 1500);
    }, () => toast('복사하지 못했어요 — 직접 드래그해서 복사해 주세요'));
  });
}

// ───────────────────────── 새 버전 자동 반영 (데스크탑 앱) ─────────────────────────
// 앱은 게임 화면을 웹에서 불러온다. 켜 둔 채로도 업데이트가 반영되도록 몇 분마다 웹의 게임 파일을 다시 받아 보고,
// 바뀌었으면 저장한 뒤 다시 불러온다. 배포 도중 일부 파일만 바뀐 상태를 피하려고 같은 결과가 두 번 연속 나와야 반영한다.
const UPDATE_CHECK_EVERY = 5 * 60 * 1000;

async function gameFingerprint() {
  const urls = [location.origin + location.pathname, ...[...document.scripts].map((s) => s.src).filter(Boolean)];
  const texts = await Promise.all(urls.map((u) => fetch(u, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.text();
  })));
  let h = 0;
  for (const ch of texts.join('\0')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

function watchForUpdates() {
  if (!window.bar || location.protocol === 'file:') return;   // 로컬 파일로 열렸으면(개발·오프라인) 확인하지 않는다
  let current = null, pending = null;
  gameFingerprint().then((h) => { current = h; }, () => {});
  setInterval(async () => {
    let h;
    try { h = await gameFingerprint(); } catch { return; }
    if (current == null) { current = h; return; }
    if (h === current) { pending = null; return; }
    if (pending !== h) { pending = h; return; }
    if (campOpen || document.activeElement?.value) return;   // 캠프 창을 보거나 뭔가 입력하던 중이면 끝난 뒤에
    save();
    try { await pushSave(); } catch {}
    window.bar.reload ? window.bar.reload() : location.reload();
  }, UPDATE_CHECK_EVERY);
}

// ───────────────────────── 부팅 ─────────────────────────
function boot() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 브라우저에서 열렸으면 배경을 깔고 데스크탑 앱 받기 안내를 보여 준다
  if (!window.bar) {
    document.body.classList.add('web');
    $('webPromo').hidden = false;
    const os = /Windows/i.test(navigator.userAgent) ? 'win' : /Mac/i.test(navigator.userAgent) ? 'mac' : null;
    document.querySelectorAll(`#webPromo a[data-os="${os}"]`).forEach((a) => a.classList.add('rec'));
    setupGuide(os);
  }

  if (window.bar) {
    window.bar.onReset(() => {
      if (!activeNick()) return;
      closeCamp();
      resetState();
      resetWorld();
      toast('진행 상황을 초기화했어요');
    });
    window.bar.onSettings((s) => {
      showGround = s.showGround;
      $('hud').classList.toggle('right', !!s.hudRight);
    });
    window.bar.onSwitchAccount(openAccount);
    if (window.bar.setGameVersion) window.bar.setGameVersion(GAME_VERSION);   // 0.2.0 앱에는 없다
    // 앱을 끄기 직전에 서버에 마지막으로 저장한다
    window.bar.onFlush(async () => {
      save();
      await pushSave();
      window.bar.flushed();
    });
    watchForUpdates();
  }

  if (activeToken()) {
    enterAccount(activeNick());
  } else {
    loadState(null);
    resetWorld();
    openAccount();
  }
  renderHud();

  setInterval(save, 10000);
  window.addEventListener('beforeunload', save);

  let last = performance.now(), acc = 0, slow = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    acc += (now - last) / 1000;
    last = now;
    if (acc < 1 / FPS) return;
    let dt = acc; acc = 0;
    if (dt > 5) {
      // 절전 등으로 멈춰 있던 시간은 한 번에 계산
      const before = S.phase;
      simulate(dt * TIME_SCALE);
      if (before !== S.phase) { monsters = []; knight.x = toWorld(CAMP_X); }
      lapReady = false;   // 시뮬레이션으로 진행이 바뀌었으니 바퀴를 새로 깐다
      dt = 1 / FPS;
    }
    // 계정을 불러오는 중에는 게임 시간을 멈춘다
    if (saveKey) update(Math.min(dt, 0.1));
    else clock += dt;
    render();
    if (campOpen && campTab === 'class') drawClassPreviews();
    slow += dt;
    if (slow > 0.25) {
      slow = 0;
      renderHud();
      if (campOpen) tickLive($('campModal'));
      updateTray();
    }
  }
  requestAnimationFrame(frame);
}

boot();
