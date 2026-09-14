// RUNECHAIN battle simulation. Pure state + time; no rendering, no input.
const COLS = 5, ROWS = 6;
const CHAIN_POWER = 0.55;       // effect = base * (1 + 0.55 * (n - 1))
const WINDUP_PER_TOKEN = 0.05;
const PROJECTILE_FLIGHT = 0.50;
const CAST_RECOVERY = 0.20;
const WARD_DURATION = 6.0;
const CLUSTER_BIAS = 0.55;      // chance a refilled token copies a settled neighbour
const ELEMENT_CAP = 14;         // of 30 cells; past this, clustering stops feeding an element
const ANCHOR_ELEMENT_BIAS = 2; // refill weight added per live anchor of an element
const ANCHOR_TARGET = 5;        // live anchors on a 30-cell board
const MAX_FAMILY_ANCHORS = 2;
const OVERLOAD_START = 90;
const MATCH_CAP = 120;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Player {
  constructor(hero, loadout, seed) {
    this.hero = hero;
    this.loadout = loadout;
    this.rng = mulberry32(seed);
    this.maxHp = hero.baseHp;
    this.hp = hero.baseHp;
    this.ward = { amount: 0, expires: 0 };
    this.charge = {};
    this.cast = null;          // { spell, n, effect, startedAt, endsAt }
    this.lockUntil = 0;
    this.drag = null;          // { path: [{r,c}], spell }
    this.grid = [];
    this.nextKey = 1;
    this.flash = 0;            // damage flash, for render only
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) row.push(this.newToken(0));
      this.grid.push(row);
    }
    for (let i = 0; i < ANCHOR_TARGET; i++) this.spawnAnchor(0);
  }

  get maxChain() { return this.hero.passive === 'longChain' ? 8 : 7; }
  get wardDuration() { return this.hero.passive === 'longWard' ? 9 : WARD_DURATION; }

  newToken(fall, weights) {
    const els = this.hero.affinities;
    let el;
    if (weights) {
      const total = els.reduce((t, e) => t + weights[e], 0);
      let roll = this.rng() * total;
      el = els[els.length - 1];
      for (const e of els) { roll -= weights[e]; if (roll <= 0) { el = e; break; } }
    } else {
      el = els[Math.floor(this.rng() * els.length)];
    }
    return { el, spellId: null, key: this.nextKey++, fall };
  }

  // Refills favour the elements that currently have an anchor, and clump with
  // their neighbours. Unclustered refill leaves the longest chain at ~2 tokens,
  // which flattens the whole power curve.
  refillWeights() {
    const w = {};
    for (const el of this.hero.affinities) w[el] = 1;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = this.grid[r][c];
      if (cell && cell.spellId) w[cell.el] += ANCHOR_ELEMENT_BIAS;
    }
    return w;
  }

  // Highest ascension-unlocked tier of each loadout family, one entry per family.
  liveSpellPool() {
    const byFamily = {};
    for (const tier of TIERS) {
      for (const id of this.loadout[tier]) {
        const spell = SPELL_BY_ID[id];
        if ((this.charge[spell.family] || 0) < ASCENSION[tier]) continue;
        byFamily[spell.family] = spell;   // TIERS ascends, so the last write wins
      }
    }
    return Object.values(byFamily);
  }

  anchorCells() {
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      if (this.grid[r][c] && this.grid[r][c].spellId) out.push({ r, c });
    return out;
  }

  spawnAnchor(fall) {
    const anchors = this.anchorCells();
    if (anchors.length >= ANCHOR_TARGET + 1) return false;
    const familyCount = {};
    for (const { r, c } of anchors) {
      const f = SPELL_BY_ID[this.grid[r][c].spellId].family;
      familyCount[f] = (familyCount[f] || 0) + 1;
    }
    const pool = this.liveSpellPool().filter(s => (familyCount[s.family] || 0) < MAX_FAMILY_ANCHORS);
    if (!pool.length) return false;
    const spell = pool[Math.floor(this.rng() * pool.length)];

    const free = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (this.grid[r][c].spellId) continue;
      if (this.drag && this.drag.path.some(p => p.r === r && p.c === c)) continue;
      free.push({ r, c });
    }
    if (!free.length) return false;
    const { r, c } = free[Math.floor(this.rng() * free.length)];
    this.grid[r][c].spellId = spell.id;
    this.grid[r][c].el = spell.element;
    if (fall) this.grid[r][c].fall = fall;
    return true;
  }

  // ---- chain gesture ----------------------------------------------------
  canRelease(now) { return now >= this.lockUntil; }

  beginDrag(r, c) {
    const cell = this.grid[r][c];
    if (!cell.spellId) return false;
    this.drag = { path: [{ r, c }], spell: SPELL_BY_ID[cell.spellId] };
    return true;
  }

  extendDrag(r, c) {
    if (!this.drag) return false;
    const path = this.drag.path;
    if (path.length > 1) {
      const prev = path[path.length - 2];
      if (prev.r === r && prev.c === c) { path.pop(); return true; }   // backtrack
    }
    if (path.length >= this.maxChain + 1) return false;
    const last = path[path.length - 1];
    if (Math.abs(last.r - r) + Math.abs(last.c - c) !== 1) return false;
    if (path.some(p => p.r === r && p.c === c)) return false;
    const cell = this.grid[r][c];
    if (cell.spellId || cell.el !== this.drag.spell.element) return false;
    path.push({ r, c });
    return true;
  }

  cancelDrag() { this.drag = null; }

  castTimeFor(spell, n) {
    let t = spell.castTime + WINDUP_PER_TOKEN * n;
    if (this.hero.passive === 'smallStrikeHaste' && spell.role === 'strike' && n <= 3) t *= 0.85;
    if (this.hero.passive === 'desperation' && this.hp < this.maxHp * 0.35) t *= 0.8;
    return t;
  }

  effectFor(spell, n) {
    let e = spell.base * (1 + CHAIN_POWER * (n - 1)) * Math.pow(1.08, spell.rank - 1);
    if (this.hero.passive === 'mendBoost' && spell.role === 'mend') e *= 1.2;
    return Math.round(e);
  }

  // Returns the started cast, or null if the gesture was not castable.
  release(now) {
    const drag = this.drag;
    if (!drag) return null;
    const n = drag.path.length - 1;
    if (n < 1 || !this.canRelease(now)) { this.drag = null; return null; }
    this.drag = null;

    const spell = drag.spell;
    const castTime = this.castTimeFor(spell, n);
    this.cast = {
      spell, n,
      effect: this.effectFor(spell, n),
      tokens: n + 1,
      startedAt: now,
      endsAt: now + castTime,
    };
    this.lockUntil = this.cast.endsAt + CAST_RECOVERY;
    this.consume(drag.path);
    return this.cast;
  }

  consume(path) {
    for (const { r, c } of path) this.grid[r][c] = null;
    const weights = this.refillWeights();
    const counts = {};
    for (const el of this.hero.affinities) counts[el] = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      if (this.grid[r][c]) counts[this.grid[r][c].el]++;
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r][c]) {
          const cell = this.grid[r][c];
          if (write !== r) { cell.fall = write - r; this.grid[write][c] = cell; this.grid[r][c] = null; }
          write--;
        }
      }
      for (let r = write; r >= 0; r--) {
        const cell = this.newToken(write + 1, weights);
        const below = r + 1 < ROWS ? this.grid[r + 1][c] : null;
        const left = c > 0 ? this.grid[r][c - 1] : null;
        const seeds = [below, left].filter(t => t && !t.spellId && counts[t.el] < ELEMENT_CAP);
        if (seeds.length && this.rng() < CLUSTER_BIAS) cell.el = seeds[Math.floor(this.rng() * seeds.length)].el;
        counts[cell.el]++;
        this.grid[r][c] = cell;
      }
    }
    while (this.anchorCells().length < ANCHOR_TARGET) { if (!this.spawnAnchor(3)) break; }
  }

  addCharge(family, tokens) {
    const gain = this.hero.passive === 'fastAscend' ? tokens * 1.25 : tokens;
    this.charge[family] = (this.charge[family] || 0) + gain;
  }

  applyWard(amount, now) {
    const remaining = now < this.ward.expires ? this.ward.amount : 0;
    this.ward.amount = Math.max(remaining, amount);
    this.ward.expires = now + this.wardDuration;
  }

  wardAmount(now) { return now < this.ward.expires ? this.ward.amount : 0; }

  takeDamage(amount, now) {
    let left = amount;
    const ward = this.wardAmount(now);
    if (ward > 0) {
      const absorbed = Math.min(ward, left);
      this.ward.amount = ward - absorbed;
      left -= absorbed;
      if (this.ward.amount <= 0) this.ward.expires = 0;
    }
    this.hp = Math.max(0, this.hp - left);
    if (left > 0) this.flash = 1;
  }

  tickAnimation(dt) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = this.grid[r][c];
      if (cell && cell.fall > 0) cell.fall = Math.max(0, cell.fall - dt * 14);
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
  }
}

class Match {
  constructor(a, b, seed) {
    this.players = [a, b];
    this.time = 0;
    this.countdown = 3;
    this.projectiles = [];
    this.over = null;           // { winner, reason }
    this.events = [];           // transient, drained by the renderer
    this.rng = mulberry32(seed);
  }

  get running() { return this.countdown <= 0 && !this.over; }

  update(dt) {
    if (this.over) { for (const p of this.players) p.tickAnimation(dt); return; }
    if (this.countdown > 0) {
      this.countdown -= dt;
      for (const p of this.players) p.tickAnimation(dt);
      return;
    }
    this.time += dt;

    for (let i = 0; i < 2; i++) {
      const p = this.players[i];
      p.tickAnimation(dt);
      const cast = p.cast;
      if (cast && this.time >= cast.endsAt) {
        p.cast = null;
        p.addCharge(cast.spell.family, cast.tokens);
        if (cast.spell.role === 'strike') {
          this.projectiles.push({
            from: i, to: 1 - i, damage: cast.effect, spell: cast.spell,
            firedAt: this.time, impactAt: this.time + PROJECTILE_FLIGHT,
          });
        } else if (cast.spell.role === 'ward') {
          p.applyWard(cast.effect, this.time);
          this.events.push({ type: 'ward', player: i, amount: cast.effect });
        } else {
          p.hp = Math.min(p.maxHp, p.hp + cast.effect);
          this.events.push({ type: 'mend', player: i, amount: cast.effect });
        }
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (this.time >= pr.impactAt) {
        const target = this.players[pr.to];
        const absorbed = Math.min(target.wardAmount(this.time), pr.damage);
        target.takeDamage(pr.damage, this.time);
        this.events.push({ type: 'impact', player: pr.to, amount: pr.damage, absorbed });
        this.projectiles.splice(i, 1);
      }
    }

    if (this.time > OVERLOAD_START) {
      const rate = 0.02 + 0.005 * (this.time - OVERLOAD_START);
      for (const p of this.players) p.hp = Math.max(0, p.hp - p.maxHp * rate * dt);
    }

    const dead = this.players.map(p => p.hp <= 0);
    if (dead[0] || dead[1]) {
      this.over = { winner: dead[0] && dead[1] ? -1 : (dead[0] ? 1 : 0), reason: 'ko' };
    } else if (this.time >= MATCH_CAP) {
      const [x, y] = this.players.map(p => p.hp / p.maxHp);
      this.over = { winner: x === y ? -1 : (x > y ? 0 : 1), reason: 'time' };
    }
  }
}
