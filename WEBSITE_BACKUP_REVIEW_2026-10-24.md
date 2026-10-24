# Website recovery review — October 24, 2026

Scope: independent GitHub Pages website only. This is a proposed, unmerged correction, not a production cutover. The ChatGPT Sites LIVE website is separate. No FIRE Business App files, customer records, databases, hosting settings, DNS or deployment workflows are changed here.

## Confirmed public checks

- LIVE homepage already has the requested Pressure Washing Tulsa title and exact approved description, plus its visible pressure-washing introduction.
- All ten LIVE service routes, Recent Work, Privacy and Service Terms return HTTP 200.
- The GitHub Pages copy returns HTTP 404 for `/services/gutter-brightening`; the other nine service routes, Recent Work, Privacy and Service Terms return HTTP 200.
- Existing backup service/menu links labeled Recent Work lead to the homepage's `#on-the-job` video section, even though the independent `/recent-work/` page exists.
- Backup homepage lacks a direct gutter-brightening service link.
- Backup public pages retain `noindex,nofollow`; the existing project `robots.txt` contains `User-agent: *` and `Disallow: /`. No CNAME is present.

## Corrections prepared in this draft

- Restore the missing gutter-brightening page using the existing independent service shell, CSS, logo, menu, footer, mobile controls and SMS handling. Copy its service description, limitations and FAQ answers from the current LIVE source, including the new photo-estimate guidance. This page references only local runtime assets.
- Add a gutter-brightening link within the existing homepage gutter-care card and a gutter-cleaning link from the restored page.
- Repair existing Recent Work menu destinations to use the independent gallery page, retaining the same menu labels/order.
- Update the independent verifier to require all ten LIVE service routes explicitly, including the formerly missing route; check the new homepage link and 15-page inventory. Existing sitemap inventory stays at 14 because indexing controls and sitemap changes are outside this draft's scope.

## Differences deliberately left for separate review

The independent backup is a recovery implementation, not an exact current LIVE export. Its homepage title/description and short service-page copy predate the current LIVE SEO content. In particular:

- The backup roof page uses general low-rise access language and a general scheduled-visit minimum; LIVE explicitly limits standard roof service to accessible one-story asphalt-shingle roofs with a roof-specific minimum.
- The backup window page describes exterior cleaning; LIVE also describes optional interior glass, screens, frame/sill work and specialty treatment.
- Dryer vent, drain and rust pages have shorter descriptions and fewer qualification details than LIVE; the 40-foot dryer-tool and 100-foot jetter limits agree.
- Backup Service Terms omit the Cash App/Venmo list present on LIVE.
- The backup homepage lacks the current LIVE service-finder helper. It retains its own estimator and photo-estimate path.
- Existing financial rules, deposits, estimator code and customer-facing rates were preserved, not reconciled automatically.

Do not describe this draft as full website parity. These broader content/financial differences need a separately scoped review before any recovery cutover.

## Verification

`node verify-site-ci.mjs` passes. It validates 15 public pages, all ten services, 244 internal links/anchors, 62 local media references, inline script syntax, call/SMS/mobile controls, existing canonicals, noindex, no CNAME, and locked estimator calculations/rates. The repository already has a narrow CI exception for two masonry media files whose bytes match approved Git blobs; this draft preserves those bytes and that exception unchanged.

Additional comparison confirmed all pre-existing scripts, conversion controls, pricing data, existing canonicals, robots directives, sitemap and media were unchanged. Source/link checks are not a claim of physical iPhone visual testing.

## Approval boundary

This draft does not publish the recovery website. Do not merge or publish it until Kyle explicitly approves this reviewed correction. Do not remove noindex, change indexing directives, attach the LIVE domain, or change deployment/DNS as part of approval for these page/link repairs.
