/** Real owner-gated GET route: exact notification lookup stays read-only and scoped. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('app/api/followups/route.ts','utf8');
const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const get=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='GET');
assert.ok(get,'Real follow-ups GET handler must exist');
const js=ts.transpileModule('const OWNER_EMAIL="owner@example.test";\n'+get.getText(ast)+'\nexports.GET=GET;',{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
let identity='owner@example.test',queries=[],results=[];
const context={
 exports:{},URL,Response,Date,Number,JSON,atob,btoa,BUSINESS_PREFERENCES_KEY:'fire:business-preferences:v1',
 getChatGPTUser:async()=>identity?{email:identity}:null,
 serviceLocationsEnabled:()=>false,serviceAddressColumns:()=>"'synthetic QA address' AS address",
 env:{DB:{prepare(sql){const record={sql,args:null};queries.push(record);return{bind(...args){record.args=args;return{all:async()=>({results}),first:async()=>null}}}}}}
};
vm.runInNewContext(js,context);
const GET=context.exports.GET;let checks=0;
function eq(actual,expected,message){assert.deepEqual(actual,expected,message);checks++;}
async function call(q=''){const res=await GET(new Request('https://example.test/api/followups'+q));return {status:res.status,data:await res.json()};}
identity='visitor@example.test';eq((await call('?estimateId=older-uuid')).status,401,'Non-owner cannot access exact saved record');eq(queries.length,0,'Unauthorized request never queries DB');
identity='owner@example.test';
for(const query of ['?estimateId=','?estimateId=bad%20id','?estimateId=a&cursor=abc','?estimateId=a&limit=50','?estimateId='+'a'.repeat(129)]){
 eq((await call(query)).status,400,'Reject invalid exact lookup '+query.slice(0,32));
}
eq(queries.length,0,'Invalid lookup never touches DB');
results=[{id:'older-uuid',customerId:'customer-a',createdAt:'2025-02-01',totalCents:10000}];
let r=await call('?estimateId=older-uuid');
eq(r.status,200,'Owner reads an exact old estimate');eq(r.data.estimateId,'older-uuid','Response echoes verified requested identity');
eq(r.data.estimates.length,1,'Exact lookup returns one saved row');eq(r.data.nextCursor,null,'Exact lookup has no next cursor');
assert.equal(queries.at(-1).sql,'SELECT body FROM message_templates WHERE key=?','Optional repeat preferences are read separately');assert.equal(queries.at(-1).args[0],'fire:business-preferences:v1');checks+=2;
const q=queries.filter(q=>q.sql.includes('FROM estimates e')).at(-1);assert.match(q.sql,/WHERE e\.id = \?/);checks++;
eq(q.args[0],'older-uuid','Exact ID uses bound SQL param');eq(q.args[1],2,'Exact lookup reads at most one plus sentinel');
assert.ok(!q.sql.includes('older-uuid'),'SQL is never interpolated with customer ID');checks++;
results=[];r=await call('?estimateId=gone-uuid');
eq(r.status,200,'Missing record is not a server error');eq(r.data.estimates.length,0,'Missing record never fabricates a customer');
results=[{id:'recent',createdAt:'2026-10-21',customerId:'customer-b'}];r=await call();
eq(r.status,200,'Existing paginated list still works');
assert.match(queries.filter(q=>q.sql.includes('FROM estimates e')).at(-1).sql,/e\.created_at < \?/);checks++;
eq(queries.filter(q=>q.sql.includes('FROM estimates e')).at(-1).args.length,5,'Cursor list retains bounded parameters');
eq(queries.filter(q=>q.sql.includes('FROM estimates e')).at(-1).args[4],51,'Original 50 plus sentinel page size retained');
assert.ok(!source.includes('UPDATE customer_messages'),'GET path does not create contact or send claims');checks++;
console.log('PASS '+checks+'/'+checks+' exact lookup auth, input validation, bound SQL, absence and pagination isolation.');
