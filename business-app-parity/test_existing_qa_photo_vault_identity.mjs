/** Keep the EXISTING deployed QA IndexedDB namespace readable on iPhone.
 * The original first-hosted QA source (f650d25b18d23bc9f71a4d55c9322bfd5870ef75)
 * uses the immutable browser database name fire-private-offline-photos-qa-v1,
 * with store photos and schema version 1. This is SOURCE-ONLY regression
 * evidence, not a claim that Cloudflare/iPhone IndexedDB was inspected.
 * No browser, account, database, deployments, or remote network access.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('./',import.meta.url);
const vault=readFileSync(new URL('shared/lib/local-photo-vault.ts',root),'utf8');
const adapter=readFileSync(new URL('adapters/qa/app/local-customer-deployment.ts',root),'utf8');
const photoScreen=readFileSync(new URL('shared/components/offline-customer-photos.tsx',root),'utf8');

export function verifyQAPhotoVaultIdentity(source,qa,screen){
  assert.match(qa,/export const LOCAL_CUSTOMER_DEPLOYMENT = 'qa' as const;/,
    'Existing deployed QA adapter namespace must remain qa');
  assert.match(source,/import \{ LOCAL_CUSTOMER_DEPLOYMENT \} from '\.\.\/app\/local-customer-deployment';/,
    'Photo storage must derive identity from the fixed adapter, not URLs or storage');
  assert.match(source,/const DB_NAME='fire-private-offline-photos-'\+LOCAL_CUSTOMER_DEPLOYMENT\+'-v1',STORE='photos';/,
    'Existing hosted photo IndexedDB name and object store must remain accessible');
  assert.match(source,/indexedDB\.open\(DB_NAME,1\)/,
    'Original photo IndexedDB version must not silently change');
  assert.match(source,/db\.createObjectStore\(STORE,\{keyPath:'id'\}\)/,
    'Photo object store primary keys must remain compatible');
  assert.match(source,/store\.createIndex\('customerId','customerId',\{unique:false\}\)/,
    'Photo directory index must remain compatible');
  const declaration=screen.match(/import \{([^}]+)\} from '\.\.\/lib\/local-photo-vault';/);
  assert.ok(declaration,'Customer photo screen must import the original on-device vault');
  const imports=new Set(declaration[1].split(',').map(value=>value.trim()));
  for(const op of ['addOfflinePhoto','listOfflinePhotos','removeOfflinePhoto','exportLocalPhotos','restoreLocalPhotos'])
    assert.ok(imports.has(op),'Missing local photo operation import: '+op);
  return {namespace:'fire-private-offline-photos-qa-v1',store:'photos',version:1};
}

const exact=verifyQAPhotoVaultIdentity(vault,adapter,photoScreen);
assert.deepEqual(exact,{namespace:'fire-private-offline-photos-qa-v1',store:'photos',version:1});
const cases=[
  ['changed QA namespace',vault,adapter.replace("'qa' as const","'qa-new' as const"),photoScreen],
  ['changed database version',vault.replace("indexedDB.open(DB_NAME,1)","indexedDB.open(DB_NAME,2)"),adapter,photoScreen],
  ['changed photo object-store name',vault.replace("STORE='photos'","STORE='pictures'"),adapter,photoScreen],
  ['changed customer lookup index',vault.replace("createIndex('customerId','customerId'","createIndex('clientId','customerId'"),adapter,photoScreen],
  ['changed persistent database name',vault.replace("'fire-private-offline-photos-'","'new-fire-photos-'"),adapter,photoScreen],
  ['deleted local backup operation',vault,adapter,photoScreen.replace('restoreLocalPhotos','otherRestore')]
];
for(const [label,source,qa,screen] of cases){
  assert.throws(()=>verifyQAPhotoVaultIdentity(source,qa,screen),undefined,label+' must stop QA publication');
}
console.log('PASS: Original hosted QA photo vault name/store/schema and all on-device photo controls unchanged.');
console.log('PASS: Six namespace/data-loss negative cases refused; source-only, zero hosted changes.');
