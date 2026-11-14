import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('./initialize-empty-test-d1-v2.ps1',import.meta.url),'utf8');
test('v2 first remote call uses exact physical D1 UUID, not human name',()=>{
  assert.match(script,/d1 info \$expectedId --json/);
  assert.doesNotMatch(script,/d1 info \$expectedName --json/);
  assert.match(script,/\$actualName -cne \$expectedName -or \$actualId -cne \$expectedId/);
  assert.match(script,/FIRE-Stripe-Test-Schema-Init-20261101-V2/);
});
test('v2 remains one-use, isolated, empty-only and performs postflight before PASS',()=>{
  for(const value of ['dba421ba-fc66-4cf8-9c31-51616f8249ba','fire-stripe-test-db-20261101','if (Test-Path -LiteralPath $folder)','Remote database is not pristine','d1 migrations apply $expectedName --remote --config','[int]$applied -ne 25','[int]$records -ne 0'])assert.ok(script.includes(value),value);
  assert.doesNotMatch(script,/fire-app-staging-db|afb2c05a-d794-4a9a-b580-924ce01c26ad|8ccfb1f8-1657-4074-b1b2-47de78f95003/);
  assert.doesNotMatch(script,/wrangler(?:\.cmd)?\s+deploy|d1\s+(?:delete|create|time-travel|import)\s+/i);
});
