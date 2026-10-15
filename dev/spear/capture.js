'use strict';
// 창기사 계열 시트 작업용 캡처 (dev/skills.html 에서 불러 쓴다). 지금 게임의 조립식 그림을 1배(도트 1칸 = 1px)로 뽑는다.
//  쓰는 곳: 기준 그림(대기 한 장), 앉기 줄(기존 앉기 유지), 전후 비교 — 그리고 생성 전 시트 렌더러 연결 시험용 자리표시 프레임.
//  (스펙: 조립식 리그를 생성 밑그림으로 쓰지 않는다. 자리표시 프레임은 커밋하지 않는다)
//  await new Promise((ok) => { const s = document.createElement('script'); s.src = 'spear/capture.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
//  await spearCap('dragoon', 8896)   → 수신기(python -I dev/spear/recv.py dev/spear/shots 8896)에 <id>-<anim>-<i>.png (160×160, 발 (80,140))
window.spearCap = async function (id, port = 8896, opt = {}) {
  const save = async (name, pose) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 160;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.setTransform(2 / PX, 0, 0, 2 / PX, 80, 140);
    drawHero(g, id, 0, 0, { t: 0, walkT: 0, swing: -1, facing: 1, ...pose });
    await fetch(`http://127.0.0.1:${port}/save?name=${id}-${name}`, { method: 'POST', body: cv.toDataURL() });
  };
  const N = opt.n || 8, out = [];
  for (let i = 0; i < 4; i++) await save('idle-' + i, { mode: 'stand', t: i / 4 * (Math.PI * 2 / 2.6) });
  for (let i = 0; i < 4; i++) await save('guard-' + i, { mode: 'fight', t: i / 4 });
  for (let i = 0; i < N; i++) await save('walk-' + i, { mode: 'walk', walkT: i / N, t: i / N });
  for (const [k, combo] of [['atkA', 0], ['atkB', 1]]) for (let i = 0; i < N; i++) await save(`${k}-${i}`, { mode: 'fight', swing: (i + 0.5) / N, combo });
  // 시전: 무기 각도 wa 를 고르게 (0 = 앞 수평, −π/2 = 위, +π/2 = 아래, −π 근처 = 머리 뒤)
  const WA = opt.wa || [-3.0, -2.4, -1.57, -1.0, -0.5, 0, 0.6, 1.2];
  for (let i = 0; i < WA.length; i++) await save('cast-' + i, { mode: 'fight', wa: WA[i], wa2: -0.6, ext: WA[i] > -0.6 && WA[i] < 0.4 ? 1 : 0 });
  for (let i = 0; i < 2; i++) await save('sit-' + i, { mode: 'sit', t: i / 1.2 });
  out.push(id, 'cast wa', WA.join(' '));
  return out.join(' ');
};
