// Canvas renderer for the battle screen. Portrait, thumb-first layout.
const ICONS = {
  strike: (ctx, s) => { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.42, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.42, 0); ctx.closePath(); ctx.fill(); },
  ward:   (ctx, s) => { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, -s * 0.55); ctx.lineTo(s * 0.8, s * 0.2); ctx.quadraticCurveTo(s * 0.8, s, 0, s); ctx.quadraticCurveTo(-s * 0.8, s, -s * 0.8, s * 0.2); ctx.lineTo(-s * 0.8, -s * 0.55); ctx.closePath(); ctx.fill(); },
  mend:   (ctx, s) => { const t = s * 0.34; ctx.beginPath(); ctx.rect(-t, -s, t * 2, s * 2); ctx.rect(-s, -t, s * 2, t * 2); ctx.fill(); },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layout = null;
    this.floaters = [];
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = w; this.H = h;

    // env() only resolves against a real element, so measure a probe.
    const probe = document.getElementById('safeProbe');
    const ps = getComputedStyle(probe);
    const top = parseFloat(ps.paddingTop) || 0, bottom = parseFloat(ps.paddingBottom) || 0;

    const pad = 14;
    const cell = Math.min((w - pad * 2) / COLS, ((h - top - bottom) * 0.53) / ROWS);
    const boardW = cell * COLS, boardH = cell * ROWS;
    const board = { x: (w - boardW) / 2, y: h - bottom - 14 - boardH, w: boardW, h: boardH, cell };

    const mcell = Math.min((w * 0.42) / COLS, ((board.y - top) * 0.52) / ROWS);
    const mirror = { x: pad, y: top + 10, w: mcell * COLS, h: mcell * ROWS, cell: mcell };
    const oppBar = { x: mirror.x + mirror.w + 12, y: mirror.y + 6, w: w - (mirror.x + mirror.w + 12) - pad - 34, h: 64 };
    const selfBar = { x: pad, y: board.y - 94, w: w - pad * 2, h: 84 };
    const lane = { x: pad, y: mirror.y + mirror.h + 8, w: w - pad * 2, h: selfBar.y - (mirror.y + mirror.h) - 16 };

    this.layout = { board, mirror, oppBar, selfBar, lane };
  }

  cellAt(x, y) {
    const b = this.layout.board;
    const c = Math.floor((x - b.x) / b.cell), r = Math.floor((y - b.y) / b.cell);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
    return { r, c };
  }

  addFloater(text, x, y, color) { this.floaters.push({ text, x, y, color, life: 1 }); }

  draw(match, me, foe, dt) {
    const ctx = this.ctx, { W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0d18'); g.addColorStop(1, '#151428');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const t = match.time;
    this.drawGrid(foe, this.layout.mirror, true, t);
    this.drawPortrait(foe, this.layout.oppBar, t, true);
    this.drawLane(match, t, foe, me);
    this.drawPortrait(me, this.layout.selfBar, t, false);
    this.drawGrid(me, this.layout.board, false, t);
    this.drawFloaters(dt);
    if (match.countdown > 0) this.drawCountdown(match.countdown);
    else if (t > OVERLOAD_START) this.drawOverload(t);
    if (match.over) this.drawResult(match);
  }

  drawGrid(p, box, mini, now) {
    const ctx = this.ctx, cs = box.cell;
    ctx.save();
    roundRect(ctx, box.x - 6, box.y - 6, box.w + 12, box.h + 12, 14);
    ctx.fillStyle = mini ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.06)';
    ctx.fill();
    if (mini) { ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke(); }

    ctx.save();
    roundRect(ctx, box.x - 6, box.y - 6, box.w + 12, box.h + 12, 14);
    ctx.clip();
    const inPath = new Set((p.drag ? p.drag.path : []).map(c => c.r * COLS + c.c));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = p.grid[r][c];
      if (!cell) continue;
      const x = box.x + c * cs, y = box.y + (r - cell.fall) * cs;
      this.drawToken(cell, x, y, cs, inPath.has(r * COLS + c), mini);
    }
    if (p.drag && p.drag.path.length > 1) this.drawChainLine(p.drag, box, mini);
    ctx.restore();
    ctx.restore();
  }

  drawToken(cell, x, y, cs, selected, mini) {
    const ctx = this.ctx, el = ELEMENTS[cell.el], m = cs * 0.06;
    const spell = cell.spellId ? SPELL_BY_ID[cell.spellId] : null;
    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x, y + cs);
    grad.addColorStop(0, spell ? el.light : el.color);
    grad.addColorStop(1, spell ? el.color : this.shade(el.color, -0.35));
    roundRect(ctx, x + m, y + m, cs - m * 2, cs - m * 2, cs * 0.24);
    ctx.fillStyle = grad;
    ctx.fill();
    if (spell) {
      ctx.lineWidth = Math.max(1.5, cs * 0.055);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
      ctx.translate(x + cs / 2, y + cs / 2 - (mini ? 0 : cs * 0.05));
      ctx.fillStyle = 'rgba(20,18,34,0.9)';
      ICONS[spell.role](ctx, cs * 0.22);
      if (!mini) {
        ctx.translate(0, cs * 0.32);
        const tierIdx = TIERS.indexOf(spell.tier);
        for (let i = 0; i <= tierIdx; i++) {
          ctx.beginPath();
          ctx.arc((i - tierIdx / 2) * cs * 0.13, 0, cs * 0.035, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(20,18,34,0.85)';
          ctx.fill();
        }
      }
    }
    ctx.restore();
    if (selected) {
      ctx.save();
      roundRect(ctx, x + m, y + m, cs - m * 2, cs - m * 2, cs * 0.24);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(2, cs * 0.09);
      ctx.shadowColor = '#fff'; ctx.shadowBlur = cs * 0.3;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawChainLine(drag, box, mini) {
    const ctx = this.ctx, cs = box.cell;
    ctx.save();
    ctx.beginPath();
    drag.path.forEach((p, i) => {
      const x = box.x + p.c * cs + cs / 2, y = box.y + p.r * cs + cs / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = cs * (mini ? 0.12 : 0.16);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = ELEMENTS[drag.spell.element].light;
    ctx.shadowBlur = cs * 0.4;
    ctx.stroke();
    ctx.restore();
  }

  drawPortrait(p, box, now, isFoe) {
    const ctx = this.ctx;
    const hpFrac = Math.max(0, p.hp / p.maxHp);
    const barH = 16, barY = box.y + (isFoe ? 20 : 6);
    ctx.save();
    ctx.font = '600 13px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${p.hero.name}`, box.x, barY - 6);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`${Math.ceil(p.hp)}`, box.x + box.w, barY - 6);
    ctx.textAlign = 'left';

    roundRect(ctx, box.x, barY, box.w, barH, barH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
    if (hpFrac > 0) {
      ctx.save();
      roundRect(ctx, box.x, barY, box.w, barH, barH / 2); ctx.clip();
      ctx.fillStyle = p.flash > 0 ? '#fff' : (isFoe ? '#ff5c6e' : '#63e08a');
      ctx.fillRect(box.x, barY, box.w * hpFrac, barH);
      ctx.restore();
    }
    const ward = p.wardAmount(now);
    if (ward > 0) {
      const wf = Math.min(1, ward / p.maxHp);
      ctx.save();
      roundRect(ctx, box.x, barY, box.w, barH, barH / 2); ctx.clip();
      ctx.fillStyle = 'rgba(120,215,255,0.85)';
      ctx.fillRect(box.x, barY, box.w * wf, barH);
      ctx.restore();
      ctx.font = '600 10px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = '#0b0d18';
      ctx.fillText(`${Math.ceil(ward)}`, box.x + 6, barY + barH - 4);
    }

    this.drawPips(p, box.x, barY + barH + 8, box.w);
    if (p.cast && !isFoe) this.drawCastBar(p, box, barY + barH + 26, now);
    ctx.restore();
  }

  drawPips(p, x, y, w) {
    const ctx = this.ctx;
    const families = [];
    for (const tier of TIERS) for (const id of p.loadout[tier]) {
      const f = SPELL_BY_ID[id].family;
      if (!families.includes(f)) families.push(f);
    }
    const gap = 4, pw = Math.min(26, (w - gap * families.length) / families.length);
    families.forEach((f, i) => {
      const charge = p.charge[f] || 0;
      const tier = charge >= ASCENSION.ultimate ? 3 : charge >= ASCENSION.elite ? 2 : charge >= ASCENSION.advanced ? 1 : 0;
      const next = [ASCENSION.advanced, ASCENSION.elite, ASCENSION.ultimate, ASCENSION.ultimate][tier];
      const prev = [0, ASCENSION.advanced, ASCENSION.elite, ASCENSION.ultimate][tier];
      const frac = tier === 3 ? 1 : Math.min(1, (charge - prev) / (next - prev));
      const bx = x + i * (pw + gap);
      roundRect(ctx, bx, y, pw, 5, 2.5);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
      roundRect(ctx, bx, y, pw * frac, 5, 2.5);
      ctx.fillStyle = ELEMENTS[f.split('_')[0]].color; ctx.fill();
      for (let d = 0; d <= tier; d++) {
        ctx.beginPath();
        ctx.arc(bx + 3 + d * 5, y + 11, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
      }
    });
  }

  drawCastBar(p, box, y, now) {
    const ctx = this.ctx, cast = p.cast;
    const frac = Math.min(1, (now - cast.startedAt) / (cast.endsAt - cast.startedAt));
    const w = box.w, h = 10;
    roundRect(ctx, box.x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
    roundRect(ctx, box.x, y, w * frac, h, h / 2);
    ctx.fillStyle = ELEMENTS[cast.spell.element].light; ctx.fill();
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`${cast.spell.name}  ${cast.effect}  x${cast.n}`, box.x + 2, y + h + 12);
  }

  drawLane(match, now, foe, me) {
    const ctx = this.ctx, lane = this.layout.lane;
    const cx = lane.x + lane.w / 2;

    ctx.save();
    ctx.font = '700 12px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = now > OVERLOAD_START ? '#ff8a96' : 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.max(0, MATCH_CAP - now).toFixed(0)}s`, lane.x, lane.y + 14);
    ctx.textAlign = 'center';

    // The opponent's windup, spelled out: this is the read the mirror sets up.
    if (foe.cast) {
      const c = foe.cast, el = ELEMENTS[c.spell.element];
      const frac = Math.min(1, (now - c.startedAt) / (c.endsAt - c.startedAt));
      const roomy = lane.h > 86;
      const y = lane.y + lane.h / 2 - (roomy ? 6 : 10);
      ctx.font = '800 19px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = el.light;
      ctx.fillText(`${c.spell.name}`, cx, y);
      if (roomy) {
        ctx.font = '600 12px -apple-system, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(`${c.spell.role} ${c.effect}  ·  chain ${c.n}`, cx, y + 18);
      }
      const bw = lane.w * 0.5, bx = cx - bw / 2, by = y + (roomy ? 28 : 12);
      roundRect(ctx, bx, by, bw, 6, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
      roundRect(ctx, bx, by, bw * frac, 6, 3);
      ctx.fillStyle = el.color; ctx.fill();
    } else if (foe.drag && foe.drag.path.length > 1) {
      const d = foe.drag, el = ELEMENTS[d.spell.element];
      ctx.font = '700 15px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = el.light;
      const y = lane.y + lane.h / 2;
      ctx.fillText(`${d.spell.name}  ·  ${d.path.length - 1}`, cx, y);
      if (lane.h > 70) {
        ctx.font = '600 11px -apple-system, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('drawing a chain', cx, y + 16);
      }
    }
    ctx.restore();
    for (const pr of match.projectiles) {
      const f = (now - pr.firedAt) / (pr.impactAt - pr.firedAt);
      const up = pr.from === 0;                       // player 0 is you, bottom of screen
      const y = up ? lane.y + lane.h * (1 - f) : lane.y + lane.h * f;
      const x = lane.x + lane.w * (0.3 + 0.4 * (up ? f : 1 - f));
      const el = ELEMENTS[pr.spell.element];
      const size = 9 + Math.min(18, pr.damage / 60);
      ctx.save();
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
      grad.addColorStop(0, el.light); grad.addColorStop(0.45, el.color); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, size * 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  drawFloaters(dt) {
    const ctx = this.ctx;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt * 0.9;
      if (f.life <= 0) { this.floaters.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life * 1.6);
      ctx.font = '800 22px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - (1 - f.life) * 46);
      ctx.restore();
    }
  }

  drawCountdown(c) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,18,0.55)'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.font = '800 84px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(String(Math.ceil(c)), this.W / 2, this.H / 2);
    ctx.restore();
  }

  drawOverload(t) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 6);
    ctx.strokeStyle = '#ff5c6e'; ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, this.W - 6, this.H - 6);
    ctx.globalAlpha = 1;
    ctx.font = '800 13px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#ff8a96'; ctx.textAlign = 'center';
    ctx.fillText('OVERLOAD', this.W / 2, this.layout.lane.y + this.layout.lane.h / 2);
    ctx.restore();
  }

  drawResult(match) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,18,0.72)'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.font = '800 40px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = match.over.winner === 0 ? '#63e08a' : match.over.winner === 1 ? '#ff5c6e' : '#fff';
    ctx.fillText(match.over.winner === 0 ? 'VICTORY' : match.over.winner === 1 ? 'DEFEAT' : 'DRAW', this.W / 2, this.H / 2 - 10);
    ctx.font = '500 15px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(match.over.reason === 'time' ? 'time cap — higher HP wins' : `${match.time.toFixed(1)}s`, this.W / 2, this.H / 2 + 20);
    ctx.restore();
  }

  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
}
