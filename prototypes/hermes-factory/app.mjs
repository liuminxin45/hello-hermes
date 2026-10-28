import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {stations,createEvents,resultFor,visibleHistory} from './model.mjs';

const $=s=>document.querySelector(s);
const world=$('#world'),labelRoot=$('#labels');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let events=createEvents(),index=-1,playing=false,elapsed=0,selected=null,tourIndex=-1,walking=false;
let scene,camera,renderer,controls,packet,activeRoute,focusTween,activeHalo;
const stationObjects=new Map(),labels=[],routes=new Map(),keys=new Set();
const eventDuration=4.6;
const stationById=new Map(stations.map(s=>[s.id,s]));
const buttonFor=new Map();

// The text experience shares the same deterministic state as the 3D scene.
for(const [i,s] of stations.entries()){
  const b=document.createElement('button');b.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${s.short}`;
  b.setAttribute('aria-label',`参观${s.name}`);b.setAttribute('aria-pressed','false');
  b.onclick=()=>inspect(s.id,true);$('#stops').append(b);buttonFor.set(s.id,b);
}
for(const [i,e] of events.entries()){
  const b=document.createElement('button');b.setAttribute('aria-label',`回放到第 ${i+1} 步`);b.title=e.title;
  b.onclick=()=>{playing=false;go(i,true);};$('#progress').append(b);
}
function inspect(id,move=false){
  if(move){playing=false;updateText();}
  selected=id;const s=stationById.get(id);
  $('#station-number').textContent=`观察点 ${String(stations.indexOf(s)+1).padStart(2,'0')}`;
  $('#station-name').textContent=s.name;$('#station-summary').textContent=s.summary;
  $('#station-io').replaceChildren();
  for(const [name,value] of [['进入这里',s.input],['离开这里',s.output]]){
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;row.append(dt,dd);$('#station-io').append(row);
  }
  $('#station-detail').textContent=s.detail;$('#mechanism').open=false;
  $('#inspector').hidden=false;$('#open-inspector').hidden=true;
  for(const [key,b] of buttonFor)b.setAttribute('aria-pressed',String(key===id));
  if(move&&camera){setWalking(false);const p=new THREE.Vector3(...s.pos);flyTo(p.clone().add(new THREE.Vector3(5.8,5.8,7.2)),p.clone().add(new THREE.Vector3(0,1.1,0)));}
}
$('#close-inspector').onclick=()=>{$('#inspector').hidden=true;$('#open-inspector').hidden=false;};
$('#open-inspector').onclick=()=>{$('#inspector').hidden=false;$('#open-inspector').hidden=true;};
function updateText(){
  $('#play').textContent=playing?'Ⅱ 暂停':index===events.length-1?'↺ 再看一遍':index<0?'▶ 开始任务':'▶ 继续';
  $('#scene-play').textContent=playing?'Ⅱ 暂停回放':index===events.length-1?'↺ 再看一遍':index<0?'▶ 启动任务':'▶ 继续回放';
  $('#scene-count').textContent=index<0?'等待启动':`${String(index+1).padStart(2,'0')} / ${events.length} · ${events[index].kind}`;
  $('#scene-event').textContent=index<0?'三份材料 → 一份简报草稿':events[index].title;
  $('#step').disabled=index===events.length-1;
  $('#event-index').textContent=`${String(index+1).padStart(2,'0')} / ${events.length}`;
  if(index>=0){const e=events[index];$('#event-title').textContent=e.title;$('#event-body').textContent=e.body;$('#event-kind').textContent=e.kind;}
  else{$('#event-title').textContent='工厂已就绪，任务还没有开始';$('#event-body').textContent='这是一组自编材料。播放后，只有当前步骤携带的材料卡会移动。';$('#event-kind').textContent='等待开始';}
  [...$('#progress').children].forEach((b,i)=>{b.className=i===index?'current':i<index?'done':'';b.setAttribute('aria-current',i===index?'step':'false');b.title=events[i].title;});
  const history=visibleHistory(events,index);$('#record-count').textContent=`${history.length} 条记录`;
  $('#history').replaceChildren();for(const e of history){const li=document.createElement('li');li.textContent=e.title;$('#history').append(li);}
  if(!history.length){const li=document.createElement('li');li.textContent='等待任务开始。';$('#history').append(li);}
  $('#result').hidden=index!==events.length-1;$('#result').replaceChildren();
  if(index===events.length-1){for(const line of resultFor($('#scenario').value).lines){const p=document.createElement('p');p.textContent=line;$('#result').append(p);}}
  document.body.dataset.step=String(index);document.body.dataset.playing=String(playing);
}
function go(i,finish=false){
  index=i;elapsed=finish?eventDuration*.82:0;
  if(i>=0){const e=events[i];inspect(e.to);if(innerWidth<761){$('#inspector').hidden=true;$('#open-inspector').hidden=false;}if(renderer)makePacket(e);}
  else if(packet){scene.remove(packet);disposePacket();packet=null;activeRoute=null;}
  updateText();
}
$('#play').onclick=()=>{if(playing){playing=false;updateText();return;}if(index===events.length-1)go(-1);playing=true;if(index<0)go(0);updateText();};
$('#scene-play').onclick=()=>$('#play').click();
$('#step').onclick=()=>{playing=false;go(Math.min(events.length-1,index+1),true);};
$('#reset').onclick=()=>{playing=false;go(-1);};
$('#scenario').onchange=()=>{events=createEvents($('#scenario').value);playing=false;go(-1);};
$('#overview').onclick=()=>{setWalking(false);if(camera)overview();};
$('#tour').onclick=()=>{tourIndex=(tourIndex+1)%stations.length;inspect(stations[tourIndex].id,true);$('#tour').textContent=`◎ 下一站 ${tourIndex+1}/${stations.length}`;};
$('#walk').onclick=()=>{
  if(!camera)return;setWalking(!walking);
  if(walking){$('#inspector').hidden=true;$('#open-inspector').hidden=false;flyTo(new THREE.Vector3(-13,2.4,8),new THREE.Vector3(-12,2.15,7.2));}
  else overview();
};
function setWalking(value){walking=value;keys.clear();document.body.classList.toggle('walking',value);$('#walk-pad').hidden=!value;$('#walk').setAttribute('aria-pressed',String(value));$('#walk').textContent=value?'◇ 离开车间':'◇ 进入车间';$('#camera-hint').textContent=value?'拖动环顾 · W A S D 移动 · Esc 返回全景':'拖动旋转 · 滚轮缩放 · 双指平移';if(controls){controls.minDistance=value?.3:5;controls.maxDistance=70;controls.maxPolarAngle=value?Math.PI*.65:Math.PI*.47;}}
function moveCamera(code,distance){if(!camera||!walking)return;const f=controls.target.clone().sub(camera.position);f.y=0;f.normalize();const r=new THREE.Vector3().crossVectors(f,new THREE.Vector3(0,1,0));const d=(code==='KeyW'?f:code==='KeyS'?f.negate():code==='KeyD'?r:r.negate()).multiplyScalar(distance);if(Math.abs(camera.position.x+d.x)<22&&Math.abs(camera.position.z+d.z)<20){camera.position.add(d);controls.target.add(d);}}
for(const b of document.querySelectorAll('[data-move]'))b.onclick=()=>{if(focusTween){camera.position.copy(focusTween.to);controls.target.copy(focusTween.targetTo);focusTween=null;}moveCamera(b.dataset.move,1.1);};
window.addEventListener('keydown',e=>{if(/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(document.activeElement.tagName))return;if(e.code==='Escape'){setWalking(false);if(camera)overview();}if(walking&&['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){keys.add(e.code);e.preventDefault();}});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
function toggleTheme(){const dark=document.body.classList.toggle('dark');$('#theme').setAttribute('aria-label',dark?'切换浅色主题':'切换深色主题');applySceneTheme(dark);}
$('#theme').onclick=toggleTheme;
function applySceneTheme(dark){if(!scene)return;scene.background.set(dark?0x182736:0xe9eeee);scene.fog.color.copy(scene.background);}
function material(color,metalness=.08,roughness=.68){return new THREE.MeshStandardMaterial({color,metalness,roughness});}
const mats={white:material(0xf9faf4),cream:material(0xe6dfcd),steel:material(0x76909d,.4,.4),dark:material(0x243c4c,.2),belt:material(0x516874,.3),blue:material(0x3878c8),amber:material(0xf0b05e),glass:new THREE.MeshPhysicalMaterial({color:0xc3e3e3,transparent:true,opacity:.42,roughness:.2,metalness:.05,depthWrite:false})};
function mesh(geo,mat,parent,x,y,z){const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(parent,w,h,d,x,y,z,mat=mats.white){return mesh(new THREE.BoxGeometry(w,h,d),mat,parent,x,y,z);}
function cylinder(parent,r,h,x,y,z,mat=mats.white,r2=r){return mesh(new THREE.CylinderGeometry(r,r2,h,32),mat,parent,x,y,z);}
function barBetween(parent,a,b,r,mat){const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b),delta=v2.clone().sub(v1);const o=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),mat,parent,...v1.clone().add(v2).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
function screen(parent,x,y,z,w=1,h=.7){box(parent,w,h,.08,x,y,z,mats.dark);for(let i=0;i<3;i++)box(parent,w*.65,.035,.02,x-.05,y+.17-i*.14,z+.05,i===0?mats.amber:mats.glass);}
function createStation(s){
  const g=new THREE.Group();g.position.set(...s.pos);scene.add(g);g.userData.station=s.id;
  const accent=material(s.color),base=box(g,4,.28,3.6,0,.05,0,mats.cream);base.userData.station=s.id;
  box(g,3.85,.05,3.45,0,.22,0,mats.white);
  for(const x of [-1.7,1.7])for(const z of [-1.4,1.4])cylinder(g,.12,.4,x,-.15,z,mats.dark);
  box(g,2.6,.07,.16,0,.28,1.5,accent);
  if(s.id==='runtime'){
    cylinder(g,1.3,.5,0,.55,0,mats.dark);cylinder(g,1.18,.14,0,.87,0,accent);
    cylinder(g,.78,1.35,0,1.6,0,mats.white);cylinder(g,.85,.12,0,2.3,0,accent);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;barBetween(g,[Math.cos(a)*.8,1.7,Math.sin(a)*.8],[Math.cos(a)*1.5,.65,Math.sin(a)*1.5],.07,mats.steel);}
    const ring=mesh(new THREE.TorusGeometry(1.02,.055,8,48),accent,g,0,1.65,0);ring.rotation.x=Math.PI/2;g.userData.rotor=ring;
    screen(g,0,1.7,.8,.9,.6);
    for(const x of [-1.5,1.5]){box(g,.4,.65,.5,x,.65,1,mats.dark);cylinder(g,.1,.12,x,1.05,1,mats.amber);}
  }else if(s.id==='model'){
    cylinder(g,1.5,.25,0,.45,0,mats.steel);cylinder(g,1.35,.12,0,.64,0,accent);
    for(const x of [-.7,0,.7]){box(g,.5,1.8,1.15,x,1.65,0,mats.white);for(let i=0;i<5;i++)box(g,.3,.055,.05,x,1.1+i*.22,.61,i<2?accent:mats.steel);}
    const ring=mesh(new THREE.TorusGeometry(1.3,.055,8,64),accent,g,0,2.5,0);ring.rotation.x=Math.PI*.4;g.userData.rotor=ring;
    box(g,3.4,.12,2,0,2.9,0,mats.white);for(const x of [-1.5,1.5])barBetween(g,[x,.5,-.8],[x,2.85,-.8],.06,mats.steel);
    for(let i=0;i<6;i++)box(g,.11,.02,.3,-1.2+i*.45,.29,1.25,accent);
  }else if(s.id==='tools'){
    box(g,2.8,.7,1.7,0,.7,0,mats.dark);box(g,3,.12,1.8,0,1.12,0,mats.steel);
    const arm=new THREE.Group();arm.position.set(.6,1.2,0);g.add(arm);cylinder(arm,.25,.25,0,0,0,accent);barBetween(arm,[0,.1,0],[.2,1.1,0],.13,accent);cylinder(arm,.18,.3,.2,1.1,0,mats.dark);barBetween(arm,[.2,1.1,0],[-.7,1.45,.2],.1,accent);barBetween(arm,[-.7,1.45,.2],[-.7,1,.2],.065,mats.dark);g.userData.rotor=arm;
    for(const x of [-1,-.4]){box(g,.42,.08,.65,x,1.25,.1,mats.cream);box(g,.28,.02,.05,x,1.3,.1,accent);}
    screen(g,-1.25,1.7,-.4,.65,.5);
    for(let i=0;i<3;i++)box(g,.55,.45,.6,-1+i,.55,1.25,i===0?accent:mats.cream);
  }else if(s.id==='context'){
    box(g,3,.9,1.9,0,.7,0,mats.white);box(g,3.2,.1,2.2,0,1.2,0,mats.dark);
    for(let i=0;i<4;i++){box(g,.55,.08,.85,-1.1+i*.72,1.32,0,i===2?accent:mats.cream);box(g,.34,.025,.06,-1.1+i*.72,1.38,.1,mats.steel);}
    for(const x of [-1.4,1.4])barBetween(g,[x,1.2,-.8],[x,2.1,-.8],.05,mats.steel);box(g,3,.22,.4,0,2.1,-.8,accent);
    screen(g,0,1.65,-.75,1.1,.6);
  }else if(s.id==='archive'||s.id==='memory'){
    for(let j=0;j<2;j++){
      const x=-.85+j*1.7;box(g,1.35,2.35,1.05,x,1.45,-.2,mats.dark);
      for(let i=0;i<4;i++){box(g,1.13,.45,.98,x,.65+i*.49,-.12,s.id==='archive'?mats.white:mats.cream);if(s.id==='archive'){box(g,.5,.06,.05,x,.65+i*.49,.4,accent);}else for(let k=0;k<5;k++)box(g,.12,.34,.1,x-.4+k*.19,.65+i*.49,.43,k%2?accent:mats.steel);}
      box(g,1.5,.12,1.2,x,2.7,-.2,accent);
    }
    box(g,1,.35,.8,.3,.5,1,mats.cream);
  }else if(s.id==='entrance'){
    box(g,2.9,1,1.2,0,.8,.3,mats.white);box(g,3.1,.13,1.4,0,1.35,.3,accent);screen(g,.65,1.75,.1,.8,.65);
    box(g,.7,.05,.8,-.7,1.48,.4,mats.cream);
    for(const x of [-1.6,1.6])barBetween(g,[x,.3,-.7],[x,2.9,-.7],.07,mats.dark);box(g,3.5,.5,.4,0,2.9,-.7,accent);
    // Human figure stays at the entrance: this task is delegated once.
    const human=new THREE.Group();human.position.set(-.1,.3,1.2);g.add(human);cylinder(human,.19,.65,0,.6,0,mats.blue);mesh(new THREE.SphereGeometry(.19,16,12),mats.cream,human,0,1.1,0);for(const x of [-.13,.13])barBetween(human,[x,.3,0],[x,0,.05],.065,mats.dark);
  }else if(s.id==='output'){
    box(g,2.6,.8,1.5,0,.7,0,mats.white);box(g,2.8,.12,1.65,0,1.17,0,accent);
    for(let i=0;i<5;i++)box(g,1.1,.035,.8,-.5,1.28+i*.04,.1,mats.cream);
    screen(g,.75,1.85,-.1,.85,.7);barBetween(g,[.75,1.2,-.1],[.75,1.7,-.1],.05,mats.steel);
    for(const x of [-1.65,1.65])cylinder(g,.07,1.2,x,.8,.9,mats.steel);barBetween(g,[-1.65,1.3,.9],[1.65,1.3,.9],.04,accent);
  }
  g.traverse(o=>{if(o.isMesh)o.userData.station=s.id;});stationObjects.set(s.id,g);
  const label=document.createElement('button');label.className='world-label';label.tabIndex=-1;label.innerHTML=`<b>${String(stations.indexOf(s)+1).padStart(2,'0')}</b>${s.name}`;label.onclick=()=>inspect(s.id,true);labelRoot.append(label);labels.push({el:label,pos:new THREE.Vector3(s.pos[0],3.5,s.pos[2]),id:s.id});
}
function routePoints(from,to,atPorts=false){
  const a=stationById.get(from).pos,b=stationById.get(to).pos;
  const start=new THREE.Vector3(a[0],.83,a[2]),end=new THREE.Vector3(b[0],.83,b[2]);
  if(atPorts){const direction=end.clone().sub(start).normalize();start.addScaledVector(direction,2.1);end.addScaledVector(direction,-2.1);}
  // Separate paths around the central loop avoid implying that data crosses unrelated stations.
  if((from==='context'&&to==='model')||(from==='memory'&&to==='context'))return [start,end];
  return [start,end];
}
function createBelt(from,to){
  const pts=routePoints(from,to),curve=new THREE.CatmullRomCurve3(pts),length=curve.getLength();
  const key=[from,to].sort().join(':');routes.set(key,curve);
  const group=new THREE.Group();scene.add(group);const a=pts[0],b=pts.at(-1),dx=b.x-a.x,dz=b.z-a.z,angle=Math.atan2(dx,dz),mid=a.clone().add(b).multiplyScalar(.5);
  const bed=box(group,.75,.13,length,mid.x,.59,mid.z,mats.belt);bed.rotation.y=angle;
  for(const side of [-1,1]){const rail=box(group,.055,.12,length,mid.x+Math.cos(angle)*side*.4,.75,mid.z-Math.sin(angle)*side*.4,mats.steel);rail.rotation.y=angle;}
  for(let t=.06;t<.97;t+=.55/length){const p=curve.getPoint(t);const roll=mesh(new THREE.CylinderGeometry(.07,.07,.7,8),mats.cream,group,p.x,.69,p.z);roll.rotation.z=Math.PI/2;roll.rotation.y=angle;}
  for(let t=.17;t<.91;t+=2.4/length){const p=curve.getPoint(t);for(const side of [-1,1])box(group,.09,.55,.09,p.x+Math.cos(angle)*side*.28,.28,p.z-Math.sin(angle)*side*.28,mats.steel);}
}
function cardTexture(text){const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#fffcf3';ctx.fillRect(0,0,512,256);ctx.fillStyle=$('#scenario').value==='failure'&&index>=6?'#9b532b':'#245de5';ctx.fillRect(0,0,16,256);ctx.font='600 49px "Microsoft YaHei",sans-serif';ctx.fillText(text,40,95);ctx.fillStyle='#8697a6';ctx.fillRect(42,141,320,9);ctx.fillRect(42,172,240,9);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function disposePacket(){if(!packet)return;packet.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.material.map)o.material.map.dispose();o.material.dispose();}});}
function makePacket(e){
  if(packet){scene.remove(packet);disposePacket();}
  const pts=routePoints(e.from,e.to,true);activeRoute=new THREE.CatmullRomCurve3(pts);
  packet=new THREE.Group();const cardMat=new THREE.MeshStandardMaterial({map:cardTexture(e.card),roughness:.8});
  const c=mesh(new THREE.BoxGeometry(1.25,.08,.68),cardMat,packet,0,0,0);c.rotation.x=0;
  // A vertical, camera-facing card makes the payload legible while it travels.
  const face=mesh(new THREE.PlaneGeometry(1.45,.73),new THREE.MeshBasicMaterial({map:cardTexture(e.card),side:THREE.DoubleSide}),packet,0,.55,0);packet.userData.face=face;
  const arrow=mesh(new THREE.ConeGeometry(.16,.4,3),new THREE.MeshStandardMaterial({color:0x245de5}),packet,0,.05,-.62);arrow.rotation.x=-Math.PI/2;
  scene.add(packet);packet.position.copy(pts[0]);
}
function flyTo(position,target){controls.maxDistance=70;if(reduced.matches){camera.position.copy(position);controls.target.copy(target);controls.update();focusTween=null;if(walking)controls.maxDistance=3;}else focusTween={from:camera.position.clone(),to:position,targetFrom:controls.target.clone(),targetTo:target,time:0};}
function overview(){const mobile=innerWidth<761;flyTo(new THREE.Vector3(mobile?35:24,mobile?41:24,mobile?44:30),new THREE.Vector3(0,0,0));}
function initScene(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0xe9eeee);scene.fog=new THREE.Fog(0xe9eeee,45,110);
  camera=new THREE.PerspectiveCamera(39,world.clientWidth/world.clientHeight,.1,160);
  const mobile=innerWidth<761;camera.position.set(mobile?35:24,mobile?41:24,mobile?44:30);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(world.clientWidth,world.clientHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;world.append(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=!reduced.matches;controls.dampingFactor=.08;controls.minDistance=5;controls.maxDistance=70;controls.maxPolarAngle=Math.PI*.47;controls.screenSpacePanning=false;
  controls.addEventListener('start',()=>{focusTween=null;});
  scene.add(new THREE.HemisphereLight(0xffffff,0x8496a3,2.6));const sun=new THREE.DirectionalLight(0xfff4dd,3.3);sun.position.set(-10,24,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:20,bottom:-20,near:1,far:60});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
  box(scene,31,.65,23,-1,-.65,1,mats.cream);box(scene,30.9,.1,22.9,-1,-.25,1,mats.white);
  const gridPoints=[];for(let x=-16;x<=14;x++)gridPoints.push(x,-.18,-10.4,x,-.18,12.4);for(let z=-10;z<=12;z++)gridPoints.push(-16.4,-.18,z,14.4,-.18,z);const gridGeo=new THREE.BufferGeometry();gridGeo.setAttribute('position',new THREE.Float32BufferAttribute(gridPoints,3));scene.add(new THREE.LineSegments(gridGeo,new THREE.LineBasicMaterial({color:0xe2e9e4})));
  // Low perimeter and open structural beams leave every responsibility visible.
  for(const x of [-15.5,13.5])box(scene,.16,.4,23,x,0,1,mats.steel);
  box(scene,31,.4,.15,-1,0,-10.5,mats.steel);
  for(const x of [-14,12])for(const z of [-9,10]){box(scene,.14,3.3,.14,x,1.4,z,mats.steel);box(scene,.6,.12,.5,x,3.1,z,mats.amber);}
  const connections=[['entrance','runtime'],['memory','context'],['runtime','context'],['context','model'],['model','runtime'],['runtime','tools'],['runtime','archive'],['runtime','output']];
  for(const [a,b] of connections)createBelt(a,b);
  for(const s of stations)createStation(s);
  activeHalo=mesh(new THREE.TorusGeometry(1.9,.055,8,80),new THREE.MeshBasicMaterial({color:0x245de5}),scene,0,.3,0);activeHalo.rotation.x=Math.PI/2;activeHalo.visible=false;
  // Click selects a building; dragging remains a camera operation.
  let down;renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
  renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...stationObjects.values()],true)[0];if(hit)inspect(hit.object.userData.station,true);});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;$('#webgl-fallback').hidden=false;$('#webgl-fallback').textContent='三维显示暂时中断。你可以继续用下方的站点与逐步回放。';updateText();});
  const resize=new ResizeObserver(()=>{camera.aspect=world.clientWidth/world.clientHeight;camera.updateProjectionMatrix();renderer.setSize(world.clientWidth,world.clientHeight);});resize.observe(world);
  document.body.dataset.webgl='ready';
}
try{initScene();}catch(error){console.error('Factory WebGL initialization:',error);renderer?.dispose();renderer=null;camera=null;controls=null;$('#webgl-fallback').hidden=false;$('#walk').disabled=true;$('#overview').disabled=true;document.body.dataset.webgl='unavailable';}
if(innerWidth<761){$('#inspector').hidden=true;$('#open-inspector').hidden=false;}
if(matchMedia('(prefers-color-scheme:dark)').matches)toggleTheme();
updateText();
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.08);last=now;if(document.hidden)return;
  if(playing){elapsed+=dt;if(elapsed>=eventDuration){if(index<events.length-1){go(index+1);}else{playing=false;elapsed=eventDuration;updateText();}}}
  if(!renderer)return;
  if(focusTween){const f=focusTween;f.time+=dt;const t=Math.min(1,f.time/1.35),ease=t*t*(3-2*t);camera.position.lerpVectors(f.from,f.to,ease);controls.target.lerpVectors(f.targetFrom,f.targetTo,ease);if(t===1){focusTween=null;if(walking)controls.maxDistance=3;}}
  if(walking&&!focusTween&&keys.size){const forward=controls.target.clone().sub(camera.position);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));const delta=new THREE.Vector3();if(keys.has('KeyW'))delta.add(forward);if(keys.has('KeyS'))delta.sub(forward);if(keys.has('KeyD'))delta.add(right);if(keys.has('KeyA'))delta.sub(right);delta.normalize().multiplyScalar(dt*4);if(Math.abs(camera.position.x+delta.x)<22&&Math.abs(camera.position.z+delta.z)<20){camera.position.add(delta);controls.target.add(delta);}}
  controls.update();
  if(packet&&activeRoute){const progress=reduced.matches?1:Math.min(1,elapsed/(eventDuration*.82));const p=activeRoute.getPoint(progress);packet.position.copy(p);const direction=activeRoute.getTangent(progress);packet.rotation.y=Math.atan2(-direction.x,-direction.z);const face=packet.userData.face;face.quaternion.copy(camera.quaternion);face.quaternion.premultiply(packet.quaternion.clone().invert());}
  for(const [id,g] of stationObjects){const rotor=g.userData.rotor;if(rotor&&playing&&!reduced.matches&&events[index]&&(id===events[index].to||id===events[index].from))rotor.rotation.y+=dt*.7;}
  if(selected){activeHalo.visible=true;const s=stationById.get(selected);activeHalo.position.set(s.pos[0],.31,s.pos[2]);}
  const w=world.clientWidth,h=world.clientHeight;
  for(const l of labels){const p=l.pos.clone().project(camera);l.el.style.left=`${(p.x*.5+.5)*w}px`;l.el.style.top=`${(-p.y*.5+.5)*h}px`;l.el.hidden=p.z>1||p.z< -1||Math.abs(p.x)>1.1||Math.abs(p.y)>1.1;l.el.classList.toggle('active',l.id===selected);}
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
