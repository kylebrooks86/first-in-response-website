FIRE Field Calculator v18 — Standalone Offline Build

This folder contains the current standalone FIRE Field Calculator hosted under the existing GitHub Pages recovery site. It is isolated under /calculator/ and does not change the production website domain, DNS, or root homepage.

Purpose
- Mobile-first field calculator for First In Response Exteriors.
- Works as a Progressive Web App after it has been opened online once and cached.
- Does not require ChatGPT or a ChatGPT sign-in to run.
- Device-local data includes calculator settings, saved rates, estimate draft, mix history, custom chemicals, inventory, field-tool settings, and other FIRE v18 local state.
- Export Backup / Restore Backup can move supported device-local data between installs.

Core files
- index.html
- manifest.webmanifest
- sw.js
- full-v18.js
- full-v18-core.js
- full-v18-parity-core.js
- v18-behavior.js
- v18-interactions.js
- v18-fine-parity.js
- v18-equipment-parity.js
- v18-tools-state.js

Disaster recovery
1. Keep a copy of this entire calculator folder together.
2. Serve the folder over HTTPS or localhost; service workers do not run from a normal file:// URL.
3. Open index.html through that server once while online so the service worker can cache the offline package.
4. On iPhone, use Share → Add to Home Screen.
5. Open the installed calculator online once after an update, then close it and test in Airplane Mode.

Current business rules retained in the v18 calculator include the $150 minimum job and 50% deposit to get on the schedule. Rates without an approved default remain unset until manually configured.
