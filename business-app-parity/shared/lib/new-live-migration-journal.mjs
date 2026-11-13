/**
 * Read-only, source-pinned NEW LIVE 25-migration D1 journal verifier.
 * The order and filenames are the independent release's reviewed
 * adapters/doomsday/drizzle SQL set, NOT the incomplete Drizzle meta journal.
 * A matching journal is necessary but does not prove provider UUID,
 * physical isolation, schema content, migrations actually ran, or release.
 */
export const EXPECTED_NEW_LIVE_D1_MIGRATIONS=Object.freeze([
  "0000_wise_namora.sql",
  "0001_elite_cammi.sql",
  "0002_tearful_ink.sql",
  "0003_absent_dracula.sql",
  "0004_volatile_fenris.sql",
  "0005_unknown_king_cobra.sql",
  "0006_open_solo.sql",
  "0007_open_bloodaxe.sql",
  "0008_typical_tomorrow_man.sql",
  "0009_spicy_micromax.sql",
  "0010_discount_mode.sql",
  "0011_editable_invoices.sql",
  "0012_invoice_revisions.sql",
  "0013_checkout_sessions.sql",
  "0014_notification_resolution.sql",
  "0015_single_open_checkout.sql",
  "0016_notification_resolution_note.sql",
  "0017_one_invoice_per_estimate.sql",
  "0018_payment_refunds.sql",
  "0019_refund_ledger_unique.sql",
  "0020_notification_lifecycle_unique.sql",
  "0021_manual_processing_fees.sql",
  "0022_stripe_provider_uniqueness.sql",
  "0023_deposit_policy_events.sql",
  "0024_deposit_agreement_snapshots.sql"
]);

export async function assertNewLiveMigrationJournal(db){
 if(!db||typeof db.prepare!=='function')
  throw Error('FIRE NEW LIVE migration journal BLOCKED: bound D1 is unavailable');
 const statement=db.prepare('SELECT id, name FROM "d1_migrations" ORDER BY id');
 if(!statement||typeof statement.all!=='function')
  throw Error('FIRE NEW LIVE migration journal BLOCKED: ordered reader is unavailable');
 const response=await statement.all();
 if(!response||!Array.isArray(response.results)||
    response.results.length!==EXPECTED_NEW_LIVE_D1_MIGRATIONS.length)
  throw Error('FIRE NEW LIVE migration journal BLOCKED: expected exact 25 applied migrations');
 for(let i=0;i<EXPECTED_NEW_LIVE_D1_MIGRATIONS.length;i++){
  const row=response.results[i];
  if(!row||typeof row!=='object'||Array.isArray(row)||
     row.id!==i+1||row.name!==EXPECTED_NEW_LIVE_D1_MIGRATIONS[i])
   throw Error('FIRE NEW LIVE migration journal BLOCKED: order, ID or source filename mismatch');
 }
 return true;
}
