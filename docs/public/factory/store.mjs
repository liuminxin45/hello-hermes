import {restoreVisit,SCENARIO_VERSION} from './engine.mjs';
import {restoreNewsVisit,NEWS_ACTIVE} from './news-lesson.mjs';
let dbPromise,queue=Promise.resolve();
export const ACTIVE_KEY='factory-v3-active',LIBRARY_KEY='factory-v3-library';
const ARCHIVE_PREFIX='factory-readonly-archive:';
function open(){return dbPromise??=new Promise((resolve,reject)=>{if(!globalThis.indexedDB)return reject(Error('本机存档不可用，请导出报告保存。'));const req=indexedDB.open('hello-hermes-internship',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('records'))req.result.createObjectStore('records');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function read(key){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('records','readonly'),req=tx.objectStore('records').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export function compatibleVisit(value){
 try{const valid=restoreVisit(value);return valid&&valid.scenarioVersion===SCENARIO_VERSION&&typeof valid.id==='string'&&valid.id.trim()&&typeof valid.startedAt==='string'&&Number.isFinite(Date.parse(valid.startedAt))&&typeof valid.profile?.nickname==='string'&&validLibrary(valid.task.library)?valid:null;}catch{return null;}
}
const text=value=>typeof value==='string'&&!!value.trim();
const strings=value=>Array.isArray(value)&&value.every(text);
export function validLibrary(value){
 return value?.schemaVersion===3&&Array.isArray(value.preferences)&&value.preferences.every(x=>x&&text(x.id)&&text(x.kind)&&text(x.value))&&
  Array.isArray(value.skills)&&value.skills.every(x=>x&&text(x.id)&&text(x.name)&&strings(x.steps)&&x.steps.length>0)&&
  Array.isArray(value.history)&&value.history.every(x=>x&&text(x.id)&&text(x.sessionId)&&text(x.request)&&Array.isArray(x.draft)&&x.draft.length>0&&x.draft.every(d=>d&&text(d.title)&&text(d.claim)&&strings(d.sources))&&strings(x.eventIds)&&strings(x.evidenceIds));
}
const archived=value=>['readonly-visit','readonly-library'].includes(value?.archiveKind)&&Object.hasOwn(value,'record');
function libraryLike(key,value){return key===LIBRARY_KEY||!!value&&!value.task&&!value.id&&['preferences','skills','history'].every(k=>Array.isArray(value[k]));}
function candidate(key,value){return key===ACTIVE_KEY||key==='active'||key==='active-investigation'||/^factory-v[123]-(active|history-)/.test(String(key))||[1,2,3].includes(value?.version)||[1,2,3].includes(value?.schemaVersion);}
export function legacyMetadata(key,value,archive=null){
 const version=value?.version??value?.schemaVersion??'未知',scenario=typeof value?.scenarioVersion==='string'?value.scenarioVersion:null;
 const nickname=[value?.profile?.nickname,value?.order?.nickname].find(x=>typeof x==='string'&&x.trim())||'访客';
 const reason=version===1||version===2?'旧版结构，只读保留':scenario&&scenario!==SCENARIO_VERSION?'教学场景版本不兼容':'当前格式无法安全恢复，只读保留';
 return {nickname,version,schemaVersion:value?.schemaVersion??null,scenarioVersion:scenario,startedAt:typeof value?.startedAt==='string'?value.startedAt:null,reason,label:(archive?.archiveKind==='readonly-library'?'旧版资料库':'只读存档')+' · v'+version+(scenario?' · '+scenario:''),originalKey:archive?.originalKey??key,archivedAt:archive?.archivedAt??null};
}
export function selectVisits(records){
 const map=new Map();for(const {key,value} of records){const valid=compatibleVisit(value);if(!valid)continue;const prior=map.get(valid.id);if(!prior||key===ACTIVE_KEY||prior.key!==ACTIVE_KEY)map.set(valid.id,{key,value:valid});}
 return [...map.values()].map(x=>x.value).sort((a,b)=>b.startedAt.localeCompare(a.startedAt)||a.id.localeCompare(b.id));
}
export function selectLegacy(records){
 const result=[];for(const {key,value} of records){if(archived(value)){result.push({key,value:value.record,metadata:legacyMetadata(key,value.record,value)});continue;}if(libraryLike(key,value)||!candidate(key,value)||compatibleVisit(value))continue;result.push({key,value,metadata:legacyMetadata(key,value)});}
 return result;
}
// Stable JSON fingerprints deduplicate retried archival. The original value is never rewritten.
function serialized(value){const seen=new WeakSet();return JSON.stringify(value,(_,item)=>{if(item&&typeof item==='object'){if(seen.has(item))return '[Circular]';seen.add(item);}return item;})??String(value);}
function digest(text){let a=2166136261,b=2246822507;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619)>>>0;b=Math.imul(b^text.charCodeAt(i),3266489909)>>>0;}return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')+'-'+text.length;}
export function archiveKeyFor(value,originalKey=ACTIVE_KEY){const version=String(value?.version??value?.schemaVersion??'unknown'),scenario=String(value?.scenarioVersion??'legacy'),id=String(value?.id??'no-id');return ARCHIVE_PREFIX+[originalKey,version,scenario.slice(0,70),id.slice(0,100)].map(encodeURIComponent).join(':')+':'+digest(serialized(value));}
export function write(key,value){return writeBatch([[key,value]]);}
export function writeBatch(entries){
 const copies=entries.map(([key,value])=>[key,structuredClone(value)]);
 const next=queue.catch(()=>{}).then(async()=>{const db=await open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('records','readwrite'),store=tx.objectStore('records'),archives=[];
  tx.oncomplete=()=>resolve({writtenKeys:copies.map(x=>x[0]),archived:archives[0]||null,archives});tx.onerror=()=>reject(tx.error||Error('本机存档写入失败。'));tx.onabort=()=>reject(tx.error||Error('本机存档事务已回滚。'));
  const fail=error=>{try{tx.abort();}catch{}reject(error);};
  const putAll=()=>{try{for(const [key,value] of copies)store.put(value,key);}catch(error){fail(error);}};
  const protectedKeys=[...new Set(copies.map(x=>x[0]).filter(k=>k===ACTIVE_KEY||k===LIBRARY_KEY||k===NEWS_ACTIVE))];
  const protect=(index=0)=>{if(index>=protectedKeys.length){putAll();return;}
   const originalKey=protectedKeys[index],req=store.get(originalKey);req.onerror=()=>fail(req.error);req.onsuccess=()=>{
    const old=req.result,compatible=originalKey===NEWS_ACTIVE?restoreNewsVisit(old):originalKey===ACTIVE_KEY?compatibleVisit(old):validLibrary(old);if(old===undefined||compatible){protect(index+1);return;}
    const base=archiveKeyFor(old,originalKey),text=serialized(old),archivedAt=new Date().toISOString();
    const reserve=(suffix=0)=>{const key=base+(suffix?':collision-'+suffix:''),existing=store.get(key);existing.onerror=()=>fail(existing.error);existing.onsuccess=()=>{
     if(existing.result!==undefined){if(!archived(existing.result)||serialized(existing.result.record)!==text){reserve(suffix+1);return;}archives.push({key,...legacyMetadata(key,existing.result.record,existing.result),created:false});protect(index+1);return;}
     try{const envelope={archiveKind:originalKey===LIBRARY_KEY?'readonly-library':'readonly-visit',archiveVersion:1,originalKey,archivedAt,record:old};store.put(envelope,key);archives.push({key,...legacyMetadata(key,old,envelope),created:true});protect(index+1);}catch(error){fail(error);}
    };};reserve();
   };
  };protect();
 });});queue=next;return next;
}
export async function flush(){await queue;}
export async function listRecords(){await queue.catch(()=>{});const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('records','readonly'),req=tx.objectStore('records').openCursor(),records=[];req.onsuccess=()=>{const cursor=req.result;if(cursor){records.push({key:cursor.key,value:cursor.value});cursor.continue();}else resolve(records);};req.onerror=()=>reject(req.error);});}
export async function listVisits(){return selectVisits(await listRecords());}
export async function listLegacy(){return selectLegacy(await listRecords());}
