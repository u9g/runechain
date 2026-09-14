const puppeteer = require('/Users/jasonlernerman/code/chrome-devtools-mcp/node_modules/puppeteer-core');
const path = require('path');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  // returning player: tutorial already done
  await page.evaluateOnNewDocument(() => localStorage.setItem('runechain.save', JSON.stringify({ heroId: 'vesk', difficulty: 'normal', tutorialDone: true, loadouts: {} })));
  await page.goto(process.env.URL || 'http://localhost:8731/index.html', { waitUntil: 'load' });
  await page.addStyleTag({ content: '#safeProbe{padding-top:59px;padding-bottom:34px}' });
  await wait(400);
  await page.screenshot({ path: path.join(__dirname, '../shots/menu-home.png') });
  await page.click('#loadoutBtn');
  await wait(300);
  await page.screenshot({ path: path.join(__dirname, '../shots/menu-loadout.png') });
  await page.evaluate(() => document.querySelector('#loadoutBody').scrollTop = 520);
  await wait(200);
  await page.screenshot({ path: path.join(__dirname, '../shots/menu-loadout2.png') });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
  await browser.close();
})();
