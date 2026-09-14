// Screens, input and the frame loop.
const $ = (sel) => document.querySelector(sel);
const STORE = 'runechain.save';

const state = {
  heroId: 'vesk',
  difficulty: 'normal',
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
    Object.assign(state, { heroId: s.heroId || state.heroId, difficulty: s.difficulty || state.difficulty, loadouts: s.loadouts || {} });
  } catch (e) { /* first run */ }
}
function save() {
  localStorage.setItem(STORE, JSON.stringify({ heroId: state.heroId, difficulty: state.difficulty, loadouts: state.loadouts }));
}
function loadoutFor(hero) {
  if (!state.loadouts[hero.id]) state.loadouts[hero.id] = defaultLoadout(hero);
  return state.loadouts[hero.id];
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
}

// ---- home -----------------------------------------------------------------
function renderHome() {
  const list = $('#heroList');
  list.innerHTML = '';
  for (const hero of HEROES) {
    const el = document.createElement('button');
    el.className = 'hero' + (hero.id === state.heroId ? ' sel' : '');
    el.innerHTML = `
      <div class="heroTop">
        <span class="heroName">${hero.name}</span>
        <span class="dots">${hero.affinities.map(a => `<i style="background:${ELEMENTS[a].color}"></i>`).join('')}</span>
      </div>
      <div class="heroTitle">${hero.title}</div>
      <div class="heroPassive">${hero.passiveText}</div>`;
    el.onclick = () => { state.heroId = hero.id; save(); renderHome(); };
    list.appendChild(el);
  }
  for (const b of document.querySelectorAll('#diffRow button'))
    b.classList.toggle('sel', b.dataset.diff === state.difficulty);
}

// ---- loadout --------------------------------------------------------------
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
    head.innerHTML = `<span>${tier}</span><span class="count">${lo[tier].length}/4</span>`;
    sec.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'spellGrid';
    for (const spell of spellsFor(hero, tier)) {
      const on = lo[tier].includes(spell.id);
      const b = document.createElement('button');
      b.className = 'spell' + (on ? ' on' : '');
      b.style.setProperty('--el', ELEMENTS[spell.element].color);
      b.innerHTML = `<span class="role role-${spell.role}"></span>
        <span class="sName">${spell.name}</span>
        <span class="sMeta">${spell.base} · ${spell.castTime.toFixed(2)}s · ${spell.role}</span>`;
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
  for (const tier of TIERS) if (lo[tier].length !== 4) return `Pick exactly 4 ${tier} spells.`;
  const roles = lo.basic.map(id => SPELL_BY_ID[id].role);
  if (!roles.includes('ward')) return 'Basic slots need at least one ward.';
  if (!roles.includes('mend')) return 'Basic slots need at least one mend.';
  return '';
}

// ---- battle ---------------------------------------------------------------
function startBattle() {
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
  state.match = new Match(me, foe, seed);
  state.ai = new AI(foe, state.match, 1, state.difficulty);

  show('battle');
  if (!state.renderer) state.renderer = new Renderer($('#gameCanvas'));
  state.renderer.resize();
  state.renderer.floaters.length = 0;
  $('#battleOverlay').classList.remove('show');
  state.last = performance.now();
  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(frame);
}

function frame(now) {
  const dt = Math.min(0.05, (now - state.last) / 1000);
  state.last = now;
  const m = state.match;
  m.update(dt);
  state.ai.update(dt, m.time);
  drainEvents(m);
  state.renderer.draw(m, m.players[0], m.players[1], dt);
  if (m.over) {
    $('#battleOverlay').classList.add('show');
    return;
  }
  state.raf = requestAnimationFrame(frame);
}

function drainEvents(m) {
  const r = state.renderer, lay = r.layout;
  for (const ev of m.events) {
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
    if (!p || !state.match.running) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pos(e);
    const cell = state.renderer.cellAt(x, y);
    if (cell && p.beginDrag(cell.r, cell.c)) { active = true; haptic(8); }
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
    if (cast) haptic(18);
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
  $('#loadoutBtn').onclick = () => { renderLoadout(); show('loadout'); };
  $('#loadoutBack').onclick = () => { renderHome(); show('home'); };
  $('#loadoutReset').onclick = () => { state.loadouts[state.heroId] = defaultLoadout(HERO_BY_ID[state.heroId]); save(); renderLoadout(); };
  $('#againBtn').onclick = startBattle;
  $('#homeBtn').onclick = () => { cancelAnimationFrame(state.raf); renderHome(); show('home'); };
  $('#quitBtn').onclick = () => { cancelAnimationFrame(state.raf); renderHome(); show('home'); };
  for (const b of document.querySelectorAll('#diffRow button'))
    b.onclick = () => { state.difficulty = b.dataset.diff; save(); renderHome(); };
  bindInput($('#gameCanvas'));
  window.addEventListener('resize', () => state.renderer && state.renderer.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => state.renderer && state.renderer.resize(), 120));
}
document.addEventListener('DOMContentLoaded', boot);
