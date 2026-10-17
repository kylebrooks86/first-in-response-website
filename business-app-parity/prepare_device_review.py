"""Seal local device-review builds. Never emits hosting configuration or publishes."""
import argparse,hashlib,json,zipfile,tempfile,shutil
from pathlib import Path

def digest(data):return hashlib.sha256(data).hexdigest()
def prepare(roots,out,checkpoint):
 if not roots or not set(roots)<=set(['live','doomsday','staging','qa']):raise ValueError('Unknown review target')
 if out.exists():raise ValueError('Refuse to overwrite a prior device review packet')
 out.parent.mkdir(parents=True,exist_ok=True)
 pending=Path(tempfile.mkdtemp(prefix='fire-device-review-',dir=out.parent))
 try:
  receipt={'format':'fire-device-candidate-review','version':1,'baseCheckpoint':checkpoint,'targets':{},'publicationAuthorized':False,'physicalDeviceAcceptance':False,'installableURL':None,'officialReadinessPercent':30,'warning':'Review artifacts only. No hosting config, credentials, database state or deployment script is included. These ZIPs cannot be installed as an iPhone app. An approved separate HTTPS runtime with verified synthetic storage/auth remains required.'}
  for target,root in roots.items():
   if root.is_symlink() or any((root/name).is_symlink() for name in ['app','lib','components','hooks','db','drizzle','public','vendor','scripts','synthetic-customers-preview','dist']):raise ValueError('Candidate roots must not be symlinks')
   for required in ['app/page.tsx','app/dashboard.tsx','app/globals.css','lib/photo-storage-archive.ts','app/api/backup/photos/storage/route.ts','dist/server/index.js','dist/server/BUILD_ID']:
    if not (root/required).is_file():raise ValueError('Current candidate input missing: '+required)
   if (root/'app/api/development/photo-fixture').exists():raise ValueError('Disposable photo inspector must be removed before packaging')
   files={}
   for directory in ['app','lib','components','hooks','db','drizzle','public','vendor','scripts','synthetic-customers-preview']:
    for p in sorted((root/directory).rglob('*')):
     if '__pycache__' in p.parts or p.suffix=='.pyc':continue
     if p.is_symlink():raise ValueError('Unexpected application symlink')
     if p.is_file():
      if p.suffix in ['.sqlite','.db','.zip'] or p.name.startswith(('.env','.dev.vars')):raise ValueError('Stored data/environment cannot enter a source review packet')
      files['source/'+p.relative_to(root).as_posix()]=p.read_bytes()
   for filename in ['package.json','pnpm-lock.yaml','tsconfig.json','next-env.d.ts','postcss.config.mjs','cloudflare-env.d.ts']:
    p=root/filename
    if p.is_symlink():raise ValueError('Source configuration must not be a symlink')
    if p.is_file():files['source/'+filename]=p.read_bytes()
   if not (root/'dist/server/BUILD_ID').is_file():raise ValueError('Build output missing')
   for p in sorted((root/'dist').rglob('*')):
    if p.is_symlink():raise ValueError('Unexpected build symlink')
    if not p.is_file():continue
    if p.name.startswith('wrangler') or p.suffix=='.map':continue
    if p.suffix in ['.sqlite','.db'] or p.name.startswith(('.env','.dev.vars')):raise ValueError('Database state or environment file cannot enter a review packet')
    files['build/'+p.relative_to(root/'dist').as_posix()]=p.read_bytes()
   if any('photo-fixture' in n for n in files):raise ValueError('Fixture route in review packet')
   fingerprint=digest(json.dumps({n:digest(data) for n,data in files.items()},sort_keys=True,separators=(',',':')).encode())
   name='FIRE_Device_Review_'+target+'_'+fingerprint[:12]+'.zip';archive=pending/name
   with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for name_in_zip,data in sorted(files.items()):z.writestr(name_in_zip,data)
   with zipfile.ZipFile(archive) as z:
    if z.testzip() is not None or any(digest(z.read(n))!=digest(data) for n,data in files.items()):raise ValueError('Review packet byte verification failed')
   receipt['targets'][target]={'archive':name,'sha256':digest(archive.read_bytes()),'fileCount':len(files),'sourceBuildFingerprint':fingerprint,'buildId':(root/'dist/server/BUILD_ID').read_text().strip(),'hostingConfigIncluded':False,'recordsIncluded':False,'publicationAuthorized':False,'fileSha256':{n:digest(data) for n,data in files.items()}}
  (pending/'DEVICE_REVIEW_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
  pending.rename(out)
  return receipt
 finally:
  if pending.exists():shutil.rmtree(pending)
def main():
 ap=argparse.ArgumentParser(description=__doc__)
 for target in ['live','doomsday','staging']:ap.add_argument('--'+target,type=Path)
 ap.add_argument('--target',choices=['live','doomsday','staging','qa'])
 ap.add_argument('--candidate',type=Path)
 ap.add_argument('--output',required=True,type=Path)
 ap.add_argument('--checkpoint',required=True)
 a=ap.parse_args()
 coordinated={t:getattr(a,t) for t in ['live','doomsday','staging'] if getattr(a,t) is not None}
 if a.target or a.candidate:
  if not a.target or not a.candidate or coordinated:ap.error('Use --target with --candidate, or all three coordinated roots; do not mix modes')
  roots={a.target:a.candidate}
 else:
  if len(coordinated)!=3:ap.error('Provide all three coordinated roots, or --target with --candidate')
  roots=coordinated
 r=prepare(roots,a.output,a.checkpoint)
 print(json.dumps({'preparedTargets':list(r['targets']),'publicationAuthorized':False,'installableURL':None}))
if __name__=='__main__':main()
