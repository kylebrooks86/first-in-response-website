// Synthetic archive tests using native WebCrypto, not mocked cryptography.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const directory = mkdtempSync(join(tmpdir(), 'fire-backup-test-'));
let passed = 0;
async function check(name, test) { await test(); passed++; console.log(`PASS: ${name}`); }
try {
  for (const file of ['local-customer-store', 'local-customer-backup']) {
    const source = readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace("'./local-customer-store'", "'./local-customer-store.mjs'");
    writeFileSync(join(directory, `${file}.mjs`), js);
  }
  const { protectLocalCustomerBackup: protect, recoverLocalCustomerBackup: recover } = await import(pathToFileURL(join(directory, 'local-customer-backup.mjs')));
  const namespace = 'fire-local-customers:v1:synthetic:target', phrase = 'synthetic recovery phrase for tests only';
  const input = { id:'synthetic-1', name:'Synthetic Customer', email:'test@example.invalid', phone:'', address:'Synthetic', leadSource:'test' };
  const customer = { ...input, revision:1, updatedAt:'2026-10-10T00:00:00.000Z' };
  const archive = { format:'fire-local-customers', version:1, namespace, customers:[customer], pendingOperations:[{ id:'create', kind:'customer-upsert', expectedRevision:0, customer, input }] };
  const original = JSON.stringify(archive);
  const envelope = await protect(archive, namespace, phrase);
  await check('native crypto round trip preserves validated customer/history', async()=>assert.deepEqual(await recover(envelope,namespace,phrase),archive));
  await check('envelope contains no customer plaintext, namespace or phrase', async()=>{
    const json=JSON.stringify(envelope); for(const text of [customer.name,customer.email,namespace,phrase]) assert.ok(!json.includes(text));
  });
  await check('fresh random salt and nonce produce distinct exports',async()=>{
    const second=await protect(archive,namespace,phrase);assert.notEqual(second.salt,envelope.salt);assert.notEqual(second.iv,envelope.iv);assert.notEqual(second.ciphertext,envelope.ciphertext);
  });
  await check('wrong passphrase rejects without recovery',async()=>assert.rejects(recover(envelope,namespace,'a different synthetic recovery phrase')));
  await check('account/target mismatch rejects decrypted backup',async()=>assert.rejects(recover(envelope,'fire-local-customers:v1:other:target',phrase)));
  for(const field of ['salt','iv','ciphertext']) await check(`tampered ${field} rejects`,async()=>{
    const bad=structuredClone(envelope);bad[field]=(bad[field][0]==='0'?'1':'0')+bad[field].slice(1);await assert.rejects(recover(bad,namespace,phrase));
  });
  for(const [name,bad] of [ ['future version',{...envelope,version:2}],['unknown field',{...envelope,extra:true}],['invalid salt',{...envelope,salt:'zz'}],['short nonce',{...envelope,iv:'00'}],['truncated ciphertext',{...envelope,ciphertext:'00'}],['missing field',{format:envelope.format,version:1,salt:envelope.salt,iv:envelope.iv}],['null',null] ]) {
    await check(`reject ${name}`,async()=>assert.rejects(recover(bad,namespace,phrase)));
  }
  await check('weak/empty passphrase refuses export',async()=>{await assert.rejects(protect(archive,namespace,'short'));await assert.rejects(protect(archive,namespace,''));});
  await check('invalid backup refuses encryption',async()=>assert.rejects(protect({...archive,customers:[customer,customer]},namespace,phrase)));
  await check('unavailable secure crypto fails closed',async()=>{await assert.rejects(protect(archive,namespace,phrase,{}));await assert.rejects(recover(envelope,namespace,phrase,{}));});
  await check('caller mutation after protection begins cannot alter the archive',async()=>{
    const copy=structuredClone(archive);const operation=protect(copy,namespace,phrase);copy.customers[0].name='Tampered';assert.deepEqual(await recover(await operation,namespace,phrase),archive);
  });
  await check('caller mutation after recovery begins cannot alter crypto parameters',async()=>{
    const copy=structuredClone(envelope);const operation=recover(copy,namespace,phrase);copy.iv='00';copy.ciphertext='00';assert.deepEqual(await operation,archive);
  });
  await check('empty customer archive round trip',async()=>{
    const empty={...archive,customers:[],pendingOperations:[]};assert.deepEqual(await recover(await protect(empty,namespace,phrase),namespace,phrase),empty);
  });
  await check('successful and failed operations do not mutate caller records',async()=>assert.equal(JSON.stringify(archive),original));
  console.log(JSON.stringify({passed,total:passed,nativeWebCrypto:true,syntheticOnly:true,browserTested:false,iPhoneTested:false,storageEncrypted:false,uiActivated:false}));
} finally { rmSync(directory,{recursive:true,force:true}); }
