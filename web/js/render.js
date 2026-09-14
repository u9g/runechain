// Canvas renderer for the battle screen. Portrait, thumb-first, engraved.
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
    this.shake = 0;
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
    const ps = getComputedStyle(document.getElementById('safeProbe'));
    const top = parseFloat(ps.paddingTop) || 0, bottom = parseFloat(ps.paddingBottom) || 0;

    const pad = 14;
    const cell = Math.min((w - pad * 2) / COLS, ((h - top - bottom) * 0.50) / ROWS);
    const boardW = cell * COLS, boardH = cell * ROWS;
    const board = { x: (w - boardW) / 2, y: h - bottom - 26 - boardH, w: boardW, h: boardH, cell };

    const mcell = Math.min((w * 0.40) / COLS, ((board.y - top) * 0.40) / ROWS);
    const mirror = { x: pad, y: top + 26, w: mcell * COLS, h: mcell * ROWS, cell: mcell };
    const oppBar = { x: mirror.x + mirror.w + 14, y: mirror.y + 2, w: w - (mirror.x + mirror.w + 14) - pad - 36, h: 70 };
    const selfBar = { x: pad, y: board.y - 104, w: w - pad * 2, h: 92 };
    const lane = { x: pad, y: mirror.y + mirror.h + 10, w: w - pad * 2, h: selfBar.y - (mirror.y + mirror.h) - 20 };

    this.layout = { board, mirror, oppBar, selfBar, lane, pad };
  }

  cellAt(x, y) {
    const b = this.layout.board;
    const c = Math.floor((x - b.x) / b.cell), r = Math.floor((y - b.y) / b.cell);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
    return { r, c };
  }

  addFloater(text, x, y, color) { this.floaters.push({ text, x, y, color, life: 1 }); }

  // ---- primitives -------------------------------------------------------
  /** Small-caps tracked label. ctx.letterSpacing is too new for our floor. */
  tracked(text, x, y, { size = 10, spacing = 1.6, color = THEME.gold, align = 'left', weight = 700 } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${weight} ${size}px ${THEME.sans}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    const chars = text.toUpperCase().split('');
    const width = chars.reduce((t, c) => t + ctx.measureText(c).width + spacing, -spacing);
    let cx = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    for (const c of chars) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + spacing; }
    ctx.restore();
    return width;
  }

  /** Engraved panel: faint fill, hairline rule, gold corner ticks. */
  panel(x, y, w, h, { label, accent = THEME.goldDim, tick = 11 } = {}) {
    const ctx = this.ctx;
    ctx.save();
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = THEME.panel; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.055)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * 3, cy + dy * tick);
      ctx.lineTo(cx + dx * 3, cy + dy * 3);
      ctx.lineTo(cx + dx * tick, cy + dy * 3);
      ctx.stroke();
    }
    ctx.restore();
    if (label) this.tracked(label, x + 2, y - 8, { size: 9.5, color: THEME.gold });
  }

  /** Thin rule with a label sitting on it, used to name a region. */
  ruleLabel(text, x, y, w, { color = THEME.gold, align = 'left' } = {}) {
    const ctx = this.ctx;
    const tw = this.tracked(text, align === 'right' ? x + w : x, y, { size: 9.5, color, align });
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (align === 'right') { ctx.moveTo(x, y - 3.5); ctx.lineTo(x + w - tw - 8, y - 3.5); }
    else { ctx.moveTo(x + tw + 8, y - 3.5); ctx.lineTo(x + w, y - 3.5); }
    ctx.stroke();
    ctx.restore();
  }

  // ---- frame ------------------------------------------------------------
  draw(match, me, foe, dt) {
    const ctx = this.ctx, { W, H } = this;
    ctx.save();
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 4);
      const k = this.shake * 5;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    this.drawBackdrop(match.time);

    const t = match.time;
    this.tracked('Their board', this.layout.mirror.x + 2, this.layout.mirror.y - 9, { size: 9.5, color: THEME.gold });
    this.drawGrid(foe, this.layout.mirror, true, t);
    this.drawFighter(foe, this.layout.oppBar, t, true);
    this.drawLane(match, t, foe, me);
    this.drawFighter(me, this.layout.selfBar, t, false);
    this.drawGrid(me, this.layout.board, false, t);
    this.drawFloaters(dt);
    ctx.restore();
    this.drawFocus(t);
    this.drawHints(t);

    if (match.countdown > 0) this.drawCountdown(match.countdown);
    else if (t > OVERLOAD_START && !match.over) this.drawOverload(t);
    if (match.over) this.drawResult(match);
  }

  drawBackdrop(t) {
    const ctx = this.ctx, { W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, THEME.bg1); g.addColorStop(0.55, THEME.bg0); g.addColorStop(1, '#0B0C17');
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);

    // engraved arc behind the duelling lane
    const lane = this.layout.lane, cy = lane.y + lane.h / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(201,162,39,0.08)';
    ctx.lineWidth = 1;
    for (const r of [W * 0.42, W * 0.55, W * 0.68]) {
      ctx.beginPath(); ctx.arc(W / 2, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- board ------------------------------------------------------------
  drawGrid(p, box, mini, now) {
    const ctx = this.ctx, cs = box.cell, m = mini ? 5 : 8;
    this.panel(box.x - m, box.y - m, box.w + m * 2, box.h + m * 2, { tick: mini ? 8 : 12 });

    ctx.save();
    roundRect(ctx, box.x - m + 1, box.y - m + 1, box.w + m * 2 - 2, box.h + m * 2 - 2, 11);
    ctx.clip();
    const inPath = new Set((p.drag ? p.drag.path : []).map(c => c.r * COLS + c.c));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = p.grid[r][c];
      if (!cell) continue;
      this.drawToken(cell, box.x + c * cs, box.y + (r - cell.fall) * cs, cs, inPath.has(r * COLS + c), mini);
    }
    if (p.drag && p.drag.path.length > 1) this.drawChainLine(p.drag, box, mini);
    ctx.restore();
  }

  drawToken(cell, x, y, cs, selected, mini) {
    const ctx = this.ctx, el = ELEMENTS[cell.el];
    const spell = cell.spellId ? SPELL_BY_ID[cell.spellId] : null;
    const inset = cs * 0.055, s = cs - inset * 2, r = cs * 0.19;
    ctx.save();
    ctx.translate(x + inset, y + inset);

    // the material: element ink stained into dark slate, never candy
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, mixHex(el.color, '#20212E', spell ? 0.38 : 0.6));
    g.addColorStop(1, mixHex(el.color, '#0C0D16', spell ? 0.5 : 0.74));
    roundRect(ctx, 0, 0, s, s, r);
    ctx.fillStyle = g; ctx.fill();

    // etched bevel
    ctx.save();
    roundRect(ctx, 0, 0, s, s, r); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(r * 0.6, 1); ctx.lineTo(s - r * 0.6, 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.moveTo(r * 0.6, s - 1); ctx.lineTo(s - r * 0.6, s - 1); ctx.stroke();
    ctx.restore();
    roundRect(ctx, 0.5, 0.5, s - 1, s - 1, r);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();

    ctx.translate(s / 2, s / 2);
    if (spell) {
      // anchor: gold frame, tier ornament, role mark struck over a faint rune
      const tierIdx = TIERS.indexOf(spell.tier);
      ctx.save();
      ctx.globalAlpha = 0.17;
      ctx.strokeStyle = el.light; ctx.lineWidth = Math.max(1, cs * 0.03);
      RUNES[cell.el](ctx, s * 0.42); ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = THEME.goldLit;
      if (tierIdx >= 2) { ctx.shadowColor = 'rgba(235,212,137,0.8)'; ctx.shadowBlur = cs * (tierIdx === 3 ? 0.4 : 0.22); }
      ROLE_MARKS[spell.role](ctx, s * (mini ? 0.24 : 0.2));
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(-s / 2, -s / 2);
      const f = s * 0.09;
      roundRect(ctx, f, f, s - f * 2, s - f * 2, r * 0.7);
      ctx.strokeStyle = THEME.gold; ctx.lineWidth = Math.max(1, cs * 0.022); ctx.stroke();
      if (tierIdx >= 1) {
        roundRect(ctx, f * 1.9, f * 1.9, s - f * 3.8, s - f * 3.8, r * 0.5);
        ctx.strokeStyle = 'rgba(201,162,39,0.5)'; ctx.stroke();
      }
      if (!mini) {
        this.tracked(TIER_NUMERAL[spell.tier], s / 2, s - f * 1.6, { size: cs * 0.15, spacing: 0.6, color: 'rgba(235,212,137,0.75)', align: 'center' });
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = el.light;
      ctx.lineWidth = Math.max(1, cs * 0.04);
      ctx.lineJoin = 'round';
      RUNES[cell.el](ctx, s * 0.27);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    if (selected) {
      ctx.save();
      roundRect(ctx, x + inset, y + inset, s, s, r);
      ctx.strokeStyle = THEME.goldLit;
      ctx.lineWidth = Math.max(mini ? 2.2 : 1.6, cs * (mini ? 0.11 : 0.07));
      ctx.shadowColor = 'rgba(235,212,137,0.95)'; ctx.shadowBlur = cs * (mini ? 0.7 : 0.45);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawChainLine(drag, box, mini) {
    const ctx = this.ctx, cs = box.cell;
    const pts = drag.path.map(p => ({ x: box.x + p.c * cs + cs / 2, y: box.y + p.r * cs + cs / 2 }));
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, color, blur] of [[cs * (mini ? 0.22 : 0.16), 'rgba(235,212,137,0.26)', cs * 0.6], [cs * (mini ? 0.08 : 0.05), THEME.goldLit, cs * 0.35]]) {
      ctx.beginPath();
      pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = color; ctx.lineWidth = w;
      ctx.shadowColor = 'rgba(235,212,137,0.9)'; ctx.shadowBlur = blur;
      ctx.stroke();
    }
    if (!mini) {
      const last = pts[pts.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, cs * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = THEME.goldLit; ctx.fill();
    }
    ctx.restore();
  }

  // ---- fighters ---------------------------------------------------------
  drawFighter(p, box, now, isFoe) {
    const ctx = this.ctx;
    const hpFrac = Math.max(0, p.hp / p.maxHp);
    const barH = 15;
    const nameY = box.y + 13, barY = box.y + 21;
    const ascY = box.y + 50, pipY = box.y + 56, readY = box.y + 66;

    ctx.save();
    ctx.font = `600 16px ${THEME.serif}`;
    ctx.fillStyle = THEME.ink;
    ctx.fillText(p.hero.name, box.x, nameY);
    const nameW = ctx.measureText(p.hero.name).width;
    ctx.font = `600 13px ${THEME.sans}`;
    ctx.fillStyle = THEME.inkDim;
    const hpText = `${Math.ceil(p.hp)} HP`;
    const hpW = ctx.measureText(hpText).width;
    ctx.textAlign = 'right';
    ctx.fillText(hpText, box.x + box.w, nameY);
    ctx.textAlign = 'left';
    const affinities = p.hero.affinities.map(a => ELEMENTS[a].name).join(' · ');
    if (box.w - nameW - hpW > affinities.length * 7 + 24) {
      this.tracked(affinities, box.x + nameW + 9, nameY - 1, { size: 8.5, color: THEME.inkFaint, weight: 600 });
    }

    roundRect(ctx, box.x, barY, box.w, barH, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
    ctx.save();
    roundRect(ctx, box.x, barY, box.w, barH, 3); ctx.clip();
    if (hpFrac > 0) {
      const g = ctx.createLinearGradient(box.x, 0, box.x + box.w, 0);
      const base = isFoe ? THEME.danger : THEME.heal;
      g.addColorStop(0, mixHex(base, '#000000', 0.25)); g.addColorStop(1, base);
      ctx.fillStyle = p.flash > 0 ? '#fff' : g;
      ctx.fillRect(box.x, barY, box.w * hpFrac, barH);
    }
    const ward = p.wardAmount(now);
    if (ward > 0) {
      const wf = Math.min(1, ward / p.maxHp);
      ctx.fillStyle = 'rgba(110,198,232,0.92)';
      ctx.fillRect(box.x, barY, box.w * wf, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(box.x + box.w * wf, barY); ctx.lineTo(box.x + box.w * wf, barY + barH); ctx.stroke();
    }
    ctx.restore();
    roundRect(ctx, box.x + 0.5, barY + 0.5, box.w - 1, barH - 1, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.stroke();
    if (ward > 0) {
      ctx.save();
      ctx.translate(box.x + 9, barY + barH / 2);
      ctx.fillStyle = '#04101A';
      ROLE_MARKS.ward(ctx, 4.6);
      ctx.fill();
      ctx.restore();
      ctx.font = `700 10px ${THEME.sans}`;
      ctx.fillStyle = '#04101A';
      ctx.fillText(`${Math.ceil(ward)} ward`, box.x + 17, barY + barH - 4.5);
    }

    this.ruleLabel('Ascension', box.x, ascY, box.w, { color: 'rgba(201,162,39,0.7)' });
    this.drawPips(p, box.x, pipY, box.w);
    if (!isFoe) this.drawChainReadout(p, box, readY, now);
    ctx.restore();
  }

  drawPips(p, x, y, w) {
    const ctx = this.ctx;
    const families = [];
    for (const tier of TIERS) for (const id of p.loadout[tier]) {
      const f = SPELL_BY_ID[id].family;
      if (!families.includes(f)) families.push(f);
    }
    const gap = 9, pw = Math.min(90, (w - gap * (families.length - 1)) / families.length);
    families.forEach((f, i) => {
      const [el, role] = f.split('_');
      const charge = p.charge[f] || 0;
      const tier = charge >= ASCENSION.ultimate ? 3 : charge >= ASCENSION.elite ? 2 : charge >= ASCENSION.advanced ? 1 : 0;
      const next = [ASCENSION.advanced, ASCENSION.elite, ASCENSION.ultimate, ASCENSION.ultimate][tier];
      const prev = [0, ASCENSION.advanced, ASCENSION.elite, ASCENSION.ultimate][tier];
      const frac = tier === 3 ? 1 : Math.min(1, (charge - prev) / (next - prev));
      const bx = x + i * (pw + gap);

      ctx.save();
      ctx.translate(bx + 4.5, y);
      ctx.strokeStyle = ELEMENTS[el].light; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.1;
      RUNES[el](ctx, 4.4); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.translate(11, 0);
      ctx.fillStyle = 'rgba(235,212,137,0.85)';
      ROLE_MARKS[role](ctx, 3.6); ctx.fill();
      ctx.restore();

      const trackX = bx + 21, trackW = Math.max(10, pw - 21 - 11);
      roundRect(ctx, trackX, y - 2, trackW, 4, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fill();
      roundRect(ctx, trackX, y - 2, trackW * frac, 4, 2);
      ctx.fillStyle = ELEMENTS[el].color; ctx.fill();
      this.tracked(TIER_NUMERAL[TIERS[tier]], bx + pw, y + 3.5,
        { size: 8, spacing: 0.8, color: tier === 3 ? THEME.goldLit : THEME.inkFaint, align: 'right' });
    });
  }

  /** Names what is under the player's finger, live, before they commit. */
  drawChainReadout(p, box, y, now) {
    const ctx = this.ctx;
    const drag = p.drag, cast = p.cast;
    ctx.save();
    if (drag) {
      const n = drag.path.length - 1, spell = drag.spell, el = ELEMENTS[spell.element];
      const ready = n >= 1;

      // right cluster first, so the subtitle can yield to it
      let rightW = 0;
      ctx.textAlign = 'right';
      if (ready) {
        ctx.font = `600 11px ${THEME.sans}`;
        ctx.fillStyle = THEME.inkDim;
        const meta = `${ROLE_VERB[spell.role]} · ${p.castTimeFor(spell, n).toFixed(2)}s · chain ${n}/${p.maxChain}`;
        ctx.fillText(meta, box.x + box.w, y + 12);
        const metaW = ctx.measureText(meta).width;
        ctx.font = `700 15px ${THEME.sans}`;
        ctx.fillStyle = THEME.ink;
        const amount = `${p.effectFor(spell, n)}`;
        ctx.fillText(amount, box.x + box.w - metaW - 9, y + 12);
        rightW = metaW + 9 + ctx.measureText(amount).width;
      } else {
        ctx.font = `600 11px ${THEME.sans}`;
        ctx.fillStyle = THEME.inkFaint;
        const hint = `link an adjacent ${ELEMENTS[spell.element].name} rune`;
        ctx.fillText(hint, box.x + box.w, y + 12);
        rightW = ctx.measureText(hint).width;
      }
      ctx.textAlign = 'left';

      ctx.font = `600 15px ${THEME.serif}`;
      ctx.fillStyle = ready ? el.light : THEME.inkDim;
      ctx.fillText(spell.name, box.x, y + 12);
      const nameW = ctx.measureText(spell.name).width;
      const subtitle = `${TIER_LABEL[spell.tier]} · ${spell.role}`;
      if (box.w - nameW - rightW > subtitle.length * 7 + 24) {
        this.tracked(subtitle, box.x + nameW + 9, y + 11, { size: 8.5, color: THEME.inkFaint, weight: 600 });
      }
    } else if (cast) {
      this.drawCastBar(p, box, y, now, false);
    } else if (now < p.lockUntil) {
      this.tracked('recovering', box.x, y + 10, { size: 9, color: THEME.inkFaint });
    } else {
      this.tracked('Touch an anchor to begin a chain', box.x, y + 10, { size: 9, color: THEME.inkFaint });
    }
    ctx.restore();
  }

  drawCastBar(p, box, y, now) {
    const ctx = this.ctx, cast = p.cast;
    const frac = Math.min(1, (now - cast.startedAt) / (cast.endsAt - cast.startedAt));
    const el = ELEMENTS[cast.spell.element];
    ctx.font = `600 15px ${THEME.serif}`;
    ctx.fillStyle = el.light;
    ctx.fillText(cast.spell.name, box.x, y + 12);
    ctx.textAlign = 'right';
    ctx.font = `600 11px ${THEME.sans}`;
    ctx.fillStyle = THEME.inkDim;
    ctx.fillText(`casting · ${cast.effect} ${ROLE_VERB[cast.spell.role]}`, box.x + box.w, y + 12);
    ctx.textAlign = 'left';
    roundRect(ctx, box.x, y + 18, box.w, 5, 2.5);
    ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fill();
    roundRect(ctx, box.x, y + 18, box.w * frac, 5, 2.5);
    ctx.fillStyle = el.color; ctx.fill();
  }

  // ---- lane -------------------------------------------------------------
  drawLane(match, now, foe, me) {
    const ctx = this.ctx, lane = this.layout.lane;
    const cx = lane.x + lane.w / 2;

    ctx.save();
    this.tracked(`${Math.max(0, MATCH_CAP - now).toFixed(0)}s left`, lane.x, lane.y + 10,
      { size: 9, color: now > OVERLOAD_START ? '#F08494' : THEME.inkFaint });
    ctx.textAlign = 'center';

    if (foe.cast) {
      const c = foe.cast, el = ELEMENTS[c.spell.element];
      const frac = Math.min(1, (now - c.startedAt) / (c.endsAt - c.startedAt));
      const roomy = lane.h > 92;
      const y = lane.y + lane.h / 2 - (roomy ? 10 : 14);
      this.tracked(c.spell.role === 'strike' ? 'Incoming' : 'They are casting', cx, y - 18,
        { size: 9, color: c.spell.role === 'strike' ? '#F08494' : THEME.inkFaint, align: 'center' });
      ctx.font = `600 21px ${THEME.serif}`;
      ctx.fillStyle = el.light;
      ctx.fillText(c.spell.name, cx, y + 2);
      if (roomy) {
        ctx.font = `600 11.5px ${THEME.sans}`;
        ctx.fillStyle = THEME.inkDim;
        ctx.fillText(`${c.effect} ${ROLE_VERB[c.spell.role]}  ·  chain ${c.n}  ·  ${TIER_LABEL[c.spell.tier]}`, cx, y + 20);
      }
      const bw = lane.w * 0.52, bx = cx - bw / 2, by = y + (roomy ? 30 : 14);
      roundRect(ctx, bx, by, bw, 5, 2.5);
      ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fill();
      roundRect(ctx, bx, by, bw * frac, 5, 2.5);
      ctx.fillStyle = el.color; ctx.fill();
    } else if (foe.drag && foe.drag.path.length > 1) {
      const d = foe.drag, el = ELEMENTS[d.spell.element], y = lane.y + lane.h / 2;
      this.tracked('They are drawing a chain', cx, y - 20, { size: 9, color: THEME.inkFaint, align: 'center' });
      ctx.font = `600 18px ${THEME.serif}`;
      ctx.fillStyle = el.light;
      ctx.fillText(`${d.spell.name}`, cx, y);
      if (lane.h > 74) {
        ctx.font = `600 11px ${THEME.sans}`;
        ctx.fillStyle = THEME.inkDim;
        ctx.fillText(`${d.path.length - 1} linked  ·  ${ROLE_VERB[d.spell.role]}`, cx, y + 17);
      }
    }
    ctx.restore();

    for (const pr of match.projectiles) {
      const f = (now - pr.firedAt) / (pr.impactAt - pr.firedAt);
      const up = pr.from === 0;
      const y = up ? lane.y + lane.h * (1 - f) : lane.y + lane.h * f;
      const x = lane.x + lane.w * (0.3 + 0.4 * (up ? f : 1 - f));
      const el = ELEMENTS[pr.spell.element];
      const size = 8 + Math.min(16, pr.damage / 70);
      ctx.save();
      const g = ctx.createRadialGradient(x, y, 0, x, y, size * 2.2);
      g.addColorStop(0, '#fff'); g.addColorStop(0.3, el.light); g.addColorStop(0.6, el.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, size * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = el.light; ctx.lineWidth = 1.2;
      ctx.translate(x, y); ctx.rotate(now * 3);
      RUNES[pr.spell.element](ctx, size * 0.8); ctx.stroke();
      ctx.restore();
    }
  }

  // ---- overlays ---------------------------------------------------------
  drawFloaters(dt) {
    const ctx = this.ctx;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt * 0.9;
      if (f.life <= 0) { this.floaters.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life * 1.6);
      ctx.font = `700 21px ${THEME.sans}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x, f.y - (1 - f.life) * 44);
      ctx.restore();
    }
  }

  /** Dims everything but one named region, for the tutorial. */
  drawFocus(t) {
    if (!this.focus) return;
    const ctx = this.ctx;
    const r = this.focusRect(this.focus);
    if (!r) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.W, this.H);
    roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fillStyle = 'rgba(6,7,14,0.72)';
    ctx.fill('evenodd');
    roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.strokeStyle = `rgba(201,162,39,${0.35 + 0.2 * Math.sin(t * 3)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  focusRect(name) {
    const l = this.layout, m = 14;
    const box = l[name];
    if (!box) return null;
    if (name === 'mirror') return { x: box.x - m, y: box.y - 24, w: box.w + m * 2, h: box.h + m * 2 };
    return { x: box.x - m, y: box.y - m, w: box.w + m * 2, h: box.h + m * 2 };
  }

  /** Pulsing rings on the cells the tutorial wants touched. */
  drawHints(t) {
    if (!this.hints || !this.hints.length) return;
    const ctx = this.ctx, b = this.layout.board, cs = b.cell;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.save();
    for (const { r, c } of this.hints) {
      const x = b.x + c * cs, y = b.y + r * cs;
      roundRect(ctx, x + cs * 0.03, y + cs * 0.03, cs * 0.94, cs * 0.94, cs * 0.2);
      ctx.strokeStyle = `rgba(235,212,137,${0.45 + 0.45 * pulse})`;
      ctx.lineWidth = 2 + pulse * 2;
      ctx.shadowColor = 'rgba(235,212,137,0.9)';
      ctx.shadowBlur = 10 + pulse * 14;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCountdown(c) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(8,9,17,0.6)'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    const n = Math.ceil(c), pulse = 1 + (1 - (c % 1)) * 0.12;
    ctx.translate(this.W / 2, this.H / 2);
    ctx.scale(pulse, pulse);
    ctx.font = `600 82px ${THEME.serif}`;
    ctx.fillStyle = THEME.goldLit;
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
    this.tracked('The duel begins', this.W / 2, this.H / 2 + 44, { size: 10, color: THEME.inkDim, align: 'center' });
  }

  drawOverload(t) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.22 * Math.sin(t * 6);
    ctx.strokeStyle = THEME.danger; ctx.lineWidth = 5;
    ctx.strokeRect(2.5, 2.5, this.W - 5, this.H - 5);
    ctx.restore();
    this.tracked('Overload · both heroes are burning', this.W / 2, this.layout.lane.y + this.layout.lane.h - 2,
      { size: 9.5, color: '#F08494', align: 'center' });
  }

  drawResult(match) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(8,9,17,0.8)'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    const won = match.over.winner === 0, drew = match.over.winner === -1;
    ctx.font = `600 42px ${THEME.serif}`;
    ctx.fillStyle = drew ? THEME.ink : won ? THEME.goldLit : THEME.danger;
    ctx.fillText(drew ? 'Stalemate' : won ? 'Victory' : 'Defeat', this.W / 2, this.H / 2 - 8);
    ctx.restore();
    this.tracked(match.over.reason === 'time' ? 'Time cap · higher HP takes it' : `Decided in ${match.time.toFixed(1)}s`,
      this.W / 2, this.H / 2 + 18, { size: 10, color: THEME.inkDim, align: 'center' });
  }
}
