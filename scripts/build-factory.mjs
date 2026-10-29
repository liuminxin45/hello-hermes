import {readFile,writeFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const repository=fileURLToPath(new URL('../',import.meta.url));
const sourceDirectory=resolve(repository,'docs/public/factory');
const outputDirectory=resolve(repository,'docs/.vitepress/dist');

async function filesIn(directory){
 const files=[];
 async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const path=resolve(folder,entry.name);if(entry.isDirectory())await walk(path);else if(entry.isFile())files.push(path);}}
 await walk(directory);return files.sort((a,b)=>relative(directory,a).replaceAll('\\','/').localeCompare(relative(directory,b).replaceAll('\\','/'),'en'));
}

function versionURL(value,release){
 const hashIndex=value.indexOf('#'),fragment=hashIndex<0?'':value.slice(hashIndex),withoutFragment=hashIndex<0?value:value.slice(0,hashIndex),queryIndex=withoutFragment.indexOf('?'),path=queryIndex<0?withoutFragment:withoutFragment.slice(0,queryIndex),params=new URLSearchParams(queryIndex<0?'':withoutFragment.slice(queryIndex+1));
 params.set('v',release);return path+'?'+params.toString()+fragment;
}

// Read literal import specifiers without treating strings, comments or regex text as code.
// Computed imports are left intact: the factory uses literal relative module URLs.
function moduleTokens(code){
 const tokens=[],regexPrefix=new Set(['(','[','{','=',':',',',';','!','?','return','case','throw','yield','await','=>']);
 for(let i=0;i<code.length;){
  const ch=code[i],next=code[i+1];if(/\s/.test(ch)){i++;continue;}
  if(ch==='/'&&next==='/'){const end=code.indexOf('\n',i+2);i=end<0?code.length:end+1;continue;}
  if(ch==='/'&&next==='*'){const end=code.indexOf('*/',i+2);i=end<0?code.length:end+2;continue;}
  if(ch==='/'&&(!tokens.length||regexPrefix.has(tokens.at(-1).value))){i++;let bracket=false;while(i<code.length){if(code[i]==='\\'){i+=2;continue;}if(code[i]==='[')bracket=true;if(code[i]===']')bracket=false;if(code[i++]==='/'&&!bracket)break;}while(/[a-z]/i.test(code[i]||'')&&i<code.length)i++;tokens.push({kind:'regex',value:''});continue;}
  if(ch==='\''||ch==='"'||ch==='`'){const start=i+1;i++;while(i<code.length&&code[i]!==ch){if(code[i]==='\\')i++;i++;}tokens.push({kind:ch==='`'?'template':'string',value:code.slice(start,i),start,end:i});i++;continue;}
  if(/[A-Za-z_$]/.test(ch)){const start=i++;while(/[\w$]/.test(code[i]||'')&&i<code.length)i++;tokens.push({kind:'word',value:code.slice(start,i)});continue;}
  if(ch==='='&&next==='>'){tokens.push({value:'=>'});i+=2;continue;}
  tokens.push({value:ch});i++;
 }
 return tokens;
}

export function versionModuleImports(code,release){
 const tokens=moduleTokens(code),edits=new Map();
 const add=token=>{if(token?.kind==='string'&&/^\.{1,2}\//.test(token.value)&&/\.mjs(?:[?#]|$)/.test(token.value))edits.set(token.start,{...token,value:versionURL(token.value,release)});};
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i],next=tokens[i+1];if(token.kind!=='word')continue;
  if(token.value==='import'){
   if(next?.value==='('){add(tokens[i+2]);continue;}
   if(next?.value==='.')continue;
   if(next?.kind==='string'){add(next);continue;}
  }else if(token.value!=='export'||!['*','{'].includes(next?.value))continue;
  for(let j=i+1;j<tokens.length&&tokens[j].value!==';';j++)if(tokens[j].kind==='word'&&tokens[j].value==='from'){add(tokens[j+1]);break;}
 }
 for(const edit of [...edits.values()].sort((a,b)=>b.start-a.start))code=code.slice(0,edit.start)+edit.value+code.slice(edit.end);
 return code;
}

export function versionEntryHTML(html,release){
 return html.replace(/(<(?:script|link)\b[^>]*?\s(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi,(whole,prefix,quote,value)=>/^\.{1,2}\//.test(value)&&/\.(?:mjs|css)(?:[?#]|$)/.test(value)?prefix+quote+versionURL(value,release)+quote:whole);
}

export async function buildFactory({source=sourceDirectory,output=outputDirectory,revision}={}){
 const files=await filesIn(source),hash=createHash('sha256'),contents=new Map();
 for(const file of files){const bytes=await readFile(file),name=relative(source,file).replaceAll('\\','/');contents.set(file,bytes);hash.update(name+'\0'+bytes.length+'\0');hash.update(bytes);}
 const release=hash.digest('hex').slice(0,16);
 if(revision===undefined){revision='local';try{revision=execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:repository,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}}
 const releaseMeta='<meta name="hh-factory-release" content="'+revision+'">\n  <meta name="hh-factory-assets" content="'+release+'">';
 for(const file of files){const name=relative(source,file),target=resolve(output,'factory',name);await mkdir(dirname(target),{recursive:true});if(extname(file)==='.mjs')await writeFile(target,versionModuleImports(contents.get(file).toString('utf8'),release));else if(name==='index.html')await writeFile(target,versionEntryHTML(contents.get(file).toString('utf8'),release).replace('<head>','<head>\n  '+releaseMeta));else await copyFile(file,target);}
 const html=versionEntryHTML(contents.get(resolve(source,'index.html')).toString('utf8'),release).replace('<head>','<head>\n  <base href="/hello-hermes/factory/">\n  '+releaseMeta);
 await mkdir(output,{recursive:true});await writeFile(resolve(output,'index.html'),html);
 return {release,revision,files:files.length};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await buildFactory();console.log(`Factory homepage ready (${result.revision}; assets ${result.release}); original chapters remain available via library.html.`);
}
