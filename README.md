# First In Response Exteriors — Independent Website

Independent disaster-recovery and hosting repository for First In Response Exteriors.

The purpose of this repository is to keep the business website usable independently of ChatGPT. The current production website at `firstinresponseexteriors.com` is separate and should remain untouched until this mirror has been visually and functionally verified.

## Current safety state

- GitHub Pages mirror can be tested independently.
- No `CNAME` file is present, so this repository is not claiming the production domain.
- The mirror currently uses `noindex,nofollow` and a blocking `robots.txt` so it does not compete with the production site in search.
- Do **not** remove those protections until the repository is intentionally being promoted to production.

## What is already functional

- Mobile header/navigation
- Call, text, and email actions
- Instant estimator with closed service accordions
- Synchronized +/× accordion indicators, selected-service counter, final selection-and-quantity recap, full-row discount selection, non-negative quantity protection, polite live-result announcements, and one-tap Clear selections control
- iPhone-safe sticky estimate positioning, summary navigation offset, and narrow-screen estimator sizing
- Known-rate calculations, $150 minimum, and 5% first responder/military discount
- Smart estimator-to-SMS handoff
- Personalized-estimate-to-SMS handoff
- Draggable before/after proof
- Six On-the-Job videos
- Review, privacy, and service-terms pages at the current production routes
- Direct Google, Facebook, and Yelp review destinations
- Nine dedicated service pages
- Exact truck/equipment image section
- Homepage content flow aligned to the verified current production structure
- Tulsa-area service coverage section near the bottom of the homepage
- Keyboard-accessible before/after sliders and estimator accordions

## Integrity check

The homepage currently references 23 approved local media assets, and the independent verifier enforces that exact inventory—including all six videos, exact owner and equipment images, and every approved before/after pair. It also checks minimum file sizes and media integrity. Two approved masonry proof assets are protected by exact Git blob hashes because their stored bytes do not use a standard JPEG signature; any change to either file causes recovery verification to fail. The latest repository audit confirmed the rebuild has one proper homepage H1, no duplicate HTML IDs, no broken local page/anchor/media references, and temporary noindex protection remains enabled. All public-page hamburger controls keep their expanded state and Open/Close accessible label synchronized.

## Rebuild coverage

Current independent rebuild: **13 public-facing pages represented**.

- Homepage
- Review page
- Privacy notice
- Service terms (`/service-terms/`; legacy `/terms/` redirect retained)
- House washing
- Roof cleaning
- Concrete cleaning
- Gutter cleaning
- Exterior window cleaning
- Fence & deck cleaning
- Underground downspout / French drain flushing
- Dryer vent cleaning
- Rust stain removal

All current pages use the FIRE branding, mobile call/estimate actions, temporary search-index protection, and shared navigation back into the main site. The nine service pages also use the shared FIRE header/menu and footer.

## Exact-media reconstruction status

Confirmed exact/current-site media already represented in the rebuild:
- Driveway before/after
- Walkway before/after
- Gutter brightening before/after
- Exterior window before/after
- Owner image
- Current On-the-Job process clips

Intentional new proof additions:
- House-washing video
- Gutter-cleaning video
- Masonry/fireplace before/after
- Front-patio / house-wash before/after
- Cobweb-removal before/after

The original **truck + pressure washer + surface-cleaner equipment photo** has been visually matched and is installed as `assets/equipment-truck.jpg`; no similar-image substitution is being used.

## Durable business configuration

Current customer-facing pricing, payment/discount rules, service limitations, and the rule for future pricing changes are recorded in `BUSINESS_RULES.md`. The approved payment rule is a 50% deposit to reserve approved work on the schedule, with the remaining balance due upon completion of the work. This keeps the website's operating assumptions recoverable even if the estimator code has to be rebuilt later.

## Independent verification command

After cloning or downloading this repository, run:

```bash
node verify-site.mjs
```

No package installation or ChatGPT access is required. The command exits with an error if it finds broken local links or media references, script syntax problems, incorrect page counts or canonicals, stale gutter rates, missing contact or mobile conversion controls, incorrect estimator or dedicated-service pricing, broken iPhone SMS handling, missing search-index protection, a premature `CNAME`, or a regression in the $150 minimum. A clean run prints each passed check and exits successfully.

GitHub Actions runs the recovery verifier automatically on every push to `main` and on every pull request through `.github/workflows/verify-site.yml`.

For successful `main` builds, the workflow also creates a complete verified ZIP recovery artifact and retains it in GitHub Actions for 90 days. Backup creation is skipped if verification fails.

A separate copy of the latest verified build is also stored outside GitHub in Google Drive under `FIRE Business Backups`, providing a second recovery location.

## Disaster recovery instructions

`DISASTER_RECOVERY.md` is the standalone restore runbook. It is written so the website can be recovered without ChatGPT and explains:

- where the independent source and off-GitHub backup live,
- how to validate a recovered copy,
- how to restore to a temporary host first,
- which pricing and business rules are locked,
- what must remain blocked before production cutover,
- and how to avoid changing live DNS prematurely.

## Completion and verification records

A plain-English project status and remaining-work checklist is recorded in `COMPLETION_STATUS.md`.

The latest source-level audit and estimator spot checks are recorded in `VERIFICATION_SNAPSHOT.md`.

## Before any production cutover

Follow `PRODUCTION_CUTOVER.md`. Do not change DNS first. Verify the temporary GitHub Pages version on a physical iPhone and desktop before moving the domain.

## Recovery principle

The website source, media, estimator, pricing logic, verification tools, recovery instructions, and verified backup packages now exist outside ChatGPT. ChatGPT is not required for the published GitHub Pages mirror to remain online or for the website to be restored from the saved recovery files.
