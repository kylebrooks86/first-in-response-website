/** FIRE Gate7 locally saved protected pair receipt: SYNTHETIC ciphertext only.
 * No passwords, account files, customer data, SQL or provider connections.
 */
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sealProtectedPairReceipt,inspectSavedProtectedPairReceipt}
 from './protected_recovery_pair_receipt.mjs';

const root=await mkdtemp(join(tmpdir(),'fire-pair-custody-offline-'));
let checked=0;
const pass=(truth,description)=>{assert.ok(truth,description);checked++;};
const reject=async(action,description)=>{
 await assert.rejects(action,/FIRE protected recovery pair BLOCKED:|EEXIST/,description);
 checked++;
};
const fake=(magic,seed)=>{
 const result=Buffer.alloc(256,seed);
 result.write(magic,0,'ascii');
 return result;
};
try{
 const records=join(root,'saved.firerecords');
 const photos=join(root,'saved.firephotos');
 const receipt=join(root,'saved.firepair');
 const snapshotRecords=fake('FIRERB01',17);
 const snapshotPhotos=fake('FIREPX01',41);
 await writeFile(records,snapshotRecords);
 await writeFile(photos,snapshotPhotos);
 const sealed=await sealProtectedPairReceipt(records,photos,receipt);
 pass(sealed.savedPairReceiptCreated===true&&sealed.exactSavedEncryptedPairVerified===true,
  'two distinct saved synthetic opaque files have a jointly verified receipt');
 const rechecked=await inspectSavedProtectedPairReceipt(receipt,records,photos);
 pass(rechecked.protectedRecordsSha256===sealed.protectedRecordsSha256&&
      rechecked.protectedPhotosSha256===sealed.protectedPhotosSha256,
  'independent reread binds both exact ciphertext byte streams');
 await reject(sealProtectedPairReceipt(records,photos,receipt),
  'existing receipt is never overwritten');
 let modified=Buffer.from(snapshotRecords);
 modified[modified.length-1]^=0x40;
 await writeFile(records,modified);
 await reject(inspectSavedProtectedPairReceipt(receipt,records,photos),
  'same-length changed record bytes invalidate saved receipt');
 await writeFile(records,snapshotRecords);
 modified=Buffer.from(snapshotPhotos);modified[modified.length-1]^=0x20;
 await writeFile(photos,modified);
 await reject(inspectSavedProtectedPairReceipt(receipt,records,photos),
  'same-length changed photo bytes invalidate saved receipt');
 await writeFile(photos,snapshotPhotos);
 const link=join(root,'photo-link.firephotos');
 await symlink(photos,link);
 await reject(inspectSavedProtectedPairReceipt(receipt,records,link),
  'symbolic-link photo source cannot stand in for exact owner-held file');
 const raw=await readFile(receipt,'utf8');
 await writeFile(receipt,raw.replace('false','true'));
 await reject(inspectSavedProtectedPairReceipt(receipt,records,photos),
  'receipt cannot claim off-device custody or accepted gate');
 console.log('PASS '+checked+'/'+checked+
  ' synthetic encrypted-pair receipt custody tests; no cloud, SQL or owner files touched.');
}finally{
 await rm(root,{recursive:true,force:true});
}
