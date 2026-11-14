import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('./initialize-empty-test-d1.ps1',import.meta.url),'utf8');
test('one-time remote TEST D1 schema initializer requires exact UUID, pristine DB, 25 migrations and postflight',()=>{
  for(const piece of [
    "dba421ba-fc66-4cf8-9c31-51616f8249ba",
    "fire-stripe-test-db-20261101",
    "fire-stripe-test-20261101",
    "2cea49338b9f3a85e150cb871d5517636c3e858f",
    "FIRE-Stripe-Test-Schema-Init-20261101",
    "if (Test-Path -LiteralPath $folder)",
    'd1 info $expectedName --json',
    '$actualId -cne $expectedId',
    "migrations_dir",
    "if ($sqlFiles.Count -ne 25)",
    "foreach ($n in 0..24)",
    "NOT LIKE 'sqlite_%'",
    "Remote database is not pristine",
    "d1 migrations list $expectedName --remote --config",
    "d1 migrations apply $expectedName --remote --config",
    "FROM d1_migrations",
    "idx_payments_stripe_provider_unique",
    "[int]$applied -ne 25",
    "[int]$tables -ne 8",
    "[int]$records -ne 0",
    "Do not rerun automatically",
  ])assert.ok(script.includes(piece),piece);
  assert.doesNotMatch(script,/\bd1\s+(?:delete|create|import|export|time-travel)\b|\bwrangler(?:\.cmd)?\s+deploy\b|\bstripe(?:\s+|:)(?:refund|checkout|webhook)\b/i);
  assert.doesNotMatch(script,/fire-app-staging-db|afb2c05a-d794-4a9a-b580-924ce01c26ad|8ccfb1f8-1657-4074-b1b2-47de78f95003/);
});
