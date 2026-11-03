/** SOURCE-REAL route tests: isolated owner-only readback and PATCH behavior.
 * No Cloudflare credentials, real customers, external requests or hosted writes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {customerNumberingReady,customerNumberForCustomer} from '../lib/customer-numbering.mjs';
const require=createRequire(import.meta.url);
const source=ts.createSourceFile('customers-route.ts',readFileSync('app/api/customers/route.ts','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const get=n=>source.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===n)?.getText(source);
const contactSource=ts.createSourceFile('customer-contact-links.ts',readFileSync('lib/customer-contact-links.ts','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const getContact=n=>contactSource.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===n)?.getText(contactSource);
const code=['const OWNER_EMAIL="qa-owner@example.invalid";',getContact('usableCustomerPhone'),getContact('usableCustomerEmail'),get('authorized'),get('readCustomerRequest'),get('GET'),get('PATCH'),'exports.run={GET,PATCH}'].join('\n');
assert.ok(code.includes('GET(')&&code.includes('PATCH('),'Could not extract actual customer route source');
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const rows=new Map([['first',{id:'first',name:'Original',email:'first@example.invalid',phone:'9185550100',address:'123 Synthetic',leadSource:'Referral',createdAt:'2026-10-29T00:00:00Z'}],['second',{id:'second',name:'Other',email:'other@example.invalid',phone:'9185550101',address:'555 Synthetic',leadSource:'Google',createdAt:'2026-10-29T00:00:00Z'}]]);
let writes=0,reads=0,authorized=true,throwAfterWrite=false,skipNextUpdate=false,throwAfterUpdate=false,distortNextReadback=false,missingNextReadback=false;
const ctx={exports:{},require,Response,URL,Date,crypto,customerNumberingReady,customerNumberForCustomer,
  getChatGPTUser:async()=>authorized?{email:'qa-owner@example.invalid'}:null,
  env:{DB:{prepare(sql){return {bind(...values){
    return {
      async first(){
        reads++;
        if(sql.includes('SELECT id FROM customers'))return rows.has(values[0])?{id:values[0]}:null;
        if(/FROM customers(?: c)? WHERE (?:c\.)?id=\? LIMIT 1/.test(sql)) {
          if(throwAfterWrite){throwAfterWrite=false;throw Error('Synthetic lost readback after commit');}
          if(missingNextReadback){missingNextReadback=false;return null;}
          const saved=rows.get(values[0])??null;
          if(distortNextReadback&&saved){distortNextReadback=false;return {...saved,name:'Stale response, not stored row'};}
          return saved;
        }
        throw Error('Unexpected read ' + sql.slice(0,65));
      },
      async all(){
        reads++;
        assert.ok(sql.includes('WHERE id<>?'));
        return {results:[...rows.values()].filter(z=>z.id!==values[0])};
      },
      async run(){
        assert.ok(sql.startsWith('UPDATE customers SET'));
        writes++;
        if(skipNextUpdate){skipNextUpdate=false;return {success:true,meta:{changes:0}};}
        const [name,email,phone,address,leadSource,id]=values;
        if(!rows.has(id))throw Error('Missing record');
        rows.set(id,{...rows.get(id),name,email:email??'',phone:phone??'',address:address??'',leadSource});
        if(throwAfterUpdate){throwAfterUpdate=false;throw Error('Synthetic lost UPDATE acknowledgement after commit');}
        return {meta:{changes:1}};
      }
    };
  }};}}}
};
vm.runInNewContext(js,ctx);
const {GET,PATCH}=ctx.exports.run;
const request=(method,body)=>new Request('https://qa.invalid/api/customers',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
let tests=0;
const eq=(a,b,m)=>{assert.equal(a,b,m);tests++;};
const patch=async fields=>PATCH(request('PATCH',{id:'first',...rows.get('first'),...fields}));
const read=async id=>GET(new Request('https://qa.invalid/api/customers?confirmEdit='+encodeURIComponent(id)));
authorized=false;
let result=await read('first');eq(result.status,401,'Unauthenticated readback denied');eq(reads,0,'Unauthenticated request read nothing');
authorized=true;
result=await read('first');eq(result.status,200,'Authenticated existing customer returned');eq((await result.json()).customer.id,'first');eq(writes,0,'Readback never writes');
result=await read('missing');eq(result.status,404,'Unknown customer not found');
result=await read('');eq(result.status,400,'Empty id rejected');
const before=writes;
result=await patch({email:'invalid-email'});eq(result.status,400,'Malformed email rejected before saving');
result=await patch({phone:'not-a-phone'});eq(result.status,400,'Malformed phone rejected before saving');
eq(writes,before,'Invalid contacts never write');
result=await patch({email:'other@example.invalid'});eq(result.status,409,'Duplicate email blocks update');
eq((await result.json()).error.includes('email'),true,'Duplicate conflict names email');
result=await patch({phone:'(918) 555-0101'});eq(result.status,409,'Duplicate phone blocks update');
eq((await result.json()).error.includes('phone number'),true,'Duplicate conflict names phone');
eq(writes,before,'Rejected contacts have no writes');
result=await patch({phone:'9185550134'});eq(result.status,200,'Unique contact can be saved');
eq((await result.json()).customer.phone,'9185550134','Response returns saved exact contact');
eq(writes,before+1,'Exactly one update');
result=await read('first');eq((await result.json()).customer.phone,'9185550134','Readback sees newest saved field');
eq(writes,before+1,'Confirmation GET never writes');
throwAfterWrite=true;
result=await patch({name:'Already committed; reply lost'});eq(result.status,503,'Lost readback must NOT claim edit success');
eq((await result.json()).saveUncertain,true,'Unconfirmed write has explicit recovery flag');
eq(writes,before+2,'Update was already committed despite uncertain response');
result=await read('first');eq(result.status,200,'GET can recover committed edit');
eq((await result.json()).customer.name,'Already committed; reply lost','Recovery reports authoritative saved fields');
eq(writes,before+2,'Recovery does not resend update');
// A nonthrowing D1 result with zero changes must not convert the pre-edit
// customer into a false successful save.
skipNextUpdate=true;
result=await patch({address:'999 Not Actually Saved'});
eq(result.status,503,'Silent nonwrite fails before claiming success');
eq((await result.json()).saveUncertain,true,'Silent nonwrite marks uncertain');
eq(rows.get('first').address,'123 Synthetic','Failed UPDATE leaves original address');
// An UPDATE may commit but return a broken/stale or missing result; the owner
// must re-read it rather than trusting a mismatched response.
distortNextReadback=true;
result=await patch({leadSource:'Yelp'});
eq(result.status,503,'Mismatched readback blocks false customer success');
eq(rows.get('first').leadSource,'Yelp','Actual persisted value is preserved');
missingNextReadback=true;
result=await patch({address:'444 Confirm Later'});
eq(result.status,503,'Missing authoritative row blocks success');
eq((await read('first')).status,200,'Independent GET recovers after missing post-PATCH row');
throwAfterUpdate=true;
result=await patch({name:'Ack Lost But Confirmed'});
eq(result.status,200,'Confirmed committed data is success even if UPDATE ACK was lost');
eq((await result.json()).customer.name,'Ack Lost But Confirmed','Authoritative readback, never guessed value');
eq(result.headers.get('cache-control'),'no-store, private','Saved customer receipt must not cache');
result=await patch({phone:'',email:''});
eq(result.status,200,'Clearing phone/email to blank is a supported edit');
const cleared=(await result.json()).customer;
eq(cleared.phone,'');eq(cleared.email,'');
authorized=false;
const beforeDeniedWrites=writes;
eq((await patch({name:'Forbidden'})).status,401,'Nonowner cannot PATCH customer');
eq(writes,beforeDeniedWrites,'Nonowner never touches D1');
console.log('PASS: '+tests+' real customer API source checks; confirmed success, silent no-write, stale/missing readback, lost ACK, nullable fields and owner-only controls; synthetic rows only.');
