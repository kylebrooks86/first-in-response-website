"use client";
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';

type Entry={value:unknown;checkedAt:string;bytes:number};
/** Transient verified reads only. No disk, service worker, outbox or financial writes.
 * Each authenticated Dashboard owns a separate cache; unmount/reload discards it.
 */
export function createOwnerJobSnapshots(){
 const entries=new Map<string,Entry>();let bytes=0,revoked=false;
 const key=(kind:'report'|'costs',job:string,customer:string|undefined)=>
  ['report','costs'].includes(kind)&&[job,customer].every(id=>typeof id==='string'&&id.trim()&&id.length<=200)?JSON.stringify([kind,job,customer]):null;
 const forget=(kind:'report'|'costs',job:string,customer:string|undefined)=>{const k=key(kind,job,customer);if(k===null)return;const old=entries.get(k);if(old){bytes-=old.bytes;entries.delete(k);}};
 return {
  remember(kind:'report'|'costs',job:string,customer:string|undefined,value:unknown){
   const k=key(kind,job,customer);if(revoked||k===null)return;const text=JSON.stringify(value);if(typeof text!=='string')return;const size=new TextEncoder().encode(text).length;
   // Refuse an oversized new read without misrepresenting it as cached.
   forget(kind,job,customer);if(size>256*1024)return;
   while(entries.size>=100||bytes+size>2*1024*1024){const first=entries.keys().next().value;if(first===undefined)break;bytes-=entries.get(first)!.bytes;entries.delete(first);}
   entries.set(k,{value:JSON.parse(text),checkedAt:new Date().toISOString(),bytes:size});bytes+=size;
  },
  read<T>(kind:'report'|'costs',job:string,customer:string|undefined):{value:T;checkedAt:string}|null{
   const k=key(kind,job,customer);if(revoked||k===null)return null;const entry=entries.get(k);
   return entry?{value:structuredClone(entry.value) as T,checkedAt:entry.checkedAt}:null;
  },
  forget,
  revoke(){revoked=true;entries.clear();bytes=0;},
 };
}
export type OwnerJobSnapshotAccess={records:ReturnType<typeof createOwnerJobSnapshots>;online:boolean;networkEpoch:number};
const Context=createContext<OwnerJobSnapshotAccess|undefined>(undefined);
export function OwnerJobSnapshotsProvider({children}:{children:ReactNode}){
 const records=useMemo(()=>createOwnerJobSnapshots(),[]);
 const [connection,setConnection]=useState({online:true,networkEpoch:0});
 useEffect(()=>{
  const update=()=>{const online=navigator.onLine!==false;setConnection(current=>current.online===online?current:{online,networkEpoch:current.networkEpoch+(online?0:1)});};update();
  window.addEventListener('online',update);window.addEventListener('offline',update);
  return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};
 },[]);
 // Records are owned solely by this mounted provider and become unreachable
 // on unmount. Never put them or a decryption key in browser persistence.
 return <Context.Provider value={{records,...connection}}>{children}</Context.Provider>;
}
export const useOwnerJobSnapshots=()=>useContext(Context);
