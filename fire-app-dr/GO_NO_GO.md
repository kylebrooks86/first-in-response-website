# FIRE App v138 — Independent Recovery Go / No-Go Gate

## Source package status

**GO for isolated staging preparation** only when all local gates pass:

```sh
npm run release:evidence-seal:check
npm run preflight:independent
npm run release:readiness
npm run release:sync-check
npm run release:strict-parity
```

A passing strict-parity governance gate does **not** mean rendered parity is complete. The current status must remain `NOT_YET_FULLY_VERIFIED` until all required LIVE and independent screenshots are captured and compared.

## NO-GO for operational promotion until

- isolated Cloudflare Worker/D1/R2 deployment is complete;
- staging uses only disposable data;
- `STAGING_ACCEPTANCE_TEST.md` passes;
- owner authentication and logout are verified;
- current 21 migrations (`0000` through `0020`) are applied in order;
- backup and photo recovery drills pass;
- Stripe, if tested, uses test mode only;
- required independent parity evidence is captured and compared;
- no production domain, production D1 database, or production R2 bucket is attached.

## Production safety

Do not:
- attach `firstinresponseexteriors.com` during staging;
- import real customer data before explicit owner approval;
- reuse production Cloudflare resources;
- enable live Stripe charging during initial staging validation.

## Promotion rule

Operational independent recovery is GO only after the isolated deployment, acceptance checklist, recovery drills, and required parity verification have all passed.
