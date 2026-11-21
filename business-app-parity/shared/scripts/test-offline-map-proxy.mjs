import assert from 'node:assert/strict';import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime(),api=r.load('app/api/offline-map/route.ts');let count=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);count++;},before=globalThis.fetch,calls=[];
const privateHeaders=response=>{eq(response.headers.get('cache-control'),'private, no-store','Never cache owner tile, error or denial');eq(response.headers.get('vary'),'Cookie','Session-specific tile responses');eq(response.headers.get('x-content-type-options'),'nosniff','Block tile MIME sniffing');};
globalThis.fetch=async(url,options)=>{calls.push({url,options});if(url.endsWith('/styles/liberty'))return Response.json({sources:{openmaptiles:{url:'https://tiles.openfreemap.org/planet/test.json'}},glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'});if(url.endsWith('/test.json'))return Response.json({tiles:['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf']});return new Response(new Uint8Array([0,1,2]));};
try{
 for(const query of ['z=14&x=8192&y=8192','glyphs=1']){const response=await api.GET(new Request('https://synthetic.invalid/api/offline-map?'+query));eq(response.status,200);eq((await response.arrayBuffer()).byteLength,3);privateHeaders(response);}
 eq(calls.every(c=>c.options.headers['User-Agent'].startsWith('FIRE-Exteriors-Business-App/')),true,'All provider requests identify FIRE');eq(calls.every(c=>c.options.redirect==='error'),true,'Unexpected redirects denied');
 for(const query of ['url=https://evil.invalid','z=15&x=0&y=0','z=8&x=256&y=0','z=-1&x=0&y=0','glyphs=1&extra=1','z=8&x=0&y=0&x=1']){const response=await api.GET(new Request('https://synthetic.invalid/api/offline-map?'+query));eq(response.status,400);privateHeaders(response);}
 const used=calls.length;r.setOwner(null);const denied=await api.GET(new Request('https://synthetic.invalid/api/offline-map?glyphs=1'));eq(denied.status,401);privateHeaders(denied);eq(calls.length,used,'Unauthorized access never reaches map provider');
 // Never disclose owner map resources or contact providers when sessions fail.
 for(const [label,identity] of [
  ['malformed numeric email',{email:42}],
  ['unreadable session email',{get email(){throw Error('Synthetic identity getter failed');}}],
  ['rejected session provider',{then(_ok,reject){reject(Error('Synthetic auth gateway unavailable'));}}],
 ]){
  r.setOwner(identity);
  const providerCalls=calls.length;
  const blocked=await api.GET(new Request('https://synthetic.invalid/api/offline-map?glyphs=1'));
  eq(blocked.status,401,label+' rejected before map lookup');
  privateHeaders(blocked);
  eq(calls.length,providerCalls,label+' sent no requests to map provider');
 }
 r.setOwner({email:'kylebrooks8605@gmail.com'});
 const retry=await api.GET(new Request('https://synthetic.invalid/api/offline-map?z=14&x=8192&y=8192'));
 eq(retry.status,200,'Valid owner still receives street tiles after broken-session denials');
 privateHeaders(retry);
 console.log('PASS '+count+' offline tile-proxy owner auth, resource allowlist, zoom bounds, explicit app identity and redirect checks.');
}finally{globalThis.fetch=before;r.db.close();}
