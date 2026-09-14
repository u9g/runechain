// Asserts each tutorial step lights the region it is talking about, and only it.
const puppeteer = require('/Users/jasonlernerman/code/chrome-devtools-mcp/node_modules/puppeteer-core');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(process.env.URL || 'http://localhost:8731/index.html', { waitUntil: 'load' });
  await wait(600);

  const probe = await page.evaluate(() => {
    const r = state.renderer, m = state.match;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const lum = (x, y) => {
      const d = r.ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
      return d[0] + d[1] + d[2];
    };
    const points = () => ({
      board: [r.layout.board.x + r.layout.board.cell * 0.5, r.layout.board.y + r.layout.board.cell * 0.5],
      mirror: [r.layout.mirror.x + r.layout.mirror.cell * 0.5, r.layout.mirror.y + r.layout.mirror.cell * 0.5],
      selfBar: [r.layout.selfBar.x + 30, r.layout.selfBar.y + 28],
    });
    const draw = (focus) => { r.focus = focus; r.draw(m, m.players[0], m.players[1], 0.016); };

    draw(null);
    const base = Object.fromEntries(Object.entries(points()).map(([k, p]) => [k, lum(...p)]));
    const out = {};
    for (const step of TUTORIAL_STEPS) {
      draw(step.focus);
      const now = Object.fromEntries(Object.entries(points()).map(([k, p]) => [k, lum(...p)]));
      out[step.id] = {
        focus: Array.isArray(step.focus) ? step.focus : (step.focus ? [step.focus] : []),
        // a region counts as dimmed if it lost more than a tenth of its light
        dimmed: Object.keys(base).filter(k => now[k] < base[k] * 0.9),
      };
    }
    draw(null);
    return out;
  });

  let bad = 0;
  for (const [id, r] of Object.entries(probe)) {
    const shouldDim = r.focus.length ? ['board', 'mirror', 'selfBar'].filter(k => !r.focus.includes(k)) : [];
    const ok = shouldDim.length === r.dimmed.length && shouldDim.every(k => r.dimmed.includes(k));
    if (!ok) bad++;
    console.log(`${ok ? '  ok ' : 'FAIL'}  ${id.padEnd(10)} focus=${(r.focus.join('+') || 'none').padEnd(16)} dimmed=[${r.dimmed.join(', ')}]`);
  }
  console.log(bad ? `\n${bad} step(s) spotlight the wrong region` : '\nevery step lights exactly its own region');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
