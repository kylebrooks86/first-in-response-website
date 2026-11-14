/**
 * FIRE DR asset-upload-session bypass candidate: serve ONLY exact precompiled
 * QA-master client asset bytes from ordinary Worker Data modules.
 * No R2, KV, paid subscription, third-party origins or provider calls.
 * Unlisted paths are delegated to the original SSR Worker, never rewritten.
 */
const TYPES=Object.freeze({
 '.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8',
 '.html':'text/html; charset=utf-8',
 '.svg':'image/svg+xml',
 '.png':'image/png',
 '.jpg':'image/jpeg',
 '.jpeg':'image/jpeg',
 '.webp':'image/webp',
 '.ico':'image/x-icon',
 '.json':'application/json; charset=utf-8',
 '.woff2':'font/woff2',
 '.wasm':'application/wasm'
});
export function assetContentType(path){
 const ext=/\.[a-z0-9]+$/.exec(path)?.[0];
 const type=TYPES[ext];
 if(!type)throw Error('FIRE DR assetless BLOCKED: unsupported client MIME '+path);
 return type;
}
const blockedPath=p=>p.startsWith('/_next/static/')||p.startsWith('/fire-offline/');
export function serveBundledAsset(request,manifest){
 if(!request||typeof request.url!=='string'||!manifest||typeof manifest!=='object')
  throw Error('FIRE DR assetless BLOCKED: malformed request or asset manifest');
 let path;
 try{path=new URL(request.url).pathname}catch{return new Response('Invalid URL',{status:400})}
 // No decoding, traversal, directory indexes, dotfiles or ambiguous URL forms.
 if(!path.startsWith('/')||path.includes('%')||path.includes('\\')||
    path.includes('/.')||path.includes('//')){
  return blockedPath(path)?new Response('Not Found',{status:404}):null;
 }
 if(!Object.hasOwn(manifest,path)){
  return blockedPath(path)?new Response('Not Found',{status:404}):null;
 }
 const asset=manifest[path];
 if(!asset||!(asset.data instanceof ArrayBuffer||ArrayBuffer.isView(asset.data))||
    typeof asset.type!=='string')
  throw Error('FIRE DR assetless BLOCKED: invalid immutable compiled asset');
 if(request.method!=='GET'&&request.method!=='HEAD')
  return new Response('Method Not Allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 const headers=new Headers({
  'Content-Type':asset.type,
  'X-Content-Type-Options':'nosniff',
  'Cache-Control':path.startsWith('/_next/static/')?
    'public, max-age=31536000, immutable':'private, max-age=0, must-revalidate'
 });
 return new Response(request.method==='HEAD'?null:asset.data,{status:200,headers});
}
export function wrapInertDRWorker(server,manifest){
 if(!server||typeof server.fetch!=='function')throw Error('FIRE DR assetless BLOCKED: SSR Worker missing');
 return Object.freeze({
  async fetch(request,env,ctx){
   // No real ASSETS resource, R2 or KV binding is expected or permitted.
   if(env?.ASSETS!==undefined)
    return new Response('Unexpected cloud assets binding',{status:503});
   const direct=serveBundledAsset(request,manifest);
   if(direct)return direct;
   const ASSETS={
    fetch(input){
     const assetRequest=input instanceof Request?input:new Request(input);
     return Promise.resolve(serveBundledAsset(assetRequest,manifest)||
       new Response('Not Found',{status:404}));
    }
   };
   return server.fetch(request,{...env,ASSETS},ctx);
  }
 });
}
