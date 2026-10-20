'use strict';
// 시즌7 스킬 트리 줄기 데이터 검사 (docs/specs/skill-tree-all.md). node dev/tree7-check.js [줄기 id ...]
//  - src/tree7-l-<줄기>.js 의 t7DefLine·t7DefStem 이 빠짐없이 채워졌는지 (칸 스킬·새 스킬 바탕·화면 글·갈래 이름)
//  - 3차 Lv230 으로 빌드 a·b·k 를 찍어 전투 스킬·DPS·프로필이 정상인지, 원정 1시간을 오류 없이 도는지
const vm = require('vm');
const { makeGame } = require('./progress-bot');
const want = process.argv.slice(2);
const c = makeGame();
const lines = vm.runInContext('Object.keys(T7_LINES)', c);
const todo = want.length ? want : lines;
let bad = 0;
// 2안 판 모양: 모든 노드가 시작점(공짜 칸 노드)에서 이어지는지 · 숫자 게이트(min)가 남지 않았는지 (docs/specs/skill-tree-v3.md)
{
  const e = vm.runInContext(`(() => {
    const err = [], ok = new Set(T7_NODES.filter((n) => n.free).map((n) => n.id));
    for (let g = 0; g < 30; g++) for (const n of T7_NODES) if (!ok.has(n.id) && ((n.reqAll || n.req).length && (n.reqAll || n.req)[n.reqAll ? 'every' : 'some']((r) => ok.has(r)))) ok.add(n.id);
    for (const n of T7_NODES) { if (!ok.has(n.id)) err.push('시작점과 안 이어짐: ' + n.id); if (n.min) err.push('숫자 게이트 남음: ' + n.id); }
    return err;
  })()`, c);
  if (e.length) { bad++; console.log('✗ 판 모양\n  - ' + e.join('\n  - ')); } else console.log('✓ 판 모양 (노드 ' + vm.runInContext('T7_NODES.length', c) + '개, 모두 시작점에서 이어짐)');
}
for (const id of todo) {
  if (!lines.includes(id)) { console.log(`✗ ${id}: 줄기 파일이 없음 (src/tree7-l-${id}.js)`); bad++; continue; }
  const r = vm.runInContext(`(() => {
    const L = T7_LINES[${JSON.stringify(id)}], err = [];
    const path = classPath(L.id).slice(1);
    if (JSON.stringify(path) !== JSON.stringify(L.cls)) err.push('cls 가 classPath 와 다름: ' + path.join('>'));
    for (const slot of ['slash', 'gale', 'iaido', 'ult']) { const k = SKILLS[L.sk[slot]]; if (!k || k.t7) err.push('sk.' + slot + ' 없음/새 스킬'); }
    if (SKILLS[L.sk.slash] && SKILLS[L.sk.slash].cls !== L.cls[0]) err.push('sk.slash 가 1차 스킬이 아님');
    for (const slot of ['gale', 'iaido']) if (SKILLS[L.sk[slot]] && SKILLS[L.sk[slot]].cls !== L.cls[1]) err.push('sk.' + slot + ' 가 2차 스킬이 아님');
    if (SKILLS[L.sk.ult] && !SKILLS[L.sk.ult].ult) err.push('sk.ult 가 궁극기가 아님');
    for (const slot of ['whirl', 'flash', 'wave', 'storm', 'f_ab', 'f_bk', 'f_ak']) {
      const o = L.newSkills[slot];
      if (!o) { err.push('newSkills.' + slot + ' 없음'); continue; }
      if (!SKILLS[o.base] || SKILLS[o.base].t7) err.push(slot + '.base 가 지금 스킬이 아님: ' + o.base);
      else if (![...classPath(L.id)].includes(SKILLS[o.base].cls)) err.push(slot + '.base 가 이 줄기 스킬이 아님: ' + o.base);
      if (!o.name || !o.icon || !o.desc) err.push(slot + ' name·icon·desc');
      if (!Array.isArray(o.stageName) || o.stageName.length !== 4) err.push(slot + '.stageName 4개');
      if (!(o.t7mul > 0)) err.push(slot + '.t7mul');
    }
    const ids = Object.values(L.sk);
    if (new Set(ids).size !== ids.length) err.push('칸 스킬 id 중복');
    for (const l of ['a', 'b', 'k']) { const x = L.lanes && L.lanes[l]; if (L.id !== 'swordsaint' && (!x || !x.name || !x.sub)) err.push('lanes.' + l + ' name·sub'); }
    if (L.id !== 'swordsaint') {
      const st = T7_STEMS[L.cls[0]];
      if (!st) err.push('1차 줄기 글 없음 t7DefStem(' + L.cls[0] + ')');
      for (const n of T7_NODES) {
        if (n.t === 'stat' || n.t === 'look') continue;   // 스탯 점은 글 공통, 모습 이름은 스킬 stageName·looks 에서
        if (n.tier <= 1 && L.cls[0] === 'swordsman') continue;   // 검사 1차 줄기 글은 화면 기본값(src/tree7-ui.js T7_UI)
        const u = { ...(st && n.tier <= 1 ? st.ui[n.id] : {}), ...L.ui[n.id] };
        if (!u.n || !u.d) err.push('ui.' + n.id + ' n·d');
        if ((n.t === 'active' || n.t === 'ult') && (!Array.isArray(u.looks) || u.looks.length !== 5)) err.push('ui.' + n.id + '.looks 5개');
        if ((n.t === 'active' || n.t === 'ult' || n.t === 'fusion') && !u.ic) err.push('ui.' + n.id + '.ic');
        if (n.t === 'key' && !u.cost) err.push('ui.' + n.id + '.cost (키스톤 대가)');
      }
    }
    // 빌드별: Lv230 3차로 찍고 전투 확인
    const out = {};
    for (const b of ['a', 'b', 'k']) {
      S = freshState(); S.cls = L.cls[2]; S.level = 230; S.best = S.stage = 200; S.gold = 1e30; S.mats.mana = 1e6;
      t7AutoSpend(b);
      const st = stats(), p = profile();
      if (!t7On()) err.push('t7On 꺼짐');
      if (st.skills.length < 4) err.push(b + ': 전투 스킬 ' + st.skills.length + '개');
      if (!(dpsOf(st) > 0) || !isFinite(dpsOf(st))) err.push(b + ': dps ' + dpsOf(st));
      if (p.skills.length > 5 || p.skills.some((s) => !(s.mult > 0) || !(s.cd > 0))) err.push(b + ': 프로필 스킬 이상');
      out[b] = { skills: st.skills.join(','), dps: +dpsOf(st).toPrecision(3), power: p.power, spent: t7Spent() };
    }
    // 1차·2차에서도
    for (const [cls, lv] of [[L.cls[0], 30], [L.cls[1], 60]]) {
      S = freshState(); S.cls = cls; S.level = lv; S.best = S.stage = lv; S.gold = 1e30; S.mats.mana = 1e6;
      t7AutoSpend('a');
      if (!stats().skills.length) err.push(cls + ' Lv' + lv + ': 스킬 0개');
    }
    return { err, out };
  })()`, c);
  // 원정 1시간 (오프라인 계산)
  let simErr = null;
  try {
    vm.runInContext(`S = freshState(); S.cls = T7_LINES[${JSON.stringify(id)}].cls[2]; S.level = 150; S.best = S.stage = 120; S.gold = 1e30; S.mats.mana = 1e6; t7AutoSpend('k');
      S.stamina = maxStamina(); startExpedition(); simulate(3600);`, c);
  } catch (e) { simErr = String(e && e.stack || e).split('\n').slice(0, 3).join(' / '); }
  if (simErr) r.err.push('원정 계산 오류: ' + simErr);
  if (r.err.length) { bad++; console.log(`✗ ${id}\n  - ${r.err.join('\n  - ')}`); }
  else console.log(`✓ ${id}  ` + Object.entries(r.out).map(([b, o]) => `${b}: ${o.skills} dps ${o.dps} 전투력 ${o.power}`).join(' · '));
}
process.exit(bad ? 1 : 0);
