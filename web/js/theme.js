// Visual language: arcane engraving. Everything is etched into one dark
// material; element colour is the ink, never the material.
const THEME = {
  bg0: '#080911',
  bg1: '#141523',
  panel: 'rgba(255,255,255,0.022)',
  gold: '#C9A227',
  goldLit: '#EBD489',
  goldDim: 'rgba(201,162,39,0.22)',
  ink: '#EDEAF6',
  inkDim: 'rgba(237,234,246,0.52)',
  inkFaint: 'rgba(237,234,246,0.26)',
  danger: '#E2536A',
  heal: '#63C98C',
  wardTint: '#6EC6E8',
  serif: 'ui-serif, "Iowan Old Style", Palatino, Georgia, serif',
  sans: '-apple-system, system-ui, "SF Pro Text", sans-serif',
};

// Each element carries a rune as well as a colour, so the board stays readable
// without relying on hue alone.
const RUNES = {
  ember: (ctx, s) => {                                   // flame with a curled tip
    ctx.beginPath();
    ctx.moveTo(s * 0.12, -s);
    ctx.quadraticCurveTo(s * 0.95, -s * 0.06, s * 0.34, s);
    ctx.lineTo(-s * 0.34, s);
    ctx.quadraticCurveTo(-s * 0.9, s * 0.05, -s * 0.2, -s * 0.42);
    ctx.quadraticCurveTo(-s * 0.05, -s * 0.1, s * 0.12, -s);
    ctx.closePath();
  },
  tide: (ctx, s) => {                                    // double wave
    ctx.beginPath();
    for (const dy of [-s * 0.42, s * 0.34]) {
      ctx.moveTo(-s, dy);
      ctx.quadraticCurveTo(-s * 0.5, dy - s * 0.55, 0, dy);
      ctx.quadraticCurveTo(s * 0.5, dy + s * 0.55, s, dy);
    }
  },
  stone: (ctx, s) => {                                   // hexagon
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = Math.cos(a) * s, y = Math.sin(a) * s;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  },
  bloom: (ctx, s) => {                                   // leaf with a midrib
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.9, -s * 0.15, 0, s);
    ctx.quadraticCurveTo(-s * 0.9, -s * 0.15, 0, -s);
    ctx.closePath();
    ctx.moveTo(0, -s * 0.72); ctx.lineTo(0, s * 0.72);
  },
  aether: (ctx, s) => {                                  // four-point star
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.16, -s * 0.16, s, 0);
    ctx.quadraticCurveTo(s * 0.16, s * 0.16, 0, s);
    ctx.quadraticCurveTo(-s * 0.16, s * 0.16, -s, 0);
    ctx.quadraticCurveTo(-s * 0.16, -s * 0.16, 0, -s);
    ctx.closePath();
  },
};

// Role marks are struck over the rune on an anchor: blade, shield, cross.
const ROLE_MARKS = {
  strike: (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.4, -s * 0.1); ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.4, -s * 0.1); ctx.closePath();
  },
  ward: (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.82, -s * 0.55); ctx.lineTo(s * 0.82, s * 0.18);
    ctx.quadraticCurveTo(s * 0.82, s, 0, s);
    ctx.quadraticCurveTo(-s * 0.82, s, -s * 0.82, s * 0.18);
    ctx.lineTo(-s * 0.82, -s * 0.55); ctx.closePath();
  },
  mend: (ctx, s) => {
    const t = s * 0.3;
    ctx.beginPath();
    ctx.rect(-t, -s, t * 2, s * 2);
    ctx.rect(-s, -t, s * 2, t * 2);
  },
};

const ROLE_VERB = { strike: 'damage', ward: 'shield', mend: 'heal' };
const TIER_LABEL = { basic: 'I · Basic', advanced: 'II · Advanced', elite: 'III · Elite', ultimate: 'IV · Ultimate' };
const TIER_NUMERAL = { basic: 'I', advanced: 'II', elite: 'III', ultimate: 'IV' };

function familyName(family) {
  const [el, role] = family.split('_');
  return `${ELEMENTS[el].name} ${role}`;
}

function mixHex(hex, target, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(target.slice(1), 16);
  const ch = (sh) => Math.round((((a >> sh) & 255) * (1 - t)) + (((b >> sh) & 255) * t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
