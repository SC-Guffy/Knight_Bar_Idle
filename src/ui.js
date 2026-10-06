'use strict';
// HUD, 캠프 말풍선, 캠프 창(정산·마을·훈련·보급·랭킹·레이드·출정), 계정 창, 그리고 부팅/메인 루프.

const $ = (id) => document.getElementById(id);
let campOpen = false;
let acctOpen = false;                 // 계정 창 (첫 실행 닉네임 입력 · 계정 변경)
let campTab = 'report';
let reportSeen = null;     // 원정 보고 탭에서 이미 본 보고 (레드닷을 끄는 데만 씀, 보고 자체는 창을 닫을 때 지움)
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

// ───────────────────────── 자동 숨기기 (앱 전용 옵션) ─────────────────────────
// 켜 두면 마우스가 하단바를 벗어나고 잠시 뒤 기사·HUD 가 사라지고, 하단바 위로 가져가면 다시 나타난다.
// 앱 창은 클릭만 통과시키고 마우스 이동은 계속 받으므로(forward) 웹 코드만으로 감지할 수 있다.
const AUTOHIDE_KEY = 'knight-bar-autohide';
const AUTOHIDE_DELAY = 2000;
let autoHide = false;
try { autoHide = localStorage.getItem(AUTOHIDE_KEY) === '1'; } catch {}
let fadeTimer = null;
function showBar() {
  clearTimeout(fadeTimer); fadeTimer = null;
  document.body.classList.remove('faded');
}
function scheduleFade() {
  clearTimeout(fadeTimer);
  if (!autoHide || !window.bar) return;
  fadeTimer = setTimeout(() => { if (!modalOpen()) document.body.classList.add('faded'); }, AUTOHIDE_DELAY);
}
function setAutoHide(on) {
  autoHide = on;
  try { localStorage.setItem(AUTOHIDE_KEY, on ? '1' : '0'); } catch {}
  showBar();
}
document.addEventListener('mousemove', showBar);
document.addEventListener('mouseleave', scheduleFade);

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
  if (raidActive()) return raidPlay.res.world ? { icon: '🌍', text: '월드 보스' } : { icon: '🐉', text: '레이드 중' };
  if (raidUi.room) return { icon: '🐉', text: raidUi.room.state === 'open' ? `레이드 대기 ${raidUi.room.members.length}/4` : '레이드 정산' };
  if (S.report || S.bag.length) return { icon: '❗', text: '정산 대기' };
  if (S.stamina < maxStamina() - 0.5) return { icon: '💤', text: `휴식 ${Math.floor((100 * S.stamina) / maxStamina())}%` };
  return { icon: '🚩', text: '출정 준비 완료' };
}

// data-live="키" 요소는 틱마다 LIVE[키]() 로 글자만 갱신한다 (버튼을 다시 만들지 않도록)
const LIVE = {
  expLeft: () => fmtTime(S.stamina / STAMINA_DRAIN),
  expKills: () => (S.trip ? S.trip.kills : 0),
  expBoxes: () => (S.trip ? S.trip.boxes.reduce((a, b) => a + b, 0) : 0),
  towerFloor: () => (S.tower.run ? `${S.tower.run.floor}F` : '-'),
  towerTomes: () => (S.tower.run ? S.tower.run.tomes : 0),
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
  if (go) {
    go.disabled = !!departBlocker();
    // 휴식이 끝나 바로 떠날 수 있으면 출정 버튼에도 레드닷 (가방에 상자가 남아 있으면 모두 열기가 먼저) (캠프 전체 점에는 넣지 않는다 — 말풍선 🚩 가 이미 알림)
    go.classList.toggle('rd', !departBlocker() && !S.bag.length && S.stamina >= maxStamina() - 0.5);
  }
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
  $('bag').textContent = `${bagWeight()}/${bagCap()}`;
  $('hpfill').style.width = (100 * Math.max(0, S.hp) / st.maxHp) + '%';
  $('stfill').style.width = (100 * S.stamina / maxStamina()) + '%';
  $('xpfill').style.width = (100 * S.exp / expToNext()) + '%';
  $('status').textContent =
    S.phase === 'expedition' ? `⚔️ ${fmtTime(S.stamina / STAMINA_DRAIN)}`
      : S.phase === 'tower' ? (S.tower.run ? `🗼 ${S.tower.run.floor}F · ${fmtTime(S.stamina / STAMINA_DRAIN)}` : '✨ 귀환 중')
      : S.phase === 'returning' ? '🏃 귀환 중'
        : `${campStatus().icon} ${campStatus().text}`;

  const key = S.phase + (S.build ? 'b' : '') + (S.tower.run ? 'r' : '');
  if (key !== panelKey) {
    panelKey = key;
    const build = S.build ? '<div class="pline" data-live="build"></div>' : '';
    $('panelBody').innerHTML =
      S.phase === 'expedition' ? `
        <div class="pline">⏳ 남은 원정 <b data-live="expLeft"></b> · 처치 <b data-live="expKills"></b> · 📦 <b data-live="expBoxes"></b></div>
        ${build}
        <button class="pbtn" data-action="recall">🏕 귀환 명령</button>`
      : S.phase === 'tower' && S.tower.run ? `
        <div class="pline">🗼 도전의 탑 <b data-live="towerFloor"></b> · ⏳ <b data-live="expLeft"></b> · 📖 <b data-live="towerTomes"></b></div>
        ${build}
        <button class="pbtn" data-action="tower-retreat">⬇️ 후퇴</button>`
      : S.phase === 'tower' ? `<div class="pline">✨ 캠프로 귀환하는 중…</div>${build}`
      : S.phase === 'returning' ? `<div class="pline">캠프로 돌아가는 중…</div>${build}`
      : `<div class="pline" data-live="campStatus"></div>${build}
         <button class="pbtn" data-action="open-camp">🏕 캠프 열기</button>`;
  }
  tickLive($('hud'));
  const todo = S.phase === 'camp' && !modalOpen() && !duelActive() && !raidActive() && campHasDot();
  document.querySelector('#hud .bar').classList.toggle('rd', todo);
  const openBtn = document.querySelector('#panelBody [data-action="open-camp"]');
  if (openBtn) openBtn.classList.toggle('rd', todo);

  // 캠프 말풍선
  const bubble = $('bubble');
  if (S.phase === 'camp' && !modalOpen() && !duelActive() && !raidActive()) {
    bubble.hidden = false;
    bubble.style.left = (CAMP_X - 14) + 'px';
    bubble.textContent = campStatus().icon;
    bubble.classList.toggle('alert', campStatus().icon === '❗' || campStatus().icon === '🚩');
    bubble.classList.toggle('rd', todo);
  } else {
    bubble.hidden = true;
  }
}

// ───────────────────────── 캠프 창 ─────────────────────────
// tab: 열 탭 (없으면 정산할 게 있으면 원정 보고, 아니면 마을)
function openCamp(tab) {
  if (!activeNick()) { openAccount(); return; }
  if (S.phase !== 'camp' || campOpen || acctOpen) return;
  skipDuel();                          // 결투를 보는 중이었으면 결과만 알리고 끝낸다
  if (raidActive()) { skipRaid(); return; }   // 레이드는 끝나면서 정산 화면(레이드 탭)을 연다
  campOpen = true;
  revealed = [];
  campTab = typeof tab === 'string' ? tab : S.report || S.bag.length ? 'report' : towerResultPending() ? 'tower' : raidUi.room ? 'raid' : guideTab() || 'town';
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
  inbox.newAfter = null;
  S.report = null;                     // 창을 닫으면 보고는 읽은 것으로 처리
  if (towerResultViewed && S.tower.last) S.tower.last.seen = true;   // 탑 정산도 본 채로 닫았으면 읽은 것으로
  towerResultViewed = false;
  $('camp').hidden = true;
  interactive = false;
  if (window.bar) window.bar.setCampMode(false);
  save();
  renderHud();
  scheduleFade();
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
// 전리품 상자도 같은 방식으로 <canvas data-bx="등급"> 에 찍는다
const gearIcon = (it, cls = '') => `<canvas class="gicon ${isSetGear(it) ? 'gs' : 'g' + it.g} ${cls}" width="14" height="14" data-gi="${it.t}"></canvas>`;
const boxIcon = (g) => `<canvas class="gicon g${g}" width="14" height="14" data-bx="${g}"></canvas>`;
const lootIconHtml = (it) => (it.k === 'gear' ? gearIcon(it) : `<span class="lic">${lootIcon(it)}</span>`);

const gearSprCache = {};
// key: 캐시 키, def: { spr, pal } (장비 도감 항목 또는 LOOT_BOXES 항목)
function gearSprite(key, def) {
  if (gearSprCache[key]) return gearSprCache[key];
  const rows = GEAR_SPR[def.spr];
  const cv = document.createElement('canvas');
  cv.width = cv.height = 14;
  const g = cv.getContext('2d');
  const each = (fn) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') fn(x + 1, y + 1, ch); }));
  g.fillStyle = '#14151c';                    // 외곽선: 칠해진 칸의 상하좌우
  each((x, y) => { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); });
  each((x, y, ch) => { g.fillStyle = def.pal[ch] || '#ff00ff'; g.fillRect(x, y, 1, 1); });
  return (gearSprCache[key] = cv);
}
function paintGearIcons(root) {
  const paint = (cv, key, def) => {
    if (!def) return;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 14, 14);
    g.drawImage(gearSprite(key, def), 0, 0);
  };
  root.querySelectorAll('canvas[data-gi]').forEach((cv) => paint(cv, cv.dataset.gi, GEAR_ITEMS[cv.dataset.gi]));
  root.querySelectorAll('canvas[data-bx]').forEach((cv) => paint(cv, 'box' + cv.dataset.bx, LOOT_BOXES[cv.dataset.bx]));
  root.querySelectorAll('canvas[data-rb]').forEach((cv) => paint(cv, 'rbox' + cv.dataset.rb, RAID_BOSSES[cv.dataset.rb].chest));
  // 레이드·월드 보스 초상: 몬스터 도트 첫 프레임을 캔버스 크기에 맞춰 찍는다
  root.querySelectorAll('canvas[data-boss]').forEach((cv) => {
    const def = raidDef(cv.dataset.boss), rows = SPR[def.spr][0];
    cv.width = rows[0].length + 2; cv.height = rows.length + 2;
    const g = cv.getContext('2d');
    drawSprite(rows, def.pal, cv.width / 2, cv.height - 1, 1, {}, g);
  });
}
const raidChestIcon = (b) => `<canvas class="gicon g${RAID_BOSSES[b].chest.w.findLastIndex((w) => w > 0)}" width="14" height="14" data-rb="${b}"></canvas>`;
const bossPortrait = (b, cls = '') => `<canvas class="bossic ${cls}" data-boss="${b}"></canvas>`;

// 상자에서 나와 챙긴 전리품 카드 (원정 보고·레이드 처치 상자 공용). b = { it, got, fresh }
function openedCard(b) {
  const sp = b.it.k === 'gear' ? gearSpecialText(b.it) : '';
  return `
    <div class="box opened ${b.fresh ? (isMystery(b.it) ? 'fresh epic' : 'fresh') : ''} ${sp ? 'sig' : ''}" style="--c:${lootColor(b.it)}"
      title="${b.it.k === 'gear' ? esc(gearDesc(b.it)) : ''}">
      ${lootIconHtml(b.it)}<div class="lname ${b.it.k === 'gear' ? gnClass(b.it) : ''}">${lootName(b.it)}</div>
      ${isSetGear(b.it) ? `<div class="gsp">🔗 ${esc(gearKindText(b.it))}</div>` : ''}
      ${sp ? `<div class="gsp">✦ ${sp}</div>` : ''}<div class="loot">${claimedText(b)}</div>
    </div>`;
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
      ${r.stones ? cell('💠 강화석', r.stones) : ''}
      ${r.tomes ? cell('📖 비전서', r.tomes) : ''}
    </div>` : '<div class="empty">새 원정 보고가 없습니다.</div>';

  const opened = revealed.map(openedCard).join('');
  // 영웅 이상 장비는 챙기기 전까지 실루엣만 보인다
  // 상자는 이름과 무게만 보이고, 눌러서 열면 내용물이 위의 카드로 쏟아진다. 보물상자 이상은 빛난다
  const closed = S.bag.map((it, i) => it.k === 'box' ? `
    <button class="box chestbox ${it.g >= 3 ? 'glow g' + it.g : ''}" data-action="claim" data-i="${i}" style="--c:${GRADES[it.g].color}"
      title="${GRADES[it.g].name} 상자 · 내용물 ${LOOT_BOXES[it.g].n[0]}${LOOT_BOXES[it.g].n[1] > LOOT_BOXES[it.g].n[0] ? '~' + LOOT_BOXES[it.g].n[1] : ''}개 · 눌러서 열기">
      ${boxIcon(it.g)}<span class="lname">${lootName(it)}</span>
      <span class="grade">⚖️ ${LOOT_BOXES[it.g].w}</span>
    </button>` : isMystery(it) ? `
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
      <h3>🎒 가방 <small>상자 ${S.bag.length}개 · ⚖️ ${bagWeight()} / ${bagCap()}</small></h3>
      <button class="btn${rd(S.bag.length)}" data-action="claim-all" ${S.bag.length ? '' : 'disabled'}>모두 열기</button>
    </div>
    <div class="hint">상자를 눌러 열면 내용물이 나옵니다. 장비는 창고로 가고, 골동품은 팔려서 재화가 되고, 소비 아이템은 보급품에 더해집니다.</div>
    <div class="boxes">${opened}${closed || (opened ? '' : '<div class="empty">가방이 비어 있습니다.</div>')}</div>
    ${revealed.length ? `<div class="gain">획득 합계 — ${sumLine || '없음'}${sum.gear ? ` <button class="btn${rd(Object.keys(GEAR_SLOTS).some(gearBetter))}" data-action="tab" data-tab="gear">🗡️ 장비 보기</button>` : ''}</div>` : ''}`;
}

function viewTown() {
  const id = townSel(), b = BUILDINGS[id], lv = S.bld[id];
  let act;
  if (S.build && S.build.id === id) {
    act = `<div class="prog"><div data-bar="build"></div></div><div class="small">건설 중 · <span data-live="buildLeft"></span></div>`;
  } else if (lv >= BUILD_MAX) {
    act = '<div class="small">최대 레벨</div>';
  } else {
    const c = buildCost(id, lv);
    act = `<div class="costs">${costChip('<i class="gc"></i>', c.gold, S.gold)}${costChip('🪵', c.wood, S.mats.wood)}${costChip('🪨', c.ore, S.mats.ore)}${costChip('💎', c.mana, S.mats.mana)}</div>
      <button class="btn${rd(canBuild(id))}" data-action="build" data-id="${id}" ${S.build || !canAfford(c) ? 'disabled' : ''}>
        ${S.build ? `${BUILDINGS[S.build.id].name} 건설 중` : `건설 · ${fmtTime(buildTimeAt(lv))}`}</button>`;
  }
  return `<div class="shead"><h3>🏘 마을</h3><small>건물을 눌러 고르세요 · 한 번에 한 건물만, 원정 중에도 공사는 계속돼요</small></div>
    <canvas class="town"></canvas>
    <div class="card tsel">
      <div class="ic">${b.icon}</div>
      <div class="info">
        <b>${b.name} <small>Lv ${lv}</small></b>
        <div class="eff">${b.effect(lv)}</div>
        ${lv < BUILD_MAX ? `<div class="eff next">다음 → ${b.effect(lv + 1)}</div>` : ''}
      </div>
      <div class="act">${act}</div>
    </div>`;
}

function viewTrain() {
  const st = stats();
  const cap = trainCapAt(S.bld.training);
  const cards = TRAINING.map((u) => {
    const lv = S.train[u.id], max = trainMax(u), cost = trainCost(u);
    const maxed = lv >= max;
    return `
      <button class="tcard${rd(canTrain(u))}" data-action="train" data-id="${u.id}" ${maxed || S.gold < cost ? 'disabled' : ''}>
        <span class="nm">${u.name}</span>
        <span class="val">${u.show(st)}</span>
        <span class="small">Lv ${lv} / ${max === Infinity ? '∞' : max}</span>
        <span class="cost">${maxed ? (lv >= u.max ? 'MAX' : '훈련장 필요') : '<i class="gc"></i> ' + fmt(cost)}</span>
      </button>`;
  }).join('');
  const anyTrain = TRAINING.some(u => S.train[u.id] < trainMax(u) && S.gold >= trainCost(u));
  const c = heroClass(), w = heroWeapon();
  const next = Object.keys(CLASSES).filter(id => CLASSES[id].from === S.cls);
  const nextLine = next.length ? `다음 전직: Lv ${CLASS_REQ[CLASSES[next[0]].tier].level}` : '최종 직업';
  return `
    <div class="shead">
      <h3>🎯 훈련 <small>최대 Lv ${cap} (훈련장 Lv ${S.bld.training})</small></h3>
      <button class="btn" data-action="train-all" ${anyTrain ? '' : 'disabled'}>⚡ 골고루 올리기</button>
    </div>
    <div class="tgrid">${cards}</div>
    <h3>🗡 직업 · 무기</h3>
    <div class="card">
      <div class="ic">${c.icon}</div>
      <div class="info"><b>${c.name} · ${w.name}</b>
        <div class="eff">대장간 보정 ×${forgeMultAt(S.bld.forge).toFixed(2)} · DPS ${fmt(dpsOf(st))} · ${nextLine}</div></div>
      <div class="act"><button class="btn${rd(anyClassReady())}" data-action="tab" data-tab="class">⚜️ 전직 트리</button></div>
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
  if (w.kind === 'ranged') out.push(`🏹 사거리 ${w.range}`);
  else if (w.range > 20) out.push(`📏 사거리 ${w.range}`);
  if (w.shots > 1) out.push(`✨ ${w.shots}연발`);
  else if (w.targets >= 9) out.push('🌀 범위 휩쓸기');
  else if (w.targets > 1) out.push(`➰ ${w.targets}마리 관통`);
  return out.map(t => `<span class="chip">${t}</span>`).join('');
}

// 직업 스킬 목록: 해금 레벨·쿨타임·피해 배율. 내 직업이면 해금 여부도 보여 준다
function skillList(id) {
  const list = skillsOf(id);
  if (!list.length) return '';
  const mine = id === S.cls;
  return `<div class="skills">${list.map((k) => {
    const inh = k.cls !== id;              // 1차에서 물려받은 스킬
    const on = mine && S.level >= k.lv;
    // 숙련도를 반영한 값 (내 직업은 지금 숙련도, 다른 직업은 처음 익혔을 때인 Lv1)
    const pow = mine ? skillPow(k.id) : skillPowAt(k, 1, id), mult = skillMult(k) * pow, hitN = k.hits.length, cd = mine ? skillCd(k.id) : skillCdOf(k, 1, id);
    const dmg = k.ward ? `초당 ×${+(k.ward.tick * pow).toFixed(2)}` : `×${+mult.toFixed(1)}${hitN > 1 ? ` (${hitN}회)` : ''}`;
    return `<div class="skill ${on ? 'on' : mine ? 'locked' : ''}">
      <span class="sicon">${k.icon}</span>
      <span class="sbody"><b>${mine ? skillNameAt(k, skillLv(k.id)) : k.name}</b> <small>${k.ult ? `💥 궁극기 · ${SKILLS[k.mastOf].name} 숙련도 이어받음 · ` : ''}${inh ? `${CLASSES[k.cls].name}에게서 계승 · ` : ''}${k.lv ? `Lv ${k.lv}` : '전직 즉시'} · 쿨 ${cd}초 · ${dmg}${k.crit ? ' · 치명 확정' : ''}${mine && !on ? ' · 🔒' : ''}</small>
        <span class="sdesc">${k.desc}</span></span>
    </div>`;
  }).join('')}</div>`;
}

// 스킬 숙련도: 지금 직업의 스킬에 📖 비전서를 먹여서 Lv30 까지 키운다 (classes.js SKILL_MAX·MASTERY)
function viewMastery() {
  const list = skillsOf(S.cls);
  // 보유 비전서를 맨 위에 크게: 지금 몇 권 있고, 어떻게 쓰는지
  const head = `<div class="mhead"><div><h3>📖 스킬 숙련도</h3>
      <small>칸 1개 = 비전서 1권 · 칸을 다 채우면 레벨 업 · Lv 10·20·30 에서 기술 진화</small></div>
    <span class="mchip${S.tomes ? '' : ' none'}" title="가진 비전서">📖 <b>${fmt(S.tomes)}</b><small>권 보유</small></span></div>`;
  if (!list.length) return `${head}<div class="hint">1차 전직을 하면 스킬을 익히고, 비전서로 키울 수 있어요.</div>`;
  const firstOpen = list.find((x) => skillLvOf(S.mast[mastKey(x.id)] || 0).lv < SKILL_MAX);
  const rows = list.map((k) => {
    const total = S.mast[mastKey(k.id)] || 0, s = skillLvOf(total), m = masteryOf(s.lv), max = s.lv >= SKILL_MAX;
    const need = max ? 0 : s.need - s.have;
    const nextM = MASTERY[m + 1];
    const mt = (lv) => k.ward ? `초당 ×${(k.ward.tick * skillPowAt(k, lv, S.cls)).toFixed(2)}` : `×${(skillMult(k) * skillPowAt(k, lv, S.cls)).toFixed(2)}`;
    const tag = m ? `<span class="mtag m${m}">${MASTERY[m].star} ${MASTERY[m].name}</span>` : '';
    const locked = S.level < k.lv;
    const all = Math.min(S.tomes, SKILL_TOME_MAX - total);   // 전부 쓰기: 가진 만큼 (만렙에서 남는 건 안 씀)
    const ups = skillLvOf(total + all).lv - s.lv;
    const pulse = guidePendingFeed() && k === firstOpen ? ' gpulse' : '';
    const btns = max ? '<span class="mmax">★★★ 최고 단계</span>' : `
      <button class="btn mb1${rd(S.tomes >= need)}${pulse}" data-action="tome" data-id="${k.id}" data-n="1" ${S.tomes < 1 ? 'disabled' : ''}>1권 쓰기</button>
      <button class="btn mball" data-action="tome" data-id="${k.id}" data-n="${all}" ${all < 1 ? 'disabled' : ''} title="${all ? `비전서 ${all}권을 모두 넣어요${ups ? ` (Lv +${ups})` : ''}` : ''}">전부 쓰기${all ? ` <small>${all}${ups ? ` · Lv+${ups}` : ''}</small>` : ''}</button>`;
    // 다음 진화(Lv10·20·30)를 크게: 거기까지 남은 권수와 바뀌는 모습
    const toNext = nextM ? skillTomesAt(nextM.lv) - total : 0;
    const evo = nextM ? `
      <div class="mevo" title="${k.stageDesc ? k.stageDesc[m + 1] : nextM.desc}">
        <span class="mevo-s">${nextM.star} Lv ${nextM.lv}</span>
        <span class="mevo-t">${k.stageName ? `<b>「${k.stageName[m + 1]}」</b> ${k.stageDesc[m + 1]}` : nextM.desc}</span>
        <span class="mevo-n">${toNext}권 남음</span>
      </div>` : '';
    return `
      <div class="mskill m${m}${locked ? ' locked' : ''}">
        <span class="sicon">${k.icon}</span>
        <div class="mbody">
          <div class="mtitle"><b>${skillNameAt(k, s.lv)}</b> <span class="mlv">Lv ${s.lv}</span>${tag}${locked ? ` <span class="mlock">🔒 캐릭터 Lv ${k.lv}에 사용 가능</span>` : ''}</div>
          ${max ? '' : `<div class="mseg"><div class="cells">${Array.from({ length: s.need }, (_, i) => `<i class="${i < s.have ? 'on' : ''}"></i>`).join('')}</div>
            <span class="mnum"><b>${s.have}</b>/${s.need}</span></div>`}
          <small class="mstat">${max ? '' : '다음 레벨 · '}쿨타임 ${skillCdOf(k, s.lv, S.cls)}초${max ? '' : ` → <b>${skillCdOf(k, s.lv + 1, S.cls)}초</b>`} · 위력 ${mt(s.lv)}${max ? '' : ` → <b>${mt(s.lv + 1)}</b>`}</small>
          ${evo}
        </div>
        <div class="act">${btns}</div>
      </div>`;
  }).join('');
  const guide = guidePendingFeed()
    ? `<div class="gtip big">👉 <b>📖 1권 쓰기</b>를 눌러 보세요 — 칸이 차면 레벨이 오르고, 쿨타임이 바로 줄고 위력이 올라요.</div>`
    : S.tomes === 0 ? `<div class="gtip">📖 비전서는 ${towerUnlocked() ? '<button class="lnk" data-action="tab" data-tab="tower">🗼 도전의 탑</button>에서 가장 많이 얻어요 (원정 보스·레이드 상자·결투 시즌에서도)' : `🗼 도전의 탑(스테이지 ${TOWER_UNLOCK_STAGE}에 열림)·원정 보스·레이드 상자·결투 시즌에서 얻어요`}</div>` : '';
  const note = heroClass().tier >= 3
    ? '3차 궁극기는 대신한 1차 스킬의 숙련도를 그대로 이어받아요. 2차 스킬은 숙련도 그대로 제 위력을 내요.'
    : '1차 스킬은 2차 전직 뒤에도 숙련도 그대로 써요 (2차 직업에선 위력이 조금 줄어요). 3차 전직하면 궁극기가 그 자리를 숙련도째 이어받아요.';
  return `${head}${guideFlow('class')}${guide}${rows}<div class="hint">${note}</div>`;
}

function reqChips(id) {
  const req = CLASS_REQ[CLASSES[id].tier];
  const chip = (ok, text) => `<span class="chip ${ok ? 'ok' : 'lack'}">${text}</span>`;
  return chip(S.level >= req.level, `Lv ${req.level}`) + (req.mana ? chip(S.mats.mana >= req.mana, `💎 ${req.mana}`) : '') + chip(S.gold >= req.gold, `<i class="gc"></i> ${fmt(req.gold)}`);
}

function viewClass() {
  if (!classSel || !CLASSES[classSel]) {
    const next = Object.keys(CLASSES).filter(id => CLASSES[id].from === S.cls);
    classSel = next.find(id => classBlocker(id) === '') || next[0] || S.cls;
  }
  const node = (id) => {
    const c = CLASSES[id], st = classState(id), hidden = classMasked(id);
    return `
      <button class="cnode t${c.tier} ${st} ${id === classSel ? 'sel' : ''}${rd(st === 'ready')}" data-action="class-sel" data-id="${id}">
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
    ${viewMastery()}
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
          <div class="chips">${modChips(id) || '<span class="small">기본 능력치</span>'}</div>
          ${skillList(id)}`}
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
    // 평타 몇 번 뒤에 그 직업의 스킬 모션을 번갈아 보여 준다 (이펙트 없이 자세만, 공중 높이는 칸 안으로 줄인다)
    let sp = null;
    const sks = classSkillsOf(id);       // 그 직업만의 스킬 모션 (물려받은 1차 스킬은 빼고)
    if (sks.length) {
      const cyc = 5.5, q = tt % cyc, sk = sks[Math.floor(tt / cyc) % sks.length];
      if (q >= cyc - sk.dur - 0.3 && q < cyc - 0.3) {
        const u = (q - (cyc - sk.dur - 0.3)) / sk.dur;
        sp = SKILL_FX[sk.id].pose(u, { dir: 1, x: () => 0, tx: () => 26 });
        if (sp.facing == null) delete sp.facing;
        sp.dx = Math.max(-12, Math.min(26, sp.dx || 0));
        sp.lift = Math.min(18, (sp.lift || 0) * 0.2);
        swing = -1;
      }
    }
    const k = cv.classList.contains('big') ? 1.5 : 1;
    const paint = (gg) => {
      gg.save();
      gg.translate(Math.round(w * 0.36), h - 8);
      gg.scale(k, k);
      drawHero(gg, id, 0, 0, { mode: 'fight', swing, combo: Math.floor(tt / 1.4), t: tt, walkT: 0, ...(sp || {}), alpha: sp && sp.alpha != null ? Math.max(0.25, sp.alpha) : 1 });
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
const gearUi = { sel: { slot: 'weapon' }, sellAsk: false, protect: false, last: null };   // sel: 고른 슬롯·장비, last: 마지막 강화 결과 { slot, result, from, to, fresh }
const GEAR_LIST_MAX = 120;                     // 창고가 아주 커져도 한 번에 그리는 개수

const ENH_RESULT = {
  up: (r) => `✨ 성공! +${r.to}`,
  keep: () => '💨 실패 — 단계 유지',
  down: (r) => `💔 실패 — +${r.from} → +${r.to} 하락`,
  reset: (r) => `💥 실패 — +${r.from} → +0 초기화`,
  saved: () => '📜 보호 주문서가 부서지며 단계를 지켰다',
};

// ── 강화 연출: 빛이 슬롯으로 모이다가(CHARGE) 결과가 나오면 성공은 팡 터지고, 실패는 파스스 흩어진다(BURST) ──
// 결과는 모으기가 끝나는 순간에 굴린다. 화면 전체를 덮는 고정 캔버스에 슬롯 위치를 찾아 그린다 (캠프 창이 다시 그려져도 끊기지 않게)
const ENH_CHARGE = 0.6, ENH_BURST = 0.55;
let enhFx = null;                 // { slot, t0, t1, res, ps: 모이는 빛, bs: 터지는 조각 }
let enhCv = null;

const rnd = (a, b) => a + Math.random() * (b - a);

function startEnhanceFx(slot, protect) {
  enhFx = {
    slot, t0: performance.now(), t1: 0, res: null,
    ps: Array.from({ length: 34 }, () => ({ a: rnd(0, Math.PI * 2), r: rnd(42, 78), s: rnd(0, ENH_CHARGE - 0.22), d: rnd(0.16, 0.24), c: Math.random() < 0.3 ? '#fff' : '#ffd257' })),
  };
  setTimeout(() => resolveEnhanceFx(slot, protect), ENH_CHARGE * 1000);
  if (!enhCv) {
    enhCv = document.createElement('canvas');
    enhCv.id = 'enhfx';
    document.body.appendChild(enhCv);
  }
  requestAnimationFrame(drawEnhanceFx);
}

function resolveEnhanceFx(slot, protect) {
  const r = enhance(slot, protect);
  if (!r) { enhFx = null; if (campOpen) renderCamp(); return; }     // 그 사이 출정 등으로 강화할 수 없게 됐다
  gearUi.last = { slot, ...r, fresh: true };
  if (r.result === 'up' && r.to % 5 === 0) toast(`⚒️ ${GEAR_SLOTS[slot].name} +${r.to} 달성!`);
  const up = r.result === 'up', big = up && r.to % 5 === 0;
  const bad = r.result === 'down' || r.result === 'reset';
  const col = up ? ['#fff', '#ffd257', '#7dffb0'] : r.result === 'saved' ? ['#7cc4ff', '#cfe8ff'] : r.result === 'keep' ? ['#9a9aa8', '#c8c8d0'] : ['#b02a2a', '#4a4650', '#6e2020', '#2a262e'];
  const fx = enhFx;
  fx.res = r;
  fx.t1 = performance.now();
  // 끝내기는 타이머로 — 창이 가려져 그리기 루프가 멈춰도 강화 버튼이 잠긴 채 남지 않게
  setTimeout(() => { if (enhFx !== fx) return; enhFx = null; drawEnhanceFx(); if (campOpen) renderCamp(); }, ENH_BURST * 1000);
  fx.bs = Array.from({ length: up ? (big ? 44 : 30) : 40 }, (_, i) => up
    ? { a: rnd(0, Math.PI * 2), R: rnd(45, big ? 110 : 85), w: rnd(1.5, 3), c: col[i % col.length] }
    : { a: rnd(0, Math.PI * 2), r0: rnd(0, 14), R: rnd(16, 52), rise: bad ? -rnd(30, 70) : rnd(14, 36), z: rnd(2.5, 4.5) + (bad ? 1 : 0), f: rnd(0, 9), c: col[i % col.length] });
  // 하락·초기화: 슬롯에 금이 간다 (가운데서 뻗는 들쭉날쭉한 선)
  const nCrack = r.result === 'reset' ? 8 : 5;
  fx.cracks = bad ? Array.from({ length: nCrack }, (_, i) => {
    let a = (i / nCrack) * Math.PI * 2 + rnd(-0.3, 0.3), d = 0;
    const pts = [[0, 0]];
    while (d < rnd(22, r.result === 'reset' ? 46 : 34)) { d += rnd(6, 10); a += rnd(-0.5, 0.5); pts.push([Math.cos(a) * d, Math.sin(a) * d]); }
    return pts;
  }) : null;
  save();
  if (campOpen) renderCamp();
  renderHud();
}

function drawEnhanceFx() {
  const fx = enhFx, cv = enhCv;
  const dpr = window.devicePixelRatio || 1, W = window.innerWidth, H = window.innerHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  if (!fx) return;
  const now = performance.now();
  if (fx.res && (now - fx.t1) / 1000 > ENH_BURST) return;    // 마지막 장면은 비우고 끝 (정리는 resolveEnhanceFx 의 타이머)
  requestAnimationFrame(drawEnhanceFx);
  const box = campOpen && campTab === 'gear' && document.querySelector(`.gsbtn.s-${fx.slot} .gsbox`);
  if (!box) return;
  const bb = box.getBoundingClientRect(), cx = bb.left + bb.width / 2, cy = bb.top + bb.height / 2;
  g.globalCompositeOperation = 'lighter';
  const glow = (r, c, a) => {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, c.replace('A', a)); gr.addColorStop(1, c.replace('A', 0));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  };

  if (!fx.res) {
    // 위이잉 — 빛줄기가 점점 빨라지며 가운데로 빨려 들고, 중심 빛이 떨리며 부푼다
    const t = (now - fx.t0) / 1000, p = Math.min(1, t / ENH_CHARGE);
    for (const q of fx.ps) {
      const u = (t - q.s) / q.d;
      if (u <= 0 || u >= 1) continue;
      const k = u * u, r = q.r * (1 - k), tail = Math.min(r, 6 + 16 * k);
      g.strokeStyle = q.c; g.globalAlpha = Math.min(1, u * 4) * 0.9; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(q.a) * r, cy + Math.sin(q.a) * r);
      g.lineTo(cx + Math.cos(q.a) * (r + tail), cy + Math.sin(q.a) * (r + tail));
      g.stroke();
    }
    g.globalAlpha = 1;
    const ring = 58 * (1 - p) + 22;
    g.strokeStyle = `rgba(255, 210, 87, ${0.15 + 0.5 * p})`; g.lineWidth = 1.5 + p;
    g.beginPath(); g.arc(cx, cy, ring, 0, Math.PI * 2); g.stroke();
    glow(14 + 26 * p + 3 * Math.sin(t * (20 + 40 * p)), 'rgba(255, 225, 140, A)', 0.25 + 0.55 * p);
    return;
  }

  const t = (now - fx.t1) / 1000, x = Math.min(1, t / ENH_BURST);
  if (fx.res.result === 'up') {
    // 팡 — 하얀 섬광, 퍼지는 충격파 고리, 사방으로 튀는 불꽃
    const big = fx.res.to % 5 === 0, out = 1 - (1 - x) ** 3;
    glow(30 + (big ? 60 : 40) * out, 'rgba(255, 255, 235, A)', (1 - x) ** 2);
    g.strokeStyle = `rgba(125, 255, 176, ${(1 - x) * 0.9})`; g.lineWidth = 4 * (1 - x) + 0.5;
    g.beginPath(); g.arc(cx, cy, 16 + (big ? 100 : 70) * out, 0, Math.PI * 2); g.stroke();
    if (big) {
      g.strokeStyle = `rgba(255, 210, 87, ${(1 - x) * 0.7})`; g.lineWidth = 2 * (1 - x) + 0.5;
      g.beginPath(); g.arc(cx, cy, 10 + 70 * (1 - (1 - x) ** 2), 0, Math.PI * 2); g.stroke();
    }
    for (const q of fx.bs) {
      const d = 10 + q.R * out, tail = 14 * (1 - x) + 2;
      g.strokeStyle = q.c; g.globalAlpha = 1 - x * x; g.lineWidth = q.w * (1 - x * 0.6);
      g.beginPath();
      g.moveTo(cx + Math.cos(q.a) * d, cy + Math.sin(q.a) * d);
      g.lineTo(cx + Math.cos(q.a) * (d - tail), cy + Math.sin(q.a) * (d - tail));
      g.stroke();
    }
  } else if (fx.cracks) {
    // 하락·초기화 — 빛이 검붉게 꺼지고, 슬롯에 금이 가며, 검은 파편이 툭툭 떨어진다
    const reset = fx.res.result === 'reset';
    g.globalCompositeOperation = 'source-over';
    const fade = x < 0.7 ? 1 : (1 - x) / 0.3;
    const dark = g.createRadialGradient(cx, cy, 0, cx, cy, 44 + (reset ? 16 : 0));
    dark.addColorStop(0, `rgba(25, 0, 4, ${0.75 * fade})`); dark.addColorStop(0.6, `rgba(60, 0, 8, ${0.45 * fade})`); dark.addColorStop(1, 'rgba(60, 0, 8, 0)');
    g.fillStyle = dark; g.beginPath(); g.arc(cx, cy, 60, 0, Math.PI * 2); g.fill();
    if (x < 0.25) {     // 터지자마자 붉은 경고 테두리가 한 번 번쩍
      g.strokeStyle = `rgba(255, 40, 40, ${(1 - x / 0.25) * 0.9})`; g.lineWidth = 3;
      g.strokeRect(bb.left - 3, bb.top - 3, bb.width + 6, bb.height + 6);
    }
    const grow = Math.min(1, x / 0.25);
    g.strokeStyle = `rgba(255, 60, 60, ${0.9 * fade})`; g.lineWidth = reset ? 2 : 1.5;
    for (const pts of fx.cracks) {
      const n = Math.max(2, Math.ceil(pts.length * grow));
      g.beginPath();
      pts.slice(0, n).forEach(([px, py], i) => (i ? g.lineTo(cx + px, cy + py) : g.moveTo(cx + px, cy + py)));
      g.stroke();
    }
    for (const q of fx.bs) {
      const d = q.r0 + q.R * 0.6 * (1 - (1 - x) ** 2);
      const px = cx + Math.cos(q.a) * d, py = cy + Math.sin(q.a) * d * 0.6 - q.rise * x * x;
      g.globalAlpha = fade;
      g.fillStyle = q.c;
      g.fillRect(Math.round(px - q.z / 2), Math.round(py - q.z / 2), q.z, q.z);
    }
  } else {
    // 파스스 — 모였던 빛이 힘없이 꺼지며 재처럼 흩어져 깜빡이다 사라진다
    glow(40 * (1 - x) + 4, fx.res.result === 'saved' ? 'rgba(124, 196, 255, A)' : 'rgba(190, 190, 205, A)', 0.6 * (1 - x) ** 3);
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 3; i++) {     // 꺼진 자리에서 피어오르는 연기
      const sx = cx + (i - 1) * 12, sy = cy - 26 * x - i * 4, sr = 12 + 22 * x;
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      gr.addColorStop(0, `rgba(120, 120, 135, ${0.35 * (1 - x)})`); gr.addColorStop(1, 'rgba(120, 120, 135, 0)');
      g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    }
    for (const q of fx.bs) {
      const d = q.r0 + q.R * (1 - (1 - x) ** 2);
      const px = cx + Math.cos(q.a) * d, py = cy + Math.sin(q.a) * d * 0.7 - q.rise * x;
      g.globalAlpha = (1 - x) * (0.55 + 0.45 * Math.sin(t * 38 + q.f));
      g.fillStyle = q.c;
      const z = q.z * (1 - x * 0.5);
      g.fillRect(Math.round(px - z / 2), Math.round(py - z / 2), z, z);
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

// ───────────────────────── 레드닷 ─────────────────────────
// 글을 읽지 않아도 어디를 누르면 되는지 보이도록, 지금 바로 할 수 있는 일이 있는 탭·버튼에 빨간 점을 찍는다.
// 조건은 모두 "누르면 실제로 되는가"라서, 하고 나면 저절로 사라진다 (봤는지는 따로 기억하지 않는다).
// 탭의 점 → 그 탭 안의 점 → 누를 버튼 순으로 따라가면 된다. 하단바 HUD·말풍선에는 캠프 전체를 합쳐서 찍는다.
const DOT = '<i class="dot"></i>';
const rd = (on) => (on ? ' rd' : '');
const canBuild = (id) => !S.build && S.bld[id] < BUILD_MAX && canAfford(buildCost(id, S.bld[id]));
// 훈련은 골드가 쌓이면 늘 할 수 있어서, 다음 단계 비용의 2배가 모였을 때만 찍는다 (버튼은 비용만 있으면 눌림)
const canTrain = (u) => S.train[u.id] < trainMax(u) && S.gold >= 2 * trainCost(u);
// 자동 장착하면 더 강해지는 부위(세트 효과 포함)
const gearBetter = (slot) => bestLoadout()[slot] !== S.gear.eq[slot];
// 강화석은 강화에만 쓰니 비용이 모이면 바로 찍는다 (장비를 낀 부위만 — 빈 부위 강화는 급하지 않다)
const gearCanEnh = (slot) => !!equipped(slot) && canEnhance(slot);
function campDots() {
  refillTickets();
  return {
    report: S.bag.length > 0 || (!!S.report && S.report !== reportSeen),
    town: Object.keys(BUILDINGS).some(canBuild),
    train: TRAINING.some(canTrain),
    gear: Object.keys(GEAR_SLOTS).some((k) => gearBetter(k) || gearCanEnh(k)),
    class: anyClassReady() || canLevelSkill(),
    rank: inboxUnread() > 0,
    raid: S.raid.chests.length > 0 || !!raidUi.room || wbDot(),
    // 탑: 처음 열렸거나, 아직 안 본 도전 정산이 있거나, 오늘 받을 비전서가 남았고 지금 도전할 수 있을 때
    tower: towerUnlocked() && !S.guide.towerSeen || towerResultPending() || towerSweepReady() || towerBlocker() === '',
  };
}
const campHasDot = () => Object.values(campDots()).some(Boolean);

function enhOdds(L) {
  const e = ENHANCE[L], fail = 1 - e.rate;
  const pct = (v) => (v * 100 < 1 && v > 0 ? (v * 100).toFixed(1) : Math.round(v * 100)) + '%';
  const risk = [];
  if (e.down) risk.push(`<span class="warn">하락 ${pct(fail * e.down)}</span>`);
  if (e.reset) risk.push(`<span class="bad">초기화 ${pct(fail * e.reset)}</span>`);
  return `성공 <b>${pct(e.rate)}</b>${risk.length ? ' · ' + risk.join(' · ') : ' · 실패해도 유지'}`;
}

// 장비 화면 위쪽에 서 있는 내 캐릭터 (<canvas class="gchar">, 장비 탭이 열려 있는 동안 매 프레임 그림)
function drawGearHero() {
  const cv = document.querySelector('canvas.gchar');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (!w) return;
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (cv.width !== pw) { cv.width = pw; cv.height = ph; }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, w, h);
  let swing = clock % 2.6; if (swing >= 1) swing = -1;
  g.save();
  g.translate(Math.round(w * 0.4), h - 6);
  g.scale(2, 2);
  drawHero(g, S.cls, 0, 0, { mode: 'fight', swing, combo: Math.floor(clock / 2.6), t: clock, lift: 0, walkT: 0 });
  g.restore();
}

// 고른 장비로 바꿔 끼면 전투력이 얼마나 변하는지 (세트가 깨지거나 맞춰지는 것까지 반영)
function gearCmp(it) {
  const cur = equipped(it.slot);
  if (isEquipped(it)) return '<em class="on">장착 중</em>';
  const d = cur ? swapGain(it) : 1;
  return d > 0.005 ? `<span class="up">▲${cur ? Math.round(d * 100) + '%' : ''}</span>` : d < -0.005 ? `<span class="down">▼${Math.round(-d * 100)}%</span>` : '<span>＝</span>';
}

// 고른 대상: { slot } 장착 슬롯 | { id } 창고 장비. 창고 장비가 팔렸거나 장착되면 그 부위 슬롯으로 돌아간다
function gearSel() {
  const sel = gearUi.sel;
  if (sel.id != null) {
    const it = gearById(sel.id);
    if (it && !isEquipped(it)) return { it };
    gearUi.sel = { slot: it ? it.slot : 'weapon' };
  }
  return { slot: gearUi.sel.slot };
}

function gearSlotBtn(slot) {
  const def = GEAR_SLOTS[slot], it = equipped(slot), L = S.gear.enh[slot];
  const last = gearUi.last && gearUi.last.slot === slot && gearUi.last.fresh ? ' flash-' + gearUi.last.result
    : enhFx && !enhFx.res && enhFx.slot === slot ? ' charging' : '';
  return `
    <button class="gsbtn s-${slot} ${gearSel().slot === slot ? 'on' : ''}${last}" data-action="gear-sel-slot" data-slot="${slot}"
      style="--c:${it ? gearGrade(it).color : 'rgba(255,255,255,.18)'}" title="${def.name}">
      <span class="gsbox${rd(gearBetter(slot) || gearCanEnh(slot))}">${it ? gearIcon(it, 'big') : `<span class="gsempty">${def.icon}</span>`}<b class="lvl l${Math.min(5, Math.floor(L / 5))}">+${L}</b></span>
      <span class="gsname ${it ? gnClass(it) : ''}">${it ? gearName(it) : def.name}</span>
    </button>`;
}

const gearInfo = (it) => `
  <div class="gtop" style="--c:${gearGrade(it).color}">
    ${gearIcon(it, 'big')}
    <div><div class="gname ${gnClass(it)}">${gearName(it)}</div><small>${gearKindText(it)}${isSetGear(it) ? ` · ${GRADES[it.g].name}급 능력치` : ''}</small></div>
  </div>
  ${gearSpecialText(it) ? `<div class="gsp">✦ 고유 효과 — ${gearSpecialText(it)}</div>` : ''}
  ${GEAR_ITEMS[it.t].raid ? `<div class="gset">${setText(GEAR_ITEMS[it.t].raid)}</div>` : ''}
  <div class="gdesc">${gearDesc(it)}</div>`;

// 가진 💠 강화석 (강화 화면 우상단 칩)
const stoneChip = () => `<span class="stchip${S.stones ? '' : ' none'}" title="가진 강화석 — 원정 보스를 잡거나 장비를 팔면 얻어요">💠 <b>${fmt(S.stones)}</b></span>`;
// 장착 슬롯 세부: 낀 장비 + 부위 강화
function slotDetail(slot) {
  const def = GEAR_SLOTS[slot], it = equipped(slot), L = S.gear.enh[slot];
  const item = it
    ? `${gearInfo(it)}<div class="gstat">${gearStatText(gearStat(it))}${L < ENHANCE_MAX ? ` <small>→ +${L + 1} ${gearStatText(gearStat(it, L + 1))}</small>` : ''}</div>`
    : `<div class="gtop"><div class="gicon big empty"></div><div class="gname empty">${def.name} 비어 있음</div></div><div class="gstat small">강화 단계는 장비를 끼면 적용돼요</div>`;
  let enh;
  if (L >= ENHANCE_MAX) {
    enh = '<div class="small">최대 강화 달성!</div>';
  } else {
    const c = enhanceCostOf(slot), blocker = enhanceBlocker(slot);
    enh = `
      <div class="odds">+${L} → +${L + 1} · ${enhOdds(L)}</div>
      <div class="costs">${costChip('💠', c.stone, S.stones)}${costChip('🪨', c.ore, S.mats.ore)}${costChip('💎', c.mana, S.mats.mana)}</div>
      <button class="btn enh${rd(gearCanEnh(slot) && !enhFx)}" data-action="enhance" data-slot="${slot}" ${blocker || enhFx ? 'disabled' : ''}>${enhFx && enhFx.slot === slot && !enhFx.res ? '✨ 강화 중…' : '⚒️ 강화'}</button>
      <button class="chk ${gearUi.protect ? 'on' : ''}" data-action="gear-protect" ${S.items.protect ? '' : 'disabled'}>
        ${gearUi.protect && S.items.protect ? '☑' : '☐'} 📜 보호 주문서 <small>(${S.items.protect || 0}) · 하락·초기화 때만 소모</small></button>`;
  }
  const last = gearUi.last && gearUi.last.slot === slot ? gearUi.last : null;
  const res = last ? `<div class="enhres ${last.result} ${last.fresh ? 'fresh' : ''}">${ENH_RESULT[last.result](last)}</div>` : '';
  const top = S.gear.top[slot] > L ? ` <small>최고 +${S.gear.top[slot]}</small>` : '';
  return `
    <div class="ghead"><span>${def.icon} ${def.name}</span><b class="lvl l${Math.min(5, Math.floor(L / 5))}">+${L}</b>${top}${stoneChip()}</div>
    ${item}
    <div class="genh">${enh}${res}</div>`;
}

// 창고 장비 세부: 지금 낀 것과 비교 + 장착 / 판매
function itemDetail(it) {
  const cur = equipped(it.slot);
  return `
    <div class="ghead"><span>📦 창고</span></div>
    ${gearInfo(it)}
    <div class="gstat">${gearStatText(gearStat(it))} <span class="gcmp">${gearCmp(it)}</span></div>
    ${cur ? `<div class="small">지금 낀 장비: <span class="gn g${cur.g}">${gearName(cur)}</span> ${gearStatText(gearStat(cur))}</div>` : ''}
    <div class="gacts">
      <button class="btn enh" data-action="equip" data-id="${it.id}">장착</button>
      <button class="btn" data-action="gear-sell-one" data-id="${it.id}">판매 <i class="gc"></i> ${fmt(gearSellPrice(it))} · 💠 ${gearSellStones(it)}</button>
    </div>`;
}

function gearRow(it) {
  return `
    <button class="gitem ${gearUi.sel.id === it.id ? 'sel' : ''}" data-action="gear-sel-item" data-id="${it.id}" style="--c:${gearGrade(it).color}">
      ${gearIcon(it)}
      <span class="gi"><span class="gname ${gnClass(it)}">${gearName(it)}</span><span class="small">${gearKindText(it)}</span></span>
      <span class="gstat">${gearStatText(gearStat(it))}</span>
      <span class="gcmp">${gearCmp(it)}</span>
    </button>`;
}

// 위: 캐릭터와 장착 슬롯(갑옷 위 · 무기 왼쪽 아래 · 반지 오른쪽 아래) + 고른 것의 세부 정보
// 아래: 창고(장착 중 제외) 리스트 + 일괄 판매
// 기사 능력치 한눈에 보기. 숫자에 마우스를 올리면 실제로 어떤 효과인지 풀어서 보여 준다
function heroStatsPanel(st) {
  const pct = (v) => `${Math.round(v * 100)}%`;
  const stage = S.stage || 1;
  const other = 1 - (1 - st.guard) / (1 - st.defRed);   // 직업·장비 쪽 피해 감소 (방어 훈련 몫을 뺀 것)
  const rows = [
    ['⚔️ 공격력', fmt(st.atk), '한 대 칠 때 들어가는 기본 피해예요. 훈련·레벨이 절대값을 쌓고 장비·대장간·직업이 %로 곱해져요.'],
    ['❤️ 체력', fmt(st.maxHp), '버틸 수 있는 피해량이에요.'],
    ['🛡️ 방어', fmt(st.def), `지금 ${stage} 스테이지 몬스터 기준으로 받는 피해를 ${pct(st.defRed)} 경감해요.\n올릴수록 효율이 조금씩 줄고, 깊은 스테이지일수록 같은 방어의 효과가 줄어들어요.`],
    ['🧱 피해 감소', pct(st.guard), `몬스터에게 받는 피해를 총 ${pct(st.guard)} 덜 받아요 (최대 85%).\n· 방어 ${pct(st.defRed)}${other > 0.0005 ? `\n· 직업·장비 ${pct(other)}` : ''}\n둘은 곱으로 합쳐져요.`],
    ['💨 공격 속도', `${st.aspd.toFixed(2)}/초`, `1초에 ${st.aspd.toFixed(2)}번 공격해요.`],
    ['🎯 치명타', pct(st.crit), `${pct(st.crit)} 확률로 치명타가 터지고, 치명타는 ${Math.round(st.critMult * 100)}% 피해를 줘요 (최대 확률 80%).`],
  ];
  if (st.heal > 0) rows.push(['💚 타격 회복', pct(st.heal), `때릴 때마다 최대 체력의 ${pct(st.heal)}만큼 회복해요.`]);
  return `<div class="gstats">${rows.map(([k, v, tip]) =>
    `<div class="gsrow" data-tip="${esc(tip)}"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
}

function viewGear() {
  const st = stats(true);
  const slots = Object.keys(GEAR_SLOTS);
  const sel = gearSel();
  const inv = S.gear.inv.filter((x) => !isEquipped(x))
    .sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot) || gearScore(b) - gearScore(a));
  // 일괄 판매: 등급을 체크하고 버튼 하나로 판다 (세트·장착 중 장비는 빠진다)
  const f = S.gear.sellG;
  const sellList = bulkSellList();
  const sellGold = sellList.reduce((a, x) => a + gearSellPrice(x), 0);
  const sellStones = sellList.reduce((a, x) => a + gearSellStones(x), 0);
  const rare = sellList.filter((x) => x.g >= 4 || isSetGear(x)).length;
  const gradeChips = GRADES.map((G, i) => {
    const n = inv.filter((x) => x.g === i && !isSetGear(x)).length;
    return `<button class="gchip ${f[i] ? 'on' : ''}" data-action="gear-sell-grade" data-g="${i}" style="--c:${G.color}">${f[i] ? '☑' : '☐'} ${G.name}${n ? ` <small>${n}</small>` : ''}</button>`;
  }).join('');
  const setN = inv.filter(isSetGear).length;
  const setChip = `<button class="gchip ${S.gear.sellSet ? 'on' : ''}" data-action="gear-sell-set" style="--c:${SET_GRADE.color}">${S.gear.sellSet ? '☑' : '☐'} 🔗 ${SET_GRADE.name}${setN ? ` <small>${setN}</small>` : ''}</button>`;
  const sellBtn = gearUi.sellAsk
    ? `<button class="btn warn" data-action="gear-sell">정말 ${sellList.length}개 팔까요?${rare ? ` (전설 이상·세트 ${rare}개)` : ''}</button>`
    : `<button class="btn" data-action="gear-sell" ${sellList.length ? '' : 'disabled'}>💰 일괄 판매 ${sellList.length}개 · <i class="gc"></i> ${fmt(sellGold)} · 💠 ${fmt(sellStones)}</button>`;
  const sellBar = `
    <div class="sellbar">
      <span class="small">판매할 등급</span>${gradeChips}${setChip}
      <span class="sellgo">${sellBtn}</span>
    </div>
    <div class="hint">장착 중인 장비는 일괄 판매에서 빠져요. 🔗 세트 장비는 세트 칩을 체크했을 때만 팔려요. 원정에선 영웅까지 — 전설 이상은 🐉 레이드 처치 상자에서만 나와요.</div>`;

  const html = `
    <div class="gpanel">
      <div class="gleft">
        <div class="gstage">
          <canvas class="gchar"></canvas>
          ${slots.map(gearSlotBtn).join('')}
          <div class="gpow">전투력 <b>${fmt(powerOf(st))}</b></div>
        </div>
        ${heroStatsPanel(st)}
      </div>
      <div class="gdetail ${sel.slot && gearUi.last && gearUi.last.slot === sel.slot && gearUi.last.fresh ? 'flash-' + gearUi.last.result : ''}">
        ${sel.it ? itemDetail(sel.it) : slotDetail(sel.slot)}
      </div>
    </div>

    <div class="shead">
      <h3>📦 창고 <small>${inv.length}개 · 장착 중 제외</small></h3>
      <div class="row">
        <button class="chk ${S.gear.auto ? 'on' : ''}" data-action="gear-auto-toggle">${S.gear.auto ? '☑' : '☐'} 챙길 때 자동 장착</button>
        <button class="btn${rd(Object.keys(GEAR_SLOTS).some(gearBetter))}" data-action="gear-auto">✨ 자동 장착</button>
      </div>
    </div>
    ${sellBar}
    <div class="glist">${inv.slice(0, GEAR_LIST_MAX).map(gearRow).join('') || '<div class="empty">창고가 비어 있습니다. 원정에서 장비를 주워 오세요.</div>'}</div>
    ${inv.length > GEAR_LIST_MAX ? `<div class="hint">좋은 순으로 ${GEAR_LIST_MAX}개만 보여요 — 나머지는 일괄 판매로 정리하세요.</div>` : ''}`;
  if (gearUi.last) gearUi.last.fresh = false;       // 결과 연출은 한 번만
  return html;
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
// 열린 필드와 바로 다음 잠긴 필드 하나만 보여 준다 (그 뒤 필드는 열릴 때까지 숨김)
function viewFields() {
  const cur = zoneIndex(S.stage);
  const shown = ZONES.findIndex((z, i) => !zoneUnlocked(i, S.best));
  return ZONES.slice(0, shown < 0 ? ZONES.length : shown + 1).map((z, i) => {
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

// ───────────────────────── 결투 시즌 ─────────────────────────
// 시즌은 서버가 3일마다 자동으로 바꾼다. 끝난 시즌의 보상은 접속해 있을 때(입장 직후·10분마다·랭킹 탭) 받아서 세이브에 넣고,
// 서버에 저장한 뒤에 받았다고 알린다 (season.js claimSeasonReward 가 시즌 번호로 두 번 받지 않게 막는다).
const seasonUi = { data: null, at: 0, loading: false, error: null, tiers: false };
const SEASON_CHECK_EVERY = 10 * 60 * 1000;

function loadSeason(force = false) {
  if (seasonUi.loading || !activeNick() || !saveKey) return;
  if (!force && seasonUi.data && Date.now() - seasonUi.at < 15000) return;
  seasonUi.loading = true;
  seasonUi.error = null;
  const who = activeNick();
  fetchSeason()
    .then((d) => {
      if (activeNick() !== who || !saveKey) return;
      seasonUi.data = d;
      seasonUi.at = Date.now();
      return takeSeasonRewards(d.rewards || []);
    }, (e) => { seasonUi.error = e.message; })
    .finally(() => { seasonUi.loading = false; if (campOpen && campTab === 'rank') renderCamp(); });
}
setInterval(() => loadSeason(true), SEASON_CHECK_EVERY);

async function takeSeasonRewards(rows) {
  if (!rows.length) return;
  const got = rows.map(claimSeasonReward).filter(Boolean);
  save();
  if (got.length) {
    const L = got[got.length - 1];
    toast(`🏆 결투 시즌 ${L.season} 보상 — ${seasonTier(L.rank, L.total).name} (${L.total}명 중 ${L.rank}위) · ${seasonRewardText(L.reward, false)}`, 10000);
    renderHud();
  }
  await pushSave(true);
  if (!sync.error) await ackSeason(rows.map((r) => r.season)).catch(() => {});
}

function seasonRewardText(r, html = true) {
  const parts = html ? [gainText(r)] : [`골드 ${fmt(r.gold)} · 🪵 ${fmt(r.wood)} · 🪨 ${fmt(r.ore)} · 💎 ${fmt(r.mana)}`];
  if (r.chests) parts.push(`🎁 ${html ? esc(RAID_BOSSES[r.boss].chest.name) : RAID_BOSSES[r.boss].chest.name} ×${r.chests}`);
  if (r.tomes) parts.push(`📖 비전서 ×${r.tomes}`);
  return parts.join(' · ');
}

function fmtLeft(ms) {
  const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d}일 ${h}시간` : h ? `${h}시간 ${m % 60}분` : `${m % 60}분`;
}
const fmtDate = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function viewSeason() {
  loadSeason();
  const d = seasonUi.data;
  if (!d) return seasonUi.error ? `<div class="reason warn">⚠️ 시즌 정보를 불러오지 못했어요 — ${esc(seasonUi.error)}</div>` : '';
  const me = d.me, myTier = me.rank ? seasonTier(me.rank, Math.max(d.players, me.rank)) : null;
  const status = me.attacks > 0
    ? `내 기록 — ⚔️ <b>${me.rating}</b> · ${me.wins}승 ${me.losses}패 · <b>${me.rank}위</b> (지금 끝나면 ${myTier.name})`
    : `<span class="warn">아직 이번 시즌에 직접 건 결투가 없어요 — 1번 이상 걸어야 순위에 오르고 보상을 받아요 (도전받기만 한 결투는 세지 않아요)</span>`;
  const tiers = SEASON_TIERS.map((t) => `
    <div class="stier ${myTier && myTier.id === t.id ? 'on' : ''}"><b>${t.name}</b><span>${seasonRewardText(seasonReward(t))}</span></div>`).join('');
  const L = d.last, mine = S.season.last;
  const last = L ? `
    <div class="slast">지난 시즌 ${L.id} (${L.players}명) — ${L.top.length ? L.top.slice(0, 3).map((p, i) => `${['🥇', '🥈', '🥉'][i]} ${esc(p.nickname)} <small>${p.rating}</small>`).join(' · ') : '참가자 없음'}
      ${mine && mine.season === L.id ? `<br>내 보상 — ${seasonTier(mine.rank, mine.total).name} (${mine.rank}위) · ${seasonRewardText(mine.reward)}` : ''}</div>` : '';
  return `
    <div class="season">
      <div class="shd"><b>⚔️ 결투 시즌 ${d.id}</b><small>${fmtDate(d.endsAt)} 마감 · 남은 시간 ${fmtLeft(d.endsAt - d.now - (Date.now() - seasonUi.at))} · 참가 ${d.players}명</small></div>
      <div class="sme">${status}</div>
      <div class="stiers"><button class="lnk" data-action="season-tiers">${seasonUi.tiers ? '▾' : '▸'} 순위별 보상</button>
        <small>내 최고 스테이지 기준 · 상자는 열 수 있는 가장 높은 레이드 보스의 처치 상자</small>${seasonUi.tiers ? tiers : ''}</div>
      ${last}
    </div>`;
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
        <span class="rv"><small>시즌 ${p.wins}승 ${p.losses}패</small><b>⚔️ ${p.rating}</b></span>
        ${me ? '<span class="rme">나</span>'
          : `<button class="btn duel" data-action="duel" data-nick="${esc(p.nickname)}" ${duelBusy || duelActive() ? 'disabled' : ''}>⚔️ 결투</button>`}
      </div>`;
  };
  let body;
  if (d) {
    const none = rank.sort === 'duel' ? '아직 이번 시즌에 결투를 건 기사가 없어요. 🏰 스테이지 순위에서 상대를 골라 먼저 도전해 보세요!' : '아직 등록된 기사가 없어요.';
    body = d.players.map((p, i) => row(p, i + 1)).join('') || `<div class="empty">${none}</div>`;
    if (d.me && d.me.rank && !d.players.some(p => p.nickname === d.me.nickname)) body += '<div class="rgap">⋯</div>' + row(d.me, d.me.rank);
  } else if (rank.error) {
    body = `<div class="empty">⚠️ ${esc(rank.error)} <button class="btn" data-action="rank-refresh">다시 시도</button></div>`;
  } else {
    body = '<div class="empty">랭킹을 불러오는 중… <small>서버가 잠들어 있었다면 깨어나는 데 1분쯤 걸려요</small></div>';
  }
  return `
    <div class="shead">
      <h3>🏆 랭킹 <small>${d ? `${rank.sort === 'duel' ? '시즌 참가' : '기사'} ${d.total}명${d.me ? ` · 내 순위 ${d.me.rank ? d.me.rank + '위' : '없음'}` : ''}` : ''}</small></h3>
      <div class="segs">${seg('stage', '🏰 스테이지')}${seg('duel', '⚔️ 결투 시즌')}
        <button class="btn" data-action="rank-refresh" title="새로고침" ${rank.loading ? 'disabled' : ''}>↻</button></div>
    </div>
    <div class="hint">결투는 서로의 저장된 능력치로 자동으로 싸우고, 캠프 앞 하단바에서 벌어져요. 이기면 상대의 결투 점수를 가져오고, 상대가 접속해 있지 않아도 도전할 수 있어요.
      결투 점수는 3일마다 바뀌는 시즌마다 1000점에서 다시 시작하고, 시즌이 끝나면 직접 결투를 1번 이상 건 기사에게 순위별 보상을 줘요.</div>
    ${viewInbox()}
    ${rank.sort === 'duel' ? viewSeason() : ''}
    ${lastDuel ? `<div class="reason ${lastDuel.won ? '' : 'warn'}">최근 결투 — ${esc(duelResultText(lastDuel))}</div>` : ''}
    <div class="rlist">${body}</div>
    ${viewHall(d && d.hall)}`;
}

// 명예의 전당: 전체 초기화 직전에 서버가 남긴 지난 시즌 순위 (server/index.js admin reset). 최근 시즌이 위로.
// 시즌 번호는 기록을 남기기 시작한 시즌 3부터 센다
const HALL_FIRST_SEASON = 3;
let hallOpen = null;          // 펼친 시즌 id
function viewHall(hall) {
  if (!hall || !hall.length) return '';
  const medal = ['🥇', '🥈', '🥉'];
  const rows = hall.slice().reverse().map((h) => {
    const n = HALL_FIRST_SEASON + h.id - 1, open = hallOpen === h.id;
    const top3 = h.stage.slice(0, 3).map((p, i) => `<span class="chip">${medal[i]} ${esc(p.nickname)} <small>🏰${p.best}</small></span>`).join('');
    const more = open ? `
      <div class="hdet">
        ${h.stage.map((p, i) => `<div class="hrow"><span class="rk r${i + 1}">${i + 1}</span><b>${esc(p.nickname)}</b><small>${clsOf(p.cls).icon} ${clsOf(p.cls).name} · Lv ${p.level} · 🏰 ${p.best} · 전투력 ${fmt(p.power)}</small></div>`).join('')}
        ${h.duel.length ? `<div class="hrow"><small>⚔️ 마지막 결투 시즌</small> ${h.duel.map((p, i) => `${medal[i]} ${esc(p.nickname)} <small>${p.rating}점</small>`).join(' · ')}</div>` : ''}
      </div>` : '';
    return `<div class="hall"><button class="lnk" data-action="hall" data-id="${h.id}">${open ? '▾' : '▸'} 시즌 ${n}</button>
      <small>${fmtDate(h.at)} · ${h.players}명</small><span class="chips">${top3}</span>${more}</div>`;
  }).join('');
  return `<h3>🏛️ 명예의 전당 <small>시즌이 끝날 때(전체 초기화 직전)의 순위</small></h3>${rows}`;
}

// ───────────────────────── 받은 결투 (우편함) ─────────────────────────
// 다른 기사가 나에게 건 결투는 서버 우편함(GET /api/duels/inbox)에 남는다. 접속해 있는 동안(입장 직후·1분마다) 물어봐서
// 새로 온 게 있으면 토스트로 알리고, 랭킹 탭 점·숫자로 표시한다. 랭킹 탭을 보면 읽은 것으로 친다 (S.duelSeen = 마지막 id).
const inbox = { list: null, loading: false, error: null, told: 0, newAfter: null, more: false };
const INBOX_CHECK_EVERY = 60 * 1000;
const INBOX_SHOW = 5;
const inboxUnread = () => (inbox.list ? inbox.list.filter((m) => m.id > S.duelSeen).length : 0);

function loadInbox() {
  if (inbox.loading || !activeNick() || !saveKey) return;
  inbox.loading = true;
  const who = activeNick();
  fetchDuelInbox()
    .then((d) => {
      if (activeNick() !== who || !saveKey) return;
      inbox.list = d.list || []; inbox.error = null;
      tellInbox();
    }, (e) => { inbox.error = e.message; })
    .finally(() => { inbox.loading = false; if (campOpen) renderCamp(); renderHud(); });
}
setInterval(loadInbox, INBOX_CHECK_EVERY);

// 아직 알리지 않은 새 결투를 토스트 한 번으로 알린다 (결투를 보는 중이면 끝난 뒤 다음 확인 때)
function tellInbox() {
  if (duelActive() || raidActive()) return;
  const fresh = inbox.list.filter((m) => m.id > Math.max(S.duelSeen, inbox.told));
  if (!fresh.length) return;
  inbox.told = fresh[0].id;
  if (campOpen && campTab === 'rank') return;          // 지금 우편함을 보고 있다
  const win = fresh.filter((m) => m.won).length, sum = fresh.reduce((a, m) => a + (m.won ? m.delta : -m.delta), 0);
  const m = fresh[0];
  toast(fresh.length === 1
    ? `📬 받은 결투 — ${m.nickname}(Lv ${m.level}) · ${m.won ? `🛡️ 방어 성공! 결투 점수 +${m.delta}` : `💀 패배… 결투 점수 -${m.delta}`} · 🏆 랭킹 탭에서 확인`
    : `📬 받은 결투 ${fresh.length}건 — 방어 ${win} · 패배 ${fresh.length - win} · 결투 점수 ${sum >= 0 ? '+' : ''}${sum} · 🏆 랭킹 탭에서 확인`, 9000);
}

const fmtAgo = (t) => {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 24 * 60 ? `${Math.floor(m / 60)}시간 전` : fmtDate(t);
};

function viewInbox() {
  if (!inbox.list) { loadInbox(); return ''; }
  // 탭을 연 순간의 '새 결투' 경계를 기억해 두고 읽음 처리한다 (다시 그려도 NEW 표시는 탭을 떠날 때까지 남는다)
  if (inbox.newAfter == null) inbox.newAfter = S.duelSeen;
  if (inbox.list.length && inbox.list[0].id > S.duelSeen) { S.duelSeen = inbox.list[0].id; save(); }
  const L = inbox.list;
  if (!L.length) return '';
  const fresh = L.filter((m) => m.id > inbox.newAfter);
  const shown = inbox.more ? L : L.slice(0, Math.max(INBOX_SHOW, fresh.length));
  const row = (m) => {
    const c = clsOf(m.cls);
    return `
      <div class="mrow ${m.won ? '' : 'lost'}">
        <small class="mt">${fmtAgo(m.at)}</small>
        <span class="mnm"><b>${esc(m.nickname)}</b> <small>${c.icon} Lv ${m.level}</small>${m.id > inbox.newAfter ? ' <span class="mnew">NEW</span>' : ''}</span>
        <span class="mres">${m.won ? '🛡️ 방어' : '💀 패배'} <small>${m.won ? '+' : '-'}${m.delta} → ${m.rating}</small></span>
        ${m.won ? '' : `<button class="btn duel" data-action="duel" data-nick="${esc(m.nickname)}" ${duelBusy || duelActive() ? 'disabled' : ''}>⚔️ 복수</button>`}
      </div>`;
  };
  const win = L.filter((m) => m.won).length;
  return `
    <div class="inbox">
      <div class="shd"><b>📬 받은 결투</b><small>${fresh.length ? `<b class="warn">새 결투 ${fresh.length}건</b> · ` : ''}최근 ${L.length}건 · 방어 ${win} · 패배 ${L.length - win}</small></div>
      ${shown.map(row).join('')}
      ${L.length > shown.length || inbox.more ? `<button class="lnk" data-action="inbox-more">${inbox.more ? '▴ 접기' : `▾ ${L.length - shown.length}건 더 보기`}</button>` : ''}
    </div>`;
}

// ───────────────────────── 결투 ─────────────────────────
// 서버에 결투를 신청하고, 받은 기록은 캠프 창을 닫고 하단바에서 재생한다 (world.js playDuel).
let duelBusy = false;        // 서버 응답을 기다리는 중
let lastDuel = null;         // 마지막 결투 결과 (랭킹 탭 위에 보여 준다)

const duelResultText = (r) =>
  `${r.won ? '🏆 승리!' : '💀 패배…'} vs ${r.opponent.nickname}${r.fight.timeout ? (r.fight.judge === 'dmg' ? ' (시간 종료 · 체력이 비슷해 가한 피해 판정)' : ' (시간 종료 · 남은 체력 판정)') : ''} — 결투 점수 ${r.me.rating} (${r.won ? '+' : '-'}${r.delta})`;

function startDuel(nick) {
  if (duelBusy || duelActive() || raidActive() || S.phase !== 'camp') return;
  duelBusy = true;
  const who = activeNick();
  closeCamp();
  toast(`⚔️ ${nick}에게 결투를 신청하는 중…`, 70000);
  requestDuel(nick).then((res) => {
    rank.at = 0; seasonUi.at = 0;             // 다음에 랭킹 탭을 열면 바뀐 점수로 다시 불러온다
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


// ───────────────────────── 보스 레이드 ─────────────────────────
// 로비(방 목록 · 방 만들기 · 참가 · 준비 · 출정)는 서버가 들고 있고, 여기서는 2초마다 물어봐서 화면을 갱신한다.
// 방장이 출정하면 서버가 전투를 계산해 방에 결과를 남기고, 각자 그 결과를 받아 정산(raid.js settleRaid)한 뒤
// 캠프 앞 하단바에서 재생(world.js playRaid)하고, 끝나면 레이드 탭의 정산 화면을 연다.
const raidUi = {
  rooms: null, at: 0,          // 열린 방 목록과 불러온 시각
  room: null,                  // 내가 들어가 있는 방 (서버의 roomView)
  error: null, busy: false,    // busy: 방 만들기·참가·출정 등 요청 중
  revealed: [],                // 이번에 연 처치 상자 내용물 [{ it, got, fresh }]
  showResult: false,           // 정산 화면을 펼쳐 보여 줄지
  key: '',                     // 마지막으로 그린 서버 데이터 (바뀌었을 때만 다시 그린다)
};
let raidPollBusy = false;
const RAID_POLL_MS = 2000;

const raidTabOpen = () => campOpen && campTab === 'raid';
function raidRefresh() {
  const key = JSON.stringify([raidUi.rooms, raidUi.room, raidUi.error]);
  if (key === raidUi.key) return;
  raidUi.key = key;
  if (raidTabOpen()) renderCamp();
  renderHud();
}

// 방에 있으면 방 상태를, 레이드 탭을 보고 있으면 방 목록을 주기적으로 불러온다
function raidPoll(force = false) {
  if (!activeNick() || raidPollBusy || !saveKey) return;
  const listing = raidTabOpen() && !raidUi.room;
  if (!raidUi.room && !listing) return;
  if (!force && listing && Date.now() - raidUi.at < 3000) return;
  raidPollBusy = true;
  const who = activeNick();
  (raidUi.room ? fetchMyRaid() : fetchRaids()).then((r) => {
    if (who !== activeNick()) return;
    if (r.rooms) { raidUi.rooms = r.rooms; raidUi.at = Date.now(); }
    raidUi.error = null;
    setRaidRoom(r.room);
  }, (e) => {
    raidUi.error = e.message;
  }).finally(() => { raidPollBusy = false; raidRefresh(); });
}
setInterval(raidPoll, RAID_POLL_MS);

function setRaidRoom(room) {
  raidUi.room = room;
  if (room && room.state === 'done' && room.result) onRaidResult(room.result);
}

// 출정 결과를 받았다: 내 몫을 정산하고 하단바에서 재생한 뒤 정산 화면을 연다
function onRaidResult(result) {
  if (S.raid.claimed.includes(result.id)) return;
  const last = settleRaid(result, activeNick());
  if (!last) return;
  save();
  pushSave();
  raidUi.revealed = [];
  raidUi.showResult = true;
  const b = RAID_BOSSES[result.boss];
  if (S.phase !== 'camp' || acctOpen) {
    toast(`🐉 ${b.name} 레이드 결과가 도착했어요 — 캠프의 레이드 탭에서 확인하세요`, 6000);
    return;
  }
  closeCamp();
  skipDuel();
  $('toast').classList.remove('show');
  playRaid(result, () => { openCamp('raid'); renderHud(); });
}

// 서버 요청을 하나 보내고 결과 방으로 화면을 바꾼다
function raidRequest(fn, okMsg) {
  if (raidUi.busy) return;
  raidUi.busy = true;
  raidUi.error = null;
  const who = activeNick();
  fn().then((r) => {
    if (who !== activeNick()) return;
    if ('room' in r) setRaidRoom(r.room);
    if (okMsg) toast(okMsg);
    raidUi.at = 0;
  }, (e) => {
    toast(`⚠️ ${e.message}`, 5000);
    raidUi.at = 0;
  }).finally(() => {
    raidUi.busy = false;
    raidUi.key = '';
    if (!raidUi.room) raidPoll(true);
    raidRefresh();
  });
}

// 준비·출정 직전엔 서버에 최신 능력치를 올려 둔다 (서버는 저장된 프로필로 싸운다)
const withSave = (fn) => () => pushSave(true).then(fn);

function raidLeave() {
  if (!raidUi.room) return;
  raidUi.room = null;
  leaveRaid().catch(() => {});
  raidUi.at = 0;
  raidUi.key = '';
}

// ── 정산 화면 ──
function viewRaidResult() {
  const L = S.raid.last;
  if (!L) return '';
  const b = RAID_BOSSES[L.boss], r = L.reward;
  if (!raidUi.showResult) {
    return `<div class="reason">최근 레이드 — ${b.icon} ${b.name} ${L.won ? '처치 ✅' : '실패'} <button class="btn" data-action="raid-result">📊 정산 보기</button></div>`;
  }
  const top = Math.max(...L.members.map((m) => m.dmg), 1);
  const rows = L.members.map((m, i) => {
    const c = clsOf(m.cls), mvp = i === L.mvp, me = i === L.me;
    return `
      <div class="crow2 ${me ? 'me' : ''} ${mvp ? 'mvp' : ''}">
        <span class="rnm"><b>${mvp ? '👑 ' : ''}${esc(m.nickname)}${me ? ' <small>(나)</small>' : ''}</b><small>${c.icon} ${c.name} · Lv ${m.level}</small></span>
        <span class="cbar"><span style="width:${(100 * m.dmg) / top}%"></span><em>${m.score}%</em></span>
        <span class="rv"><small>피해량</small><b>${fmt(m.dmg)}</b></span>
        <span class="rv"><small>받아 낸 피해</small><b>${fmt(m.taken)}</b></span>
        <span class="rv"><small>회복</small><b>${fmt(m.heal)}</b></span>
      </div>`;
  }).join('');
  const gain = gainText(r) + ` · ✨ ${fmt(r.exp)}${r.levels ? ` · Lv +${r.levels}` : ''}`;
  return `
    <div class="rres ${L.won ? 'won' : 'lost'}">
      <div class="rhead">
        ${bossPortrait(L.boss, 'sm')}
        <div class="rtitle"><b>${L.won ? `👑 ${b.name} 처치!` : L.timeout ? `⏳ 시간 초과 — ${b.name}` : `💀 패배 — ${b.name}`}</b>
          <small>${fmtTime(L.dur)} · ${L.members.length}인 파티 · 기여도 = 피해 75% + 받아 낸 피해 15% + 회복 10%</small></div>
        <button class="x" data-action="raid-result-close" title="접기">✕</button>
      </div>
      <div class="clist">${rows}</div>
      <div class="gain">내 보상 — ${gain}${r.mvp ? ` <b class="mvpchip">👑 MVP 재화 ×${RAID_MVP_MULT}</b>` : ''}${r.chest ? ` · 🎁 ${esc(b.chest.name)} +1` : L.won ? '' : ' · 실패해서 재화를 일부만 받았어요 (입장권은 그대로 남았어요 🎟️)'}</div>
      ${r.first ? `<div class="reason">🏅 <b>${b.name} 첫 처치!</b> 이번 처치 상자에는 📖 비전서 5권이 들어 있어요.</div>` : ''}
    </div>`;
}

// ── 처치 상자 ──
function viewRaidChests() {
  if (!S.raid.chests.length && !raidUi.revealed.length) return '';
  const opened = raidUi.revealed.map(openedCard).join('');
  raidUi.revealed.forEach((x) => { x.fresh = false; });
  const closed = S.raid.chests.map((c, i) => {
    const b = RAID_BOSSES[c.b];
    return `
      <button class="box chestbox glow g${b.chest.w.findLastIndex((w) => w > 0)} " data-action="raid-open" data-i="${i}" style="--c:${GRADES[b.chest.w.findLastIndex((w) => w > 0)].color}"
        title="장비 ${b.chest.n[0]}${b.chest.n[1] > b.chest.n[0] ? '~' + b.chest.n[1] : ''}개 · 고유 장비 ${Math.round(b.chest.sig * 100)}%${c.first ? ' · 📖 비전서 5권 (첫 처치)' : ''} · 눌러서 열기">
        ${raidChestIcon(c.b)}<span class="lname">${c.first ? '🏅 ' : ''}${esc(b.chest.name)}</span>
      </button>`;
  }).join('');
  return `
    <div class="shead">
      <h3>🎁 처치 상자 <small>${S.raid.chests.length}개</small></h3>
      <button class="btn${rd(S.raid.chests.length)}" data-action="raid-open-all" ${S.raid.chests.length ? '' : 'disabled'}>모두 열기</button>
    </div>
    <div class="boxes">${opened}${closed}</div>`;
}

// 보스가 떨어뜨리는 상자 등급 범위
function chestRange(b) {
  const w = RAID_BOSSES[b].chest.w;
  const lo = w.findIndex((x) => x > 0), hi = w.findLastIndex((x) => x > 0);
  return `<span class="gn g${lo}" style="color:${GRADES[lo].color}">${GRADES[lo].name}</span> ~ <span class="gn g${hi}" style="color:${GRADES[hi].color}">${GRADES[hi].name}</span>`;
}
// 보스 고유 장비 3부위 아이콘. 가진 적 없는 부위는 실루엣, 마우스를 올리면 효과와 세트 효과
const sigIcons = (b) => {
  const set = RAID_BOSSES[b].set;
  const setLine = `세트 「${set.name}」 2세트: ${spText(set[2])} / 3세트: ${spText(set[3])}`;
  return raidSignatures(b).map((t) => {
    const d = GEAR_ITEMS[t], it = { t, g: d.g }, owned = S.gear.inv.some((x) => x.t === t);
    // 테두리 색 = 능력치 등급. 아직 못 얻은 부위는 실루엣
    return `<span class="sigcard ${owned ? 'own' : ''}" style="--c:${GRADES[d.g].color}"
      title="${esc(d.name)} · ${GRADES[d.g].name}급 ${GEAR_SLOTS[d.slot].name}${owned ? '' : ' (미획득)'}&#10;${esc(gearSpecialText(it))}&#10;${esc(setLine)}">
      ${gearIcon(it, owned ? '' : 'sil')}<small>${GEAR_SLOTS[d.slot].name}</small></span>`;
  }).join('');
};
const setLine = (b) => { const s = RAID_BOSSES[b].set; return `🔗 ${s.name} — 2세트 ${spText(s[2])} · 3세트 ${spText(s[3])}`; };

// ── 대기실 ──
function viewRaidRoom() {
  const room = raidUi.room, b = RAID_BOSSES[room.boss];
  const meHost = room.host === activeNick();
  const ticket = S.raid.tickets > 0;
  const slots = [];
  for (let i = 0; i < 4; i++) {
    const m = room.members[i];
    if (!m) { slots.push('<div class="pslot empty">빈 자리<small>방 목록에서 참가할 수 있어요</small></div>'); continue; }
    const c = clsOf(m.cls), me = m.nickname === activeNick();
    const state = m.host ? '<span class="pst host">👑 방장</span>' : m.ready ? '<span class="pst ok">✅ 준비 완료</span>' : '<span class="pst">⏳ 준비 중</span>';
    slots.push(`
      <div class="pslot ${me ? 'me' : ''} ${m.ready || m.host ? 'ready' : ''}">
        <div class="pic">${c.icon}</div>
        <b>${esc(m.nickname)}${me ? ' <small>(나)</small>' : ''}</b>
        <small>${c.name} · Lv ${m.level} · 전투력 ${fmt(m.power)}</small>
        ${state}
        ${meHost && !m.host && room.state === 'open' ? `<button class="chk" data-action="raid-kick" data-nick="${esc(m.nickname)}">내보내기</button>` : ''}
      </div>`);
  }
  const mine = room.members.find((m) => m.nickname === activeNick());
  const allReady = room.members.every((m) => m.host || m.ready);
  let acts;
  if (room.state === 'done') {
    acts = meHost
      ? `<button class="go compact" data-action="raid-again" ${raidUi.busy ? 'disabled' : ''}>🔁 같은 파티로 다시 도전</button>`
      : '<span class="small">방장이 다시 도전하면 대기실이 다시 열려요</span>';
  } else if (meHost) {
    const why = !ticket ? '입장권이 없어요' : !allReady ? '모두 준비하면 출정할 수 있어요' : '';
    acts = `<span class="blocker">${why}</span>
      <button class="go compact" data-action="raid-start" ${why || raidUi.busy ? 'disabled' : ''}>🐉 출정</button>`;
  } else {
    acts = mine && mine.ready
      ? '<button class="btn" data-action="raid-ready" data-on="0">준비 취소</button>'
      : `<span class="blocker">${ticket ? '' : '입장권이 없어요'}</span><button class="go compact" data-action="raid-ready" data-on="1" ${ticket && !raidUi.busy ? '' : 'disabled'}>✅ 준비</button>`;
  }
  const bossSeg = meHost && room.state === 'open'
    ? `<div class="segs wrap">${Object.keys(RAID_BOSSES).map((id) => {
        const x = RAID_BOSSES[id], low = room.members.some((m) => m.best < x.stage);
        return `<button class="seg ${id === room.boss ? 'on' : ''}" data-action="raid-boss" data-boss="${id}" ${low || id === room.boss ? 'disabled' : ''}
          title="${low ? `최고 스테이지 ${x.stage} 이상인 사람만 갈 수 있어요` : ''}">${x.icon} ${x.name}</button>`;
      }).join('')}</div>` : '';
  return `
    <div class="shead">
      <h3>🐉 레이드 대기실 <small>${room.members.length}/4 · 🎟 입장권 ${S.raid.tickets}장</small></h3>
      <button class="btn" data-action="raid-leave">🚪 나가기</button>
    </div>
    <div class="rboss">
      ${bossPortrait(room.boss)}
      <div class="info">
        <b>${b.icon} ${b.name}</b> <small>권장 스테이지 ${b.stage}+ · 광역기 「${b.skill}」</small>
        <div class="eff">${b.desc}</div>
        <div class="eff">🎁 ${esc(b.chest.name)} — 장비 ${b.chest.n[0]}${b.chest.n[1] > b.chest.n[0] ? '~' + b.chest.n[1] : ''}개 (${chestRange(room.boss)}) · 고유 장비 ${Math.round(b.chest.sig * 100)}%</div>
        <div class="sigs">${sigIcons(room.boss)}</div>
        <div class="eff gset">${setLine(room.boss)}</div>
      </div>
    </div>
    ${bossSeg}
    <div class="pslots">${slots.join('')}</div>
    <div class="ract">${acts}</div>
    <div class="hint">출정하면 서버가 파티원들의 저장된 능력치로 전투를 계산하고, 모두의 캠프 앞에서 같은 전투가 펼쳐져요. 입장권은 클리어했을 때만 1장 쓰이고, 실패하면 그대로 남아요.
      ${raidUi.error ? `<br><span class="bad">⚠️ ${esc(raidUi.error)}</span>` : ''}</div>`;
}

// ── 로비: 입장권 · 열린 방 · 보스 목록 ──
function viewRaidLobby() {
  const p = ticketPrice(), tb = ticketBlocker();
  const bought = ticketsBoughtToday();
  const ticket = `
    <div class="card">
      <div class="ic">🎟️</div>
      <div class="info"><b>레이드 입장권 <small>보유 ${S.raid.tickets} / ${RAID_TICKET_MAX}</small></b>
        <div class="eff">매일 ${RAID_TICKET_FREE}장까지 무료로 채워져요. 클리어했을 때만 1장 쓰여요(실패하면 그대로). 하루 첫 구매는 헐값, 그다음부터 점점 비싸져요 — 오늘 ${bought}장 샀어요 (자정에 초기화).</div></div>
      <div class="act">
        <div class="costs">${costChip('<i class="gc"></i>', p.gold, S.gold)}${costChip('💎', p.mana, S.mats.mana)}</div>
        <button class="btn" data-action="raid-ticket" ${tb ? 'disabled' : ''} title="${esc(tb)}">구매</button>
      </div>
    </div>`;

  let list;
  if (raidUi.rooms) {
    list = raidUi.rooms.map((r) => {
      const b = RAID_BOSSES[r.boss], open = raidUnlocked(r.boss), full = r.count >= 4;
      return `
        <div class="rmrow">
          ${bossPortrait(r.boss, 'sm')}
          <span class="rnm"><b>${b.icon} ${b.name}</b><small>방장 ${esc(r.host)} · ${r.members.map(esc).join(', ')}</small></span>
          <span class="rv"><small>인원</small><b>${r.count} / 4</b></span>
          <button class="btn" data-action="raid-join" data-id="${r.id}" ${!open || full || raidUi.busy ? 'disabled' : ''}
            title="${!open ? `최고 스테이지 ${b.stage} 이상이어야 해요` : full ? '가득 찼어요' : ''}">${full ? '가득 참' : !open ? `🔒 ${b.stage}+` : '참가'}</button>
        </div>`;
    }).join('') || '<div class="empty">열린 방이 없어요. 아래에서 보스를 골라 방을 만들어 보세요.</div>';
  } else if (raidUi.error) {
    list = `<div class="empty">⚠️ ${esc(raidUi.error)} <button class="btn" data-action="raid-refresh">다시 시도</button></div>`;
  } else {
    list = '<div class="empty">방 목록을 불러오는 중… <small>서버가 잠들어 있었다면 깨어나는 데 1분쯤 걸려요</small></div>';
  }

  const bosses = Object.keys(RAID_BOSSES).map((id) => {
    const b = RAID_BOSSES[id], open = raidUnlocked(id);
    return `
      <div class="bcard ${open ? '' : 'locked'}">
        ${bossPortrait(id)}
        <b>${b.icon} ${b.name}</b>
        <small>${open ? `스테이지 ${b.stage}+` : `🔒 최고 스테이지 ${b.stage} 필요`}</small>
        <small>🎁 ${chestRange(id)}</small>
        <small>${S.raid.kills[id] ? `⚔️ 처치 ${S.raid.kills[id]}회` : '🏅 첫 처치 시 📖 비전서 5권'}</small>
        <div class="sigs">${sigIcons(id)}</div>
        <button class="btn" data-action="raid-create" data-boss="${id}" ${!open || raidUi.busy ? 'disabled' : ''}>방 만들기</button>
      </div>`;
  }).join('');

  return `
    ${ticket}
    <div class="shead">
      <h3>🚪 열린 방 <small>1~4명 · 방장이 출정하면 시작</small></h3>
      <button class="btn" data-action="raid-refresh" title="새로고침">↻</button>
    </div>
    <div class="rlist">${list}</div>
    <h3>🐉 보스 <small>처치하면 그 보스의 처치 상자 — 높은 등급 장비가 쏟아지고, 보스마다 고유 장비가 숨어 있어요</small></h3>
    <div class="bgrid">${bosses}</div>`;
}

// ───────────────────────── 월드 보스 ─────────────────────────
// 하루 한 마리, 서버의 모든 기사가 체력 하나를 함께 깎는다 (server/worldboss.js · src/worldboss.js).
// 도전하면 서버가 30초 전투를 계산해 돌려주고, 캠프 앞 하단바에서 레이드처럼 재생한다(world.js playRaid, res.world).
// 지난 날의 보상은 접속해 있을 때(입장 직후·10분마다·레이드 탭) 받아서 세이브에 넣고, 저장한 뒤에 받았다고 알린다.
const wbUi = { data: null, at: 0, loading: false, error: null, busy: false };
const WB_CHECK_EVERY = 10 * 60 * 1000;

function loadWorldBoss(force = false) {
  if (wbUi.loading || !activeNick() || !saveKey) return;
  if (!force && wbUi.data && Date.now() - wbUi.at < 20000) return;
  wbUi.loading = true;
  const who = activeNick();
  fetchWorldBoss()
    .then((d) => {
      if (activeNick() !== who || !saveKey) return;
      wbUi.data = d; wbUi.at = Date.now(); wbUi.error = null;
      return takeWbRewards(d.pending || []);
    }, (e) => { wbUi.error = e.message; })
    .finally(() => { wbUi.loading = false; if (campOpen && campTab === 'raid') renderCamp(); renderHud(); });
}
setInterval(() => loadWorldBoss(true), WB_CHECK_EVERY);

async function takeWbRewards(rows) {
  if (!rows.length) return;
  const got = rows.map(claimWbReward).filter(Boolean);
  save();
  if (got.length) {
    const L = got[got.length - 1], b = WORLD_BOSSES[L.boss];
    toast(`🌍 월드 보스 보상 — ${b ? b.name : ''} ${L.killed ? '처치 ✅' : '생존'} · 피해 ${L.players}명 중 ${L.rank}위 · ${wbRewardText(L.reward, false)}`, 10000);
    renderHud();
  }
  await pushSave(true);
  if (!sync.error) await ackWorldBoss(rows.map((r) => r.day)).catch(() => {});
}

function wbRewardText(r, html = true) {
  const parts = [html ? gainText(r) : `골드 ${fmt(r.gold)} · 🪵 ${fmt(r.wood)} · 🪨 ${fmt(r.ore)} · 💎 ${fmt(r.mana)}`, `💠 ${r.stones}`, `📖 ${r.tomes}`];
  if (r.chests) parts.push(`🎁 ${html ? esc(RAID_BOSSES[r.boss].chest.name) : RAID_BOSSES[r.boss].chest.name}`);
  return parts.join(' · ');
}

// 지금 도전할 수 있는가 — 막히면 이유
function wbBlocker() {
  const d = wbUi.data;
  if (!wbUnlocked()) return `최고 스테이지 ${WB_UNLOCK} 필요`;
  if (!d) return '불러오는 중';
  if (!d.boss.maxHp) return '아직 나타나지 않았어요';
  if (d.boss.hp <= 0) return '오늘은 이미 쓰러졌어요';
  if (d.mine.tries >= d.tries) return '오늘 도전을 모두 썼어요';
  if (S.phase !== 'camp') return '캠프에서만 도전할 수 있어요';
  if (raidActive() || duelActive()) return '다른 전투를 보는 중';
  return '';
}
const wbDot = () => wbUnlocked() && !!wbUi.data && wbBlocker() === '';

function wbAttack() {
  if (wbUi.busy || wbBlocker()) return;
  wbUi.busy = true;
  renderCamp();
  const who = activeNick();
  attackWorldBoss().then((r) => {
    if (who !== activeNick()) return;
    const d = wbUi.data;
    if (d) { d.boss.hp = r.hp; d.mine = r.mine; if (r.kill) d.boss.killedAt = Date.now(); }
    wbUi.at = 0;
    if (r.kill) toast(`👑 ${WORLD_BOSSES[r.boss].name}에게 마지막 일격! 내일 모두가 처치 보상을 받아요`, 8000);
    closeCamp();
    skipDuel();
    playRaid({ ...r, world: true }, () => { openCamp('raid'); loadWorldBoss(true); renderHud(); });
  }, (e) => {
    toast(`⚠️ ${e.message}`, 5000);
    loadWorldBoss(true);
  }).finally(() => { wbUi.busy = false; });
}

function viewWorldBoss() {
  loadWorldBoss();
  const d = wbUi.data;
  if (!wbUnlocked()) {
    return `<div class="reason">🌍 <b>월드 보스</b> — 최고 스테이지 ${WB_UNLOCK}에 도달하면 열려요. 하루 한 마리, 모든 기사가 함께 체력을 깎고 넣은 피해만큼 보상을 받아요.</div>`;
  }
  if (!d) {
    return `<div class="reason">🌍 월드 보스 ${wbUi.error ? `— ⚠️ ${esc(wbUi.error)} <button class="btn" data-action="wb-refresh">다시 시도</button>` : '불러오는 중…'}</div>`;
  }
  const b = WORLD_BOSSES[d.boss.id], alive = d.boss.maxHp > 0 && d.boss.hp > 0;
  const ratio = d.boss.maxHp ? d.boss.hp / d.boss.maxHp : 1;
  const share = d.total > 0 ? d.mine.dmg / d.total : 0;
  const left = Math.max(0, d.tries - d.mine.tries), why = wbBlocker();
  const top = Math.max(1, ...d.top.map((x) => x.dmg));
  const rows = d.top.slice(0, 5).map((x, i) => {
    const me = x.nickname === activeNick(), c = clsOf(x.cls);
    return `<div class="wbrow ${me ? 'me' : ''}"><span class="wbrk">${i + 1}</span><span class="wbnm">${c.icon} ${esc(x.nickname)}</span>
      <span class="cbar"><span style="width:${(100 * x.dmg) / top}%"></span><em>${fmt(x.dmg)}</em></span></div>`;
  }).join('');
  const L = S.wb.last && Date.now() - S.wb.last.at < 36 * 3600 * 1000 ? S.wb.last : null;
  const state = !d.boss.maxHp ? '아직 나타나지 않았어요'
    : alive ? `<b>${(ratio * 100).toFixed(ratio < 0.01 ? 2 : 1)}%</b> 남음` : '👑 처치! 내일 모두가 처치 보상을 받아요';
  return `
    <div class="shead">
      <h3>🌍 월드 보스 <small>하루 한 마리 · 모두가 함께 깎는 체력</small></h3>
      <span class="chips"><span class="chip">⏳ ${fmtLeft(d.endsAt - Date.now())}</span><span class="chip ${left ? 'ok' : ''}">⚔️ 도전 ${left}/${d.tries}</span></span>
    </div>
    <div class="rboss wb ${alive ? '' : 'dead'}">
      ${bossPortrait(d.boss.id)}
      <div class="info">
        <b>${b.icon} ${b.name}</b> <small>광역기 「${b.skill}」 · 다음 보스 ${WORLD_BOSSES[d.next].icon} ${WORLD_BOSSES[d.next].name}</small>
        <div class="wbhp"><span style="width:${Math.max(0, ratio) * 100}%"></span><em>${state}</em></div>
        <div class="eff">참가 ${d.players}명 · 내 피해 <b>${fmt(d.mine.dmg)}</b>${d.mine.dmg ? ` (지분 ${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%)` : ''}</div>
      </div>
      <div class="act">
        <button class="go compact${rd(!why)}" data-action="wb-attack" ${why || wbUi.busy ? 'disabled' : ''} title="${esc(why)}">⚔️ 도전</button>
        <small class="blocker">${why && why !== '오늘 도전을 모두 썼어요' ? esc(why) : ''}</small>
      </div>
    </div>
    ${rows ? `<div class="wbtop">${rows}</div>` : ''}
    <div class="hint" title="한 번 도전하면 30초 동안 혼자 싸워요. 20초가 지나면 보스가 광폭해져서 체력·방어가 약하면 먼저 쓰러져요.&#10;보상 = 참여 기본 몫 + 피해 지분 몫 (평균의 3배까지). 재화는 내 최고 스테이지 기준이에요.&#10;보스 체력은 기사들이 세질수록 함께 늘어나요.">
      30초 도전 · 내일 접속하면 <b>피해 지분만큼 보상</b>, 잡았으면 📖·💠·🎁 추가 <span class="small">ⓘ</span>
      ${L ? `<br>🎁 지난 보상 (${WORLD_BOSSES[L.boss] ? WORLD_BOSSES[L.boss].name : ''} ${L.killed ? '처치' : '생존'} · ${L.players}명 중 ${L.rank}위) — ${wbRewardText(L.reward)}` : ''}</div>`;
}

// ───────────────────────── 처음 하는 일 안내 (FTUE) ─────────────────────────
// 도전의 탑 → 📖 비전서 → ⚜️ 스킬 강화 가 한 줄로 이어지도록, 처음 한 번씩만 짚어 준다. 본 단계는 S.guide 에 남긴다.
//  towerIntro 탑이 열린 순간 배너·안내 / towerSeen 탑 탭을 열어 봄 / tomeIntro 첫 비전서를 얻음 / fed 처음 스킬에 먹임
// 캠프를 열 때 기본 탭도 지금 할 일 쪽으로 (guideTab): 탑을 아직 안 봤으면 탑, 비전서를 들고 한 번도 안 먹였으면 전직.
const guidePendingFeed = () => S.tomes > 0 && !S.guide.fed && skillsOf(S.cls).length > 0;
function guideTab() {
  if (guidePendingFeed()) return 'class';
  if (towerUnlocked() && !S.guide.towerSeen) return 'tower';
  return null;
}
function guideTick() {
  const g = S.guide;
  if (!g.towerIntro && towerUnlocked() && S.phase === 'camp' && !modalOpen()) {
    g.towerIntro = 1;
    showBanner('🗼 도전의 탑 개방!', '#c9a7ff');
    toast('🗼 도전의 탑이 열렸어요 — 탑을 오르면 📖 비전서를 얻고, 비전서로 스킬을 강화하면 쿨타임이 줄고 위력이 올라요. 캠프 → 🗼 탑', 10000);
    save();
  }
  if (!g.wbIntro && g.towerSeen && wbUnlocked() && S.phase === 'camp' && !modalOpen()) {
    g.wbIntro = 1;
    toast('🌍 월드 보스가 열렸어요 — 하루 한 마리, 모든 기사가 함께 체력을 깎고 넣은 피해만큼 다음 날 보상을 받아요. 캠프 → 🐉 레이드', 10000);
    loadWorldBoss(true);
    save();
  }
  if (!g.tomeIntro && S.tomes > 0) {
    g.tomeIntro = 1;
    if (skillsOf(S.cls).length) toast('📖 첫 비전서! 캠프 → ⚜️ 전직 탭에서 스킬에 먹이면 쿨타임이 줄고 위력이 올라요', 9000);
    else toast('📖 첫 비전서! 1차 전직 후 스킬을 익히면 ⚜️ 전직 탭에서 비전서로 강화할 수 있어요', 9000);
    save();
  }
}
// 탑 → 비전서 → 스킬 강화 흐름을 한 줄로 (탑 탭·숙련도 패널 맨 위)
const guideFlow = (here) => `<div class="gflow">${[['tower', '🗼 탑 오르기'], ['tome', '📖 비전서 획득'], ['class', '⚜️ 스킬 강화 (쿨타임↓ 위력↑)']]
  .map(([k, t]) => `<span class="${k === here ? 'on' : ''}">${t}</span>`).join('<i>→</i>')}</div>`;

// ───────────────────────── 도전의 탑 ─────────────────────────
const TOWER_REASON = { down: '💀 쓰러졌습니다', stamina: '😮‍💨 스태미나가 바닥났습니다', retreat: '⬇️ 후퇴했습니다', offline: '🌙 앱이 꺼져서 그 층에서 멈췄습니다' };
// 아직 정산 화면을 안 본 탑 도전이 있는가 (옛 저장의 last 엔 seen 이 없다 → 본 것으로)
const towerResultPending = () => !!S.tower.last && S.tower.last.seen === false;
let towerResultViewed = false;
// 원정 보고처럼: 돌아오면 캠프를 열 때 탑 탭 맨 위에 이번 도전 정산
function towerResultHtml(L) {
  const blocker = towerBlocker();
  const cell = (label, value) => `<div class="cell"><span>${label}</span><b>${value}</b></div>`;
  const top = L.start + L.cleared - 1;
  const rec = L.best > L.best0 ? `<div class="reason">🏆 최고 기록 경신! ${L.best0}F → <b>${L.best}F</b>${L.firsts.length ? ` · 🎉 첫 돌파 ${L.firsts.map((f) => f + 'F').join(', ')} (📖 ${L.firsts.map(towerFirstTomes).reduce((a, b) => a + b, 0)}권 포함)` : ''}</div>` : '';
  return `
    <div class="treport" style="margin-bottom:10px">
      <div class="reason">${TOWER_REASON[L.reason] || '도전 끝'}${L.cleared ? ` — ${L.start}F → ${top}F, <b>${L.cleared}개 층</b> 돌파` : ` — ${L.start}F 를 넘지 못했어요`}</div>
      ${rec}
      <div class="stats">
        ${cell('📖 비전서', `+${fmt(L.tomes)}권`)}
        ${cell('🗼 돌파', `${L.cleared}층`)}
        ${cell('⚔️ 처치', fmt(L.kills || 0))}
        ${cell('⏱ 시간', L.dur ? fmtTime(L.dur) : '-')}
        ${cell('<i class="gc"></i> 골드', fmt(L.gold))}
        ${cell('✨ 경험치', fmt(L.exp) + (L.levels ? ` · Lv +${L.levels}` : ''))}
      </div>
      ${L.tomes && skillsOf(S.cls).length ? `<div class="gtip">📖 지금 비전서 ${fmt(S.tomes)}권 — <button class="lnk" data-action="tab" data-tab="class">⚜️ 전직 탭에서 스킬 강화하기 →</button></div>` : ''}
      <div class="act" style="margin-top:6px"><button class="go compact" data-action="tower-start" ${blocker ? 'disabled' : ''}>🗼 다시 도전 (${towerCheckpoint()}F 부터 · 🎟 ${towerTickets()}장 남음)</button>${blocker ? ` <span class="blocker">${blocker}</span>` : ''}</div>
    </div>`;
}
function viewTower() {
  const t = S.tower, blocker = towerBlocker(), cp = towerCheckpoint();
  const nextFirst = Math.floor(t.best / 10) * 10 + 10;
  const m = towerMonster(cp), boss = towerBossFloor(cp);
  const L = t.last, fresh = towerResultPending();
  if (fresh) towerResultViewed = true;
  const last = L && !fresh ? `
    <div class="card"><div class="ic">📜</div><div class="info"><b>지난 도전</b>
      <div class="eff">${TOWER_REASON[L.reason] || ''} — ${L.start}F 에서 시작해 ${L.cleared}개 층 돌파 (${L.cleared ? `${L.start + L.cleared - 1}F 까지` : '돌파 없음'})</div>
      <div class="eff"><i class="gc"></i> ${fmt(L.gold)} · ✨ ${fmt(L.exp)} · 📖 ${L.tomes}${L.firsts.length ? ` · 🎉 첫 돌파 ${L.firsts.map((f) => f + 'F').join(', ')}` : ''}</div></div></div>` : '';
  return `
    <div class="mhead"><div><h3>🗼 도전의 탑</h3>
      <small>🎟 입장권 <b>${towerTickets()}/${TOWER_TICKETS}</b> · 최고 <b>${t.best}F</b> · 가진 비전서 ${fmt(S.tomes)}권</small></div>
      ${t.best ? `<button class="go compact${rd(towerSweepReady())}" data-action="tower-sweep" ${towerSweepReady() ? '' : 'disabled'}>🧹 소탕 ${towerTickets() ? `📖 +${t.best} <small>🎟1</small>` : '· 내일 다시'}</button>` : ''}</div>
    ${fresh ? towerResultHtml(L) : guideFlow('tower')}
    ${!fresh && S.tomes > 0 && skillsOf(S.cls).length ? `<div class="gtip">📖 비전서 ${fmt(S.tomes)}권이 있어요 — <button class="lnk" data-action="tab" data-tab="class">⚜️ 전직 탭에서 스킬 강화하기 →</button></div>` : ''}
    <div class="hint">층마다 정예 몬스터 하나, 10층마다 보스. 한 층 오를 때마다 확 세지고, ${TOWER_ENRAGE_SEC}초 안에 못 잡으면 광폭화해 공격력이 계속 치솟습니다. 스태미나를 원정과 같은 속도로 쓰고, 쓰러지거나 지치거나 후퇴하면 귀환 빛에 싸여 곧장 캠프로 돌아옵니다.
      체크포인트(10층 단위)부터 시작하고, 깬 층마다 <b>📖 1권</b>. 10층 단위를 처음 넘으면 📖 묶음. 입장권은 하루 ${TOWER_TICKETS}장 — 도전에 1장, 또는 입장 없이 소탕해 <b>최고 층 수만큼 📖</b> 받는 데 1장.</div>
    <div class="card"><div class="ic">${boss ? '👑' : '⚔️'}</div><div class="info"><b>${cp}F 부터 도전</b>
      <div class="eff">첫 상대 ${MONSTERS[m.type].name}${boss ? ' (보스)' : ' (정예)'} · 스테이지 ${towerStage(cp)} 급 · 체력 ${fmt(m.hp)} · 공격 ${fmt(m.atk)}</div>
      <div class="eff">다음 첫 돌파 ${nextFirst}F — 📖 ${towerFirstTomes(nextFirst)}권</div></div>
      <div class="act"><button class="go compact${rd(blocker === '')}" data-action="tower-start" ${blocker ? 'disabled' : ''}>🗼 도전 <small>🎟1</small></button>
        <div class="blocker">${blocker}</div></div></div>
    ${last}`;
}

function viewRaid() {
  refillTickets();
  raidPoll();
  return `${viewWorldBoss()}${viewRaidResult()}${viewRaidChests()}${raidUi.room ? viewRaidRoom() : viewRaidLobby()}`;
}

function openRaidChestAt(i) {
  const got = claimRaidChest(i);
  for (const x of got) raidUi.revealed.push({ ...x, fresh: true });
  if (got.tomes) toast(`📖 비전서 +${got.tomes}`);
  const sig = got.find((x) => GEAR_ITEMS[x.it.t].raid);
  const top = got.map((x) => x.it).sort((a, b) => b.g - a.g)[0];
  if (sig) toast(`🌟 고유 장비 — ${gearName(sig.it)}!`, 5000);
  else if (top && top.g >= 4) toast(`🌟 ${GRADES[top.g].name} 장비 — ${gearName(top)}!`);
}

function renderCamp() {
  if (!campOpen) return;
  if (campTab === 'report') reportSeen = S.report;
  if (campTab !== 'rank') inbox.newAfter = null;     // 우편함 NEW 표시는 랭킹 탭을 떠나면 지운다
  const dots = campDots();
  const tabs = [
    ['report', '📜 원정 보고', S.bag.length ? `<i>${S.bag.length}</i>` : dots.report ? DOT : ''],
    ['town', '🏘 마을', S.build ? '<i class="info">🔨</i>' : dots.town ? DOT : ''],
    ['train', '🎯 훈련', dots.train ? DOT : ''],
    ['shop', '🎒 보급품', ''],
    ['gear', '🗡️ 장비', dots.gear ? DOT : ''],
    ['class', '⚜️ 전직', dots.class ? DOT : ''],
    ['rank', '🏆 랭킹', inboxUnread() ? `<i>${inboxUnread()}</i>` : ''],
    ['raid', '🐉 레이드', S.raid.chests.length ? `<i>${S.raid.chests.length}</i>` : dots.raid ? DOT : ''],
    ['tower', '🗼 탑', dots.tower ? DOT : ''],
  ];
  const view = { report: viewReport, town: viewTown, train: viewTrain, gear: viewGear, shop: viewShop, class: viewClass, rank: viewRank, raid: viewRaid, tower: viewTower }[campTab]();
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
    <nav>${tabs.map(([id, label, badge]) => `<button class="${id === campTab ? 'on' : ''}" data-action="tab" data-tab="${id}">${label}${badge}</button>`).join('')}${window.bar ? `<button class="autohide ${autoHide ? 'on' : ''}" data-action="autohide" title="켜면 마우스가 하단바를 벗어나고 잠시 뒤 기사·HUD 가 숨고, 하단바에 마우스를 올리면 다시 보여요">🫥 자동 숨기기 ${autoHide ? '켬' : '끔'}</button>` : ''}<span class="ver">v${GAME_VERSION}</span></nav>
    <section id="campBody">${view}</section>
    <footer>${viewDepart()}</footer>`;
  $('campBody').scrollTop = scroll;
  tickLive($('campModal'));
  paintGearIcons($('campModal'));
  if (campTab === 'gear') drawGearHero();      // 다시 그린 직후 한 프레임 비지 않게
  if (campTab === 'town') drawTown();
}

// ───────────────────────── 행동 ─────────────────────────
function claimOne(i) {
  const b = S.bag.splice(i, 1)[0];
  if (!b) return;
  const items = b.k === 'box' ? openBox(b) : [b];     // 상자가 생기기 전 세이브의 낱개 전리품은 그대로 챙긴다
  for (const it of items) revealed.push({ it, got: claimLoot(it), fresh: true });
  const top = items.filter(isMystery).sort((x, y) => y.g - x.g)[0];
  if (top) toast(`${top.g >= 4 ? '🌟' : '✨'} ${GRADES[top.g].name} 장비 — ${gearName(top)}!`);
}

function depart() {
  if (!startExpedition(departOpts)) return;
  raidLeave();                          // 원정을 떠나면 레이드 대기실에서는 나온다
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
  'tower-retreat': () => { towerEndRun('retreat'); renderHud(); },
  'tower-sweep': () => {
    const n = sweepTower();
    if (!n) return;
    toast(`🧹 ${S.tower.best}F 까지 소탕 — 📖 +${n}`);
    save();
    renderCamp();
  },
  'tower-start': () => {
    if (!startTower()) return;
    closeCamp();
    beginTowerView();
    save();
    renderHud();
  },
  'close': closeCamp,
  'autohide': () => setAutoHide(!autoHide),
  'tab': (el) => {
    campTab = el.dataset.tab;
    if (campTab === 'tower' && towerUnlocked()) S.guide.towerSeen = 1;
    $('campBody').scrollTop = 0;
  },
  'rank-sort': (el) => { rank.sort = el.dataset.sort; },
  'hall': (el) => { const id = Number(el.dataset.id); hallOpen = hallOpen === id ? null : id; },
  'season-tiers': () => { seasonUi.tiers = !seasonUi.tiers; },
  'rank-refresh': () => { loadRanking(true); if (rank.sort === 'duel') loadSeason(true); },
  'duel': (el) => startDuel(el.dataset.nick),
  'inbox-more': () => { inbox.more = !inbox.more; renderCamp(); },
  'wb-attack': () => wbAttack(),
  'wb-refresh': () => { wbUi.error = null; loadWorldBoss(true); },
  'raid-refresh': () => { raidUi.at = 0; raidUi.error = null; raidPoll(true); },
  'raid-ticket': () => { if (buyTicket()) toast(`🎟️ 레이드 입장권을 샀어요 (${S.raid.tickets}장)`); },
  'raid-create': (el) => raidRequest(() => createRaid(el.dataset.boss), `🐉 ${RAID_BOSSES[el.dataset.boss].name} 레이드 방을 열었어요`),
  'raid-join': (el) => raidRequest(() => joinRaid(el.dataset.id), '🐉 레이드 방에 들어왔어요'),
  'raid-leave': () => { raidLeave(); raidPoll(true); },
  'raid-ready': (el) => {
    const on = el.dataset.on === '1';
    if (on && S.raid.tickets <= 0) return;
    raidRequest(on ? withSave(() => readyRaid(true)) : () => readyRaid(false));
  },
  'raid-boss': (el) => raidRequest(() => setRaidBoss(el.dataset.boss)),
  'raid-kick': (el) => raidRequest(() => kickRaid(el.dataset.nick)),
  'raid-start': () => { if (S.raid.tickets > 0) raidRequest(withSave(startRaid)); },
  'raid-again': () => raidRequest(againRaid),
  'raid-result': () => { raidUi.showResult = true; },
  'raid-result-close': () => { raidUi.showResult = false; },
  'raid-open': (el) => openRaidChestAt(Number(el.dataset.i)),
  'raid-open-all': () => {
    if (openAllTimer) return;
    openAllTimer = setInterval(() => {
      if (!S.raid.chests.length || !campOpen) { clearInterval(openAllTimer); openAllTimer = null; save(); return; }
      openRaidChestAt(0);
      renderCamp();
    }, 220);
  },
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
  'train-all': () => { const n = doTrainAll(); if (n) toast(`🎯 훈련 ${n}단계 올렸어요`, 2500); },
  'buy': (el) => buySupply(el.dataset.id),
  'eat': eatLunch,
  'equip': (el) => { const id = Number(el.dataset.id); if (equipGear(id)) gearUi.sel = { slot: gearById(id).slot }; },
  'gear-sel-slot': (el) => { gearUi.sel = { slot: el.dataset.slot }; },
  'gear-sel-item': (el) => { gearUi.sel = { id: Number(el.dataset.id) }; },
  'gear-sell-one': (el) => {
    const it = gearById(Number(el.dataset.id));
    if (!it) return;
    const r = sellGear([it]);
    if (r.n) toast(`💰 ${gearName(it)}을(를) 팔았어요 — 골드 ${fmt(r.gold)} · 💠 강화석 ${r.stones}`);
  },
  'gear-auto': () => { const n = autoEquip(); toast(n ? `✨ ${n}부위 장비를 바꿔 꼈어요` : '이미 가장 좋은 장비를 끼고 있어요'); },
  'gear-auto-toggle': () => { S.gear.auto = !S.gear.auto; if (S.gear.auto) autoEquip(); },
  // 일괄 판매는 두 번 눌러야 팔린다 (체크한 등급 · 세트와 장착 중 장비 제외)
  'gear-sell': () => {
    if (!gearUi.sellAsk) { gearUi.sellAsk = true; return; }
    gearUi.sellAsk = false;
    const r = sellGear(bulkSellList());
    if (r.n) toast(`💰 장비 ${r.n}개를 팔았어요 — 골드 ${fmt(r.gold)} · 💠 강화석 ${fmt(r.stones)}`);
  },
  'gear-sell-grade': (el) => { const g = Number(el.dataset.g); S.gear.sellG[g] = !S.gear.sellG[g]; },
  'gear-sell-set': () => { S.gear.sellSet = !S.gear.sellSet; },
  'gear-protect': () => { gearUi.protect = !gearUi.protect; },
  'enhance': (el) => {
    const slot = el.dataset.slot;
    if (enhFx || enhanceBlocker(slot)) return;
    gearUi.last = null;
    startEnhanceFx(slot, gearUi.protect);         // 결과는 모으기 연출이 끝날 때 나온다
  },
  'depart': depart,
  'field': (el) => {
    const i = Number(el.dataset.i);
    if (!selectZone(i)) return;
    toast(`${ZONES[i].icon} ${ZONES[i].name} ${S.stage}스테이지에서 출정합니다`);
  },
  'tome': (el) => {
    const k = SKILLS[el.dataset.id], first = !S.guide.fed, r = feedTomes(k.id, Number(el.dataset.n));
    if (!r) return;
    S.guide.fed = 1;
    const m = masteryOf(r.to);
    if (first && r.to > r.from) {
      toast(`⚡ ${k.name} Lv ${r.to}! 쿨타임 ${skillCdOf(k, r.from, S.cls)}초 → ${skillCdOf(k, r.to, S.cls)}초 · 위력 ×${(skillMult(k) * skillPowAt(k, r.from, S.cls)).toFixed(2)} → ×${(skillMult(k) * skillPowAt(k, r.to, S.cls)).toFixed(2)} — 다음 원정·탑·결투부터 바로 적용돼요. Lv10 ★숙련을 목표로 탑에서 비전서를 더 모아 보세요`, 12000);
      save();
      return;
    }
    if (m > masteryOf(r.from)) {
      // 단계 돌파: 기술 이름이 진화한다
      const from = skillNameAt(k, r.from), to = skillNameAt(k, r.to);
      showBanner(from !== to ? `${k.icon} 「${from}」 → 「${to}」` : `${k.icon} ${k.name} — ${MASTERY[m].star} ${MASTERY[m].name} 도달!`, mixHex(heroClass().look.fx, MASTERY_GOLD, m >= 3 ? 0.45 : 0));
      toast(`${MASTERY[m].star} ${MASTERY[m].name} — 「${to}」 ${k.stageDesc ? k.stageDesc[m] : MASTERY[m].desc}`, 9000);
    } else if (r.to > r.from) toast(`${k.icon} ${k.name} Lv ${r.to}!`);
    save();
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
  scheduleFade();
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
  if (!accounts.list[nick]) { acctBusy = false; return; }   // 올리는 사이 전체 초기화로 지워졌다
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
  // 탑은 이어서 하지 않는다: 다시 불러오면 그 층에서 끝낸 것으로 정산
  if (S.phase === 'tower') { endTower('offline'); S.phase = 'camp'; }
  if (tw) endTowerView();
  monsters = []; coins = []; floaters = []; shots = []; effects = []; drops = [];
  lapReady = false;
  Object.assign(knight, { down: 0, fighting: false, pending: false, swing: -1, facing: 1, cds: {}, ward: null, warp: null });
  casts = []; skfx = []; cutin = null; hitstop = 0;
  knight.x = S.phase === 'expedition' ? toWorld(CAMP_X + 90) : toWorld(CAMP_X);
  Object.assign(inbox, { list: null, error: null, told: 0, newAfter: null, more: false });
  rank.data = null; seasonUi.data = null; seasonUi.at = 0; duelPlay = null; lastDuel = null; revealed = []; classSel = null; classConfirm = null;
  raidPlay = null; Object.assign(raidUi, { rooms: null, at: 0, room: null, error: null, revealed: [], showResult: false, key: '' });
}

// 서버가 전체 초기화돼서 플레이 중인 기사가 없어졌다. 이 기기의 기사·세이브를 모두 지우고 닉네임 만들기 화면으로 보낸다
hooks.onAccountGone = () => {
  saveKey = null;                            // 지금 상태를 더는 저장하지 않는다
  forgetAllAccounts();
  sync.dirty = false;
  closeCamp();
  loadState(null);
  resetWorld();
  if (acctOpen) renderAccount(); else openAccount();
  renderHud();
  toast('🔄 서버가 새로 시작되어 모든 기사가 초기화됐어요 — 새 닉네임으로 다시 시작해 주세요', 15000);
};

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
  if (S.notice) { toast(S.notice, 10000); delete S.notice; }
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
    pushSave(true).then(() => { loadSeason(true); loadWorldBoss(true); loadInbox(); });
    return;
  }
  const remote = fetchMe().then((r) => r.state, (e) => {
    sync.error = e.message;
    if (e.status === 401 && e.code !== 'gone') toast('⚠️ 서버에서 이 기사를 찾을 수 없어요 — 이 기기의 기록으로 계속합니다', 7000);
    return undefined;
  });
  if (local) {
    saveKey = key;
    applyState(local);
    remote.then((st) => {
      if (activeNick() !== nick) return;
      if (st && (st.lastSeen || 0) > localSeen) { applyState(st); toast('☁️ 다른 기기에서 진행한 기록을 불러왔어요'); }
      pushSave(true).then(() => { loadSeason(true); loadWorldBoss(true); loadInbox(); });
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
  pushSave(true).then(() => { loadSeason(true); loadWorldBoss(true); loadInbox(); });
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'camp') { closeCamp(); return; }      // 바깥 어두운 영역
  if (e.target.id === 'acct') { closeAccount(); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (el.dataset.action !== 'gear-sell') gearUi.sellAsk = false;   // 다른 걸 누르면 일괄 판매 확인 취소
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
hooks.onTowerEnd = (r) => {
  renderHud();
  if (!r) return;
  toast(`🗼 ${TOWER_REASON[r.reason] || '도전 끝'} — ${r.cleared}개 층 돌파${r.tomes ? ` · 📖 +${r.tomes}` : ''} · 기사를 클릭해 정산을 확인하세요`, 8000);
};
hooks.onArrive = () => {
  const r = S.report;
  toast('🏕 캠프에 도착했어요 — 기사를 클릭해 정산하세요', 6000);
  try {
    new Notification('⚔️ 기사가 캠프로 돌아왔어요', {
      body: `${REASON_TEXT[r.reason]} 처치 ${fmt(r.kills)} · 전리품 상자 ${S.bag.length}개`,
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
    if (campOpen || S.phase === 'tower' || document.activeElement?.value) return;   // 캠프 창을 보거나 탑을 오르거나 뭔가 입력하던 중이면 끝난 뒤에
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
    scheduleFade();                     // 자동 숨기기를 켜 뒀으면 켜자마자 잠시 뒤 숨긴다
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
    if (campOpen && campTab === 'gear') drawGearHero();
    if (campOpen && campTab === 'town') drawTown();
    slow += dt;
    if (slow > 0.25) {
      slow = 0;
      guideTick();
      renderHud();
      if (campOpen) tickLive($('campModal'));
      updateTray();
    }
  }
  requestAnimationFrame(frame);
}

// 게임 모음 사이트(sheet.sanai-club) 게시글은 이 웹 버전을 iframe 으로 띄운다. 예전에는 그 사이트에 게임 파일을 직접 올려서
// 세이브·계정이 그쪽 주소의 localStorage 에 있다. 부모 페이지에 준비됐다고 알리고 잠깐(최대 1초) 기다려서,
// 보내 준 값 중 여기 없는 것만 넣고 시작한다.
const IMPORT_FROM = ['https://sheet-play.sanai-club.workers.dev'];
function start() {
  if (window.parent === window) return boot();
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    window.removeEventListener('message', onMessage);
    boot();
  };
  const onMessage = (e) => {
    if (!IMPORT_FROM.includes(e.origin) || !e.data || e.data.type !== 'kb-import') return;
    try {
      for (const [k, v] of Object.entries(e.data.items || {})) {
        if (k.startsWith('knight-bar') && localStorage.getItem(k) == null) localStorage.setItem(k, String(v));
      }
      accounts = Object.assign({ active: null, list: {} }, JSON.parse(localStorage.getItem(ACCOUNTS_KEY)));
    } catch {}
    go();
  };
  window.addEventListener('message', onMessage);
  window.parent.postMessage({ type: 'kb-ready' }, '*');
  setTimeout(go, 1000);
}
start();
