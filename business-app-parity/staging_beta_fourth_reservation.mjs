// Private Windows bridge primitives for the STAGING beta uploader.
// No CLI entrypoint; importing this module never contacts Cloudflare or reads secrets.
import {openSync,closeSync,writeFileSync,existsSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {PIN} from './staging_beta_version_binding_contract.mjs';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/scripts/'+PIN.worker;
const need=(ok,code)=>{if(!ok)throw Error('STAGING_PRIVATE_BRIDGE_STOP_'+code)};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export function createFourthReservation(privateDir){
 const root=resolve(privateDir);
 need(lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink(),'PRIVATE_ROOT');
 for(const name of ['g404-one-inactive-version-attempt-20261122.lock','g404-new-inactive-version-attempt-20261123.lock','g404-new-inactive-version-attempt-20261125-reviewed.lock']){
  const p=join(root,name);need(existsSync(p)&&lstatSync(p).isFile()&&!lstatSync(p).isSymbolicLink(),'HISTORY');
 }
 const lock=join(root,'g404-new-inactive-version-attempt-20261126-dedicated-token.lock');
 need(!existsSync(lock),'FOURTH_ALREADY_SPENT_NO_RETRY');
 return intent=>{
  need(intent?.workerId===PIN.workerId&&intent.predecessor===PIN.version&&intent.activation===false&&intent.stripeMode==='disabled'&&/^[a-f0-9]{64}$/.test(intent.receiptPin??''),'INTENT');
  let fd;
  try{fd=openSync(lock,'wx',0o600);writeFileSync(fd,JSON.stringify({worker:PIN.worker,receiptPin:intent.receiptPin,reserved:true,noRetry:true}));return true}
  catch{throw Error('STAGING_PRIVATE_BRIDGE_STOP_RESERVATION_NO_RETRY')}
  finally{if(fd!==undefined)closeSync(fd)}
 };
}
export {createPrivateReaders} from './staging_beta_private_bridge.mjs';
