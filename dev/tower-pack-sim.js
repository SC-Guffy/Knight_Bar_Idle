'use strict';
// 도전의 탑 무리 층 밸런스 시뮬레이터 (개발용, docs/specs/tower-packs.md).
// dev/skills.html 을 연 뒤 콘솔에서 불러 쓴다. 게임의 world.js update() 를 1/60초씩 직접 돌려 실제 탑 전투(평타·스킬·광폭화·체력 이월)를 그대로 잰다.
//   const s = document.createElement('script'); s.src = 'tower-pack-sim.js?t=' + Date.now(); document.body.appendChild(s);
//   towerSim.compare(towerSim.TIER2, { pack: { pack: () => 3, hpShare: 0.4 } }, { curve: 'fine', seeds: 12 })
// 기사 세기는 맞추지 않는다. 대신 직업마다 몬스터에 배율을 걸어 "정예만 나올 때 벽이 되는 층"을 같게 만든 뒤, 무리 설정에서 그 벽이 몇 층 움직이는지 본다.
//  curve 'real': 실제 층 곡선(층마다 체력 ×1.49 · 공격력 ×1.36, 10층마다 보스). 정예만 기준 벽 ≈ 15층.
//  curve 'fine': 보스 없이 층마다 체력 ×1.08 · 공격력 ×1.06 (실제 1층 ≈ 5칸). 벽 ≈ 20칸. 작은 차이를 볼 때 쓴다.
// 무리는 아직 게임에 없으므로(towerPack 이 없으면) 층을 시작하는 순간 정예 1마리를 n마리로 바꿔 넣는다.
//  hpShare: 마리당 체력 = 정예 체력 × hpShare, atkShare: 마리당 공격력 = 정예 공격력 × atkShare, rageExtra: 광폭화 시작을 이만큼(초) 늦춘다.
// 구현 뒤에는 게임이 무리를 직접 내므로 pack 옵션 대신 window.towerPack 을 덮어써서 기준선(정예만)을 잰다.
(function () {
  const TIER2 = ['paladin', 'blademaster', 'dragoon', 'halberdier', 'marksman', 'arcaneArcher', 'pyromancer', 'cryomancer', 'greatswordsman', 'cavalier', 'arbalest', 'electromancer'];
  const TIER3 = ['tyrant', 'skyGeneral', 'siegeMaster', 'thunderEmperor', 'archon', 'swordsaint', 'dragonlord', 'warlord', 'deadeye', 'voidArcher', 'archmage', 'frostlord'];
  const origTM = window.__origTM || towerMonster, origBoss = window.__origBoss || towerBossFloor;
  window.__origTM = origTM; window.__origBoss = origBoss;
  let H = 1, A = 1, curve = 'real';

  // 테스트 페이지 루프를 멈추고, 저장·정산 화면·배너를 끈다
  const pause = document.getElementById('pause');
  if (pause && !pause.classList.contains('on')) pause.click();
  window.save = () => {};
  hooks.onTowerEnd = () => {};
  window.showBanner = () => {};

  window.towerMonster = (f) => {
    if (curve === 'fine') { const m = origTM(9), k = f - 20; return { ...m, hp: m.hp * H * Math.pow(1.08, k), atk: m.atk * A * Math.pow(1.06, k) }; }
    const m = origTM(f); return { ...m, hp: m.hp * H, atk: m.atk * A };
  };
  const setCurve = (c) => { curve = c; window.towerBossFloor = c === 'fine' ? () => false : origBoss; };

  // 벽 층(real 15층 · fine 20칸)의 정예를 평타 기대 DPS 로 약 9초에 잡고, 그동안 받는 피해가 최대 체력쯤 되게 배율을 잡는다
  function calib(cls) {
    skillTest.setClass(cls); skillTest.setStage(2);   // 스킬 숙련 ★★ (Lv20)
    const st = stats(), e = origTM(curve === 'fine' ? 9 : 14);
    const dps = st.atk * st.aspd * (st.kind === 'ranged' ? st.shots * st.shotMult : 1) * (1 + st.crit);
    H = dps * 9 / e.hp;
    A = (st.maxHp / (9 / 1.4)) / (e.atk * (1 - st.guard));
  }

  // 탑 한 번: 1층부터 쓰러질 때까지. { best 최고 층, floors: [{ f, n 마리 수, dt 걸린 시간, hp1 끝난 뒤 체력 비율 }] }
  function run(cls, opts = {}) {
    const o = Object.assign({ pack: null, hpShare: 1 / 3, atkShare: 1, rageExtra: 0, maxSec: 400 }, opts);
    calib(cls);
    if (tw) endTowerView();
    monsters.length = 0;
    S.best = Math.max(S.best, 30); S.phase = 'camp'; S.stamina = 1e9;
    S.tower = freshTower();
    Object.assign(knight, { cds: {}, ward: null, down: 0, fighting: false, pending: false, swing: -1, dash: null });
    if (!startTower()) return { cls, best: null, why: towerBlocker() };
    const floors = []; let cur = null, seen = -1;
    for (let i = 0; i < o.maxSec * 60; i++) {
      update(1 / 60);
      if (!S.tower.run) break;
      const f = S.tower.run.floor;
      if (tw && tw.sub === 'fight' && seen !== f && monsters.length) {
        seen = f;
        const m0 = monsters[0], n = o.pack && !m0.boss ? o.pack(f) : 0;
        if (n > 1) {
          const pool = monsterPool(towerStage(f)), hp = m0.maxHp * o.hpShare, atk = m0.atk0 * o.atkShare;
          Object.assign(m0, { hp, maxHp: hp, atk, atk0: atk, gold: m0.gold / n, exp: m0.exp / n });
          for (let j = 1; j < n; j++) {
            const t = pool[Math.floor(Math.random() * pool.length)];
            monsters.push(makeMonster(t, false, m0.x + j * 14, { hp, atk, gold: m0.gold, exp: m0.exp, boss: false, atk0: atk, rage: 1 }));
          }
          tw.ft = -o.rageExtra;
        }
        cur = { f, n: Math.max(1, monsters.length), t0: clock };
      }
      if (cur && S.tower.run.floor > cur.f) { cur.dt = +(clock - cur.t0).toFixed(2); cur.hp1 = +(S.hp / stats().maxHp).toFixed(2); delete cur.t0; floors.push(cur); cur = null; }
    }
    const last = S.tower.last;
    if (tw) endTowerView();
    monsters.length = 0;
    return { cls, best: last ? last.best : null, floors };
  }

  // 직업마다 정예만(elite) 과 cfgs 의 각 설정을 seeds 번씩 돌려, 평균 최고 층과 정예만 대비 차이를 표로 낸다.
  //  한 번에 너무 많이 돌리면 javascript_tool 이 시간 초과로 끊긴다 → 직업 12종 × 12회 × 설정 하나 정도씩 나눠 부른다 (결과는 towerSim.res 에 쌓인다)
  const res = {};
  function compare(classes, cfgs = {}, { curve: c = 'real', seeds = 8, skipElite = false } = {}) {
    setCurve(c);
    const all = skipElite ? cfgs : { elite: {}, ...cfgs };
    for (const [name, opts] of Object.entries(all)) {
      const key = c + ':' + name;
      res[key] = res[key] || {};
      for (const cls of classes) res[key][cls] = Array.from({ length: seeds }, () => run(cls, opts).best);
    }
    return table(classes, Object.keys(cfgs), c);
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  function table(classes, names, c = 'real') {
    const lines = [`직업 | 정예만(평균±표준오차) | ${names.join(' | ')}`];
    for (const cls of classes) {
      const e = (res[c + ':elite'] || {})[cls];
      if (!e) continue;
      const se = Math.sqrt(mean(e.map((x) => (x - mean(e)) ** 2)) / e.length);
      const row = [`${cls}(${CLASSES[cls].name})`, `${mean(e).toFixed(1)}±${se.toFixed(1)}`];
      for (const n of names) { const p = (res[c + ':' + n] || {})[cls]; row.push(p ? ((mean(p) - mean(e)) >= 0 ? '+' : '') + (mean(p) - mean(e)).toFixed(1) : '-'); }
      lines.push(row.join(' | '));
    }
    return lines.join('\n');
  }

  window.towerSim = { run, compare, table, res, setCurve, TIER2, TIER3 };
})();
