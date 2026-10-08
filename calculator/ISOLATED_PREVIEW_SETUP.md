# Isolated FIRE Calculator staging preview

This workflow is deliberately manual. It publishes **only** the `calculator/` staging candidate to a separate Cloudflare Pages **preview** project, never GitHub Pages, LIVE, or the existing Doomsday deployment.

## One-time setup (Cloudflare free tier)

1. In Cloudflare Pages, create a **new, distinct** project named `fire-calculator-best-of-both-preview`. Do not use or modify any existing project.
2. Create a scoped Cloudflare API token with **Cloudflare Pages: Edit** for the relevant account. Add repository Actions secrets `FIRE_STAGING_CF_API_TOKEN` and `FIRE_STAGING_CF_ACCOUNT_ID`. Do not put secrets in source.
3. In GitHub Actions select **FIRE Calculator Isolated Preview**, choose the `fire-calculator-best-of-both` branch, and run it manually.
4. The preview address will be the distinct Cloudflare Pages project's domain, under `/calculator/`. Confirm it is not LIVE or the existing Doomsday URL. Run `node calculator/tests/staging-deployment-smoke.mjs https://YOUR-NEW-PREVIEW.pages.dev/calculator/` and record the results before iPhone acceptance.

The workflow requires the exact branch and a deliberately named distinct Pages project, checks the calculator contract before deployment, and packages only calculator assets plus its logo. It does not change repository Pages settings, DNS, production branches, or any other Cloudflare project. It does not run automatically on pushes.

**STAGING CANDIDATE ONLY — NOT SYNCHRONIZED.**
