"""Build review-only target migration packages; never connect to a database."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'release/property-upgrade'
def digest(data):return hashlib.sha256(data).hexdigest()
def build():
 manifest={'format':'fire-property-upgrade-review','version':1,'sourceCheckpoint':'25c9bdef8d062d58a8df89bef4d8b198cd8f3a74','executionAuthorized':False,'productionReady':False,'targets':{}}
 for target in ['live','doomsday','staging']:
  baseline=sorted((ROOT/'adapters'/target/'drizzle').glob('*.sql'))
  numbers=[int(p.name[:4]) for p in baseline]
  if numbers!=list(range(len(baseline))):raise ValueError('Non-contiguous baseline: '+target)
  directory=OUT/target;directory.mkdir(parents=True,exist_ok=True)
  planned=[]
  for offset,(source,suffix) in enumerate([('candidate-service-locations.sql','property_service_locations'),('candidate-customer-properties.sql','customer_properties')]):
   name=f'{len(baseline)+offset:04d}_{suffix}.sql';data=(ROOT/'shared/db'/source).read_bytes();(directory/name).write_bytes(data)
   planned.append({'name':name,'path':target+'/'+name,'sha256':digest(data),'bytes':len(data),'source':'shared/db/'+source})
  manifest['targets'][target]={'baseline':[{'name':p.name,'sha256':digest(p.read_bytes())} for p in baseline],'planned':planned,'existingJournalModified':False,'historicalBackfill':False,'remoteSchemaVerified':False,'remoteJournalVerified':False}
 OUT.mkdir(parents=True,exist_ok=True);(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 return manifest
if __name__=='__main__':
 m=build();print(json.dumps({t:{'baseline':len(v['baseline']),'planned':[p['name'] for p in v['planned']]} for t,v in m['targets'].items()},indent=2))
