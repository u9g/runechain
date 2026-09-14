const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx=vm.createContext({console,Math,Date});
for(const f of ['data.js','engine.js','ai.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js',f),'utf8'),ctx,{filename:f});
const r=vm.runInContext(`(()=>{const dist={},roles={},avail=[];
 for(let i=0;i<120;i++){const hA=HEROES[(Math.random()*6)|0],hB=HEROES[(Math.random()*6)|0];
  const a=new Player(hA,defaultLoadout(hA),(Math.random()*1e9)|0),b=new Player(hB,defaultLoadout(hB),(Math.random()*1e9)|0);
  const m=new Match(a,b,1);const ais=[new AI(a,m,0,'normal'),new AI(b,m,1,'normal')];
  while(!m.over&&m.time<200){m.update(1/60);
   for(const ai of ais){const bf=ai.p.cast;
    if(ai.state==='idle'&&ai.timer<=1/60){const o=ai.chains();if(o.length)avail.push(Math.max(...o.map(x=>x.path.length-1)));}
    ai.update(1/60,m.time);
    if(ai.p.cast&&ai.p.cast!==bf){dist[ai.p.cast.n]=(dist[ai.p.cast.n]||0)+1;roles[ai.p.cast.spell.role]=(roles[ai.p.cast.spell.role]||0)+1;}}}}
 return{dist,roles,avail:avail.reduce((x,y)=>x+y,0)/avail.length};})()`,ctx);
console.log('cast chain length n:',JSON.stringify(r.dist));
console.log('roles cast:',JSON.stringify(r.roles));
console.log('best available at think time:',r.avail.toFixed(2));
