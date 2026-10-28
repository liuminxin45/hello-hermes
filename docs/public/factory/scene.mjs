import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {STATIONS} from './content.mjs';
import {samplePath} from './motion.mjs';

export function createFactory(host,onSelect){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xe6eeed);scene.fog=new THREE.Fog(0xe6eeed,65,160);
  const camera=new THREE.PerspectiveCamera(43,1,.1,180);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','三维教学工厂，可拖动环顾、缩放或跟随导师参观。');
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=!reduced.matches;controls.dampingFactor=.07;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=3;controls.maxDistance=100;controls.screenSpacePanning=false;const initialMobile=host.clientWidth<760;camera.position.set(initialMobile?60:32,initialMobile?45:22,initialMobile?80:46);controls.target.set(initialMobile?0:3,1,9);
  const mat=(color,metal=.05,rough=.7)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough});
  const m={white:mat(0xf8faf3),floor:mat(0xcbd6d0),steel:mat(0x77919a,.3,.5),ink:mat(0x233d4a),blue:mat(0x336eb7),mint:mat(0x8cb9a8),orange:mat(0xe6a34d),paper:mat(0xf3e9d3),green:mat(0x51886d),glass:new THREE.MeshPhysicalMaterial({color:0xb8dfdf,transparent:true,opacity:.17,roughness:.18,depthWrite:false})};
  const addMesh=(parent,geo,material,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(p,w,h,d,x,y,z,material=m.white)=>addMesh(p,new THREE.BoxGeometry(w,h,d),material,x,y,z);
  const cyl=(p,r,h,x,y,z,material=m.white)=>addMesh(p,new THREE.CylinderGeometry(r,r,h,20),material,x,y,z);
  function link(p,a,b,r,material=m.steel){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),o=addMesh(p,new THREE.CylinderGeometry(r,r,delta.length(),8),material,...av.clone().add(bv).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
  function textTexture(text,color='#253f50',background='#f5f8ef',w=1024,h=256){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.fillStyle=background;c.fillRect(0,0,w,h);c.fillStyle=color;c.font=`600 ${Math.min(78,w/(text.length+1))}px "Microsoft YaHei",sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2,w*.92);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
  function welcomeTexture(gift){const c=document.createElement('canvas');c.width=640;c.height=400;const ctx=c.getContext('2d');ctx.fillStyle='#fffcf0';ctx.fillRect(0,0,640,400);ctx.fillStyle='#294856';ctx.font='600 43px "Microsoft YaHei",sans-serif';ctx.fillText(gift.name,38,77,565);ctx.font='25px "Microsoft YaHei",sans-serif';const chars=[...gift.card.text];for(let i=0;i<chars.length;i+=21)ctx.fillText(chars.slice(i,i+21).join(''),38,135+Math.floor(i/21)*40,565);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
  function sign(p,text,w,h,x,y,z,color,bg){const tex=textTexture(text,color,bg);return addMesh(p,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}),x,y,z);}
  function monitor(p,x,y,z,w=1.15){box(p,w,.75,.12,x,y,z,m.ink);for(let i=0;i<3;i++)box(p,w*.68,.045,.02,x-.04,y+.2-i*.18,z+.08,i===0?m.orange:m.mint);}
  scene.add(new THREE.HemisphereLight(0xffffff,0x7b9291,2.8));
  const sun=new THREE.DirectionalLight(0xfff5df,3.2);sun.position.set(-15,30,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:32,bottom:-30,near:1,far:90});sun.shadow.bias=-.0002;sun.shadow.normalBias=.03;scene.add(sun);
  const ground=box(scene,180,.2,180,0,-.8,0,m.floor);ground.castShadow=false;
  box(scene,37,.5,35,0,-.38,3,m.white);box(scene,36.8,.04,34.8,0,-.1,3,mat(0xe8ede4));
  const gridPoints=[];for(let x=-18;x<=18;x+=2)gridPoints.push(x,-.07,-14,x,-.07,20);for(let z=-14;z<=20;z+=2)gridPoints.push(-18,-.07,z,18,-.07,z);const gridGeo=new THREE.BufferGeometry();gridGeo.setAttribute('position',new THREE.Float32BufferAttribute(gridPoints,3));scene.add(new THREE.LineSegments(gridGeo,new THREE.LineBasicMaterial({color:0xd4ddd6})));
  // Open structure: the learner can see inside before stepping through the gate.
  box(scene,37,1.1,.25,0,.4,-14,m.white);box(scene,.25,1.1,35,-18.5,.4,3,m.white);box(scene,.25,1.1,35,18.5,.4,3,m.white);
  for(const x of [-17,17])for(const z of [-12,4,19]){box(scene,.25,6,.25,x,2.8,z,m.steel);box(scene,.75,.15,.75,x,5.9,z,m.orange);}
  for(const z of [-12,4])box(scene,34,.2,.25,0,5.7,z,m.steel);
  // Front gate and a small reception building, framing the arrival view.
  for(const x of [-5.8,5.8])box(scene,.45,6.5,.55,x,3,20,m.ink);
  box(scene,12.2,1.7,.8,0,6.25,20,m.blue);sign(scene,'HERMES  /  AGENT FACTORY',11.6,1.25,0,6.25,20.43,'#ffffff','#326db3');
  box(scene,6,2.9,4,-11,1.2,21,m.white);box(scene,6.4,.18,4.3,-11,2.8,21,m.ink);sign(scene,'订单接待处',3,.7,-11,2.1,23.02);box(scene,3,.75,.1,-11,1.1,23.1,m.blue);
  for(const x of [-15,-11,-7,7,11,15]){box(scene,2.7,.05,3.3,x,-.63,28,m.white);}
  box(scene,9,.04,16,0,-.65,28,mat(0xc0d1cd));
  for(let z=22;z<35;z+=2)box(scene,.12,.02,.8,0,-.61,z,m.white);
  function tree(x,z){cyl(scene,.13,1.6,x,.1,z,m.ink);addMesh(scene,new THREE.SphereGeometry(.9,10,8),m.green,x,1.6,z);}
  for(const [x,z] of [[-23,15],[-24,25],[23,17],[24,28],[-20,-15],[21,-12]])tree(x,z);
  // Low carts waiting outside are ambient scenery, not evidence of a completed task.
  for(const x of [11,14]){box(scene,2,.7,3,x,-.15,29,m.ink);box(scene,2,1.5,1.8,x,.8,28.6,m.white);box(scene,1.8,.55,.06,x,1,29.55,m.blue);for(const dx of [-.9,.9])for(const dz of [-1,1]){const wheel=cyl(scene,.32,.22,x+dx,-.38,29+dz,m.ink);wheel.rotation.z=Math.PI/2;}}
  const stationGroups=[],labels=[],rotors=[];
  const overlay=document.createElement('div');overlay.className='world-labels';overlay.setAttribute('aria-hidden','true');host.append(overlay);
  function platform(i){const s=STATIONS[i],g=new THREE.Group();g.position.set(...s.position);scene.add(g);g.userData.station=i;box(g,5.1,.28,4.5,0,.12,0,m.white);box(g,4.7,.06,4.1,0,.3,0,i===2?m.floor:m.paper);box(g,4.6,.07,.14,0,.34,1.9,m.blue);stationGroups.push(g);return g;}
  for(let i=0;i<8;i++){
    const g=platform(i);
    if(i===0){
      cyl(g,1.4,.6,0,.7,0,m.ink);cyl(g,1.25,.12,0,1.05,0,m.blue);cyl(g,.85,1.5,0,1.85,0,m.white);cyl(g,.95,.15,0,2.65,0,m.blue);monitor(g,0,1.8,.86);
      const rotor=addMesh(g,new THREE.TorusGeometry(1.08,.06,8,48),m.blue,0,2,0);rotor.rotation.x=Math.PI/2;rotors.push({mesh:rotor,station:i});
      for(const x of [-1.8,1.8]){box(g,.65,.9,.75,x,.8,.8,m.ink);cyl(g,.1,.12,x,1.3,.8,m.orange);}
    }else if(i===1){
      for(const x of [-1.5,0,1.5]){box(g,1.3,3.1,.12,x,1.9,-1.03,m.ink);for(const side of [-.61,.61])box(g,.08,3.1,.08,x+side,1.9,.35,m.ink);for(let level=0;level<3;level++){box(g,1.16,.08,1.3,x,.8+level*.9,-.3,m.white);for(const dx of [-.28,.28])box(g,.48,.5,.7,x+dx,1.1+level*.9,-.3,level===0?m.blue:level===1?m.paper:m.mint);}}
      box(g,2.6,.75,1,0,.75,1.3,m.steel);sign(g,'库存 / 数量 / 费用',2.4,.5,0,1.5,1.3);
    }else if(i===2){
      // Upstairs office: the transparent object contains information, never raw goods.
      box(g,5.5,.3,5,0,-.12,0,m.steel);for(const x of [-2.4,2.4])for(const z of [-2,2])box(g,.13,3,.13,x,-1.5,z,m.steel);
      box(g,3.7,.75,2.5,0,.8,0,m.white);box(g,3.8,.1,2.6,0,1.22,0,m.ink);box(g,3.7,2.6,2.55,0,2.6,0,m.glass);
      for(const x of [-1.8,1.8])for(const z of [-1.2,1.2])box(g,.05,2.7,.05,x,2.55,z,m.steel);
      box(g,3.9,.15,2.7,0,3.95,0,m.blue);sign(g,'本轮工作资料',3,.6,0,3.3,1.29);
      // Stairs connect the raised office to the factory floor.
      for(let step=0;step<10;step++)box(scene,2,.3*(step+1),.48,-12,.15*(step+1),4.7-step*.48,m.white);
      link(scene,[-13,.9,5.2],[-13,3.9,.3],.05);link(scene,[-11,.9,5.2],[-11,3.9,.3],.05);
    }else if(i===3||i===4){
      for(const x of [-1.25,1.25]){box(g,1.9,3,1.25,x,1.8,-.4,m.ink);for(let k=0;k<4;k++){box(g,1.7,.58,1.1,x,.7+k*.68,-.3,i===3?m.white:m.paper);if(i===3)box(g,.65,.07,.04,x,.7+k*.68,.28,m.blue);else for(let n=0;n<5;n++)box(g,.2,.4,.1,x-.6+n*.3,.7+k*.68,.29,n%2?m.blue:m.mint);}}
      sign(g,i===3?'原始记录 · 随时查阅':'做法与偏好 · 按需取用',4,.55,0,3.7,.1);
    }else if(i===5){
      box(g,3.7,.9,2.1,0,.8,0,m.ink);box(g,4,.15,2.4,0,1.33,0,m.steel);box(g,1.2,.65,1.2,-1.2,1.7,-.15,m.white);monitor(g,-1.2,2.25,.5,.8);sign(g,'欢迎卡打印',1.6,.42,-1.2,2.8,0);
      const arm=new THREE.Group();arm.position.set(1,1.4,-.2);g.add(arm);cyl(arm,.26,.3,0,.1,0,m.blue);link(arm,[0,.2,0],[0,1.35,0],.13,m.blue);link(arm,[0,1.35,0],[-.8,1.6,.3],.1,m.blue);link(arm,[-.8,1.6,.3],[-.8,1,.3],.06,m.ink);rotors.push({mesh:arm,station:i});
    }else if(i===6){
      box(g,3.8,.9,2,0,.8,0,m.white);box(g,4,.1,2.2,0,1.3,0,m.ink);
      for(const x of [-1.8,1.8])box(g,.12,1.8,.14,x,2.15,-.55,m.steel);box(g,3.8,.22,.7,0,3.05,-.55,m.blue);monitor(g,1.3,1.95,.85,.8);
      box(g,3.4,.025,.06,0,2,-.55,m.mint);
    }else{
      box(g,4.6,.75,2.9,0,.75,0,m.white);box(g,4.8,.1,3.1,0,1.18,0,m.mint);for(const x of [-2.7,2.7])cyl(g,.07,1.3,x,.85,1.8,m.steel);link(g,[-2.7,1.5,1.8],[2.7,1.5,1.8],.04,m.blue);sign(g,'验收区 · 不自动发货',4,.55,0,2.1,-1.45);
    }
    g.traverse(o=>{if(o.isMesh)o.userData.station=i;});
    const label=document.createElement('button');label.type='button';label.tabIndex=-1;label.className='world-label';label.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${STATIONS[i].name}`;label.onclick=()=>onSelect(i);overlay.append(label);labels.push({el:label,p:new THREE.Vector3(...STATIONS[i].position).add(new THREE.Vector3(0,i===2?4.7:4.1,0)),i});
  }
  const contextBlocks=new THREE.Group();stationGroups[2].add(contextBlocks);let blockTarget=18,displayUnits=18;
  function buildContext(units){while(contextBlocks.children.length){const obj=contextBlocks.children[0];contextBlocks.remove(obj);obj.geometry.dispose();}const count=Math.ceil(units/5);for(let j=0;j<count;j++){const level=Math.floor(j/3),column=j%3;box(contextBlocks,.85,.16,1.6,-1.1+column*1.1,1.5+level*.29,0,j<2?m.blue:j>=count-3?m.mint:m.paper);}}
  buildContext(displayUnits);
  const conveyors=[];
  function belt(a,b){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from),length=delta.length(),mid=from.clone().add(to).multiplyScalar(.5),angle=Math.atan2(delta.x,delta.z);const body=box(scene,.95,.17,length,mid.x,.65,mid.z,m.ink);body.rotation.y=angle;for(const side of [-1,1]){const rail=box(scene,.06,.13,length,mid.x+Math.cos(angle)*side*.5,.86,mid.z-Math.sin(angle)*side*.5,m.steel);rail.rotation.y=angle;}for(let d=.25;d<length;d+=.65){const p=from.clone().lerp(to,d/length);const roller=cyl(scene,.09,.9,p.x,.79,p.z,m.paper);roller.rotation.z=Math.PI/2;roller.rotation.y=angle;}conveyors.push(new THREE.LineCurve3(new THREE.Vector3(from.x,1.1,from.z),new THREE.Vector3(to.x,1.1,to.z)));}
  belt([7,0,-4.7],[8,0,-1.3]);belt([8,0,3.3],[8,0,6.7]);belt([5.5,0,10],[1.8,0,13.8]);
  // Information lines remain visually different from physical conveyor beds.
  const routes=[];for(const [a,b] of [[0,1],[1,0],[0,2],[0,3],[0,4],[0,5],[5,6],[6,7]]){const from=new THREE.Vector3(...STATIONS[a].position).add(new THREE.Vector3(0,.32,0)),to=new THREE.Vector3(...STATIONS[b].position).add(new THREE.Vector3(0,.32,0));const geo=new THREE.BufferGeometry().setFromPoints([from,to]);const line=new THREE.Line(geo,new THREE.LineDashedMaterial({color:0x4282c1,dashSize:.35,gapSize:.3,transparent:true,opacity:.5}));line.computeLineDistances();scene.add(line);routes.push(new THREE.LineCurve3(from.clone().setY(from.y+.3),to.clone().setY(to.y+.3)));}
  const parcels=conveyors.map((curve,i)=>{const g=new THREE.Group();box(g,.7,.55,.7,0,0,0,m.paper);box(g,.72,.06,.72,0,.22,0,m.blue);scene.add(g);g.visible=false;return {g,curve,phase:i/3};});
  function person(color,helmetColor){const g=new THREE.Group(),legs=[],arms=[];for(const x of [-.13,.13]){const leg=new THREE.Group();leg.position.set(x,.5,0);box(leg,.18,.5,.2,0,-.25,0,m.ink);box(leg,.2,.12,.32,0,-.49,.07,m.ink);g.add(leg);legs.push(leg);}box(g,.5,.65,.33,0,.81,0,color);box(g,.07,.5,.35,0,.85,0,m.white);addMesh(g,new THREE.SphereGeometry(.22,16,12),m.paper,0,1.38,0);addMesh(g,new THREE.SphereGeometry(.245,16,8,0,Math.PI*2,0,Math.PI/2),helmetColor,0,1.48,0);cyl(g,.28,.05,0,1.47,0,helmetColor);for(const x of [-.35,.35]){const arm=new THREE.Group();arm.position.set(x,1.07,0);box(arm,.16,.5,.18,0,-.2,0,color);g.add(arm);arms.push(arm);}g.userData={legs,arms};scene.add(g);return g;}
  const mentor=person(m.orange,m.white);mentor.position.set(-3,0,24);const workers=[person(m.blue,m.blue),person(m.blue,m.blue),person(m.blue,m.blue)];
  const workerPaths=[[[5,0,-6],[7,0,-2],[10,0,0]],[[10,0,2],[11,0,5],[10,0,8]],[[6,0,10],[3,0,13],[-2,0,15]]];
  workers.forEach((g,i)=>g.position.set(...workerPaths[i][0]));
  const signal=new THREE.Group();box(signal,.45,.06,.55,0,0,0,m.blue);box(signal,.27,.02,.1,0,.045,0,m.white);scene.add(signal);signal.visible=false;
  const giftGroup=new THREE.Group();scene.add(giftGroup);let giftSignature='',giftViews=[],lidOpen=false,visitId=null,workStarts={};
  function clearGifts(){giftGroup.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.userData.ownMaterial){o.material.map?.dispose();o.material.dispose();}}});giftGroup.clear();giftViews=[];}
  function rebuildGifts(s){
    const signature=JSON.stringify([s?.gifts,s?.station]);if(signature===giftSignature)return;giftSignature=signature;clearGifts();if(!s?.gifts?.length)return;
    const base=s.station>=7?STATIONS[7].position:STATIONS[5].position;
    s.gifts.forEach((gift,i)=>{const g=new THREE.Group();g.position.set(base[0]+(i%3-1)*1.28,1.45,base[2]+(Math.floor(i/3)-.35)*1.2);giftGroup.add(g);const theme=gift.color==='green'?m.green:m.blue;
      box(g,1.04,.48,.9,0,.05,0,m.paper);box(g,1.09,.05,.96,0,-.18,0,m.white);const lid=new THREE.Group();lid.position.set(0,.32,-.45);g.add(lid);box(lid,1.1,.12,.98,0,0,.45,gift.items.includes('whiteBox')?m.white:theme);box(lid,.2,.13,1,0,0,.45,theme);
      box(g,.44,.05,.6,-.2,.26,0,theme);box(g,.055,.045,.65,.25,.27,0,m.ink);
      if(gift.items.includes('snack'))box(g,.25,.12,.28,.2,.24,.25,m.orange);
      if(gift.card){const tex=welcomeTexture(gift);const material=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});const card=addMesh(g,new THREE.PlaneGeometry(.78,.4),material,0,.36,.22);card.rotation.x=-Math.PI/2;card.userData.ownMaterial=true;}
      g.traverse(o=>{if(o.isMesh)o.userData.gift=true;});giftViews.push({g,lid});
    });
  }
  let state=null,phase='arrival',paused=false,simulationTime=0,fly=null,mentorFly=null,current=-1,free=false,labMode=false;
  const keySet=new Set();
  function resize(){const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.clearViewOffset();if(phase==='arrival'){if(w>=760)camera.setViewOffset(w,h,-w*.12,0,w,h);else camera.setViewOffset(w,h,0,-h*.24,w,h);}if(labMode&&w<760)camera.setViewOffset(w,h,0,h*.22,w,h);camera.updateProjectionMatrix();renderer.setSize(w,h);}
  new ResizeObserver(resize).observe(host);resize();
  function flight(position,target){controls.maxDistance=100;if(reduced.matches){camera.position.copy(position);controls.target.copy(target);fly=null;controls.update();}else fly={a:camera.position.clone(),b:position,ta:controls.target.clone(),tb:target,t:0};}
  function arrival(){const leaving=current>=0;phase='arrival';current=-1;free=false;labMode=false;resize();if(leaving)mentorFly={a:mentor.position.clone(),b:new THREE.Vector3(-3,0,24),t:0};const mobile=host.clientWidth<760;flight(new THREE.Vector3(mobile?60:32,mobile?45:22,mobile?80:46),new THREE.Vector3(mobile?0:3,1,9));}
  function overview(){free=false;const mobile=host.clientWidth<760;flight(new THREE.Vector3(mobile?49:30,mobile?49:30,mobile?57:43),new THREE.Vector3(0,1.5,3));}
  function focus(i){phase='tour';current=i;free=false;resize();const s=STATIONS[i],p=new THREE.Vector3(...s.position),mobile=host.clientWidth<760;const offset=new THREE.Vector3(s.camera[0]-s.position[0],s.camera[1]-s.position[1],s.camera[2]-s.position[2]);if(mobile)offset.multiplyScalar(1.3);flight(p.clone().add(offset),p.clone().add(new THREE.Vector3(0,1.6,0)));const to=p.clone().add(new THREE.Vector3(-3.1,0,2));mentorFly={a:mentor.position.clone(),b:to,t:0};}
  function setFree(value){free=value;controls.minDistance=value?.3:3;if(value){fly=null;const to=camera.position.clone();to.y=2.2;const forward=controls.target.clone().sub(camera.position).setY(0).normalize();camera.position.copy(to);controls.target.copy(to.clone().addScaledVector(forward,1.3));controls.maxPolarAngle=Math.PI*.64;}else{controls.maxPolarAngle=Math.PI*.48;if(current>=0)focus(current);else overview();}}
  controls.addEventListener('start',()=>{fly=null;});
  let pointerStart;renderer.domElement.addEventListener('pointerdown',e=>pointerStart=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5)return;const r=host.getBoundingClientRect(),p=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(p,camera);const hits=ray.intersectObjects([...stationGroups,giftGroup],true);if(hits[0]){const hit=hits[0].object;if(hit.userData.gift)lidOpen=!lidOpen;else if(Number.isInteger(hit.userData.station))onSelect(hit.userData.station);}});
  const keydown=e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(free&&['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){keySet.add(e.code);e.preventDefault();}};window.addEventListener('keydown',keydown);window.addEventListener('keyup',e=>keySet.delete(e.code));window.addEventListener('blur',()=>keySet.clear());
  function move(code,distance=.9){if(!free)return;const f=controls.target.clone().sub(camera.position).setY(0).normalize(),r=new THREE.Vector3().crossVectors(f,new THREE.Vector3(0,1,0)),d=(code==='KeyW'?f:code==='KeyS'?f.negate():code==='KeyD'?r:r.negate()).multiplyScalar(distance);if(Math.abs(camera.position.x+d.x)<25&&camera.position.z+d.z>-17&&camera.position.z+d.z<36){camera.position.add(d);controls.target.add(d);}}
  let last=performance.now();function animate(now){requestAnimationFrame(animate);const dt=Math.min(.06,(now-last)/1000);last=now;if(document.hidden)return;const workDt=paused||reduced.matches?0:dt;simulationTime+=workDt;
    if(fly){fly.t+=dt;const t=Math.min(1,fly.t/2.1),e=t*t*(3-2*t);camera.position.lerpVectors(fly.a,fly.b,e);controls.target.lerpVectors(fly.ta,fly.tb,e);if(t===1)fly=null;}
    if(mentorFly){mentorFly.t+=reduced.matches?dt*10:dt;const t=Math.min(1,mentorFly.t/2.5);mentor.position.lerpVectors(mentorFly.a,mentorFly.b,t);const d=mentorFly.b.clone().sub(mentorFly.a);mentor.rotation.y=Math.atan2(d.x,d.z);mentor.userData.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(mentorFly.t*10+i*Math.PI)*.32*(1-t));if(t===1){mentorFly=null;mentor.rotation.y=.6;mentor.userData.arms[1].rotation.z=-.45;}}
    if(free)for(const code of keySet)move(code,dt*3.8);
    controls.update();
    for(const r of rotors)if(current===r.station)r.mesh.rotation.y+=workDt*.5;
    workers.forEach((g,i)=>{const stage=[1,5,6][i],active=state&&phase==='tour'&&state.entered.includes(stage);if(active){const t=(simulationTime-(workStarts[stage]??simulationTime))/18,p=samplePath(workerPaths[i],t);g.position.set(...p.position);g.rotation.y=Math.atan2(p.direction[0],p.direction[2]);g.userData.legs.forEach((leg,k)=>leg.rotation.x=Math.sin(simulationTime*8+k*Math.PI)*.3*(t<1?1:0));} });
    parcels.forEach((p,i)=>{p.g.visible=!!state?.reserved&&phase==='tour'&&current>=5&&current<7;if(p.g.visible)p.g.position.copy(p.curve.getPoint(Math.min(1,Math.max(0,(simulationTime-(workStarts[5]??simulationTime))/20-p.phase))));});
    signal.visible=phase==='tour'&&current>=0;if(signal.visible)signal.position.copy(routes[Math.min(current,routes.length-1)].getPoint((simulationTime*.12)%1));
    const units=state?.context&&state.context.viewing?(state.context.view==='before'?75:state.context.status==='compressed'?45:75):18;if(units!==blockTarget)blockTarget=units;if(displayUnits!==blockTarget){const direction=Math.sign(blockTarget-displayUnits);displayUnits+=direction;if(displayUnits%5===0||displayUnits===blockTarget)buildContext(displayUnits);}
    for(const gift of giftViews){const target=lidOpen?-.95:0;gift.lid.rotation.x+= (target-gift.lid.rotation.x)*(reduced.matches?1:.12);}
    for(const l of labels){const p=l.p.clone().project(camera);l.el.style.left=`${(p.x*.5+.5)*host.clientWidth}px`;l.el.style.top=`${(-p.y*.5+.5)*host.clientHeight}px`;l.el.hidden=phase==='arrival'||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;l.el.classList.toggle('selected',l.i===current);}
    renderer.render(scene,camera);
  }arrival();requestAnimationFrame(animate);
  return {focus,overview,arrival,setFree,move,setLab:value=>{labMode=value;resize();},ready:()=>!fly,setPaused:value=>paused=value,setPhase:value=>phase=value,setState:s=>{if(s&&s.id!==visitId){visitId=s.id;workStarts={};}state=s;if(s)for(const stage of [1,5,6])if(s.entered.includes(stage)&&workStarts[stage]===undefined)workStarts[stage]=simulationTime;rebuildGifts(s);},openGifts:()=>{lidOpen=!lidOpen;},theme:dark=>{scene.background.set(dark?0x1a2e3a:0xe6eeed);scene.fog.color.copy(scene.background);},capture:()=>{renderer.render(scene,camera);const source=renderer.domElement,c=document.createElement('canvas'),scale=Math.min(1,960/Math.max(source.width,source.height));c.width=Math.round(source.width*scale);c.height=Math.round(source.height*scale);c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.84);}};
}
