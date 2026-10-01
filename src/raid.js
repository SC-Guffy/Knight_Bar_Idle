'use strict';
// 보스 레이드 규칙: 입장권, 결과 정산(재화·처치 상자), 처치 상자 열기. core.js·gear.js 처럼 DOM 을 모르고 S 상태만 바꾼다.
// 로비(방 목록·준비·출정)와 전투 계산은 서버가 하고(server/raid.js), 여기서는 받은 결과로 내 보상만 정산한다.
//  S.raid = {
//    tickets: 보유 입장권, freeDay: 무료 충전을 마지막으로 받은 날, buyDay·bought: 오늘(buyDay) 산 장수 — 살수록 비싸진다,
//    chests: 아직 안 연 처치 상자 [{ k: 'rbox', b: 보스 id, s: 스테이지 }],
//    claimed: 이미 정산한 결과 id (같은 결과를 두 번 받지 않도록), last: 마지막 정산 화면 내용
//  }

const freshRaid = () => ({ tickets: 0, freeDay: '', buyDay: '', bought: 0, chests: [], claimed: [], last: null });

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const ticketsBoughtToday = () => (S.raid.buyDay === todayKey() ? S.raid.bought : 0);
const raidUnlocked = (id) => S.best >= RAID_BOSSES[id].stage;

// ───────────────────────── 입장권 ─────────────────────────
// 하루에 한 번(자정 기준) 입장권이 RAID_TICKET_FREE 장보다 적으면 그만큼 채워 준다. 더 필요하면 재화로 산다
function refillTickets() {
  if (S.raid.freeDay === todayKey()) return false;
  S.raid.freeDay = todayKey();
  if (S.raid.tickets >= RAID_TICKET_FREE) return false;
  S.raid.tickets = RAID_TICKET_FREE;
  return true;
}
function ticketPrice() {
  const k = Math.pow(RAID_TICKET_GROW, ticketsBoughtToday());
  return { gold: Math.floor(monsterStats(S.best, false).gold * RAID_TICKET_GOLD * k), mana: Math.floor((3 + S.best / 10) * k) };
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
  if (S.raid.buyDay !== todayKey()) { S.raid.buyDay = todayKey(); S.raid.bought = 0; }
  S.raid.bought++;
  S.raid.tickets++;
  return true;
}

// ───────────────────────── 정산 ─────────────────────────
// 서버가 보낸 레이드 결과를 내 몫만큼 정산한다: 입장권 1장 소모, 재화(MVP 1.5배), 경험치, 이기면 처치 상자.
// 이미 정산했거나 내가 그 파티에 없었으면 null
function settleRaid(result, nick) {
  if (S.raid.claimed.includes(result.id)) return null;
  const me = result.members.findIndex((m) => m.nickname === nick);
  if (me < 0) return null;
  S.raid.claimed.push(result.id);
  if (S.raid.claimed.length > 30) S.raid.claimed.shift();
  S.raid.tickets = Math.max(0, S.raid.tickets - 1);

  const f = result.fight, b = RAID_BOSSES[result.boss], mvp = f.mvp === me;
  const mult = (f.won ? 1 : RAID_FAIL_MULT) * (mvp ? RAID_MVP_MULT : 1);
  const ms = monsterStats(b.stage, true), scale = 1 + (b.stage - 1) * 0.04;
  const reward = {
    gold: Math.round(ms.gold * 8 * mult),
    wood: Math.round(60 * scale * mult), ore: Math.round(45 * scale * mult), mana: Math.round(12 * scale * mult),
    exp: Math.round(ms.exp * (f.won ? 5 : 1)),
    chest: f.won, mvp, mult,
  };
  S.gold += reward.gold;
  S.mats.wood += reward.wood; S.mats.ore += reward.ore; S.mats.mana += reward.mana;
  reward.levels = gainExp(reward.exp);
  if (f.won) S.raid.chests.push({ k: 'rbox', b: result.boss, s: b.stage });

  S.raid.last = {
    id: result.id, boss: result.boss, won: f.won, timeout: f.timeout, dur: f.dur, me, mvp: f.mvp,
    members: result.members.map((m, i) => ({ ...m, ...f.contrib[i] })),
    reward, at: Date.now(),
  };
  return S.raid.last;
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
    const sigs = raidSignatures(c.b), t = sigs[Math.floor(Math.random() * sigs.length)], d = GEAR_ITEMS[t];
    out[0] = { k: 'gear', slot: d.slot, g: d.g, s: c.s, t, roll: Math.round((1 + Math.random() * 0.1) * 100) / 100 };
  }
  return out.sort((a, b) => b.g - a.g);
}

// 처치 상자 하나를 열어서 내용물을 챙긴다. [{ it, got }] 를 돌려준다
function claimRaidChest(i) {
  const c = S.raid.chests.splice(i, 1)[0];
  if (!c) return [];
  return openRaidChest(c).map((it) => ({ it, got: claimLoot(it) }));
}
