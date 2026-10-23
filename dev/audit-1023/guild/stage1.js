const vm = require('vm'); const { makeGame } = require(process.cwd() + '/dev/progress-bot.js');
const c = makeGame(null); const run = (x) => vm.runInContext(x, c);
run('loadState(null); S.best = 200; S.tomes = 0;');
const out = {};
// G-A 탑 소탕
out.sweep = run('[5,10,30,49,100,200].map(b => towerSweepTomes(b)).join(",")');
out.sweepDo = run('S.tower.best = 49; S.tomes = 0; sweepTower(); S.tomes');
// G-B 숙련 바치기: Lv20 위로 (스킬 하나 골라 경험치를 Lv20 으로)
out.feed = run(`(() => { const L = T7_LINES.swordsaint; S.cls = L.cls[2]; S.level = 170; t7S(); const sk = Object.values(L.sk)[0];
  const need = SKM_NEED[skmGrade(sk)]; S.skm[sk] = need[19]; S.tomes = 100000; const lv0 = skmLv(sk), max = skmFeedMax(sk); const used = skmFeed(sk, 100000);
  return { lv0, max, used, lv: skmLv(sk), more: skmFeedMax(sk) }; })()`);
// H
out.stones = run('GEAR_STONES.join(",") + " gem " + CURIOS.gem.amt');
// F 성벽 바닥: 최고 20, 21 도전 3웨이브에서 무너짐
out.castle = run(`(() => { S.castle.best = 20; S.castle.tixUsed = 0; S.castle.tixDay = ''; S.phase = 'camp'; S.best = 200; startCastle(); const r = S.castle.run;
  r.wave = 3; r.waveLeft = [0,0,0]; r.pts = CASTLE_WAVES.slice(0,3).reduce((a,w)=>a+w.n*CASTLE_MOB_PTS+(w.b?CASTLE_BOSS_PTS:0),0); const L = endCastle('broken'); S.phase='camp';
  return { bricks: L.bricks, books: L.books, floor: L.floor, sweep: castleSweepBricks() }; })()`);
out.castleFirst = run(`(() => { S.castle.best = 0; S.castle.tixUsed = 0; startCastle(); const r = S.castle.run; r.wave = 1; r.waveLeft=[0]; r.pts = 10; const L = endCastle('broken'); S.phase='camp'; return { bricks: L.bricks, floor: L.floor }; })()`);
// L 성벽 졸업
out.done = run(`(() => { const a = [castleDone(), castleTicketBlocker()]; S.castle.best = CASTLE_MAX_LV; for (const id of CASTLE_UP_IDS) S.castle.up[id] = CASTLE_UP_MAX;
  const b = [castleDone(), MENTOR_ON ? mentorAllDone() : 'off']; if (MENTOR_ON) S.mentor.stars = MENTORS.map(() => MENTOR_STARS); return { before: a, noMentor: b, after: [castleDone(), castleTicketBlocker()] }; })()`);
console.log(JSON.stringify(out, null, 1));
