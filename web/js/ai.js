// Local opponent. Its chain is revealed progressively so the mirror is readable
// (spec 7: an AI that casts instantly is testing a different game).
const DIFFICULTY = {
  easy:   { think: [0.9, 1.6], reveal: [0.45, 0.65], wardSkill: 0.35, greed: 0.5 },
  normal: { think: [0.5, 1.0], reveal: [0.35, 0.55], wardSkill: 0.7,  greed: 0.75 },
  hard:   { think: [0.25, 0.6], reveal: [0.3, 0.45], wardSkill: 0.95, greed: 0.9 },
};

class AI {
  constructor(player, match, index, difficulty = 'normal') {
    this.p = player;
    this.match = match;
    this.index = index;
    this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.state = 'idle';
    this.timer = this.rand(this.cfg.think);
    this.plan = null;
    this.revealStep = 0;
  }

  rand([lo, hi]) { return lo + Math.random() * (hi - lo); }

  update(dt, now) {
    if (!this.match.running) return;
    if (this.state === 'idle') {
      this.timer -= dt;
      if (this.timer <= 0) this.think(now);
      return;
    }
    this.timer -= dt;
    if (this.state === 'revealing') {
      if (this.timer <= 0 && this.revealStep < this.plan.path.length) {
        const cell = this.plan.path[this.revealStep];
        const ok = this.revealStep === 0 ? this.p.beginDrag(cell.r, cell.c) : this.p.extendDrag(cell.r, cell.c);
        if (!ok) { this.abort(); return; }
        this.revealStep++;
        this.timer = this.plan.stepTime;
        if (this.revealStep >= this.plan.path.length) this.state = 'committed';
      }
      return;
    }
    if (this.state === 'committed' && this.p.canRelease(now)) {
      this.p.release(now);
      this.state = 'idle';
      this.timer = this.rand(this.cfg.think);
      this.plan = null;
    }
  }

  abort() {
    this.p.cancelDrag();
    this.state = 'idle';
    this.timer = this.rand(this.cfg.think);
    this.plan = null;
  }

  // Longest chain reachable from each anchor, via depth-first search.
  chains() {
    const out = [];
    for (const { r, c } of this.p.anchorCells()) {
      const spell = SPELL_BY_ID[this.p.grid[r][c].spellId];
      let best = [{ r, c }];
      const seen = new Set([r * COLS + c]);
      const walk = (path) => {
        if (path.length > best.length) best = path.slice();
        if (path.length >= this.p.maxChain + 1) return;
        const last = path[path.length - 1];
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = last.r + dr, nc = last.c + dc;
          if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
          const key = nr * COLS + nc;
          if (seen.has(key)) continue;
          const cell = this.p.grid[nr][nc];
          if (cell.spellId || cell.el !== spell.element) continue;
          seen.add(key);
          path.push({ r: nr, c: nc });
          walk(path);
          path.pop();
          seen.delete(key);
        }
      };
      walk([{ r, c }]);
      if (best.length > 1) out.push({ spell, path: best });
    }
    return out;
  }

  incomingThreat(now) {
    let threat = 0;
    for (const pr of this.match.projectiles) if (pr.to === this.index) threat += pr.damage;
    const foe = this.match.players[1 - this.index];
    if (foe.cast && foe.cast.spell.role === 'strike') threat += foe.cast.effect;
    return threat;
  }

  think(now) {
    const options = this.chains();
    if (!options.length) { this.timer = 0.2; return; }

    const threat = this.incomingThreat(now);
    const wardNow = this.p.wardAmount(now);
    const lowHp = this.p.hp < this.p.maxHp * 0.45;
    let want = 'strike';
    if (lowHp && Math.random() < 0.8) want = 'mend';
    else if (threat - wardNow > this.p.maxHp * 0.1 && Math.random() < this.cfg.wardSkill) want = 'ward';

    let pool = options.filter(o => o.spell.role === want);
    if (!pool.length) pool = options;

    // Greedy players take the long chain; cautious ones trade power for speed.
    const score = (o) => {
      const n = o.path.length - 1;
      const effect = this.p.effectFor(o.spell, n);
      const time = this.p.castTimeFor(o.spell, n);
      return effect / Math.pow(time, 1 + (1 - this.cfg.greed));
    };
    let chosen = pool[0];
    for (const o of pool) if (score(o) > score(chosen)) chosen = o;

    // Under fire, shorten the chain so the cast lands before impact.
    if (want === 'ward' && threat > 0) {
      const soonest = Math.min(...this.match.projectiles.filter(p => p.to === this.index).map(p => p.impactAt - now).concat([9]));
      while (chosen.path.length > 2 && this.p.castTimeFor(chosen.spell, chosen.path.length - 1) > soonest) chosen.path.pop();
    }

    const total = this.rand(this.cfg.reveal);
    this.plan = { path: chosen.path, stepTime: total / chosen.path.length };
    this.revealStep = 0;
    this.state = 'revealing';
    this.timer = 0;
  }
}
