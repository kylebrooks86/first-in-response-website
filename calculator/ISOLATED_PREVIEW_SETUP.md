# Isolated FIRE Calculator staging preview

The workflow at `.github/workflows/calculator-isolated-preview.yml` is now committed on the staging branch. It is deliberately manual. It publishes **only** the `calculator/` staging candidate to a separate Cloudflare Pages **preview** project, never GitHub Pages, LIVE, or the existing Doomsday deployment.

## One-time setup (Cloudflare free tier)

1. In Cloudflare Pages, create a **new, distinct** project named `fire-calculator-best-of-both-preview`. Do not use or modify any existing project.
2. Create a scoped Cloudflare API token with **Cloudflare Pages: Edit** for the relevant account. Add repository Actions secrets `FIRE_STAGING_CF_API_TOKEN` and `FIRE_STAGING_CF_ACCOUNT_ID`. Do not put secrets in source.
3. In GitHub Actions select **FIRE Calculator Isolated Preview**, choose the `fire-calculator-best-of-both` branch, and run it manually.
4. The workflow runs staging contract/formula tests, uploads only the staged calculator plus logo to the separately named Pages project, and then smoke-checks `https://fire-calculator-best-of-both-preview.pages.dev/calculator/`. Do not assume that URL exists or works until the workflow reports success. The branch deployment may also have its own unique preview URL; confirm its source commit before phone acceptance.
5. Use a copy of any important calculator backup for physical iPhone testing. Verify the URL and service-worker generation 202 before testing.

The workflow requires the exact branch and a deliberately named distinct Pages project, checks the calculator contract before deployment, and packages only calculator assets plus its logo. It does not change repository Pages settings, DNS, production branches, or any other Cloudflare project. It does not run automatically on pushes.

**STAGING CANDIDATE ONLY — NOT SYNCHRONIZED.**
