import assert from 'node:assert/strict';
import {
  expectedSessionMigrationJournal,
  assertSessionMigrationJournal
} from './shared/lib/session-migration-journal.mjs';

let checks=0;

const db=rows=>({
  prepare:()=>({
    all:async()=>({results:rows})
  })
});

for(const target of [
  'qa','independent-staging',
  'independent-dr','independent-live'
]){
  const expected=expectedSessionMigrationJournal(target);
  const rows=expected.map((name,i)=>({id:i+1,name}));

  assert.equal(expected.length,
    target==='qa'||target==='independent-staging'?26:27);
  checks++;

  assert.equal(await assertSessionMigrationJournal(db(rows),target),true);
  checks++;

  await assert.rejects(()=>assertSessionMigrationJournal(db(rows.slice(0,-1)),target));
  checks++;

  await assert.rejects(()=>assertSessionMigrationJournal(db([...rows,{id:99,name:'unexpected.sql'}]),target));
  checks++;

  const reordered=[...rows];
  [reordered[0],reordered[1]]=[reordered[1],reordered[0]];

  await assert.rejects(()=>assertSessionMigrationJournal(db(reordered),target));
  checks++;

  const wrongName=rows.map(x=>({...x}));
  wrongName.at(-1).name='incorrect.sql';

  await assert.rejects(()=>assertSessionMigrationJournal(db(wrongName),target));
  checks++;

  const wrongId=rows.map(x=>({...x}));
  wrongId.at(-1).id=99;

  await assert.rejects(()=>assertSessionMigrationJournal(db(wrongId),target));
  checks++;

  await assert.rejects(()=>assertSessionMigrationJournal(null,target));
  checks++;

  console.log('PASS:',target,'journal validation and rejection cases');
}

assert.throws(()=>expectedSessionMigrationJournal('unknown'));
checks++;

console.log('G607 JOURNAL GUARD PASS: '+checks+'/'+checks);