import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewsVisit,createLessonController} from '../docs/public/factory/news-lesson.mjs';
import {createLessonStage} from '../docs/public/factory/lesson-stage.mjs';
function fixture(t){
 const original={document:globalThis.document,devicePixelRatio:globalThis.devicePixelRatio},words=[],strokes=[],dots=[],rects=[];
 const ctx=new Proxy({measureText:s=>({width:String(s).length*8}),fillText:s=>words.push(String(s)),stroke(){strokes.push(this.lineWidth);},arc:(x,y,r)=>dots.push([x,y,r]),roundRect:(...args)=>rects.push(args)},{get:(obj,k)=>k in obj?obj[k]:()=>{}});
 const canvas={clientWidth:900,clientHeight:460,dataset:{},setAttribute(){},getContext:()=>ctx};globalThis.document={createElement:()=>canvas};globalThis.devicePixelRatio=1;t.after(()=>Object.assign(globalThis,original));
 return {scene:createLessonStage({replaceChildren(){}}),canvas,words,strokes,dots,rects,clear(){words.length=0;strokes.length=0;dots.length=0;rects.length=0;}};
}
test('holding keeps a single highlighted focus and animated direction without mutating task state',t=>{
 const f=fixture(t),s=createNewsVisit('stage-hold'),c=createLessonController(s);c.next({submitted:true});c.skip();const before=structuredClone(s);f.scene.setReduced(false);f.scene.render(c.snapshot(),1);assert.ok(f.strokes.includes(3));assert.equal(f.canvas.dataset.focus,'context');assert.equal(f.canvas.dataset.flow,'intake>context');assert.ok(!f.words.includes('模型'));assert.ok(!f.words.includes('工具'));
 const ambient=f.canvas.dataset.ambient,dots=structuredClone(f.dots);f.clear();f.scene.render(c.snapshot(),1);assert.notEqual(f.canvas.dataset.ambient,ambient);assert.notDeepEqual(f.dots,dots);assert.deepEqual(s,before);
});
test('pausing or reducing motion freezes the direction clock while preserving outline and arrow',t=>{
 const f=fixture(t),s=createNewsVisit('stage-pause'),c=createLessonController(s);c.next({submitted:true});c.skip();f.scene.render(c.snapshot(),1);c.setPause('user',true);const ambient=f.canvas.dataset.ambient;f.clear();f.scene.render(c.snapshot(),8);assert.equal(f.canvas.dataset.ambient,ambient);assert.ok(f.strokes.includes(3));assert.equal(f.canvas.dataset.flow,'intake>context');
 c.setPause('user',false);f.scene.setReduced(true);f.clear();f.scene.render(c.snapshot(),8);assert.equal(f.canvas.dataset.ambient,ambient);assert.equal(f.dots.length,0);assert.ok(f.strokes.includes(3));
});
test('optional reuse renders the actual loaded method rather than the first task draft label',t=>{
 const f=fixture(t),s=createNewsVisit('stage-reuse'),c=createLessonController(s,{reduced:true});while(c.snapshot().index<11)c.next({submitted:true});c.open('reuse');c.next({skill:true});c.next();c.reviseMethod(['先核对新的原始公告']);c.next();f.scene.setReduced(true);f.scene.render(c.snapshot());assert.ok(f.words.includes('先核对新的原始公告'));assert.ok(!f.words.includes('有来源的两条待审新闻'));
});
test('pausing midway through window opening freezes its geometry as well as the dots',t=>{
 const f=fixture(t),s=createNewsVisit('opening-pause'),c=createLessonController(s);c.next({submitted:true});f.scene.render(c.snapshot(),.1);const before=structuredClone(f.rects);f.clear();c.setPause('panel',true);f.scene.render(c.snapshot(),1);assert.deepEqual(f.rects,before);f.clear();c.setPause('panel',false);f.scene.render(c.snapshot(),.7);assert.notDeepEqual(f.rects,before);
});
