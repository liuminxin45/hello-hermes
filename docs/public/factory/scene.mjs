import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {STATIONS} from './content.mjs';
import {createDirector,NODES,FLOWS,OPERATION_PHASES,SETTLE_SECONDS} from './scene-state.mjs';

const SHORT_NAMES=['接收委托','调度','判断下一步','工具执行','历史检索','偏好与方法','工作台','草稿交付','过程记录'];
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const v3=p=>new THREE.Vector3(...p);
const NODE_FOR={input:0,newSession:6,planning:1,analysis:2,tool:3,toolRequest:3,toolResult:3,toolError:3,history:4,historyWrite:4,memory:5,memoryWrite:5,skill:5,decision:5,compress:6,delivery:7,review:8};
const FRONT_FACING_NODES=new Set(['intake','loop','analysis','tools','archive','memory','delivery','review']);

export function createFactory(host,onSelect=()=>{},onMoment=()=>{},onSceneState=()=>{}){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xe6eeed);scene.fog=new THREE.Fog(0xe6eeed,65,160);
  const camera=new THREE.PerspectiveCamera(43,1,.1,180);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.shadowMap.enabled=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','三维教学工厂，可拖动环顾、缩放或跟随导师参观。');
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=!reduced.matches;controls.dampingFactor=.07;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=3;controls.maxDistance=100;controls.screenSpacePanning=false;const initialMobile=host.clientWidth<760;camera.position.set(initialMobile?60:32,initialMobile?45:22,initialMobile?80:46);controls.target.set(initialMobile?0:3,1,9);
  const geometries=new Map(),materials=new Set();
  const geometry=(key,create)=>{if(!geometries.has(key))geometries.set(key,create());return geometries.get(key);};
  const mat=(color,metal=.05,rough=.7)=>{const material=new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough});materials.add(material);return material;};
  const m={white:mat(0xf8faf3),floor:mat(0xcbd6d0),steel:mat(0x77919a,.3,.5),ink:mat(0x233d4a),blue:mat(0x336eb7),mint:mat(0x8cb9a8),orange:mat(0xe6a34d),paper:mat(0xf3e9d3),green:mat(0x51886d),glass:new THREE.MeshPhysicalMaterial({color:0xb8dfdf,transparent:true,opacity:.17,roughness:.18,depthWrite:false})};
  const addMesh=(parent,geo,material,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(p,w,h,d,x,y,z,material=m.white)=>addMesh(p,geometry('box/'+[w,h,d].join('/'),()=>new THREE.BoxGeometry(w,h,d)),material,x,y,z);
  const cyl=(p,r,h,x,y,z,material=m.white)=>addMesh(p,geometry('cyl/'+[r,h].join('/'),()=>new THREE.CylinderGeometry(r,r,h,16)),material,x,y,z);
  function link(p,a,b,r,material=m.steel){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),o=addMesh(p,new THREE.CylinderGeometry(r,r,delta.length(),8),material,...av.clone().add(bv).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
  function textTexture(text,color='#253f50',background='#f5f8ef',w=1024,h=256){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.fillStyle=background;c.fillRect(0,0,w,h);c.fillStyle=color;c.font=`600 ${Math.min(78,w/(text.length+1))}px "Microsoft YaHei",sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2,w*.92);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
  function sign(p,text,w,h,x,y,z,color,bg){const tex=textTexture(text,color,bg),material=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});materials.add(material);const mesh=addMesh(p,geometry('plane/'+w+'/'+h,()=>new THREE.PlaneGeometry(w,h)),material,x,y,z);mesh.userData.label=true;mesh.userData.text=text;return mesh;}
  function setText(mesh,text){if(mesh.userData.text===text)return;mesh.userData.text=text;mesh.material.map?.dispose();mesh.material.map=textTexture(text);mesh.material.needsUpdate=true;}
  function monitor(p,x,y,z,w=1.15){box(p,w,.75,.12,x,y,z,m.ink);for(let i=0;i<3;i++)box(p,w*.68,.045,.02,x-.04,y+.2-i*.18,z+.08,i===0?m.orange:m.mint);}
  scene.add(new THREE.HemisphereLight(0xffffff,0x77908c,2.8));const sun=new THREE.DirectionalLight(0xfff5df,3);sun.position.set(-15,30,18);scene.add(sun);
  box(scene,160,.3,160,0,-.8,0,m.floor);box(scene,37,.5,36,0,-.4,3,m.white);
  for(const x of [-18,18])for(const z of [-12,20])box(scene,.3,6,.3,x,2.8,z,m.steel);
  for(const z of [-12,20])box(scene,36,.2,.3,0,5.8,z,m.steel);
  for(const x of [-6,6])box(scene,.4,6,.5,x,3,22,m.ink);box(scene,12.4,1.4,.6,0,6,22,m.blue);sign(scene,'HERMES',8,1.1,0,6,22.32);
  const overlay=document.createElement('div');overlay.className='world-labels';host.append(overlay);const groups=[],labels=[],workCards=[];
  for(let i=0;i<STATIONS.length;i++){
    const st=STATIONS[i],g=new THREE.Group();g.position.set(...st.position);scene.add(g);groups.push(g);
    box(g,5.2,.25,4.5,0,.1,0,m.white);box(g,4.8,.06,4.1,0,.26,0,m.paper);box(g,4.8,.1,.1,0,.3,2,m.blue);
    if(i===6){
      for(const x of [-2.4,2.4])for(const z of [-2,2])box(g,.1,3,.1,x,-1.5,z,m.steel);
      box(g,3.8,.8,2.4,0,.7,0,m.ink);box(g,3.8,2.9,2.4,0,2.6,0,m.glass);
      for(const x of [-1.8,1.8])for(const z of [-1.1,1.1])box(g,.06,3,.06,x,2.6,z,m.steel);
    }else if(i===0){
      box(g,4,1.2,1.8,0,.9,0,m.ink);box(g,4.4,.18,2.1,0,1.58,0,m.white);
      monitor(g,-1.25,2,-.3,.9);
    }else if(i===1){
      cyl(g,1.75,.95,0,.9,0,m.ink);cyl(g,1.9,.12,0,1.43,0,m.white);
      const ring=addMesh(g,new THREE.TorusGeometry(1.45,.07,8,32),m.blue,0,1.56,0);ring.rotation.x=Math.PI/2;
      monitor(g,0,2,-.45,1.15);
    }else if(i===2){
      box(g,3.7,1,1.8,0,.8,0,m.ink);box(g,4,.12,2,0,1.36,0,m.steel);
      monitor(g,-.9,2.1,-.25,1.4);monitor(g,.9,2.1,-.25,1.4);
    }else if(i===3){
      box(g,2.2,2.4,1.5,-.95,1.5,-.3,m.ink);
      for(let n=0;n<3;n++){const drawer=box(g,1.95,.55,.15,-.95,.78+n*.68,.51,m.steel);drawer.userData.inner=true;box(g,.5,.08,.12,-.95,.78+n*.68,.62,m.paper);}
      box(g,1.6,.75,1.7,1.15,.85,.3,m.white);monitor(g,1.15,1.7,.35,1.2);
    }else if(i===4){
      box(g,2.1,2.7,1.5,-1.05,1.65,-.3,m.ink);
      for(let row=0;row<4;row++){box(g,1.8,.09,1.35,-1.05,.65+row*.62,-.2,m.white);for(let n=0;n<4;n++){const paper=box(g,.3,.42,.7,-1.65+n*.4,.9+row*.62,-.15,m.mint);paper.userData.inner=true;}}
      box(g,1.6,.75,1.6,1.15,.8,.2,m.steel);
    }else if(i===5){
      box(g,1.9,2.3,1.5,-1.2,1.45,-.2,m.ink);
      for(let n=0;n<3;n++)box(g,1.65,.53,.13,-1.2,.73+n*.62,.61,m.mint);
      box(g,1.8,.85,1.7,1.15,.9,.2,m.steel);
    }else if(i===7){
      box(g,4,.9,2,0,.85,0,m.ink);box(g,4.3,.16,2.3,0,1.38,0,m.white);
    }else{
      box(g,3.6,1.1,2.1,0,.9,0,m.ink);monitor(g,-.75,2,.1,1.3);
      cyl(g,.7,.16,-.8,1.56,.15,m.paper);
    }
    g.traverse(o=>{if(o.isMesh)o.userData.station=i;});
    const b=document.createElement('button');b.className='world-label';b.textContent=SHORT_NAMES[i];b.onclick=()=>onSelect(i);overlay.append(b);labels.push({b,p:new THREE.Vector3(...st.position).add(new THREE.Vector3(0,i===6?4.8:3.8,0)),i});
  }
  // Distinct physical parts for persistent history, search and long-term preference.
  cyl(groups[4],.6,1.1,-1,1.2,1.15,m.steel);sign(groups[4],'原文',1.5,.35,-1,2,1.5);
  monitor(groups[4],1.2,1.4,1.3,1);sign(groups[4],'索引',1.5,.35,1.2,2.2,1.5);
  sign(groups[5],'偏好',1.5,.4,-1.2,2.85,.8);sign(groups[5],'方法',1.5,.4,1.2,2.85,.8);
  const training=new THREE.Group();groups[8].add(training);box(training,1.6,.7,1.2,1.2,.9,1,m.steel);sign(training,'训练关闭',1.8,.4,1.2,1.5,1.7,'#8a5819');training.traverse(o=>o.userData.inactive=true);
  const director=createDirector(),callbacks=new Map(),observedEvents=new Map();let state=null,visitId=null,phase='arrival',paused=false,navWhilePaused=false,time=0,current=-1,free=false,labMode=false,fly=null,inspection=[],reducedOverride=false,dark=false,quality='balanced',contextLost=false,disposed=false;
  const isReduced=()=>reducedOverride||reduced.matches;

  const halos=groups.map(g=>{const points=[[-2.7,.4,-2.4],[2.7,.4,-2.4],[2.7,.4,2.4],[-2.7,.4,2.4],[-2.7,.4,-2.4]].map(p=>new THREE.Vector3(...p));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x388eaa,transparent:true,opacity:.8}));g.add(line);return line;});
  const lamps=groups.map(g=>cyl(g,.13,.2,2.25,.5,1.8,m.green.clone()));
  const rotors=[];for(let i=0;i<groups.length;i++)groups[i].traverse(o=>{if(o.geometry?.type==='TorusGeometry'){for(let k=0;k<3;k++)box(o,.17,.3,.13,Math.cos(k*Math.PI*2/3)*1.15,Math.sin(k*Math.PI*2/3)*1.15,0,m.orange);rotors.push({node:NODES[i],mesh:o});}});
  const storageLamp=cyl(groups[4],.1,.2,-1,2.2,1.15,m.blue.clone()),indexLamp=cyl(groups[4],.1,.2,1.2,2.45,1.15,m.blue.clone());
  const toolEntryLamp=cyl(groups[3],.12,.18,-1.9,2.9,.7,m.blue.clone()),toolExitLamp=cyl(groups[3],.12,.18,1.8,2,.65,m.green.clone()),toolErrorLamp=cyl(groups[3],.12,.18,1.8,1.65,.65,m.orange.clone());
  const preferenceLamp=cyl(groups[5],.1,.2,-1.3,3.3,.7,m.mint.clone()),skillLamp=cyl(groups[5],.1,.2,1.3,3.3,.7,m.mint.clone());
  const archiveArrow=new THREE.ArrowHelper(new THREE.Vector3(-1,0,0),new THREE.Vector3(1,1.5,1.4),1.8,0x5086d0,.3,.2);groups[4].add(archiveArrow);
  const contextMaterial={head:mat(0x3e82c4),middle:mat(0xc38b38),tail:mat(0x519477),free:mat(0x394650),rules:mat(0x7d91a6)};
  const slotPosition=slot=>new THREE.Vector3(-1.25+(slot%4)*.83,1.25+Math.floor(slot/4)*.51,0);
  const packetPool=Array.from({length:32},()=>{const mesh=box(groups[6],.67,.36,1.2,0,0,0,contextMaterial.middle.clone());mesh.userData.packet=true;mesh.visible=false;const label=sign(mesh,'',.63,.23,0,0,.62);label.userData.inner=true;return {mesh,label};});
  const freeSlots=Array.from({length:20},(_,i)=>{const p=slotPosition(i),o=box(groups[6],.67,.035,1.2,p.x,p.y-.2,p.z,contextMaterial.free.clone());o.material.transparent=true;o.material.opacity=.18;return o;});
  const protectiveFrames=Array.from({length:5},()=>{const edges=new THREE.EdgesGeometry(geometry('packet-outline',()=>new THREE.BoxGeometry(.75,.43,1.28))),o=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0x2d84b8,transparent:true,opacity:.9}));groups[6].add(o);o.visible=false;return o;});
  const threshold=box(groups[6],3.7,.035,.07,0,2.78,1.26,m.orange);sign(groups[6],'70 整理线',1.8,.3,2.2,2.78,1.3);
  const reserve=box(groups[6],.1,1.02,.1,2,3.3,1.2,contextMaterial.free);sign(groups[6],'20 预留',1.65,.3,2.2,3.9,1.3);
  const compressor=new THREE.Group();compressor.position.set(3.2,.6,.1);groups[6].add(compressor);box(compressor,1.5,.3,1.8,0,0,0,m.steel);box(compressor,1.5,.15,1.8,0,1.7,0,m.orange);const piston=box(compressor,1.2,.2,1.5,0,1.2,0,m.orange);sign(compressor,'摘要整理',1.7,.4,0,2.1,.9);
  const summary=new THREE.Group();summary.position.set(3.2,2,.1);groups[6].add(summary);const summaryTags=['条件','来源','待办','格式'].map((text,i)=>sign(summary,text,1.4,.28,0,.7-i*.34,1.06));summary.visible=false;
  const rawArchive=new THREE.Group();rawArchive.position.set(-3.7,.45,.1);groups[6].add(rawArchive);box(rawArchive,1.4,1.2,1.5,0,.6,0,m.ink);for(let i=0;i<3;i++)box(rawArchive,1.2,.18,1.15,0,.4+i*.27,.1,m.paper);sign(rawArchive,'原始档案',1.7,.35,0,1.55,.8);
  const capacityLabel=sign(groups[6],'40 / 100 格',3,.45,0,4.32,1.26);let capacityText='';
  const resultLabel=sign(groups[6],'70 → 35',1.9,.4,3.3,3.6,1.2);resultLabel.visible=false;
  const preferenceDrawer=box(groups[5],1.65,.45,.22,-1.2,1.35,.75,m.mint),bookPivot=new THREE.Group();bookPivot.position.set(.65,1.45,.5);groups[5].add(bookPivot);box(bookPivot,1.1,.1,1.3,.55,0,0,m.orange);box(bookPivot,1,.06,1.22,.55,.09,0,m.paper);
  const incomingCards=Array.from({length:3},(_,i)=>{const mesh=box(groups[0],.72,.09,1.05,-.8+i*.82,1.75,.1,m.paper.clone());const label=sign(mesh,'S'+(i+1),.62,.27,0,.15,.57);return {mesh,label};});
  const drafts=Array.from({length:2},(_,i)=>{const mesh=box(groups[7],1.35,.08,1.8,-.8+i*1.6,1.62,.1,m.paper.clone());sign(mesh,'草稿 '+(i+1),1.1,.35,0,.16,.94);return mesh;});
  const analysisCards=Array.from({length:3},(_,i)=>{const mesh=box(groups[2],.8,.08,.95,-1+i,1.51,.4,m.paper.clone()),label=sign(mesh,'S'+(i+1),.75,.24,0,.18,.52);return {mesh,label};});
  const instructionCard=box(groups[1],1.35,.1,.9,0,1.6,.65,m.paper);const instructionLabel=sign(instructionCard,'下一步',1.2,.32,0,.2,.49);
  const rawFragments=['申请审核','PDF / MD','仅草稿'].map((text,i)=>sign(compressor,text,1.65,.28,0,1.15-i*.34,1.04));
  const toolDrawers=groups[3].children.filter(o=>o.userData.inner);
  const flowColors={task:0x299eb7,tool:0x299eb7,history:0x5086d0,memory:0xaa72bc,persist:0x648fa2,trace:0x7a8a94,error:0xb67a31};
  const edges=FLOWS.map(f=>{const a=new THREE.Vector3(...STATIONS[NODES.indexOf(f.from)].position).add(new THREE.Vector3(0,.75,0)),b=new THREE.Vector3(...STATIONS[NODES.indexOf(f.to)].position).add(new THREE.Vector3(0,.75,0));const delta=b.clone().sub(a),forward=delta.clone().normalize();a.addScaledVector(forward,2.9);b.addScaledVector(forward,-2.9);const side=new THREE.Vector3(-delta.z,0,delta.x).normalize().multiplyScalar(.42);const curve=new THREE.QuadraticBezierCurve3(a.clone().add(side),a.clone().add(b).multiplyScalar(.5).add(side).add(new THREE.Vector3(0,1.5,0)),b.clone().add(side));const geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(32));const material=f.type==='trace'?new THREE.LineDashedMaterial({color:flowColors[f.type],dashSize:.18,gapSize:.16,transparent:true,opacity:.25}):new THREE.LineBasicMaterial({color:flowColors[f.type],transparent:true,opacity:.3});const line=new THREE.Line(geometry,material);line.computeLineDistances();scene.add(line);const tube=f.type==='trace'?null:new THREE.Mesh(new THREE.TubeGeometry(curve,32,.035,5,false),new THREE.MeshBasicMaterial({color:flowColors[f.type],transparent:true,opacity:.6,depthWrite:false}));if(tube)scene.add(tube);
    const arrow=new THREE.ArrowHelper(curve.getTangent(.76).normalize(),curve.getPoint(.76),.9,flowColors[f.type],.35,.25);scene.add(arrow);
    const particle=box(scene,.9,.1,.58,0,0,0,new THREE.MeshBasicMaterial({color:flowColors[f.type]}));const cardLabel=sign(particle,f.label,1.4,.38,0,.45,0);particle.visible=false;return {f,curve,line,tube,arrow,particle,cardLabel,cardText:f.label};});
  function person(material,name,helmet=false){
    const g=new THREE.Group();cyl(g,.22,.39,0,1.4,0,m.paper);box(g,.64,.67,.42,0,.96,0,material);
    if(helmet)cyl(g,.28,.14,0,1.65,0,m.white);else box(g,.47,.12,.42,0,1.61,0,m.ink);
    const limbs={};for(const [key,x,y,w,h,depth,partMaterial]of [['leftArm',-.4,1.23,.15,.57,.17,material],['rightArm',.4,1.23,.15,.57,.17,material],['leftLeg',-.18,.65,.19,.58,.24,m.ink],['rightLeg',.18,.65,.19,.58,.24,m.ink]]){const pivot=new THREE.Group();pivot.position.set(x,y,0);g.add(pivot);box(pivot,w,h,depth,0,-h/2,0,partMaterial);limbs[key]=pivot;}
    const carry=box(limbs.rightArm,.53,.08,.4,0,-.5,.28,m.paper);carry.visible=false;
    const nameplate=sign(g,name,1.15,.3,0,2.05,.04),shadow=addMesh(g,new THREE.CircleGeometry(.52,20),new THREE.MeshBasicMaterial({color:0x183142,transparent:true,opacity:.13,depthWrite:false}),0,.02,0);shadow.rotation.x=-Math.PI/2;
    const surfaces=[];g.traverse(o=>{if(!o.isMesh||o===shadow)return;o.material=o.material.clone();materials.add(o.material);surfaces.push({material:o.material,opacity:o.material.opacity,transparent:o.material.transparent,depthWrite:o.material.depthWrite});});scene.add(g);return {g,limbs,carry,nameplate,shadow,surfaces};
  }
  const guide=person(m.orange,'导师'),operator=person(m.blue,'工具工人',true),mentor=guide.g,worker=operator.g;mentor.position.set(-3,0,24);worker.visible=false;
  let mentorTrip=null,workerOp=null,workerOrigin=new THREE.Vector3();
  function pose(person,action,t=0){const walking=action==='walk',swing=walking&&!isReduced()?Math.sin(t*9)*.55:0;person.limbs.leftLeg.rotation.x=swing;person.limbs.rightLeg.rotation.x=-swing;person.limbs.leftArm.rotation.x=-swing;person.limbs.rightArm.rotation.x=swing;person.carry.visible=['receive','read','return','write','summarize','open-book','deliver','compare'].includes(action);if(person.carry.visible){person.limbs.rightArm.rotation.x=-.9;person.limbs.leftArm.rotation.x=action==='summarize'||action==='read'?-.7:0;}if(action==='point')person.limbs.rightArm.rotation.x=-1.12;if(action==='stop')person.limbs.rightArm.rotation.z=-.8;else person.limbs.rightArm.rotation.z=0;}
  function moveMentor(to){if(isReduced()){mentor.position.copy(to);mentorTrip=null;}else mentorTrip={from:mentor.position.clone(),to:to.clone(),elapsed:0,duration:1.65};}
  const statusNames={Idle:'空闲',Running:'运行中',Waiting:'等待操作',Completed:'已完成',Error:'错误 · 可重试'};
  const fadedTint=new THREE.Color(0x9ba5a6);
  let previousFocus=null,fade=1,fromWeights=NODES.map(()=>1),weights=NODES.map(()=>1),traceTime=0;
  const keySet=new Set();
  let viewport={width:1,height:1};
  function fitDistance(index,aspect=camera.aspect,detail=false){const b=new THREE.Box3().setFromObject(groups[index]),size=b.getSize(new THREE.Vector3());const vertical=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2),horizontal=vertical*aspect;return Math.max(size.y/vertical,size.x/horizontal,size.z/horizontal)*(detail?.58:.72)+3;}
  function cameraFor(index,detail=false){const p=v3(STATIONS[index].position),target=p.clone().add(new THREE.Vector3(index===6?.25:0,1.8,0)),direction=(FRONT_FACING_NODES.has(NODES[index])?new THREE.Vector3(.45,.55,.95):new THREE.Vector3(.6,.56,.84)).normalize();return {target,eye:clearEye(target,direction.multiplyScalar(fitDistance(index,camera.aspect,detail)),target,NODES[index])};}
  function resize(){const rect=host.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));viewport={width:w,height:h};camera.aspect=w/h;camera.clearViewOffset();camera.updateProjectionMatrix();renderer.setSize(w,h,false);if(current>=0&&!director.state.manual&&!inspection.length){const view=cameraFor(current);if(fly){fly.to=view.eye;fly.target=view.target;}else{camera.position.copy(view.eye);controls.target.copy(view.target);}}}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
  function flight(to,target,duration=1.65,delay=0){free=false;navWhilePaused=isPaused();const lift=Math.max(camera.position.y,to.y)+1;fly={from:camera.position.clone(),old:controls.target.clone(),to,target,duration,delay,t:0,lift};if(isReduced()){camera.position.copy(to);controls.target.copy(target);fly=null;director.state.tourTime=SETTLE_SECONDS;director.setStageReady();fade=1;}}
  function clearEye(origin,offset,target,node){
    // Front drawers, displays and handoff points face +Z. Background platforms
    // must never make an automatic shot cross to the back of these devices.
    const front=FRONT_FACING_NODES.has(node),base=offset.clone();if(front)base.z=Math.max(.1,Math.abs(base.z));
    const mirrored=base.clone().multiply(new THREE.Vector3(-1,1,1)),candidates=front?[base,mirrored,base.clone().add(new THREE.Vector3(0,2.5,0)),mirrored.clone().add(new THREE.Vector3(0,2.5,0))]:[base,mirrored,base.clone().multiply(new THREE.Vector3(1,1,-1)),base.clone().multiply(new THREE.Vector3(-1,1,-1))];let best=null,score=Infinity;
    scene.updateMatrixWorld(true);
    const solids=[];for(const group of groups)group.traverse(object=>{if(!object.isMesh||object.userData.label)return;const material=Array.isArray(object.material)?object.material:[object.material];if(material.every(value=>value.isMeshPhysicalMaterial))return;object.geometry.computeBoundingBox();solids.push(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));});
    for(const [candidateIndex,option] of candidates.entries()){const eye=origin.clone().add(option),distance=eye.distanceTo(target),ray=new THREE.Ray(target.clone(),eye.clone().sub(target).normalize());if(solids.some(solid=>solid.containsPoint(eye)))continue;let hits=0;
      for(let i=0;i<groups.length;i++){if(NODES[i]===node)continue;const point=ray.intersectBox(new THREE.Box3().setFromObject(groups[i]),new THREE.Vector3());if(point&&point.distanceTo(target)<distance)hits++;}
      const cost=hits+candidateIndex*.15;if(cost<score){score=cost;best=eye;}if(hits===0)break;
    }
    if(best)return best;
    // A raised front view remains outside solids even in a very narrow viewport.
    const fallback=origin.clone().add(base);for(let step=0;step<30&&solids.some(solid=>solid.containsPoint(fallback));step++)fallback.y+=1;return fallback;
  }
  function arrival(){director.overview();phase='arrival';current=-1;free=false;resize();flight(new THREE.Vector3(29,26,43),new THREE.Vector3(0,1,6));moveMentor(new THREE.Vector3(-3,0,24));}
  function overview(){director.overview();phase='tour';resize();flight(new THREE.Vector3(35,32,43),new THREE.Vector3(0,1.8,3));}
  function focus(i,{resume=false}={}){if(i<0||i>=NODES.length)return false;fromWeights=[...weights];fade=0;current=i;phase='tour';const moveCamera=director.focus(i,{resume}),p=v3(STATIONS[i].position);moveMentor(p.clone().add(new THREE.Vector3(-3,0,2)));inspection=[];if(!moveCamera){fly=null;navWhilePaused=false;fade=1;return false;}controls.minDistance=3;const view=cameraFor(i);flight(view.eye,view.target);return true;}
  function inspectPart(part='core',node=NODES[current]){if(current<0||!NODES.includes(node))return;if(!inspection.length)inspection.push({view:director.viewState(),free,minDistance:controls.minDistance,position:camera.position.clone(),target:controls.target.clone()});director.inspect(part,node);const p=v3(STATIONS[NODES.indexOf(node)].position);let shift=new THREE.Vector3();if(part==='head')shift.x=-1.15;if(part==='tail')shift.x=1.15;if(part==='compressor')shift.x=3.1;if(part==='sqlite')shift.set(-1,0,1);if(part==='index')shift.set(1.2,0,1);if(part==='preference')shift.x=-1.3;if(part==='skills')shift.x=1.3;p.add(shift);const target=p.clone().add(new THREE.Vector3(0,2,0)),distance=Math.max(7,6/camera.aspect);flight(clearEye(p,new THREE.Vector3(.55,.55,.85).normalize().multiplyScalar(distance),target,node),target);}
  function restoreInspection(){const saved=inspection.pop();if(!saved)return;director.restoreView(saved.view);controls.minDistance=saved.minDistance;if(saved.view.manual){fly=null;navWhilePaused=false;free=saved.free;camera.position.copy(saved.position);controls.target.copy(saved.target);}else flight(saved.position,saved.target,1.2);}
  function trace(){if(current<0)return;director.trace();traceTime=0;const e=edges.find(x=>director.snapshot().activeFlowIds.includes(x.f.id))||edges.find(x=>x.f.from===NODES[current]&&x.f.type!=='trace')||edges.find(x=>x.f.to===NODES[current]);if(e){const p=e.curve.getPoint(.1);flight(p.clone().add(new THREE.Vector3(5,6,8)),p.clone().add(new THREE.Vector3(0,1,0)),1.2);}}
  function setFree(v){free=v;director.manual();if(v){fly=null;controls.minDistance=.3;camera.position.y=Math.max(2.2,camera.position.y);controls.target.copy(camera.position.clone().add(new THREE.Vector3(0,0,-1)));}else{controls.minDistance=3;focus(current,{resume:true});}}
  function collides(p){return STATIONS.some(s=>Math.abs(p.x-s.position[0])<2.9&&Math.abs(p.z-s.position[2])<2.6&&p.y>s.position[1]-.4&&p.y<s.position[1]+4.5);}
  function move(code,d=.8){if(!free)return;const forward=controls.target.clone().sub(camera.position).setY(0).normalize(),right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));const delta=(code==='KeyW'?forward:code==='KeyS'?forward.negate():code==='KeyD'?right:right.negate()).multiplyScalar(d),p=camera.position.clone().add(delta);if(Math.abs(p.x)<26&&Math.abs(p.z)<32&&!collides(p)){camera.position.copy(p);controls.target.add(delta);}}
  const onKeydown=e=>{if(!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){keySet.add(e.code);if(free)e.preventDefault();}},onKeyup=e=>keySet.delete(e.code),onBlur=()=>keySet.clear();window.addEventListener('keydown',onKeydown);window.addEventListener('keyup',onKeyup);window.addEventListener('blur',onBlur);controls.addEventListener('start',()=>{fly=null;director.manual();});
  let pointer;renderer.domElement.addEventListener('pointerdown',e=>pointer=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!pointer||Math.hypot(e.clientX-pointer[0],e.clientY-pointer[1])>5)return;const r=host.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hits=ray.intersectObjects(groups,true).filter(hit=>{let object=hit.object;while(object&&object!==scene){if(!object.visible)return false;object=object.parent;}return (Array.isArray(hit.object.material)?hit.object.material:[hit.object.material]).some(material=>material.opacity>.04);}),focusId=director.snapshot().focusNodeId,hit=hits.find(item=>NODES[item.object.userData.station]===focusId)||hits[0];if(hit&&Number.isInteger(hit.object.userData.station))onSelect(hit.object.userData.station);});
  function setState(s){
    state=s;if(!s)return;if(visitId!==s.id){visitId=s.id;director.reset();observedEvents.clear();}
    for(const event of s.events||[]){const id=event.id||event.eventId||event.seq;if(id!=null)observedEvents.set(String(id),event);}
    // Merely loading data, visiting or restoring never re-executes a task.
    director.waiting(s.waitingNodeIds||[]);
  }
  function observeEvent(event,options={}){if(!event)return null;const key=event.id||event.eventId||event.seq;if(key!=null)observedEvents.set(String(key),event);return director.observeEvent(event,options);}
  function setObservation({nodeId,eventId,mode='guide',resume=false}={}){const index=NODES.indexOf(nodeId);if(Object.hasOwn(arguments[0]||{},'eventId'))director.state.observation=eventId!=null&&observedEvents.has(String(eventId))?structuredClone(observedEvents.get(String(eventId))):null;if(mode==='overview'){overview();return;}if(index>=0){if(mode==='inspect'){inspectPart('core',nodeId);return;}focus(index,{resume:resume||mode==='guide-resume'});if(mode==='trace')trace();}}
  function skipMotion(){director.skipMotion();if(fly){if(!director.state.manual){camera.position.copy(fly.to);controls.target.copy(fly.target);}fly=null;}navWhilePaused=false;fade=1;if(!director.state.manual)controls.update();for(const id of director.finished()){const done=callbacks.get(id);callbacks.delete(id);done?.();}}
  function operate(kind,done){const id=director.run(kind);callbacks.set(id,done);return id;}
  const staticRecords=groups.map((g,i)=>{const records=[];g.traverse(o=>{if(!o.isMesh)return;o.userData.station=i;const array=Array.isArray(o.material),sources=array?o.material:[o.material],clones=sources.map(source=>{const material=source.clone();materials.add(material);return material;});o.material=array?clones:clones[0];for(const material of clones)records.push({o,material,color:material.color?.clone(),opacity:material.opacity,depthWrite:material.depthWrite,transparent:material.transparent,castShadow:o.castShadow,receiveShadow:o.receiveShadow,visible:o.visible});});return records;});
  let momentKey='',readyMoment=-1,lastCaptureMeta=null;
  let occlusionKey='',occluding=new Set();
  const bounds=groups.map(g=>new THREE.Box3().setFromObject(g));
  function updateOcclusion(focus){const key=focus+'/'+camera.position.toArray().map(n=>n.toFixed(1)).join(',');if(key===occlusionKey)return;occlusionKey=key;occluding=new Set();if(!focus)return;const idx=NODES.indexOf(focus),center=bounds[idx].getCenter(new THREE.Vector3());for(const offset of [[0,0,0],[.9,0,0],[-.9,0,0],[0,.9,0],[0,-.9,0]]){const target=center.clone().add(v3(offset)),distance=camera.position.distanceTo(target),ray=new THREE.Ray(camera.position.clone(),target.clone().sub(camera.position).normalize());for(let i=0;i<bounds.length;i++){if(i===idx)continue;const hit=ray.intersectBox(bounds[i],new THREE.Vector3());if(hit&&hit.distanceTo(camera.position)<distance-.7)occluding.add(i);}}}
  const isPaused=()=>paused||director.snapshot().presentation.paused;
  function renderPeople(snap,dt){
    if(mentorTrip){mentorTrip.elapsed+=dt;const t=smooth(mentorTrip.elapsed/mentorTrip.duration);mentor.position.lerpVectors(mentorTrip.from,mentorTrip.to,t);mentor.lookAt(mentorTrip.to.x,mentor.position.y,mentorTrip.to.z);pose(guide,'walk',mentorTrip.elapsed);if(t===1)mentorTrip=null;}else{if(snap.focusNodeId)mentor.lookAt(...v3(STATIONS[NODES.indexOf(snap.focusNodeId)].position).setY(mentor.position.y).toArray());pose(guide,'point',time);}
    const op=snap.operation||snap.heldOperation,frame=snap.frame,index=NODE_FOR[op?.kind];worker.visible=phase!=='arrival'&&index!==undefined&&!!frame?.actor;if(!worker.visible)return;
    if(workerOp!==op.id){workerOp=op.id;workerOrigin.copy(worker.position.lengthSq()?worker.position:v3(STATIONS[index].position).add(v3([3,0,3])));}
    const station=v3(STATIONS[index].position),entry=station.clone().add(v3([3,0,2.1])),machine=station.clone().add(v3([2.6,0,.3])),exit=station.clone().add(v3([2.7,0,2.4]));if(index===6){entry.x=station.x+4.8;machine.x=station.x+3.7;}
    const arrival=op.kind==='compress'?2:1.2,action=frame.actor.action;let target=machine,progress=1,from=entry;if(frame.phaseId==='arrive'||frame.phaseId==='base'){from=workerOrigin;target=entry;progress=frame.phaseProgress;}else if(action==='return'){from=machine;target=exit;progress=frame.phaseProgress;}else if(op.elapsed<arrival+1.2){from=entry;target=machine;progress=clamp((op.elapsed-arrival)/1.2);}
    if(['hold','result'].includes(frame.phaseId)){from=exit;target=exit;progress=1;}
    worker.position.lerpVectors(from,target,smooth(progress));worker.lookAt(station.x,worker.position.y,station.z);pose(operator,progress<1&&action!=='return'?'walk':action,frame.elapsed);const actorWeight=!snap.focusNodeId||NODES[index]===snap.focusNodeId?1:snap.relatedNodeIds.includes(NODES[index])?.6:.18;operator.shadow.material.opacity=.13*actorWeight;for(const surface of operator.surfaces){surface.material.opacity=surface.opacity*actorWeight;surface.material.transparent=surface.transparent||actorWeight<1;surface.material.depthWrite=actorWeight<1?false:surface.depthWrite;}operator.nameplate.visible=actorWeight>.5;setText(operator.nameplate,frame.actor.role==='organizer'?'整理员':frame.actor.role==='archivist'?'档案员':frame.actor.role==='courier'?'交付员':frame.actor.role==='mentor'?'调度员':frame.actor.role==='analyst'?'核查员':'工具工人');
  }
  function renderContext(snap){
    const demo=snap.frame?.context,live=state?.context,units=demo?.units??(live?.view==='before'?live?.load:live?.units)??25;
    const packets=demo?.packets||Array.from({length:Math.round(units/5)},(_,i)=>({id:'static-'+i,slot:i,kind:i===0?'rules':i<3?'head':i>=Math.round(units/5)-2?'tail':'middle',location:'container',counted:true,progress:1}));
    for(let i=0;i<packetPool.length;i++){const {mesh,label}=packetPool[i],packet=packets[i];mesh.visible=!!packet&&!['archive','pending'].includes(packet.location);if(!mesh.visible)continue;const position=slotPosition(packet.slot),location=packet.location,progress=smooth(packet.progress??1);mesh.position.copy(position);mesh.scale.setScalar(1);mesh.rotation.set(0,0,0);
      if(location==='incoming')mesh.position.lerpVectors(new THREE.Vector3(-3.3,2.1,1.8),position,progress);if(location==='summarizing')mesh.position.lerpVectors(position,new THREE.Vector3(3.2,1.3+(i%4)*.22,.1),Math.min(.95,progress));if(location==='machine')mesh.position.set(3.2,1.7+(i%2)*.4,.1);if(location==='returning')mesh.position.lerpVectors(new THREE.Vector3(3.2,1.7+(i%2)*.4,.1),position,progress);
      mesh.material.color.copy(contextMaterial[packet.kind]?.color||contextMaterial.middle.color);mesh.material.opacity=snap.focusNodeId&&snap.focusNodeId!=='context'?.18:1;mesh.material.transparent=mesh.material.opacity<1;mesh.material.depthWrite=mesh.material.opacity===1;setText(label,packet.kind==='summary'?'摘要':packet.kind==='rules'?'规则':packet.id?.startsWith('head')?'要求':packet.pairId?.replace('turn-','T')||'比对');label.visible=snap.focusNodeId==='context';}
    const counted=packets.filter(p=>p.counted).map(p=>p.slot);freeSlots.forEach((slot,i)=>slot.visible=!counted.includes(i));const protectedPackets=packets.filter(packet=>packet.protected);protectiveFrames.forEach((frame,i)=>{const packet=protectedPackets[i];frame.visible=!!packet;if(packet){frame.position.copy(slotPosition(packet.slot));frame.material.opacity=snap.focusNodeId&&snap.focusNodeId!=='context'?.12:.9;frame.material.color.set(packet.kind==='tail'?0x38996e:0x2e7ac1);}});
    summary.visible=!!demo&&demo.time>=17;summaryTags.forEach((tag,i)=>{tag.visible=!!demo&&demo.time>=17+i*.8&&(!demo.summary.loss||i<2);setText(tag,demo?.summary.loss?['Atlas开放','Delta检索','',''][i]:['需审核','A1 / D1','只交草稿','PDF / MD'][i]);});rawFragments.forEach(fragment=>fragment.visible=!!demo&&demo.time>=15&&demo.time<23);piston.position.y=demo&&demo.phaseId==='summarize'?1.2-Math.sin(demo.progress*Math.PI*2)*.14:1.2;threshold.material.color.set(demo?.thresholdReached?0xcc8a2f:0x638c79);reserve.visible=snap.focusNodeId===null||snap.focusNodeId==='context';const text=units+' / 100 格';if(text!==capacityText){capacityText=text;setText(capacityLabel,text);}capacityLabel.visible=snap.focusNodeId===null||snap.focusNodeId==='context';resultLabel.visible=!!demo&&demo.time>=23;rawArchive.visible=snap.focusNodeId===null||snap.focusNodeId==='context';
  }
  function renderLabels(snap){
    const focus=snap.focusNodeId,allowed=focus?[focus,...snap.relatedNodeIds.slice(0,2)]:NODES,placed=[],safeTop=viewport.width<760?110:120,safeBottom=90,order=[...labels].sort((a,b)=>(NODES[b.i]===focus)-(NODES[a.i]===focus));for(const l of order){const id=NODES[l.i],point=l.p.clone(),front=point.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()))>0,p=point.project(camera),status=snap.nodeStates[id];let hidden=phase==='arrival'||!allowed.includes(id)||!front||p.z<-1||p.z>1||Math.abs(p.x)>.94||Math.abs(p.y)>.91;const x=(p.x*.5+.5)*viewport.width,projectedY=(-p.y*.5+.5)*viewport.height,y=id===focus?clamp(projectedY,safeTop+18,Math.max(safeTop+18,viewport.height-safeBottom-18)):projectedY,text=SHORT_NAMES[l.i]+(id===focus&&status!=='Idle'?' · '+statusNames[status]:''),w=Math.min(250,text.length*13+20),rect={left:x-w/2,right:x+w/2,top:y-14,bottom:y+18};if(id!==focus&&(rect.top<safeTop||rect.bottom>viewport.height-safeBottom))hidden=true;if(viewport.height<safeTop+safeBottom+45)hidden=true;if(!hidden&&placed.some(r=>rect.left<r.right+8&&rect.right>r.left-8&&rect.top<r.bottom+8&&rect.bottom>r.top-8))hidden=true;l.b.hidden=hidden;if(!hidden){placed.push(rect);l.b.style.left=x+'px';l.b.style.top=y+'px';l.b.style.opacity=id===focus?'1':'.72';if(l.b.textContent!==text)l.b.textContent=text;l.b.classList.toggle('selected',id===focus);}}
  }
  function renderVisual(dt){
    const snap=director.snapshot(),op=snap.operation,frame=snap.frame,targetFocus=snap.focusNodeId;updateOcclusion(targetFocus);
    for(let i=0;i<groups.length;i++){
      const id=NODES[i],tier=!targetFocus||id===targetFocus?1:snap.relatedNodeIds.includes(id)?.6:.18,status=snap.nodeStates[id],target=tier*(occluding.has(i)&&id!==targetFocus?.35:1);weights[i]+=(target-weights[i])*(isReduced()?1:1-Math.exp(-dt*10));
      for(const rec of staticRecords[i]){const {o,material}=rec;if(o.userData.packet)continue;const opacity=rec.opacity*weights[i],transparent=rec.transparent||opacity<.995;material.opacity=opacity;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.depthWrite=transparent&&weights[i]<.99?false:rec.depthWrite;if(rec.color)material.color.copy(rec.color).lerp(fadedTint,(1-tier)*.5).multiplyScalar(.8+.2*tier);o.castShadow=rec.castShadow&&tier===1&&quality==='high';o.receiveShadow=rec.receiveShadow&&tier===1&&quality==='high';if(o.userData.inner||o.userData.label)o.visible=rec.visible&&tier>.5;if(material.emissive){material.emissive.set(o.userData.inactive?0x000000:status==='Running'&&op?0x327d9b:0x000000);material.emissiveIntensity=status==='Running'&&tier>.5?.05+.025*(isReduced()?0:Math.sin(time*2)):.005;}}
      halos[i].material.opacity=targetFocus===id?.85:tier>.5?.15:.025;lamps[i].material.color.set(status==='Error'?0xbe7e2c:status==='Completed'?0x4e9b77:status==='Running'?0x4aaac0:status==='Waiting'?0xc9974c:0x80918b);lamps[i].scale.setScalar(status==='Running'||status==='Waiting'?1+(isReduced()?0:Math.sin(time*1.6)*.07):1);
    }
    for(const rotor of rotors)if(op&&snap.activeNodeIds.includes(rotor.node)&&!isPaused()&&!isReduced())rotor.mesh.rotation.z+=dt*.45;
    const lit=frame?.lamps||{};toolEntryLamp.material.color.set(lit.toolEntry?0x3299bc:0x7c9299);toolExitLamp.material.color.set(lit.toolExit?0x4a9c76:0x7c9299);toolErrorLamp.material.color.set(lit.toolError?0xcf922f:0x7c9299);storageLamp.material.color.set(lit.history&&(['handoff','result'].includes(frame.phaseId)||frame.phaseId==='process'&&frame.phaseProgress>=.45)?0x42a0bb:0x7c9299);indexLamp.material.color.set(lit.history&&(frame.phaseId==='prepare'||frame.phaseId==='process'&&frame.phaseProgress<.45)?0x42a0bb:0x7c9299);archiveArrow.visible=!!lit.history&&(frame.phaseId==='handoff'||frame.phaseId==='process'&&frame.phaseProgress>=.45);preferenceLamp.material.color.set(lit.preference?0xae7ac5:0x81978c);skillLamp.material.color.set(lit.skill?0xae7ac5:0x81978c);preferenceDrawer.position.z=.75+(lit.preference&&frame.phaseId==='process'?Math.sin(clamp(frame.phaseProgress)*Math.PI)*.48:0);bookPivot.rotation.z=lit.skill?-.3:0;
    toolDrawers.forEach((drawer,i)=>drawer.position.z=.51+(op&&op.kind.startsWith('tool')&&frame.phaseId==='process'&&i===0?.5*Math.sin(frame.phaseProgress*Math.PI):0));
    for(const edge of edges){const active=snap.activeFlowIds.includes(edge.f.id),related=!!targetFocus&&(edge.f.from===targetFocus||edge.f.to===targetFocus)&&(snap.relatedNodeIds.includes(edge.f.from)||snap.relatedNodeIds.includes(edge.f.to));edge.line.material.opacity=active?.9:snap.showFullPath?.22:related?.2:0;if(edge.tube)edge.tube.material.opacity=active?.7:snap.showFullPath?.1:0;edge.arrow.visible=active||related||snap.showFullPath;for(const part of [edge.arrow.line,edge.arrow.cone]){part.material.transparent=true;part.material.opacity=active?1:.25;}edge.particle.visible=active;if(active){const ids=op?.cardIds||[],cardText=ids[0]||'资料';if(edge.cardText!==cardText){setText(edge.cardLabel,cardText);edge.cardText=cardText;}edge.particle.position.copy(edge.curve.getPoint(isReduced()?.5:clamp(frame?.phaseProgress??0)));}}
    renderPeople(snap,dt);renderContext(snap);renderLabels(snap);
    incomingCards.forEach(({mesh,label},i)=>{if(phase==='arrival'){const t=isReduced()?1:((time+i*1.1)%12)/2;mesh.position.y=1.75+Math.max(0,1-clamp(t))*1.7;mesh.position.z=.1+Math.max(0,1-clamp(t))*2.6;mesh.visible=true;setText(label,i<2?'S'+(i+1)+' 同源':'S3 待核');}else{mesh.visible=true;mesh.position.y=1.75;mesh.position.z=.1;}});
    const presented=snap.operation||snap.heldOperation,draftItems=presented?.kind==='delivery'?presented.event?.result?.draft:state?.findings,draftCount=Array.isArray(draftItems)?draftItems.length:0;
    drafts.forEach((mesh,i)=>{const preview=phase==='arrival';mesh.visible=preview||i<draftCount;if(preview){const t=isReduced()?1:clamp((time%12-6-i*.7)/2);mesh.scale.y=.5+t*.5;}else mesh.scale.y=1;});
    const comparing=presented?.kind==='analysis',compared=comparing&&presented.elapsed>=4.7,second=comparing&&presented.event?.sessionId==='session-2';analysisCards.forEach(({mesh,label},i)=>{mesh.visible=comparing;const t=comparing?clamp((presented.elapsed-2.4)/2.3):0;mesh.position.x=second?-1+i:i<2?-1+i*(1-t):1;mesh.position.z=.4+(i===1?t*.09:0);if(!second&&i===1&&compared)mesh.visible=false;setText(label,second?['旧记录','A3 最新',compared?'按新要求':'新要求'][i]:compared?(i===0?'S1 + S2':'已修正'):'S'+(i+1));});
    setText(instructionLabel,presented?.kind==='toolRequest'?'读取原文':presented?.kind==='analysis'?'按反馈调整':presented?.kind==='delivery'?'交草稿':'下一步');
    host.dataset.focus=snap.focusNodeId||'none';host.dataset.camera=snap.cameraMode;host.dataset.stage=fly?'flying':'ready';host.dataset.operation=op?.kind||'none';host.dataset.active=snap.activeNodeIds.join(',');host.dataset.presentation=snap.presentation.mode;host.dataset.phase=frame?.phaseId||'none';return snap;
  }
  let renderTarget=null;
  function capture(){
    const snap=director.snapshot();if(contextLost)throw Error('三维场景正在恢复，暂时不能拍照');if(!snap.focusNodeId)throw Error('先选择需要拍摄的设备');if(fly)throw Error('观察位还未稳定，请稍后再拍');
    const i=NODES.indexOf(snap.focusNodeId),cam=camera.clone();cam.clearViewOffset();cam.aspect=16/9;const target=controls.target.clone(),direction=camera.position.clone().sub(target).normalize(),distance=Math.max(camera.position.distanceTo(target),fitDistance(i,16/9,true));cam.position.copy(target).addScaledVector(direction,distance);cam.lookAt(target);cam.updateProjectionMatrix();
    renderTarget??=new THREE.WebGLRenderTarget(1920,1080);renderTarget.texture.colorSpace=THREE.SRGBColorSpace;const old=renderer.getRenderTarget();
    try{renderer.setRenderTarget(renderTarget);renderer.render(scene,cam);const bytes=new Uint8Array(1920*1080*4);renderer.readRenderTargetPixels(renderTarget,0,0,1920,1080,bytes);const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const ctx=canvas.getContext('2d'),data=ctx.createImageData(1920,1080);for(let y=0;y<1080;y++)data.data.set(bytes.subarray((1079-y)*1920*4,(1080-y)*1920*4),y*1920*4);ctx.putImageData(data,0,0);ctx.fillStyle=dark?'#1b303eee':'#fcfdf7ee';ctx.fillRect(25,25,1150,100);ctx.fillStyle=dark?'#edf4f6':'#213b4c';ctx.font='600 30px Microsoft YaHei';ctx.fillText(SHORT_NAMES[i]+' · '+(['result','hold'].includes(snap.frame?.phaseId)?'结果已保留':statusNames[snap.nodeStates[snap.focusNodeId]]),48,65);ctx.font='21px Microsoft YaHei';ctx.fillText((snap.frame?.cue||'静态观察').slice(0,58),48,103);ctx.fillStyle=dark?'#1b303eee':'#fcfdf7ee';ctx.fillRect(25,1005,1870,50);ctx.fillStyle=dark?'#edf4f6':'#213b4c';ctx.font='19px Microsoft YaHei';ctx.fillText((snap.presentation.mode==='teaching-replay'?'教学回放':'任务事件呈现')+'  |  真实三维观察画面  |  虚线是轨迹记录旁路',45,1038);lastCaptureMeta={width:1920,height:1080,clipId:snap.presentation.clipId,eventId:(snap.operation||snap.heldOperation)?.eventId||null,marker:snap.frame?.captureMarker||null,mode:snap.presentation.mode,replay:snap.presentation.replaying,viewport:{...viewport},capturedAt:new Date().toISOString()};return canvas.toDataURL('image/jpeg',.87);}finally{renderer.setRenderTarget(old);}
  }
  function setQuality(value='balanced'){quality=['low','balanced','high'].includes(value)?value:'balanced';renderer.setPixelRatio(Math.min(devicePixelRatio,{low:1,balanced:1.35,high:1.7}[quality]));renderer.shadowMap.enabled=quality==='high';resize();}
  function setPauseReason(reason,enabled){director.setPauseReason(reason,enabled);if(enabled&&reason==='user')navWhilePaused=false;}
  const frameTimes=[];let animationId=0,last=performance.now(),lastNotify='',lastRender=0;
  function status(){const snap=director.snapshot(),diagnostics={groups:staticRecords.map((records,i)=>{const opaque=records.filter(record=>record.opacity>.99),base=opaque.map(record=>record.opacity),current=opaque.map(record=>record.material.opacity);return {nodeId:NODES[i],tier:!snap.focusNodeId||snap.focusNodeId===NODES[i]?'focus':snap.relatedNodeIds.includes(NODES[i])?'related':'background',occluding:occluding.has(i),baseMin:Math.min(...base),baseMax:Math.max(...base),currentMin:Math.min(...current),currentMax:Math.max(...current)};}),glass:staticRecords[6].filter(record=>record.material.isMeshPhysicalMaterial).map(record=>({base:record.opacity,current:record.material.opacity,transparent:record.material.transparent,depthWrite:record.material.depthWrite})),camera:{position:camera.position.toArray(),target:controls.target.toArray(),aspect:camera.aspect},inspectionDepth:inspection.length};return {...snap,viewport:{...viewport},quality,contextLost,inspectionDepth:inspection.length,diagnostics,capture:lastCaptureMeta?{...lastCaptureMeta}:null,rendererInfo:{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length||0,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,materials:materials.size,labels:labels.length,callbacks:callbacks.size},performance:{samples:frameTimes.length,meanFrameMs:frameTimes.length?frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length:0}};}
  function animate(now){
    if(disposed)return;animationId=requestAnimationFrame(animate);const elapsed=now-last,dt=Math.min(.05,Math.max(0,elapsed/1000));last=now;if(document.hidden||contextLost)return;
    const frozen=isPaused(),navigationDt=frozen&&!navWhilePaused?0:dt;if(!frozen)time+=dt;
    if(fly){fly.t+=navigationDt;const linear=clamp((fly.t-fly.delay)/fly.duration),t=smooth(linear),mid=fly.from.clone().lerp(fly.to,t);mid.y+=Math.sin(t*Math.PI)*Math.max(0,fly.lift-Math.max(fly.from.y,fly.to.y));camera.position.copy(mid);controls.target.lerpVectors(fly.old,fly.target,t);if(linear===1){fly=null;navWhilePaused=false;director.setStageReady();}}
    if(!frozen||navWhilePaused)director.advance(dt,!frozen&&!fly&&!isReduced());if(free&&!frozen)for(const k of keySet)move(k,dt*3.5);
    const snap=renderVisual(navigationDt);controls.enableDamping=!isReduced()&&!frozen;controls.update();
    const moving=!!fly||!!mentorTrip||!!snap.operation&&!frozen||phase==='arrival'&&!frozen&&!isReduced(),signature=[snap.focusNodeId,snap.frame?.phaseId,snap.presentation.status,snap.cameraMode,viewport.width,viewport.height].join('/');
    if(moving||signature!==lastNotify||now-lastRender>250){renderer.render(scene,camera);lastRender=now;if(moving&&elapsed>0&&elapsed<1000){frameTimes.push(elapsed);if(frameTimes.length>180)frameTimes.shift();}}
    for(const id of director.finished()){const done=callbacks.get(id);callbacks.delete(id);done?.();}
    if(!fly&&phase==='tour'){
      const op=snap.operation||snap.heldOperation,marker=snap.frame?.captureMarker,key=op?[op.id,snap.presentation.cycle,marker].join('/'):'none';if(marker&&key!==momentKey){momentKey=key;readyMoment=current;onMoment({kind:op.kind,stage:snap.frame.phaseId,eventId:op.eventId||null,cardIds:[...(op.cardIds||[])],replay:snap.presentation.replaying,caption:snap.frame.cue,marker,clipId:snap.presentation.clipId});}
      else if(!op&&readyMoment!==current){readyMoment=current;onMoment({kind:'station',stage:snap.nodeStates[NODES[current]],eventId:snap.observation?.id||null,caption:'观察位已稳定'});}
    }
    if(signature!==lastNotify){lastNotify=signature;onSceneState({type:'state',focusNodeId:snap.focusNodeId,quality,contextLost});}
  }
  function visibilityChanged(){setPauseReason('hidden',document.hidden);last=performance.now();}
  document.addEventListener('visibilitychange',visibilityChanged);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;setPauseReason('contextLost',true);onSceneState({type:'contextlost',message:'三维场景暂时中断，可等待恢复或切换文字观察。'});});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{contextLost=false;setPauseReason('contextLost',false);last=performance.now();resize();onSceneState({type:'contextrestored',message:'三维场景已恢复。'});});
  function dispose(){disposed=true;cancelAnimationFrame(animationId);resizeObserver.disconnect();document.removeEventListener('visibilitychange',visibilityChanged);window.removeEventListener('keydown',onKeydown);window.removeEventListener('keyup',onKeyup);window.removeEventListener('blur',onBlur);controls.dispose();const allGeometries=new Set(),allMaterials=new Set(),allTextures=new Set();scene.traverse(o=>{if(o.geometry)allGeometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){allMaterials.add(material);if(material.map)allTextures.add(material.map);}});for(const resource of [...allTextures,...allMaterials,...allGeometries])resource.dispose();renderTarget?.dispose();renderer.dispose();renderer.domElement.remove();overlay.remove();callbacks.clear();}
  arrival();resize();animationId=requestAnimationFrame(animate);
  return {observeEvent,setObservation,skipMotion,focus,overview,arrival,setFree,move,inspect:()=>inspectPart('core'),inspectPart,restoreInspection,trace,fullPath:v=>director.fullPath(v),operate,fail:n=>director.error(n),clearError:n=>director.clearError(n),setReduced:v=>{reducedOverride=!!v;if(v&&fly){camera.position.copy(fly.to);controls.target.copy(fly.target);fly=null;director.setStageReady();}},setLab:v=>{labMode=v;resize();},setState,setPhase:v=>phase=v,setPaused:v=>{paused=!!v;setPauseReason('legacy',paused);},setPauseReason,setSpeed:v=>director.setSpeed(v),setRepeat:v=>director.setRepeat(v),replay:options=>director.replay(options),seek:v=>director.seek(v),nextBeat:()=>director.nextBeat(),stopPresentation:options=>director.stopPresentation(options),setStageReady:()=>director.setStageReady(),setQuality,ready:()=>!fly&&director.state.tourTime>=SETTLE_SECONDS,busy:()=>!!director.state.operation&&!director.state.operation.loopCycle||director.snapshot().queueLength>0,status,theme:v=>{dark=v;fadedTint.set(v?0x526570:0x9ba5a6);scene.background.set(v?0x1a2e3a:0xe6eeed);scene.fog.color.copy(scene.background);},capture,captureMeta:()=>lastCaptureMeta?{...lastCaptureMeta}:null,rendererInfo:()=>status().rendererInfo,dispose};
}
