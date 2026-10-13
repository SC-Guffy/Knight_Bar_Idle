'use strict';
// 보스 레이드 규칙: 입장권, 결과 정산(재화·처치 상자), 처치 상자 열기. core.js·gear.js 처럼 DOM 을 모르고 S 상태만 바꾼다.
// 로비(방 목록·준비·출정)와 전투 계산은 서버가 하고(server/raid.js), 여기서는 받은 결과로 내 보상만 정산한다.
//  S.raid = {
//    tickets: 보유 입장권, freeDay: 무료 충전을 마지막으로 받은 날, buyDay·bought: 오늘(buyDay) 산 장수 — 살수록 비싸진다,
//    chests: 아직 안 연 처치 상자 [{ k: 'rbox', b: 보스 id, s: 스테이지 }],
//    kills: 보스별 처치 횟수 { 보스 id: n } (보스 카드에 표시용. 첫 처치 보너스 같은 건 없다 — 0.13.3 에서 뺌),
//    claimed: 이미 정산한 결과 id (같은 결과를 두 번 받지 않도록), last: 마지막 정산 화면 내용,
//    pending: 결과는 받았지만 아직 재생이 안 끝나 지급하지 않은 정산 (재생이 끝나면 applyRaid 로 지급)
//  }

const freshRaid = () => ({ tickets: 0, freeDay: '', buyDay: '', bought: 0, chests: [], kills: {}, claimed: [], last: null, pending: null });

// 하루 기준은 서버 시각(gameNow)의 날짜. 저장된 날보다 "뒤의 날"이 됐을 때만, 그것도 서버 시각을 확인했을 때만 새날로 친다
// (기기 날짜를 앞뒤로 바꿔 가며 하루 충전·구매 가격 초기화를 되풀이하지 못하게). 레이드·미궁·탑이 같이 쓴다
const todayKey = () => { const d = new Date(gameNow()); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const dayNo = (k) => { const m = /^(\d+)-(\d+)-(\d+)$/.exec(k || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3]) / 86400000 : -Infinity; };
const newDay = (k) => { const t = dayNo(todayKey()); return srvClock.known && t > dayNo(k); };   // todayKey 가 먼저 시계 튐을 감지하게
const ticketsBoughtToday = () => (newDay(S.raid.buyDay) ? 0 : S.raid.bought);
const raidUnlocked = (id) => S.best >= RAID_BOSSES[id].stage;

// ───────────────────────── 입장권 ─────────────────────────
// 하루에 한 번(자정 기준) 입장권이 RAID_TICKET_FREE 장보다 적으면 그만큼 채워 준다. 더 필요하면 재화로 산다
function refillTickets() {
  if (!newDay(S.raid.freeDay)) return false;
  S.raid.freeDay = todayKey();
  if (S.raid.tickets >= RAID_TICKET_FREE) return false;
  S.raid.tickets = RAID_TICKET_FREE;
  return true;
}
// 하루 첫 구매는 헐값(마력석 없음), 두 번째부터 RAID_TICKET_STEPS 대로 비싸지고 그 뒤로는 × RAID_TICKET_GROW
function ticketPrice() {
  const n = ticketsBoughtToday(), last = RAID_TICKET_STEPS.length - 1;
  const k = n <= last ? RAID_TICKET_STEPS[n] : RAID_TICKET_STEPS[last] * Math.pow(RAID_TICKET_GROW, n - last);
  return {
    gold: Math.max(1, Math.floor(monsterStats(S.best, false).gold * RAID_TICKET_GOLD * k)),
    mana: n === 0 ? 0 : Math.floor((RAID_TICKET_MANA + S.best / 20) * k),
  };
}
function ticketBlocker() {
  if (S.raid.tickets >= RAID_TICKET_MAX) return `입장권은 최대 ${RAID_TICKET_MAX}장까지 가질 수 있어요`;
  const p = ticketPrice();
  if (S.gold < p.gold) return '골드 부족';
  if (S.mats.mana < p.mana) return '마력석 부족';
  return '';
}
function buyTicket() {
  if (ticketBlocker()) return false;
  const p = ticketPrice();
  S.gold -= p.gold;
  S.mats.mana -= p.mana;
  if (newDay(S.raid.buyDay)) { S.raid.buyDay = todayKey(); S.raid.bought = 0; }
  S.raid.bought++;
  S.raid.tickets++;
  return true;
}

// 소수 인원(AI 기사 자리를 반 명으로 친 파티)의 보스 스테이지 — 양옆 인원 사이를 잇는다 (server/raid.js partyGap 과 같음)
function raidStageAt(b, n) {
  const lo = Math.floor(n), hi = Math.ceil(n);
  return lo === hi ? raidStageOf(b, n) : raidStageOf(b, lo) + (raidStageOf(b, hi) - raidStageOf(b, lo)) * (n - lo);
}

// ───────────────────────── 정산 ─────────────────────────
// 서버가 보낸 레이드 결과를 내 몫만큼 정산한다: 클리어했을 때만 입장권 1장 소모, 재화(MVP 1.5배), 경험치, 처치 상자.
// 실패하면 입장권도 안 깎고 보상도 없다 (위로 보상을 주면 표 한 장으로 무한 파밍이 된다)
// 결과를 받을 때는 보상을 계산만 해 S.raid.pending 에 두고, 전투 재생이 끝나야 applyRaid 로 실제 지급한다
// (받자마자 주면 재생을 안 보고 보상만 챙기게 된다). 이미 정산했거나 내가 그 파티에 없었으면 null
function settleRaid(result, nick) {
  if (S.raid.claimed.includes(result.id)) return null;
  const me = result.members.findIndex((m) => m.nickname === nick);
  if (me < 0) return null;
  S.raid.claimed.push(result.id);
  if (S.raid.claimed.length > 30) S.raid.claimed.shift();
  const f = result.fight, b = RAID_BOSSES[result.boss], mvp = f.mvp === me;
  // AI 기사(🤖)와 함께면 서버가 보스 세기를 정한 인원(party, AI 자리는 반 명)과 재화·경험치 배율(botMult, AI 한 자리당 -10%)을 같이 보낸다
  const bot = result.botMult || 1;
  const mult = (f.won ? 1 : RAID_FAIL_MULT) * (mvp ? RAID_MVP_MULT : 1) * bot;
  // 재화·경험치는 인원수만큼 강해진 보스의 스테이지 기준 (적은 인원으로 어렵게 잡을수록 많이). 단 내 최고 스테이지를 넘지는 않는다
  const rs = Math.max(b.stage, Math.min(S.best, Math.round(raidStageAt(b, result.party || result.members.length))));
  const ms = monsterStats(rs, true), scale = 1 + (rs - 1) * 0.04, mat = mult * (1 + gearBonus().matPct);
  const reward = {
    gold: Math.round(ms.gold * 8 * mult * goldMult()),
    wood: Math.round(60 * scale * mat), ore: Math.round(45 * scale * mat), mana: Math.round(12 * scale * mat),
    exp: f.won ? Math.round(ms.exp * 5 * bot * expMult()) : 0,
    chest: f.won, mvp, mult, rs,
  };
  if (S.raid.pending) applyRaid();   // 앞 결과를 아직 못 받았으면 먼저 지급
  // 입장권은 보상이 아니라 결과를 받는 즉시 깎는다 (보류 중에 같은 표로 또 출정하지 못하게)
  if (f.won) S.raid.tickets = Math.max(0, S.raid.tickets - 1);
  S.raid.pending = {
    id: result.id, boss: result.boss, won: f.won, timeout: f.timeout, dur: f.dur, me, mvp: f.mvp,
    ...(result.botMult ? { party: result.party, botMult: result.botMult } : {}),
    members: result.members.map((m, i) => ({ ...m, ...f.contrib[i] })),
    reward, at: Date.now(),
  };
  return S.raid.pending;
}

// 보류해 둔 레이드 정산을 지급하고 정산 화면(last)으로 옮긴다. 지급했으면 그 내용을, 없으면 null
function applyRaid() {
  const L = S.raid.pending;
  if (!L) return null;
  S.raid.pending = null;
  const r = L.reward;
  S.gold += r.gold;
  S.mats.wood += r.wood; S.mats.ore += r.ore; S.mats.mana += r.mana;
  r.levels = gainExp(r.exp);
  if (L.won) {
    S.raid.kills[L.boss] = (S.raid.kills[L.boss] || 0) + 1;
    // 상자 장비의 아이템 레벨 = 실제로 싸운 스테이지 (내 최고 스테이지를 넘지 않음)
    S.raid.chests.push({ k: 'rbox', b: L.boss, s: r.rs });
  }
  S.raid.last = L;
  return L;
}

// ───────────────────────── 처치 상자 ─────────────────────────
// 내용물은 전부 장비. 등급은 보스마다 정한 가중치(chest.w)로 뽑고, chest.sig 확률로 그 보스의 고유 장비가 하나 섞인다
function rollRaidGear(g, s) {
  const slot = pickWeighted(GEAR_SLOTS, () => 1);
  const pool = gearItemsOf(slot, g);
  return { k: 'gear', slot, g, s, t: pool[Math.floor(Math.random() * pool.length)], roll: Math.round((0.95 + Math.random() * 0.15) * 100) / 100 };
}
const raidSignatures = (boss) => Object.keys(GEAR_ITEMS).filter((t) => GEAR_ITEMS[t].raid === boss);

function openRaidChest(c) {
  const ch = RAID_BOSSES[c.b].chest;
  const n = ch.n[0] + Math.floor(Math.random() * (ch.n[1] - ch.n[0] + 1));
  const out = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random() * ch.w.reduce((a, b) => a + b, 0), g = 0;
    for (; g < ch.w.length - 1; g++) { r -= ch.w[g]; if (r <= 0) break; }
    out.push(rollRaidGear(g, c.s));
  }
  if (Math.random() < ch.sig) {
    // 세트를 모으도록 아직 가진 적 없는 부위를 먼저 준다 (다 있으면 아무 부위나)
    const all = raidSignatures(c.b), missing = all.filter((t) => !S.gear.inv.some((x) => x.t === t));
    const sigs = missing.length ? missing : all;
    const t = sigs[Math.floor(Math.random() * sigs.length)], d = GEAR_ITEMS[t];
    out[0] = { k: 'gear', slot: d.slot, g: d.g, s: c.s, t, roll: Math.round((1 + Math.random() * 0.1) * 100) / 100 };
  }
  return out.sort((a, b) => b.g - a.g);
}

// 처치 상자 하나를 열어서 내용물을 챙긴다. [{ it, got }] 를 돌려준다
function claimRaidChest(i) {
  const c = S.raid.chests.splice(i, 1)[0];
  if (!c) return [];
  const got = openRaidChest(c).map((it) => ({ it, got: claimLoot(it) }));
  // 📖 비전서 (스킬 숙련도): 상자마다 1~2권 (🎲 비전서 추가 확률 옵션만큼 한 권 더 나올 확률이 오른다)
  got.tomes = 1 + (Math.random() < 0.5 + gearBonus().tomePct ? 1 : 0);
  S.tomes += got.tomes;
  // 🎲 재굴림권 · 📜 보호 주문서: 상자마다 낮은 확률로 (RARE_DROP.raid)
  got.items = rollRareDrops(RARE_DROP.raid);
  return got;
}
// 재굴림권·보호 주문서를 표의 확률로 굴려 바로 챙긴다. 받은 것 { reroll?: 1, protect?: 1 }
function rollRareDrops(table) {
  const out = {};
  for (const id of Object.keys(table)) if (Math.random() < table[id]) { out[id] = 1; S.items[id] = (S.items[id] || 0) + 1; }
  return out;
}
