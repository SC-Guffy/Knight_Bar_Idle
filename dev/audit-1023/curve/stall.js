const J = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
// hours spent at each best stage bucket (time between trips where best stays same) — measure via snaps per day is coarse; use trips: stall stage = to when to<=from
const st = {}; let tot = 0;
for (const r of J.res) { let prevDay = 0; for (const t of r.trips) { if (t.to <= t.from) { const k = Math.floor(t.to / 10) * 10; st[k] = (st[k] || 0) + t.dur / 3600; } tot += t.dur / 3600; } }
const arr = Object.entries(st).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('stall hours per seed by stage bucket (to, 0-gain trips):'); for (const [k, v] of arr) console.log(k, (v / J.res.length).toFixed(1));
// first reach time of stage milestones
const ms = [100, 150, 200, 240, 260, 280, 300, 320, 340];
const med = (a) => { const b = a.sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
console.log('reach day median:', ms.map((m) => m + ':' + (() => { const v = J.res.map((r) => { const s = r.snaps.find((x) => x.best >= m); return s ? s.day : 99; }); return med(v); })()).join(' '));
