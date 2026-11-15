/**
 * Focused Gate7 owner records-restore HTTP body budget tests.
 * Only in-memory streams and source assertions: NO DB, Cloudflare, Stripe,
 * photos, network, providers or customer records.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {RECORDS_RESTORE_MAX_BYTES as LIMIT,readBoundedRecordsRestoreText} from '../lib/bounded-records-restore.mjs';
let count=0;
const pass=(value,message)=>{assert.ok(value,message);count++;};
const encoder=new TextEncoder();
function request(chunks,headers={}){
 const list=chunks.slice();let index=0;
 const stream=new ReadableStream({
  pull(controller){if(index===list.length){controller.close();return;}controller.enqueue(list[index++]);}
 },{highWaterMark:0});
 return new Request('https://fire.example.invalid/api/backup',{
  method:'POST',headers,body:stream,duplex:'half'
 });
}
async function rejected(result,status,phrase){
 pass(result instanceof Response&&result.status===status,'rejection HTTP status '+status);
 const body=await result.json();
 pass(typeof body.error==='string'&&body.error.includes(phrase),'specific safe owner-facing error');
 pass(result.headers.get('cache-control')==='no-store','restore upload refusal cannot be cached');
}
const normal='{"format":"fire-app-records-backup","version":1}';
pass(await readBoundedRecordsRestoreText(request([encoder.encode(normal)]))===normal,
 'well-formed small backup arrives exactly without mutation');
const unicode='{"caption":"🔥 customer"}';
const split=encoder.encode(unicode),marker=split.indexOf(0xf0);
pass(await readBoundedRecordsRestoreText(request([
 split.subarray(0,marker+2),split.subarray(marker+2,marker+3),split.subarray(marker+3)
 ]))===unicode,'multi-byte UTF8 split across HTTP chunks is reconstructed exactly');
await rejected(await readBoundedRecordsRestoreText(request([new Uint8Array(LIMIT+1)])),413,'5 MB');
await rejected(await readBoundedRecordsRestoreText(request([
 new Uint8Array(LIMIT-2),new Uint8Array(3)
 ])),413,'5 MB');
await rejected(await readBoundedRecordsRestoreText(request([
 encoder.encode('{}')
 ],{'content-length':String(LIMIT+1)})),413,'5 MB');
await rejected(await readBoundedRecordsRestoreText(request([
 encoder.encode('{}')
 ],{'content-length':'-1'})),413,'5 MB');
await rejected(await readBoundedRecordsRestoreText(request([
 new Uint8Array(LIMIT+1)
 ],{'content-length':'2'})),413,'5 MB');
pass((await readBoundedRecordsRestoreText(request([new Uint8Array(LIMIT)]))).length===LIMIT,
 'exact byte boundary is allowed without buffering over-budget bytes');
await rejected(await readBoundedRecordsRestoreText(request([new Uint8Array([0xff])])),400,'invalid UTF-8');
await rejected(await readBoundedRecordsRestoreText(request([])),400,'empty');
await rejected(await readBoundedRecordsRestoreText(new Request('https://fire.example.invalid/api/backup',{method:'POST'})),400,'empty');
const incomplete=new ReadableStream({
 start(controller){controller.enqueue(encoder.encode('{"part":"'));controller.error(Error('lost upload'));}
},{highWaterMark:0});
await rejected(await readBoundedRecordsRestoreText(new Request('https://fire.example.invalid/api/backup',{
 method:'POST',body:incomplete,duplex:'half'
})),400,'incomplete');
const source=readFileSync(fileURLToPath(new URL('../app/api/backup/route.ts',import.meta.url)),'utf8');
const idxImport=source.indexOf("import {readBoundedRecordsRestoreText} from '../../../lib/bounded-records-restore.mjs';");
const idxCall=source.indexOf('const bounded = await readBoundedRecordsRestoreText(request);');
const idxGuard=source.indexOf('if (bounded instanceof Response) return bounded;');
const idxParse=source.indexOf('JSON.parse(bounded)');
pass(idxImport>=0&&idxCall>idxImport&&idxGuard>idxCall&&idxParse>idxGuard,
 'actual production owner POST uses size bounded text BEFORE JSON parse and all D1 restore writes');
pass(!source.includes('await request.text()'),'owner restore route never buffers whole untrusted HTTP body');
console.log('PASS '+count+'/'+count+' bounded records restore HTTP bytes/UTF8/interruption/source-wiring (NO PROVIDER OR DB)');
