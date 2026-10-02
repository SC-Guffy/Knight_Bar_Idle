'use strict';
// 보스 레이드 규칙: 입장권, 결과 정산(재화·처치 상자), 처치 상자 열기. core.js·gear.js 처럼 DOM 을 모르고 S 상태만 바꾼다.
// 로비(방 목록·준비·출정)와 전투 계산은 서버가 하고(server/raid.js), 여기서는 받은 결과로 내 보상만 정산한다.
//  S.raid = {
//    tickets: 보유 입장권, freeDay: 무료 충전을 마지막으로 받은 날, buyDay·bought: 오늘(buyDay) 산 장수 — 살수록 비싸진다,
//    chests: 아직 안 연 처치 상자 [{ k: 'rbox', b: 보스 id, s: 스테이지, first: 첫 처치 상자면 1 }],
//    kills: 보스별 처치 횟수 { 보스 id: n } — 처음 잡으면 첫 처치 상자(고유 장비 확정)를 준다,
//    claimed: 이미 정산한 결과 id (같은 결과를 두 번 받지 않도록), last: 마지막 정산 화면 내용
//  }

const freshRaid = () => ({ tickets: 0, freeDay: '', buyDay: '', bought: 0, chests: [], kills: {}, claimed: [], last: null });

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
  if (S.raid.buyDay !== todayKey()) { S.raid.buyDay = todayKey(); S.raid.bought = 0; }
  S.raid.bought++;
  S.raid.tickets++;
  return true;
}

// ───────────────────────── 정산 ─────────────────────────
// 서버가 보낸 레이드 결과를 내 몫만큼 정산한다: 클리어했을 때만 입장권 1장 소모, 재화(MVP 1.5배), 경험치, 이기면 처치 상자.
// 이미 정산했거나 내가 그 파티에 없었으면 null
function settleRaid(result, nick) {
  if (S.raid.claimed.includes(result.id)) return null;
  const me = result.members.findIndex((m) => m.nickname === nick);
  if (me < 0) return null;
  S.raid.claimed.push(result.id);
  if (S.raid.claimed.length > 30) S.raid.claimed.shift();
  const f = result.fight, b = RAID_BOSSES[result.boss], mvp = f.mvp === me;
  const mult = (f.won ? 1 : RAID_FAIL_MULT) * (mvp ? RAID_MVP_MULT : 1);
  // 재화·경험치는 인원수만큼 강해진 보스의 스테이지 기준 (적은 인원으로 어렵게 잡을수록 많이). 단 내 최고 스테이지를 넘지는 않는다
  const n = Math.max(1, Math.min(RAID_PARTY_STAGE.length, result.members.length));
  const rs = Math.max(b.stage, Math.min(S.best, Math.round(b.stage * (1 + RAID_PARTY_STAGE[n - 1]))));
  const ms = monsterStats(rs, true), scale = 1 + (rs - 1) * 0.04;
  const reward = {
    gold: Math.round(ms.gold * 8 * mult * goldMult()),
    wood: Math.round(60 * scale * mult), ore: Math.round(45 * scale * mult), mana: Math.round(12 * scale * mult),
    exp: Math.round(ms.exp * (f.won ? 5 : 1) * expMult()),
    chest: f.won, mvp, mult,
  };
  S.gold += reward.gold;
  S.mats.wood += reward.wood; S.mats.ore += reward.ore; S.mats.mana += reward.mana;
  reward.levels = gainExp(reward.exp);
  if (f.won) {
    S.raid.tickets = Math.max(0, S.raid.tickets - 1);
    reward.first = !S.raid.kills[result.boss];
    S.raid.kills[result.boss] = (S.raid.kills[result.boss] || 0) + 1;
    S.raid.chests.push({ k: 'rbox', b: result.boss, s: b.stage, ...(reward.first ? { first: 1 } : {}) });
  }

  S.raid.last = {
    id: result.id, boss: result.boss, won: f.won, timeout: f.timeout, dur: f.dur, me, mvp: f.mvp,
    members: result.members.map((m, i) => ({ ...m, ...f.contrib[i] })),
    reward, at: Date.now(),
  };
  return S.raid.last;
}

// ───────────────────────── 처치 상자 ─────────────────────────
// 내용물은 전부 장비. 등급은 보스마다 정한 가중치(chest.w)로 뽑고, chest.sig 확률로(첫 처치 상자는 반드시) 그 보스의 고유 장비가 하나 섞인다
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
  if (c.first || Math.random() < ch.sig) {
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
  // 📖 비전서 (스킬 숙련도): 상자마다 1~2권, 그 보스의 첫 처치 상자는 5권
  got.tomes = c.first ? 5 : 1 + (Math.random() < 0.5 ? 1 : 0);
  S.tomes += got.tomes;
  return got;
}
