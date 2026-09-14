// RUNECHAIN static catalogue. Colour encodes element, icon shape encodes role.
const ELEMENTS = {
  ember:  { name: 'Ember',  color: '#ff6a35', light: '#ffb28a', power: 1.00, speed: 1.00 },
  tide:   { name: 'Tide',   color: '#2f9dff', light: '#9ed6ff', power: 0.90, speed: 0.80 },
  stone:  { name: 'Stone',  color: '#f0a81f', light: '#ffdc93', power: 1.15, speed: 1.25 },
  bloom:  { name: 'Bloom',  color: '#3fce6e', light: '#a7edbe', power: 1.00, speed: 1.05 },
  aether: { name: 'Aether', color: '#a760ff', light: '#d9bbff', power: 0.95, speed: 0.85 },
};

const TIERS = ['basic', 'advanced', 'elite', 'ultimate'];
const ROLES = ['strike', 'ward', 'mend'];

const TIER_BASE = { basic: 90, advanced: 170, elite: 300, ultimate: 650 };
const TIER_CAST = { basic: 0.40, advanced: 0.65, elite: 0.95, ultimate: 1.50 };
const ROLE_MOD  = { strike: 1.0, ward: 1.15, mend: 0.8 };

// Ascension charge required before a family's tier may spawn as an anchor.
// Lowered from the spec's 12/30/55 so the ultimate tier is reachable inside the
// 60-90s match target; see tools/tune.js.
const ASCENSION = { basic: 0, advanced: 10, elite: 24, ultimate: 42 };

const SPELL_NAMES = {
  ember:  { strike: ['Cinder Flick', 'Flare Lance', 'Pyre Column', 'Sunfall'],
            ward:   ['Ash Veil', 'Emberguard', 'Cinder Bulwark', 'Forgeheart'],
            mend:   ['Warm Salve', 'Kindling', 'Hearthmend', 'Phoenix Vow'] },
  tide:   { strike: ['Drizzle Dart', 'Brine Lance', 'Tidebreak', 'Maelstrom'],
            ward:   ['Mist Veil', 'Rimeguard', 'Glacier Wall', 'Deepstill'],
            mend:   ['Cool Draught', 'Springtide', 'Wellspring', "Ocean's Gift"] },
  stone:  { strike: ['Pebble Snap', 'Shale Spike', 'Quake Fist', 'Mountainfall'],
            ward:   ['Grit Shell', 'Stoneguard', 'Bastion', 'Unmoved'],
            mend:   ['Mudpack', 'Geode Mend', 'Bedrock Rest', 'Living Stone'] },
  bloom:  { strike: ['Thorn Flick', 'Bramble Lash', 'Rootspear', 'Worldvine'],
            ward:   ['Leaf Veil', 'Barkguard', 'Thicket Wall', 'Greatwood'],
            mend:   ['Poultice', 'Bloomtouch', 'Verdant Surge', 'Rebirth'] },
  aether: { strike: ['Spark Mote', 'Void Lance', 'Rift Split', 'Starfall'],
            ward:   ['Glimmer Veil', 'Nullguard', 'Phase Wall', 'Event Horizon'],
            mend:   ['Whisper Mend', 'Echo Bind', 'Astral Suture', 'Reweave'] },
};

// 5 elements x 3 roles = 15 families, each a four-tier line.
const SPELLS = [];
const SPELL_BY_ID = {};
for (const element of Object.keys(ELEMENTS)) {
  for (const role of ROLES) {
    for (let i = 0; i < 4; i++) {
      const tier = TIERS[i];
      const spell = {
        id: `${element}_${role}_${i + 1}`,
        family: `${element}_${role}`,
        name: SPELL_NAMES[element][role][i],
        element, tier, role,
        base: Math.round(TIER_BASE[tier] * ROLE_MOD[role] * ELEMENTS[element].power),
        castTime: Math.round(TIER_CAST[tier] * ELEMENTS[element].speed * 100) / 100,
        rank: 1,
      };
      SPELLS.push(spell);
      SPELL_BY_ID[spell.id] = spell;
    }
  }
}

const HEROES = [
  { id: 'vesk',   name: 'Vesk',   title: 'the Cinderwright', affinities: ['ember', 'stone', 'aether'],
    baseHp: 2800, passive: 'smallStrikeHaste', passiveText: 'Strikes of 3 tokens or fewer cast 15% faster.' },
  { id: 'ilra',   name: 'Ilra',   title: 'the Tidecaller',   affinities: ['tide', 'bloom', 'aether'],
    baseHp: 2800, passive: 'mendBoost',        passiveText: 'Mends heal 20% more.' },
  { id: 'morrow', name: 'Morrow', title: 'the Bellkeeper',   affinities: ['stone', 'aether', 'tide'],
    baseHp: 2800, passive: 'longWard',         passiveText: 'Wards last 9s instead of 6s.' },
  { id: 'sabbat', name: 'Sabbat', title: 'the Thornwidow',   affinities: ['bloom', 'ember', 'tide'],
    baseHp: 2800, passive: 'longChain',        passiveText: 'Maximum chain is 8 tokens instead of 7.' },
  { id: 'quill',  name: 'Quill',  title: 'the Ashclerk',     affinities: ['aether', 'tide', 'ember'],
    baseHp: 2800, passive: 'fastAscend',       passiveText: 'Ascension charge gain +25%.' },
  { id: 'hollis', name: 'Hollis', title: 'the Gravewalker',  affinities: ['stone', 'bloom', 'ember'],
    baseHp: 2800, passive: 'desperation',      passiveText: 'Below 35% HP, cast time x0.8.' },
];
const HERO_BY_ID = {};
for (const h of HEROES) HERO_BY_ID[h.id] = h;

function spellsFor(hero, tier) {
  return SPELLS.filter(s => s.tier === tier && hero.affinities.includes(s.element));
}

// Default loadout: 4 per tier, guaranteeing one ward and one mend among the basics.
function defaultLoadout(hero) {
  const out = {};
  for (const tier of TIERS) {
    const pool = spellsFor(hero, tier);
    const pick = [
      pool.find(s => s.role === 'strike' && s.element === hero.affinities[0]),
      pool.find(s => s.role === 'ward'   && s.element === hero.affinities[1]),
      pool.find(s => s.role === 'mend'   && s.element === hero.affinities[2]),
      pool.find(s => s.role === 'strike' && s.element === hero.affinities[1]),
    ];
    out[tier] = pick.map(s => s.id);
  }
  return out;
}
