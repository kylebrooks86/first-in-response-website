# FIRE Business App — isolated source integration review on main (Nov 4, 2026)

**Status: DRAFT SOURCE REVIEW ONLY. NO MERGE, NO DEPLOYMENT, NO DATABASE/STRIPE ACTION, NO RELEASE GATE ACCEPTANCE.**

## Why this branch exists

The Nov 4 app draft head `5957892c56607ef010e6b1f284fd8b790cdeed8e` (PR #148) is not an ordinary up-to-date branch of `main`. The read-only GitHub compare showed **4,372 candidate-only commits and 33 main-only commits** as of this snapshot. The main-only commits include the Oct 24 website/gutter-brightening restoration and calculator/DR updates. A blind merge of the draft history would risk mixing the public site and app workflows.

This separate branch starts from the exact verified **main commit `a6311ccb5e2395c14632d47bf27054a47f10c38c`**, and transplants only the reviewed app-related Git trees from #148:

| Included source subtree | Exact #148 Git tree SHA |
|---|---|
| `business-app-parity` | `5dbe8950f9b164400590717605810a2315cbd2d2` |
| `fire-app-dr` | `9bfa6cb036ea7c822347c3f46ed4d5d9ad7905b8` |
| `dr-parity-evidence` | `838406d7bd0183eb3f2a388701a614f5bad61e1f` |
| `dr-parity-overlays` | `49df6f1b542abfbb2a293f493fb48376fa8a2406` |

Only five already-reviewed, read-only / synthetic GitHub workflows are carried over:
`fire-staging-offline-rehearsal.yml`,
`fire-numbered-core-recovery-v2-preflight.yml`,
`fire-numbered-v2-photo-archive-pair.yml`,
`fire-gate4-provider-identity-preflight.yml`,
and `fire-qa-release-review-fail-closed.yml`.
A new `fire-app-only-public-scope.yml` makes GitHub reject unexpected non-app changes or ANY differences in protected website/calculator Git objects relative to the target main branch.

**Deliberately not imported:** candidate-root `index.html`, `assets/`, `services/`, `calculator/`, `privacy/`, `review/`, `service-terms/`, public-site metadata or public website check scripts. No public website verification is disabled. Other historical app workflows are not automatically imported because they have not yet been individually re-reviewed for safe CI permissions and unintended writes.

## Proof already checked before Git commit

Compared and found the main Git-tree SHA **identical** for: `assets`, `calculator`, `index.html`, `services`, `privacy`, `review`, `recent-work`, `robots.txt`, `sitemap.xml`, `terms`, and `service-terms`. The branch was based on current main rather than attempting to merge 4,372 existing development commits. The CI guard will repeat this check on pull requests.

## Explicit limits and release decision

- This is a **proposed source-only integration PR**, not acceptance that the entire app is safe to run or that all 59+ older draft PRs are individually merged. Do not mechanically merge all old drafts after this snapshot or assume all 17 non-ancestor alternatives should be copied.
- **Never merge this source PR without separate owner approval, reviewed diff, current main site lock, audit of all required materialized QA/DR build inputs and target exact SHA, and an explicit release plan.** Recheck that the branch remains current to main before making any merge decision.
- Missing site/gutter/calculator files must not be reintroduced from the stale candidate history.
- No hosted QA, Stripe TEST Worker, refund-staging, Doomsday or LIVE source has been changed.
- **Formal release 3/10 accepted; Gates 4–10 OPEN; production NO-GO.** Provider-attested LIVE/refund-staging D1 UUIDs and served artifacts, LIVE refund schema, authenticated share denials, full private photo custody, iPhone acceptance, Stripe signed TEST events/ledger, and final backups/rollback remain outstanding.

The source has a safe, reviewable app-only landing path now. This is not permission to release it.
