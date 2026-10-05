# FIRE Business Calculator — Production vs Doomsday DR Parity Matrix

Status values:

- **VERIFIED IDENTICAL**
- **FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED**
- **NOT YET VERIFIED**
- **INTENTIONAL INFRASTRUCTURE DIFFERENCE**

A row may not be promoted to VERIFIED IDENTICAL without checking LIVE and DR in the same relevant state. Owner physical-device findings override prior automated visual-green conclusions.

## Current audit summary

**AUTOMATED PARITY ACCEPTANCE COMPLETE — PHYSICAL IPHONE ACCEPTANCE PENDING — NOT SYNCHRONIZED**

Current governed DR fingerprint: `796216b88d011eb781870d9bcb83eeaedcc38f39ffc7a26c7d4808fd98facaad`

Current DR offline cache: `fire-field-calculator-v18-exact-clone-106`

Production/LIVE remains the untouched reference. The Doomsday calculator remains staging-only for synchronization purposes. The cache-106 candidate passes the rebuilt automated functional, rendered, geometry, persistence, backup/takeover and offline acceptance suite. Physical/native iPhone acceptance remains the final pre-promotion requirement.

| Area / state | Current status | Acceptance requirement |
| --- | --- | --- |
| Launch / initial render | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Automated iPhone-viewport first paint/header/warning/tabs/active-state geometry matches; physical iPhone confirmation remains. |
| Header / FIRE branding | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Exact iPhone title/control spacing and installed/saved states still require physical-device acceptance. |
| Top navigation | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Seven-tab order/route behavior has automated coverage; rendered scrolling, spacing and active states remain open. |
| Bottom navigation | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Six-control order/route behavior is implemented; fixed/safe-area and active-state physical comparison remains. |
| SH Mix — surface/growth selectors | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | LIVE option/default behavior is implemented; exact iPhone card/control presentation remains open. |
| SH Mix — batch controls | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Presets/custom controls and calculations have regression coverage; rendered structure/spacing remains open. |
| SH Mix — recipe/stock/Elemonator | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Formula/copy behavior is implemented; same-state physical-device presentation and remaining state matrix remain. |
| Chemical Index | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Wrong generic Index interpretation was removed; LIVE-style Chemical Use Index direction is restored. Product cards, search/filter behavior and iPhone spacing remain acceptance items. |
| Chemicals | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Product/dilution/compatibility behavior has coverage; route/card/control visual parity and alternate states remain open. |
| Equipment — X-Jet | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Direct corrections applied for LIVE card treatment, unit pills and result grouping; physical iPhone acceptance remains. |
| Equipment — reverse X-Jet | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Direct grouping/instruction correction applied; edge states and physical presentation remain. |
| Equipment — bucket/downstream/injector | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Default calculations have regression evidence; full rendered/state comparison remains. |
| Equipment — proportioner/tank/fill | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Direct proportioner grouping correction applied; full rendered/state comparison remains. |
| Job Math — quick navigation | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Visibility/placement correction applied after empty outlined controls were observed; sticky/mobile acceptance remains. |
| Job Math — planning/measurement/cost | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Functional coverage exists; route/card visual parity and alternate state matrix remain. |
| Job Math — estimator/pricing | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Minimum, discount, bundle, override, deposit, pricing-editor and edge-state behavior have automated evidence; exact rendered parity remains. |
| Customer/job / quote / crew sheet | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | State/output behavior has automated evidence; native clipboard/share/print presentation remains physical-device work. |
| Loadout / profitability | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Functional baseline exists; nonblank scenarios and exact visual presentation remain. |
| Field Tools — favorites/finder/compatibility | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Default functional states exist; alternate-state and iPhone visual comparison remain. |
| Field Tools — history/inventory | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Core behavior exists; reuse/delete/order/persistence and rendered parity remain. |
| Field Tools — timer/weather | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Default states exist; background/timing/alternate conditions and physical presentation remain. |
| Field Tools — custom chemical/version/backup | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Core behavior/backup compatibility exists; validation states and rendered/native presentation remain. |
| Field Safety Card | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Content exists; exact card presentation remains. |
| Field Guide | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Content/order direction is implemented; exact matrix/accordion/card presentation remains. |
| First-run state | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Clean automated LIVE-vs-DR state/launch acceptance passes; physical iPhone confirmation remains. |
| Reloaded/saved state | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Persistence has automated evidence; rendered restoration states remain. |
| Theme persistence | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Behavior exists; physical light/dark restored-state parity remains. |
| Reset / clear | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Automated behavior evidence exists; confirmation/native presentation remains. |
| Backup portability | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | LIVE-compatible restore, reverse isolated restore and corrupt-backup safety have automated evidence; controls/native presentation remain. |
| Light mode | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Automated route-by-route light-mode render/geometry acceptance passes; physical iPhone confirmation remains. |
| Dark mode | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Automated route-by-route dark-mode render/geometry acceptance passes; physical iPhone confirmation remains. |
| iPhone portrait layout | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Automated iPhone-viewport geometry/screenshot acceptance passes; physical-device confirmation remains required. |
| iPhone safe area / fixed controls | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Automated viewport safe-area/header/bottom-nav geometry passes; real iOS keyboard/safe-area confirmation remains. |
| Native keyboard | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Input contracts have automated coverage; native iOS keyboard chrome/dismissal remains. |
| Native share / print | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Payload/action behavior has automated coverage; OS share and print/save-PDF UI remains. |
| Blank / zero / decimal / negative / very-large / invalid numeric states | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Estimator/input scenarios have automated evidence; remaining relevant fields require state coverage and rendered comparison. |
| Missing/unapproved rate behavior | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | No guessed price should be introduced; same warning/result state must match LIVE. |
| Network offline — normal calculator | INTENTIONAL INFRASTRUCTURE DIFFERENCE | DR must operate independently; offline plumbing must not alter shared calculator behavior. |
| ChatGPT/OpenAI dependency | INTENTIONAL INFRASTRUCTURE DIFFERENCE | DR normal calculator operation must not require OpenAI/ChatGPT calls or authentication. |
| Hosting URL/domain | INTENTIONAL INFRASTRUCTURE DIFFERENCE | May differ without affecting shared UI/logic. |
| Hosting secrets/environment | INTENTIONAL INFRASTRUCTURE DIFFERENCE | May differ without affecting shared user-visible/business-functional behavior. |


### Cache-106 automated acceptance result

The current candidate has passed the full automated parity gate, visual/geometry workflow, behavior suite, backup/takeover parity and offline/airplane-mode acceptance. Focused card geometry is within small tolerance and the shared mobile shell has no horizontal overflow. Rows remain short of `VERIFIED IDENTICAL` only where physical/native iOS presentation still requires owner-device confirmation or where production has not yet been intentionally promoted.

## Mandatory same-state comparison order

1. SH Mix / Mixes
2. Chemical Index
3. Equipment
4. Chemicals
5. Job Math
6. Field Tools
7. Field Guide
8. Shared header/top navigation/bottom navigation
9. Light mode route-by-route
10. Dark mode route-by-route
11. Clean first-run and restored/saved states
12. iPhone safe-area + native keyboard
13. Native share / print / save-PDF

## Mandatory numeric state set

For each relevant numeric field, compare at least:

1. blank
2. zero
3. smallest valid positive value
4. normal field value
5. decimal where allowed
6. very large value
7. negative value
8. invalid/non-numeric input where the platform permits it

## Production safety / promotion rule

No production change is authorized by this matrix. LIVE remains reference-only until explicit owner approval.

No release is synchronized while any required shared-core row remains NOT YET VERIFIED, while physical-device acceptance remains unresolved, or while the independent deployments do not report the same intentionally promoted shared-core fingerprint.

Unrelated FIRE Business App / v138 Cloudflare/D1/Doomsday work in the same repository is outside this calculator matrix and must not be used as calculator parity evidence.
