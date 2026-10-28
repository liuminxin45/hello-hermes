import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stations,createEvents,resultFor,visibleHistory} from './model.mjs';
test('each transfer connects real exhibit responsibilities; tool requests return to runtime before execution',()=>{
  const ids=new Set(stations.map(s=>s.id)),events=createEvents();
  for(const e of events){assert.ok(ids.has(e.from));assert.ok(ids.has(e.to));}
  const request=events.findIndex(e=>e.kind==='调用请求');assert.equal(events[request].to,'runtime');assert.equal(events[request+1].from,'runtime');assert.equal(events[request+1].to,'tools');
  assert.equal(events.at(-1).to,'output');
});
test('normal result respects the original fictional material: two events, conflict, no sending',async()=>{
  const materials=JSON.parse(await readFile(new URL('../../examples/news-brief/materials.json',import.meta.url)));
  const unique=new Set(materials.items.map(m=>m.event));assert.equal(resultFor('normal').uniqueEvents,unique.size);assert.equal(unique.size,2);assert.equal(resultFor('normal').sent,false);assert.match(resultFor('normal').lines.join(''),/冲突/);
});
test('injected read failure propagates to next model request and leaves task incomplete',()=>{
  const fail=createEvents('failure');assert.equal(fail[6].kind,'工具失败');assert.match(fail[8].body,/失败/);assert.equal(fail.at(-1).kind,'任务未完成');assert.equal(resultFor('failure').completed,false);assert.equal(resultFor('failure').sent,false);assert.equal(resultFor('failure').uniqueEvents,0);
});
test('reset and seeking expose only records up to the selected event, including backward seeking',()=>{const e=createEvents();assert.equal(visibleHistory(e,-1).length,0);assert.equal(visibleHistory(e,100).length,e.length);assert.equal(visibleHistory(e,3).length,4);assert.equal(visibleHistory(e,0).length,1);});
