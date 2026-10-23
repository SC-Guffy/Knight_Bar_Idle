const f = process.argv[2], J = JSON.parse(require('fs').readFileSync(f, 'utf8'));
const med = (a) => { const b = a.filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
const keys = ['best', 'level', 'tier', 'bld', 'train', 'trainCap', 'enh', 'eqMin', 'skill', 't7', 'skills', 'runes', 'evoN', 'combo', 'mentor', 'castle', 'castleUp', 'raidTop', 'goldLog', 'wood', 'ore', 'stones', 'mana', 'tomes'];
console.log('day ' + keys.join(' '));
const D = Math.max(...J.res.map((r) => r.snaps.length));
let nan = 0;
for (let d = 0; d < D; d++) {
  const rows = J.res.map((r) => r.snaps[d]).filter(Boolean).map((s) => ({ ...s, eqMin: Math.min(...s.eq), evoN: s.evo ? s.evo.split(',').filter(Boolean).length : 0 }));
  for (const s of rows) for (const k of keys) if (typeof s[k] === 'number' && !isFinite(s[k])) nan++;
  console.log(String(d + 1).padStart(3) + ' ' + keys.map((k) => { const v = med(rows.map((s) => s[k])); return v == null ? '-' : (Math.abs(v) >= 1e5 ? v.toExponential(1) : (Math.round(v * 10) / 10)); }).join(' '));
}
console.log('NaN/Inf', nan);
// trips: wall stats
const tr = J.res.flatMap((r) => r.trips);
const byDay = {}; for (const t of tr) { const d = Math.floor(t.day); (byDay[d] = byDay[d] || { n: 0, zero: 0, wall: 0, bossFail: 0 }); byDay[d].n++; if (t.to <= t.from) byDay[d].zero++; if (t.wall) byDay[d].wall++; if (t.bossFail) byDay[d].bossFail++; }
console.log('day trips zeroGain% wall% bossFail%'); for (const [d, v] of Object.entries(byDay)) console.log(d, (v.n / J.res.length).toFixed(1), (100 * v.zero / v.n).toFixed(0), (100 * v.wall / v.n).toFixed(0), (100 * v.bossFail / v.n).toFixed(0));
const walls = {}; for (const t of tr) if (t.wall) walls[t.wall] = (walls[t.wall] || 0) + t.trips; console.log('walls', JSON.stringify(walls));
