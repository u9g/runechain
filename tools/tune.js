const fs=require('fs'),vm=require('vm'),path=require('path');
function run(hp,asc,N=120){
 const ctx=vm.createContext({console,Math,Date});
 for(const f of ['data.js','engine.js','ai.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js',f),'utf8'),ctx,{filename:f});
 vm.runInContext(`for(const h of HEROES)h.baseHp=${hp};ASCENSION.advanced=${asc[0]};ASCENSION.elite=${asc[1]};ASCENSION.ultimate=${asc[2]};`,ctx);
 const r=vm.runInContext(`(()=>{const len=[],tiers={};let ko=0,cap=0;
  for(let i=0;i<${N};i++){const hA=HEROES[(Math.random()*6)|0],hB=HEROES[(Math.random()*6)|0];
   const a=new Player(hA,defaultLoadout(hA),(Math.random()*1e9)|0),b=new Player(hB,defaultLoadout(hB),(Math.random()*1e9)|0);
   const m=new Match(a,b,1);const ais=[new AI(a,m,0,'normal'),new AI(b,m,1,'normal')];
   while(!m.over&&m.time<200){m.update(1/60);for(const ai of ais)ai.update(1/60,m.time);}
   len.push(m.time);m.over&&m.over.reason==='ko'?ko++:cap++;
   const best={};for(const p of m.players)for(const[f,c]of Object.entries(p.charge))best[f]=Math.max(best[f]||0,c);
   const t=Math.max(0,...Object.values(best));
   const k=t>=ASCENSION.ultimate?'ult':t>=ASCENSION.elite?'elite':t>=ASCENSION.advanced?'adv':'basic';
   tiers[k]=(tiers[k]||0)+1;}
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length,p=(a,q)=>a.slice().sort((x,y)=>x-y)[(a.length*q)|0];
  return{avg:avg(len),p10:p(len,.1),p90:p(len,.9),ko,cap,tiers};})()`,ctx);
 console.log(`hp=${hp} asc=${asc}  len ${r.avg.toFixed(0)}s (p10 ${r.p10.toFixed(0)} p90 ${r.p90.toFixed(0)}) ko/cap ${r.ko}/${r.cap}  ${JSON.stringify(r.tiers)}`);
}
for(const hp of [1800,2400,3000]) for(const asc of [[12,30,55],[10,24,42],[8,20,36]]) run(hp,asc);
