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
- Known-rate calculations, $150 minimum, and 5% first responder/military discount
- Smart estimator-to-SMS handoff
- Personalized-estimate-to-SMS handoff
- Draggable before/after proof
- Six On-the-Job videos
- Review page
- Gutter, roof, and concrete service pages

## Integrity check

The homepage currently references 22 local media assets. The latest repository audit confirmed all 22 referenced files exist, with no duplicate HTML IDs and no missing in-page anchor targets.

## Before any production cutover

Follow `PRODUCTION_CUTOVER.md`. Do not change DNS first. Verify the temporary GitHub Pages version before moving the domain.

## Recovery principle

The website source, media, pricing logic, and recovery instructions live in this GitHub repository. ChatGPT is not required for the already-published repository to continue existing or serving files from GitHub.
