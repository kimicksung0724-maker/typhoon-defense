/* 태풍 방어선 — deterministic simulation; all drawing starts inside boot(). */
'use strict';
(() => {
const CONFIG = Object.freeze({
  W:12,H:12,dt:0.1,flow:1.6,soak:0.01,seawallH:2.2,gateH:0.6,
  baseSea:0.3,peaks:[1.6,2.0,2.6],durations:[25,30,35],rain:[0.006,0.010,0.015],
  costs:{dyke:8,drain:4,pump:30},pumpRate:0.35,drainRate:0.05,floodDepth:0.30,
  initialCoins:120,reward:40,dryReward:10,maxParticles:300
});
const STYLE = {
  palette:{ground:'#EEE8D5',paper:'#FFFDF6',grass:'#D9E5BD',grassDark:'#B9CC98',hill:'#A6BD8A',road:'#E7DDC7',sand:'#E9DDBF',stone:'#C9BFA8',stoneDark:'#A89D86',dyke:'#D6CAB0',seaDeep:'#5E93A3',sea:'#7FAEBB',water:'#8BB9C3',waterShallow:'#BFDCDF',waterDeep:'#4F7F8F',drain:'#9FB3AE',leaf:'#729D86',leafLight:'#9BC39A',roof:'#E09F7D',berry:'#D98E8B',sun:'#F2C66D',sky:'#C9D6DC',stamp:'#D2645C',ink:'#344B44',muted:'#7B8980',cabbage:'#A9C98A',shadow:'rgba(52,75,68,0.18)'},
  radius:{plot:12,building:4.5,pill:999},shadow:{x:0,y:3,color:'rgba(52,75,68,0.18)'}
};
const P=STYLE.palette, W=12, N=144, index=(x,y)=>y*W+x;
const LEVEL = {
  // High northern terraces, two shallow creek fingers, a low coastal bowl.
  terrain:[
    [4.1,4.1,4.0,3.9,3.8,3.8,3.9,4.0,4.0,4.1,4.2,4.2],
    [3.8,3.7,3.6,3.5,3.4,3.5,3.6,3.6,3.7,3.8,3.9,3.9],
    [3.5,3.4,3.2,3.0,2.9,3.0,3.1,3.0,3.2,3.4,3.5,3.6],
    [3.1,3.0,2.8,2.6,2.5,2.6,2.7,2.5,2.7,2.9,3.1,3.2],
    [2.8,2.5,2.3,2.1,2.0,2.2,2.3,2.0,2.1,2.4,2.6,2.8],
    [2.5,2.0,1.8,1.5,1.6,1.8,1.9,1.6,1.5,1.8,2.0,2.5],
    [2.4,1.4,1.1,1.0,1.2,1.4,1.4,1.2,1.0,1.1,1.4,2.4],
    [2.4,1.0,0.9,0.8,0.9,1.1,1.1,0.9,0.8,0.9,1.0,2.4],
    [2.5,2.4,1.2,0.7,0.8,1.0,1.0,0.8,0.7,1.2,2.4,2.5],
    [2.2,2.2,2.2,0.6,2.2,2.2,2.2,2.2,0.6,2.2,2.2,2.2],
    [0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0]
  ],
  buildings:[
    {id:0,x:2,y:4,kind:'house',label:'언덕집'},
    {id:1,x:9,y:4,kind:'house',label:'소나무집'},
    {id:2,x:1,y:5,kind:'house',label:'바람집'},
    {id:3,x:5,y:5,kind:'shop',label:'편의점'},
    {id:4,x:10,y:5,kind:'house',label:'달빛집'},
    {id:5,x:2,y:6,kind:'house',label:'마당집'},
    {id:6,x:9,y:6,kind:'shop',label:'슈퍼'},
    {id:7,x:1,y:7,kind:'house',label:'돌담집'},
    {id:8,x:4,y:7,kind:'house',label:'물결집'},
    {id:9,x:7,y:7,kind:'house',label:'모래집'},
    {id:10,x:4,y:8,kind:'house',label:'포구집'},
    {id:11,x:7,y:8,kind:'house',label:'등대집'}
  ],gates:[{x:3,y:9},{x:8,y:9}]
};
const SOLUTION = [
  {before:1,actions:[['pump',3,8],['pump',8,8],['drain',3,7],['drain',3,6],['drain',4,6],['drain',5,6],['drain',6,6],['drain',7,6],['drain',8,6],['drain',8,7],['dyke',2,8],['dyke',9,8]],gatePlan:[[7,0,false],[7,1,false],[23,0,true],[23,1,true]],card:0},
  {before:2,actions:[['remove',3,7],['pump',3,7],['remove',8,7],['pump',8,7],['dyke',5,8],['dyke',6,8],['remove',4,6],['pump',4,6],['remove',7,6],['pump',7,6]],gatePlan:[[6,0,false],[6,1,false],[28,0,true],[28,1,true]],card:0},
  {before:3,actions:[['pump',5,7],['pump',6,7],['dyke',0,8],['dyke',1,8],['dyke',10,8],['dyke',11,8],['drain',2,7],['drain',9,7]],gatePlan:[[5,0,false],[5,1,false],[33,0,true],[33,1,true]],card:0}
];
const CARDS = {
  pump:{title:'추가 펌프',desc:'무료 펌프 1개'},dyke:{title:'긴 제방',desc:'제방 6칸 무료'},
  boost:{title:'펌프 강화',desc:'모든 펌프 +50%'},sand:{title:'모래주머니',desc:'위험한 두 집을 보호'},
  drain:{title:'배수로 확장',desc:'배수로 8칸 무료'},coins:{title:'긴급 자금',desc:'코인 +60'}
};
const neighbours=Array.from({length:N},(_,i)=>{const x=i%12,y=Math.floor(i/12);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&a<12&&b>=0&&b<12).map(([a,b])=>index(a,b));});
const pairs=[];
for(let y=0;y<12;y++)for(let x=0;x<12;x++){if(x<11)pairs.push([index(x,y),index(x+1,y)]);if(y<11)pairs.push([index(x,y),index(x,y+1)]);}
function createGame(seed=1){
  const s={seed:seed>>>0,phase:'build',wave:0,time:0,coins:CONFIG.initialCoins,terrain:LEVEL.terrain.flat(),water:new Float64Array(N),struct:Array(N).fill('none'),gates:LEVEL.gates.map(g=>({...g,open:true})),flooded:new Set(),maxDepth:new Float64Array(N),pumpedTotal:0,pumpRates:new Float64Array(N),flowX:new Float64Array(N),flowY:new Float64Array(N),history:[],free:{pump:0,dyke:0,drain:0},pumpBoost:1,sandbags:[],networks:[],paths:{},networkDirty:true,remainder:0,events:[],choices:[]};
  for(let x=0;x<12;x++)s.struct[index(x,9)]='seawall';
  for(const g of s.gates)s.struct[index(g.x,g.y)]='gate';
  for(const b of LEVEL.buildings)s.struct[index(b.x,b.y)]=b.kind;
  for(let i=120;i<N;i++)s.water[i]=CONFIG.baseSea;
  return s;
}
function emit(s,type,data={}){s.events.push({type,...data});if(s.events.length>96)s.events.shift();}
function validCell(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<12&&y>=0&&y<9;}
function canPlace(s,type,x,y){return s.phase==='build'&&validCell(x,y)&&Object.hasOwn(CONFIG.costs,type)&&s.struct[index(x,y)]==='none'&&(s.free[type]>0||s.coins>=CONFIG.costs[type]);}
function place(s,type,x,y){if(!canPlace(s,type,x,y))return false;const i=index(x,y);if(s.free[type]>0)s.free[type]--;else s.coins-=CONFIG.costs[type];s.struct[i]=type;if(type==='dyke')s.water[i]=0;s.networkDirty=true;emit(s,'place',{i,type});return true;}
function remove(s,x,y){if(s.phase!=='build'||!validCell(x,y))return false;const i=index(x,y),type=s.struct[i];if(!Object.hasOwn(CONFIG.costs,type))return false;s.coins+=Math.floor(CONFIG.costs[type]/2);s.struct[i]='none';s.networkDirty=true;emit(s,'remove',{i});return true;}
function setGate(s,gateIndex,open){const g=s.gates[gateIndex];if(!g||!['wave','build'].includes(s.phase))return false;if(g.open!==!!open){g.open=!!open;s.networkDirty=true;emit(s,'gate',{gateIndex,open:g.open});}return true;}
function gates(s){return s.gates.map(g=>({...g}));}
function buildings(){return LEVEL.buildings.map(b=>({...b}));}
function waterAt(s,x,y){return x>=0&&x<12&&y>=0&&y<12?s.water[index(x,y)]:0;}
function seaLevel(s){if(s.phase!=='wave')return CONFIG.baseSea;const w=Math.max(0,s.wave-1),t=s.time,d=CONFIG.durations[w];return CONFIG.baseSea+CONFIG.peaks[w]*Math.sin(Math.PI*Math.min(t,d)/d)**2+0.08*Math.sin(2*Math.PI*t/3)*Math.sin(Math.PI*Math.min(t,d)/d);}
function networkCell(s,i){return ['drain','pump','gate'].includes(s.struct[i]);}
function updateNetworks(s){
  if(!s.networkDirty)return;s.networkDirty=false;s.networks=[];s.paths={};const seen=new Set();
  for(let i=0;i<120;i++)if(networkCell(s,i)&&!seen.has(i)){
    const cells=[],queue=[i],pump=[],outlets=[];seen.add(i);
    for(let n=0;n<queue.length;n++){const a=queue[n];cells.push(a);if(s.struct[a]==='pump')pump.push(a);if(s.struct[a]==='gate')outlets.push(s.gates.find(g=>index(g.x,g.y)===a));for(const b of neighbours[a])if(networkCell(s,b)&&!seen.has(b)){seen.add(b);queue.push(b);}}
    const outlet=outlets.find(g=>g.open)||outlets[0],net={cells,pumps:pump,outlets,outlet,connected:!!outlet,rate:0};s.networks.push(net);
    if(outlet){const root=index(outlet.x,outlet.y),q=[root],parent=new Map([[root,-1]]);for(let n=0;n<q.length;n++)for(const b of neighbours[q[n]])if(networkCell(s,b)&&!parent.has(b)){parent.set(b,q[n]);q.push(b);}for(const a of cells){const path=[a];let p=a;while(parent.get(p)!==-1&&parent.has(p)){p=parent.get(p);path.push(p);}s.paths[a]=path;}}
  }
}
function startWave(s){if(s.phase!=='build'||s.wave>=3)return false;s.phase='wave';s.wave++;s.time=0;s.remainder=0;s.flooded.clear();s.maxDepth.fill(0);s.pumpedTotal=0;s.pumpRates.fill(0);s.backflowShown=false;updateNetworks(s);emit(s,'wave',{wave:s.wave});return true;}
function isBlocked(s,i,sea){if(s.struct[i]==='dyke')return true;if(s.struct[i]==='seawall')return sea<=CONFIG.seawallH;if(s.struct[i]==='gate'){const g=s.gates[i%12===3?0:1];return !g.open;}return false;}
function pumpFrom(s,ids,capacity){let left=capacity,removed=0;let active=ids.filter(i=>s.water[i]>0&&i<120&&!isBlocked(s,i,seaLevel(s)));for(let n=0;n<5&&left>1e-10&&active.length;n++){const share=left/active.length;let used=0;for(const i of active){const q=Math.min(share,s.water[i]);s.water[i]-=q;used+=q;}removed+=used;left-=used;active=active.filter(i=>s.water[i]>1e-10);}return removed;}
function fixedStep(s,dt){
  s.time=Math.min(CONFIG.durations[s.wave-1],s.time+dt);const sea=seaLevel(s),rain=CONFIG.rain[s.wave-1];
  for(let i=0;i<N;i++){if(i>=120)s.water[i]=sea;else if(!isBlocked(s,i,sea))s.water[i]+=rain*dt;}
  const before=Float64Array.from(s.water),out=new Float64Array(N),transfers=[];s.flowX.fill(0);s.flowY.fill(0);
  for(const [a,b] of pairs){if(isBlocked(s,a,sea)||isBlocked(s,b,sea))continue;const sa=a>=120?sea:s.terrain[a]+before[a],sb=b>=120?sea:s.terrain[b]+before[b];if(Math.abs(sa-sb)<1e-10)continue;const from=sa>sb?a:b,to=sa>sb?b:a;const q=Math.min(from>=120?Infinity:before[from],Math.abs(sa-sb)*CONFIG.flow*dt);if(q>0){transfers.push([from,to,q]);out[from]+=q;}}
  for(const [a,b,amount] of transfers){const q=amount*(a>=120?1:Math.min(1,before[a]/Math.max(out[a],1e-10)));if(a<120)s.water[a]-=q;if(b<120)s.water[b]+=q;const dx=(b%12-a%12)*q/dt,dy=(Math.floor(b/12)-Math.floor(a/12))*q/dt;s.flowX[a]+=dx;s.flowX[b]+=dx;s.flowY[a]+=dy;s.flowY[b]+=dy;}
  updateNetworks(s);s.pumpRates.fill(0);let allRate=0;
  for(const net of s.networks){net.rate=0;const mult=(net.connected?(net.outlet.open?1:0.6):0.15)*(net.connected?1+Math.max(0,net.pumps.length-1)*0.15:1);
    for(const i of net.pumps){const q=pumpFrom(s,[i,...neighbours[i]],CONFIG.pumpRate*s.pumpBoost*mult*dt);s.pumpRates[i]=q/dt;s.pumpedTotal+=q;net.rate+=q/dt;}
    for(const i of net.cells)if(s.struct[i]==='drain'){const q=Math.min(s.water[i],CONFIG.drainRate*dt*(net.connected?1:0));s.water[i]-=q;s.pumpedTotal+=q;net.rate+=q/dt;}
    if(net.connected)allRate+=net.rate;
  }
  if(allRate>=.2&&!s.backflowShown){s.backflowShown=true;emit(s,'backflow');}
  for(let i=0;i<120;i++){s.water[i]=Math.max(0,s.water[i]-CONFIG.soak*dt);s.maxDepth[i]=Math.max(s.maxDepth[i],s.water[i]);}
  for(const b of LEVEL.buildings){const i=index(b.x,b.y),limit=CONFIG.floodDepth+(s.sandbags.includes(b.id)?.25:0);if(s.water[i]>=limit&&!s.flooded.has(b.id)){s.flooded.add(b.id);emit(s,'flood',{id:b.id,i});}}
  if(s.time>=CONFIG.durations[s.wave-1]-1e-8)finishWave(s);
}
function finishWave(s){const floodedIds=[...s.flooded].sort((a,b)=>a-b),nearMissIds=LEVEL.buildings.filter(b=>!s.flooded.has(b.id)&&[index(b.x,b.y),...neighbours[index(b.x,b.y)]].some(i=>s.maxDepth[i]>=.10)).map(b=>b.id),reward=CONFIG.reward+CONFIG.dryReward*(12-floodedIds.length);s.lastResult={wave:s.wave,flooded:floodedIds.length,floodedIds,nearMiss:nearMissIds.length,nearMissIds,pumped:s.pumpedTotal,reward};s.history.push({...s.lastResult});s.coins+=reward;s.phase='result';emit(s,'result');}
function step(s,dt){if(s.phase!=='wave'||!Number.isFinite(dt)||dt<=0)return;s.remainder+=dt;while(s.remainder>=CONFIG.dt-1e-8&&s.phase==='wave'){s.remainder-=CONFIG.dt;fixedStep(s,CONFIG.dt);}}
function seeded(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function ackResult(s){if(s.phase!=='result')return;s.phase=s.wave===3?'final':'card';if(s.phase==='card'){const pool=['dyke','sand','drain','coins'];for(let i=pool.length-1;i>0;i--){const j=Math.floor(seeded(s)*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}s.choices=[s.wave===1?'boost':'pump',pool[0],pool[1]];}}
function cardChoices(s){return s.phase==='card'?[...s.choices]:[];}
function chooseCard(s,n){if(s.phase!=='card'||!s.choices[n])return false;const c=s.choices[n];if(c==='boost')s.pumpBoost*=1.5;if(c==='pump')s.free.pump++;if(c==='dyke')s.free.dyke+=6;if(c==='drain')s.free.drain+=8;if(c==='coins')s.coins+=60;if(c==='sand'){const atRisk=[...LEVEL.buildings].filter(b=>!s.sandbags.includes(b.id)).sort((a,b)=>s.terrain[index(a.x,a.y)]-s.terrain[index(b.x,b.y)]||a.id-b.id);s.sandbags.push(...atRisk.slice(0,2).map(b=>b.id));}s.water.fill(0);for(let i=120;i<N;i++)s.water[i]=CONFIG.baseSea;s.flooded.clear();s.pumpRates.fill(0);s.flowX.fill(0);s.flowY.fill(0);s.phase='build';s.time=0;s.remainder=0;emit(s,'card',{card:c});return true;}
const api={CONFIG,LEVEL,SOLUTION,createGame,place,remove,setGate,gates,startWave,step,ackResult,cardChoices,chooseCard,buildings,waterAt,seaLevel,canPlace};
globalThis.Typhoon=api;if(typeof module!=='undefined')module.exports=api;
if(typeof document!=='undefined')boot();

function boot(){
  const $=id=>document.getElementById(id), canvas=$('map'),ctx=canvas.getContext('2d'),fx=$('fx'),fctx=fx.getContext('2d');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state=createGame(1),intro=true,tool='dyke',speed=1,size=360,dpr=1,terrainCanvas=null;
  let elapsed=0,last=0,acc=0,stampAge=-1,impact=false,shake=0,toastTime=0,coachStep=0,coachTime=0;
  let displayCoins=120,coinTarget=120,coinFrom=120,coinAge=1,cardBusy=false,waveTitleAge=99;
  let ghost=null,drag=null,ghostError=0,splashClock=0,packetClock=0,glowAge=99,hudClock=0;
  const vis=new Float64Array(N),gateVis=[1,1],rotors=new Float64Array(N),popTimes=new Float64Array(N).fill(-99),floodTimes=new Float64Array(12).fill(-99);
  const particles=Array.from({length:CONFIG.maxParticles},()=>({alive:false}));
  const terrainCtx=()=>terrainCanvas.getContext('2d');
  const E={cubic:t=>1-(1-t)**3,back:t=>1+2.5*(t-1)**3+1.5*(t-1)**2};
  let audio=null,soundOn=true;
  function sound(kind){
    if(!soundOn)return;
    try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();
      const now=audio.currentTime,g=audio.createGain();g.connect(audio.destination);
      const o=audio.createOscillator();o.connect(g);o.type='sine';
      const settings={tap:[420,280,.06,.025],place:[330,620,.08,.025],gate:[210,380,.08,.035],flood:[150,72,.25,.045],stamp:[70,36,.25,.17],wave:[60,35,.8,.04],card:[440,660,.18,.025]};
      const [a,b,d,v]=settings[kind]||settings.tap;o.frequency.setValueAtTime(a,now);o.frequency.exponentialRampToValueAtTime(b,now+d);g.gain.setValueAtTime(v,now);g.gain.exponentialRampToValueAtTime(.001,now+d);o.start(now);o.stop(now+d);
      if(kind==='stamp'||kind==='wave'){const len=Math.floor(audio.sampleRate*(kind==='stamp'?.15:.8)),buf=audio.createBuffer(1,len,audio.sampleRate),data=buf.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*(1-i/len);const n=audio.createBufferSource(),ng=audio.createGain(),filter=audio.createBiquadFilter();n.buffer=buf;filter.type='lowpass';filter.frequency.value=kind==='stamp'?420:120;ng.gain.value=kind==='stamp'?.09:.035;n.connect(filter);filter.connect(ng);ng.connect(audio.destination);n.start(now);}
    }catch{/* Sound is optional when the browser has no audio device. */}
  }
  function rr(c,x,y,w,h,r,fill){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  function circle(c,x,y,r,fill){c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
  function line(c,points,color,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
  function drawBlock(c,x,y,w,h,fill,r=4,side=P.stoneDark,shadow=3){
    rr(c,x+STYLE.shadow.x,y+shadow,w,h,r,STYLE.shadow.color);
    rr(c,x,y,w,h,r,side);rr(c,x,y,w,h-2.5,r,fill);
  }
  function text(c,label,x,y,size=12,color=P.ink,align='center',weight=800){c.fillStyle=color;c.font=weight+' '+size+'px system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillText(label,x,y);}
  function alpha(c,a,fn){c.save();c.globalAlpha=a;fn();c.restore();}
  function particle(type,data){const p=particles.find(p=>!p.alive);if(!p)return;Object.keys(p).forEach(k=>{if(k!=='alive')delete p[k];});Object.assign(p,{alive:true,type,age:0,life:1},data);}
  function toast(label,duration=2.3){$('toast').textContent=label;$('toast').classList.add('visible');toastTime=duration;}
  function cssIcon(can,kind,scale=1){
    const w=can.clientWidth||42,h=can.clientHeight||37;can.width=Math.round(w*2);can.height=Math.round(h*2);const c=can.getContext('2d');c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.scale(scale,scale);
    if(kind==='dyke'){drawBlock(c,-19,-5,38,15,P.dyke,5);rr(c,-10,-4,2,8,1,P.stone);rr(c,8,-4,2,8,1,P.stone);}
    if(kind==='drain'){line(c,[[-18,-6],[-5,-6],[-5,7],[18,7]],P.drain,12);line(c,[[-18,-7],[-5,-7],[-5,6],[18,6]],P.waterShallow,5);}
    if(kind==='pump'){drawPump(c,0,0,0,true,0,1);}
    if(kind==='remove'){c.save();c.rotate(-.55);rr(c,-3,-12,6,27,3,P.stoneDark);drawBlock(c,-13,-14,26,11,P.stone,3);c.restore();}
    c.restore();
  }
  function drawPump(c,x,y,angle,connected,rate,scale=1){
    c.save();c.translate(x,y);c.scale(scale,scale);
    circle(c,0,3,10.5,P.shadow);circle(c,0,0,10.5,P.stoneDark);circle(c,0,-1.5,10.5,P.leaf);
    circle(c,0,-1.8,7.8,P.ink);c.save();c.translate(0,-1.8);c.rotate(angle);for(let j=0;j<4;j++){c.rotate(Math.PI/2);rr(c,1,-2,5.7,3.5,2,P.paper);}circle(c,0,0,2.3,P.drain);c.restore();
    circle(c,7,5,2.5,connected?P.sun:P.berry);
    if(!connected){circle(c,7,5,.9,P.paper);if(scale<=1)text(c,'끊김',0,-16,6.5,P.berry);}
    if(rate>.03)alpha(c,.15+.1*Math.sin(elapsed*9),()=>{circle(c,0,-1,13,P.sun);});c.restore();
  }
  // Marching squares. Scalar values live at the 13 x 13 cell-corner lattice.
  // Cases 5/10 use the centre value to resolve saddle topology deterministically.
  function lattice(field){const out=new Float64Array(169);for(let y=0;y<=12;y++)for(let x=0;x<=12;x++){let sum=0,n=0;for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){const a=x+dx,b=y+dy;if(a>=0&&a<12&&b>=0&&b<12){sum+=field[index(a,b)];n++;}}out[y*13+x]=sum/n;}return out;}
  function marching(field,iso){
    const polygons=[],segments=[];
    for(let y=0;y<12;y++)for(let x=0;x<12;x++){
      const v=[field[y*13+x],field[y*13+x+1],field[(y+1)*13+x+1],field[(y+1)*13+x]],bits=v.reduce((a,b,i)=>a+(b>=iso?(1<<i):0),0);if(!bits)continue;
      const corners=[[x*30,y*30],[(x+1)*30,y*30],[(x+1)*30,(y+1)*30],[x*30,(y+1)*30]];
      const p=[...corners];for(let j=0;j<4;j++){const k=(j+1)%4,t=Math.max(0,Math.min(1,(iso-v[j])/(v[k]-v[j]||1)));p.push([corners[j][0]+(corners[k][0]-corners[j][0])*t,corners[j][1]+(corners[k][1]-corners[j][1])*t]);}
      const table={1:[[0,4,7]],2:[[4,1,5]],3:[[0,1,5,7]],4:[[5,2,6]],5:[[0,4,7],[5,2,6]],6:[[4,1,2,6]],7:[[0,1,2,6,7]],8:[[7,6,3]],9:[[0,4,6,3]],10:[[4,1,5],[7,6,3]],11:[[0,1,5,6,3]],12:[[7,5,2,3]],13:[[0,4,5,2,3]],14:[[4,1,2,3,7]],15:[[0,1,2,3]]};
      let faces=table[bits];const center=v.reduce((a,b)=>a+b,0)/4;
      if(bits===5&&center>=iso)faces=[[0,4,5,2,6,7]];
      if(bits===10&&center>=iso)faces=[[4,1,5,6,3,7]];
      for(const face of faces){polygons.push(face.map(a=>p[a]));for(let j=0;j<face.length;j++){const a=face[j],b=face[(j+1)%face.length];if(a>=4&&b>=4)segments.push([p[a],p[b]]);}}
    }
    return {polygons,segments};
  }
  function fillMarch(c,geo,color){c.fillStyle=color;c.beginPath();for(const points of geo.polygons){c.moveTo(...points[0]);for(let j=1;j<points.length;j++)c.lineTo(...points[j]);c.closePath();}c.fill();}
  function joinContours(segments){const key=p=>p[0].toFixed(3)+','+p[1].toFixed(3),adj=new Map(),used=new Set();segments.forEach(([a,b],i)=>{for(const p of [a,b]){const k=key(p);if(!adj.has(k))adj.set(k,[]);adj.get(k).push(i);}});const paths=[];for(let n=0;n<segments.length;n++){if(used.has(n))continue;used.add(n);const path=[...segments[n]];for(const end of [1,0]){let guard=0;while(guard++<300){const p=end?path[path.length-1]:path[0],next=(adj.get(key(p))||[]).find(i=>!used.has(i));if(next===undefined)break;used.add(next);const [a,b]=segments[next],q=key(p)===key(a)?b:a;if(end)path.push(q);else path.unshift(q);}}paths.push(path);}return paths;}
  function fillSmoothWater(c,geo,color){
    // Cancel shared polygon edges, then round only the merged exterior and holes.
    // This preserves marching-squares topology without exposing any cell seams.
    const edges=new Map(),key=p=>p[0].toFixed(3)+','+p[1].toFixed(3);
    for(const face of geo.polygons)for(let j=0;j<face.length;j++){
      const a=face[j],b=face[(j+1)%face.length],ka=key(a),kb=key(b);
      if(ka===kb)continue;const k=ka<kb?ka+'|'+kb:kb+'|'+ka;
      if(edges.has(k))edges.delete(k);else edges.set(k,[a,b]);
    }
    c.fillStyle=color;c.beginPath();
    for(let loop of joinContours([...edges.values()])){
      if(loop.length<3)continue;
      if(key(loop[0])===key(loop[loop.length-1]))loop=loop.slice(0,-1);
      const end=loop[loop.length-1],first=loop[0];c.moveTo((end[0]+first[0])/2,(end[1]+first[1])/2);
      for(let j=0;j<loop.length;j++){const a=loop[j],b=loop[(j+1)%loop.length];c.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);}c.closePath();
    }
    c.fill();
  }
  function contourStroke(c,segments,color,width,wobble=0){
    c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';
    for(const path of joinContours(segments)){if(path.length<2)continue;c.beginPath();const pts=path.map(([x,y])=>[x+Math.sin(y*.13+elapsed*1.7)*wobble,y+Math.sin(x*.11+elapsed*1.3)*wobble]);c.moveTo(...pts[0]);for(let i=1;i<pts.length-1;i++){c.quadraticCurveTo(...pts[i],(pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2);}c.lineTo(...pts[pts.length-1]);c.stroke();}
  }
  function makeTerrain(){
    terrainCanvas=document.createElement('canvas');terrainCanvas.width=Math.ceil(size*dpr);terrainCanvas.height=Math.ceil(size*dpr);const c=terrainCtx();c.setTransform(size*dpr/360,0,0,size*dpr/360,0,0);
    rr(c,0,0,360,360,0,P.ground);const heights=lattice(state.terrain);
    for(const [iso,color] of [[.9,P.grass],[1.8,P.grassDark],[3,P.hill]]){const geo=marching(heights,iso);fillMarch(c,geo,color);alpha(c,.4,()=>contourStroke(c,geo.segments,P.paper,1));}
    // Broad, soft roads wind between the houses. No visible tile borders.
    c.strokeStyle=P.road;c.lineWidth=7;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(25,177);c.bezierCurveTo(80,173,85,148,145,157);c.bezierCurveTo(215,170,240,151,327,176);c.moveTo(62,172);c.bezierCurveTo(60,205,55,218,67,238);c.moveTo(142,159);c.bezierCurveTo(147,192,137,211,160,253);c.moveTo(233,161);c.bezierCurveTo(245,190,226,224,220,254);c.moveTo(295,171);c.lineTo(288,213);c.stroke();
    for(const b of LEVEL.buildings)line(c,[[b.x*30+15,b.y*30+15],[b.x*30+15,b.y*30+29]],P.road,5);
    rr(c,0,277,360,28,0,P.sand);
    // Small bits of grit make the beach and headlands feel hand placed.
    for(let k=0;k<26;k++){const x=(k*71+13)%360,y=280+(k*13)%15;alpha(c,.45,()=>rr(c,x,y,2+(k%3),1.5,1,P.stone));}
    for(const [x,y,r] of [[22,26,8],[40,18,6],[102,38,7],[124,27,6],[174,20,9],[195,35,6],[276,25,7],[296,40,8],[328,18,6],[28,83,7],[49,102,6],[108,89,6],[241,87,7],[310,102,8],[332,84,6],[15,143,6],[343,145,7]]){
      circle(c,x,y+3,r,P.shadow);circle(c,x,y,r,P.leaf);circle(c,x-1,y-2,r-1,P.leafLight);circle(c,x-2,y-4,2.3,P.grass);
    }
    alpha(c,.5,()=>{line(c,[[155,84],[166,84]],P.grass,1.5);line(c,[[195,84],[205,84]],P.grass,1.5);});
    for(const [x,y] of [[19,191],[340,210],[17,240],[345,256]]){rr(c,x,y+3,9,5,3,P.shadow);rr(c,x,y,9,6,3,P.stone);rr(c,x+1,y,7,3,2,P.dyke);}
  }
  function resize(){
    size=canvas.getBoundingClientRect().width||358;dpr=Math.min(window.devicePixelRatio||1,3);canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);ctx.setTransform(size*dpr/360,0,0,size*dpr/360,0,0);
    fx.width=Math.round(window.innerWidth*dpr);fx.height=Math.round(window.innerHeight*dpr);fctx.setTransform(dpr,0,0,dpr,0,0);makeTerrain();drawIntro();
    document.querySelectorAll('[data-tool]').forEach(b=>cssIcon(b.querySelector('canvas'),b.dataset.tool));drawSound();
  }
  function drawSound(){const c=$('sound').querySelector('canvas').getContext('2d');c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,23,23);rr(c,3,9,4,6,1,P.ink);c.fillStyle=P.ink;c.beginPath();c.moveTo(6,9);c.lineTo(12,5);c.lineTo(12,19);c.lineTo(6,15);c.fill();c.strokeStyle=P.ink;c.lineWidth=1.6;c.lineCap='round';c.beginPath();c.arc(10,12,7,-.7,.7);c.stroke();if(!soundOn)line(c,[[4,4],[20,20]],P.berry,2);}
  function drawIntro(){
    const can=$('intro-art'),c=can.getContext('2d'),w=can.clientWidth||292,h=154;can.width=w*2;can.height=h*2;c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,w,h);c.save();c.translate(w/2-135,5);
    rr(c,9,34,252,111,44,P.shadow);rr(c,9,27,252,111,44,P.grass);rr(c,9,77,252,61,[0,0,44,44],P.sea);rr(c,12,65,246,25,8,P.sand);
    drawBlock(c,18,69,89,13,P.stone,5);drawBlock(c,130,69,122,13,P.stone,5);
    line(c,[[119,70],[119,45],[161,45]],P.drain,8);line(c,[[119,70],[119,45],[161,45]],P.waterShallow,3);
    drawHouse(c,{id:0,x:0,y:0,kind:'house'},69,28,false);drawHouse(c,{id:1,x:0,y:0,kind:'house'},207,36,false);drawPump(c,161,43,.4,true,.1,1.2);
    for(let k=0;k<4;k++)line(c,[[36+k*56,106+k%2*9],[58+k*56,106+k%2*9]],P.waterShallow,2);
    circle(c,35,40,9,P.shadow);circle(c,35,37,9,P.leafLight);circle(c,244,33,7,P.leafLight);c.restore();
  }
  function drawHouse(c,b,x,y,flooded){
    const shop=b.kind==='shop',w=shop?26:22,h=shop?21:20;
    const bob=flooded?Math.sin(elapsed*3+b.id)*.8:0;y+=bob;
    drawBlock(c,x-w/2,y-9,w,h,P.paper,4.5,P.stone,shop?5:4);
    if(shop){
      rr(c,x-12,y-11,24,13,4,b.id===3?P.leaf:P.roof);rr(c,x-13,y+1,26,6,2,P.sun);
      for(let j=0;j<4;j++)rr(c,x-11+j*7,y+1,3,6,1,P.paper);
      rr(c,x-7,y+8,5,3,1,P.drain);rr(c,x+4,y+8,5,3,1,P.drain);
      if(size>=520&&b.label==='편의점')text(c,b.label,x,y+4,8*360/size,P.ink);
    }else{
      const roofs=[P.roof,P.berry,P.sun,P.cabbage,P.water];rr(c,x-12,y-12,24,17,4.5,roofs[b.id%roofs.length]);
      alpha(c,.18,()=>{rr(c,x-11,y-11,11,14,3,P.paper);});
      rr(c,x+5,y-15,4,6,1.3,P.stone);rr(c,x+5,y-15,4,2,1,P.paper);rr(c,x-6,y+7,4,3,1,P.drain);rr(c,x+4,y+7,4,3,1,P.drain);
    }
    if(flooded)alpha(c,state.phase==='result'?.45+.15*Math.sin(elapsed*7):.45,()=>rr(c,x-w/2,y-4,w,h-5,4,P.water));
    if(state.sandbags.includes(b.id)){for(let j=0;j<6;j++){const a=j*Math.PI/3;rr(c,x+Math.cos(a)*14-3,y+Math.sin(a)*12-2,7,4,2,P.dyke);}}
  }
  function wallCell(c,i,old=false){
    const x=(i%12)*30,y=Math.floor(i/12)*30,adj=neighbours[i].filter(n=>['dyke','seawall','gate'].includes(state.struct[n])),color=old?P.stone:P.dyke;
    c.save();const age=elapsed-popTimes[i],pop=age<.18?E.back(Math.max(0,Math.min(1,age/.18))):1;c.translate(x+15,y+15);c.scale(pop,pop);c.translate(-15,-15);
    const horizontal=old||adj.some(n=>Math.floor(n/12)===Math.floor(i/12));
    rr(c,3,9,24,17,5,P.shadow);rr(c,3,6,24,17,5,P.stoneDark);rr(c,3,6,24,13,4.5,color);
    for(const n of adj){const dx=n%12-i%12,dy=Math.floor(n/12)-Math.floor(i/12);if(dx){rr(c,dx<0?-1:20,9,11,17,3,P.shadow);rr(c,dx<0?-1:20,6,11,17,2,P.stoneDark);rr(c,dx<0?-1:20,6,11,13,2,color);}else{rr(c,7,dy<0?-1:16,16,16,3,P.shadow);rr(c,7,dy<0?-1:16,16,16,3,P.stoneDark);rr(c,7,dy<0?-1:15,16,13,3,color);}}
    if(horizontal){rr(c,13,8,1,9,1,P.stoneDark);alpha(c,.35,()=>rr(c,5,8,5,2,1,P.paper));}else alpha(c,.4,()=>rr(c,6,8,13,2,1,P.paper));c.restore();
  }
  function drawGate(c,g,k){
    const x=g.x*30,y=g.y*30,open=gateVis[k],danger=seaLevel(state)>.6&&g.open;
    if(state.phase==='wave')alpha(c,.12+.08*Math.sin(elapsed*4),()=>circle(c,x+15,y+14,18,P.sun));
    drawBlock(c,x-2,y+5,7,19,P.stone,2);drawBlock(c,x+25,y+5,7,19,P.stone,2);
    c.save();c.beginPath();c.rect(x+4,y+4,23,22);c.clip();drawBlock(c,x+4-21*open,y+8,22,13,P.roof,2,P.berry);for(let n=0;n<3;n++)rr(c,x+8+n*6-21*open,y+10,2,7,1,P.paper);c.restore();
    circle(c,x+29,y+4,2.5,danger?(Math.sin(elapsed*7)>-.4?P.berry:P.sun):g.open?P.leaf:P.muted);
  }
  function drawDrain(c,i){const x=(i%12)*30+15,y=Math.floor(i/12)*30+15;c.save();const age=elapsed-popTimes[i],pop=age<.18?E.back(Math.max(0,Math.min(1,age/.18))):1;c.translate(x,y);c.scale(pop,pop);circle(c,0,0,5,P.drain);const ns=neighbours[i].filter(n=>networkCell(state,n));for(const n of ns){const dx=(n%12-i%12)*16,dy=(Math.floor(n/12)-Math.floor(i/12))*16;line(c,[[0,0],[dx,dy]],P.drain,9);line(c,[[0,-1],[dx,dy-1]],P.waterShallow,3.5);}if(!ns.length){line(c,[[-7,0],[7,0]],P.drain,9);line(c,[[-6,-1],[6,-1]],P.waterShallow,3.5);}c.restore();}
  function drawSea(c){
    const sea=seaLevel(state),surge=Math.max(0,(sea-.3)/2.6),top=299-surge*13+Math.sin(elapsed*2)*1.1;
    c.fillStyle=P.sea;c.beginPath();c.moveTo(0,top);for(let x=0;x<=360;x+=10)c.lineTo(x,top+Math.sin(x*.045+elapsed*1.4)*1.4);c.lineTo(360,360);c.lineTo(0,360);c.closePath();c.fill();
    c.fillStyle=P.seaDeep;c.beginPath();c.moveTo(0,340);for(let x=0;x<=360;x+=15)c.lineTo(x,341+Math.sin(x*.018+elapsed*.7)*4);c.lineTo(360,360);c.lineTo(0,360);c.closePath();c.fill();
    const n=4+Math.ceil(surge*4);for(let j=0;j<n;j++){
      const phase=(elapsed*(6+surge*9)+j*79/n)%79,y=361-phase;
      if(y<top+2)continue;alpha(c,.5*(1-Math.max(0,top+14-y)/14),()=>{c.strokeStyle=P.paper;c.lineWidth=j%2?1.3:2;c.beginPath();for(let x=-10;x<=370;x+=8){const yy=y+Math.sin(x*.037+elapsed*.5+j)*2;if(x===-10)c.moveTo(x,yy);else c.lineTo(x,yy);}c.stroke();});
    }
    alpha(c,.6,()=>{c.strokeStyle=P.paper;c.lineWidth=1.7;c.beginPath();for(let x=0;x<=360;x+=6){const y=top+Math.sin(x*.045+elapsed*1.4)*1.4;if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();});
  }
  function drawWater(c){
    const field=lattice(vis),bands=[[.04,P.waterShallow,.87],[.35,P.water,.9],[.8,P.waterDeep,.9]];
    let edge;
    c.save();c.beginPath();c.rect(0,0,360,301);c.clip();
    for(const [iso,color,opacity] of bands){const geo=marching(field,iso);alpha(c,opacity,()=>fillSmoothWater(c,geo,color));if(iso===.04)edge=geo;}
    if(edge)alpha(c,.6,()=>contourStroke(c,edge.segments,P.paper,1.8,.65));
    for(let i=0;i<108;i++){
      if(vis[i]<.045||state.struct[i]==='dyke')continue;const x=i%12*30+15,y=Math.floor(i/12)*30+15,flow=Math.hypot(state.flowX[i],state.flowY[i]);
      const angle=flow>.01?Math.atan2(state.flowY[i],state.flowX[i]):.1;c.save();c.translate(x,y);c.rotate(angle);const drift=((elapsed*(6+flow*20)+i*7)%24)-12;
      alpha(c,.25,()=>line(c,[[drift-4,Math.sin(i)*4],[drift+4,Math.sin(i)*4]],P.paper,1.3));
      if(flow>.04){alpha(c,Math.min(.55,flow*2),()=>{line(c,[[drift-3,-3],[drift,0],[drift-3,3]],P.paper,1.1);});}c.restore();
    }
    c.restore();
    // Pouring gates have a distinct narrow stream, separate from the sea swell.
    for(const g of state.gates)if(g.open&&seaLevel(state)>.65&&state.phase==='wave'){
      const x=g.x*30+15,rate=Math.max(.15,Math.hypot(state.flowX[index(g.x,g.y)],state.flowY[index(g.x,g.y)]));
      for(let j=0;j<3;j++){const offset=(elapsed*45+j*14)%32;alpha(c,.5,()=>line(c,[[x-5+j*5,299-offset],[x-6+j*5,292-offset]],P.paper,1.5));}
      if(rate>.08&&Math.random()<.09)particle('splash',{x:x+(Math.random()-.5)*15,y:279,vx:(Math.random()-.5)*16,vy:-20-Math.random()*20,life:.5,r:1.4});
    }
  }
  function drawMap(){
    ctx.setTransform(size*dpr/360,0,0,size*dpr/360,0,0);ctx.clearRect(0,0,360,360);ctx.save();
    ctx.beginPath();ctx.roundRect(0,0,360,360,18*360/size);ctx.clip();
    ctx.drawImage(terrainCanvas,0,0,360,360);drawSea(ctx);
    if(state.phase==='build')alpha(ctx,.08,()=>{ctx.strokeStyle=P.paper;ctx.lineWidth=.7;ctx.beginPath();for(let i=1;i<12;i++){ctx.moveTo(i*30,0);ctx.lineTo(i*30,270);ctx.moveTo(0,i*30);ctx.lineTo(360,i*30);}ctx.stroke();});
    drawWater(ctx);
    updateNetworks(state);
    for(let i=0;i<108;i++)if(state.struct[i]==='drain'||state.struct[i]==='pump')drawDrain(ctx,i);
    for(let i=0;i<120;i++)if(state.struct[i]==='dyke'||state.struct[i]==='seawall')wallCell(ctx,i,state.struct[i]==='seawall');
    state.gates.forEach((g,k)=>drawGate(ctx,g,k));
    for(const b of LEVEL.buildings){const x=b.x*30+15,y=b.y*30+14;
      if(stampAge>=0&&state.lastResult.nearMissIds.includes(b.id)){const a=Math.min(1,stampAge/.25),pulse=1+Math.sin(stampAge*7.4)*.1;alpha(ctx,(.55+.3*Math.sin(stampAge*7.4))*a,()=>{ctx.strokeStyle=P.sun;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(x,y,17*pulse,15*pulse,0,0,Math.PI*2);ctx.stroke();});}
      drawHouse(ctx,b,x,y,state.flooded.has(b.id));
    }
    for(const net of state.networks)for(const i of net.pumps){const age=elapsed-popTimes[i],pop=age<.18?E.back(Math.max(0,Math.min(1,age/.18))):1;drawPump(ctx,i%12*30+15,Math.floor(i/12)*30+15,rotors[i],net.connected,state.pumpRates[i],pop);}
    drawMapParticles(ctx);
    for(const b of LEVEL.buildings){const i=index(b.x,b.y),x=b.x*30+15,y=b.y*30;
      const floodAge=elapsed-floodTimes[b.id];if(floodAge<1.5){const a=Math.min(1,floodAge/.16);ctx.save();ctx.translate(x,y-4-floodAge*4);ctx.scale(E.back(a),E.back(a));rr(ctx,-15,-7,30,14,7,P.berry);text(ctx,'침수',0,0,8,P.paper);ctx.restore();}
      if(stampAge>=0&&stampAge<2.5&&state.lastResult.nearMissIds.includes(b.id)){const a=Math.max(0,Math.min(1,(stampAge-.05)/.3));ctx.save();ctx.translate(x,y-7-Math.min(1,stampAge/2)*5);ctx.scale(E.back(a),E.back(a));rr(ctx,-23,-8,46,16,8,P.sun);text(ctx,'아슬아슬!',0,0,8,P.ink);ctx.restore();}
    }
    if(ghost&&state.phase==='build')drawGhost(ctx);
    if(state.phase==='wave'){
      alpha(ctx,.22*Math.min(1,state.time),()=>rr(ctx,0,0,360,360,0,P.sky));
      const count=reduced?14:28+state.wave*11;ctx.strokeStyle=P.water;ctx.lineWidth=1.2;ctx.globalAlpha=.5;
      for(let j=0;j<count;j++){const x=(j*83+elapsed*42)%390-15,y=(j*47+elapsed*155)%390-15;line(ctx,[[x,y],[x-3.7,y+10]],P.water,1.2);}ctx.globalAlpha=1;
      alpha(ctx,.3,()=>{for(let j=0;j<3;j++){const x=(elapsed*33+j*143)%450-60,y=40+j*59;line(ctx,[[x,y],[x+33,y-2]],P.paper,1);}});
    }
    if(waveTitleAge<2.1){const a=waveTitleAge<.35?E.cubic(waveTitleAge/.35):waveTitleAge>1.6?1-E.cubic((waveTitleAge-1.6)/.5):1;ctx.save();ctx.translate(180,18+a*24);ctx.globalAlpha=a;rr(ctx,-45,-14,90,28,14,P.paper);text(ctx,'파도 '+state.wave,0,0,13);ctx.restore();}
    ctx.restore();
  }
  function drawGhost(c){const {x,y}=ghost,i=index(x,y),ok=tool==='remove'?Object.hasOwn(CONFIG.costs,state.struct[i]):canPlace(state,tool,x,y),cx=x*30+15+(ghostError>0?Math.sin(ghostError*55)*4:0),cy=y*30+15;c.save();c.translate(cx,cy);alpha(c,.32,()=>rr(c,-14,-14,28,28,5,ok?P.leaf:P.berry));
    alpha(c,.65,()=>{if(tool==='pump')drawPump(c,0,0,elapsed,true,0);else if(tool==='dyke')drawBlock(c,-12,-6,24,15,P.dyke,4);else if(tool==='drain'){line(c,[[-10,0],[10,0]],P.drain,9);line(c,[[-9,-1],[9,-1]],P.waterShallow,3);}else{line(c,[[-5,-5],[5,5]],P.berry,3);line(c,[[5,-5],[-5,5]],P.berry,3);}});
    const label=tool==='remove'?'철거':state.free[tool]>0?'무료':String(CONFIG.costs[tool]);rr(c,-17,-36,34,18,9,P.paper);text(c,label,0,-27,10,ok?P.ink:P.berry);c.restore();}
  function drawMapParticles(c){
    for(const p of particles){if(!p.alive||p.age<0)continue;const t=p.age/p.life;
      if(p.type==='dust')alpha(c,1-t,()=>circle(c,p.x,p.y,p.r*(1+t),P.ground));
      if(p.type==='splash')alpha(c,1-t,()=>{c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(p.vy,p.vx));rr(c,-p.r*2,-p.r/2,p.r*4,p.r,1,P.paper);c.restore();});
      if(p.type==='packet'){
        const pos=packetPosition(p),prev=packetPosition({...p,age:Math.max(0,p.age-.02)});c.save();c.translate(pos.x,pos.y);c.rotate(Math.atan2(pos.y-prev.y,pos.x-prev.x));
        alpha(c,Math.min(1,t*8,(1-t)*8),()=>{rr(c,-4,-1.7,8,3.4,2,P.water);rr(c,-2,-1.1,3,1,1,P.paper);});c.restore();
        if(glowAge<1.1)alpha(c,(1-glowAge/1.1)*.18,()=>circle(c,pos.x,pos.y,9,P.sun));
      }
    }
  }
  function packetPosition(p){const progress=Math.min(p.path.length-1,p.age/p.life*(p.path.length-1)),k=Math.min(p.path.length-2,Math.floor(progress)),t=progress-k,a=p.path[k],b=p.path[k+1];return {x:(a%12+.5+(b%12-a%12)*t)*30,y:(Math.floor(a/12)+.5+(Math.floor(b/12)-Math.floor(a/12))*t)*30};}
  function updateParticles(dt){
    for(const p of particles){if(!p.alive)continue;p.age+=dt;if(p.age>=p.life){p.alive=false;if(p.type==='packet'){const gate=p.path[p.path.length-1];for(let j=0;j<(reduced?1:3);j++)particle('splash',{x:gate%12*30+15,y:Math.floor(gate/12)*30+17,vx:(Math.random()-.5)*25,vy:25+Math.random()*28,life:.5,r:1.2});}continue;}
      if(['dust','splash','confetti'].includes(p.type)){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.type==='confetti'?110:p.type==='dust'?10:90)*dt;}
      if(p.type==='confetti')p.angle+=p.spin*dt;
    }
  }
  function emitPackets(dt){
    if(state.phase!=='wave')return;packetClock+=dt;if(packetClock<.14)return;packetClock=0;
    for(const net of state.networks)if(net.connected&&net.rate>.025){for(const i of net.pumps){const path=state.paths[i];if(!path||path.length<2||state.pumpRates[i]<.008)continue;particle('packet',{path:[...path],life:Math.max(.3,(path.length-1)*.10)});}}
  }
  function screenPoint(x,y){const r=canvas.getBoundingClientRect();return {x:r.left+x/360*r.width,y:r.top+y/360*r.height};}
  function drawFX(){
    const ww=window.innerWidth,hh=window.innerHeight;fctx.clearRect(0,0,ww,hh);
    for(const p of particles){if(!p.alive||p.age<0)continue;const t=p.age/p.life;
      if(p.type==='confetti'){alpha(fctx,Math.min(1,(1-t)*3),()=>{fctx.save();fctx.translate(p.x,p.y);fctx.rotate(p.angle);fctx.scale(1,Math.cos(p.age*6+p.spin));rr(fctx,-3,-2,6,4,1,p.color);fctx.restore();});}
      if(p.type==='coin'){const u=E.cubic(t),x=p.x+(p.tx-p.x)*u,y=p.y+(p.ty-p.y)*u-Math.sin(t*Math.PI)*65;circle(fctx,x,y+2,5,P.shadow);circle(fctx,x,y,5,P.sun);rr(fctx,x-.6,y-2.5,1.2,5,1,P.paper);}
    }
    if(stampAge<0)return;const success=state.lastResult.flooded===0,center=screenPoint(180,165),hud=$('wave-number').getBoundingClientRect();let scale=1,opacity=1,x=center.x,y=center.y,rotation=-8;
    if(stampAge<.22){const t=Math.max(0,stampAge/.22),e=t*t*t;scale=2.6-1.6*e;opacity=Math.min(1,t*2.5);rotation=-14+6*e;}
    if(stampAge>1.78){const t=Math.min(1,(stampAge-1.78)/.55),e=E.cubic(t);scale=1-.92*e;opacity=1-e;x+=(hud.left+hud.width/2-x)*e;y+=(hud.top+hud.height/2-y)*e;}
    const r=success?108:92;fctx.save();fctx.translate(x,y);fctx.rotate(rotation*Math.PI/180);fctx.scale(scale,scale);fctx.globalAlpha=opacity;const color=success?P.stamp:P.berry;
    fctx.strokeStyle=color;fctx.lineWidth=5;fctx.beginPath();fctx.arc(0,0,r,0,Math.PI*2);fctx.stroke();fctx.lineWidth=1.8;fctx.setLineDash([5,2.4]);fctx.beginPath();fctx.arc(0,0,r-8,0,Math.PI*2);fctx.stroke();fctx.setLineDash([]);
    if(success){text(fctx,'침수',0,-36,29,color);text(fctx,'0가구',0,9,51,color);text(fctx,'파도 '+state.wave+' 방어 성공',0,56,12,color);line(fctx,[[-30,-59],[30,-59]],color,2);}
    else{text(fctx,'침수',0,-27,24,color);text(fctx,state.lastResult.flooded+'가구',0,12,44,color);text(fctx,'다음 파도를 준비해요',0,49,10,color);}
    for(let i=0;i<16;i++){const a=i*2.399,radius=r+5+(i*7)%14;alpha(fctx,.6,()=>circle(fctx,Math.cos(a)*radius,Math.sin(a)*radius,1+(i%3)*.5,color));}
    // Tiny gaps in the ink give the seal a stamped-paper texture.
    alpha(fctx,.55,()=>{for(let j=0;j<10;j++){const a=j*2.27;circle(fctx,Math.cos(a)*(r-1),Math.sin(a)*(r-1),.8,P.paper);}});fctx.restore();
  }
  function impactStamp(){
    impact=true;const center=screenPoint(180,165),success=state.lastResult.flooded===0;
    if(success){shake=reduced?0:10;sound('stamp');const colors=[P.sun,P.leafLight,P.roof,P.water,P.paper,P.berry];for(let j=0;j<(reduced?8:30);j++)particle('confetti',{x:center.x,y:center.y,vx:(Math.random()-.5)*270,vy:-80-Math.random()*230,angle:Math.random()*6,spin:(Math.random()-.5)*12,life:1.4+Math.random()*.9,color:colors[j%colors.length]});}
    else sound('flood');
    const target=$('coin-pill').getBoundingClientRect();for(let j=0;j<8;j++)particle('coin',{x:center.x+(j-3.5)*10,y:center.y+60,tx:target.left+27,ty:target.top+18,life:.6+j*.04,age:-j*.04});
    setCoinTarget(state.coins);
  }
  function setCoinTarget(n){coinFrom=displayCoins;coinTarget=n;coinAge=0;}
  function processEvents(){
    while(state.events.length){const e=state.events.shift();
      if(e.type==='place'){
        popTimes[e.i]=elapsed;sound('place');setCoinTarget(state.coins);if(tool==='dyke'&&coachStep===0)coachStep=1;else if(e.type==='place'&&tool==='pump')coachStep=2;
        for(let j=0;j<(reduced?2:5);j++){const a=j*Math.PI*2/5;particle('dust',{x:e.i%12*30+15,y:Math.floor(e.i/12)*30+17,vx:Math.cos(a)*25,vy:Math.sin(a)*20,life:.4,r:2});}
      }
      if(e.type==='remove'){sound('tap');setCoinTarget(state.coins);}
      if(e.type==='gate'){sound('gate');shake=reduced?0:1.5;}
      if(e.type==='wave'){sound('wave');waveTitleAge=0;}
      if(e.type==='backflow'){toast('펌프 연결 · 역류 가동!',2.7);glowAge=0;}
      if(e.type==='flood'){sound('flood');floodTimes[e.id]=elapsed;}
      if(e.type==='result'){stampAge=0;impact=false;acc=0;ghost=null;}
      if(e.type==='card'){toast(CARDS[e.card].title+' 획득');sound('card');setCoinTarget(state.coins);makeTerrain();}
    }
  }
  function updateHUD(){
    $('coins').textContent=Math.round(displayCoins);$('wave-number').textContent=Math.max(1,state.phase==='build'?state.wave+1:state.wave);
    const sea=seaLevel(state);$('sea-small').textContent=sea.toFixed(2);$('sea-large').textContent=sea.toFixed(2);$('gauge-fill').style.width=Math.min(100,sea/3*100)+'%';
    $('timer').hidden=state.phase!=='wave';if(state.phase==='wave')$('timer').firstElementChild.style.transform='scaleX('+Math.max(0,1-state.time/CONFIG.durations[state.wave-1])+')';
    const isBuild=state.phase==='build';$('build-controls').hidden=!isBuild;$('build-label').hidden=!isBuild;$('start').hidden=!isBuild;$('coach').hidden=!isBuild;$('wave-controls').hidden=isBuild;
    $('dry-count').innerHTML='<i class="dry-dot"></i>'+(state.flooded.size?state.flooded.size+'가구 침수':'12가구의 일상');
    $('map-note').textContent=state.phase==='wave'?Math.ceil(CONFIG.durations[state.wave-1]-state.time)+'초 남음':'낡은 방파제 · 수문 2곳';
    if(state.phase==='wave'){
      const total=state.networks.reduce((a,n)=>a+(n.connected?n.rate:0),0);$('wave-status').textContent=total>=.2?'역류 가동 · '+total.toFixed(1)+' 배수 / 초':sea>2.2?'방파제 월류 · 펌프를 지켜봐요':sea>.6?'해수면 상승 · 수문을 확인해요':'잔잔한 바다 · 물길을 살펴요';
      $('wave-status').style.color=sea>2.2?P.berry:P.leaf;
    }
    $('coach').textContent=state.wave===0?['바다 쪽에 제방','펌프를 배수로로 수문에 연결','준비되면 태풍 맞이하기'][coachStep]:'빈틈을 메우고, 펌프를 이어주세요';
    for(const k of ['dyke','drain','pump'])$('cost-'+k).textContent=state.free[k]>0?'무료 '+state.free[k]:CONFIG.costs[k];
    $('coin-pill').style.background=ghostError>0?P.berry:P.paper;
  }
  function showCards(){
    const box=$('cards');box.replaceChildren();cardBusy=false;
    cardChoices(state).forEach((id,n)=>{const b=document.createElement('button');b.className='equipment';b.style.setProperty('--n',n);b.style.setProperty('--tilt',(n-1)*4+'deg');const num=document.createElement('span');num.className='card-number';num.textContent='0'+(n+1);const can=document.createElement('canvas'),title=document.createElement('strong'),desc=document.createElement('small');title.textContent=CARDS[id].title;desc.textContent=CARDS[id].desc;b.append(num,can,title,desc);b.setAttribute('aria-label',CARDS[id].title+', '+CARDS[id].desc);b.addEventListener('pointerup',()=>{
      if(cardBusy)return;cardBusy=true;sound('card');b.classList.add('selected');[...box.children].forEach(el=>{if(el!==b)el.classList.add('discard');});window.setTimeout(()=>{chooseCard(state,n);$('card-overlay').hidden=true;stampAge=-1;vis.fill(0);for(let i=120;i<N;i++)vis[i]=CONFIG.baseSea;processEvents();updateHUD();},360);
    });box.append(b);});
    $('card-overlay').hidden=false;[...box.children].forEach((b,n)=>drawCardIcon(b.querySelector('canvas'),state.choices[n]));
  }
  function drawCardIcon(can,id){
    const w=can.clientWidth||82,h=can.clientHeight||103;can.width=w*2;can.height=h*2;const c=can.getContext('2d');c.setTransform(2,0,0,2,0,0);c.translate(w/2,h*.57);const s=w/90;c.scale(s,s);circle(c,0,0,31,P.ground);
    if(id==='pump'||id==='boost'){drawPump(c,0,0,id==='boost'?.6:0,true,.0,1.9);if(id==='boost'){for(let j=0;j<3;j++){const x=-20+j*20;line(c,[[x,-31],[x,-43]],P.sun,4);line(c,[[x-4,-38],[x,-43],[x+4,-38]],P.sun,3);}}else{circle(c,21,-24,10,P.sun);line(c,[[17,-24],[25,-24]],P.paper,2.5);line(c,[[21,-28],[21,-20]],P.paper,2.5);}}
    if(id==='dyke'){for(let j=0;j<3;j++)drawBlock(c,-29+j*19,-4-j*4,23,18,P.dyke,4);rr(c,-22,8,51,3,1.5,P.stoneDark);}
    if(id==='drain'){line(c,[[-29,-15],[-8,-15],[-8,17],[28,17]],P.drain,17);line(c,[[-29,-16],[-8,-16],[-8,16],[28,16]],P.waterShallow,8);for(let j=0;j<3;j++)rr(c,11+j*6,13,3,5,1.5,P.water);}
    if(id==='sand'){drawHouse(c,{id:0,kind:'house'},0,-4,false);for(let j=0;j<5;j++){const a=(j+1)*Math.PI/6;drawBlock(c,Math.cos(a)*29-8,Math.sin(a)*18+4,17,9,P.dyke,4);}}
    if(id==='coins'){for(let j=0;j<3;j++){const x=(j-1)*18,y=j===1?-10:3;circle(c,x,y+8,14,P.shadow);for(let k=2;k>=0;k--)circle(c,x,y+k*3,13,k?P.stone:P.sun);rr(c,x-1.5,y-7,3,14,1.5,P.paper);}}
  }
  function showFinal(){
    const sum=state.history.reduce((a,r)=>a+r.flooded,0);$('final-title').textContent=sum===0?'일상을 지켰어요':'마을은 다시 일어나요';$('final-total').textContent=sum===0?'세 번의 파도 · 침수 0가구':'세 번의 파도 · 누적 침수 '+sum+'가구';const box=$('results');box.replaceChildren();for(const r of state.history){const row=document.createElement('div');row.className='result-row';const label=document.createElement('span');label.textContent='파도 '+r.wave;const stamp=document.createElement('span');stamp.className='small-stamp';stamp.textContent=r.flooded===0?'0가구 · 방어 성공':r.flooded+'가구 침수';row.append(label,stamp);box.append(row);}$('final-overlay').hidden=false;
  }
  function invalid(){ghostError=.38;sound('tap');}
  function hit(e){const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*12),y=Math.floor((e.clientY-r.top)/r.height*12);return x>=0&&x<12&&y>=0&&y<12?{x,y}:null;}
  function apply(p){if(!p)return false;const ok=tool==='remove'?remove(state,p.x,p.y):place(state,tool,p.x,p.y);if(!ok)invalid();processEvents();return ok;}
  function paintBetween(a,b){let x=a.x,y=a.y;const dx=Math.abs(b.x-x),dy=Math.abs(b.y-y),sx=Math.sign(b.x-x),sy=Math.sign(b.y-y);let err=dx-dy,guard=0;while((x!==b.x||y!==b.y)&&guard++<24){const e=2*err;if(e>-dy&&x!==b.x){err-=dy;x+=sx;paintCell({x,y});}if(e<dx&&y!==b.y){err+=dx;y+=sy;paintCell({x,y});}}}
  function paintCell(p){const key=index(p.x,p.y);if(drag.visited.has(key))return;drag.visited.add(key);if(place(state,tool,p.x,p.y)){const delay=Math.min(.12,drag.count*.03);drag.count++;processEvents();popTimes[key]=elapsed+delay;}else if(state.struct[key]==='none')invalid();}
  canvas.addEventListener('pointerdown',e=>{
    if(intro||!['build','wave'].includes(state.phase))return;sound('tap');const p=hit(e);if(!p)return;canvas.setPointerCapture(e.pointerId);
    const gate=state.gates.findIndex(g=>g.x===p.x&&g.y===p.y);if(gate>=0){setGate(state,gate,!state.gates[gate].open);processEvents();return;}
    if(state.phase!=='build')return;ghost=p;drag={pointer:e.pointerId,start:p,last:p,moved:false,visited:new Set(),count:0};e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag||drag.pointer!==e.pointerId)return;const p=hit(e);if(!p)return;ghost=p;if(p.x!==drag.last.x||p.y!==drag.last.y){if(tool==='dyke'||tool==='drain'){if(!drag.moved)paintCell(drag.start);paintBetween(drag.last,p);}drag.moved=true;drag.last=p;}e.preventDefault();
  });
  canvas.addEventListener('pointerup',e=>{if(!drag||drag.pointer!==e.pointerId)return;const p=hit(e);if(p&&(!drag.moved||tool==='pump'||tool==='remove'))apply(p);drag=null;window.setTimeout(()=>{if(!drag)ghost=null;},160);});
  canvas.addEventListener('pointercancel',()=>{drag=null;ghost=null;});
  document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('pointerup',()=>{tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));sound('tap');if(tool==='pump'&&state.wave===0)toast('수문에 닿는 배수로와 연결해요');}));
  $('begin').addEventListener('pointerup',()=>{intro=false;$('intro').hidden=true;sound('tap');coachTime=0;});
  $('start').addEventListener('pointerup',()=>{if(startWave(state)){ghost=null;speed=1;$('speed').setAttribute('aria-pressed','false');processEvents();updateHUD();}});
  $('speed').addEventListener('pointerup',()=>{speed=speed===1?2:1;$('speed').setAttribute('aria-pressed',String(speed===2));sound('tap');});
  $('sound').addEventListener('pointerup',()=>{soundOn=!soundOn;$('sound').setAttribute('aria-pressed',String(soundOn));drawSound();if(soundOn)sound('tap');});
  $('restart').addEventListener('pointerup',()=>{state=createGame(1);intro=false;stampAge=-1;ghost=null;drag=null;coachStep=0;coachTime=0;speed=1;elapsed=0;vis.fill(0);for(let i=120;i<N;i++)vis[i]=.3;particles.forEach(p=>p.alive=false);gateVis.fill(1);rotors.fill(0);popTimes.fill(-99);floodTimes.fill(-99);displayCoins=120;coinTarget=120;coinAge=1;state.events.length=0;$('final-overlay').hidden=true;tool='dyke';document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));makeTerrain();updateHUD();sound('tap');});
  window.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>window.setTimeout(resize,100));document.addEventListener('visibilitychange',()=>{last=0;acc=0;if(document.hidden&&audio)audio.suspend();else if(audio&&soundOn)audio.resume();});
  function frame(now){
    const dt=document.hidden?0:Math.min(.05,last?(now-last)/1000:0);last=now;elapsed+=dt;
    if(!document.hidden){
      if(state.phase==='wave'&&!intro){acc+=dt*speed;let n=0;while(acc>=.1&&n++<5&&state.phase==='wave'){step(state,.1);acc-=.1;}processEvents();}
      for(let i=0;i<N;i++){vis[i]+=(state.water[i]-vis[i])*(1-Math.exp(-8*dt));rotors[i]+=Math.min(25,state.pumpRates[i]*36)*dt;}
      state.gates.forEach((g,k)=>{gateVis[k]+=(Number(g.open)-gateVis[k])*(1-Math.exp(-22*dt));});
      if(coinAge<1){coinAge=Math.min(1,coinAge+dt/.6);displayCoins=coinFrom+(coinTarget-coinFrom)*E.cubic(coinAge);}
      if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');}
      ghostError=Math.max(0,ghostError-dt);waveTitleAge+=dt;glowAge+=dt;
      if(!intro&&state.phase==='build'&&state.wave===0){coachTime+=dt;if(coachTime>12&&coachStep===0)coachStep=1;if(coachTime>25)coachStep=2;}
      if(state.phase==='wave'&&seaLevel(state)>1.5){splashClock+=dt;if(splashClock>.18){splashClock=0;const x=10+Math.random()*340;if(Math.random()<.25)shake=reduced?0:2;for(let k=0;k<(reduced?1:3);k++)particle('splash',{x,y:291,vx:(Math.random()-.5)*30,vy:-20-Math.random()*35,life:.5,r:1+Math.random()});}}
      updateParticles(dt);emitPackets(dt);
      if(stampAge>=0){stampAge+=dt;if(stampAge>=.22&&!impact)impactStamp();if(stampAge>=2.55&&state.phase==='result'){ackResult(state);stampAge=-1;if(state.phase==='card')showCards();else showFinal();}}
      shake=Math.max(0,shake-dt*29);const x=reduced?0:Math.sin(elapsed*121)*shake,y=reduced?0:Math.cos(elapsed*137)*shake*.6;$('board').style.transform=shake>0?'translate('+x+'px,'+y+'px)':'';
      hudClock+=dt;if(hudClock>=.05){updateHUD();hudClock=0;}drawMap();drawFX();
    }
    requestAnimationFrame(frame);
  }
  for(let i=120;i<N;i++)vis[i]=CONFIG.baseSea;resize();updateHUD();requestAnimationFrame(frame);
}
})();
