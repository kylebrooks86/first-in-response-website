# FIRE Calculator — Best-of-Both Staging Audit

Status: **STAGING CANDIDATE ONLY — NOT SYNCHRONIZED — PRODUCTION/LIVE UNTOUCHED**

Branch: `fire-calculator-best-of-both`

Purpose: consolidate the richer v18 calculator with the faster, cleaner field workflow while protecting the LIVE-style **Mixes** and **Index** sections. This branch is intentionally not an exact visual clone of LIVE in SH Mix / Job Plan / secondary navigation.

## Current field workflow

Primary tabs:
- 🧪 SH Mix
- 🧴 Mixes
- 🔎 Index
- 📐 Job Plan

Secondary sections remain available through **🧰 Tools**:
- ⚙️ Equipment / X-Jet
- 🧰 Field Tools
- 🛡️ Safety Guide
- Install / Update App only when the browser exposes a real install prompt

Field Tools no longer carries a second set of one-tap SH favorites. That duplicate launcher is consolidated into **Saved mixes**, which only stores mixes the owner intentionally saves. A Saved mix restores surface, dirtiness, batch volume (including arbitrary custom gallon sizes), target SH, actual stock strength, and Elemonator rate. Legacy entries without surfactant data fall back to the current surface-safe Elemonator default; malformed storage is ignored, duplicate saves refresh instead of stacking, and saved names are escaped before rendering.

Saved mix restore order is intentionally protected: stock strength, Elemonator, and final SH target restore before the batch selector fires its best-of-both refresh. This prevents stale Quick Preset state from overwriting a custom saved recipe. Field Tools remains condensed into **Jobsite reference**, **Records & chemicals**, and **App & data** disclosure groups, while the dwell timer and Saved mixes stay easy to reach. The Field Safety Card lives in Safety Guide instead of duplicating Field Tools.

Additional staging hardening in this batch:
- Quick batch buttons now synchronize to the actual batch selector after dropdown or Saved mix restoration, so an old 1 / 2 / 4 / 5 gal highlight cannot disagree with the restored recipe.
- The inventory input-contract pass uses the collection selector for all inventory rows instead of treating one element like an array.
- Customer quote normalization preserves an entered customer/job name; only a truly blank `Prepared for:` line falls back to `Customer`.
- Clearing an estimate now clears the hidden legacy customer-name compatibility field before estimator recalculation, preventing an old customer name from resurfacing in the quote or crew sheet.
- Batch History / Mix Log reuse now normalizes stored sizes such as `4.00` back to the matching batch option and restores non-standard history sizes through Custom gallons instead of silently losing the batch.
- Portable backup hydration now maps legacy/live `medium` dirtiness back to the current internal `moderate` value so Medium restores correctly.
- Chemical Inventory no longer hard-codes the SH row as 10%; it starts as **Stock SH** and updates the visible/accessibility label to the current stock strength, including 12.5%.
- Portable backup now stores the actual fine-tuned final SH target and restores it after surface + dirtiness handlers run, preventing a custom target from being silently reset to the surface preset during hydration.
- Dwell Timer manual minute changes now switch the Suggested check display to a synchronized **Custom — X min** state instead of leaving a stale surface-specific suggestion visible; the 3 / 5 / 10 / 15 quick buttons and suggestion dropdown resync each other.
- Saved Mix application now runs behind an atomic restore guard so delayed preset/surface/stock listeners cannot reassert a preset while a saved custom recipe is being restored.
- Overlapping Saved Mix taps use a generation token; an earlier restore cannot unlock the guard for a newer restore still in progress.
- Mix History now logs the complete SH recipe (surface, Light/Medium/Heavy, batch, final SH target, stock strength and Elemonator rate) instead of only name/target/batch.
- Reusing a newer Mix History entry restores those recipe fields under the same atomic restore guard as Saved Mixes; older history entries remain usable and simply fall back for fields they never stored.
- Job Plan container size now follows the active SH batch size when that size is supported, preventing accidental 4-gal fill counts after choosing 1 / 2 / 5 gal in SH Mix. A deliberate Job Plan container selection becomes an override and is not subsequently replaced by SH batch changes.
- A deliberate Job Plan container override now survives reload/restoration by recognizing the existing planning-state value before automatic SH-batch synchronization runs.
- Clear Estimate now clears job-specific planning measurements from both live planning persistence and full-state persistence, preventing a supposedly cleared job from repopulating after delayed restore/reload; reusable preferences such as coverage, reserve and planning container are preserved.
- Portable v3 backup restore now validates the normalized estimate, inventory, calculator, rig and X-Jet payloads before writing any imported storage, reducing the risk of a malformed backup leaving a partially restored state. Raw imported keys are restricted to the calculator's `fire*` namespace.
- Backup restore writes are now transactional across portable v3, full offline and legacy v18 formats: if a storage write fails mid-restore, every key touched by that restore is rolled back to its exact prior value instead of leaving a mixed/partial calculator state.
- Portable backup hydration now uses the explicit migration marker as its only pending-import signal, so ordinary saved estimate drafts are not repeatedly treated as imports. The final hydration pass also closes the migration marker even when a valid backup contains no estimate fields (for example calculator/rig/X-Jet-only data), preventing stale re-hydration on later loads.
- Portable compatibility backups now preserve the active SH batch as normalized gallons plus the original preset/custom amount and unit. Restore reproduces preset batches when possible and restores custom batches in their original unit (for example 96 fl oz stays 96 fl oz instead of being flattened to 0.75 gal).
- Saved custom dwell-timer state now reconstructs its dynamic `Custom — X min` option deterministically after reload instead of relying on module/listener timing. Suggested surface presets remain unchanged and restoring timer state does not auto-start a countdown.
- Job Plan persistence now distinguishes synthetic restore events from genuine edits and generation-guards its delayed startup retries. Once the user edits a planning field (including Clear Estimate's planning reset), already-scheduled restores are invalidated so stale startup state cannot overwrite the newer job state.
- Job Plan container persistence now stores explicit `planContainerManual` provenance only when the user genuinely changes that container. Merely saving another planning field no longer makes a saved/default container look manual, so untouched Job Plan containers continue following the active SH batch while deliberate overrides still survive reload.
- Portable compatibility backup/restore now carries the explicit Job Plan container override provenance (`jobBatchSizeManual`) alongside `jobBatchSize`. Deliberate container choices therefore survive portable restores, while older backups without the flag safely fall back to automatic SH-batch following instead of guessing.
- Native/offline backup restore now prevalidates the entire `stores` object before any write: it must be a non-array object, every value must be a string, and every key must remain inside the native export namespaces (`fireV18*`, `fireFieldCalculator*`, or `fireCalcTheme*`). Any invalid entry rejects the whole import instead of being silently skipped into an incomplete restore; transactional rollback remains in place for write-time failures.
- Portable-import bridge keys (`fireV18ImportedLiveFieldCalc`, `fireV18ImportedLiveRig`, and `fireV18ImportedLiveXjet`) are now migration-marker gated and consumed after the final 1400 ms hydration pass. They remain available long enough for late-loaded calculator modules during the import reload, but cannot replay stale imported SH/rig/X-Jet values on later normal launches.
- Portable helper cleanup is now success-aware per category: calculator, rig, and X-Jet bridge keys are each removed only when that category actually reached at least one live target control on the final hydration pass. A genuinely late/missing module therefore keeps its helper payload instead of losing import data prematurely.
- The backup hydration finalizer now performs one coordinated imported-helper retry immediately before removing `fireV18LiveBackupMigratedAt`. This closes the retained-helper gap: a control that appears after the 1400 ms pass gets one last chance to receive its imported state, while marker cleanup still bounds the migration lifecycle.
- Portable helper hydration now raises a shared `__fireHydratingBackup` guard while it dispatches synthetic input/change events. Planning-state persistence ignores those synthetic events, so restoring imported coverage or other planning-adjacent values cannot increment the genuine-user generation counter or cancel delayed planning restoration. The prior guard value is restored afterward for nested/future hydration safety.
- Global parity-draft autosave now also honors the backup-hydration guard. Synthetic restore events still recalculate summaries, but they cannot persist a transient half-hydrated draft while imported fields are being applied one at a time; migration already writes the intended durable parity/planning state.
- Quick Preset mutation listeners now treat portable-backup hydration as a recipe-restore context, alongside Saved Mix restore. Surface/target/Elemonator/stock events can recalculate without prematurely clearing the active preset or forcing `Custom / manual mix`; after final backup hydration a completion event refreshes the preset card once from the fully restored recipe.

### SH Mix

Normal field flow:
1. Choose one of 9 icon-led Quick Presets from one compact dropdown.
2. Choose global **Light / Medium / Heavy** dirtiness.
3. Choose a common batch size: **1 / 2 / 4 / 5 gal**.
4. Read the finished/direct-application recipe.

Less-common controls are deliberately collapsed:
- Other / manual surface
- Preset notes
- More sizes / custom
- Fine-tune mix
- Other stock %
- Stock on hand

Quick Preset strengths:

| Preset | Light | Medium | Heavy |
| --- | ---: | ---: | ---: |
| House / Vinyl | 0.5% | 1% | 1.5% |
| Bare Wood Fence | 0.5% | 1% | 1.5% |
| Painted Wood / Brick / Masonry | 0.5% | 0.5% | 0.5% |
| Concrete Pre-Treat | 1% | 2% | 3% |
| Concrete Post-Treat | 0.5% | 1% | 1.5% |
| Asphalt Roof / Black Streaks | 3% | 4% | 5% |
| Bare Brick / Masonry | 0.5% | 1% | 2% |
| Stucco / Synthetic Stucco | 0.5% | 1% | 1.5% |
| Pavers / Hardscape | 0.5% | 1% | 2% |

The dirtiness selector is global and does **not** reset when switching presets.

Stock-strength safety:
- 10% and 12.5% stock shortcuts remain visible.
- If a selected preset/dirtiness combination calls for a final SH percentage above the actual stock strength, the preset cannot silently show an impossible recipe.
- The target is limited to the stock strength, the UI switches to Custom/manual, and the note explains the limitation.
- The same guard applies when Light / Medium / Heavy is changed after choosing a preset.
- The guard also re-checks an active preset if the actual stock strength itself is changed afterward; an impossible preset is converted to Custom/manual and its stale selected checkmark is cleared.

### Mixes / Index protection

The existing LIVE-style `#chemicals` (Mixes) and `#index` (Index) sections are intentionally protected from the best-of-both redesign. Best-of-both CSS after the protection block does not directly target those sections.

### Job Plan

Coverage Planner remains first/open.

Advanced work is grouped under collapsed sections:
- 📏 Measure / calibrate
- 💵 Full job estimate
- 🧪 Cost / profit

Open/closed state is preserved if late v18 layout events rebuild these wrappers.

### Equipment

Frequent controls remain visible:
- X-Jet main calculator
- Downstream surface-strength estimate

Advanced work is grouped under:
- X-Jet pickup bucket recipe
- Calibration tools
- Future rig planning

Open/closed state is preserved if late v18 layout events rebuild these wrappers.

## Current FIRE business-rule protections

Current core defaults include:
- House wash: $0.22 / sq ft
- Gutter Cleaning & Downspout Flushing: $1.75 / linear ft
- Gutter Guard Removal / Reinstall: $1.00 / linear ft
- Gutter brightening: $2.00 / linear ft
- Fence cleaning: $0.40 / sq ft
- Standard window 1st: $7
- Standard window 2nd: $11
- French pane 1st: $12
- French pane 2nd: $18
- Screen 1st: $3
- Screen 2nd: $6
- Minimum job: $150
- Deposit: 50%

Saved exact retired gutter defaults are migrated:
- 1.50 → 1.75 for gutter cleaning
- 0.50 → 1.00 for guard removal/reinstall

Deliberately custom user rates are preserved.

## Current automated/source-level evidence

Current asset generation at this audit:
- `full-v18.js?v=71`
- `best-of-both.js?v=34`
- `best-of-both.css?v=17`
- service-worker cache: `fire-field-calculator-v18-best-of-both-202`

Regression evidence:
- **68/68 formula regression tests pass**
- **13/13 best-of-both preset chemistry tests pass**
- **Best-of-both contract passes**
- 9 Quick Presets verified
- 4-gal house / roof / concrete recipe math verified at current preset surfactant rates
- 10% vs 12.5% stock behavior verified
- impossible target-above-stock behavior verified
- 27 dynamically loaded modules represented in the offline cache
- 38 versioned loader/entry assets covered by the best-of-both cache contract
- all 45 service-worker precache URLs currently resolve to files present on the staging branch
- no detected single-element selector being used as a collection in `best-of-both.js`
- static DOM id audit reports no duplicate ids
- best-of-both form controls are protected at 16px input text to avoid iPhone focus zoom
- compact dirtiness/disclosure controls use protected 44px touch targets; the mobile Tools button now has an explicit 44×44 minimum
- Saved mixes dark/mobile styling keeps text readable and Reuse/Delete controls at 44px touch size
- main best-of-both source parses successfully

The best-of-both contract specifically protects:
- 9 preset names and Light/Medium/Heavy strength profiles
- global dirtiness behavior
- stock-limit guard on preset selection and dirtiness changes
- 1 / 2 / 4 / 5 visible quick batch sizes
- duplicate late-layout batch listener protection
- 10% / 12.5% stock shortcuts
- manual/fine-tune fallback controls
- four primary tabs
- compact Tools routing
- Mixes / Index protection rules
- current gutter pricing defaults/wording
- offline asset-version consistency
- advanced Job Plan / Equipment open-state preservation
- duplicate one-tap favorites staying out of Field Tools while Saved mixes remains available
- Saved mixes full-setting restore behavior and automatic card creation
- identical Saved mixes are deduplicated instead of stacking repeated copies
- Saved mixes storage is covered by both full offline and portable backup paths
- full Saved mix restore behavior, custom batch restoration, malformed-storage recovery, and legacy Saved mix migration
- full Saved mixes restore behavior, including custom batch sizes, stock strength, Elemonator rate, and restore sequencing that applies recipe-critical values before the batch refresh

## Validation boundary

This audit is **source/syntax/regression/cache validation**, not a claim of current physical iPhone rendered acceptance.

Before any production promotion:
1. Render and use the current staging candidate on the owner's iPhone.
2. Verify Quick Preset dropdown, Light/Medium/Heavy, batch-size overflow, recipe, Tools menu, Job Plan, Equipment, Mixes and Index.
3. Verify safe-area/keyboard behavior.
4. Verify offline close/reopen behavior on the staged build.
5. Fix any real-device mismatch even if source tests are green.
6. Obtain explicit owner approval before production/LIVE changes.

Until then, keep status **STAGING CANDIDATE ONLY — NOT SYNCHRONIZED**.

- Cache 192: after backup hydration, Quick Preset explicitly clears its prior active selection before re-identifying the preset from the fully restored surface, growth, target SH and Elemonator rate. No recipe values are changed. Exact-source contract passes (9 presets, 38 assets, 27 cached modules); no physical iPhone testing claimed.

- Cache 193: fixed shared boolean success tracking in portable helper hydration. A numeric count now independently detects calculator, rig, and X-Jet fields applied, so each helper is consumed according to its own success rather than the prior category's result. Contract and cache parity pass; no physical iPhone test performed.

- Cache 194: live v3 migration now replaces its imported calculator helper with the current backup payload rather than merging old helper values; estimate `fields` must be a non-array object. Static contract passes: 9 presets, 38 assets, 27 cached modules; no browser/iPhone runtime testing claimed.

- Cache 195: portable live helper hydration now releases its synthetic-event guard inside `finally`, including when a dispatched restore handler throws. Exact-source contract passes (9 presets, 38 assets, 27/27 cached modules); no physical iPhone runtime test claimed.

- Cache 196: migration completion now waits for nonempty imported calculator, rig, and X-Jet helpers to be consumed; otherwise marker remains pending for subsequent startup retry. Exact-source contract passes (9 presets, 38 assets, 27 cached modules). Browser runtime restore still untested.

- Cache 197: backup hydration completion event now fires only after migration marker removal is verified; storage failure leaves migration pending rather than falsely notifying preset reconciliation. Exact-source contract passes (9 presets, 38 assets, 27 cached modules); browser runtime not yet tested.

- Cache 198: live estimate hydration now rejects array-shaped `fields`, matching migration validation. Exact-source contract passes (9 presets, 38 assets, 27 cached modules). Browser runtime remains untested.

- Cache 199: shared-core-ready event now schedules a final backup migration retry after initialization, rather than only a non-final retry. Exact-source contract passes (9 presets, 38 assets, 27 cached modules). Real browser restore still untested.

- Cache 200: estimate and inventory backup hydration now share the exception-safe synthetic input/change guard used by calculator helpers, suppressing draft autosave and planning user-edit generation during restoration. Exact-source contract passes (9 presets, 38 assets, 27 cached modules); browser runtime untested.

- Cache 201: imported helper hydration errors now block migration finalization even when no helper payload remains. Added `tests/backup-hydration-runtime.mjs` with five executable simulated DOM/storage scenarios (success, helper error, pending helper, storage failure, synthetic input failure); all five passed in an in-memory JavaScript harness. Static contract passes (9 presets, 38 assets, 27 cached modules). No actual iPhone Safari test.

- Cache 202: portable helper hydration now counts restored growth-only, surface-only, and batch-only settings toward successful application so pending backup helpers can clear. Added `tests/imported-helper-runtime.mjs` (6 simulated runtime cases) and a contract assertion preventing accidental helper counter references in saved-mix logic. Both runtime suites pass 11/11 cases; source contract passes 9 presets, 38 assets, 27 cached modules. No real iPhone Safari run.
