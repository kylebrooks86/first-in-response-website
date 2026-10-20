/** Check the actual expense GET route with disposable SQLite and synthetic formula text. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';

const database=new DatabaseSync(':memory:');
database.exec('CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT); CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT); CREATE TABLE estimate_items(id TEXT PRIMARY KEY,estimate_id TEXT,name TEXT); CREATE TABLE expenses(id TEXT PRIMARY KEY,estimate_id TEXT,category TEXT,description TEXT,amount_cents INTEGER,incurred_at TEXT,created_at TEXT);');
const customer='=HYPERLINK("https://synthetic.invalid","click")';
const service=' \t+SUM(1,2)';
const category=' \n-1+2';
const description='@SUM("1",2), "synthetic"';
const normal='Exterior soap, "fresh"';
database.prepare('INSERT INTO customers VALUES (?,?)').run('c1',customer);
database.prepare('INSERT INTO estimates VALUES (?,?)').run('e1','c1');
database.prepare('INSERT INTO estimate_items VALUES (?,?,?)').run('i1','e1',service);
database.prepare('INSERT INTO expenses VALUES (?,?,?,?,?,?,?)').run('x1','e1',category,description,1525,'2026-10-20T12:00:00.000Z','2026-10-20T12:00:00.000Z');
database.prepare('INSERT INTO expenses VALUES (?,?,?,?,?,?,?)').run('x2',null,'Supplies',normal,275,'2026-10-19T12:00:00.000Z','2026-10-19T12:00:00.000Z');
const backing={prepare(sql){const stmt=database.prepare(sql);return {bind(...v){return {all:async()=>({results:stmt.all(...v)})};},all:async()=>({results:stmt.all()})};}};
const source=readFileSync('app/api/expenses/route.ts','utf8');
const owner=source.match(/OWNER_EMAIL="([^"]+)"/)?.[1];
assert.ok(owner,'Original owner guard remains');
let authorized=true;
const auth=async()=>authorized?{email:owner}:null;
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},Response,Request,URL,Date,Number,String,JSON,
 require(id){if(id==='cloudflare:workers')return {env:{DB:backing}};if(id==='../../chatgpt-auth')return {getChatGPTUser:auth};throw Error('Unexpected import '+id);}
};
vm.runInNewContext(compiled,context);
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
function parseCSV(csv){
 const result=[];let row=[],cell='',quoted=false;
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if(c==='\n'&&!quoted){row.push(cell);result.push(row);row=[];cell='';}
  else cell+=c;
 }
 row.push(cell);result.push(row);
 eq(quoted,false,'CSV quote delimiters balanced');
 return result;
}
const url='https://synthetic.invalid/api/expenses?format=csv';
const result=await context.exports.GET(new Request(url));
eq(result.status,200,'Authorized owner export');
eq(result.headers.get('content-type'),'text/csv; charset=utf-8','Original CSV content type');
const csv=await result.text(),rows=parseCSV(csv);
eq(rows.length,3,'Header plus exactly two records');
eq(rows[0].join(','),'Date,Category,Description,Amount,Customer,Job','Original six columns');
eq(rows[1][0],'2026-10-20','Date precision unchanged');
eq(rows[1][3],'15.25','Amount retains exact dollar conversion');
for(const [position,raw,label] of [[1,category,'category'],[2,description,'description'],[4,customer,'customer'],[5,service,'service']])
 eq(rows[1][position],"'"+raw,label+' formula-like text made literal');
eq(rows[2][1],'Supplies','Normal category untouched');
eq(rows[2][2],normal,'Safe quoted text unchanged');
eq(rows[2][3],'2.75','Second expense amount unchanged');
eq(database.prepare("SELECT description FROM expenses WHERE id='x1'").get().description,description,'Export does not change DB description');
eq(database.prepare("SELECT name FROM customers WHERE id='c1'").get().name,customer,'Export does not change customer data');
const json=await context.exports.GET(new Request('https://synthetic.invalid/api/expenses'));
eq(json.status,200,'Normal JSON response unchanged');
const parsedJson=await json.json();
eq(parsedJson.expenses[0].description,description,'JSON text not prefixed');
eq(parsedJson.expenses[0].customer,customer,'JSON customer unchanged');
const samples=['=1+1','+1+1','-1+1','@SUM(1)',' \t=HYPERLINK(1)','\r\n+1','\uFEFF-2','\u0000@SUM(1)'];
for(const [i,value] of samples.entries()){
 database.prepare("UPDATE expenses SET description=? WHERE id='x1'").run(value);
 const response=await context.exports.GET(new Request(url));
 const parsed=parseCSV(await response.text());
 eq(parsed[1][2],"'"+value,'Prefix dangerous input variant '+i);
}
authorized=false;
const denied=await context.exports.GET(new Request(url));
eq(denied.status,401,'Unauthenticated export rejected');
eq(database.prepare('SELECT count(*) AS n FROM expenses').get().n,2,'No records created or deleted');
database.close();
console.log('PASS '+checks+'/'+checks+': actual expense CSV safety, embedded quotes and whitespace, auth, unchanged stored records. Disposable SQLite only.');
