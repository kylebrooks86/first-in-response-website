import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {captureCompleteReviewedD1RecordsReadOnly}
 from './shared/lib/complete-d1-records-review.mjs';
import {
 prepareCompleteD1OwnerFile,
 verifyProtectedCompleteReviewedD1Records
} from './shared/lib/protected-complete-d1-records.mjs';

const root=new URL('./',import.meta.url);
const base=new URL('adapters/doomsday/drizzle/',root);
const files=readdirSync(base).filter(x=>x.endsWith('.sql')).sort();

const db=new DatabaseSync(':memory:');
let checks=0;

const equal=(a,b)=>{
 assert.deepEqual(a,b);
 checks++;
};

try{
 db.exec('PRAGMA foreign_keys=ON');
 db.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE)');

 for(const file of files){
  db.exec(readFileSync(new URL(file,base),'utf8'));
  db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(file);
 }

 for(const file of [
  '0025_independent_permanent_numbers.sql',
  '0026_owner_auth_sessions.sql'
 ]){
  db.exec(readFileSync(new URL('adapters/independent-live/drizzle/'+file,root),'utf8'));
  db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(file);
 }

 db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)')
  .run('synthetic-customer','Synthetic backup customer','2026-11-27T00:00:00Z');

 db.prepare('INSERT INTO owner_auth_sessions VALUES(?,?,?,?)')
  .run('synthetic-active-session','fire_admin_session',2000000000,null);

 db.prepare('INSERT INTO owner_auth_sessions VALUES(?,?,?,?)')
  .run('synthetic-revoked-session','fire_admin_session',2000000000,1900000000);

 db.prepare('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)')
  .run(1,'synthetic-customer','2026-11-27T00:00:00Z');

 let batches=0;
 const d1={
  prepare(sql){
   assert.match(sql,/^(SELECT|PRAGMA table_xinfo)/i);

   assert.doesNotMatch(sql,/FROM\s+["`]?owner_auth_sessions\b/i);

   return {sql};
  },
  async batch(items){
   batches++;
   return items.map(x=>({
    success:true,
    results:db.prepare(x.sql).all()
   }));
  }
 };

 const review=await captureCompleteReviewedD1RecordsReadOnly(
  d1,{sessionEnabled:true}
 );

 equal(batches,1);
 equal(review.supplemental.tables.owner_auth_sessions,[]);
 equal(review.supplemental.rowCounts.owner_auth_sessions,0);
 equal(review.supplemental.tables.d1_migrations.length,27);
 equal(review.core.tables.customers[0].id,'synthetic-customer');

 equal(JSON.stringify(review).includes('synthetic-active-session'),false);
 equal(JSON.stringify(review).includes('synthetic-revoked-session'),false);

 const phrase='synthetic FIRE backup verification phrase';
 const prepared=await prepareCompleteD1OwnerFile(
  review,phrase,phrase
 );

 equal(prepared.inMemoryEncryptionVerified,true);

 const reopened=await verifyProtectedCompleteReviewedD1Records(
  prepared.blob,phrase
 );

 equal(reopened.migrationCount,27);
 equal(reopened.supplemental.tables.owner_auth_sessions,[]);
 equal(
 reopened.core.tables.customers,
 JSON.parse(JSON.stringify(review.core.tables.customers))
);

 equal(db.prepare('SELECT COUNT(*) AS n FROM owner_auth_sessions').get().n,2);

 console.log('G607 SESSION-SAFE ENCRYPTED EXPORT PASS: '+checks+'/'+checks);

}finally{
 db.close();
}