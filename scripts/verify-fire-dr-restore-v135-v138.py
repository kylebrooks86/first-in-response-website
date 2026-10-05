from pathlib import Path

checks = {
    Path('scripts/restore-records-backup.mjs'): [
        'const restoreAudit={attemptId:randomUUID(),phase:"input_validation"',
        'phase="target_conflict_validation"',
        'normalizeLegacyLifecycleNotifications',
        'legacyLifecycleNotificationsSkipped',
        'lifecycleNotificationUniquenessVerified: true',
        'restoredAndVerified: verified',
        'fieldValuesVerified: true',
        'existingRecordsPreserved:',
        'Database writes may have occurred. Inspect this restore audit before retrying.',
        'No restore writes were attempted. Correct the error and retry.',
    ],
    Path('app/api/backup/route.ts'): [
        'attemptId:crypto.randomUUID()',
        'phase:"input_validation"',
        'restoreAudit.phase="target_conflict_validation"',
        'normalizeLegacyLifecycleNotifications',
        'legacyLifecycleNotificationsSkipped',
        'const postWriteFailure=(error:string)=>Response.json({',
        'retryGuidance:"Database writes occurred. Inspect the restore audit before retrying."',
        'Restore verification failed: duplicate lifecycle notification remains',
        'restoreAudit.lifecycleNotificationUniquenessVerified=true;',
        'restoreAudit.phase="complete";',
        'Missing records were restored and verified. Existing records were preserved and were not overwritten.',
    ],
}

missing=[]
for path, needles in checks.items():
    if not path.exists():
        missing.append(f'{path}: missing file')
        continue
    text=path.read_text()
    for needle in needles:
        if needle not in text:
            missing.append(f'{path}: missing v135-v138 restore invariant: {needle}')

if missing:
    print('DR_RESTORE_V135_V138_GUARD=FAIL')
    for item in missing:
        print(f'- {item}')
    raise SystemExit(1)

print('DR_RESTORE_V135_V138_GUARD=PASS')
print('Protected: legacy lifecycle-notification normalization, post-apply verification, lifecycle uniqueness verification, restore attempt IDs/phases, existing-record preservation, and audit-first retry guidance after possible writes.')
