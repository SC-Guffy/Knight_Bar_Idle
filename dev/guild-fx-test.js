'use strict';
// 기사단 효과 규칙 점검 (docs/specs/guild.md 4단계 수용 기준): node dev/guild-fx-test.js
// 같은 계열은 최고 레벨 1명만 · 최대 단은 회관 Lv ÷ 3 · 다양성 · 따라잡기 · 기사단 밖에선 효과 없음 · stats/profile 전투력에 들어감
const vm = require('vm');
const { makeGame } = require('./progress-bot');
let fails = 0;
const ok = (n, c, x) => { if (!c) fails++; console.log(c ? '✅' : '❌', n, x !== undefined ? JSON.stringify(x) : ''); };
const solo = makeGame(null), R = (code, ctx = solo) => vm.runInContext(code, ctx);
let fx = R('guildFxOf([{nick:"a",cls:"swordsaint",lv:90},{nick:"b",cls:"swordsman",lv:60},{nick:"c",cls:"deadeye",lv:200}], 6)');
ok('같은 계열 둘이면 높은 레벨 한 명만', fx.fam.swordsman.nick === 'a' && fx.fam.swordsman.lv === 90, fx.fam.swordsman);
ok('회관 Lv6 → 최대 2단', fx.cap === 2 && fx.fam.swordsman.tier === 2 && fx.fam.ranger.tier === 2, { cap: fx.cap });
ok('효과 = 단 × 단당 크기', Math.abs(fx.atk - 2 * R('GUILD_FX.swordsman.per')) < 1e-9 && Math.abs(fx.crit - 2 * R('GUILD_FX.ranger.per')) < 1e-9, { atk: fx.atk, crit: fx.crit });
ok('다양성: Lv50↑ 계열 수 × 1%', fx.div === 2 && Math.abs(fx.atkAll - 2 * R('GUILD_TUNE.divPer')) < 1e-9);
fx = R('guildFxOf([{nick:"a",cls:"swordsaint",lv:300}], 15)');
ok('회관 Lv15 → 5단', fx.cap === 5 && fx.fam.swordsman.tier === 5);
ok('견습 기사는 계열 없음, 파이터 3차는 파이터', R('classFamily("squire")') === null && R('classFamily("champion")') === 'fighter');
ok('기사단 밖: guildFx() = null, 회관 건물 없음', R('guildFx() === null && !BUILDINGS.hall'));
const shared = { gold: 0, wood: 0, ore: 0, bld: { training: 1, inn: 1, storage: 1, forge: 1, hall: 15 }, stock: { wood: 0, ore: 0, at: 0, tradeDay: '', trades: 0 }, forge: {}, build: null };
const roster = { list: [], rev: 0 };
const host = { full: true, roster: () => roster,
  bindShared(S) { for (const k of ['bld', 'stock', 'forge', 'build']) Object.defineProperty(S, k, { get: () => shared[k], set: (v) => { shared[k] = v; }, enumerable: false, configurable: true }); } };
const g = makeGame(null, host);
R('S.level = 120; S.cls = "swordsaint"', g); host.bindShared(R('S', g));
const off = R('[stats(true).atk, profile().power]', g);
roster.list = ['archmage', 'dragonlord', 'deadeye', 'champion', 'swordsaint'].map((cls, i) => ({ nick: 'k' + i, cls, lv: 150 })); roster.rev++;
const on = R('[stats(true).atk, profile().power]', g);
ok('기사단 안: 랭킹·결투용 공격력·전투력이 오름', on[0] > off[0] && on[1] > off[1], { atk: (on[0] / off[0]).toFixed(4), power: (on[1] / off[1]).toFixed(4) });
R('S.exp = 0; S.level = 50', g);
ok('따라잡기: 기사단 최고 Lv 의 80% 아래면 경험치 ×2', R('gainExp(10); S.exp', g) === 20);
console.log(fails ? `실패 ${fails}` : '모두 통과');
process.exitCode = fails ? 1 : 0;
