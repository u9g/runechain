// Walks the scripted tutorial the way a player would, gate by gate.
const puppeteer = require('/Users/jasonlernerman/code/chrome-devtools-mcp/node_modules/puppeteer-core');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '../shots'); fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(process.env.URL || 'http://localhost:8731/index.html', { waitUntil: 'load' });
  await page.addStyleTag({ content: '#safeProbe{padding-top:59px;padding-bottom:34px}' });
  await wait(400);

  const step = () => page.evaluate(() => state.tutorial && state.tutorial.step.id);
  const shot = (n) => page.screenshot({ path: path.join(OUT, `tut-${n}.png`) });

  // step 1: a tap step
  console.log('step', await step());
  await shot('1-board');
  await page.click('#coachNext');
  await wait(300);

  // steps 2-4: touch the hinted anchor, drag the chain, release
  const chainPts = async (len) => page.evaluate((len) => {
    const p = state.match.players[0], b = state.renderer.layout.board;
    const hints = state.tutorial.allowedCells();
    const start = hints[0];
    const el = p.grid[start.r][start.c].el;
    const path = [start], seen = new Set([start.r * COLS + start.c]);
    let grew = true;
    while (grew && path.length < len) {
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
  }, len);

  const drawChain = async (len, shots = {}) => {
    const pts = await chainPts(len);
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.mouse.down();
    if (shots.onTouch) { await wait(250); await shot(shots.onTouch); }
    for (const pt of pts.slice(1)) { await page.mouse.move(pt.x, pt.y); await wait(90); }
    if (shots.onDrag) { await wait(200); await shot(shots.onDrag); }
    await page.mouse.up();
    await wait(500);
  };

  console.log('step', await step());
  await drawChain(5, { onTouch: '2-anchor', onDrag: '3-drag' });
  await wait(1400);
  console.log('after release, step', await step());
  await shot('4-cast');

  // step 5: a chain of five or more
  if (await step() === 'power') { await drawChain(6); await wait(1600); }
  console.log('step', await step());

  // step 6: the construct reveals its chain on the mirror
  await wait(1800);
  await shot('5-mirror');
  let guard = 0;
  while (await step() === 'mirror' && guard++ < 60) await wait(200);
  console.log('step', await step());

  // step 7: ward before impact
  await shot('6-ward-prompt');
  if (await step() === 'ward') { await drawChain(7); await wait(1200); }
  await shot('7-warded');
  console.log('step', await step());

  if (await step() === 'ascension') { await page.click('#coachNext'); await wait(300); }
  console.log('step', await step());
  await shot('8-done');
  await page.click('#coachNext');
  await wait(400);
  const done = await page.evaluate(() => ({
    screen: document.querySelector('.screen.active').id,
    tutorialDone: JSON.parse(localStorage.getItem('runechain.save')).tutorialDone,
  }));
  console.log('finished ->', JSON.stringify(done));
  await shot('9-home');
  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
  await browser.close();
})();
