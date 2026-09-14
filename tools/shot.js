// iPhone-viewport screenshots + console error capture.
const puppeteer = require('/Users/jasonlernerman/code/chrome-devtools-mcp/node_modules/puppeteer-core');
const path = require('path');
const OUT = path.join(__dirname, '../shots');
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--force-device-scale-factor=3'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));

  // returning player: skip the first-run tutorial
  await page.evaluateOnNewDocument(() => localStorage.setItem('runechain.save',
    JSON.stringify({ heroId: 'vesk', difficulty: 'normal', tutorialDone: true, loadouts: {} })));
  await page.goto(process.env.URL || 'http://localhost:8731/index.html', { waitUntil: 'load' });
  if (process.env.INSETS) {
    // Stand in for a notched device: env() does not resolve in desktop Chrome.
    await page.addStyleTag({ content: '#safeProbe{padding-top:59px;padding-bottom:34px} :root{--sat:59px;--sab:34px}' });
  }
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '1-home.png') });

  await page.click('#loadoutBtn');
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(OUT, '2-loadout.png') });

  await page.click('#loadoutBack');
  await page.click('#playBtn');
  await new Promise(r => setTimeout(r, 3600));
  await page.screenshot({ path: path.join(OUT, '3-battle.png') });

  // Drag a chain from a live anchor, to exercise input + highlight.
  const drag = await page.evaluate(() => {
    const p = state.match.players[0], r = state.renderer, b = r.layout.board;
    const anchors = p.anchorCells();
    let best = null;
    for (const a of anchors) {
      const el = p.grid[a.r][a.c].el;
      const path = [a];
      const seen = new Set([a.r * COLS + a.c]);
      let grew = true;
      while (grew && path.length < 5) {
        grew = false;
        const last = path[path.length - 1];
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = last.r + dr, nc = last.c + dc;
          if (nr<0||nc<0||nr>=ROWS||nc>=COLS||seen.has(nr*COLS+nc)) continue;
          const cell = p.grid[nr][nc];
          if (cell.spellId || cell.el !== el) continue;
          path.push({r:nr,c:nc}); seen.add(nr*COLS+nc); grew = true; break;
        }
      }
      if (!best || path.length > best.length) best = path;
    }
    return best.map(c => ({ x: b.x + c.c * b.cell + b.cell/2, y: b.y + c.r * b.cell + b.cell/2 }));
  });
  await page.mouse.move(drag[0].x, drag[0].y);
  await page.mouse.down();
  for (const pt of drag.slice(1)) { await page.mouse.move(pt.x, pt.y); await new Promise(r=>setTimeout(r,60)); }
  await page.screenshot({ path: path.join(OUT, '4-drag.png') });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, '5-cast.png') });

  await new Promise(r => setTimeout(r, 6000));
  await page.screenshot({ path: path.join(OUT, '6-midfight.png') });

  const st = await page.evaluate(() => ({
    chainLen: drag_len_unused = 0,
    hpMe: Math.round(state.match.players[0].hp),
    hpFoe: Math.round(state.match.players[1].hp),
    t: +state.match.time.toFixed(1),
    fps: 0,
  }));
  console.log('state', JSON.stringify(st));
  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
  await browser.close();
})();
