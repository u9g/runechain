const fs=require('fs'),vm=require('vm'),path=require('path');
for(const cb of [0,0.3,0.45,0.6,0.75]){
  const ctx=vm.createContext({console,Math,Date});
  for(const f of ['data.js','engine.js','ai.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js',f),'utf8').replace('const CLUSTER_BIAS = 0.5;',`const CLUSTER_BIAS = ${cb};`),ctx,{filename:f});
  const r=vm.runInContext(`(()=>{let sum=0,n=0,mx=0;
    for(let i=0;i<60;i++){const h=HEROES[(Math.random()*6)|0];
      const p=new Player(h,defaultLoadout(h),(Math.random()*1e9)|0);
      const m=new Match(p,new Player(h,defaultLoadout(h),1),1); m.countdown=0;
      const ai=new AI(p,m,0,'normal');
      for(let k=0;k<40;k++){const opts=ai.chains();
        if(opts.length){const best=Math.max(...opts.map(o=>o.path.length-1));sum+=best;n++;mx=Math.max(mx,best);}
        const o=ai.chains()[0]; if(o){p.beginDrag(o.path[0].r,o.path[0].c);for(const c of o.path.slice(1))p.extendDrag(c.r,c.c);p.release(m.time);p.lockUntil=0;p.cast=null;}
      }}
    return {avg:sum/n,mx};})()`,ctx);
  console.log(`cluster=${cb}  best-available chain avg ${r.avg.toFixed(2)}  max ${r.mx}`);
}
