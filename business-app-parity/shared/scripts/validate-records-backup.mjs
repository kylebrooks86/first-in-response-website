import { assertBackupIntegrity } from "./records-backup-integrity.mjs";
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

const pathArg = process.argv[2];
if (!pathArg) {
  console.error("Usage: node scripts/validate-records-backup.mjs <backup.json>");
  process.exit(1);
}
const path = resolve(pathArg);
const info = await stat(path).catch(() => null);
if (!info?.isFile()) throw new Error(`Backup not found: ${path}`);
if (info.size > 5_000_000) throw new Error("Backup is larger than the 5 MB restore limit.");
const payload = JSON.parse(await readFile(path, "utf8"));
let kind = null;
let tables = null;
if (payload?.format === "fire-app-records-backup" && payload?.version === 1 && payload.tables && typeof payload.tables === "object") {
  kind = "app-export";
  tables = payload.tables;
} else if (payload?.backup_format === "FIRE App live database snapshot" && payload?.format_version === 1 && payload.tables && typeof payload.tables === "object" && payload?.verification?.all_tables_complete === true && payload?.verification?.truncated === false) {
  kind = "verified-live-snapshot";
  tables = Object.fromEntries(Object.entries(payload.tables).map(([name, value]) => {
    if (!value || typeof value !== "object" || !Array.isArray(value.rows)) throw new Error(`Snapshot table ${name} is invalid.`);
    return [name, value.rows];
  }));
} else {
  throw new Error("This is not a valid or complete FIRE App records backup.");
}
const required = ["customers","estimates","customer_notes","invoices","estimate_items","payments","customer_messages","notifications","message_templates","estimate_change_requests","tasks","expenses","job_reports"];
const optionalRecoveryTables = ["invoice_items", "invoice_revisions", "payment_checkout_sessions", "payment_refunds"];
for (const table of required) if (!Array.isArray(tables[table])) throw new Error(`Backup is missing ${table}.`);
for (const table of optionalRecoveryTables) if (tables[table] !== undefined && !Array.isArray(tables[table])) throw new Error(`Backup ${table} must be an array when present.`);
const criticalFields = {
  estimates:["id","customer_id","status","total_cents","deposit_cents","appreciation_discount","additional_discount_type","additional_discount_value"],
  notifications:["id","type","resolved_at","resolution_note"],
  invoices:["id","estimate_id","total_cents","status"],
  invoice_revisions:["id","invoice_id","total_cents","items_json"],
  payment_checkout_sessions:["id","estimate_id","type","amount_cents","status"],
};
if(kind==="app-export"){
  for(const [table,fields] of Object.entries(criticalFields)){
    const rows=tables[table];
    if(!Array.isArray(rows))throw new Error(`Current app backup is missing ${table}.`);
    for(const [index,row] of rows.entries()){
      if(!row||typeof row!=="object"||Array.isArray(row))throw new Error(`Backup ${table}[${index}] is invalid.`);
      for(const field of fields)if(!(field in row))throw new Error(`Backup ${table}[${index}] is missing critical field ${field}.`);
    }
  }
}
assertBackupIntegrity(tables);
const counts = Object.fromEntries(Object.entries(tables).filter(([, rows]) => Array.isArray(rows)).map(([name, rows]) => [name, rows.length]));
console.log(JSON.stringify({file: basename(path), valid: true, kind, rows: Object.values(counts).reduce((a,b)=>a+b,0), counts}, null, 2));
