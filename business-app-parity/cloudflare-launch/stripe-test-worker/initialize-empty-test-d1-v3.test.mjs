import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('./initialize-empty-test-d1-v3.ps1',import.meta.url),'utf8');
test('v3 explicitly unwraps REST JSON response before validating complete 25 SQL files',()=>{
 for(const text of [
   '$rawDirectory = Invoke-RestMethod -Uri $api',
   "New-Object 'System.Collections.Generic.List[object]'",
   'foreach ($item in $rawDirectory)',
   'if ($item -is [System.Array])',
   'foreach ($nested in $item)',
   '[void]$entries.Add($nested)',
   '[void]$entries.Add($item)',
   '$entries.ToArray() | Where-Object',
   '$sqlFiles.Count -ne 25',
   'foreach ($n in 0..24)',
 ]) assert.ok(s.includes(text),text);
 assert.doesNotMatch(s,/\$entries = @\(Invoke-RestMethod/);
});
test('v3 only operates against the owner-approved exact new D1 and fails closed',()=>{
 for(const text of [
   'fire-stripe-test-db-20261101',
   'dba421ba-fc66-4cf8-9c31-51616f8249ba',
   'FIRE-Stripe-Test-Schema-Init-20261101-V3',
   'd1 info $expectedId --json',
   '$actualName -cne $expectedName -or $actualId -cne $expectedId',
   'if (Test-Path -LiteralPath $folder)',
   'Remote database is not pristine',
   'd1 migrations apply $expectedName --remote --config $configPath',
   'if ($LASTEXITCODE -ne 0)',
   '[int]$applied -ne 25',
   '[int]$idx -ne 1',
   '[int]$records -ne 0',
 ]) assert.ok(s.includes(text),text);
 assert.doesNotMatch(s,/fire-app-staging-db|afb2c05a-d794-4a9a-b580-924ce01c26ad|8ccfb1f8-1657-4074-b1b2-47de78f95003/);
 assert.doesNotMatch(s,/wrangler(?:\.cmd)?\s+deploy|d1\s+(?:delete|create|time-travel|import)\s+/i);
});
