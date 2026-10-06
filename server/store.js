'use strict';
// 계정 저장소. DATABASE_URL 이 있으면 Postgres, 없으면 DATA_DIR 의 JSON 파일(로컬 개발용).
// 계정 = { key, nickname, tokenHash, state, profile, level, best, power, cls, rating, wins, losses, season, attacks, createdAt, updatedAt }
// key 는 닉네임을 소문자로 정규화한 값 (대소문자만 다른 닉네임은 같은 닉네임으로 본다)
// rating·wins·losses·attacks 는 season 시즌의 결투 기록이다 (server/season.js).
// 결투 시즌 정산: 시즌 = { id, settledAt, players, top: [{ nickname, cls, level, rating, wins, losses }] },
//   시즌 보상 = { key, season, rank, total, rating, wins, losses } — 받아 가면(ack) 지운다
// 월드 보스(server/worldboss.js): 하루 = { day, boss, maxHp, hp, diff, est, spawnedAt, killedAt },
//   기사별 피해 = { day, key, nickname, cls, dmg, tries, claimed } — 날이 지나면 지분만큼 보상을 받아 가고(claimed) 남겨 둔다

const fs = require('fs');
const path = require('path');

const SORTS = {
  stage: (x, y) => y.best - x.best || y.level - x.level || y.power - x.power,
  duel: (x, y) => y.rating - x.rating || y.wins - x.wins || y.best - x.best,
};
const SQL_ORDER = {
  stage: 'best DESC, level DESC, power DESC',
  duel: 'rating DESC, wins DESC, best DESC',
};

class TakenError extends Error {}

// 시즌 순위에 오르는 기사: 그 시즌에 직접 결투를 1번 이상 건 기사
const inSeason = (s) => (a) => a.season === s && a.attacks > 0;
const TOP_KEEP = 10;
const topView = (a) => ({ nickname: a.nickname, cls: a.cls, level: a.level, rating: a.rating, wins: a.wins, losses: a.losses });

// ───────────────────────── JSON 파일 ─────────────────────────
class FileStore {
  constructor(dir) {
    this.file = path.join(dir, 'accounts.json');
    this.seasonFile = path.join(dir, 'seasons.json');
    fs.mkdirSync(dir, { recursive: true });
    try { this.db = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.db = {}; }
    try { this.sdb = JSON.parse(fs.readFileSync(this.seasonFile, 'utf8')); } catch { this.sdb = { seasons: [], rewards: [] }; }
    this.sdb.wb = this.sdb.wb || [];
    this.sdb.wbHits = this.sdb.wbHits || [];
    this.timer = null;
  }
  async init() {}
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    for (const [file, data] of [[this.file, this.db], [this.seasonFile, this.sdb]]) {
      fs.writeFileSync(file + '.tmp', JSON.stringify(data));
      fs.renameSync(file + '.tmp', file);
    }
  }
  persist() { if (!this.timer) this.timer = setTimeout(() => this.flush(), 500); }

  async create(acc) {
    if (this.db[acc.key]) throw new TakenError();
    this.db[acc.key] = acc;
    this.persist();
    return acc;
  }
  async get(key) { return this.db[key] || null; }
  async byToken(tokenHash) { return Object.values(this.db).find(a => a.tokenHash === tokenHash) || null; }
  async update(key, fields) {
    Object.assign(this.db[key], fields);
    this.persist();
  }
  // season 을 주면 그 시즌 순위 대상만 (결투 순위)
  pool(season) { const all = Object.values(this.db); return season ? all.filter(inSeason(season)) : all; }
  async top(sort, limit, season) { return this.pool(season).sort(SORTS[sort]).slice(0, limit); }
  async rankOf(acc, sort, season) { return this.pool(season).filter(o => SORTS[sort](o, acc) < 0).length + 1; }
  async count(season) { return this.pool(season).length; }

  async settledThrough() { return this.sdb.seasons.reduce((m, x) => Math.max(m, x.id), 0); }
  async settleSeason(id, now) {
    if (this.sdb.seasons.some(x => x.id === id)) return;
    const list = this.pool(id).sort(SORTS.duel);
    list.forEach((a, i) => this.sdb.rewards.push({ key: a.key, season: id, rank: i + 1, total: list.length, rating: a.rating, wins: a.wins, losses: a.losses }));
    this.sdb.seasons.push({ id, settledAt: now, players: list.length, top: list.slice(0, TOP_KEEP).map(topView) });
    this.persist();
  }
  async season(id) { return this.sdb.seasons.find(x => x.id === id) || null; }
  async pendingRewards(key) { return this.sdb.rewards.filter(r => r.key === key); }
  async ackRewards(key, seasons) {
    this.sdb.rewards = this.sdb.rewards.filter(r => !(r.key === key && seasons.includes(r.season)));
    this.persist();
  }

  // ── 월드 보스 ──
  async activeProfiles(since, minBest) {
    return Object.values(this.db).filter(a => a.updatedAt >= since && a.best >= minBest).map(a => a.profile);
  }
  async wbGet(day) { return this.sdb.wb.find(x => x.day === day) || null; }
  async wbLatestBefore(day) { return this.sdb.wb.filter(x => x.day < day).sort((a, b) => b.day - a.day)[0] || null; }
  async wbCreate(row) {
    if (!this.sdb.wb.some(x => x.day === row.day)) { this.sdb.wb.push({ ...row }); this.persist(); }
    return this.wbGet(row.day);
  }
  async wbMine(day, key) { return this.sdb.wbHits.find(h => h.day === day && h.key === key) || null; }
  // 피해를 반영한다. 남은 체력보다 많이 넣을 수는 없고, 오늘 도전을 다 썼으면 null
  async wbHit(day, acc, dmg, maxTries, now) {
    const b = await this.wbGet(day);
    let h = await this.wbMine(day, acc.key);
    if (!b || b.hp <= 0 || (h && h.tries >= maxTries)) return null;
    const dealt = Math.min(dmg, b.hp);
    b.hp -= dealt;
    const kill = b.hp <= 0 && !b.killedAt;
    if (kill) { b.hp = 0; b.killedAt = now; }
    if (!h) { h = { day, key: acc.key, nickname: acc.nickname, cls: acc.cls, dmg: 0, tries: 0, claimed: false }; this.sdb.wbHits.push(h); }
    h.dmg += dealt; h.tries++; h.nickname = acc.nickname; h.cls = acc.cls;
    this.persist();
    return { dealt, hp: b.hp, kill, dmg: h.dmg, tries: h.tries };
  }
  async wbTop(day, limit) {
    return this.sdb.wbHits.filter(h => h.day === day).sort((a, b) => b.dmg - a.dmg).slice(0, limit)
      .map(h => ({ nickname: h.nickname, cls: h.cls, dmg: h.dmg, tries: h.tries }));
  }
  async wbStats(day) {
    const hs = this.sdb.wbHits.filter(h => h.day === day);
    return { total: hs.reduce((a, h) => a + h.dmg, 0), players: hs.length };
  }
  // 아직 안 받아 간 지난 날의 보상 재료: 내 피해·순위와 그날 전체 피해·참가 인원·처치 여부
  async wbPending(key, today) {
    const out = [];
    for (const h of this.sdb.wbHits.filter(x => x.key === key && x.day < today && !x.claimed)) {
      const b = await this.wbGet(h.day), st = await this.wbStats(h.day);
      const rank = this.sdb.wbHits.filter(x => x.day === h.day && x.dmg > h.dmg).length + 1;
      out.push({ day: h.day, boss: b ? b.boss : null, dmg: h.dmg, rank, total: st.total, players: st.players, killed: !!(b && b.killedAt) });
    }
    return out.sort((a, b) => a.day - b.day);
  }
  async wbAck(key, days) {
    for (const h of this.sdb.wbHits) if (h.key === key && days.includes(h.day)) h.claimed = true;
    this.persist();
  }
  // 전체 초기화: 계정·시즌 기록을 모두 지운다
  async wipe() {
    this.db = {};
    this.sdb = { seasons: [], rewards: [], wb: [], wbHits: [] };
    this.flush();
  }
}

// ───────────────────────── Postgres ─────────────────────────
const COLS = ['key', 'nickname', 'tokenHash', 'state', 'profile', 'level', 'best', 'power', 'cls', 'rating', 'wins', 'losses', 'season', 'attacks', 'createdAt', 'updatedAt'];
const snake = (c) => c.replace(/[A-Z]/g, m => '_' + m.toLowerCase());

class PgStore {
  constructor(url) {
    const { Pool } = require('pg');
    this.pool = new Pool({ connectionString: url, max: 5, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  }
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        key text PRIMARY KEY,
        nickname text NOT NULL,
        token_hash text NOT NULL UNIQUE,
        state jsonb,
        profile jsonb,
        level int NOT NULL DEFAULT 1,
        best int NOT NULL DEFAULT 1,
        power bigint NOT NULL DEFAULT 0,
        cls text NOT NULL DEFAULT 'squire',
        rating int NOT NULL DEFAULT 1000,
        wins int NOT NULL DEFAULT 0,
        losses int NOT NULL DEFAULT 0,
        created_at bigint NOT NULL,
        updated_at bigint NOT NULL
      );
      CREATE INDEX IF NOT EXISTS accounts_stage ON accounts (best DESC, level DESC, power DESC);
      CREATE INDEX IF NOT EXISTS accounts_duel ON accounts (rating DESC, wins DESC);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS season int NOT NULL DEFAULT 0;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS attacks int NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS duel_seasons (
        id int PRIMARY KEY,
        settled_at bigint NOT NULL,
        players int NOT NULL,
        top jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS season_rewards (
        key text NOT NULL,
        season int NOT NULL,
        rank int NOT NULL,
        total int NOT NULL,
        rating int NOT NULL,
        wins int NOT NULL,
        losses int NOT NULL,
        PRIMARY KEY (key, season)
      );
      CREATE TABLE IF NOT EXISTS world_boss (
        day int PRIMARY KEY,
        boss text NOT NULL,
        max_hp double precision NOT NULL,
        hp double precision NOT NULL,
        diff double precision NOT NULL,
        est double precision NOT NULL,
        spawned_at bigint NOT NULL,
        killed_at bigint
      );
      CREATE TABLE IF NOT EXISTS world_boss_hits (
        day int NOT NULL,
        key text NOT NULL,
        nickname text NOT NULL,
        cls text NOT NULL DEFAULT 'squire',
        dmg double precision NOT NULL DEFAULT 0,
        tries int NOT NULL DEFAULT 0,
        claimed boolean NOT NULL DEFAULT false,
        PRIMARY KEY (day, key)
      );
      CREATE INDEX IF NOT EXISTS world_boss_hits_dmg ON world_boss_hits (day, dmg DESC);`);
  }
  row(r) {
    if (!r) return null;
    const o = {};
    for (const c of COLS) o[c] = r[snake(c)];
    o.power = Number(o.power); o.createdAt = Number(o.createdAt); o.updatedAt = Number(o.updatedAt);
    return o;
  }
  async create(acc) {
    const vals = COLS.map(c => acc[c]);
    const r = await this.pool.query(
      `INSERT INTO accounts (${COLS.map(snake).join(',')}) VALUES (${COLS.map((_, i) => '$' + (i + 1)).join(',')})
       ON CONFLICT (key) DO NOTHING RETURNING key`, vals);
    if (!r.rowCount) throw new TakenError();
    return acc;
  }
  async get(key) { return this.row((await this.pool.query('SELECT * FROM accounts WHERE key=$1', [key])).rows[0]); }
  async byToken(h) { return this.row((await this.pool.query('SELECT * FROM accounts WHERE token_hash=$1', [h])).rows[0]); }
  async update(key, fields) {
    const ks = Object.keys(fields);
    await this.pool.query(
      `UPDATE accounts SET ${ks.map((k, i) => `${snake(k)}=$${i + 2}`).join(',')} WHERE key=$1`,
      [key, ...ks.map(k => fields[k])]);
  }
  // season 을 주면 그 시즌 순위 대상만 (결투 순위)
  async top(sort, limit, season) {
    const r = await this.pool.query(
      `SELECT key,nickname,profile,level,best,power,cls,rating,wins,losses,season,attacks,created_at,updated_at,'' AS token_hash,NULL AS state
       FROM accounts ${season ? 'WHERE season=$2 AND attacks>0' : ''} ORDER BY ${SQL_ORDER[sort]} LIMIT $1`, season ? [limit, season] : [limit]);
    return r.rows.map(x => this.row(x));
  }
  async rankOf(acc, sort, season) {
    let where = sort === 'duel'
      ? '(rating, wins, best) > ($1, $2, $3)'
      : '(best, level, power) > ($1, $2, $3)';
    const args = sort === 'duel' ? [acc.rating, acc.wins, acc.best] : [acc.best, acc.level, acc.power];
    if (season) { where += ' AND season=$4 AND attacks>0'; args.push(season); }
    return Number((await this.pool.query(`SELECT count(*) FROM accounts WHERE ${where}`, args)).rows[0].count) + 1;
  }
  async count(season) {
    const r = season
      ? await this.pool.query('SELECT count(*) FROM accounts WHERE season=$1 AND attacks>0', [season])
      : await this.pool.query('SELECT count(*) FROM accounts');
    return Number(r.rows[0].count);
  }

  async settledThrough() { return Number((await this.pool.query('SELECT coalesce(max(id), 0) AS m FROM duel_seasons')).rows[0].m); }
  // 한 트랜잭션에서 순위를 매겨 보상을 남긴다. 이미 정산한 시즌이면 아무것도 안 한다
  async settleSeason(id, now) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const list = (await c.query(
        `SELECT key,nickname,cls,level,rating,wins,losses FROM accounts WHERE season=$1 AND attacks>0 ORDER BY ${SQL_ORDER.duel}`, [id])).rows;
      const ins = await c.query(
        'INSERT INTO duel_seasons (id, settled_at, players, top) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING RETURNING id',
        [id, now, list.length, JSON.stringify(list.slice(0, TOP_KEEP).map(topView))]);
      if (!ins.rowCount) { await c.query('ROLLBACK'); return; }
      if (list.length) {
        await c.query(
          `INSERT INTO season_rewards (key, season, rank, total, rating, wins, losses)
           SELECT k, $1, r, $2, rt, w, l FROM unnest($3::text[], $4::int[], $5::int[], $6::int[], $7::int[]) AS t(k, r, rt, w, l)
           ON CONFLICT DO NOTHING`,
          [id, list.length, list.map(a => a.key), list.map((_, i) => i + 1), list.map(a => a.rating), list.map(a => a.wins), list.map(a => a.losses)]);
      }
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
  async season(id) {
    const r = (await this.pool.query('SELECT * FROM duel_seasons WHERE id=$1', [id])).rows[0];
    return r ? { id: r.id, settledAt: Number(r.settled_at), players: r.players, top: r.top } : null;
  }
  async pendingRewards(key) {
    return (await this.pool.query('SELECT season,rank,total,rating,wins,losses FROM season_rewards WHERE key=$1 ORDER BY season', [key])).rows;
  }
  async ackRewards(key, seasons) {
    await this.pool.query('DELETE FROM season_rewards WHERE key=$1 AND season = ANY($2::int[])', [key, seasons]);
  }

  // ── 월드 보스 ──
  async activeProfiles(since, minBest) {
    return (await this.pool.query('SELECT profile FROM accounts WHERE updated_at >= $1 AND best >= $2', [since, minBest])).rows.map(r => r.profile);
  }
  wbRow(r) {
    return r ? { day: r.day, boss: r.boss, maxHp: Number(r.max_hp), hp: Number(r.hp), diff: Number(r.diff), est: Number(r.est),
      spawnedAt: Number(r.spawned_at), killedAt: r.killed_at == null ? null : Number(r.killed_at) } : null;
  }
  async wbGet(day) { return this.wbRow((await this.pool.query('SELECT * FROM world_boss WHERE day=$1', [day])).rows[0]); }
  async wbLatestBefore(day) { return this.wbRow((await this.pool.query('SELECT * FROM world_boss WHERE day<$1 ORDER BY day DESC LIMIT 1', [day])).rows[0]); }
  async wbCreate(b) {
    await this.pool.query(
      `INSERT INTO world_boss (day, boss, max_hp, hp, diff, est, spawned_at, killed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL)
       ON CONFLICT (day) DO NOTHING`, [b.day, b.boss, b.maxHp, b.hp, b.diff, b.est, b.spawnedAt]);
    return this.wbGet(b.day);
  }
  async wbMine(day, key) {
    const r = (await this.pool.query('SELECT dmg, tries FROM world_boss_hits WHERE day=$1 AND key=$2', [day, key])).rows[0];
    return r ? { dmg: Number(r.dmg), tries: r.tries } : null;
  }
  // 한 트랜잭션에서 보스 체력을 잠그고 피해를 반영한다. 남은 체력보다 많이 넣을 수는 없고, 오늘 도전을 다 썼으면 null
  async wbHit(day, acc, dmg, maxTries, now) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const b = this.wbRow((await c.query('SELECT * FROM world_boss WHERE day=$1 FOR UPDATE', [day])).rows[0]);
      const h = (await c.query('SELECT dmg, tries FROM world_boss_hits WHERE day=$1 AND key=$2 FOR UPDATE', [day, acc.key])).rows[0];
      if (!b || b.hp <= 0 || (h && h.tries >= maxTries)) { await c.query('ROLLBACK'); return null; }
      const dealt = Math.min(dmg, b.hp), hp = Math.max(0, b.hp - dealt), kill = hp <= 0 && !b.killedAt;
      await c.query('UPDATE world_boss SET hp=$2, killed_at=coalesce(killed_at, $3) WHERE day=$1', [day, hp, kill ? now : null]);
      const r = (await c.query(
        `INSERT INTO world_boss_hits (day, key, nickname, cls, dmg, tries) VALUES ($1,$2,$3,$4,$5,1)
         ON CONFLICT (day, key) DO UPDATE SET dmg = world_boss_hits.dmg + $5, tries = world_boss_hits.tries + 1, nickname = $3, cls = $4
         RETURNING dmg, tries`, [day, acc.key, acc.nickname, acc.cls, dealt])).rows[0];
      await c.query('COMMIT');
      return { dealt, hp, kill, dmg: Number(r.dmg), tries: r.tries };
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
  async wbTop(day, limit) {
    return (await this.pool.query('SELECT nickname, cls, dmg, tries FROM world_boss_hits WHERE day=$1 ORDER BY dmg DESC LIMIT $2', [day, limit]))
      .rows.map(r => ({ nickname: r.nickname, cls: r.cls, dmg: Number(r.dmg), tries: r.tries }));
  }
  async wbStats(day) {
    const r = (await this.pool.query('SELECT coalesce(sum(dmg), 0) AS total, count(*) AS players FROM world_boss_hits WHERE day=$1', [day])).rows[0];
    return { total: Number(r.total), players: Number(r.players) };
  }
  // 아직 안 받아 간 지난 날의 보상 재료: 내 피해·순위와 그날 전체 피해·참가 인원·처치 여부
  async wbPending(key, today) {
    const r = await this.pool.query(
      `SELECT h.day, b.boss, h.dmg, b.killed_at,
         (SELECT count(*) FROM world_boss_hits x WHERE x.day = h.day AND x.dmg > h.dmg) + 1 AS rank,
         (SELECT coalesce(sum(dmg), 0) FROM world_boss_hits x WHERE x.day = h.day) AS total,
         (SELECT count(*) FROM world_boss_hits x WHERE x.day = h.day) AS players
       FROM world_boss_hits h LEFT JOIN world_boss b ON b.day = h.day
       WHERE h.key = $1 AND h.day < $2 AND NOT h.claimed ORDER BY h.day`, [key, today]);
    return r.rows.map(x => ({ day: x.day, boss: x.boss, dmg: Number(x.dmg), rank: Number(x.rank), total: Number(x.total), players: Number(x.players), killed: x.killed_at != null }));
  }
  async wbAck(key, days) {
    await this.pool.query('UPDATE world_boss_hits SET claimed = true WHERE key=$1 AND day = ANY($2::int[])', [key, days]);
  }
  // 전체 초기화: 계정·시즌 기록을 모두 지운다
  async wipe() {
    await this.pool.query('TRUNCATE accounts, duel_seasons, season_rewards, world_boss, world_boss_hits');
  }
}

function openStore() {
  if (process.env.DATABASE_URL) return new PgStore(process.env.DATABASE_URL);
  // Render 무료 인스턴스의 디스크는 재시작마다 비워진다. DB 설정이 빠졌으면 데이터를 잃기 전에 시작을 멈춘다.
  if (process.env.RENDER && !process.env.DATA_DIR) {
    throw new Error('DATABASE_URL 이 설정되지 않았습니다 (Render → Environment 에서 Supabase 연결 문자열을 넣어 주세요)');
  }
  return new FileStore(process.env.DATA_DIR || path.join(__dirname, 'data'));
}

module.exports = { openStore, TakenError };
