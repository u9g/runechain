const fs=require('fs'),vm=require('vm'),path=require('path');
function run(cb,ab){
 const ctx=vm.createContext({console,Math,Date});
 for(const f of ['data.js','engine.js','ai.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js',f),'utf8')
    .replace(/const CLUSTER_BIAS = [\d.]+;/,`const CLUSTER_BIAS = ${cb};`)
    .replace(/const ANCHOR_ELEMENT_BIAS = \d+;/,`const ANCHOR_ELEMENT_BIAS = ${ab};`),ctx,{filename:f});
 const r=vm.runInContext(`(()=>{let dom=0,chain=0,n=0;
  for(let i=0;i<40;i++){const h=HEROES[(Math.random()*6)|0];
   const p=new Player(h,defaultLoadout(h),(Math.random()*1e9)|0);
   const m=new Match(p,new Player(h,defaultLoadout(h),1),1);m.countdown=0;
   const ai=new AI(p,m,0,'normal');
   for(let k=0;k<30;k++){
     const cnt={};for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)cnt[p.grid[r][c].el]=(cnt[p.grid[r][c].el]||0)+1;
     dom+=Math.max(...Object.values(cnt))/30;
     const o=ai.chains();if(o.length){chain+=Math.max(...o.map(x=>x.path.length-1));n++;
       const b=o[0];p.beginDrag(b.path[0].r,b.path[0].c);for(const c of b.path.slice(1))p.extendDrag(c.r,c.c);
       p.release(m.time);p.cast=null;p.lockUntil=0;}
   }}
  return{dom:dom/(40*30),chain:chain/n};})()`,ctx);
 console.log(`cluster=${cb} anchorBias=${ab}  dominant element ${(r.dom*100).toFixed(0)}% of board   best chain ${r.chain.toFixed(2)}`);
}
for(const cb of [0.2,0.35,0.45,0.55]) for(const ab of [0,1,2]) run(cb,ab);
