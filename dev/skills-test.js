'use strict';
// 스킬·평타 모션 테스트 (개발용). 게임의 world.js · skills.js 를 그대로 쓰고, 이 파일은 무대만 꾸민다:
//  - 모드: 스킬(고른 스킬을 반복) / 평타만(공격 속도대로 평타를 계속 친다. 연속기 동작을 번갈아 또는 하나만 고정)
//  - 하단바 대신 고정 폭 캔버스를 2배로 키워 그린다
//  - 왼쪽에 기사, 오른쪽에 맞아도 쓰러지지 않는 허수아비 (공격하지 않음)
//  - 고른 스킬을 실제 원정과 같은 경로(tryCastSkill)로 쓴다 → 피해 숫자·검흔·히트스톱까지 게임과 똑같다

// 게임 스크립트는 index.html 에 적힌 순서 그대로 불러온다. 새 파일이 생겨도 이 페이지를 고칠 필요가 없다.
// 빼는 것: ui.js(부팅·메인 루프·계정 창), net.js(서버 동기화 — 테스트 상태가 계정에 올라가면 안 된다)
const SKIP_SCRIPTS = ['src/ui.js', 'src/net.js'];

(async function boot() {
  const LOCAL = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname) || location.hostname.endsWith('.localhost');
  if (!LOCAL) {
    document.getElementById('app').remove();
    document.getElementById('blocked').style.display = 'block';
    return;
  }
  const html = await (await fetch('../index.html', { cache: 'no-store' })).text();
  const srcs = [...html.matchAll(/<script src="(src\/[^"]+)"><\/script>/g)].map((m) => m[1]).filter((p) => !SKIP_SCRIPTS.includes(p));
  for (const src of srcs) {
    await new Promise((ok, fail) => {
      const el = document.createElement('script');
      el.src = '../' + src + '?t=' + Date.now();
      el.onload = ok; el.onerror = () => fail(new Error(src + ' 를 불러오지 못했어요'));
      document.body.appendChild(el);
    });
  }
  run();
})();

function run() {

  const ZOOM = 2;                 // 캔버스 확대 배율 (도트가 잘 보이게)
  const HERO_X = 140;             // 기사 화면 x
  const GAP_SEC = 0.9;            // 스킬 사이 쉬는 시간

  // ── 허수아비: 이 페이지에서만 몬스터 표에 넣는다 ──
  MONSTERS.dummy = {
    name: '허수아비', spr: 'dummy', style: 'swing', fps: 1,
    pal: { h: '#c9a24a', s: '#e2c99a', K: '#3a2a1a', M: '#7a5a3a', c: '#a0503c', C: '#6a3428', t: '#e8d27a', p: '#7a5230' },
  };
  SPR.dummy = [[
    '....hhh....',
    '...hhhhh...',
    '.hhhhhhhhh.',
    '...sssss...',
    '...sKsKs...',
    '...sssss...',
    '...ssMss...',
    't.ccCcCcc.t',
    'ttcCcccCctt',
    '..ccCcCcc..',
    '...ccccc...',
    '....tpt....',
    '.....p.....',
    '.....p.....',
    '.....p.....',
    '....ppp....',
  ]];

  // ── 무대 ──
  function sizeStage() {
    const dpr = window.devicePixelRatio || 1;
    W = Math.max(360, Math.floor(document.getElementById('stage').clientWidth / ZOOM));   // 무대 폭 (게임 px)
    canvas.width = W * dpr * ZOOM; canvas.height = H * dpr * ZOOM;
    canvas.style.width = W * ZOOM + 'px'; canvas.style.height = H * ZOOM + 'px';
    ctx.setTransform(dpr * ZOOM, 0, 0, dpr * ZOOM, 0, 0);
    ctx.imageSmoothingEnabled = false;
    makeGrass();
  }
  drawCamp = () => {};            // 캠프 텐트·모닥불은 무대에 필요 없다

  let dummy = null;
  function placeDummy() {
    const st = stats();
    const gap = Math.min(W - HERO_X - 50, st.kind === 'ranged' ? Math.min(260, st.range * 0.8) : st.range + 12);   // 무대가 좁으면 안쪽으로
    monsters = [];
    dummy = makeMonster('dummy', false, toWorld(HERO_X + gap));
    dummy.hp = dummy.maxHp = 1e15;
    dummy.atkTimer = Infinity;
    monsters.push(dummy);
  }
  function refillDummy() {
    if (!dummy) return;
    dummy.dying = 0; dummy.killed = false;
    if (dummy.hp < 1e14) dummy.hp = dummy.maxHp = 1e15;     // 사실상 쓰러지지 않는다 (피해량은 체력 차이로 잰다)
    dummy.atkTimer = Infinity; dummy.anim = null;
    if (!monsters.includes(dummy)) monsters.push(dummy);
  }

  // ── 상태 ──
  const T = {
    mode: 'skill', cls: 'swordsman', skill: null, auto: true, allCls: false, basic: true, paused: false, speed: 1, stepOnce: false,
    wait: 0.4, basicDone: false, last: null,
    stage: 0, stageCycle: false,                              // 숙련 단계(0 = Lv1, 1 = ★Lv10, 2 = ★★Lv20, 3 = ★★★Lv30), 스킬을 쓸 때마다 단계를 돌린다
    motion: null, atkT: 0.3, swings: 0, lastBasic: null,     // 평타만: motion 고정할 동작 번호(null 이면 번갈아), swings 친 횟수
  };
  // 스킬 모드는 스킬이 있는 직업만, 평타 모드는 견습 기사까지 전부
  const testClasses = () => Object.keys(CLASSES).filter((id) => T.mode === 'basic' || skillsOf(id).length);
  const motionsOf = (id) => HERO_ATK[CLASSES[id].weapon] || HERO_ATK.sword;

  // 이 직업 스킬의 숙련도를 단계의 첫 레벨(1·10·20·30)에 맞춘다
  const STAGE_LV = [1, 10, 20, 30];
  function setStage(st) {
    T.stage = st;
    const lv = STAGE_LV[st];
    let exp = 0;
    for (let L = 1; L < lv; L++) exp += skillNeed(L);
    for (const k of skillsOf(T.cls)) S.mast[k.id] = exp;
    knight.ward = null;
  }
  function setClass(id) {
    T.cls = id;
    S.cls = id; S.level = 99; S.phase = 'test';
    setStage(T.stage);
    S.hp = stats().maxHp;
    casts = []; skfx = []; cutin = null; hitstop = 0; floaters = []; parts = []; effects = []; shots = [];
    Object.assign(knight, { x: toWorld(HERO_X), fighting: true, facing: 1, swing: -1, pending: false, cds: {}, ward: null, down: 0, combo: 0 });
    placeDummy();
    T.skill = skillsOf(id).length ? skillsOf(id)[0].id : null;
    T.wait = 0.4; T.basicDone = false;
    T.motion = null; T.atkT = 0.3; T.swings = 0; T.lastBasic = null;
    renderUi(); renderInfo();
  }
  function setMode(m) {
    T.mode = m;
    if (m === 'skill' && !skillsOf(T.cls).length) setClass('swordsman'); else setClass(T.cls);
  }

  // 정해진 스킬 하나만 준비 상태로 만들고 실제 원정 경로로 쓴다
  function cast(id) {
    const st = stats();
    for (const k of st.skills) knight.cds[k] = k === id ? 0 : 999;
    knight.swing = -1;
    const hp0 = dummy.hp;
    tryCastSkill(st, dummy);
    for (const k of st.skills) if (k !== id) knight.cds[k] = 0;
    T.last = { id, hp0 };
    renderInfo();
  }

  function nextSkill() {
    const list = skillsOf(T.cls).map((k) => k.id);
    const i = list.indexOf(T.skill);
    if (i < list.length - 1) { T.skill = list[i + 1]; return; }
    if (T.allCls) {
      const cl = testClasses();
      setClass(cl[(cl.indexOf(T.cls) + 1) % cl.length]);
      return;
    }
    T.skill = list[0];
  }

  // 평타만: 실제 원정과 같은 순서 — 공격 간격(1/공속)마다 휘두르기 시작, 타격 시점(근접 35%·활 45%)에 releaseAttack
  function basicTick(dt) {
    const st = stats();
    if (knight.pending && (knight.swing < 0 || knight.swing >= (st.kind === 'ranged' ? 0.45 : 0.35))) {
      knight.pending = false;
      releaseAttack(st);
    }
    T.atkT -= dt;
    if (T.atkT <= 0 && !knight.pending) {
      if (T.lastBasic) { T.lastBasic.dmg = T.lastBasic.hp0 - dummy.hp; }
      // 전 직업 순회면 연속기를 두 바퀴 보여 준 뒤 다음 직업으로
      if (T.allCls && T.auto && T.motion == null && T.swings >= motionsOf(T.cls).length * 2) {
        const cl = testClasses();
        setClass(cl[(cl.indexOf(T.cls) + 1) % cl.length]);
        return;
      }
      T.atkT = 1 / st.aspd;
      knight.swing = 0;
      knight.combo = T.motion != null ? T.motion : (knight.combo || 0) + 1;
      knight.pending = true;
      T.swings++;
      T.lastBasic = { hp0: dummy.hp, n: knight.combo % motionsOf(T.cls).length, prev: T.lastBasic && T.lastBasic.dmg };
      renderInfo(); renderUi();
    }
  }

  function tick(dt) {
    refillDummy();
    if (T.mode === 'basic') { if (T.auto) basicTick(dt); update(dt); return; }
    tickSkills(dt, stats());                // 성역 보호막도 원정처럼 흐른다 (지속 피해·끝날 때 성광 폭발)
    const busy = castOf('hero');
    if (!busy && T.last && T.last.dmg == null) {
      T.last.dmg = T.last.hp0 - dummy.hp;
      renderInfo();
    }
    if (!busy) {
      T.wait -= dt;
      if (T.basic && !T.basicDone && T.wait < GAP_SEC * 0.55) { knight.swing = 0; knight.combo = (knight.combo || 0) + 1; T.basicDone = true; }   // 평타 모션만 (피해 없음)
      if (T.wait <= 0 && T.auto) {
        cast(T.skill);
        T.wait = GAP_SEC; T.basicDone = false;
        // 단계 순회: 같은 스킬을 Lv1 → ★ → ★★ → ★★★ 로 보여 준 뒤 다음 스킬로
        if (T.stageCycle) { setStage((T.stage + 1) % 4); if (T.stage === 0) nextSkill(); }
        else nextSkill();
        renderUi();
      }
    }
    update(dt);
  }

  // ── 루프 ──
  let lastT = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!T.paused || T.stepOnce) {
      tick(T.stepOnce ? 1 / 60 : real * T.speed);
      T.stepOnce = false;
    }
    render();
  }

  // ── UI ──
  const $ = (id) => document.getElementById(id);
  function btn(label, on, fn, title = '') {
    const b = document.createElement('button');
    b.textContent = label; b.title = title;
    if (on) b.classList.add('on');
    b.onclick = fn;
    return b;
  }
  function renderUi() {
    $('modes').replaceChildren(
      btn('✨ 스킬', T.mode === 'skill', () => setMode('skill')),
      btn('🗡️ 평타만', T.mode === 'basic', () => setMode('basic')),
    );
    $('pickLabel').textContent = T.mode === 'basic' ? '동작' : '스킬';
    $('basic').style.display = T.mode === 'basic' ? 'none' : '';
    $('classes').replaceChildren(...testClasses().map((id) => {
      const c = CLASSES[id];
      return btn(`${c.icon} ${c.name}`, id === T.cls, () => setClass(id), `${c.tier}차`);
    }));
    if (T.mode === 'basic') {
      // 연속기: 번갈아(기본) 또는 한 동작만 고정
      const mo = motionsOf(T.cls), cur = T.lastBasic ? T.lastBasic.n : -1;
      $('skills').replaceChildren(
        btn('🔁 번갈아', T.motion == null, () => { T.motion = null; renderUi(); }),
        ...mo.map((_, i) => {
          const b = btn(`${i + 1}번 동작`, T.motion != null && T.motion % mo.length === i, () => { T.motion = i; T.atkT = Math.min(T.atkT, 0.15); renderUi(); });
          if (T.motion == null && i === cur) b.style.borderColor = 'rgba(255,177,59,.45)';     // 지금 나온 동작
          return b;
        }),
      );
    } else {
      $('skills').replaceChildren(...skillsOf(T.cls).map((k) => btn(`${k.icon} ${k.name}`, k.id === T.skill, () => {
        T.skill = k.id;
        if (!castOf('hero')) { cast(k.id); T.wait = GAP_SEC; T.basicDone = false; if (T.auto) nextSkill(); }
        renderUi();
      }, k.desc)));
    }
    $('stageRow').style.display = T.mode === 'basic' ? 'none' : '';
    $('stages').replaceChildren(
      ...['Lv1', '★ 숙련 Lv10', '★★ 달인 Lv20', '★★★ 극의 Lv30'].map((label, i) => btn(label, T.stage === i, () => { setStage(i); renderUi(); })),
      btn('🔁 단계 순회', T.stageCycle, () => { T.stageCycle = !T.stageCycle; if (T.stageCycle) { T.auto = true; setStage(0); } renderUi(); }, '같은 스킬을 Lv1 → ★ → ★★ → ★★★ 순서로'),
    );
    $('auto').classList.toggle('on', T.auto);
    $('allCls').classList.toggle('on', T.allCls);
    $('basic').classList.toggle('on', T.basic);
    $('pause').classList.toggle('on', T.paused);
    $('pause').textContent = T.paused ? '▶ 재생' : '⏸ 일시정지';
    $('speeds').replaceChildren(...[0.1, 0.25, 0.5, 1].map((v) => btn(`×${v}`, T.speed === v, () => { T.speed = v; renderUi(); })));
  }
  function renderInfo() {
    if (T.mode === 'basic') {
      const c = CLASSES[T.cls], w = WEAPONS[c.weapon], st = stats(), mo = motionsOf(T.cls), L = T.lastBasic;
      const per = st.atk * st.shots * st.shotMult;
      $('info').innerHTML = `<b>${c.icon} ${c.name} 평타</b> <small>${w.name} · ${c.tier ? c.tier + '차' : '기본'}</small>
        <div class="meta">공속 ${st.aspd.toFixed(2)}/초 (간격 ${(1 / st.aspd).toFixed(2)}초) · 사거리 ${st.range} · ${st.kind === 'ranged' ? `${st.shots}발 × ${st.shotMult}` : `최대 ${st.targets}마리`} · 한 번 피해 약 ${fmt(per)} · 치명 ${Math.round(st.crit * 100)}%</div>
        <div class="meta">연속기 ${mo.length}동작${L ? ` · 지금 ${L.n + 1}번 동작` : ''}${L && L.prev != null ? ` · 직전 평타 실제 피해 ${fmt(L.prev)}` : ''} · 친 횟수 ${T.swings}</div>`;
      return;
    }
    if (!T.last) { $('info').innerHTML = '스킬을 고르거나 자동 반복을 켜세요.'; return; }
    const lv = skillLv(T.last.id), k = skillAt(T.last.id, lv), c = CLASSES[k.cls];
    const hits = k.hits.length, mult = +(skillMult(k) * skillPow(k.id)).toFixed(2);
    const stageName = ['Lv1~9', '★ 숙련', '★★ 달인', '★★★ 극의'][masteryOf(lv)];
    const dmg = T.last.dmg != null ? ` · 실제 피해 ${fmt(T.last.dmg)} (공격력 ${fmt(stats().atk)})` : '';
    $('info').innerHTML = `<b>${k.icon} ${skillNameAt(k, lv)}</b> <small>${k.stageName ? `(${k.name}) · ` : ''}${c.icon} ${c.name} · ${c.tier}차</small>
      <div class="meta">숙련 <b>Lv ${lv}</b> ${stageName} · 쿨 ${skillCd(k.id)}초 · 시전 ${k.dur}초 · 배율 ×${mult}${hits > 1 ? ` (${hits}회)` : ''} · 범위 ${k.area}${k.radius ? ` ${k.radius}` : ''}${k.crit ? ' · 치명 확정' : ''}${k.ward ? ` · 보호막 ${k.ward.dur}초 회복 ${Math.round(k.ward.heal * 100)}%${k.ward.finish ? ' · 끝에 성광 폭발' : ''}` : ''}${dmg}</div>
      <div class="meta">${k.stageDesc ? k.stageDesc[masteryOf(lv)] : k.desc}</div>`;
  }
  $('auto').onclick = () => { T.auto = !T.auto; renderUi(); };
  $('allCls').onclick = () => { T.allCls = !T.allCls; if (T.allCls) T.auto = true; renderUi(); };
  $('basic').onclick = () => { T.basic = !T.basic; renderUi(); };
  $('pause').onclick = () => { T.paused = !T.paused; renderUi(); };
  $('step').onclick = () => { T.paused = true; T.stepOnce = true; renderUi(); };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); T.paused = !T.paused; renderUi(); }
    if (e.code === 'ArrowRight') { T.paused = true; T.stepOnce = true; renderUi(); }
  });

  // ── 시작 ──
  sizeStage();
  window.addEventListener('resize', sizeStage);
  setClass(T.cls);
  renderInfo();
  requestAnimationFrame(frame);
  // 콘솔·자동 캡처용: skillTest.state 상태, setClass(id), cast(skillId), step(초) 한 번에 진행 후 그리기
  window.skillTest = { state: T, setClass, setStage, cast, step: (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) tick(1 / 60); render(); } };
}
