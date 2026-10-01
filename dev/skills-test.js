'use strict';
// 스킬 모션 테스트 (개발용). 게임의 world.js · skills.js 를 그대로 쓰고, 이 파일은 무대만 꾸민다:
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
    const gap = st.kind === 'ranged' ? Math.min(260, st.range * 0.8) : st.range + 12;
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
    cls: 'swordsman', skill: null, auto: true, allCls: false, basic: true, paused: false, speed: 1, stepOnce: false,
    wait: 0.4, basicDone: false, last: null,
  };
  const testClasses = () => Object.keys(CLASSES).filter((id) => skillsOf(id).length);

  function setClass(id) {
    T.cls = id;
    S.cls = id; S.level = 99; S.phase = 'test';
    S.hp = stats().maxHp;
    casts = []; skfx = []; cutin = null; hitstop = 0; floaters = []; parts = []; effects = []; shots = [];
    Object.assign(knight, { x: toWorld(HERO_X), fighting: true, facing: 1, swing: -1, pending: false, cds: {}, ward: null, down: 0 });
    placeDummy();
    T.skill = skillsOf(id)[0].id;
    T.wait = 0.4; T.basicDone = false;
    renderUi();
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

  function tick(dt) {
    refillDummy();
    const busy = castOf('hero');
    if (!busy && T.last && T.last.dmg == null) {
      T.last.dmg = T.last.hp0 - dummy.hp;
      renderInfo();
    }
    if (!busy) {
      T.wait -= dt;
      if (T.basic && !T.basicDone && T.wait < GAP_SEC * 0.55) { knight.swing = 0; T.basicDone = true; }   // 평타 모션만 (피해 없음)
      if (T.wait <= 0 && T.auto) {
        cast(T.skill);
        T.wait = GAP_SEC; T.basicDone = false;
        nextSkill();
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
    $('classes').replaceChildren(...testClasses().map((id) => {
      const c = CLASSES[id];
      return btn(`${c.icon} ${c.name}`, id === T.cls, () => setClass(id), `${c.tier}차`);
    }));
    $('skills').replaceChildren(...skillsOf(T.cls).map((k) => btn(`${k.icon} ${k.name}`, k.id === T.skill, () => {
      T.skill = k.id;
      if (!castOf('hero')) { cast(k.id); T.wait = GAP_SEC; T.basicDone = false; if (T.auto) nextSkill(); }
      renderUi();
    }, k.desc)));
    $('auto').classList.toggle('on', T.auto);
    $('allCls').classList.toggle('on', T.allCls);
    $('basic').classList.toggle('on', T.basic);
    $('pause').classList.toggle('on', T.paused);
    $('pause').textContent = T.paused ? '▶ 재생' : '⏸ 일시정지';
    $('speeds').replaceChildren(...[0.1, 0.25, 0.5, 1].map((v) => btn(`×${v}`, T.speed === v, () => { T.speed = v; renderUi(); })));
  }
  function renderInfo() {
    if (!T.last) { $('info').innerHTML = '스킬을 고르거나 자동 반복을 켜세요.'; return; }
    const k = SKILLS[T.last.id], c = CLASSES[k.cls];
    const hits = k.hits.length, mult = +skillMult(k).toFixed(2);
    const dmg = T.last.dmg != null ? ` · 실제 피해 ${fmt(T.last.dmg)} (공격력 ${fmt(stats().atk)})` : '';
    $('info').innerHTML = `<b>${k.icon} ${k.name}</b> <small>${c.icon} ${c.name} · ${c.tier}차</small>
      <div class="meta">${k.lv ? `Lv ${k.lv}` : '전직 즉시'} · 쿨 ${k.cd}초 · 시전 ${k.dur}초 · 배율 ×${mult}${hits > 1 ? ` (${hits}회)` : ''} · 범위 ${k.area}${k.crit ? ' · 치명 확정' : ''}${dmg}</div>
      <div class="meta">${k.desc}</div>`;
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
  window.skillTest = { state: T, setClass, cast, step: (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) tick(1 / 60); render(); } };
}
