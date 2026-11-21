/** Independent DR expense GET: actual TS source + synthetic native SQLite (no provider). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import {readOwnerWriteObject} from '../lib/customer-write-request-guard.mjs';

const routePath=process.argv[2], datePath=process.argv[3];
assert.ok(routePath&&datePath,'Supply actual DR expense route and calendar helper paths');
const source=readFileSync(routePath,'utf8');
const owner=source.match(/OWNER_EMAIL="([^"]+)"/)?.[1];
assert.ok(owner,'Retain existing DR owner identity');
const calendar=ts.transpileModule(readFileSync(datePath,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const dateContext={exports:{},Date,Intl,Number};
vm.runInNewContext(calendar,dateContext);
assert.equal(typeof dateContext.exports.expenseBusinessDay,'function');

const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT); CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT); CREATE TABLE estimate_items(id TEXT PRIMARY KEY,estimate_id TEXT,name TEXT); CREATE TABLE expenses(id TEXT PRIMARY KEY,estimate_id TEXT,category TEXT,description TEXT,amount_cents INTEGER,incurred_at TEXT,created_at TEXT);');
db.prepare('INSERT INTO customers VALUES (?,?)').run('c1','=HYPERLINK("https://synthetic.invalid","click")');
db.prepare('INSERT INTO estimates VALUES (?,?)').run('e1','c1');
db.prepare('INSERT INTO estimate_items VALUES (?,?,?)').run('i1','e1',' +SUM(1,2)');
db.prepare('INSERT INTO expenses VALUES (?,?,?,?,?,?,?)').run('x1','e1','-1+2','@SUM(1,2)',1525,'2026-10-20T12:00:00.000Z','2026-10-20T12:00:00.000Z');
db.prepare('INSERT INTO expenses VALUES (?,?,?,?,?,?,?)').run('x2',null,'Supplies','Normal, "quoted"',275,'2026-10-19T12:00:00.000Z','2026-10-19T12:00:00.000Z');
db.prepare('INSERT INTO expenses VALUES (?,?,?,?,?,?,?)').run('x3',null,'Fuel','late-tulsa-dec31',5000,'2027-01-01T04:30:00.000Z','2027-01-01T04:30:00.000Z');
db.prepare('INSERT INTO expenses VALUES (?,?,?,?,?,?,?)').run('x4',null,'Fuel','local-new-year',6000,'2027-01-01T06:30:00.000Z','2027-01-01T06:30:00.000Z');

let reads=0,writes=0,unavailable=false,softReadFailure=false,incompleteRead=false,mode='owner',loseAckOnce=false;
const backing={prepare(sql){
 if(unavailable)throw Error('Synthetic D1 failure');
 const stmt=db.prepare(sql);
 return {
  args:[],
  bind(...args){this.args=args;return this;},
  async all(){reads++;if(softReadFailure)return {success:false,results:[]};if(incompleteRead)return {success:true};return {results:stmt.all(...this.args)};},
  async first(){reads++;return stmt.get(...this.args)??null;},
  async run(){writes++;const result=stmt.run(...this.args);if(loseAckOnce){loseAckOnce=false;throw Error('Synthetic lost commit ACK');}return {success:true,meta:{changes:Number(result.changes)}};}
 };
}};
const getOwnerUser=async()=>{
 if(mode==='reject')throw Error('Owner session failed');
 if(mode==='missing')return null;
 if(mode==='numeric')return {email:42};
 if(mode==='unreadable')return {get email(){throw Error('Unreadable email')}};
 if(mode==='nonowner')return {email:'nonowner@synthetic.invalid'};
 return {email:owner};
};
const transpiled=ts.transpileModule(source,{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const context={exports:{},Request,Response,Headers,URL,Date,Number,String,JSON,BigInt,Intl,crypto:globalThis.crypto,
 require(id){
  if(id==='cloudflare:workers')return {env:{DB:backing}};
  if(id==='../../owner-auth')return {getOwnerUser};
  if(id==='../../../lib/expense-date')return dateContext.exports;
  if(id==='../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject};
  throw Error('Unexpected DR route import '+id);
 }};
vm.runInNewContext(transpiled,context);
assert.equal(typeof context.exports.GET,'function');
let checks=0;
const eq=(a,b,label)=>{assert.equal(a,b,label);checks++;};
const verifyPrivate=(r,label)=>{
 eq(r.headers.get('cache-control'),'private, no-store',label+' private');
 eq(r.headers.get('vary'),'Cookie',label+' varied by session');
 eq(r.headers.get('x-content-type-options'),'nosniff',label+' nosniff');
};
const get=(query='')=>context.exports.GET(new Request('https://synthetic.invalid/api/expenses'+query));

for(const badMode of ['missing','numeric','unreadable','reject','nonowner']){
 mode=badMode;
 const before=reads;
 const denied=await get('?format=csv');
 eq(denied.status,401,badMode+' cannot export');
 verifyPrivate(denied,badMode);
 eq(reads,before,badMode+' performs no D1 reads');
}
mode='owner';
const normal=await get();
eq(normal.status,200,'owner JSON GET');
verifyPrivate(normal,'owner JSON');
const data=await normal.json();
eq(data.expenses.length,4,'original four owner expenses visible');
eq(data.expenses[0].description,'local-new-year','descending expense order preserved');
const csvResponse=await get('?format=csv');
eq(csvResponse.status,200,'owner CSV GET');
verifyPrivate(csvResponse,'owner CSV');
eq(csvResponse.headers.get('content-type'),'text/csv; charset=utf-8','Wave content type');
const csv=await csvResponse.text();
assert.ok(csv.includes('"Date","Category"')===false,'Keep original unquoted CSV headers');
assert.ok(csv.startsWith('Date,Category,Description,Amount,Customer,Job\n')===false||csv.includes('Date,Category,Description,Amount,Customer,Job'),'Wave six-column header unchanged');
for(const escaped of ['"\'-1+2"','"\'@SUM(1,2)"','"\'=HYPERLINK(""https://synthetic.invalid""','"\' +SUM(1,2)"'])
 {assert.ok(csv.includes(escaped),'CSV formula is literal: '+escaped);checks++;}
assert.ok(csv.includes('"15.25"')&&csv.includes('"2.75"'),'Original integer cents exported accurately');checks++;
const year2026=await get('?format=csv&year=2026');
eq(year2026.status,200,'year filter accepted');
verifyPrivate(year2026,'2026 CSV');
const y2026=await year2026.text();
assert.ok(y2026.includes('late-tulsa-dec31')&&!y2026.includes('local-new-year'),'Tulsa Dec 31 is 2026, Jan 1 omitted');checks++;
eq(year2026.headers.get('content-disposition')?.includes('fire-expenses-2026-wave.csv'),true,'year-specific filename');
const y2027=await (await get('?format=csv&year=2027')).text();
assert.ok(y2027.includes('local-new-year')&&!y2027.includes('late-tulsa-dec31'),'2027 export uses Tulsa business day');checks++;
const beforeBadYear=reads;
const yearBad=await get('?format=csv&year=202A');
eq(yearBad.status,400,'invalid year denied');
verifyPrivate(yearBad,'bad CSV year');
eq(reads,beforeBadYear,'invalid year never reads D1');

unavailable=true;
const outage=await get();
eq(outage.status,503,'DB unavailable controlled JSON 503');verifyPrivate(outage,'D1 outage');
const csvOutage=await get('?format=csv');
eq(csvOutage.status,503,'DB unavailable controlled CSV 503');verifyPrivate(csvOutage,'CSV D1 outage');
unavailable=false;
for(const softFailure of ['success:false','missing results']){
 softReadFailure=softFailure==='success:false';
 incompleteRead=softFailure==='missing results';
 const writesBefore=writes;
 try{
  for(const query of ['', '?format=csv&year=2026']){
   const falseEmpty=await get(query);
   eq(falseEmpty.status,503,softFailure+' refuses false empty DR expenses JSON/CSV');
   verifyPrivate(falseEmpty,softFailure+' read rejection');
   eq((await falseEmpty.json()).error.includes('were not changed'),true,softFailure+' never claims DR ledger is empty');
  }
  eq(writes,writesBefore,softFailure+' read-failure handling never writes expense data');
 }finally{softReadFailure=false;incompleteRead=false;}
}
db.prepare("UPDATE expenses SET amount_cents=? WHERE id='x1'").run('not-a-number');
const badAmount=await get('?format=csv');
eq(badAmount.status,503,'non-integer financial legacy cents blocked');verifyPrivate(badAmount,'bad cents');
const badAmountJson=await get();
eq(badAmountJson.status,503,'DR JSON expense history refuses a noninteger saved amount');
verifyPrivate(badAmountJson,'bad JSON cents');
eq((await badAmountJson.json()).error.includes('amounts'),true,'DR corrupt amount provides explicit review error');
db.prepare("UPDATE expenses SET amount_cents=? WHERE id='x1'").run(1525);
db.prepare("UPDATE expenses SET incurred_at=? WHERE id='x1'").run('invalid-date');
const badDate=await get('?format=csv&year=2026');
eq(badDate.status,503,'invalid saved business date blocked');verifyPrivate(badDate,'bad saved date');
const badDateJson=await get();
eq(badDateJson.status,503,'DR JSON expense history refuses an invalid saved date');
verifyPrivate(badDateJson,'bad JSON date');
eq((await badDateJson.json()).error.includes('dates'),true,'DR corrupt date provides explicit review error');
eq(db.prepare("SELECT amount_cents AS cents FROM expenses WHERE id='x1'").get().cents,1525,'read/export never changed financial amount');

// Real DR POST uses the same QA-master bounded owner JSON, CSRF and D1-verified
// idempotent expense receipt logic. No remote Stripe or live D1 access.
const requestId='6e2b4eab-8ccb-4cee-8e6e-000000000012';
const expense=(overrides={})=>({requestId,estimateId:'e1',category:'Supplies',
 description:'Synthetic checked purchase',amountCents:1995,incurredAt:'2026-11-21',...overrides});
const post=(body,extraHeaders={})=>context.exports.POST(new Request('https://synthetic.invalid/api/expenses',{
 method:'POST',headers:{'content-type':'application/json',...extraHeaders},
 body:typeof body==='string'?body:JSON.stringify(body)
}));
for(const badMode of ['missing','numeric','unreadable','reject','nonowner']){
 mode=badMode;
 const beforeReads=reads,beforeWrites=writes;
 const denied=await post(expense());
 eq(denied.status,401,badMode+' cannot write expenses');
 verifyPrivate(denied,badMode+' POST');
 eq(reads,beforeReads,badMode+' expense POST no D1 reads');
 eq(writes,beforeWrites,badMode+' expense POST no D1 writes');
}
mode='owner';
const beforeBadOriginReads=reads,beforeBadOriginWrites=writes;
const rejectedOrigin=await post(expense(),{origin:'https://foreign.synthetic.invalid','sec-fetch-site':'cross-site'});
eq(rejectedOrigin.status,403,'foreign browser origin refused');
verifyPrivate(rejectedOrigin,'foreign-origin POST');
eq(reads,beforeBadOriginReads,'bad origin no owner D1 reads');
eq(writes,beforeBadOriginWrites,'bad origin no D1 writes');
const oversize=await post(expense({description:'X'.repeat(33000)}));
eq(oversize.status,413,'oversize expense streamed body refused');
verifyPrivate(oversize,'oversize POST');
eq(writes,beforeBadOriginWrites,'oversize body no D1 writes');
const badJson=await post('{"requestId":');
eq(badJson.status,400,'malformed JSON controlled error');
verifyPrivate(badJson,'bad JSON POST');
const badMoney=await post(expense({amountCents:1.25}));
eq(badMoney.status,400,'fractional cents not accepted');
verifyPrivate(badMoney,'fractional cents POST');
unavailable=true;
const missingD1=await post(expense());
eq(missingD1.status,503,'owner linked job lookup D1 outage controlled');
verifyPrivate(missingD1,'POST lookup outage');
unavailable=false;
const beforeRowCount=db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;
const saved=await post(expense());
eq(saved.status,201,'new DR expense confirmed 201');
verifyPrivate(saved,'new DR expense');
const savedBody=await saved.json();
eq(savedBody.confirmed,true,'new expense readback confirmed');
eq(savedBody.requestId,requestId,'new financial receipt echoes immutable request ID');
eq(savedBody.expense.amountCents,1995,'new saved cents exact');
eq(db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n,beforeRowCount+1,'single synthetic expense actually stored');
const duplicate=await post(expense());
eq(duplicate.status,200,'retry returns existing receipt without second charge');
verifyPrivate(duplicate,'idempotent replay');
eq(db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n,beforeRowCount+1,'duplicate request ID creates no second expense');
const conflict=await post(expense({amountCents:2995}));
eq(conflict.status,409,'same ID with different financial cents is conflict');
verifyPrivate(conflict,'expense conflict');
const lostId='6e2b4eab-8ccb-4cee-8e6e-000000000013';
loseAckOnce=true;
const afterLostAck=await post(expense({requestId:lostId}));
eq(afterLostAck.status,200,'lost D1 ACK resolved from immutable saved record');
verifyPrivate(afterLostAck,'lost-ACK receipt');
eq((await afterLostAck.json()).confirmed,true,'lost-ACK expense only confirmed after readback');
eq(db.prepare('SELECT COUNT(*) AS n FROM expenses WHERE id=?').get(lostId).n,1,'lost ACK did not duplicate stored expense');

console.log('PASS '+checks+' independent DR owner expense GET+POST / private CSV / Tulsa date / idempotent D1 receipt safety checks (native SQLite, NO HOSTED OPERATIONS)');
