/** 
 * FIRE independent DR/NEW LIVE D1: fixed source-reviewed Git blob SHA-1 pins.
 * Recorded against the existing candidate's 26 exact SQL blobs on 2026-11-13.
 * A newly edited migration requires explicit source review and a deliberate
 * update of its corresponding independent pin; two edited copies agreeing
 * with one another is NOT sufficient release proof.
 * No provider access, SQL execution, secrets, or authorization.
 */
import {createHash} from 'node:crypto';

export const REVIEWED_INDEPENDENT_D1_SQL_BLOBS=Object.freeze([
  Object.freeze({name:'0000_wise_namora.sql',gitBlobSha1:'6fe91db0c425c7af3160211278153acc720aa05a'}),
  Object.freeze({name:'0001_elite_cammi.sql',gitBlobSha1:'e807e23c29b428366bcf281f2b63ea0cf2ba2efb'}),
  Object.freeze({name:'0002_tearful_ink.sql',gitBlobSha1:'2e1da24c23cab7271d2183c66f94534af508628b'}),
  Object.freeze({name:'0003_absent_dracula.sql',gitBlobSha1:'b4cdefd5fb1b2a3526027d6c7b0bc52f1896c675'}),
  Object.freeze({name:'0004_volatile_fenris.sql',gitBlobSha1:'406dc8b47511f4d4938e2700638f2aade46bd558'}),
  Object.freeze({name:'0005_unknown_king_cobra.sql',gitBlobSha1:'ea58cc5fa8fe24acdce87f5c38dcc7e830598e8b'}),
  Object.freeze({name:'0006_open_solo.sql',gitBlobSha1:'f05fdb817400f4f04c6abfaa4c42a3489d323fdb'}),
  Object.freeze({name:'0007_open_bloodaxe.sql',gitBlobSha1:'a1a9cf381d5d71368fc3bbdbad75028f4f32fbe4'}),
  Object.freeze({name:'0008_typical_tomorrow_man.sql',gitBlobSha1:'773696b06f18e767ece661cfe94cee91f08cd8ba'}),
  Object.freeze({name:'0009_spicy_micromax.sql',gitBlobSha1:'bb9d794f23bb036359e700197d12a4d67f981f1d'}),
  Object.freeze({name:'0010_discount_mode.sql',gitBlobSha1:'af66be4021276149cb75db53943084b46c98aceb'}),
  Object.freeze({name:'0011_editable_invoices.sql',gitBlobSha1:'59e0bf1a3cd2b07e5f06d713c48f7d5173d79e73'}),
  Object.freeze({name:'0012_invoice_revisions.sql',gitBlobSha1:'db700b2609f543a497b2ed0ce247c9db3aaf87cf'}),
  Object.freeze({name:'0013_checkout_sessions.sql',gitBlobSha1:'50e9f90335b225e6f7a2bd7d83939b688cc23c20'}),
  Object.freeze({name:'0014_notification_resolution.sql',gitBlobSha1:'e59a4270ab9ba3779120384285b3f0b8288fe526'}),
  Object.freeze({name:'0015_single_open_checkout.sql',gitBlobSha1:'904da8dde374eb2ec722f20b84f0b8c8564b42d0'}),
  Object.freeze({name:'0016_notification_resolution_note.sql',gitBlobSha1:'29255ce812bbef926b77a510fc7bda7a4ea49b0f'}),
  Object.freeze({name:'0017_one_invoice_per_estimate.sql',gitBlobSha1:'138c56c30a4267790f015f3710c1ee5a944a2368'}),
  Object.freeze({name:'0018_payment_refunds.sql',gitBlobSha1:'7c117a31e82849a40676b860f564d6bd9f94d57b'}),
  Object.freeze({name:'0019_refund_ledger_unique.sql',gitBlobSha1:'02903910851d495ae72d264c4ab6ecb0e1cf3f4e'}),
  Object.freeze({name:'0020_notification_lifecycle_unique.sql',gitBlobSha1:'e7ffba84306ce939e7f1da7ebd30fb56579943c0'}),
  Object.freeze({name:'0021_manual_processing_fees.sql',gitBlobSha1:'bcd94bcab354e7d6566e95b367c08e2b7d53f0a3'}),
  Object.freeze({name:'0022_stripe_provider_uniqueness.sql',gitBlobSha1:'da0f5382947984da5036273e87bbbbe9bdcb43a6'}),
  Object.freeze({name:'0023_deposit_policy_events.sql',gitBlobSha1:'0b3d257ebec85e7e1abefa39051e5f808b844cc0'}),
  Object.freeze({name:'0024_deposit_agreement_snapshots.sql',gitBlobSha1:'01d8405e7d44dbf0924ab819fbf82d7f9165fa8d'}),
  Object.freeze({name:'0025_independent_permanent_numbers.sql',gitBlobSha1:'a6147fb9ac22eb35a68628afd2495b6cc07be77b'}),
]);
const fail=reason=>{throw Error('FIRE independent D1 reviewed SQL source BLOCKED: '+reason);};

/** Matches canonical Git's content-addressed blob object, not a hash
 * freshly minted from the unreviewed workspace itself. */
export function gitSqlBlobSha1(bytes){
 if(!Buffer.isBuffer(bytes))fail('SQL content must be raw bytes');
 return createHash('sha1')
  .update(Buffer.from('blob '+bytes.length,'utf8'))
  .update(Buffer.from([0]))
  .update(bytes)
  .digest('hex');
}

export function assertReviewedIndependentD1SqlBlobs(files){
 if(!Array.isArray(files)||files.length!==REVIEWED_INDEPENDENT_D1_SQL_BLOBS.length)
  fail('exact 26 reviewed SQL blobs required');
 for(let i=0;i<REVIEWED_INDEPENDENT_D1_SQL_BLOBS.length;i++){
  const expected=REVIEWED_INDEPENDENT_D1_SQL_BLOBS[i];
  const received=files[i];
  if(!received||received.name!==expected.name||
     gitSqlBlobSha1(received.bytes)!==expected.gitBlobSha1)
   fail('reviewed SQL identity changed at migration '+expected.name);
 }
 return true;
}
