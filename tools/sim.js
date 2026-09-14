// Headless balance probe: AI vs AI, no DOM. node tools/sim.js [matches]
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = vm.createContext({ console, Math, Date, performance: { now: () => Date.now() } });
for (const f of ['data.js', 'engine.js', 'ai.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js', f), 'utf8'), ctx, { filename: f });

const N = Number(process.argv[2] || 200);
const stats = { ko: 0, time: 0, len: [], tiers: {}, casts: [], chain: [] };
for (let i = 0; i < N; i++) {
  const ctxRun = vm.runInContext(`(() => {
    const hA = HEROES[Math.floor(Math.random()*HEROES.length)];
    const hB = HEROES[Math.floor(Math.random()*HEROES.length)];
    const a = new Player(hA, defaultLoadout(hA), (Math.random()*1e9)|0);
    const b = new Player(hB, defaultLoadout(hB), (Math.random()*1e9)|0);
    const m = new Match(a, b, (Math.random()*1e9)|0);
    const ais = [new AI(a, m, 0, 'normal'), new AI(b, m, 1, 'normal')];
    let casts = 0, chain = 0;
    const dt = 1/60;
    while (!m.over) {
      m.update(dt);
      for (const ai of ais) {
        const before = ai.p.cast;
        ai.update(dt, m.time);
        if (ai.p.cast && ai.p.cast !== before) { casts++; chain += ai.p.cast.n; }
      }
      if (m.time > 200) break;
    }
    const best = {};
    for (const p of m.players) for (const [f,c] of Object.entries(p.charge))
      best[f] = Math.max(best[f]||0, c);
    const top = Math.max(0, ...Object.values(best));
    return { reason: m.over ? m.over.reason : 'hang', time: m.time, casts, chain,
             tier: top >= ASCENSION.ultimate ? 'ultimate' : top >= ASCENSION.elite ? 'elite' : top >= ASCENSION.advanced ? 'advanced' : 'basic' };
  })()`, ctx);
  stats[ctxRun.reason] = (stats[ctxRun.reason] || 0) + 1;
  stats.len.push(ctxRun.time);
  stats.casts.push(ctxRun.casts);
  stats.chain.push(ctxRun.chain / Math.max(1, ctxRun.casts));
  stats.tiers[ctxRun.tier] = (stats.tiers[ctxRun.tier] || 0) + 1;
}
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length);
const pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * q)];
console.log(`matches        ${N}`);
console.log(`ko / time cap  ${stats.ko || 0} / ${stats.time || 0}${stats.hang ? ' / hang ' + stats.hang : ''}`);
console.log(`length  avg    ${avg(stats.len).toFixed(1)}s   p10 ${pct(stats.len, .1).toFixed(1)}  p90 ${pct(stats.len, .9).toFixed(1)}`);
console.log(`casts   avg    ${avg(stats.casts).toFixed(1)}  (both players)`);
console.log(`chain   avg    ${avg(stats.chain).toFixed(2)} tokens`);
console.log(`highest tier   ${JSON.stringify(stats.tiers)}`);
