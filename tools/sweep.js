const fs=require('fs'),vm=require('vm'),path=require('path');
function run(hp, greed, N=150){
  const ctx=vm.createContext({console,Math,Date});
  for(const f of ['data.js','engine.js','ai.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js',f),'utf8'),ctx,{filename:f});
  vm.runInContext(`for(const h of HEROES) h.baseHp=${hp}; DIFFICULTY.normal.greed=${greed};`,ctx);
  const len=[],chain=[],tiers={};let ko=0,cap=0;
  for(let i=0;i<N;i++){
    const r=vm.runInContext(`(()=>{const hA=HEROES[(Math.random()*6)|0],hB=HEROES[(Math.random()*6)|0];
      const a=new Player(hA,defaultLoadout(hA),(Math.random()*1e9)|0),b=new Player(hB,defaultLoadout(hB),(Math.random()*1e9)|0);
      const m=new Match(a,b,(Math.random()*1e9)|0);const ais=[new AI(a,m,0,'normal'),new AI(b,m,1,'normal')];
      let casts=0,ch=0;while(!m.over&&m.time<200){m.update(1/60);for(const ai of ais){const bf=ai.p.cast;ai.update(1/60,m.time);if(ai.p.cast&&ai.p.cast!==bf){casts++;ch+=ai.p.cast.n;}}}
      const best={};for(const p of m.players)for(const[f,c]of Object.entries(p.charge))best[f]=Math.max(best[f]||0,c);
      const top=Math.max(0,...Object.values(best));
      return{reason:m.over?m.over.reason:'hang',time:m.time,chain:ch/Math.max(1,casts),
        tier:top>=55?'ultimate':top>=30?'elite':top>=12?'advanced':'basic'};})()`,ctx);
    len.push(r.time);chain.push(r.chain);tiers[r.tier]=(tiers[r.tier]||0)+1;r.reason==='ko'?ko++:cap++;
  }
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length, p=(a,q)=>a.slice().sort((x,y)=>x-y)[(a.length*q)|0];
  console.log(`hp=${hp} greed=${greed}  len ${avg(len).toFixed(0)}s (p10 ${p(len,.1).toFixed(0)} p90 ${p(len,.9).toFixed(0)})  chain ${avg(chain).toFixed(2)}  ko/cap ${ko}/${cap}  ${JSON.stringify(tiers)}`);
}
for(const hp of [1000,1600,2200,2800]) for(const g of [0.75,0.95]) run(hp,g);
