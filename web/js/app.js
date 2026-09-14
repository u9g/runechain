// Screens, input and the frame loop.
const $ = (sel) => document.querySelector(sel);
const STORE = 'runechain.save';

const state = {
  heroId: 'vesk',
  difficulty: 'normal',
  tutorialDone: false,
  mode: 'duel',
  tutorial: null,
  loadouts: {},
  match: null,
  ai: null,
  renderer: null,
  raf: 0,
  last: 0,
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || '{}');
    Object.assign(state, {
      heroId: s.heroId || state.heroId,
      difficulty: s.difficulty || state.difficulty,
      tutorialDone: !!s.tutorialDone,
      loadouts: s.loadouts || {},
    });
  } catch (e) { /* first run */ }
}
function save() {
  localStorage.setItem(STORE, JSON.stringify({
    heroId: state.heroId, difficulty: state.difficulty,
    tutorialDone: state.tutorialDone, loadouts: state.loadouts,
  }));
}
function loadoutFor(hero) {
  if (!state.loadouts[hero.id]) state.loadouts[hero.id] = defaultLoadout(hero);
  return state.loadouts[hero.id];
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
}

// ---- glyphs ---------------------------------------------------------------
function glyphCanvas(size, draw) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = `${size}px`;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(size / 2, size / 2);
  draw(ctx, size / 2 - 1);
  return c;
}
const runeIcon = (element, size = 13) => glyphCanvas(size, (ctx, r) => {
  ctx.strokeStyle = ELEMENTS[element].light;
  ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
  RUNES[element](ctx, r * 0.85); ctx.stroke();
});
const roleIcon = (role, size = 11, color = THEME.goldLit) => glyphCanvas(size, (ctx, r) => {
  ctx.fillStyle = color;
  ROLE_MARKS[role](ctx, r * 0.8); ctx.fill();
});

// ---- home -----------------------------------------------------------------
function renderHome() {
  const list = $('#heroList');
  list.innerHTML = '';
  for (const hero of HEROES) {
    const el = document.createElement('button');
    el.className = 'hero' + (hero.id === state.heroId ? ' sel' : '');

    const top = document.createElement('div');
    top.className = 'heroTop';
    top.innerHTML = `<span class="heroName">${hero.name}</span><span class="heroTitle">${hero.title}</span>`;
    el.appendChild(top);

    const chips = document.createElement('div');
    chips.className = 'affinities';
    for (const a of hero.affinities) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.appendChild(runeIcon(a));
      chip.appendChild(document.createTextNode(ELEMENTS[a].name));
      chips.appendChild(chip);
    }
    el.appendChild(chips);

    const passive = document.createElement('div');
    passive.className = 'heroPassive';
    passive.innerHTML = `<b>Passive</b> · ${hero.passiveText}`;
    el.appendChild(passive);

    el.onclick = () => { state.heroId = hero.id; save(); renderHome(); };
    list.appendChild(el);
  }
  for (const b of document.querySelectorAll('#diffRow button'))
    b.classList.toggle('sel', b.dataset.diff === state.difficulty);
}

// ---- loadout --------------------------------------------------------------
const TIER_NOTE = {
  basic: 'Available from the opening bell.',
  advanced: `Anchors appear once that line reaches ${ASCENSION.advanced} charge.`,
  elite: `Anchors appear at ${ASCENSION.elite} charge on that line.`,
  ultimate: `Anchors appear at ${ASCENSION.ultimate} charge — one line, committed to.`,
};

function renderLoadout() {
  const hero = HERO_BY_ID[state.heroId];
  const lo = loadoutFor(hero);
  const root = $('#loadoutBody');
  root.innerHTML = '';
  $('#loadoutHero').textContent = `${hero.name}, ${hero.title}`;

  for (const tier of TIERS) {
    const sec = document.createElement('div');
    sec.className = 'tierSec';
    const head = document.createElement('div');
    head.className = 'tierHead';
    head.innerHTML = `<span>${TIER_LABEL[tier]}</span><span class="count">${lo[tier].length} of 4</span>`;
    sec.appendChild(head);
    const note = document.createElement('div');
    note.className = 'tierNote';
    note.textContent = TIER_NOTE[tier];
    sec.appendChild(note);

    const grid = document.createElement('div');
    grid.className = 'spellGrid';
    for (const spell of spellsFor(hero, tier)) {
      const on = lo[tier].includes(spell.id);
      const b = document.createElement('button');
      b.className = 'spell' + (on ? ' on' : '');
      b.style.setProperty('--el', ELEMENTS[spell.element].color);

      const glyphs = document.createElement('div');
      glyphs.className = 'glyphs';
      glyphs.appendChild(runeIcon(spell.element, 14));
      glyphs.appendChild(roleIcon(spell.role, 11, ELEMENTS[spell.element].light));
      const role = document.createElement('span');
      role.className = 'sRole';
      role.textContent = `${ELEMENTS[spell.element].name} ${spell.role}`;
      glyphs.appendChild(role);
      b.appendChild(glyphs);

      const name = document.createElement('span');
      name.className = 'sName';
      name.textContent = spell.name;
      b.appendChild(name);

      const meta = document.createElement('span');
      meta.className = 'sMeta';
      meta.textContent = `${spell.base} ${ROLE_VERB[spell.role]} · ${spell.castTime.toFixed(2)}s cast`;
      b.appendChild(meta);

      b.onclick = () => { toggleSpell(lo, tier, spell); save(); renderLoadout(); };
      grid.appendChild(b);
    }
    sec.appendChild(grid);
    root.appendChild(sec);
  }
  const warn = validateLoadout(lo);
  $('#loadoutWarn').textContent = warn || '';
  $('#loadoutWarn').classList.toggle('show', !!warn);
}

function toggleSpell(lo, tier, spell) {
  const arr = lo[tier];
  const i = arr.indexOf(spell.id);
  if (i >= 0) arr.splice(i, 1);
  else { if (arr.length >= 4) arr.shift(); arr.push(spell.id); }
}

function validateLoadout(lo) {
  for (const tier of TIERS) if (lo[tier].length !== 4) return `Pick exactly four ${tier} spells — you have ${lo[tier].length}.`;
  const roles = lo.basic.map(id => SPELL_BY_ID[id].role);
  if (!roles.includes('ward')) return 'Your Basic four need at least one ward, or you will have no answer to an opening strike.';
  if (!roles.includes('mend')) return 'Your Basic four need at least one mend, or you can never take a hit back.';
  return '';
}

// ---- battle ---------------------------------------------------------------
function prepare(me, foe, seed) {
  state.match = new Match(me, foe, seed);
  show('battle');
  if (!state.renderer) state.renderer = new Renderer($('#gameCanvas'));
  state.renderer.resize();
  state.renderer.floaters.length = 0;
  state.renderer.focus = null;
  state.renderer.hints = null;
  $('#battleOverlay').classList.remove('show');
  state.last = performance.now();
  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(frame);
}

function startTutorial() {
  const hero = HERO_BY_ID.vesk;
  const lo = defaultLoadout(hero);
  const me = new Player(hero, lo, 7);
  const foe = new Player(DUMMY, defaultLoadout(DUMMY), 11);
  foe.maxHp = foe.hp = DUMMY.baseHp;
  state.mode = 'tutorial';
  state.ai = null;
  prepare(me, foe, 7);
  state.match.countdown = 0;
  state.tutorial = new Tutorial(state.match, me, foe);
  $('#coach').classList.add('show');
  renderCoach(true);
}

function startBattle() {
  state.mode = 'duel';
  state.tutorial = null;
  $('#coach').classList.remove('show');
  const hero = HERO_BY_ID[state.heroId];
  const lo = loadoutFor(hero);
  const warn = validateLoadout(lo);
  if (warn) { show('loadout'); renderLoadout(); return; }

  const others = HEROES.filter(h => h.id !== hero.id);
  const foeHero = others[Math.floor(Math.random() * others.length)];
  const foeLoadout = defaultLoadout(foeHero);
  const seed = Date.now() & 0xffffffff;
  const me = new Player(hero, lo, seed);
  const foe = new Player(foeHero, foeLoadout, seed ^ 0x9e3779b9);
  prepare(me, foe, seed);
  state.ai = new AI(foe, state.match, 1, state.difficulty);
}

// ---- tutorial coaching ----------------------------------------------------
function renderCoach(force) {
  const t = state.tutorial;
  if (!t) return;
  if (t.finished) { finishTutorial(); return; }
  const step = t.step;
  if (!force && state.coachStep === step.id) return;
  state.coachStep = step.id;

  $('#coachStep').textContent = `Step ${t.index + 1} of ${TUTORIAL_STEPS.length}`;
  $('#coachTitle').textContent = step.title;
  $('#coachBody').textContent = step.body;
  const gated = step.advance === 'gate' || step.advance === 'script';
  $('#coachNext').style.display = gated ? 'none' : 'block';
  $('#coachNext').textContent = step.advance === 'end' ? 'Finish' : 'Next';
  $('#coachDo').style.display = gated ? 'block' : 'none';
  $('#coachDo').textContent = step.advance === 'script' ? 'Watch their board' : 'Your turn';
  $('#coach').classList.toggle('top', step.focus === 'board' || step.focus === 'selfBar');
}

function finishTutorial() {
  state.tutorialDone = true;
  save();
  $('#coach').classList.remove('show');
  cancelAnimationFrame(state.raf);
  state.mode = 'duel';
  state.tutorial = null;
  renderHome();
  show('home');
}

function frame(now) {
  const dt = Math.min(0.05, (now - state.last) / 1000);
  state.last = now;
  const m = state.match;
  m.update(dt);
  if (state.tutorial) {
    state.tutorial.update(dt, m.time);
    state.renderer.focus = state.tutorial.step.focus;
    state.renderer.hints = state.tutorial.allowedCells();
    renderCoach(false);
  } else {
    state.ai.update(dt, m.time);
  }
  drainEvents(m);
  state.renderer.draw(m, m.players[0], m.players[1], dt);
  if (m.over && !state.tutorial) {
    $('#battleOverlay').classList.add('show');
    return;
  }
  state.raf = requestAnimationFrame(frame);
}

function drainEvents(m) {
  const r = state.renderer, lay = r.layout;
  for (const ev of m.events) {
    if (state.tutorial) state.tutorial.onEvent(ev);
    const mine = ev.player === 0;
    const box = mine ? lay.selfBar : lay.oppBar;
    const x = box.x + box.w * 0.5, y = box.y - 6;
    if (ev.type === 'impact') {
      const net = ev.amount - ev.absorbed;
      r.addFloater(net > 0 ? `-${Math.round(net)}` : `blocked`, x, y, net > 0 ? '#ff6b7c' : '#78d7ff');
      if (mine && net > 0) haptic(30);
    } else if (ev.type === 'ward') {
      r.addFloater(`+${ev.amount} ward`, x, y, '#78d7ff');
    } else if (ev.type === 'mend') {
      r.addFloater(`+${ev.amount}`, x, y, '#63e08a');
    }
  }
  m.events.length = 0;
}

const nativeHaptic = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haptic;
// The iOS wrapper calls this: inside a WKWebView that ignores the safe area,
// env(safe-area-inset-*) reports zero, so the native side hands us the truth.
window.setSafeInsets = (top, bottom) => {
  const probe = $('#safeProbe');
  probe.style.paddingTop = `${top}px`;
  probe.style.paddingBottom = `${bottom}px`;
  document.documentElement.style.setProperty('--sat', `${top}px`);
  document.documentElement.style.setProperty('--sab', `${bottom}px`);
  if (state.renderer) state.renderer.resize();
};

function haptic(ms) {
  if (nativeHaptic) nativeHaptic.postMessage(ms);
  else if (navigator.vibrate) navigator.vibrate(ms);
}

// ---- input ----------------------------------------------------------------
function bindInput(canvas) {
  const me = () => state.match && state.match.players[0];
  let active = false;

  const pos = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    const p = me();
    if (!p || (!state.match.running && !state.tutorial)) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pos(e);
    const cell = state.renderer.cellAt(x, y);
    if (!cell) return;
    if (state.tutorial && !state.tutorial.canStartAt(cell.r, cell.c)) return;
    if (p.beginDrag(cell.r, cell.c)) { active = true; haptic(8); }
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    e.preventDefault();
    const p = me();
    const { x, y } = pos(e);
    const cell = state.renderer.cellAt(x, y);
    if (cell && p.extendDrag(cell.r, cell.c)) haptic(6);
  }, { passive: false });

  const end = (e) => {
    if (!active) return;
    active = false;
    e.preventDefault();
    const p = me();
    const cast = p.release(state.match.time);
    if (cast) {
      haptic(18);
      if (state.tutorial) state.tutorial.onCast(cast);
    }
  };
  canvas.addEventListener('pointerup', end, { passive: false });
  canvas.addEventListener('pointercancel', () => { active = false; const p = me(); if (p) p.cancelDrag(); });
}

// ---- boot -----------------------------------------------------------------
function boot() {
  load();
  renderHome();
  show('home');
  $('#playBtn').onclick = startBattle;
  $('#tutorialBtn').onclick = startTutorial;
  $('#coachNext').onclick = () => { state.tutorial && state.tutorial.advance(); renderCoach(true); };
  $('#coachSkip').onclick = finishTutorial;
  $('#loadoutBtn').onclick = () => { renderLoadout(); show('loadout'); };
  $('#loadoutBack').onclick = () => { renderHome(); show('home'); };
  $('#loadoutReset').onclick = () => { state.loadouts[state.heroId] = defaultLoadout(HERO_BY_ID[state.heroId]); save(); renderLoadout(); };
  $('#againBtn').onclick = startBattle;
  $('#homeBtn').onclick = () => { cancelAnimationFrame(state.raf); renderHome(); show('home'); };
  $('#quitBtn').onclick = () => {
    if (state.tutorial) { finishTutorial(); return; }
    cancelAnimationFrame(state.raf); renderHome(); show('home');
  };
  for (const b of document.querySelectorAll('#diffRow button'))
    b.onclick = () => { state.difficulty = b.dataset.diff; save(); renderHome(); };
  bindInput($('#gameCanvas'));
  if (!state.tutorialDone) startTutorial();
  window.addEventListener('resize', () => state.renderer && state.renderer.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => state.renderer && state.renderer.resize(), 120));
}
document.addEventListener('DOMContentLoaded', boot);
