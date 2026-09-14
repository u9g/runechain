// Asserts the ward lesson cannot be passed by warding after the hit lands.
const puppeteer = require('/Users/jasonlernerman/code/chrome-devtools-mcp/node_modules/puppeteer-core');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:8731/index.html', { waitUntil: 'load' });
  await wait(400);

  // jump straight to the ward step
  await page.evaluate(() => {
    const t = state.tutorial;
    t.index = TUTORIAL_STEPS.findIndex(s => s.id === 'mirror');
    t.enter();
  });
  await wait(3200);
  const atWard = await page.evaluate(() => state.tutorial.step.id);

  // sit on our hands through a full strike: the step must not advance
  await wait(3500);
  const after = await page.evaluate(() => ({
    step: state.tutorial.step.id,
    blocked: state.tutorial.wardBlocked,
    hp: Math.round(state.match.players[0].hp),
    strikes: state.match.players[0].maxHp - Math.round(state.match.players[0].hp),
  }));

  // now actually ward: chain the hinted anchor
  const pts = await page.evaluate(() => {
    const p = state.match.players[0], b = state.renderer.layout.board;
    const start = state.tutorial.allowedCells()[0];
    const el = p.grid[start.r][start.c].el;
    const path = [start], seen = new Set([start.r * COLS + start.c]);
    let grew = true;
    while (grew && path.length < 7) {
      grew = false;
      const last = path[path.length - 1];
      for (const [dr, dc] of [[0,1],[1,0],[0,-1],[-1,0]]) {
        const nr = last.r + dr, nc = last.c + dc;
        if (nr<0||nc<0||nr>=ROWS||nc>=COLS||seen.has(nr*COLS+nc)) continue;
        const cell = p.grid[nr][nc];
        if (cell.spellId || cell.el !== el) continue;
        path.push({r:nr,c:nc}); seen.add(nr*COLS+nc); grew = true; break;
      }
    }
    return path.map(c => ({ x: b.x + c.c * b.cell + b.cell/2, y: b.y + c.r * b.cell + b.cell/2 }));
  });
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const pt of pts.slice(1)) { await page.mouse.move(pt.x, pt.y); await wait(70); }
  await page.mouse.up();
  await wait(4000);
  const done = await page.evaluate(() => ({ step: state.tutorial.step.id, blocked: state.tutorial.wardBlocked }));

  console.log(`reached ward step:            ${atWard === 'ward'}`);
  console.log(`stayed put while idle:        ${after.step === 'ward' && !after.blocked}`);
  console.log(`construct kept striking:      ${after.strikes === 0 ? 'no (healed between passes)' : 'yes, took ' + after.strikes}`);
  console.log(`advanced only after a block:  ${done.blocked && done.step !== 'ward'}`);
  await browser.close();
})();
