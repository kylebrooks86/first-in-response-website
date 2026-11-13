import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('components/offline-customer-photos.tsx','utf8');
const ast=ts.createSourceFile('photos.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let handler;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='verifySavedArchive')handler=n.initializer;ts.forEachChild(n,visit);}
visit(ast);assert.ok(handler,'Actual verification handler exists');
const js=ts.transpileModule('('+handler.getText(ast)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let checks=0;
async function run(result,{failure,busy=false,files=[{name:'synthetic.zip'}]}={}){
 const messages=[],errors=[],active={current:busy},verifyRef={current:{value:'synthetic.zip'}},states=[];let inspections=0;
 const fn=vm.runInNewContext(js,{Error,active,verifyRef,knownCustomerIds:['synthetic-customer'],
 inspectSavedOfflinePhotoZip:async(file,ids)=>{inspections++;assert.equal(file,files[0]);assert.equal(ids[0],'synthetic-customer');if(failure)throw Error(failure);return result;},
 setBusy:v=>states.push(v),setError:v=>errors.push(v),setMessage:v=>messages.push(v)});
 await fn(files);return {text:messages.join(' '),error:errors.join(' '),active:active.current,input:verifyRef.current.value,states,inspections};
}
const base={archivePhotoCount:3,byteIdenticalOnDevice:3,notYetOnDevice:0,localPhotosNotInArchive:0};
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const exact=await run(base);check(exact.text.includes('Backup COMPLETE'),'All three byte-identical current photos retain complete coverage');
for(const matches of [0,1,2]){
 const r=await run({...base,byteIdenticalOnDevice:matches,notYetOnDevice:3-matches});
 check(r.text.includes('Saved ZIP VERIFIED: 3 photo(s) in archive'),'Valid archive is distinguished from device coverage');
 check(!r.text.includes('Backup COMPLETE'),'Missing device photos cannot show complete backup banner');
 check(r.text.includes('Verification did not restore any photos'),'Verification never claims recovery');
 check(r.text.includes('Restore verified photo ZIP'),'Recovery guidance names existing control');
 check(r.text.includes('Current local library is empty.')===(matches===0),'Empty-device statement only when no device photos match and none are unbacked');
 check(r.active===false&&r.input===''&&r.inspections===1&&r.states.join(',')==='true,false','One read-only inspection unlocks controls and clears file selector');
}
const incomplete=await run({...base,byteIdenticalOnDevice:0,notYetOnDevice:3,localPhotosNotInArchive:1});
check(incomplete.error.includes('INCOMPLETE PHOTO BACKUP: 1'),'Newer unbacked local photo takes precedence over valid archived photos');
check(!incomplete.text.includes('Backup COMPLETE')&&!incomplete.text.includes('Current local library is empty'),'Unbacked device library is never declared complete or empty');
const empty=await run({archivePhotoCount:0,byteIdenticalOnDevice:0,notYetOnDevice:0,localPhotosNotInArchive:0});
check(empty.text.includes('archive and current local library are empty')&&!empty.text.includes('Backup COMPLETE'),'Empty archive truthfully describes absence of photos');
for(const failure of ['Unknown customer','Same ID different bytes','Checksum mismatch']){
 const r=await run(base,{failure});check(r.error.includes(failure+' No photos were changed.')&&!r.text.includes('VERIFIED'),'Rejected archive never claims success');
 check(!r.active&&r.input==='','Failed inspection releases controls');
}
for(const options of [{busy:true},{files:null},{files:[]}]){
 const r=await run(base,options);check(r.inspections===0&&r.text===''&&r.error==='','Busy or absent selection performs no inspection');
}
console.log('PASS '+checks+' actual saved-photo ZIP verification handler checks; no photos, archives or hosted data mutated.');
