'use strict';
// Knight Bar 서버: 계정(닉네임) · 세이브 동기화 · 랭킹 · 결투(시즌) · 보스 레이드 로비 · 월드 보스.
// 의존성은 pg 하나뿐이라 http 모듈로 직접 라우팅한다.

const http = require('http');
const crypto = require('crypto');
const { openStore, TakenError } = require('./store');
const { simulateDuel, eloDelta } = require('./duel');
const { RAID_BOSSES, MAX_PARTY, simulateRaid } = require('./raid');
const { START_RATING, seasonAt, seasonRange, fresh } = require('./season');
const WB = require('./worldboss');

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 256 * 1024;
const DUEL_COOLDOWN_MS = 5000;

const store = openStore();

// ───────────────────────── 유틸 ─────────────────────────
class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
// 토큰은 맞는 모양인데 그 계정이 서버에 없다 = 전체 초기화로 지워진 계정. 클라이언트는 이걸 받으면 이 기기의 기사를 지운다
const goneError = () => new HttpError(401, '서버에서 이 기사를 찾을 수 없어요', 'gone');

// 한글·영문·숫자·_ 2~12자. 대소문자만 다른 닉네임은 같은 닉네임으로 본다.
function nicknameKey(raw) {
  const nick = String(raw || '').normalize('NFC').trim();
  if (!/^[가-힣a-zA-Z0-9_]{2,12}$/.test(nick)) {
    throw new HttpError(400, '닉네임은 한글·영문·숫자·_ 2~12자로 지어 주세요');
  }
  return { nick, key: nick.toLowerCase() };
}

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

const num = (v, min, max, dflt) => {
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

// 클라이언트가 계산해서 올린 전투 프로필. 결투·랭킹에만 쓰므로 범위만 확인한다.
function sanitizeProfile(p = {}) {
  const leap = p.leap && typeof p.leap === 'object'
    ? { every: num(p.leap.every, 1, 60, 6), mult: num(p.leap.mult, 0, 20, 1) } : null;
  // 스킬: 최대 3종. 수치는 클라이언트 src/classes.js 의 SKILLS 에서 계산해 올린다
  const skills = (Array.isArray(p.skills) ? p.skills : []).slice(0, 3)
    .filter((s) => s && typeof s === 'object' && typeof s.id === 'string')
    .map((s) => ({
      id: s.id.slice(0, 24), lv: Math.floor(num(s.lv, 1, 30, 1)),   // 스킬 숙련도 (재생 연출용, 피해는 mult 에 이미 반영)
      cd: num(s.cd, 2, 150, 10), dur: num(s.dur, 0, 4, 1), mult: num(s.mult, 0, 300, 1), crit: !!s.crit,
      ...(s.ward && typeof s.ward === 'object'
        ? { ward: { dur: num(s.ward.dur, 0, 8, 0), guard: num(s.ward.guard, 0, 0.8, 0), heal: num(s.ward.heal, 0, 0.5, 0) } } : {}),
    }));
  return {
    cls: typeof p.cls === 'string' ? p.cls.slice(0, 24) : 'squire',
    level: Math.floor(num(p.level, 1, 1e6, 1)),
    best: Math.floor(num(p.best, 1, 1e6, 1)),
    atk: num(p.atk, 0, 1e30, 5),
    maxHp: num(p.maxHp, 1, 1e30, 60),
    aspd: num(p.aspd, 0.1, 20, 0.9),
    crit: num(p.crit, 0, 1, 0.05),
    critMult: num(p.critMult, 1, 10, 2.5),
    range: num(p.range, 0, 400, 14),
    shots: Math.floor(num(p.shots, 1, 5, 1)),
    shotMult: num(p.shotMult, 0, 5, 1),
    guard: num(p.guard, 0, 0.9, 0),
    heal: num(p.heal, 0, 0.2, 0),
    leap, skills,
    power: Math.floor(num(p.power, 0, 1e30, 0)),
  };
}

// 랭킹·결투 목록에 보여 줄 공개 정보. 결투 기록은 이번 시즌 것 (지난 시즌 값이면 새로 시작한 값으로)
const publicInfo = (acc) => {
  const a = fresh(acc);
  return {
    nickname: a.nickname, cls: a.cls, level: a.level, best: a.best, power: a.power,
    rating: a.rating, wins: a.wins, losses: a.losses, attacks: a.attacks, updatedAt: a.updatedAt,
  };
};

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, '데이터가 너무 큽니다')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'JSON 형식이 아닙니다')); }
    });
    req.on('error', reject);
  });
}

async function auth(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) throw new HttpError(401, '계정 인증에 실패했어요');
  const acc = await store.byToken(hashToken(m[1]));
  if (!acc) throw goneError();
  return acc;
}

// ───────────────────────── 결투 시즌 정산 ─────────────────────────
// 끝난 시즌을 차례로 정산한다. 계정의 지난 시즌 기록은 다음 결투 때 덮어써지므로, 결투·랭킹 전에 반드시 먼저 부른다.
// (서버가 잠들어 있던 사이 시즌이 바뀌었어도 깨어나서 처음 요청을 받을 때 정산된다.)
let settledThrough = -1, settling = null;
function settleSeasons() {
  const last = seasonAt() - 1;
  if (settledThrough >= last) return Promise.resolve();
  if (!settling) {
    settling = (async () => {
      let s = await store.settledThrough();
      while (s < last) {
        s++;
        await store.settleSeason(s, Date.now());
        console.log(`결투 시즌 ${s} 정산`);
      }
      settledThrough = s;
    })().finally(() => { settling = null; });
  }
  return settling;
}
setInterval(() => settleSeasons().catch((e) => console.error(e)), 60000).unref();

// ───────────────────────── 라우트 ─────────────────────────
const lastDuel = new Map();   // key → 마지막 결투 시각

const routes = {
  'GET /health': async () => ({ ok: true, players: await store.count() }),

  // 닉네임 사용 가능 여부
  'GET /api/nickname': async (_req, url) => {
    const { key } = nicknameKey(url.searchParams.get('name'));
    return { available: !(await store.get(key)) };
  },

  // 새 기사 만들기. state 는 클라이언트가 만든 첫 세이브
  'POST /api/accounts': async (req) => {
    const body = await readJson(req);
    const { nick, key } = nicknameKey(body.nickname);
    const token = crypto.randomBytes(24).toString('base64url');
    const now = Date.now();
    const profile = sanitizeProfile(body.profile);
    try {
      await store.create({
        key, nickname: nick, tokenHash: hashToken(token),
        state: body.state && typeof body.state === 'object' ? body.state : null, profile,
        level: profile.level, best: profile.best, power: profile.power, cls: profile.cls,
        rating: START_RATING, wins: 0, losses: 0, season: seasonAt(now), attacks: 0, createdAt: now, updatedAt: now,
      });
    } catch (e) {
      if (e instanceof TakenError) throw new HttpError(409, '이미 사용 중인 닉네임이에요');
      throw e;
    }
    return { status: 201, body: { nickname: nick, token } };
  },

  // 내 세이브 불러오기
  'GET /api/me': async (req) => {
    const a = await auth(req);
    return { ...publicInfo(a), state: a.state };
  },

  // 세이브 올리기
  'PUT /api/me': async (req) => {
    const a = await auth(req);
    const body = await readJson(req);
    if (!body.state || typeof body.state !== 'object') throw new HttpError(400, 'state 가 없습니다');
    const profile = sanitizeProfile(body.profile);
    const now = Date.now();
    await store.update(a.key, {
      state: body.state, profile,
      level: profile.level, best: profile.best, power: profile.power, cls: profile.cls, updatedAt: now,
    });
    return { ok: true, updatedAt: now };
  },

  // 랭킹. 인증 헤더가 있으면 내 순위도 같이 준다.
  // 결투(duel) 순위는 이번 시즌에 직접 결투를 1번 이상 건 기사만 — 시즌 보상도 이 순위로 준다
  'GET /api/ranking': async (req, url) => {
    const sort = url.searchParams.get('sort') === 'duel' ? 'duel' : 'stage';
    const limit = Math.floor(num(url.searchParams.get('limit'), 1, 200, 100));
    await settleSeasons();
    const season = sort === 'duel' ? seasonAt() : 0;
    const players = (await store.top(sort, limit, season)).map(publicInfo);
    let me = null;
    if (req.headers.authorization) {
      try {
        const a = await auth(req);
        const f = fresh(a);
        const ranked = !season || f.attacks > 0;
        me = { ...publicInfo(a), rank: ranked ? await store.rankOf(f, sort, season) : null };
      } catch {}
    }
    return { sort, players, me, total: await store.count(season), hall: await store.hall(), ...(season ? { season: seasonRange(season) } : {}) };
  },

  // 결투 시즌: 이번 시즌 정보와 내 기록, 지난 시즌 결과, 아직 안 받아 간 시즌 보상
  'GET /api/season': async (req) => {
    const a = await auth(req);
    await settleSeasons();
    const id = seasonAt(), f = fresh(a, id);
    return {
      ...seasonRange(id), now: Date.now(),
      players: await store.count(id),
      me: { rating: f.rating, wins: f.wins, losses: f.losses, attacks: f.attacks, rank: f.attacks > 0 ? await store.rankOf(f, 'duel', id) : null },
      last: id > 1 ? await store.season(id - 1) : null,
      rewards: await store.pendingRewards(a.key),
    };
  },

  // 시즌 보상을 세이브에 넣었으면 지운다
  'POST /api/season/ack': async (req) => {
    const a = await auth(req);
    const body = await readJson(req);
    const ids = (Array.isArray(body.seasons) ? body.seasons : []).map(Number).filter(Number.isInteger).slice(0, 50);
    if (ids.length) await store.ackRewards(a.key, ids);
    return { ok: true };
  },

  // 결투. 서버가 두 기사의 프로필로 싸움을 계산하고, 결과 기록을 돌려준다.
  'POST /api/duels': async (req) => {
    const me = await auth(req);
    const body = await readJson(req);
    const { key } = nicknameKey(body.opponent);
    if (key === me.key) throw new HttpError(400, '자기 자신과는 결투할 수 없어요');
    const op = await store.get(key);
    if (!op) throw new HttpError(404, '그런 기사는 없어요');
    const since = Date.now() - (lastDuel.get(me.key) || 0);
    if (since < DUEL_COOLDOWN_MS) throw new HttpError(429, `${Math.ceil((DUEL_COOLDOWN_MS - since) / 1000)}초 뒤에 다시 도전할 수 있어요`);
    lastDuel.set(me.key, Date.now());

    // 지난 시즌을 먼저 정산하고, 두 기사 모두 이번 시즌 기록으로 싸운다. 건 쪽만 attacks 가 늘어 시즌 보상 대상이 된다
    await settleSeasons();
    const season = seasonAt();
    const a = fresh(me, season), b = fresh(op, season);
    const pa = sanitizeProfile(me.profile), pb = sanitizeProfile(op.profile);
    const fight = simulateDuel(pa, pb);
    const won = fight.winner === 'a';
    const d = won ? eloDelta(a.rating, b.rating) : eloDelta(b.rating, a.rating);
    const myRating = Math.max(0, a.rating + (won ? d : -d));
    const opRating = Math.max(0, b.rating + (won ? -d : d));
    await store.update(me.key, { season, attacks: a.attacks + 1, rating: myRating, wins: a.wins + (won ? 1 : 0), losses: a.losses + (won ? 0 : 1) });
    await store.update(op.key, { season, attacks: b.attacks, rating: opRating, wins: b.wins + (won ? 0 : 1), losses: b.losses + (won ? 1 : 0) });

    return {
      won, delta: d, season,
      me: { nickname: me.nickname, cls: pa.cls, level: pa.level, rating: myRating },
      opponent: { nickname: op.nickname, cls: pb.cls, level: pb.level, rating: opRating },
      fight,
    };
  },
};

// ───────────────────────── 보스 레이드 로비 ─────────────────────────
// 방은 서버 메모리에만 둔다 (재시작되면 열려 있던 방은 사라진다). 클라이언트는 방에 있는 동안 2초마다 방 상태를 물어보고,
// 한동안 소식이 없는 파티원은 나간 것으로 본다. 방장이 출정하면 서버가 전투를 계산해서 방에 결과를 남기고,
// 파티원들은 다음 조회 때 같은 결과를 받아 각자 재생·정산한다.
const ROOM_IDLE_MS = 90000;        // 이 시간 동안 조회가 없으면 방에서 내보낸다 (웹 버전이 뒤쪽 탭에 있으면 브라우저가 타이머를 1분 간격까지 늦춘다)
const ROOM_DONE_KEEP_MS = 180000;  // 끝난 방(결과)을 남겨 두는 시간
const rooms = new Map();           // id → { id, boss, host, members: [{ key, nickname, cls, level, power, best, ready, seen }], state, result, at }
const roomOf = new Map();          // 계정 key → 방 id
let roomSeq = 0;

// 방 조회는 자주 오므로 토큰 → 계정을 잠깐 기억해 둔다 (DB 왕복을 줄이려고)
const authCache = new Map();       // tokenHash → { acc, at }
async function authLite(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) throw new HttpError(401, '계정 인증에 실패했어요');
  const h = hashToken(m[1]);
  const c = authCache.get(h);
  if (c && Date.now() - c.at < 60000) return c.acc;
  const acc = await store.byToken(h);
  if (!acc) throw goneError();
  authCache.set(h, { acc, at: Date.now() });
  return acc;
}

function raidBoss(id) {
  if (!Object.prototype.hasOwnProperty.call(RAID_BOSSES, id)) throw new HttpError(400, '그런 보스는 없어요');
  return RAID_BOSSES[id];
}
const memberOf = (a) => {
  const p = sanitizeProfile(a.profile);
  return { key: a.key, nickname: a.nickname, cls: p.cls, level: p.level, power: p.power, best: p.best, ready: false, seen: Date.now() };
};
const myRoom = (key) => rooms.get(roomOf.get(key)) || null;

function roomView(r) {
  if (!r) return null;
  const host = r.members.find((m) => m.key === r.host);
  return {
    id: r.id, boss: r.boss, state: r.state, host: host ? host.nickname : null,
    members: r.members.map((m) => ({ nickname: m.nickname, cls: m.cls, level: m.level, power: m.power, best: m.best, ready: m.ready, host: m.key === r.host })),
    result: r.result,
  };
}

function leaveRoom(key) {
  const r = myRoom(key);
  roomOf.delete(key);
  if (!r) return;
  r.members = r.members.filter((m) => m.key !== key);
  if (!r.members.length) { rooms.delete(r.id); return; }
  if (r.host === key) { r.host = r.members[0].key; r.members[0].ready = false; }
}

function touch(r, key) {
  const m = r && r.members.find((x) => x.key === key);
  if (m) m.seen = Date.now();
  return m;
}

setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    if (r.state === 'done' && now - r.at > ROOM_DONE_KEEP_MS) {
      for (const m of r.members) roomOf.delete(m.key);
      rooms.delete(r.id);
      continue;
    }
    for (const m of [...r.members]) if (now - m.seen > ROOM_IDLE_MS) leaveRoom(m.key);
  }
  for (const [h, c] of authCache) if (now - c.at > 60000) authCache.delete(h);
}, 5000).unref();

function hostRoom(acc) {
  const r = myRoom(acc.key);
  if (!r) throw new HttpError(404, '레이드 방에 있지 않아요');
  if (r.host !== acc.key) throw new HttpError(403, '방장만 할 수 있어요');
  if (r.state !== 'open') throw new HttpError(409, '이미 출정한 방이에요');
  return r;
}

const raidRoutes = {
  // 열려 있는 방 목록 + 내가 들어가 있는 방
  'GET /api/raids': async (req) => {
    const me = await authLite(req);
    const list = [...rooms.values()].filter((r) => r.state === 'open').sort((a, b) => b.at - a.at).slice(0, 50).map((r) => {
      const host = r.members.find((m) => m.key === r.host);
      return { id: r.id, boss: r.boss, host: host ? host.nickname : '', count: r.members.length, members: r.members.map((m) => m.nickname) };
    });
    const r = myRoom(me.key);
    touch(r, me.key);
    return { rooms: list, room: roomView(r), max: MAX_PARTY };
  },

  'GET /api/raids/me': async (req) => {
    const me = await authLite(req);
    const r = myRoom(me.key);
    touch(r, me.key);
    return { room: roomView(r) };
  },

  // 방 만들기. 들어가 있던 방에서는 나온다
  'POST /api/raids': async (req) => {
    const me = await authLite(req);
    const body = await readJson(req);
    const b = raidBoss(body.boss);
    const acc = await store.get(me.key);
    if (sanitizeProfile(acc.profile).best < b.stage) throw new HttpError(403, `최고 스테이지 ${b.stage} 이상이어야 해요`);
    leaveRoom(me.key);
    const r = { id: String(++roomSeq), boss: body.boss, host: me.key, members: [memberOf(acc)], state: 'open', result: null, at: Date.now() };
    rooms.set(r.id, r);
    roomOf.set(me.key, r.id);
    return { room: roomView(r) };
  },

  'POST /api/raids/join': async (req) => {
    const me = await authLite(req);
    const body = await readJson(req);
    const r = rooms.get(String(body.id));
    if (!r || r.state !== 'open') throw new HttpError(404, '이미 출정했거나 사라진 방이에요');
    if (r.members.some((m) => m.key === me.key)) return { room: roomView(r) };
    if (r.members.length >= MAX_PARTY) throw new HttpError(409, '방이 가득 찼어요');
    const acc = await store.get(me.key);
    const b = RAID_BOSSES[r.boss];
    if (sanitizeProfile(acc.profile).best < b.stage) throw new HttpError(403, `최고 스테이지 ${b.stage} 이상이어야 해요`);
    leaveRoom(me.key);
    r.members.push(memberOf(acc));
    roomOf.set(me.key, r.id);
    return { room: roomView(r) };
  },

  'POST /api/raids/leave': async (req) => {
    const me = await authLite(req);
    leaveRoom(me.key);
    return { room: null };
  },

  // 준비 / 준비 취소. 준비하기 직전에 클라이언트가 세이브(프로필)를 올려 둔다
  'POST /api/raids/ready': async (req) => {
    const me = await authLite(req);
    const body = await readJson(req);
    const r = myRoom(me.key);
    if (!r || r.state !== 'open') throw new HttpError(404, '레이드 방에 있지 않아요');
    const m = touch(r, me.key);
    m.ready = !!body.ready && r.host !== me.key;
    return { room: roomView(r) };
  },

  // 방장: 보스 바꾸기 (준비는 모두 풀린다)
  'POST /api/raids/boss': async (req) => {
    const me = await authLite(req);
    const body = await readJson(req);
    const r = hostRoom(me);
    const b = raidBoss(body.boss);
    const low = r.members.find((m) => m.best < b.stage);
    if (low) throw new HttpError(403, `${low.nickname}님이 아직 최고 스테이지 ${b.stage}에 못 미쳐요`);
    r.boss = body.boss;
    r.members.forEach((m) => { m.ready = false; });
    return { room: roomView(r) };
  },

  // 방장: 내보내기
  'POST /api/raids/kick': async (req) => {
    const me = await authLite(req);
    const body = await readJson(req);
    const r = hostRoom(me);
    const m = r.members.find((x) => x.nickname === body.nickname && x.key !== me.key);
    if (m) leaveRoom(m.key);
    return { room: roomView(r) };
  },

  // 방장: 출정. 모두 준비됐으면 서버가 전투를 끝까지 계산해서 방에 결과를 남긴다
  'POST /api/raids/start': async (req) => {
    const me = await authLite(req);
    const r = hostRoom(me);
    const waiting = r.members.find((m) => m.key !== r.host && !m.ready);
    if (waiting) throw new HttpError(409, `${waiting.nickname}님이 아직 준비하지 않았어요`);
    // 저장된 최신 능력치로 싸운다
    const accs = await Promise.all(r.members.map((m) => store.get(m.key)));
    const b = RAID_BOSSES[r.boss];
    const profiles = accs.map((a) => sanitizeProfile(a && a.profile));
    const low = profiles.findIndex((p) => p.best < b.stage);
    if (low >= 0) throw new HttpError(403, `${r.members[low].nickname}님이 아직 최고 스테이지 ${b.stage}에 못 미쳐요`);
    if (r.state !== 'open') throw new HttpError(409, '이미 출정한 방이에요');
    const fight = simulateRaid(r.boss, profiles);
    r.state = 'done';
    r.at = Date.now();
    r.result = {
      id: `${r.id}-${r.at}`, boss: r.boss,
      members: r.members.map((m, i) => ({ nickname: m.nickname, cls: profiles[i].cls, level: profiles[i].level })),
      fight,
    };
    return { room: roomView(r) };
  },

  // 방장: 끝난 방을 다시 열어 같은 파티로 한 번 더
  'POST /api/raids/again': async (req) => {
    const me = await authLite(req);
    const r = myRoom(me.key);
    if (!r || r.host !== me.key) throw new HttpError(403, '방장만 할 수 있어요');
    r.state = 'open'; r.result = null; r.at = Date.now();
    r.members.forEach((m) => { m.ready = false; });
    return { room: roomView(r) };
  },
};
Object.assign(routes, raidRoutes);

// ───────────────────────── 월드 보스 ─────────────────────────
// 오늘의 보스는 그날 처음 누군가 볼 때 나타난다 (server/worldboss.js spawnBoss). 활동 중인 기사가 아무도 없으면 아직 나타나지 않는다
let wbSpawning = null;
async function todayBoss(day = WB.dayAt()) {
  const b = await store.wbGet(day);
  if (b) return b;
  if (!wbSpawning) {
    wbSpawning = (async () => {
      const profiles = (await store.activeProfiles(Date.now() - WB.WB_ACTIVE_MS, WB.WB_UNLOCK)).map((p) => sanitizeProfile(p));
      if (!profiles.length) return null;
      const row = WB.spawnBoss(day, await store.wbLatestBefore(day), profiles);
      console.log(`월드 보스 ${day}: ${row.boss} 체력 ${row.maxHp.toExponential(3)} (어림 ${row.est.toExponential(3)} × 난이도 ${row.diff.toFixed(2)}, 기사 ${profiles.length}명)`);
      return store.wbCreate(row);
    })().finally(() => { wbSpawning = null; });
  }
  return wbSpawning;
}
const wbView = (b) => b && { id: b.boss, maxHp: b.maxHp, hp: b.hp, spawnedAt: b.spawnedAt, killedAt: b.killedAt };
const lastWb = new Map();    // key → 마지막 도전 시각

const wbRoutes = {
  // 오늘의 보스 · 내 피해와 남은 도전 · 피해 순위 · 아직 안 받아 간 지난 보상
  'GET /api/worldboss': async (req) => {
    const a = await authLite(req);
    const day = WB.dayAt();
    const b = await todayBoss(day);
    const [mine, top, stats, pending] = await Promise.all([store.wbMine(day, a.key), store.wbTop(day, 10), store.wbStats(day), store.wbPending(a.key, day)]);
    return {
      day, endsAt: WB.dayEnd(day), now: Date.now(), next: WB.bossOfDay(day + 1),
      boss: wbView(b) || { id: WB.bossOfDay(day), maxHp: 0, hp: 0, spawnedAt: null, killedAt: null },
      tries: WB.WB_TRIES, mine: mine ? { dmg: mine.dmg, tries: mine.tries } : { dmg: 0, tries: 0 },
      top, total: stats.total, players: stats.players, pending,
    };
  },

  // 도전: 저장된 최신 능력치로 WB_SEC 초 동안 싸우고, 넣은 피해를 모두의 보스 체력에서 깎는다
  'POST /api/worldboss/attack': async (req) => {
    const a = await auth(req);
    const p = sanitizeProfile(a.profile);
    if (p.best < WB.WB_UNLOCK) throw new HttpError(403, `최고 스테이지 ${WB.WB_UNLOCK} 이상이어야 도전할 수 있어요`);
    const since = Date.now() - (lastWb.get(a.key) || 0);
    if (since < WB.WB_COOLDOWN_MS) throw new HttpError(429, `${Math.ceil((WB.WB_COOLDOWN_MS - since) / 1000)}초 뒤에 다시 도전할 수 있어요`);
    const day = WB.dayAt();
    const b = await todayBoss(day);
    if (!b) throw new HttpError(409, '아직 월드 보스가 나타나지 않았어요');
    if (b.hp <= 0) throw new HttpError(409, '오늘의 월드 보스는 이미 쓰러졌어요. 내일 새 보스가 나타나요');
    const mine = await store.wbMine(day, a.key);
    if (mine && mine.tries >= WB.WB_TRIES) throw new HttpError(409, '오늘 도전을 모두 썼어요');
    lastWb.set(a.key, Date.now());
    const fight = WB.worldFight(b.boss, p, b.hp, b.maxHp);
    const r = await store.wbHit(day, { key: a.key, nickname: a.nickname, cls: p.cls }, fight.contrib[0].dmg, WB.WB_TRIES, Date.now());
    if (!r) throw new HttpError(409, '오늘 도전을 모두 썼거나 보스가 이미 쓰러졌어요');
    if (r.kill) console.log(`월드 보스 ${day} 처치: ${a.nickname}`);
    return {
      id: `wb-${day}-${a.key}-${r.tries}`, day, boss: b.boss, dealt: r.dealt, kill: r.kill, hp: r.hp, maxHp: b.maxHp,
      mine: { dmg: r.dmg, tries: r.tries }, tries: WB.WB_TRIES,
      members: [{ nickname: a.nickname, cls: p.cls, level: p.level }], fight,
    };
  },

  // 지난 보상을 세이브에 넣었으면 받은 것으로 표시한다
  'POST /api/worldboss/ack': async (req) => {
    const a = await auth(req);
    const body = await readJson(req);
    const days = (Array.isArray(body.days) ? body.days : []).map(Number).filter(Number.isInteger).slice(0, 60);
    if (days.length) await store.wbAck(a.key, days);
    return { ok: true };
  },
};
Object.assign(routes, wbRoutes);

// ───────────────────────── 관리자: 전체 초기화 ─────────────────────────
// 모든 계정(닉네임 포함)·세이브·시즌 기록을 지운다. 지우기 직전 순위는 명예의 전당(hall_of_fame)에 남기고, 그건 지우지 않는다. Render 환경 변수 ADMIN_KEY 가 있어야 열린다.
//   curl -X POST https://knight-bar.onrender.com/api/admin/reset -H "X-Admin-Key: <ADMIN_KEY>" -H "Content-Type: application/json" -d '{"confirm":"RESET"}'
// 접속 중인 기사는 다음 서버 요청 때 401(gone)을 받고 이 기기의 기록이 지워진 채 닉네임 만들기 화면으로 간다.
routes['POST /api/admin/reset'] = async (req) => {
  const key = process.env.ADMIN_KEY;
  const given = String(req.headers['x-admin-key'] || '');
  const ok = key && given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!ok) throw new HttpError(404, '없는 주소입니다');
  const body = await readJson(req);
  if (body.confirm !== 'RESET') throw new HttpError(400, '확인 문구가 필요해요 ({"confirm":"RESET"})');
  const removed = await store.count();
  // 지우기 전에 이번 시즌 순위를 명예의 전당에 남긴다 (기사가 있을 때만)
  if (removed) {
    await settleSeasons();
    const hallView = (a) => ({ nickname: a.nickname, cls: a.cls, level: a.level, best: a.best, power: a.power, rating: a.rating, wins: a.wins, losses: a.losses });
    await store.addHall({
      at: Date.now(), players: removed,
      stage: (await store.top('stage', 10, 0)).map(hallView),
      duel: (await store.top('duel', 3, seasonAt())).map(hallView),
    });
  }
  await store.wipe();
  rooms.clear(); roomOf.clear(); authCache.clear(); lastDuel.clear(); lastWb.clear();
  settledThrough = -1;
  console.log(`전체 초기화: 계정 ${removed}개 삭제`);
  return { ok: true, removed };
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, 'http://x');
  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) return send(res, 404, { error: '없는 주소입니다' });
  try {
    const out = await handler(req, url);
    if (out && out.status) send(res, out.status, out.body);
    else send(res, 200, out);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...(e.code ? { code: e.code } : {}) });
    console.error(e);
    send(res, 500, { error: '서버 오류가 났어요' });
  }
});

store.init().then(() => settleSeasons()).then(() => {
  server.listen(PORT, () => console.log(`knight-bar server :${PORT} (${process.env.DATABASE_URL ? 'postgres' : 'file'})`));
});

// 파일 저장소는 종료 직전에 한 번 더 쓴다
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { if (store.flush) store.flush(); process.exit(0); });
}
