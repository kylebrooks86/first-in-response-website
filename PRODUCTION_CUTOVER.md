# Production Cutover Checklist

Use this only if the independent GitHub rebuild is intentionally replacing the current production website.

## 1. Verify the mirror before touching DNS

Check the GitHub Pages URL on iPhone and desktop.

Verify:
- Homepage layout and section order
- Logo, owner image, and exact truck/equipment image
- Every before/after image and draggable reveal
- All six On-the-Job videos
- Mobile hamburger menu
- Sticky Call / Text Photos / Estimate actions
- Instant estimator calculations
- 5% first responder/military discount
- $150 minimum job behavior
- Current locked rates match `BUSINESS_RULES.md`, including $1.50/lf gutter cleaning and $0.50/lf existing-guard removal/reinstall
- Payment wording states that a 50% deposit reserves approved work on the schedule and the remaining balance is due upon completion
- Estimator-to-text message
- Personalized estimate form-to-text message
- Review, Privacy, and Service Terms pages, including the established `/service-terms` URL
- All nine dedicated service pages
- All internal links
- Phone number: 918-922-9366
- Email: kyle@firstinresponseexteriors.com

## 2. Preserve the current production site

Before changing domain records:
- Keep the current production site online.
- Save/export any production-only files or settings not already represented here.
- Record the current DNS records so they can be restored if needed.
- Do not delete the old hosting account during cutover.

## 3. Prepare this repository for production

Only when the mirror is approved:
1. Remove `<meta name="robots" content="noindex,nofollow">` from all public HTML pages.
2. Change `robots.txt` from `Disallow: /` to:
   ```
   User-agent: *
   Allow: /
   Sitemap: https://firstinresponseexteriors.com/sitemap.xml
   ```
3. Re-check `sitemap.xml` for every production page.
4. Confirm every public page has the intended `https://firstinresponseexteriors.com/...` canonical URL.
5. Add the production custom domain only at cutover time.
6. Verify HTTPS after the domain is connected.

## 4. DNS cutover

Change only the records required for the new host. Do not guess DNS values; use the current GitHub Pages custom-domain instructions shown in the repository settings at the time of cutover.

Keep the previous DNS values recorded until the new site is verified.

## 5. Post-cutover verification

Immediately verify:
- `https://firstinresponseexteriors.com`
- `https://www.firstinresponseexteriors.com`
- HTTPS certificate
- Homepage, all nine service pages, Review, Privacy, and `https://firstinresponseexteriors.com/service-terms`
- Estimator
- Call/text/email actions
- Review page and all three direct review destinations: Google, Facebook, and Yelp
- Videos and images
- Mobile layout
- Search Console ownership
- Sitemap accessibility
- No accidental `noindex` remains
- Canonical URLs resolve to the production domain
- Gutter estimator test: 150 lf × $1.50 = $225.00 before discounts/minimum adjustments
- Combined gutter test: $225.00 + $75.00 = $300.00 before discount
- Discount test: 5% eligible discount on $300.00 = $285.00 after rounding to cents
- House-wash estimator test: 1,700 sq ft = $425 before discounts

## 6. Rollback

If the production cutover fails:
1. Restore the previous DNS records.
2. Keep this GitHub repository unchanged as the recovery copy.
3. Re-test the issue on the GitHub Pages URL before attempting another cutover.

## Important

The current GitHub copy is intentionally blocked from search indexing while it is a mirror. Do not remove that protection early.
