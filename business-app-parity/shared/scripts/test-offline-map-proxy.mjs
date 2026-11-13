import assert from 'node:assert/strict';import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime(),api=r.load('app/api/offline-map/route.ts');let count=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);count++;},before=globalThis.fetch,calls=[];
globalThis.fetch=async(url,options)=>{calls.push({url,options});if(url.endsWith('/styles/liberty'))return Response.json({sources:{openmaptiles:{url:'https://tiles.openfreemap.org/planet/test.json'}},glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'});if(url.endsWith('/test.json'))return Response.json({tiles:['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf']});return new Response(new Uint8Array([0,1,2]));};
try{
 for(const query of ['z=14&x=8192&y=8192','glyphs=1']){const response=await api.GET(new Request('https://synthetic.invalid/api/offline-map?'+query));eq(response.status,200);eq((await response.arrayBuffer()).byteLength,3);eq(response.headers.get('cache-control'),'private, no-store');}
 eq(calls.every(c=>c.options.headers['User-Agent'].startsWith('FIRE-Exteriors-Business-App/')),true,'All provider requests identify FIRE');eq(calls.every(c=>c.options.redirect==='error'),true,'Unexpected redirects denied');
 for(const query of ['url=https://evil.invalid','z=15&x=0&y=0','z=8&x=256&y=0','z=-1&x=0&y=0','glyphs=1&extra=1','z=8&x=0&y=0&x=1'])eq((await api.GET(new Request('https://synthetic.invalid/api/offline-map?'+query))).status,400);
 const used=calls.length;r.setOwner(null);eq((await api.GET(new Request('https://synthetic.invalid/api/offline-map?glyphs=1'))).status,401);eq(calls.length,used,'Unauthorized access never reaches map provider');
 console.log('PASS '+count+' offline tile-proxy owner auth, resource allowlist, zoom bounds, explicit app identity and redirect checks.');
}finally{globalThis.fetch=before;r.db.close();}
