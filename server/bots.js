'use strict';
// AI 기사(봇). 유저 수가 적어도 랭킹·결투·레이드·월드 보스·확성기·탑 순위가 비어 보이지 않게 서버가 기사 몇십 명을 대신 키운다.
// 봇은 언제나 AI 라고 드러낸다 — 서버가 내려 주는 모든 목록에 bot: true 가 붙고, 클라이언트는 이름 옆에 🤖 를 단다.
//
//  - 계정: accounts 테이블의 is_bot 행 (server/store.js). 토큰은 아무도 모르는 무작위 해시라 로그인할 수 없고,
//    state 에는 봇 설정 { bot: { line 3차 직업 계열, slot 실력 순번, g 장비 편차, tw 탑 편차, born } } 만 둔다.
//  - 성장: 최근 7일 안에 활동한 사람들의 최고 스테이지 중앙값(R) × 봇마다 정해진 배수 k 를 목표로 조금씩 오른다 (내려가지는 않는다).
//    k 는 순번(slot)대로 0.5 ~ 2.0 에 깔리는데 아래쪽이 촘촘하다 — 봇 절반쯤이 사람 중앙값 아래, 몇 명만 훨씬 위.
//    사람이 아무도 없으면(초기화 직후) 봇 나이로 하루 10스테이지쯤 (최대 80).
//  - 능력치: dev/bot-curve.js 가 진행 봇으로 구운 표(server/bot-curve.json)에서 그 계열·그 최고 스테이지 줄을 골라 쓴다
//    (클라이언트 profile() 과 같은 모양: 레벨·직업(전직 단계)·공격력·체력·스킬…, 줄 사이는 로그 보간). 장비 편차 g 를 곱한다.
//  - 결투: 봇끼리 하루 BOT_DUELS_PER_DAY 번쯤 걸어서 시즌 순위에도 오른다. 사람에게도 가끔 건다 (시간당·사람당 제한).
//    시즌 보상 순위는 사람끼리만 매긴다 (store.settleSeason) — 봇이 위에 있어도 사람 몫을 빼앗지 않는다.
//  - 월드 보스: 최고 스테이지 30 이상인 봇은 매일 07~23시(한국 시간) 사이 무작위 세 번 도전한다. 봇도 '활동 중'이라 체력 어림에 들어가고
//    늘 세 번을 다 쓰므로 어림한 만큼 실제로 깎는다 (체력에 더한 만큼 피해도 더하니 처치 시각은 사람끼리일 때와 같은 쪽으로 따라간다).
//    보상 지분 평균·순위는 사람만 센다 (store.wbPending).
//  - 확성기: 최고 스테이지 상위 봇이 가끔 +20 이상 강화 성공·초기화 소식을 흘린다. 시간당 BOT_SHOUTS_PER_HOUR 번까지,
//    최근 10분 안에 사람 소식이 있었으면 쉰다.
//  - 레이드: 방장이 빈자리를 봇으로 채울 수 있다 (raidFill). 봇은 자기 직업·스킬 그대로, 공격력·체력만 방장 전투력 × RAID_BOT_POWER 에 맞춘다.
//    보스 세기는 봇 자리를 반 명으로 쳐서 정하고(raidParty), 재화·경험치는 봇 한 자리당 RAID_BOT_CUT 씩 덜 준다 (raidRewardMult)
//    — 근거와 모의 실험 수치는 README 「보스 레이드」.
const crypto = require('crypto');
const CURVE = require('./bot-curve.json');

const envNum = (k, d, min, max) => { const n = Number(process.env[k]); return process.env[k] != null && process.env[k] !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const CFG = {
  count: Math.floor(envNum('BOTS', 30, 0, 200)),                      // 봇 수. 0 = 끔 (있던 봇도 지운다)
  tickMs: envNum('BOT_TICK_MS', 5 * 60 * 1000, 1000, 3600 * 1000),    // 봇이 움직이는 간격 (개발 때 줄여서 본다)
  shoutsPerHour: envNum('BOT_SHOUTS_PER_HOUR', 2, 0, 30),             // 봇 확성기 시간당 최대
  duelsPerHour: envNum('BOT_DUELS_PER_HOUR', 3, 0, 60),               // 봇이 사람에게 거는 결투 시간당 최대 (서버 전체)
  duelsPerDay: envNum('BOT_DUELS_PER_DAY', 6, 0, 100),                // 봇 한 명이 다른 봇에게 거는 결투 하루 평균
};
const HUMAN_DUEL_GAP_MS = 8 * 3600 * 1000;   // 같은 사람에게 봇이 결투를 거는 최소 간격
const HUMAN_ACTIVE_MS = 7 * 24 * 3600 * 1000;
const DUEL_TARGET_MS = 2 * 24 * 3600 * 1000; // 이 안에 접속한 사람에게만 결투를 건다
const SHOUT_HUMAN_QUIET_MS = 10 * 60 * 1000;
const REFRESH_MS = 6 * 3600 * 1000;          // 성장이 없어도 이 간격으로 updatedAt 을 새로 (월드 보스 '활동 중' 36시간 안에 들게)
const DAY = 24 * 3600 * 1000;
// 레이드: 봇 자리의 능력치 = 방장 전투력 × RAID_BOT_POWER, 보스 세기는 사람 + 봇 × RAID_BOT_SEAT 명 기준, 재화·경험치 × (1 − 봇 수 × RAID_BOT_CUT)
// 레이드 난이도는 파티원 능력치보다 인원 보정(PARTY_GAP, 4인이면 보스가 13스테이지 약해짐)이 거의 다 정해서, 봇을 약하게만 하면(×0.35여도)
// 혼자 + 봇 3 이 사람 4인 난이도를 그대로 얻는다. 그래서 봇 자리는 보스 보정에서 반 명으로 친다 → 혼자 + 봇 3 = 2.5인 보스 ≈ 사람 3인 파티가 잡는 수준
const RAID_BOT_POWER = 0.8;
const RAID_BOT_SEAT = 0.5;
const RAID_BOT_CUT = 0.1;

// 3차 직업 = 계열 (dev/bot-curve.js 의 LINES). 순번대로 돌려 직업이 고르게 나온다 — 시즌5 새 계열 넷을 앞에 둬서 봇이 적어도 빠지지 않게
const LINES = ['tyrant', 'skyGeneral', 'siegeMaster', 'thunderEmperor', 'archon', 'swordsaint', 'dragonlord', 'warlord', 'deadeye', 'voidArcher', 'archmage', 'frostlord']
  .filter((l) => CURVE.lines[l]);

// ───────────────────────── 이름 ─────────────────────────
// 판타지 닉네임 (서버 닉네임 규칙: 한글 2~12자). 🤖 표시는 클라이언트가 bot 플래그로 붙인다 — 이름 자체에는 넣지 않는다
const NAME_A = ['은빛', '달빛', '붉은', '검은', '푸른', '황혼', '새벽', '폭풍', '서리', '불꽃', '바람', '강철', '별빛', '그림자', '천둥', '잿빛', '황금', '고요한', '떠도는', '늙은', '젊은', '외로운', '하얀', '심연'];
const NAME_B = ['늑대', '검객', '방랑자', '수호자', '매', '용', '칼날', '사자', '여우', '파수꾼', '순례자', '기사', '까마귀', '곰', '방패', '창', '사냥꾼', '현자', '불사조', '유랑자', '대장장이', '올빼미'];
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (...xs) => crypto.createHash('sha1').update(xs.join('|')).digest().readUInt32LE(0);

// ───────────────────────── 능력치 표 ─────────────────────────
const COL = Object.fromEntries(CURVE.cols.map((c, i) => [c, i]));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpLog = (a, b, t) => (a > 0 && b > 0 ? Math.exp(lerp(Math.log(a), Math.log(b), t)) : lerp(a, b, t));
// 계열 line 의 기사가 최고 스테이지 best 일 때의 전투 프로필 (server/index.js sanitizeProfile 모양)
function curveAt(line, best) {
  const rows = CURVE.lines[line] || CURVE.lines[LINES[0]];
  const v = (r, c) => r[COL[c]];
  let lo = rows[0], hi = rows[0], t = 0;
  if (best >= v(rows[rows.length - 1], 'best')) {
    // 표 끝을 넘으면 마지막 몇 줄의 스테이지당 성장률로 늘린다
    const last = rows[rows.length - 1], ref = rows[Math.max(0, rows.length - 6)], span = Math.max(1, v(last, 'best') - v(ref, 'best'));
    const ext = best - v(last, 'best'), g = (c) => Math.pow(Math.max(1, v(last, c) / Math.max(1e-9, v(ref, c))), ext / span);
    return toProfile(last, best, { level: v(last, 'level') + ext, atk: v(last, 'atk') * g('atk'), maxHp: v(last, 'maxHp') * g('maxHp'), power: v(last, 'power') * g('power') });
  }
  for (let i = 1; i < rows.length; i++) {
    if (v(rows[i], 'best') > best) { lo = rows[i - 1]; hi = rows[i]; t = Math.max(0, (best - v(lo, 'best')) / Math.max(1, v(hi, 'best') - v(lo, 'best'))); break; }
  }
  return toProfile(lo, best, {
    level: lerp(v(lo, 'level'), v(hi, 'level'), t),
    atk: lerpLog(v(lo, 'atk'), v(hi, 'atk'), t), maxHp: lerpLog(v(lo, 'maxHp'), v(hi, 'maxHp'), t), power: lerpLog(v(lo, 'power'), v(hi, 'power'), t),
  });
}
function toProfile(r, best, x) {
  const v = (c) => r[COL[c]];
  return {
    cls: v('cls'), level: Math.max(1, Math.round(x.level)), best,
    atk: x.atk, maxHp: x.maxHp, aspd: v('aspd'), crit: v('crit'), critMult: v('critMult'), range: v('range'),
    shots: v('shots'), shotMult: v('shotMult'), guard: v('guard'), heal: v('heal'), leap: null,
    skills: v('skills').map((s) => ({ ...s })), power: Math.round(x.power),
  };
}
// 장비·훈련 편차 g 를 곱한다 (전투력은 √(DPS×체력) 이라 둘 다 g 배면 전투력도 g 배)
const scaled = (p, g) => ({ ...p, atk: p.atk * g, maxHp: p.maxHp * g, power: Math.round(p.power * g) });

// 순번 slot(0..n-1) → 사람 중앙값 대비 배수. 아래쪽이 촘촘하다 (n=30 이면 중앙 순번이 ≈1.0, 맨 위 2.0)
const spread = (slot, n) => (n <= 1 ? 1 : 0.5 + 1.5 * Math.pow(slot / (n - 1), 1.6));
// 탑 최고 층: 층 난이도 = 스테이지 25 + 층 × 2 (src/data.js TOWER_STAGE0·TOWER_STAGE_PER) — 정예라 자기 최고 스테이지보다 조금 아래 층까지
const towerOf = (best, tw) => (best < 30 ? 0 : Math.max(0, Math.floor((best * tw - 30) / 2)));

function botProfile(acc) {
  const b = acc.state.bot;
  return scaled(curveAt(b.line, acc.best), b.g);
}

// ───────────────────────── 시작 ─────────────────────────
// deps: { store, hashToken, START_RATING, seasonAt, runDuel(attacker, defender), todayBoss(day), WB, shout(entry), lastHumanShoutAt() }
function createBots(deps) {
  const { store, WB } = deps;
  let running = false, timer = null;
  const lastChallenged = new Map();   // 사람 key → 봇이 마지막으로 결투를 건 시각
  const humanDuels = [];              // 봇 → 사람 결투 시각 (최근 1시간)
  const botShouts = [];               // 봇 확성기 시각 (최근 1시간)
  let wbDay = -1; const wbDone = new Map();   // 오늘 봇별 쓴 도전 수 (DB 를 매번 묻지 않게)

  async function reference(now, bots) {
    const hs = await store.humansSince(now - HUMAN_ACTIVE_MS);
    if (hs.length) {
      const b = hs.map((h) => h.best).sort((x, y) => x - y);
      return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2;
    }
    const born = Math.min(now, ...bots.map((a) => a.state.bot.born));
    return Math.min(80, 12 + 10 * (now - born) / DAY);
  }

  // 봇 수를 CFG.count 에 맞춘다: 빈 순번을 새 봇으로 채우고, 넘치는 순번은 지운다
  async function ensure(now) {
    let bots = (await store.bots()).filter((a) => a.state && a.state.bot);
    const extra = bots.filter((a) => a.state.bot.slot >= CFG.count);
    if (extra.length) { await store.removeBots(extra.map((a) => a.key)); bots = bots.filter((a) => !extra.includes(a)); }
    const used = new Set(bots.map((a) => a.state.bot.slot));
    for (let slot = 0; slot < CFG.count; slot++) {
      if (used.has(slot)) continue;
      const r = rng(hash('bot', slot, now));
      for (let tries = 0; tries < 40; tries++) {
        const nickname = pick(NAME_A, r) + pick(NAME_B, r) + (tries > 20 ? String(Math.floor(r() * 90) + 10) : '');
        const key = nickname.toLowerCase();
        if (await store.get(key)) continue;
        const bot = { line: LINES[slot % LINES.length], slot, g: 0.85 + r() * 0.27, tw: 0.85 + r() * 0.25, born: now };
        const acc = { key, nickname, state: { bot }, best: 1 };
        const p = botProfile(acc);
        try {
          await store.create({
            key, nickname, tokenHash: deps.hashToken('bot:' + crypto.randomBytes(24).toString('base64url')), state: { bot }, profile: p,
            level: p.level, best: 1, power: p.power, cls: p.cls, rating: deps.START_RATING, wins: 0, losses: 0, season: deps.seasonAt(now), attacks: 0,
            createdAt: now, updatedAt: now, isBot: true, tower: 0,
          });
          bots.push(await store.get(key));
        } catch { continue; }   // 그사이 누가 그 닉네임을 가져갔으면 다른 이름으로
        break;
      }
    }
    return bots;
  }

  // 성장: 목표 스테이지 쪽으로 가끔 몇 스테이지씩
  async function grow(now, bots) {
    const R = await reference(now, bots);
    for (const a of bots) {
      const b = a.state.bot, target = Math.max(1, Math.round(R * spread(b.slot, CFG.count)));
      let best = a.best;
      if (best <= 1) best = Math.max(1, Math.round(target * (0.7 + 0.2 * Math.random())));   // 갓 만든 봇은 목표 근처에서 시작
      else if (best < target && Math.random() < 0.35) best += Math.max(1, Math.round((target - best) * 0.25));
      if (best === a.best && now - a.updatedAt < REFRESH_MS) continue;
      const p = scaled(curveAt(b.line, best), b.g);
      const fields = { profile: p, best, level: p.level, power: p.power, cls: p.cls, tower: Math.max(a.tower || 0, towerOf(best, b.tw)), updatedAt: now };
      await store.update(a.key, fields);
      Object.assign(a, fields);
    }
  }

  // 결투: 봇끼리 + 가끔 사람에게
  async function duels(now, bots) {
    if (bots.length >= 2 && CFG.duelsPerDay > 0) {
      const x = (bots.length * CFG.duelsPerDay * CFG.tickMs) / DAY;
      const n = Math.floor(x) + (Math.random() < x % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const me = bots[Math.floor(Math.random() * bots.length)];
        // 무작위 셋 중 결투 점수가 가장 가까운 봇
        const cands = Array.from({ length: 3 }, () => bots[Math.floor(Math.random() * bots.length)]).filter((o) => o.key !== me.key);
        if (!cands.length) continue;
        const op = cands.sort((p, q) => Math.abs(p.rating - me.rating) - Math.abs(q.rating - me.rating))[0];
        await deps.runDuel(await store.get(me.key), await store.get(op.key)).catch((e) => console.error('bot duel', e.message));
      }
    }
    while (humanDuels.length && now - humanDuels[0] > 3600 * 1000) humanDuels.shift();
    if (!CFG.duelsPerHour || humanDuels.length >= CFG.duelsPerHour || !bots.length) return;
    if (Math.random() > (CFG.duelsPerHour * CFG.tickMs) / (3600 * 1000)) return;
    const hs = (await store.humansSince(now - DUEL_TARGET_MS)).filter((h) => now - (lastChallenged.get(h.key) || 0) > HUMAN_DUEL_GAP_MS);
    if (!hs.length) return;
    const h = hs[Math.floor(Math.random() * hs.length)];
    // 최고 스테이지가 비슷한 봇이 건다 (무작위 다섯 중 가장 가까운)
    const me = Array.from({ length: 5 }, () => bots[Math.floor(Math.random() * bots.length)]).sort((p, q) => Math.abs(p.best - h.best) - Math.abs(q.best - h.best))[0];
    lastChallenged.set(h.key, now);
    humanDuels.push(now);
    const [ma, ha] = [await store.get(me.key), await store.get(h.key)];
    if (ma && ha) await deps.runDuel(ma, ha).catch((e) => console.error('bot duel', e.message));
  }

  // 월드 보스: 봇마다 하루 세 번, 07~23시 사이 정해진 시각에
  async function worldBoss(now, bots) {
    const day = WB.dayAt(now);
    if (day !== wbDay) { wbDay = day; wbDone.clear(); }
    const ready = bots.filter((a) => a.best >= WB.WB_UNLOCK);
    if (!ready.length) return;
    const boss = await deps.todayBoss(day);
    if (!boss || boss.hp <= 0) return;
    const start = WB.dayEnd(day) - DAY;
    for (const a of ready) {
      const due = [0, 1, 2].slice(0, WB.WB_TRIES).filter((j) => start + (7 + 16 * (hash(a.key, day, j) / 2 ** 32)) * 3600 * 1000 <= now).length;
      if (!wbDone.has(a.key)) { const m = await store.wbMine(day, a.key); wbDone.set(a.key, m ? m.tries : 0); }
      while (wbDone.get(a.key) < due && boss.hp > 0) {
        const p = botProfile(a);
        const fight = WB.worldFight(boss.boss, p, boss.hp, boss.maxHp);
        const r = await store.wbHit(day, { key: a.key, nickname: a.nickname, cls: p.cls, bot: true }, fight.contrib[0].dmg, WB.WB_TRIES, now);
        if (!r) { wbDone.set(a.key, WB.WB_TRIES); break; }
        wbDone.set(a.key, r.tries);
        boss.hp = r.hp;
        if (r.kill) console.log(`월드 보스 ${day} 처치: 🤖 ${a.nickname}`);
      }
    }
  }

  // 확성기: 상위 봇의 +20 이상 강화 성공 · 초기화 (사람 소식이 우선)
  function shouts(now, bots) {
    while (botShouts.length && now - botShouts[0] > 3600 * 1000) botShouts.shift();
    if (!CFG.shoutsPerHour || botShouts.length >= CFG.shoutsPerHour) return;
    if (now - deps.lastHumanShoutAt() < SHOUT_HUMAN_QUIET_MS) return;
    if (Math.random() > (CFG.shoutsPerHour * CFG.tickMs) / (3600 * 1000)) return;
    // +20 은 0에서 평균 700번쯤 두드려야 닿는다 — 최고 스테이지 상위 1/3 봇만 (그래도 스테이지 40 미만이면 아직 이르다)
    const top = bots.slice().sort((p, q) => q.best - p.best).slice(0, Math.max(1, Math.ceil(bots.length / 3))).filter((a) => a.best >= 40);
    if (!top.length) return;
    const a = top[Math.floor(Math.random() * top.length)];
    const slot = ['weapon', 'armor', 'ring'][Math.floor(Math.random() * 3)];
    const e = Math.random() < 0.6
      ? (() => { const to = 20 + (Math.random() < 0.3 ? 1 : 0) + (Math.random() < 0.1 ? 1 : 0); return { result: 'up', from: to - 1, to }; })()
      : { result: 'reset', from: 16 + Math.floor(Math.random() * 6), to: 0 };
    botShouts.push(now);
    deps.shout({ nickname: a.nickname, slot, ...e, bot: true });
  }

  // 봇 자리의 레이드 전투 프로필: 그 봇의 직업·스킬 그대로, 공격력·체력만 방장 전투력 × RAID_BOT_POWER 에 맞춘다
  function raidProfile(acc, hostProfile) {
    const p = botProfile(acc), f = Math.max(0.01, (hostProfile.power * RAID_BOT_POWER) / Math.max(1, p.power));
    return { ...p, atk: p.atk * f, maxHp: p.maxHp * f, power: Math.round(p.power * f) };
  }

  async function tick() {
    if (running || !CFG.count) return;
    running = true;
    try {
      const now = Date.now();
      const bots = await ensure(now);
      await grow(now, bots);
      await duels(now, bots);
      await worldBoss(now, bots);
      shouts(now, bots);
    } catch (e) {
      console.error('bots', e);
    } finally {
      running = false;
    }
  }

  return {
    CFG,
    async start() {
      if (!CFG.count) {
        // 끈 서버: 남아 있던 봇을 지워 랭킹 등에서도 사라지게 한다
        const old = await store.bots();
        if (old.length) { await store.removeBots(old.map((a) => a.key)); console.log(`AI 기사 끔: ${old.length}명 지움`); }
        return;
      }
      console.log(`AI 기사 ${CFG.count}명 · ${Math.round(CFG.tickMs / 1000)}초마다`);
      await tick();
      timer = setInterval(tick, CFG.tickMs);
      timer.unref();
    },
    tick,
    // 전체 초기화 뒤 (봇도 지워졌다 — 다음 tick 에 새 이름으로 다시 만든다)
    reset() { lastChallenged.clear(); humanDuels.length = 0; botShouts.length = 0; wbDay = -1; wbDone.clear(); },

    // ── 레이드 ──
    // 방장 host(계정)의 방에 n 명을 채울 봇 파티원. taken: 이미 방에 있는 봇 key. 최고 스테이지가 방장과 가까운 봇부터
    async raidMembers(host, hostProfile, n, taken) {
      const bots = (await store.bots()).filter((a) => a.state && a.state.bot && !taken.includes(a.key))
        .sort((p, q) => Math.abs(p.best - hostProfile.best) - Math.abs(q.best - hostProfile.best)).slice(0, n);
      return bots.map((a) => {
        const p = raidProfile(a, hostProfile);
        // best: 보스 입장 조건은 방장을 따른다 (봇은 방장 수준에 맞춰 싸우므로)
        return { key: 'bot:' + a.key, botKey: a.key, bot: true, nickname: a.nickname, cls: p.cls, level: p.level, power: p.power, best: hostProfile.best, ready: true, seen: Infinity };
      });
    },
    raidProfile,
    // 보스 세기를 정하는 인원 (봇 자리는 반 명)
    raidParty(humans, bots) { return humans + bots * RAID_BOT_SEAT; },
    // 레이드 재화·경험치 배율 (봇 한 자리당 -10%)
    raidRewardMult(bots) { return Math.round((1 - bots * RAID_BOT_CUT) * 100) / 100; },
    RAID_BOT_POWER, RAID_BOT_SEAT, RAID_BOT_CUT,
  };
}

module.exports = { createBots, curveAt, spread, towerOf, CFG };
