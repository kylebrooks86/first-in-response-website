#!/usr/bin/env python3
"""FIRE archived DR + NEW LIVE source custody. No GitHub/Drive/Cloudflare provider calls.
Usage: python verify_private_expired_source_archives.py DR_ORIGINAL DR_PREHOST LIVE_ORIGINAL LIVE_PREHOST
Historical prehost ZIPs are NEVER deployable or final DARK release candidates.
"""
from __future__ import annotations
import hashlib
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile, BadZipFile

EXPECTED = {
    'dr_original': ('f61b28b6b0f8e669f9863be995cf7d56d527a51d012ee9e77083fb260c059719', 3084259),
    'dr_prehost': ('ae3f0078b15376ed861d7c0c47e4943f88b700f528e5c65c2e8f5ae9de7761d4', 3081759),
    'live_original': ('7c701cc6401e3eba06f684db2dd5a770b4c137401224ef8aeb812d18faabaec3', 3086564),
    'live_prehost': ('b075dcf21e445c842b808f0ac560a24e36219f118fe20bb3d679d35f00003b30', 3084195),
}
DB = {
    'dr': '5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',
    'live': '0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662',
}

def require(test, why):
    if not test:
        raise ValueError('FIRE private archive BLOCKED: ' + why)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read_exact(path: Path, label):
    require(path.is_file() and not path.is_symlink(), 'missing or unsafe '+label)
    expected, length = EXPECTED[label]
    require(path.stat().st_size == length, 'wrong original saved byte size: '+label)
    raw = path.read_bytes()
    require(sha(raw) == expected, 'wrong original saved ZIP SHA256: '+label)
    try:
        with ZipFile(path) as z:
            entries = z.infolist()
            require(len(entries) == 242, 'wrong file count: '+label)
            names = [x.filename for x in entries]
            require(len(names) == len(set(names)) and all(
                not n.startswith('/') and not n.startswith('\\') and
                '\\' not in n and '..' not in n.split('/') and not n.endswith('/') and
                not n.startswith('./') and x.file_size < 20_000_000
                for n, x in zip(names, entries)), 'unsafe or duplicate ZIP path: '+label)
            require(sum(x.file_size for x in entries)<30_000_000, 'oversized extracted ZIP: '+label)
            require(z.testzip() is None, 'failed original member CRC: '+label)
            files = {name:z.read(name) for name in names}
    except (BadZipFile, OSError) as exc:
        raise ValueError('FIRE private archive BLOCKED: invalid ZIP: '+label) from exc
    return files

def verify(original, derived, target):
    base = set(original); new = set(derived); shared = base&new
    old_receipt='alternative-receipt.json'
    new_receipt='dr-physical-prehost-source-receipt.json' if target=='dr' else 'new-live-physical-prehost-source-receipt.json'
    require(base-new=={old_receipt} and new-base=={new_receipt},'unexpected parent/child file identities: '+target)
    changed={p for p in shared if original[p] != derived[p]}
    require(len(shared)==241 and changed=={'server/wrangler.json'},'unexpected changed source/module/asset: '+target)
    b=json.loads(original[old_receipt]); p=json.loads(derived[new_receipt]); c=json.loads(derived['server/wrangler.json'])
    require(b.get('assetFileCount')==41 and len(b.get('clientAssets',[]))==41,'original 41 binary assets missing: '+target)
    seen=set()
    for asset in b['clientAssets']:
        name='server/'+asset['module']
        require(re.fullmatch(r'server/fire-inline-assets/asset-\d{3}-[0-9a-f]{16}\.bin',name),
                'unsafe asset manifest member: '+target)
        require(name in original and name in derived and name not in seen, 'original module missing/duplicate: '+target)
        seen.add(name)
        require(len(original[name])==asset['bytes'] and sha(original[name])==asset['sha256'],
                'original client module hash changed: '+target)
    require(c['d1_databases']==[{'binding':'DB','database_name':'fire-fullapp-'+('dr-db' if target=='dr' else 'new-live-db'),
                                 'database_id':DB[target]}], 'wrong physical target D1: '+target)
    require(c.get('r2_buckets')==[] and c.get('assets') is None and
            c['vars'].get('FIRE_PHOTO_STORAGE_MODE')=='owner-device-zip' and
            c['vars'].get('FIRE_DR_AUTH_ENABLED' if target=='dr' else 'FIRE_NEW_LIVE_AUTH_ENABLED')=='blocked',
            'unexpected storage/auth/asset binding: '+target)
    require(p.get('workerDeployed') is False and
            p.get('firstCloudflareWorkerCreationAuthorized',
                  p.get('cloudflareFirstWorkerCreationAuthorized',
                        p.get('firstWorkerCreationAuthorized'))) is False,
            'receipt falsely claims an authorized remote deployment: '+target)
    require(c.get('workers_dev') is False if target=='live' else c.get('workers_dev') is True,
            'unexpected historical prehost URL setting: '+target)
    if target=='live':
        require(c.get('preview_urls') is False, 'NEW LIVE preview accidentally enabled')
    return {'originalMembers':len(base),'prehostMembers':len(new),'sharedFiles':len(shared),
            'identicalSharedFileBytes':len(shared)-len(changed),
            'changedFiles':sorted(changed),'clientAssetModulesHashVerified':len(seen),
            'targetD1MatchesOriginalEvidence':True,'zeroR2':True,
            'unapprovedHostedRelease':True,'notADeployableFinalCandidate':True,
            'prehostWorkersDevPublicFlag':c.get('workers_dev')}

def main(paths):
    require(len(paths)==4, 'four exact original and child saved ZIP paths required')
    names=['dr_original','dr_prehost','live_original','live_prehost']
    got={k:read_exact(Path(p),k) for k,p in zip(names,paths)}
    outcome={'mode':'OWNER_PRIVATE_OFFLINE_CUSTODY_ONLY','cloudflareProviderCalled':False,
             'originalGitHubArtifactsStillExpired':True,
             'hostedVersionVerified':False,'releaseAuthorized':False,'gatesAccepted':False,
             'dr':verify(got['dr_original'],got['dr_prehost'],'dr'),
             'newLive':verify(got['live_original'],got['live_prehost'],'live')}
    print(json.dumps(outcome,indent=2))

if __name__=='__main__':
    try:
        main(sys.argv[1:])
    except Exception as exc:
        print('FIRE PRIVATE SOURCE VERIFICATION BLOCKED: '+str(exc),file=sys.stderr)
        sys.exit(1)
