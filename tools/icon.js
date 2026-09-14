// Renders the 1024 app icon from the game's own token vocabulary.
const puppeteer = require('/Users/jasonlernerman/code/chrome-devtools-mcp/node_modules/puppeteer-core');
const fs = require('fs'), path = require('path');

const html = `<html><body style="margin:0"><canvas id="c" width="1024" height="1024"></canvas><script>
const ctx = document.getElementById('c').getContext('2d');
const bg = ctx.createLinearGradient(0,0,1024,1024);
bg.addColorStop(0,'#131228'); bg.addColorStop(1,'#0a0b16');
ctx.fillStyle = bg; ctx.fillRect(0,0,1024,1024);
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
const cells=[[0,1,'#2f9dff'],[1,1,'#a760ff'],[1,0,'#a760ff'],[2,0,'#ff6a35'],[2,1,'#ff6a35'],[0,2,'#3fce6e']];
const S=250, OX=(1024-3*S)/2, OY=(1024-3*S)/2;
ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.92)'; ctx.lineWidth=46; ctx.lineCap='round'; ctx.lineJoin='round';
ctx.shadowColor='rgba(255,255,255,0.5)'; ctx.shadowBlur=60; ctx.beginPath();
const link=[[1,0],[1,1],[0,1],[0,2]];
link.forEach((p,i)=>{const x=OX+p[0]*S+S/2,y=OY+p[1]*S+S/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
ctx.stroke(); ctx.restore();
for(const [cx,cy,col] of cells){
  const x=OX+cx*S+22, y=OY+cy*S+22, w=S-44;
  const g=ctx.createLinearGradient(x,y,x,y+w); g.addColorStop(0,col); g.addColorStop(1,col+'99');
  rr(x,y,w,w,w*0.26); ctx.fillStyle=g; ctx.fill();
}
// anchor rune on the first cell of the chain
ctx.save(); ctx.translate(OX+1*S+S/2, OY+0*S+S/2);
ctx.fillStyle='rgba(16,14,30,0.92)'; ctx.beginPath();
ctx.moveTo(0,-72); ctx.lineTo(32,0); ctx.lineTo(0,72); ctx.lineTo(-32,0); ctx.closePath(); ctx.fill();
ctx.restore();
</script></body></html>`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  const out = path.join(__dirname, '../ios/RuneChain/Assets.xcassets/AppIcon.appiconset');
  fs.mkdirSync(out, { recursive: true });
  await (await page.$('#c')).screenshot({ path: path.join(out, 'icon-1024.png'), omitBackground: false });
  fs.writeFileSync(path.join(out, 'Contents.json'), JSON.stringify({
    images: [{ filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
    info: { author: 'xcode', version: 1 },
  }, null, 2));
  await browser.close();
  console.log('wrote', out);
})();
