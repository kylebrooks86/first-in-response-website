#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const errors = [];
const checks = [];

function pass(message) {
  checks.push(message);
}

function fail(message) {
  errors.push(message);
}

function walk(directory) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(absolute));
    else found.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return found;
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function idsIn(html) {
  return [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
}

function resolveLocal(pagePath, rawReference) {
  const [withoutHash, hash = ''] = rawReference.split('#');
  const withoutQuery = withoutHash.split('?')[0];
  const base = withoutQuery.startsWith('/') ? '' : path.posix.dirname(pagePath);
  let target = path.posix.normalize(path.posix.join(base, withoutQuery));
  if (target === '.') target = '';
  if (!withoutQuery || withoutQuery.endsWith('/') || !path.posix.extname(target)) {
    target = path.posix.join(target, 'index.html');
  }
  return { target: target.replace(/^\//, ''), hash };
}

const allFiles = walk(root);
const fileSet = new Set(allFiles);
const htmlFiles = allFiles.filter((file) => file.endsWith('.html'));
const publicPages = htmlFiles.filter((file) => file !== '404.html' && file !== 'terms/index.html');

if (fileSet.has('CNAME')) fail('CNAME exists before an approved production cutover.');
else pass('No CNAME file is present.');

const robots = read('robots.txt');
if (/User-agent:\s*\*/i.test(robots) && /Disallow:\s*\//i.test(robots)) pass('robots.txt blocks crawling.');
else fail('robots.txt does not block all crawling.');

if (publicPages.length === 13) pass('Exactly 13 public-facing pages are represented.');
else fail(`Expected 13 public-facing pages; found ${publicPages.length}.`);

const sitemapCount = (read('sitemap.xml').match(/<loc>/g) || []).length;
if (sitemapCount === 13) pass('sitemap.xml contains 13 production URLs.');
else fail(`Expected 13 sitemap URLs; found ${sitemapCount}.`);

let internalLinks = 0;
let mediaReferences = 0;
let inlineScripts = 0;
let canonicalPages = 0;
let contactPages = 0;
let mobileControlPages = 0;
let emailPages = 0;
let externalRuntimeAssets = 0;

for (const page of htmlFiles) {
  const html = read(page);
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count !== 1) fail(`${page}: expected one H1; found ${h1Count}.`);

  if (!/<meta\s+name=["']robots["']\s+content=["']noindex,nofollow["']/i.test(html)) {
    fail(`${page}: missing noindex,nofollow protection.`);
  }

  const ids = idsIn(html);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) fail(`${page}: duplicate IDs: ${duplicateIds.join(', ')}.`);
  const remoteSources = [...html.matchAll(/\s(?:src|poster)=["'](?:https?:)?\/\//gi)];
  const remoteStyles = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'](?:https?:)?\/\//gi)];
  const remoteCssUrls = [...html.matchAll(/(?:@import\s+url\(|url\()\s*["']?(?:https?:)?\/\//gi)];
  const remoteRuntimeCount = remoteSources.length + remoteStyles.length + remoteCssUrls.length;
  externalRuntimeAssets += remoteRuntimeCount;
  if (remoteRuntimeCount) fail(`${page}: found ${remoteRuntimeCount} external runtime asset reference(s).`);

  if (publicPages.includes(page)) {
    const canonicalMatches = [...html.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/gi)];
    const route = page === 'index.html' ? '' : page.replace(/index\.html$/, '');
    const expectedCanonical = `https://firstinresponseexteriors.com/${route}`.replace(/\/$/, '');
    const actualCanonical = canonicalMatches[0]?.[1]?.replace(/\/$/, '');
    if (canonicalMatches.length === 1 && actualCanonical === expectedCanonical) canonicalPages += 1;
    else fail(`${page}: canonical URL is missing, duplicated, or incorrect.`);

    if (html.includes('href="tel:+19189229366"') && html.includes('sms:+19189229366')) contactPages += 1;
    else fail(`${page}: missing the approved phone or SMS action.`);

    const bottom = html.match(/<div\s+class=["']bottom["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
    if (/\bCall\b/i.test(bottom) && /Text\s+photos/i.test(bottom) && /\bEstimate\b/i.test(bottom) &&
        html.includes('id="menu-toggle"') && html.includes('aria-controls="site-menu"')) {
      mobileControlPages += 1;
    } else fail(`${page}: mobile menu or Call / Text photos / Estimate controls are inconsistent.`);

    if ((page === 'index.html' || page.startsWith('services/')) &&
        html.includes('href="mailto:kyle@firstinresponseexteriors.com"')) emailPages += 1;
  }

  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    inlineScripts += 1;
    try {
      new Function(match[1]);
    } catch (error) {
      fail(`${page}: inline script syntax error: ${error.message}`);
    }
  }

  for (const match of html.matchAll(/\shref=["']([^"']+)["']/gi)) {
    const href = match[1];
    if (/^(?:https?:|tel:|mailto:|sms:|javascript:|\/\/)/i.test(href)) continue;
    internalLinks += 1;
    const { target, hash } = resolveLocal(page, href);
    if (!fileSet.has(target)) {
      fail(`${page}: missing internal target ${href} -> ${target}.`);
      continue;
    }
    if (hash && target.endsWith('.html')) {
      const decodedHash = decodeURIComponent(hash);
      if (!idsIn(read(target)).includes(decodedHash)) fail(`${page}: missing anchor ${href}.`);
    }
  }

  for (const match of html.matchAll(/\s(?:src|poster)=["']([^"']+)["']/gi)) {
    const source = match[1];
    if (/^(?:https?:|data:|\/\/)/i.test(source)) continue;
    mediaReferences += 1;
    const { target } = resolveLocal(page, source);
    if (!fileSet.has(target)) fail(`${page}: missing media ${source} -> ${target}.`);
  }
}

pass(`${htmlFiles.length} HTML files have one-H1, duplicate-ID, noindex, and script checks.`);
pass(`${internalLinks} internal links and anchors were checked.`);
pass(`${mediaReferences} local image/video references were checked.`);
pass(`${inlineScripts} inline scripts compiled.`);
if (externalRuntimeAssets === 0) pass('All pages are self-contained with no external script, stylesheet, image, video, or CSS asset dependencies.');
if (canonicalPages === 13) pass('All 13 public pages have the expected production canonical URL.');
if (contactPages === 13) pass('All 13 public pages contain the approved call and SMS destinations.');
if (mobileControlPages === 13) pass('All 13 public pages have consistent mobile menu and sticky conversion controls.');
if (emailPages === 10) pass('Homepage and all nine service pages contain the approved business email action.');

const index = read('index.html');

const expectedHomepageMedia = [
  'assets/logo.jpg',
  'assets/driveway-before.jpg',
  'assets/driveway-after.jpg',
  'assets/walkway-before.jpg',
  'assets/walkway-after.jpg',
  'assets/gutter-brightening-before.jpg',
  'assets/gutter-brightening-after.jpg',
  'assets/window-before.jpg',
  'assets/window-after.jpg',
  'assets/front-patio-before.jpg',
  'assets/front-patio-after.jpg',
  'assets/surface-cleaner-restoration.mp4',
  'assets/even-surface-cleaning.mp4',
  'assets/turbo-nozzle.mp4',
  'assets/concrete-pretreatment.mp4',
  'assets/house-wash.mp4',
  'assets/gutter-cleaning.mp4',
  'assets/masonry-before.jpg',
  'assets/masonry-after.jpg',
  'assets/cobweb-before.jpg',
  'assets/cobweb-after.jpg',
  'assets/equipment-truck.jpg',
  'assets/owner.jpg'
];
const actualHomepageMedia = new Set(
  [...index.matchAll(/(?:src|poster)=["'](assets\/[^"']+)["']/g)].map((match) => match[1])
);
const missingHomepageMedia = expectedHomepageMedia.filter((file) => !actualHomepageMedia.has(file) || !fileSet.has(file));
const unexpectedHomepageMedia = [...actualHomepageMedia].filter((file) => !expectedHomepageMedia.includes(file));
if (actualHomepageMedia.size === 23 && !missingHomepageMedia.length && !unexpectedHomepageMedia.length) {
  pass('Homepage retains the exact approved 23-file media inventory, including six videos.');
} else {
  fail('Homepage media inventory changed. Missing: ' + (missingHomepageMedia.join(', ') || 'none') +
    '; unexpected: ' + (unexpectedHomepageMedia.join(', ') || 'none') + '.');
}

const mediaIntegrityErrors = [];
for (const file of expectedHomepageMedia) {
  const absolute = path.join(root, file);
  const bytes = fs.readFileSync(absolute);
  if (bytes.length < 1024) {
    mediaIntegrityErrors.push(`${file} is unexpectedly small (${bytes.length} bytes)`);
    continue;
  }
  if (file.endsWith('.jpg') && bytes.subarray(0, 3).toString('hex') !== 'ffd8ff') {
    mediaIntegrityErrors.push(`${file} does not have a valid JPEG signature`);
  }
  if (file.endsWith('.mp4') && bytes.subarray(4, 8).toString('ascii') !== 'ftyp') {
    mediaIntegrityErrors.push(`${file} does not have a valid MP4 signature`);
  }
}
if (!mediaIntegrityErrors.length) pass('All 23 approved homepage media files are non-empty and have valid JPEG or MP4 signatures.');
else fail('Homepage media integrity failed: ' + mediaIntegrityErrors.join('; ') + '.');

const rules = read('BUSINESS_RULES.md');
const gutterPage = read('services/gutter-cleaning/index.html');
const housePage = read('services/house-washing/index.html');
const windowPage = read('services/window-cleaning/index.html');
const fencePage = read('services/fence-deck-cleaning/index.html');
const concretePage = read('services/concrete-cleaning/index.html');
const verification = read('VERIFICATION_SNAPSHOT.md');
const cutover = read('PRODUCTION_CUTOVER.md');
const recoveryText = [index, rules, gutterPage, verification, cutover].join('\n');


const expectedEstimatorRates = {
  'House wash': 0.22,
  'Gutter cleaning & downspout flushing': 1.50,
  'Remove & reinstall existing gutter guards — required when applicable': 0.50,
  'Gutter brightening': 2.00,
  'Fence cleaning': 0.40,
  '1st-floor standard exterior window cleaning': 7,
  '2nd-floor standard exterior window cleaning': 11,
  '1st-floor French-pane window cleaning': 12,
  '2nd-floor French-pane window cleaning': 18,
  '1st-floor window screen cleaning': 3,
  '2nd-floor window screen cleaning': 6,
  'Basic RV wash': 150
};

const configBlock = index.match(/var configs=\{([\s\S]*?)\n  \};/)?.[1] || '';
const parsedEstimatorRates = {};
for (const match of configBlock.matchAll(/'([^']+)'\s*:\s*\{[^}]*rate\s*:\s*([0-9.]+)/g)) {
  parsedEstimatorRates[match[1]] = Number(match[2]);
}
const badRates = Object.entries(expectedEstimatorRates).filter(([name, rate]) => parsedEstimatorRates[name] !== rate);
if (!badRates.length) pass('All 12 locked estimator rates match BUSINESS_RULES.md.');
else fail('Estimator rate mismatch: ' + badRates.map(([name, rate]) => name + ' should be ' + rate).join('; ') + '.');

function calculateEstimate(items, eligibleDiscount = false) {
  let subtotal = 0;
  for (const [name, quantity] of items) subtotal += parsedEstimatorRates[name] * quantity;
  if (eligibleDiscount) subtotal *= 0.95;
  const total = subtotal > 0 ? Math.max(150, subtotal) : 0;
  return {
    subtotal,
    total,
    low: total ? Math.max(150, Math.round(total * 0.95)) : 0,
    high: total ? Math.round(total * 1.05) : 0
  };
}

const houseTest = calculateEstimate([['House wash', 1700]]);
const gutterTest = calculateEstimate([
  ['Gutter cleaning & downspout flushing', 150],
  ['Remove & reinstall existing gutter guards — required when applicable', 150]
]);
const discountTest = calculateEstimate([
  ['Gutter cleaning & downspout flushing', 150],
  ['Remove & reinstall existing gutter guards — required when applicable', 150]
], true);
const minimumTest = calculateEstimate([['Fence cleaning', 100]]);
const rvTest = calculateEstimate([['Basic RV wash', 1]]);
if (
  houseTest.total === 374 && houseTest.low === 355 && houseTest.high === 393 &&
  gutterTest.total === 300 && gutterTest.low === 285 && gutterTest.high === 315 &&
  discountTest.total === 285 && discountTest.low === 271 && discountTest.high === 299 &&
  minimumTest.subtotal === 40 && minimumTest.total === 150 && minimumTest.low === 150 && minimumTest.high === 158 &&
  rvTest.total === 150
) pass('Independent estimator calculations pass house, gutter, discount, minimum, range, and fixed-price tests.');
else fail('One or more independent estimator calculation scenarios failed.');

if (index.includes("rate:1.50") && index.includes("rate:0.50")) pass('Estimator uses the current gutter rates.');
else fail('Estimator gutter rates do not match $1.50/$0.50.');

if (rules.includes('$1.50 / linear ft') && rules.includes('$0.50 / linear ft')) pass('BUSINESS_RULES.md uses the current gutter rates.');
else fail('BUSINESS_RULES.md gutter rates are incorrect.');

if (gutterPage.includes('$1.50 per linear ft') && gutterPage.includes('$0.50 per linear ft')) pass('Gutter service page uses the current rates.');
else fail('Gutter service page rates are incorrect.');

const servicePricingChecks = [
  housePage.includes('$0.22 per sq. ft.'),
  gutterPage.includes('$1.50 per linear ft') && gutterPage.includes('standard downspout flushing') &&
    gutterPage.includes('$0.50 per linear ft') && gutterPage.includes('New gutter-guard installation is not offered') &&
    gutterPage.includes('$2.00 per linear ft') && gutterPage.includes('tiger striping'),
  windowPage.includes('$7 each') && windowPage.includes('$11 each') &&
    windowPage.includes('$12 each') && windowPage.includes('$18 each') &&
    windowPage.includes('$3 each') && windowPage.includes('$6 each'),
  fencePage.includes('$0.40 per sq. ft.'),
  concretePage.includes('$175') && concretePage.includes('$75') && concretePage.includes('$25')
];
if (servicePricingChecks.every(Boolean)) pass('All dedicated pages with established pricing match BUSINESS_RULES.md.');
else fail('One or more dedicated service pages disagree with BUSINESS_RULES.md.');

const repositoryText = allFiles
  .filter((file) => /\.(?:html|md|mjs|txt|xml|yml|yaml)$/i.test(file))
  .map((file) => read(file))
  .join('\n');
if (/\$1\.75\b|\$1\.00\b|rate:1\.75\b|rate:1\.00\b/.test(repositoryText)) fail('A superseded gutter rate remains in repository text files.');
else pass('No superseded gutter rates remain anywhere in repository text files.');
const supersededHouseTokens = [
  String.fromCharCode(36) + '0.' + '25',
  'rate:' + '.' + '25',
  'rate:' + '0.' + '25'
];
if (supersededHouseTokens.some((token) => repositoryText.includes(token))) fail('A superseded house-wash rate remains in repository text files.');
else pass('No superseded house-wash rate remains anywhere in repository text files.');

if (index.includes('Math.max(150,Math.round(customerTotal*.95))')) pass('Displayed estimate ranges cannot fall below the $150 minimum.');
else fail('Estimator range is not clamped to the $150 minimum.');

const iosSmsBranches = (index.match(/ios\?'&body=':'\?body='/g) || []).length;
if (iosSmsBranches >= 3) pass('Estimator, personalized form, and text-photo handoffs retain iPhone-aware SMS formatting.');
else fail(`Expected at least three iPhone-aware SMS handoffs; found ${iosSmsBranches}.`);

const closedAccordionIcons = (index.match(/<span class="x" aria-hidden="true">\+<\/span>/g) || []).length;
if (
  closedAccordionIcons === 6 &&
  index.includes("icon.textContent=open?'×':'+'") &&
  index.includes('id="estimate-reset"') &&
  index.includes("resetButton.addEventListener('click'") &&
  index.includes('<strong role="status" aria-live="polite" aria-atomic="true">') &&
  index.includes('id="estimate-count"') &&
  index.includes("e.target.closest('input,label')") &&
  index.includes("Math.max(0,parseFloat(input.value)||0)") &&
  index.includes("discountBox.addEventListener('click'") &&
  index.includes('id="estimate-items"') &&
  index.includes("item.textContent=name+' — '+detail")
) pass('Estimator indicators, selection recap, selected-service counter, safe quantity handling, discount row, reset control, and live announcements are synchronized.');
else fail('Estimator interaction polish checks failed.');

if (
  index.includes('top:calc(104px + env(safe-area-inset-top))') &&
  index.includes('#summary{scroll-margin-top:230px}') &&
  index.includes('@media(max-width:600px)') &&
  index.includes('.live strong{font-size:clamp(30px,9vw,40px);white-space:nowrap}') &&
  index.includes('.acc.collapsed .x{transform:none}')
) pass('Estimator sticky offsets, summary navigation, and narrow-screen sizing are mobile-safe.');
else fail('Estimator mobile polish checks failed.');

const notFound = read('404.html');
if (notFound.includes('id="home-link"') && notFound.includes('href="tel:+19189229366"') && notFound.includes('href="sms:+19189229366"')) {
  pass('404 recovery page contains working home, call, and SMS actions.');
} else fail('404 recovery actions are incomplete.');

if (verification.includes('150 × $1.50 = $225.00') && verification.includes('$225.00 + $75.00 = $300.00') && verification.includes('$285.00 after rounding to cents')) {
  pass('Durable gutter calculation examples match the current rates.');
} else fail('Verification gutter calculation examples are stale.');

const paymentRule = 'A 50% deposit is required to reserve approved work on the schedule. The remaining balance is due upon completion of the work.';
if (recoveryText.includes(paymentRule)) pass('The approved deposit and remaining-balance wording is present.');
else fail('The approved payment wording is missing.');

console.log('FIRE independent website verification');
console.log(`Root: ${root}`);
for (const check of checks) console.log(`PASS: ${check}`);

if (errors.length) {
  console.error(`\nFAILED: ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS: ${checks.length} verification checks completed with no errors.`);
}
