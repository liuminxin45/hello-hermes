import {LABELS,STEPS} from './news-lesson.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
export function createLessonStage(host){
 const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','本步的部件与资料传递方向');host.replaceChildren(canvas);
 const c=canvas.getContext('2d');if(!c)throw Error('可视舞台不可用');
 let state=null,ambient=0,dark=false,reduced=false,lastFocus=null,focusElapsed=0,oldPositions={},positions={};
 const palette=()=>dark?{bg:'#142631',paper:'#203a48',ink:'#edf5f4',muted:'#b5c8d0',line:'#536c78',blue:'#8bbfff',green:'#81d3b3',amber:'#e7b669',chip:'#223542'}:{bg:'#f6f7f3',paper:'#fffefa',ink:'#1c3442',muted:'#536c79',line:'#bfcdd2',blue:'#2766a3',green:'#297b63',amber:'#976112',chip:'#edf1ef'};
 function text(str,x,y,width,size=16,color=palette().ink,maxLines=3){
  c.fillStyle=color;c.font=size+'px "Segoe UI","Microsoft YaHei",sans-serif';let line='',row=0;const lineHeight=size*1.55;
  for(const ch of String(str)){if(c.measureText(line+ch).width>width&&line){c.fillText(line,x,y+row*lineHeight);line='';row++;if(row>=maxLines)return;}line+=ch;}if(row<maxLines)c.fillText(line,x,y+row*lineHeight);
 }
 function box(b,fill,stroke,width=1,r=10){c.fillStyle=fill;c.strokeStyle=stroke;c.lineWidth=width;c.beginPath();c.roundRect(...b,r);c.fill();c.stroke();}
 function layout(mobile,ids,focus){
  const defaults={intake:[10,35,165,64],context:[12,175,170,64],analysis:[305,28,170,64],tools:[600,165,165,64],delivery:[585,355,180,64],archive:[295,355,170,64],memory:[15,350,185,64]};
  const result={};let n=0;for(const id of ids){result[id]=id===focus?(mobile?[35,167,290,133]:[250,145,290,180]):mobile?[10+n%3*116,24+Math.floor(n/3)*59,108,46]:defaults[id];if(id!==focus)n++;}return result;
 }
 function paint(){
  if(!state)return;const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const ratio=Math.min(globalThis.devicePixelRatio||1,2),mobile=w<620,W=mobile?360:780,H=state.context?460:mobile?330:460,scale=Math.min(w/W,h/H),p=palette();
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  c.setTransform(1,0,0,1,0,0);c.fillStyle=p.bg;c.fillRect(0,0,canvas.width,canvas.height);c.scale(ratio,ratio);c.translate((w-W*scale)/2,(h-H*scale)/2);c.scale(scale,scale);
  if(state.context){drawContext(W,mobile,p);return;}
  const targets=layout(mobile,state.visibleNodeIds,state.focusNodeId),move=reduced||state.phase==='holding'?1:clamp(focusElapsed/.8),ease=1-(1-move)**3;
  positions={};for(const [id,b]of Object.entries(targets)){const prev=oldPositions[id]||(id===state.focusNodeId?[b[0]+b[2]/2,b[1]+b[3]/2,0,0]:b);positions[id]=b.map((v,i)=>prev[i]+(v-prev[i])*ease);}
  const known=STEPS.slice(2,state.index+1).filter(x=>x.flow).map(x=>x.flow);
  for(const f of known)if(positions[f[0]]&&positions[f[1]]&&(!state.flow||f[0]!==state.flow[0]||f[1]!==state.flow[1]))line(f,false);
  if(state.flow&&positions[state.flow[0]]&&positions[state.flow[1]])line(state.flow,true);
  for(const [id,b]of Object.entries(positions)){
   const focus=id===state.focusNodeId;c.save();c.globalAlpha=focus?1:.72;
   if(focus){c.shadowColor=dark?'#76aeef45':'#2766a32b';c.shadowBlur=18;box([b[0]-4,b[1]-4,b[2]+8,b[3]+8],p.paper,p.blue,3);c.shadowBlur=0;}
   box(b,focus?p.paper:p.chip,focus?p.blue:p.line,focus?2:1);
   if(focus&&(b[2]<180||b[3]<95)){c.restore();continue;}
   text(focus?(state.windowTitle||LABELS[id]):LABELS[id]||id,b[0]+14,b[1]+(focus?31:mobile?20:25),b[2]-28,focus?19:mobile?13:15,focus?p.blue:p.ink,focus?2:mobile?2:1);
   if(focus){
    const status=state.branch?.kind==='failure'?'读取失败':state.phase==='playing'?'正在演示本步':id==='tools'?'结果已返回':id==='analysis'?'本步输出已保留':'本步结果已保留';
    text(status,b[0]+14,b[1]+62,b[2]-28,14,state.branch?.kind==='failure'?p.amber:p.green,1);
    const short=state.branch?state.lines[0]:state.index===3?'搜索新闻的行动请求':state.index===6?'读取原文的行动请求':state.index===9?'按原文合并、修正结论':state.index>=10?'有来源的两条待审新闻':state.index===5?'新增 S1 / S2 / S3':state.index===8?'新增 A1 / A2 / D1':state.compact[id];
    text(short||'',b[0]+14,b[1]+91,b[2]-28,15,p.ink,mobile?2:3);
   }else if(!mobile)text(state.compact[id]||'',b[0]+14,b[1]+47,b[2]-28,12,p.muted,1);
   c.restore();
  }
  canvas.dataset.focus=state.focusNodeId;canvas.dataset.flow=state.flow?state.flow.slice(0,2).join('>'):'';canvas.dataset.phase=state.phase;canvas.dataset.visible=state.visibleNodeIds.join(',');canvas.dataset.units='';canvas.dataset.ambient=String(Math.round(ambient*100));
  function line(f,active){
   const A=positions[f[0]],B=positions[f[1]],ax=A[0]+A[2]/2,ay=A[1]+A[3]/2,bx=B[0]+B[2]/2,by=B[1]+B[3]/2,dx=bx-ax,dy=by-ay,dist=Math.hypot(dx,dy)||1;
   const cutA=Math.min(A[2]/2/Math.max(.1,Math.abs(dx/dist)),A[3]/2/Math.max(.1,Math.abs(dy/dist))),cutB=Math.min(B[2]/2/Math.max(.1,Math.abs(dx/dist)),B[3]/2/Math.max(.1,Math.abs(dy/dist)));
   const x=ax+dx/dist*(cutA+5),y=ay+dy/dist*(cutA+5),xx=bx-dx/dist*(cutB+6),yy=by-dy/dist*(cutB+6);
   c.globalAlpha=active?1:.15;c.strokeStyle=active?p.blue:p.line;c.lineWidth=active?2.5:1;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();const angle=Math.atan2(yy-y,xx-x);c.fillStyle=active?p.blue:p.line;c.beginPath();c.moveTo(xx,yy);c.lineTo(xx-9*Math.cos(angle-.4),yy-9*Math.sin(angle-.4));c.lineTo(xx-9*Math.cos(angle+.4),yy-9*Math.sin(angle+.4));c.closePath();c.fill();c.globalAlpha=1;
   if(active){if(!reduced)for(let k=0;k<3;k++){const t=(ambient/9+k/3)%1;c.fillStyle=p.blue;c.beginPath();c.arc(x+(xx-x)*t,y+(yy-y)*t,3.5,0,Math.PI*2);c.fill();}if(!mobile)text(f[2],(x+xx)/2-60,(y+yy)/2-10,155,13,p.blue,2);}
  }
 }
 function drawContext(W,mobile,p){
  const v=state.context,x=mobile?14:230,y=83,cw=mobile?332:525,ch=mobile?240:250,cols=mobile?4:7,bw=(cw-20)/cols-7,bh=mobile?40:49;
  text('当前上下文 · '+v.units+' / 100 教学格',mobile?14:230,35,W-30,20,p.blue);
  text('本次演示阈值：70格',mobile?14:230,62,W-30,13,p.muted);
  box([x,y,cw,ch],p.paper,p.blue,3);
  for(const q of v.packets.filter(q=>q.counted||['summarizing','machine','returning'].includes(q.location))){
   const ox=x+10+q.slot%cols*(bw+7),oy=y+12+Math.floor(q.slot/cols)*(bh+8);let px=ox,py=oy;
   if(q.location==='summarizing'){px+=(x+cw/2-ox)*q.progress*.5;py+=(y+ch/2-oy)*q.progress*.4;}
   if(q.location==='returning'){px+=(x+cw/2-ox)*(1-q.progress);py+=30*(1-q.progress);}
   c.globalAlpha=q.location==='summarizing'?1-q.progress*.75:1;const color=q.kind==='tail'?p.green:['head','rules','summary'].includes(q.kind)?p.blue:p.amber;
   box([px,py,bw,bh],color,color,1,3);text(q.kind==='rules'?'规则':q.kind==='head'?'任务约束':q.kind==='tail'?'近期交接':q.kind==='summary'?'新摘要':'历史',px+5,py+25,bw-10,12,p.paper,1);c.globalAlpha=1;
  }
  if(v.time>=15&&v.time<23){c.globalAlpha=.22;c.fillStyle=p.blue;c.fillRect(x+cw*(v.time-15)/8,y,8,ch);c.globalAlpha=1;}
  c.fillStyle=p.line;c.fillRect(x,y+ch+15,cw,6);c.fillStyle=v.units>=70?p.amber:p.blue;c.fillRect(x,y+ch+15,cw*v.units/100,6);
  if(!mobile){box([14,150,175,130],p.chip,p.line);text('独立的原始档案',26,180,150,16);text(v.archiveIds.length+'片原始记录仍在',26,210,150,14);text('整理不删除原文',26,240,150,14);text(v.time>=20?v.summary.text:'保留任务与近期交接，按本次规则整理中段。',230,385,525,15,p.ink,3);}
  else{text(v.time>=23?'70 → 35：中段已改写为摘要':'任务约束、近期交接独立保护',14,370,332,15,p.ink,2);text('容器外原始档案：'+v.archiveIds.length+'片仍在',14,423,332,14,p.muted,1);}
  canvas.dataset.focus='context';canvas.dataset.phase=state.phase;canvas.dataset.units=String(v.units);canvas.dataset.flow='';canvas.dataset.visible='context,archive';canvas.dataset.ambient=String(Math.round(ambient*100));
 }
 return {render(s,dt=0){state=s;if(lastFocus!==s.focusNodeId){oldPositions={...positions};lastFocus=s.focusNodeId;focusElapsed=0;}if(!s.paused&&!reduced){ambient+=dt;focusElapsed+=dt;}canvas.setAttribute('aria-label',s.title+'。'+s.lines.join('。')+'。'+(s.flow?s.flow[2]+'，'+s.flowMeaning:''));paint();},theme(v){dark=v;paint();},setReduced(v){reduced=v;paint();},capture(){paint();const out=document.createElement('canvas');out.width=1920;out.height=1080;const ctx=out.getContext('2d'),r=Math.min(1920/canvas.width,1080/canvas.height);ctx.fillStyle=palette().bg;ctx.fillRect(0,0,1920,1080);ctx.drawImage(canvas,(1920-canvas.width*r)/2,(1080-canvas.height*r)/2,canvas.width*r,canvas.height*r);return {url:out.toDataURL('image/jpeg',.9),width:1920,height:1080,capture:'actual-canvas-letterboxed',sourceViewport:{width:canvas.width,height:canvas.height}};},canvas};
}
