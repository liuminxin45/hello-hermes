import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const source=new URL('../docs/public/factory/index.html',import.meta.url),target=new URL('../docs/.vitepress/dist/index.html',import.meta.url);
let revision='local';try{revision=execFileSync('git',['rev-parse','--short=12','HEAD'],{encoding:'utf8'}).trim();}catch{}
const html=(await readFile(source,'utf8')).replace('<head>','<head>\n  <base href="/hello-hermes/factory/">\n  <meta name="hh-factory-release" content="'+revision+'">');
await writeFile(target,html);console.log(`Factory homepage ready (${revision}); original chapters remain available via library.html.`);
