/** Bounded public basemap bytes only; never stores customer records. */
import type {StyleSpecification} from 'maplibre-gl';
import {LOCAL_CUSTOMER_DEPLOYMENT} from '../app/local-customer-deployment';
export const OFFLINE_MAP_MAX_BYTES=8*1024*1024,OFFLINE_MAP_MAX_TILES=200;
export type OfflineMapPack={version:1;id:string;target:string;createdAt:string;center:{lat:number;lng:number};bytes:number;tiles:Record<string,ArrayBuffer>;glyphs:ArrayBuffer};
const dbName='fire-public-offline-map:'+LOCAL_CUSTOMER_DEPLOYMENT;
export function offlineTilePlan(center:{lat:number;lng:number}){
 if(!Number.isFinite(center.lat)||!Number.isFinite(center.lng)||Math.abs(center.lat)>80||Math.abs(center.lng)>180)throw Error('Choose a valid map area.');
 const result:{z:number;x:number;y:number}[]=[];
 for(let z=8;z<=14;z++){
  const n=2**z,x=(lng:number)=>Math.floor((lng+180)/360*n),y=(lat:number)=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);
  for(let a=x(center.lng-.035);a<=x(center.lng+.035);a++)for(let b=y(center.lat+.035);b<=y(center.lat-.035);b++)result.push({z,x:((a%n)+n)%n,y:Math.min(n-1,Math.max(0,b))});
 }
 if(result.length>OFFLINE_MAP_MAX_TILES)throw Error('Area is too large. Choose a smaller neighborhood.');return result;
}
export function validOfflineMapPack(value:unknown):value is OfflineMapPack{
 if(!value||typeof value!=='object')return false;const p=value as OfflineMapPack;
 if(p.version!==1||p.target!==LOCAL_CUSTOMER_DEPLOYMENT||typeof p.id!=='string'||!/^[-a-f0-9]{36}$/.test(p.id)||!Number.isFinite(Date.parse(p.createdAt))||!p.center||!p.tiles||typeof p.tiles!=='object'||Array.isArray(p.tiles)||!(p.glyphs instanceof ArrayBuffer)||p.glyphs.byteLength===0)return false;
 try{const plan=offlineTilePlan(p.center),keys=plan.map(t=>`${t.z}/${t.x}/${t.y}`);if(Object.keys(p.tiles).length!==keys.length||keys.some(k=>!(p.tiles[k] instanceof ArrayBuffer)))return false;const bytes=p.glyphs.byteLength+Object.values(p.tiles).reduce((n,b)=>n+b.byteLength,0);return bytes===p.bytes&&bytes<=OFFLINE_MAP_MAX_BYTES;}catch{return false;}
}
async function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore('packs');r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Close other FIRE windows before saving a map.'));r.onsuccess=()=>resolve(r.result);});}
export async function readOfflineMapPack():Promise<OfflineMapPack|null>{const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('packs'),r=tx.objectStore('packs').get('active');r.onsuccess=()=>{const p=r.result as OfflineMapPack|undefined;if(!p)return resolve(null);if(!validOfflineMapPack(p))return reject(Error('Saved map needs to be downloaded again.'));resolve(p);};r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function saveOfflineMapPack(pack:OfflineMapPack){if(!validOfflineMapPack(pack))throw Error('Incomplete map pack. The previous map is kept.');const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('packs','readwrite');tx.objectStore('packs').put(pack,'active');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(Error('Map save failed. Your previous map is kept.'));tx.onerror=()=>{};});}finally{db.close();}}
export async function downloadOfflineMapPack(center:{lat:number;lng:number},progress:(done:number,total:number)=>void,signal?:AbortSignal){
 const plan=offlineTilePlan(center),pack:OfflineMapPack={version:1,id:crypto.randomUUID(),target:LOCAL_CUSTOMER_DEPLOYMENT,createdAt:new Date().toISOString(),center,bytes:0,tiles:{},glyphs:new ArrayBuffer(0)};
 const get=async(url:string)=>{const r=await fetch(url,{signal,cache:'no-store'});if(!r.ok)throw Error('Map download interrupted. The previous saved area is kept.');const data=await r.arrayBuffer();pack.bytes+=data.byteLength;if(pack.bytes>OFFLINE_MAP_MAX_BYTES)throw Error('This area exceeds 8 MB. No replacement map was saved.');return data;};
 // One request at a time, below the provider's four-request limit.
 pack.glyphs=await get('/api/offline-map?glyphs=1');for(let i=0;i<plan.length;i++){const t=plan[i];pack.tiles[`${t.z}/${t.x}/${t.y}`]=await get(`/api/offline-map?z=${t.z}&x=${t.x}&y=${t.y}`);progress(i+1,plan.length);}
 if(signal?.aborted)throw Error('Download canceled.');await saveOfflineMapPack(pack);return pack;
}
export function offlineStreetStyle(pack:OfflineMapPack):StyleSpecification{return{version:8,glyphs:'fire-map://'+pack.id+'/glyphs/{fontstack}/{range}.pbf',sources:{'offline-streets':{type:'vector',tiles:['fire-map://'+pack.id+'/{z}/{x}/{y}'],minzoom:8,maxzoom:14,attribution:'OpenFreeMap © OpenMapTiles © OpenStreetMap'}},layers:[{id:'offline-land',type:'background',paint:{'background-color':'#e8eadf'}},{id:'offline-water',type:'fill',source:'offline-streets','source-layer':'water',paint:{'fill-color':'#9dc9e2'}},{id:'offline-buildings',type:'fill',source:'offline-streets','source-layer':'building',minzoom:13,paint:{'fill-color':'#c8c4bd'}},{id:'offline-roads',type:'line',source:'offline-streets','source-layer':'transportation',paint:{'line-color':'#fff','line-width':['interpolate',['linear'],['zoom'],8,1,14,4,19,16]}},{id:'offline-street-names',type:'symbol',source:'offline-streets','source-layer':'transportation_name',minzoom:11,layout:{'symbol-placement':'line','text-field':['coalesce',['get','name:latin'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':12},paint:{'text-color':'#334155','text-halo-color':'#fff','text-halo-width':1}}]};}
export function offlineMapResource(pack:OfflineMapPack,url:string){const suffix=url.slice(('fire-map://'+pack.id+'/').length);if(!url.startsWith('fire-map://'+pack.id+'/'))throw Error('Offline area changed.');if(suffix.startsWith('glyphs/')){if(!suffix.endsWith('/0-255.pbf'))throw Error('This label character range is unavailable offline.');return pack.glyphs.slice(0);}const tile=pack.tiles[suffix];if(!tile)throw Error('Outside downloaded street area.');return tile.slice(0);}
