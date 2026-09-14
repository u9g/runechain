// Rule tests for the [LOCKED] mechanics in the design doc.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = vm.createContext({ console, Math, Date });
for (const f of ['data.js', 'engine.js', 'ai.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js', f), 'utf8'), ctx, { filename: f });

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok  ${name}`); }
  catch (e) { fail++; console.log(`FAIL  ${name}\n      ${e.message}`); }
};
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} expected ${b}, got ${a}`); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };

const G = (code) => vm.runInContext(code, ctx);
G(`
  function fresh(passive) {
    const hero = Object.assign({}, HERO_BY_ID.vesk, passive ? { passive } : {});
    return new Player(hero, defaultLoadout(HERO_BY_ID.vesk), 12345);
  }
  // A board we fully control: one anchor at (0,0), its element everywhere.
  function rigged(spellId, passive) {
    const p = fresh(passive);
    const spell = SPELL_BY_ID[spellId];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      p.grid[r][c] = { el: spell.element, spellId: null, key: 1, fall: 0 };
    p.grid[0][0].spellId = spell.id;
    return p;
  }
`);

console.log('chain gesture');
t('drag must start on an anchor', () => {
  eq(G(`(() => { const p = rigged('ember_strike_1'); return p.beginDrag(2, 2); })()`), false);
  eq(G(`(() => { const p = rigged('ember_strike_1'); return p.beginDrag(0, 0); })()`), true);
});
t('adjacency is orthogonal only', () => {
  eq(G(`(() => { const p = rigged('ember_strike_1'); p.beginDrag(0,0); return p.extendDrag(1,1); })()`), false, 'diagonal');
  eq(G(`(() => { const p = rigged('ember_strike_1'); p.beginDrag(0,0); return p.extendDrag(0,1); })()`), true, 'orthogonal');
});
t('element must match the anchor', () => {
  eq(G(`(() => { const p = rigged('ember_strike_1'); p.grid[0][1].el = 'stone';
    p.beginDrag(0,0); return p.extendDrag(0,1); })()`), false);
});
t('a token cannot be revisited', () => {
  eq(G(`(() => { const p = rigged('ember_strike_1'); p.beginDrag(0,0);
    p.extendDrag(0,1); p.extendDrag(1,1); p.extendDrag(1,0); return p.extendDrag(0,0); })()`), false);
});
t('dragging back removes the last link', () => {
  eq(G(`(() => { const p = rigged('ember_strike_1'); p.beginDrag(0,0);
    p.extendDrag(0,1); p.extendDrag(0,2); p.extendDrag(0,1); return p.drag.path.length; })()`), 2);
});
t('chain caps at anchor + 7 (8 for Sabbat)', () => {
  eq(G(`(() => { const p = rigged('ember_strike_1'); p.beginDrag(0,0);
    let n = 0, r = 0, c = 0;
    const seq = [[0,1],[0,2],[0,3],[0,4],[1,4],[1,3],[1,2],[1,1],[1,0]];
    for (const [a,b] of seq) if (p.extendDrag(a,b)) n++;
    return n; })()`), 7);
  eq(G(`(() => { const p = rigged('ember_strike_1', 'longChain'); p.beginDrag(0,0);
    let n = 0;
    for (const [a,b] of [[0,1],[0,2],[0,3],[0,4],[1,4],[1,3],[1,2],[1,1],[1,0]]) if (p.extendDrag(a,b)) n++;
    return n; })()`), 8);
});
t('anchor alone does not cast', () => {
  eq(G(`(() => { const p = rigged('ember_strike_1'); p.beginDrag(0,0); return p.release(0); })()`), null);
});

console.log('power and timing');
t('effect scales 1 + 0.55(n-1) across every role', () => {
  for (const id of ['ember_strike_1', 'ember_ward_1', 'ember_mend_1']) {
    const [one, four] = G(`(() => { const p = rigged('${id}'); const s = SPELL_BY_ID['${id}'];
      return [p.effectFor(s,1), p.effectFor(s,4)]; })()`);
    ok(Math.abs(four / one - 2.65) < 0.01, `${id}: ratio ${(four / one).toFixed(3)}`);
  }
});
t('windup grows 0.05s per token', () => {
  // ward, so Vesk's short-strike haste does not confound the comparison
  const [a, b] = G(`(() => { const p = rigged('ember_ward_1'); const s = SPELL_BY_ID.ember_ward_1;
    return [p.castTimeFor(s,1), p.castTimeFor(s,5)]; })()`);
  eq(Math.round((b - a) * 100) / 100, 0.2);
});

console.log('resolution');
t('a ward present at impact absorbs first', () => {
  const r = G(`(() => { const a = fresh(), b = fresh(); const m = new Match(a, b, 1); m.countdown = 0;
    b.applyWard(300, 0);
    m.projectiles.push({ from: 0, to: 1, damage: 500, spell: SPELL_BY_ID.ember_strike_1, firedAt: 0, impactAt: 0.01 });
    m.update(0.02);
    return { hp: b.hp, ward: b.wardAmount(m.time) }; })()`);
  eq(r.hp, 2800 - 200, 'hp after absorb');
  eq(r.ward, 0);
});
t('wards do not stack; a smaller ward only refreshes', () => {
  const r = G(`(() => { const p = fresh(); p.applyWard(300, 0); p.applyWard(100, 1);
    return [p.ward.amount, p.ward.expires]; })()`);
  eq(r[0], 300); eq(r[1], 7);
});
t('a ward expires after 6s (9s for Morrow)', () => {
  eq(G(`(() => { const p = fresh(); p.applyWard(300, 0); return p.wardAmount(6.1); })()`), 0);
  eq(G(`(() => { const p = fresh('longWard'); p.applyWard(300, 0); return p.wardAmount(6.1); })()`), 300);
});
t('queue depth is 1: no release until the previous cast plus recovery', () => {
  const r = G(`(() => { const p = rigged('ember_strike_1');
    p.beginDrag(0,0); p.extendDrag(0,1); const c = p.release(0);
    const lockedAt = p.canRelease(c.endsAt + 0.1), freeAt = p.canRelease(c.endsAt + 0.25);
    return [lockedAt, freeAt]; })()`);
  eq(r[0], false); eq(r[1], true);
});
t('mend is instant on cast completion and clamps to max HP', () => {
  const hp = G(`(() => { const a = rigged('ember_mend_1'), b = fresh(); a.hp = 100;
    const m = new Match(a, b, 1); m.countdown = 0;
    a.beginDrag(0,0); a.extendDrag(0,1); a.release(0);
    for (let i = 0; i < 200; i++) m.update(1/60);
    return a.hp; })()`);
  ok(hp > 100 && hp <= 2800, `healed to ${hp}`);
});

console.log('ascension');
t('locked tiers never spawn as anchors', () => {
  ok(G(`(() => { const p = fresh();
    return p.liveSpellPool().every(s => s.tier === 'basic'); })()`), 'basic only at 0 charge');
  ok(G(`(() => { const p = fresh(); const fam = SPELL_BY_ID[p.loadout.basic[0]].family;
    p.charge[fam] = ASCENSION.elite;
    const s = p.liveSpellPool().find(x => x.family === fam);
    return s.tier === 'elite'; })()`), 'elite once charged');
});
t('charge is per family and counts tokens consumed', () => {
  const r = G(`(() => { const a = rigged('ember_strike_1'), b = fresh();
    const m = new Match(a, b, 1); m.countdown = 0;
    a.beginDrag(0,0); a.extendDrag(0,1); a.extendDrag(0,2); a.release(0);
    for (let i = 0; i < 100; i++) m.update(1/60);
    return a.charge; })()`);
  eq(r.ember_strike, 3);
  eq(Object.keys(r).length, 1);
});
t('board never carries more than 2 anchors of one family', () => {
  ok(G(`(() => { for (let i = 0; i < 200; i++) { const p = fresh();
      for (let k = 0; k < 40; k++) p.spawnAnchor(0);
      const count = {};
      for (const { r, c } of p.anchorCells()) { const f = SPELL_BY_ID[p.grid[r][c].spellId].family;
        count[f] = (count[f] || 0) + 1; if (count[f] > MAX_FAMILY_ANCHORS) return false; } }
    return true; })()`));
});

console.log('match flow');
t('overload chips both heroes after 90s', () => {
  ok(G(`(() => { const a = fresh(), b = fresh(); const m = new Match(a, b, 1); m.countdown = 0;
    m.time = 90; m.update(1/60); return a.hp < 2800 && b.hp < 2800; })()`));
});
t('the hard cap awards the win on HP percentage', () => {
  const r = G(`(() => { const a = fresh(), b = fresh(); const m = new Match(a, b, 1); m.countdown = 0;
    m.time = MATCH_CAP - 0.01; b.hp = 10; a.hp = 20; m.update(1/60); return m.over; })()`);
  eq(r.winner, 0); eq(r.reason, 'time');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
