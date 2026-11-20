import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLocalAssetManifest} from './gate9_offline_asset_manifest.mjs';
import {
 offlineAssetSessionRegistration,validateSyntheticUploadSession,
 fakeSessionForAllMissing,simulateUploadBuckets,SYNTHETIC_SESSION_JWT
} from './gate9_offline_asset_session.mjs';
function fixture(){
  const temp=mkdtempSync(join(tmpdir(),'FIRE-GATE9-SYNTHETIC-ASSETS-'));
  const folder=join(temp,'dist','client');
  mkdirSync(join(folder,'_next','static'),{recursive:true});
  writeFileSync(join(folder,'_next','static','app.js'),'export const syntheticOnly = true');
  writeFileSync(join(folder,'_next','static','app.css'),'body{background:red}');
  return {temp,folder};
}
const withFixture=(fn)=>{
  const x=fixture();
  try{return fn(x.folder);}
  finally{rmSync(x.temp,{recursive:true,force:true});}
};
test('registers exact fake account+TEST script path, then simulates every asset bucket without HTTP',()=>{
  withFixture(folder=>{
    const manifest=createLocalAssetManifest(folder);
    const r=offlineAssetSessionRegistration(manifest);
    assert.match(r.path,/\/workers\/scripts\/fire-stripe-test-20261101\/assets-upload-session$/);
    assert.equal(r.method,'POST');
    const session=fakeSessionForAllMissing(manifest,1);
    const stats=validateSyntheticUploadSession(manifest,session);
    assert.equal(stats.missingUniqueAssets,2);
    const sim=simulateUploadBuckets(folder,manifest,session);
    assert.equal(sim.simulatedBuckets.length,2);
    assert.equal(sim.noRequestsSent,true);
    assert.equal(sim.noAuthorizationHeader,true);
    assert.equal(sim.uploadCompletionTokenReceived,false);
    assert(sim.simulatedBuckets.every(b=>
      b.path.endsWith('/assets/upload?base64=true') &&
      b.multipartFields.every(f=>f.fieldName.length===32 && f.contentBase64.length>4)));
  });
});
test('refuses unknown and duplicate upload hashes, malformed buckets and real token substitution',()=>{
  withFixture(folder=>{
    const m=createLocalAssetManifest(folder);
    for(const edit of [
      v=>{v.result.buckets[0][0]='0'.repeat(32);},
      v=>{v.result.buckets.push([v.result.buckets[0][0]]);},
      v=>{v.result.buckets=[[]];},
      v=>{v.result.jwt='eyJnot-synthetic';},
      v=>{v.success=false;},
      v=>{v.errors=['unauthorized'];}
    ]){
      const v=fakeSessionForAllMissing(m);
      edit(v);
      assert.throws(()=>validateSyntheticUploadSession(m,v));
    }
  });
});
test('handles zero pending assets and partial-cache reports without claiming completed upload',()=>{
  withFixture(folder=>{
    const m=createLocalAssetManifest(folder);
    const zero={success:true,result:{jwt:SYNTHETIC_SESSION_JWT,buckets:[]}};
    const stats=validateSyntheticUploadSession(m,zero);
    assert.equal(stats.cachedDistinctAssets,2);
    assert.equal(stats.completed,false);
    assert.equal(simulateUploadBuckets(folder,m,zero).uploadCompletionTokenReceived,false);
    const partial=fakeSessionForAllMissing(m);
    partial.result.buckets[0].pop();
    assert.equal(validateSyntheticUploadSession(m,partial).missingUniqueAssets,1);
  });
});
test('refuses changed bytes after registration, even when file length matches',()=>{
  withFixture(folder=>{
    const m=createLocalAssetManifest(folder);
    const s=fakeSessionForAllMissing(m);
    writeFileSync(join(folder,'_next','static','app.css'),'body{background:tan}'); // changed
    assert.throws(()=>simulateUploadBuckets(folder,m,s));
  });
});
