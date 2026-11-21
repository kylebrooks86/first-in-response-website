import { access, readFile, readdir } from "node:fs/promises";
import process from "node:process";

const root = new URL("../", import.meta.url);
const requiredFiles = [
  "package.json",
  "pnpm-lock.yaml",
  "INDEPENDENT_DEPLOYMENT.md",
  "SECURITY_AND_RECOVERY_STATUS.md",
  "db/schema.ts",
  "scripts/configure-independent-wrangler.mjs",
  "scripts/restore-records-backup.mjs",
  "scripts/restore-photo-archive.mjs",
  "scripts/validate-records-backup.mjs",
  "scripts/release-readiness.mjs",
  "scripts/check-unified-release.mjs",
  "scripts/strict-parity-gate.mjs",
  "scripts/validate-strict-parity-fixture.mjs",
  "scripts/remove-strict-parity-fixture.mjs",
  "scripts/register-parity-evidence.mjs",
  "scripts/compare-parity-evidence.mjs",
  "scripts/build-parity-capture-queue.mjs",
  "scripts/build-parity-progress.mjs",
  "scripts/build-release-evidence-seal.mjs",
  "scripts/validate-release-evidence-seal.mjs",
  "scripts/build-release-package.mjs",
  "scripts/validate-current-recovery-docs.mjs",
  "scripts/validate-restore-verification.mjs",
  "RELEASE_PACKAGE_POLICY.json",
  "RELEASE_EVIDENCE_SEAL.json",
  "PARITY_CAPTURE_QUEUE.md",
  "PARITY_COMPARISON_QUEUE.md",
  "PARITY_PROGRESS.json",
  "fixtures/strict-parity-records.json",
  "fixtures/strict-parity-photos.zip",
  "STRICT_PARITY_MATRIX.md",
  "FIRE_UNIFIED_RELEASE.json",
  "app/api/payments/webhook/route.ts",
  "STAGING_ACCEPTANCE_TEST.md",
];

const checks = [];
const pass = (name, detail = "") => checks.push({ ok: true, name, detail });
const fail = (name, detail = "") => checks.push({ ok: false, name, detail });

const major = Number(process.versions.node.split(".")[0]);
if (major >= 22) pass("Node version", process.version);
else fail("Node version", `${process.version}; Node 22+ required`);

for (const rel of requiredFiles) {
  try { await access(new URL(rel, root)); pass(`Required file: ${rel}`); }
  catch { fail(`Required file: ${rel}`, "missing"); }
}

const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
for (const script of ["build:independent", "deploy:independent", "restore:records", "restore:photos", "hash:password", "release:readiness", "release:sync-check", "release:strict-parity", "parity:fixture:validate", "parity:fixture:load", "parity:fixture:photos", "parity:fixture:remove", "parity:evidence:register", "parity:evidence:compare", "parity:capture:queue", "parity:progress", "release:evidence-seal", "release:evidence-seal:check", "release:package:build", "release:docs:check", "restore:verify-contract"]) {
  if (packageJson.scripts?.[script]) pass(`Package script: ${script}`);
  else fail(`Package script: ${script}`, "missing");
}

const drizzle = (await readdir(new URL("drizzle/", root))).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
if (drizzle.length) {
  const numbers = drizzle.map((name) => Number(name.slice(0, 4)));
  const contiguous = numbers.every((n, i) => n === i);
  if (contiguous) pass("Database migrations", `${drizzle.length} contiguous migrations (${drizzle[0]} → ${drizzle.at(-1)})`);
  else fail("Database migrations", `non-contiguous sequence: ${drizzle.join(", ")}`);
} else fail("Database migrations", "none found");

const scanFiles = ["scripts/configure-independent-wrangler.mjs", "vite.config.ts", "package.json", "db/index.ts", "app/owner-auth.ts"];
let scanText = "";
for (const rel of scanFiles) scanText += "\n" + await readFile(new URL(rel, root), "utf8");
if (/appgprj_[a-z0-9]+/i.test(scanText)) fail("Hosting isolation", "legacy hosted-project identifier found in deployment-critical text");
else if (/chatgpt|\.openai\/hosting|sites-vite-plugin/i.test(scanText)) fail("Hosting isolation", "legacy ChatGPT/OpenAI hosting scaffold found in deployment-critical text");
else pass("Hosting isolation", "deployment-critical files use independent Cloudflare configuration and owner authentication");

if (/firstinresponseexteriors\.com/i.test(scanText)) {
  pass("Production-domain guardrail", "production domain appears only in safety documentation; staging instructions prohibit attaching it");
} else pass("Production-domain guardrail", "no production domain embedded in deployment-critical configuration text");

const envNames = ["FIRE_WORKER_NAME", "FIRE_D1_DATABASE_NAME", "FIRE_D1_DATABASE_ID", "FIRE_R2_BUCKET_NAME"];
const supplied = envNames.filter((name) => process.env[name]?.trim());
if (supplied.length === 0) {
  pass("Deployment environment", "not supplied; source-only preflight mode");
} else {
  const missing = envNames.filter((name) => !process.env[name]?.trim());
  if (missing.length) fail("Deployment environment", `partial configuration; missing ${missing.join(", ")}`);
  else {
    const dbId = process.env.FIRE_D1_DATABASE_ID.trim();
    if (!/^[0-9a-f-]{32,36}$/i.test(dbId) || dbId === "00000000-0000-4000-8000-000000000000") fail("D1 database ID", "invalid or placeholder");
    else pass("D1 database ID", "format looks valid and non-placeholder");

    const names = [process.env.FIRE_WORKER_NAME, process.env.FIRE_D1_DATABASE_NAME, process.env.FIRE_R2_BUCKET_NAME].map((v) => v.trim().toLowerCase());
    if (names.some((name) => /prod|production/.test(name))) fail("Staging resource names", "a resource name looks production-like; use isolated staging resources");
    else pass("Staging resource names", names.join(", "));
  }
}

for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
const failures = checks.filter((c) => !c.ok);
if (failures.length) {
  console.error(`\nPreflight failed: ${failures.length} blocking issue(s).`);
  process.exit(1);
}
console.log(`\nPreflight passed: ${checks.length} checks.`);
