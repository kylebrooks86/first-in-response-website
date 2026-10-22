"""Explicit READ-ONLY QA identity snapshot; no SQL, migration or publication.

Reuses the guarded updater's pinned CLI, isolated account config and identity
policy. Default is a no-op. Output stays private and is still untrusted offline
metadata, never independent provider proof or migration/deployment approval.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import qa_guarded_update as guard
from qa_evidence_intake import PROVIDER_FORMAT


class IdentityOnlyProvider(guard.Provider):
    def call(self,args,*,json_output=True):
        allowed=[['d1','list','--json'],['deployments','status','--name',guard.qa.WORKER,'--json'],
                 ['versions','view',guard.qa.ACTIVE_VERSION,'--name',guard.qa.WORKER,'--json']]
        guard.require(args in allowed and json_output is True,'IDENTITY_ONLY_COMMAND_REFUSED')
        return super().call(args,json_output=True)


def sanitized(snapshot):
    guard.validate_provider_identity(snapshot['inventory'],snapshot['deployment'],snapshot['version'])
    inventory=sorted([{'name':r['name'],'uuid':r['uuid']} for r in snapshot['inventory']
                      if r['uuid'] in (guard.qa.UUID,guard.qa.PROTECTED_UUID)],key=lambda r:r['uuid'])
    bindings=[]
    for binding in snapshot['version']['resources']['bindings']:
        row={'name':binding['name'],'type':binding['type']}
        if binding['type']=='d1':row['id']=binding['id']
        bindings.append(row)
    return {'inventory':inventory,'deployment':{'versions':[{'version_id':v['version_id'],'percentage':v['percentage']} for v in snapshot['deployment']['versions']]},
            'version':{'id':snapshot['version']['id'],'resources':{'bindings':sorted(bindings,key=lambda b:b['name'])}}}


def capture(evidence_path,capture_path,candidate,output,*,provider_factory=IdentityOnlyProvider,now=None):
    for path in (evidence_path,capture_path,output):guard.require(Path(path).suffix.lower()=='.json','METADATA_JSON_FILE_REQUIRED')
    evidence=guard.read_json(evidence_path);guard.read_json(capture_path)
    guard.require(type(evidence) is dict and isinstance(evidence.get('accountId'),str) and re.fullmatch(r'[0-9a-f]{32}',evidence['accountId']),'ACCOUNT_PIN_REQUIRED')
    schema=guard.capture_review.evaluate(capture_path)
    guard.require(schema['original23SchemaMetadataMatches'] is True,'ORIGINAL_SCHEMA_DRIFT')
    guard.require(schema['captureSha256']==evidence.get('captureSha256'),'CAPTURE_HASH_DIFFERS')
    evidence_hash=guard.file_hash(evidence_path);build=guard.build_identity(candidate)
    destination=Path(output).absolute()
    guard.require(not destination.exists() and not any(guard.linked(p) for p in (destination,*destination.parents)),'RECEIPT_COLLISION_OR_LINK')
    guard.require(guard.REPO not in destination.parents and destination.parent.is_dir(),'RECEIPT_MUST_BE_PRIVATE_OUTSIDE_REPO')
    # Reserve before authentication/reads; never overwrite a prior capture or retry it.
    with os.fdopen(os.open(destination,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w',encoding='utf-8') as stream:
        stream.write('{"result":"STARTED_IDENTITY_READ_NOT_COMPLETED"}\n');stream.flush()
        try:
            with tempfile.TemporaryDirectory(prefix='fire-qa-identity-only-') as folder:
                provider=provider_factory(evidence['accountId'],folder,candidate)
                before=sanitized(provider.identity_snapshot())
                after=sanitized(provider.identity_snapshot())
                guard.require(before==after,'IDENTITY_CHANGED_DURING_CAPTURE')
            guard.require(guard.file_hash(evidence_path)==evidence_hash and guard.file_hash(capture_path)==schema['captureSha256'],'CAPTURE_INPUT_CHANGED')
            guard.require(guard.build_identity(candidate)==build,'BUILD_CHANGED_DURING_IDENTITY_CAPTURE')
            stamp=now or datetime.now(timezone.utc)
            guard.require(guard.utc(schema['captureUtc'])<=stamp,'IDENTITY_TIME_PRECEDES_CAPTURE')
            packet={'format':PROVIDER_FORMAT,'accountId':evidence['accountId'],
                    'capturedAt':stamp.isoformat(),
                    'qaWorker':guard.qa.WORKER,'qaDatabase':guard.qa.NAME,'qaUuid':guard.qa.UUID,
                    'captureSha256':schema['captureSha256'],**after}
            encoded=json.dumps(packet,indent=2)
            guard.require(len(encoded.encode())<=guard.MAX_BYTES,'PROVIDER_OUTPUT_LIMIT')
            stream.seek(0);stream.truncate();stream.write(encoded+'\n')
        except Exception:
            stream.seek(0);stream.truncate();stream.write('{"result":"STOP_IDENTITY_READ_INCOMPLETE_NO_WRITES_AUTHORIZED"}\n');raise
    return {'result':'READ_ONLY_PROVIDER_METADATA_CAPTURED_NOT_INDEPENDENT_PROOF',
            'providerProvenanceIndependentlyVerified':False,'hostedMigrationAuthorized':False,'publicationAuthorized':False}


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--capture',action='store_true')
    for name in ('evidence','capture-file','candidate','output'):p.add_argument('--'+name,type=Path)
    args=p.parse_args(argv)
    try:
        if not args.capture:
            guard.require(not any((args.evidence,args.capture_file,args.candidate,args.output)),'EXPLICIT_CAPTURE_FLAG_REQUIRED')
            print('DRY RUN: no provider calls, file writes or database access. Explicit --capture required.');return 0
        guard.require(all((args.evidence,args.capture_file,args.candidate,args.output)),'ALL_IDENTITY_CAPTURE_INPUTS_REQUIRED')
        print(json.dumps(capture(args.evidence,args.capture_file,args.candidate,args.output),indent=2));return 0
    except (ValueError,TypeError,KeyError,OSError,RuntimeError,OverflowError,AttributeError,guard.subprocess.SubprocessError):
        error=sys.exc_info()[1];code=str(error) if isinstance(error,guard.Stop) and re.fullmatch(r'[A-Z0-9_]+',str(error)) else 'IDENTITY_CAPTURE_INPUT_OR_PROVIDER_REFUSED'
        print('FIRE_QA_IDENTITY_STOP: '+code,file=sys.stderr);return 2

if __name__=='__main__':raise SystemExit(main())
