#!/usr/bin/env python3
"""Read-only LOCAL ZIP validation. Never connects, extracts onto disk, or restores."""
import argparse, hashlib, json, re, sys, zipfile
from datetime import datetime
from pathlib import Path
MAX_BYTES=250*1024*1024
SAFE_KEY=re.compile(r'customers/[a-zA-Z0-9_-]{1,128}/[a-zA-Z0-9_-]{1,128}\.[a-zA-Z0-9]{1,8}\Z')
SAFE_ID=re.compile(r'[a-zA-Z0-9_-]{1,128}\Z')
def need(condition,message):
 if not condition:raise ValueError(message)
def validate(filename):
 with zipfile.ZipFile(filename) as z:
  entries=z.infolist();names=[i.filename for i in entries]
  need(len(names)<=65001 and len(set(names))==len(names),'Duplicate or excessive ZIP entries')
  need('manifest.json' in names,'Missing manifest')
  need(all(not n.startswith('/') and '\\' not in n and not any(p in ('..','.','') for p in n.split('/')) for n in names),'Unsafe entry path')
  need(all(not i.is_dir() and not i.flag_bits&1 and i.compress_type in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED) and i.file_size>=0 and (i.external_attr>>16)&0o170000!=0o120000 for i in entries),'Unsafe ZIP encoding or symlink')
  need(sum(i.file_size for i in entries)<=MAX_BYTES+5*1024*1024,'Archive exceeds bounded validation size')
  need(z.getinfo('manifest.json').file_size<=5*1024*1024,'Manifest exceeds size limit')
  m=json.loads(z.read('manifest.json'));need(isinstance(m,dict) and type(m.get('version')) is int,'Invalid manifest')
  if m.get('format')=='fire-app-photo-archive' and m.get('version')==1:
   photos=m.get('photos');missing=m.get('missingPhotoIds',[])
   need(isinstance(photos,list) and isinstance(missing,list),'Invalid legacy photo coverage')
   ids=[p.get('id') for p in photos];keys=[p.get('objectKey') for p in photos]
   need(all(isinstance(v,str) for v in ids+keys+missing),'Invalid legacy identities')
   need(len(set(ids))==len(ids) and len(set(keys))==len(keys) and len(set(missing))==len(missing) and set(missing)<=set(ids),'Conflicting legacy identity coverage')
   need(type(m.get('photoCount')) is int and m['photoCount']==len(photos)-len(missing),'Inconsistent legacy counts')
   matched={'manifest.json'}
   for p in photos:
    need(isinstance(p.get('customerId'),str) and SAFE_ID.fullmatch(p['customerId']) and SAFE_ID.fullmatch(p['id']) and SAFE_KEY.fullmatch(p['objectKey']) and p['objectKey'].startswith(f"customers/{p['customerId']}/{p['id']}."),'Unsafe legacy relationship')
    need(type(p.get('sizeBytes')) is int and 0<=p['sizeBytes']<=20*1024*1024 and isinstance(p.get('contentType'),str) and p['contentType'].startswith('image/'),'Invalid legacy metadata')
    matches=[n for n in names if n.startswith(f"photos/{p['customerId']}/{p['id']}-")]
    if p['id'] in missing:need(not matches,'Legacy missing-object declaration conflicts with bytes');continue
    need(len(matches)==1,'Partial or conflicting legacy byte coverage');data=z.read(matches[0]);need(len(data)==p['sizeBytes'],'Legacy photo size mismatch');matched.add(matches[0])
   need(set(names)==matched,'Unlisted legacy archive entries')
   return {'format':m['format'],'version':1,'validated':True,'declaredNamespaceCoverageValidated':False,'sourceNamespaceCoverageIndependentlyVerified':False,'cryptographicChecksumsVerified':False,'restoreExecutionAuthorized':False,'objectsValidated':len(photos)-len(missing),'warning':'Legacy referenced-only archive; missing and unreferenced files are not recovered by this validation.'}
  need(m.get('format')=='fire-app-photo-storage-archive' and m.get('version')==2,'Unsupported archive format')
  need(m.get('scope')=='customer-photo-namespace' and m.get('coverageVerified') is True and m.get('checksumAlgorithm')=='SHA-256' and m.get('atomicSnapshot') is False and m.get('requiresSeparateRecordsBackup') is True and m.get('restoreExecutionAuthorized') is False,'Unsafe coverage or execution declarations')
  photos=m.get('photos');objects=m.get('objects');customers=m.get('customerIds')
  need(isinstance(photos,list) and isinstance(objects,list) and isinstance(customers,list) and max(len(photos),len(objects),len(customers))<=5000,'Incomplete or excessive manifest coverage')
  need(all(isinstance(c,str) and SAFE_ID.fullmatch(c) for c in customers) and len(set(customers))==len(customers),'Invalid customer coverage')
  need(all(isinstance(p,dict) and isinstance(p.get('id'),str) and isinstance(p.get('objectKey'),str) for p in photos),'Invalid photo record')
  ids=[p['id'] for p in photos];keys=[p['objectKey'] for p in photos]
  need(len(set(ids))==len(ids) and len(set(keys))==len(keys),'Conflicting photo identities')
  by_key={p['objectKey']:p for p in photos};seen_keys=set();seen_paths={'manifest.json'};seen_photos=set();orphans=0
  for p in photos:
   need(set(p)=={'id','customerId','category','caption','filename','contentType','sizeBytes','objectKey','createdAt'},'Partial photo fields')
   need(SAFE_ID.fullmatch(p['id']) and p['customerId'] in customers and SAFE_KEY.fullmatch(p['objectKey']) and p['objectKey'].startswith(f"customers/{p['customerId']}/{p['id']}."),'Invalid photo ownership or key')
   need(p['category'] in ('before','after','property') and (p['caption'] is None or isinstance(p['caption'],str)) and isinstance(p['filename'],str) and isinstance(p['createdAt'],str),'Invalid photo metadata')
   datetime.fromisoformat(p['createdAt'].replace('Z','+00:00'))
   need(isinstance(p['contentType'],str) and p['contentType'].startswith('image/') and type(p['sizeBytes']) is int and 0<=p['sizeBytes']<=20*1024*1024,'Invalid photo type/size')
  for o in objects:
   need(isinstance(o,dict) and set(o)=={'objectKey','archivePath','sizeBytes','contentType','version','etag','sha256','association','photoId'},'Partial object coverage')
   key=o['objectKey'];path=o['archivePath']
   need(isinstance(key,str) and SAFE_KEY.fullmatch(key) and key not in seen_keys,'Unsafe or duplicate object key')
   need(isinstance(path,str) and re.fullmatch(r'objects/[0-9]{6}\.bin',path) and path not in seen_paths and path in names,'Missing or duplicate object entry')
   need(type(o['sizeBytes']) is int and 0<=o['sizeBytes']<=20*1024*1024 and z.getinfo(path).file_size==o['sizeBytes'],'Object size mismatch')
   need(isinstance(o['sha256'],str) and re.fullmatch(r'[0-9a-f]{64}',o['sha256']),'Invalid checksum declaration')
   need(isinstance(o['version'],str) and o['version'] and isinstance(o['etag'],str) and o['etag'],'Missing object identity')
   data=z.read(path);need(hashlib.sha256(data).hexdigest()==o['sha256'],'Object SHA-256 mismatch')
   p=by_key.get(key)
   if p:
    need(o['association']=='referenced' and o['photoId']==p['id'] and o['sizeBytes']==p['sizeBytes'] and o['contentType']==p['contentType'],'Referenced object/record conflict');seen_photos.add(p['id'])
   else:
    need(o['association']=='unreferenced' and o['photoId'] is None and (o['contentType'] is None or isinstance(o['contentType'],str)),'Unreferenced bytes cannot invent photo records');orphans+=1
   seen_keys.add(key);seen_paths.add(path)
  need(seen_photos==set(ids) and set(names)==seen_paths,'Partial or unlisted coverage')
  need(all(type(m.get(k)) is int and m[k]==v for k,v in [('objectCount',len(objects)),('photoCount',len(photos)),('unreferencedObjectCount',orphans)]),'Inconsistent archive counts')
  return {'format':m['format'],'version':2,'validated':True,'declaredNamespaceCoverageValidated':True,'sourceNamespaceCoverageIndependentlyVerified':False,'cryptographicChecksumsVerified':True,'objectsValidated':len(objects),'unreferencedObjectsPreserved':orphans,'restoreExecutionAuthorized':False,'atomicSnapshotProven':False,'warning':'Checksums prove internal archive consistency, not authenticity, hosted isolation or atomic recovery.'}
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('archive');a=ap.parse_args()
 try:print(json.dumps(validate(Path(a.archive)),indent=2));return 0
 except (ValueError,TypeError,KeyError,zipfile.BadZipFile,OSError) as e:print(json.dumps({'validated':False,'restoreExecutionAuthorized':False,'error':str(e)}));return 1
if __name__=='__main__':sys.exit(main())
