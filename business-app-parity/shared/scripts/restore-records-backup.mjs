import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const TABLES = [
  ["customers", ["id", "name", "email", "phone", "address", "lead_source", "created_at"]],
  ["estimates", ["id", "customer_id", "status", "subtotal_cents", "discount_cents", "appreciation_discount", "additional_discount_type", "additional_discount_value", "total_cents", "deposit_cents", "scheduled_at", "share_token", "first_viewed_at", "accepted_at", "signed_name", "signed_at", "contract_initials", "photo_release", "contract_version", "created_at"]],
  ["customer_notes", ["id", "customer_id", "body", "created_at"]],
  ["invoices", ["id", "estimate_id", "customer_id", "status", "subtotal_cents", "discount_cents", "discount_type", "discount_value", "total_cents", "due_at", "share_token", "first_viewed_at", "created_at"]],
  ["invoice_items", ["id", "invoice_id", "name", "description", "quantity", "unit", "total_cents"]],
  ["invoice_revisions", ["id", "invoice_id", "subtotal_cents", "discount_cents", "discount_type", "discount_value", "total_cents", "due_at", "status", "items_json", "created_at"]],
  ["payment_checkout_sessions", ["id", "estimate_id", "type", "amount_cents", "status", "created_at", "expired_at"]],
  ["estimate_items", ["id", "estimate_id", "name", "description", "quantity", "unit", "total_cents"]],
  ["payments", ["id", "estimate_id", "type", "amount_cents", "status", "provider_id", "created_at", "processing_fee_cents", "gross_received_cents", "bundled_tip_cents", "processing_method"]],
  ["customer_messages", ["id", "customer_id", "estimate_id", "channel", "template", "body", "created_at"]],
  ["notifications", ["id", "type", "title", "body", "customer_id", "estimate_id", "read_at", "resolved_at", "resolution_note", "created_at"]],
  ["message_templates", ["key", "subject", "body", "updated_at"]],
  ["estimate_change_requests", ["id", "estimate_id", "customer_id", "message", "status", "created_at"]],
  ["tasks", ["id", "title", "customer_id", "estimate_id", "due_at", "status", "notes", "created_at", "completed_at"]],
  ["expenses", ["id", "estimate_id", "category", "description", "amount_cents", "incurred_at", "created_at"]],
  ["job_reports", ["id", "estimate_id", "customer_id", "checklist", "notes", "airflow_before", "airflow_after", "status", "created_at", "completed_at"]],
];

const args = process.argv.slice(2);
const valueAfter = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const has = (name) => args.includes(name);
const backupPath = valueAfter("--backup");
const configPath = valueAfter("--config") || "dist/server/wrangler.independent.json";
const apply = has("--apply");
const local = has("--local");
const remote = has("--remote");
const persistTo = valueAfter("--persist-to") || ".wrangler/state";

if (!backupPath || local === remote) {
  console.error("Usage: npm run restore:records -- --backup <json> (--local | --remote) [--config <path>] [--persist-to <path>] [--apply] [--confirm-database <name>]");
  process.exit(1);
}

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const absoluteBackup = resolve(backupPath);
const absoluteConfig = resolve(configPath);
const config = JSON.parse(await readFile(absoluteConfig, "utf8"));
const database = config.d1_databases?.find((item) => item.binding === "DB");
if (!database?.database_name || !database.database_id || database.database_id === "00000000-0000-4000-8000-000000000000") {
  console.error("The independent Wrangler configuration must contain a non-placeholder DB resource.");
  process.exit(1);
}
if (remote && apply && valueAfter("--confirm-database") !== database.database_name) {
  console.error(`Remote apply requires --confirm-database ${database.database_name}`);
  process.exit(1);
}

const wrangler = resolve(projectRoot, "node_modules/wrangler/bin/wrangler.js");
const modeArgs = local ? ["--local", "--persist-to", persistTo] : ["--remote"];
function run(commandArgs) {
  return spawnSync(process.execPath, [wrangler, ...commandArgs], { cwd: projectRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}
function fail(result, context) {
  const detail = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  throw new Error(`${context}${detail ? `\n${detail}` : ""}`);
}
function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Backup contains a non-finite number.");
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

const backupStat = await stat(absoluteBackup).catch(() => null);
if (!backupStat?.isFile()) throw new Error(`Records backup not found: ${absoluteBackup}`);
if (backupStat.size > 5_000_000) throw new Error("That backup is larger than the 5 MB restore limit.");
const payload = JSON.parse(await readFile(absoluteBackup, "utf8"));
let backupTables = null;
if (payload?.format === "fire-app-records-backup" && payload?.version === 1 && payload.tables && typeof payload.tables === "object") {
  backupTables = payload.tables;
} else if (payload?.backup_format === "FIRE App live database snapshot" && payload?.format_version === 1 && payload.tables && typeof payload.tables === "object" && payload?.verification?.all_tables_complete === true && payload?.verification?.truncated === false) {
  backupTables = Object.fromEntries(Object.entries(payload.tables).map(([table, value]) => {
    if (!value || typeof value !== "object" || !Array.isArray(value.rows)) throw new Error(`Snapshot table ${table} is invalid.`);
    return [table, value.rows];
  }));
}
if (!backupTables) throw new Error("This is not a valid or complete FIRE App records backup.");

const restoredAt = new Date().toISOString();
const plans = [];
for (const [table, columns] of TABLES) {
  const rows = backupTables[table];
  if (!Array.isArray(rows)) { if (table === "invoice_items" || table === "invoice_revisions" || table === "payment_checkout_sessions") continue; throw new Error(`The backup is missing the ${table} records.`); }
  for (const candidate of rows) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error(`The ${table} backup contains an invalid record.`);
    const values = columns.map((column) => {
      const value=candidate[column];
          if(table==="payments"&&["processing_fee_cents","gross_received_cents","bundled_tip_cents","processing_method"].includes(column)&&value===undefined)return null;
      if(value!==undefined)return value;
      if(table==="invoices"&&column==="subtotal_cents")return candidate.total_cents??0;
      if(table==="invoices"&&column==="discount_cents")return 0;
      if(table==="invoices"&&column==="discount_type")return "dollar";
      if(table==="invoices"&&column==="discount_value")return 0;
      if(table==="estimates"&&column==="appreciation_discount")return 0;
      if(table==="estimates"&&column==="additional_discount_type")return "percent";
      if(table==="estimates"&&column==="additional_discount_value")return 0;
      if(table==="notifications"&&column==="resolved_at")return null;
      if(table==="notifications"&&column==="resolution_note")return null;
      if(table==="payment_checkout_sessions"&&column==="status"&&candidate.status==="open")return "expired";
      if(table==="payment_checkout_sessions"&&column==="expired_at"&&candidate.status==="open")return restoredAt;
      return value;
    });
    if (values.some((value) => value !== null && value !== undefined && typeof value !== "string" && typeof value !== "number")) throw new Error(`The ${table} backup contains an invalid field.`);
    const identityColumn = table === "message_templates" ? "key" : "id";
    const identity = candidate[identityColumn];
    if (typeof identity !== "string" || !identity) throw new Error(`The ${table} backup contains a record without a valid ${identityColumn}.`);
    plans.push({ table, columns, values, identityColumn, identity });
  }
}
if (plans.length > 5_000) throw new Error("This backup contains more than 5,000 records and requires a managed restore.");

const existingByTable = new Map();
for (const [table] of TABLES) {
  const identityColumn = table === "message_templates" ? "key" : "id";
  const result = run(["d1", "execute", "DB", "--config", absoluteConfig, ...modeArgs, "--json", "--command", `SELECT ${identityColumn} AS identity FROM ${table}`]);
  if (result.status !== 0) fail(result, `Could not inspect target table ${table}.`);
  const parsed = JSON.parse(result.stdout);
  existingByTable.set(table, new Set((parsed[0]?.results || []).map((row) => String(row.identity))));
}
const missing = plans.filter((plan) => !existingByTable.get(plan.table).has(plan.identity));
const byTable = Object.fromEntries(TABLES.map(([table]) => {
  const restore = missing.filter((plan) => plan.table === table).length;
  return [table, { restore, preserve: plans.filter((plan) => plan.table === table).length - restore }];
}));
console.log(JSON.stringify({ backup: basename(absoluteBackup), targetDatabase: database.database_name, mode: local ? "local" : "remote", apply, summary: { restore: missing.length, preserve: plans.length - missing.length }, byTable }, null, 2));
if (!apply) {
  console.log("Dry run complete. No database records were changed.");
  process.exit(0);
}
if (!missing.length) {
  console.log("Nothing to restore. All backup records already exist and were preserved.");
  process.exit(0);
}

const work = await mkdtemp(`${tmpdir()}/fire-records-restore-`);
try {
  const sqlPath = resolve(work, "restore.sql");
  const statements = missing.map(({ table, columns, values }) => `INSERT OR IGNORE INTO ${table} (${columns.join(",")}) VALUES (${values.map(sql).join(",")});`);
  await writeFile(sqlPath, `${statements.join("\n")}\n`, "utf8");
  const result = run(["d1", "execute", "DB", "--config", absoluteConfig, ...modeArgs, "--yes", "--file", sqlPath]);
  if (result.status !== 0) fail(result, "The records restore did not complete. It is safe to inspect and retry because all writes are merge-only.");

  let verified = 0;
  const normalize = (value) => value === null || value === undefined ? null : typeof value === "number" ? value : String(value);
  for (const [table] of TABLES) {
    const expected = missing.filter((plan) => plan.table === table);
    if (!expected.length) continue;
    for (const plan of expected) {
      const select = plan.columns.map((column) => `${column} AS "${column}"`).join(",");
      const verify = run(["d1", "execute", "DB", "--config", absoluteConfig, ...modeArgs, "--json", "--command", `SELECT ${select} FROM ${table} WHERE ${plan.identityColumn}=${sql(plan.identity)} LIMIT 1`]);
      if (verify.status !== 0) fail(verify, `Could not verify restored ${table} record ${plan.identity}.`);
      const parsed = JSON.parse(verify.stdout);
      const row = parsed[0]?.results?.[0];
      if (!row) throw new Error(`Restore verification failed: ${table} record ${plan.identity} is missing after apply.`);
      for (let index = 0; index < plan.columns.length; index += 1) {
        const column = plan.columns[index];
        const expectedValue = normalize(plan.values[index]);
        const actualValue = normalize(row[column]);
        if (actualValue !== expectedValue) throw new Error(`Restore verification failed: ${table}.${column} for ${plan.identity} expected ${JSON.stringify(expectedValue)} but found ${JSON.stringify(actualValue)}.`);
      }
      verified += 1;
    }
  }
  if (verified !== missing.length) throw new Error(`Restore verification failed: expected ${missing.length} records but verified ${verified}.`);
  console.log(JSON.stringify({ restoredAndVerified: verified, fieldValuesVerified: true, existingRecordsPreserved: plans.length - missing.length }, null, 2));
} finally {
  await rm(work, { recursive: true, force: true });
}
