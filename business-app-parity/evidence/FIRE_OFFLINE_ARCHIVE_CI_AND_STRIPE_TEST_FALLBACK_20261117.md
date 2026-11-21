# FIRE private archive regression and Stripe TEST fallback

November 17, 2026 CST. [Draft PR #270](https://github.com/kylebrooks86/first-in-response-website/pull/270).

The active PR no longer fetches expired historical artifacts 14101337096, 14101058770 and 14101977692. Exact private ZIPs passed offline (16/16 DR existing-D1, 28/28 DR DARK first-create, 31/31 NEW LIVE DARK). The Stripe TEST Worker-only fallback passed 24/24 offline and now verifies an external receipt SHA-256. **35/95 complete, 60 open, 4/10 formal gates accepted.**

## Archive regression

Commit [`42db9748157141306c3f1d22dff13eeb43c3c2c8`](https://github.com/kylebrooks86/first-in-response-website/commit/42db9748157141306c3f1d22dff13eeb43c3c2c8) moved the historical builder suites to a private local command and replaced the expired downloads with an active synthetic CI intake suite. The original length, SHA-256, CRC, target and inventory checks remain mandatory. The verifier parses the same bytes it hashes and runs the three unchanged suites in temporary directories. It checked all four private ZIPs, 41 client asset digests per target and 240/241 common file bytes per target. Current DR and NEW LIVE build workflows still exercise contemporary source. Historical failures remain in GitHub run history. [Private archive lineage](FIRE_EXPIRED_GITHUB_ORIGINAL_DR_NEWLIVE_ARCHIVES_RECOVERED_20261117.md)

```sh
python3 business-app-parity/verify_private_expired_source_archives.py --run-builder-tests DR_ORIGINAL.zip DR_PREHOST.zip LIVE_ORIGINAL.zip LIVE_PREHOST.zip
```

## Stripe TEST fallback

Commit [`4f89f99cf3016d4b6453ed5de17c683e1b3a30d5`](https://github.com/kylebrooks86/first-in-response-website/commit/4f89f99cf3016d4b6453ed5de17c683e1b3a30d5) adds receipt SHA-256 verification, prevents receipt-supplied paths from escaping the saved package inventory and rejects repeated or mislabeled binary asset modules. It runs the focused suite on the same-run rehydrated TEST build. The fallback review folder stays on the runner. The local package used the verified private 3,111,747-byte compiler archive for `240f337bce8a5afc854f12855a86fa9b3dc156ab`, SHA-256 `84cd49b3d07fe34989b42de0b8d893e7de421144c4d3bc95cd71bf1d37035ef1`. The existing ordinary candidate reproduced digest `dcb0ba6bcd08f4777345de7f8288498e1afffbfa50f6729655745a33d9db1705`. The separate Worker-only review verified 192 retained server files, 41 embedded assets and 239 package files. Its receipt SHA-256 is `41028a4172581154c49c621d2f72fefcb21a76114ca9d409117459e4bd845594`. It configures only TEST D1 and keeps Stripe and private activation blocked, with zero R2 and no assets session.

A misaligned public-scope workflow pin failed CI on the first commit. The second commit corrected it. At recording time the public-site and calculator safeguard was [success](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44033303753), synthetic intake CI was [success](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44033303806), and the full Gate 9 workflow was [success](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44033304024).

## Open release requirements

The hosted source, schema, ingress and access evidence for G4–G6 is blocked under the current session restrictions. G7 still needs genuine paired records/photos custody and restore. TEST provider HTTP 500/10013 and inactive-version HTTP 400 remain open. G9 requires fresh signed hosted deliveries, exact TEST D1 ledger evidence and separate exact authorization for any provider action. G10 requires predecessor gates and separate release approval. NEW LIVE remains DARK with first production Job #0001 inactive. No Cloudflare or Stripe sign-ins, provider changes, deployments, migrations or merges.
