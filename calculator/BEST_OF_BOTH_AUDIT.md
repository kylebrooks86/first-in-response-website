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
- `full-v18.js?v=18`
- `best-of-both.js?v=23`
- `best-of-both.css?v=13`
- service-worker cache: `fire-field-calculator-v18-best-of-both-136`

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
- no detected single-element selector being used as a collection in `best-of-both.js`
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
