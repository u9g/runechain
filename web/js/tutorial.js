// Scripted first duel. Runs on the real engine against a passive construct:
// the board is rigged per step and input is gated to the lesson being taught.
const DUMMY = {
  id: 'effigy', name: 'Effigy', title: 'the training construct',
  affinities: ['stone', 'tide', 'bloom'], baseHp: 9999,
  passive: 'none', passiveText: '',
};

const RIG_LEGEND = { e: 'ember', s: 'stone', a: 'aether', t: 'tide', b: 'bloom' };

// Boards are written out so the lesson always has the chain it needs.
const RIG_STRIKE = ['sasas', 'asasa', 'Xeeee', 'asase', 'sasae', 'asasa'];
const RIG_WARD   = ['aeaea', 'eaeae', 'aeaea', 'Wssss', 'aeaes', 'eaeas'];
const RIG_FOE    = ['Pssss', 'tbtbt', 'btbtb', 'tbtbt', 'btbtb', 'tbtbt'];

const TUTORIAL_STEPS = [
  {
    id: 'board', focus: 'board', advance: 'tap',
    title: 'This is your board',
    body: 'Five elements, each with its own colour and its own rune — Ember, Tide, Stone, Bloom, Aether. You read the rune, not just the colour.',
  },
  {
    id: 'anchor', focus: ['board', 'selfBar'], advance: 'gate', allowSpell: 'ember_strike_1',
    title: 'Gold frames are spell anchors',
    body: 'An anchor is a spell sitting on your board. Touch the framed Ember tile and hold.',
    rig: RIG_STRIKE,
    check: (t) => t.me.drag && t.me.drag.path.length >= 1,
  },
  {
    id: 'drag', focus: ['board', 'selfBar'], advance: 'gate', allowSpell: 'ember_strike_1',
    title: 'Drag to link its element',
    body: 'Keep your finger down and drag through touching Ember runes. Watch the readout above the board name the spell and its power as the chain grows.',
    check: (t) => t.me.drag && t.me.drag.path.length >= 4,
    keep: true,
  },
  {
    id: 'release', focus: ['board', 'selfBar'], advance: 'gate', allowSpell: 'ember_strike_1',
    title: 'Lift your finger to cast',
    body: 'The anchor chose which spell. The chain chose how strong. One gesture, two decisions.',
    check: (t) => t.castsMade >= 1,
    keep: true,
  },
  {
    id: 'power', focus: 'board', advance: 'gate', allowSpell: 'ember_strike_1',
    title: 'Longer chains hit harder',
    body: 'Every extra rune adds power — and adds windup. Cast a chain of five or more this time.',
    rig: RIG_STRIKE,
    check: (t) => t.lastChain >= 5,
  },
  {
    id: 'mirror', focus: 'mirror', advance: 'script',
    title: 'Their board is never hidden',
    body: 'Top left is a live copy of your opponent’s board. Watch — the construct is drawing a chain right now, and you can count the runes it links before it casts.',
  },
  {
    id: 'ward', focus: ['board', 'selfBar'], advance: 'gate', allowSpell: 'stone_ward_1',
    title: 'A ward only has to exist on impact',
    body: 'That strike is coming. Chain the framed Stone tile and cast your ward before it lands — defence is allowed to be late, but not too late. The construct will keep striking until you absorb one.',
    rig: RIG_WARD,
    check: (t) => t.wardBlocked,
  },
  {
    id: 'ascension', focus: 'selfBar', advance: 'tap',
    title: 'Casting unlocks stronger tiers',
    body: 'Every cast charges that spell’s line, shown under your health. Charge a line enough and its Advanced, Elite and Ultimate tiers start appearing as anchors — and you can watch their lines charge too.',
  },
  {
    id: 'done', focus: null, advance: 'end',
    title: 'You are ready',
    body: 'Touch an anchor, drag for power, read their board, ward before impact. Everything else is a variation on those four.',
  },
];

class Tutorial {
  constructor(match, me, foe) {
    this.match = match;
    this.me = me;
    this.foe = foe;
    this.index = 0;
    this.castsMade = 0;
    this.lastChain = 0;
    this.wardCast = false;
    this.wardBlocked = false;
    this.script = null;
    this.holdFor = 0;
    this.finished = false;
    this.enter();
  }

  get step() { return TUTORIAL_STEPS[this.index]; }

  rig(player, rows, legend) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = rows[r][c];
      const spellId = legend[ch];
      const el = spellId ? SPELL_BY_ID[spellId].element : RIG_LEGEND[ch];
      player.grid[r][c] = { el, spellId: spellId || null, key: player.nextKey++, fall: 0 };
    }
  }

  enter() {
    const step = this.step;
    this.holdFor = 0;
    if (step.rig) {
      const legend = step.id === 'ward' ? { W: 'stone_ward_1' } : { X: 'ember_strike_1' };
      this.rig(this.me, step.rig, legend);
      this.me.drag = null;
    }
    if (step.id === 'mirror') {
      this.rig(this.foe, RIG_FOE, { P: 'stone_strike_1' });
      this.startStrike();
    }
  }

  /** The construct winds up a visible strike. Repeats until the player blocks. */
  startStrike() {
    this.rig(this.foe, RIG_FOE, { P: 'stone_strike_2' });
    this.foe.drag = null;
    this.script = {
      phase: 'reveal', t: 0, step: 0,
      path: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }, { r: 0, c: 4 }],
    };
  }

  onEvent(ev) {
    if (ev.type === 'impact' && ev.player === 0 && ev.absorbed > 0) this.wardBlocked = true;
  }

  /** Cells the player may touch right now; null means anywhere. */
  allowedCells() {
    const step = this.step;
    if (!step.allowSpell) return null;
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = this.me.grid[r][c];
      if (cell && cell.spellId === step.allowSpell) cells.push({ r, c });
    }
    return cells;
  }

  canStartAt(r, c) {
    const allowed = this.allowedCells();
    return !allowed || allowed.some(p => p.r === r && p.c === c);
  }

  onCast(cast) {
    this.castsMade++;
    this.lastChain = cast.n;
    if (cast.spell.role === 'ward') this.wardCast = true;
  }

  advance() {
    if (this.index < TUTORIAL_STEPS.length - 1) { this.index++; this.enter(); }
    else this.finished = true;
  }

  update(dt, now) {
    const step = this.step;

    if (this.script) this.runScript(dt, now);

    if (this.holdFor > 0) {
      this.holdFor -= dt;
      if (this.holdFor <= 0) this.advance();
      return;
    }
    if (step.advance === 'gate' && step.check(this)) {
      // let the cast or the highlight land before moving on
      this.holdFor = step.id === 'release' || step.id === 'power' ? 1.1 : 0.35;
    }
    // hand over to the ward lesson as soon as the chain is fully drawn, so the
    // player still has the windup and the flight to answer it
    if (step.advance === 'script' && this.script && this.script.step >= this.script.path.length) {
      this.advance();
    }
  }

  /** The construct draws its chain slowly, then casts: the read, in slow motion. */
  runScript(dt, now) {
    const s = this.script;
    s.t += dt;
    if (s.phase === 'reveal') {
      const per = 0.5;
      while (s.step < s.path.length && s.t > per * s.step) {
        const cell = s.path[s.step];
        s.step === 0 ? this.foe.beginDrag(cell.r, cell.c) : this.foe.extendDrag(cell.r, cell.c);
        s.step++;
      }
      if (s.step >= s.path.length && s.t > per * s.path.length + 0.6) {
        this.foe.release(now);
        s.phase = 'flight';
        s.t = 0;
      }
      return;
    }
    if (s.phase === 'flight') {
      const busy = this.foe.cast || this.match.projectiles.some(p => p.to === 0);
      if (!busy) { s.phase = 'cooldown'; s.t = 0; }
      return;
    }
    if (s.phase === 'cooldown' && s.t > 1.3) {
      if (this.step.id === 'ward' && !this.wardBlocked) {
        // another pass: the lesson is not over until a ward actually absorbs one
        this.me.hp = this.me.maxHp;
        this.rig(this.me, RIG_WARD, { W: 'stone_ward_1' });
        this.me.drag = null;
        this.startStrike();
      } else {
        this.script = null;
      }
    }
  }
}
