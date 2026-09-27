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

const index = read('index.html');
const rules = read('BUSINESS_RULES.md');
const gutterPage = read('services/gutter-cleaning/index.html');
const verification = read('VERIFICATION_SNAPSHOT.md');
const cutover = read('PRODUCTION_CUTOVER.md');
const recoveryText = [index, rules, gutterPage, verification, cutover].join('\n');

if (index.includes("rate:1.50") && index.includes("rate:0.50")) pass('Estimator uses the current gutter rates.');
else fail('Estimator gutter rates do not match $1.50/$0.50.');

if (rules.includes('$1.50 / linear ft') && rules.includes('$0.50 / linear ft')) pass('BUSINESS_RULES.md uses the current gutter rates.');
else fail('BUSINESS_RULES.md gutter rates are incorrect.');

if (gutterPage.includes('$1.50 per linear ft') && gutterPage.includes('$0.50 per linear ft')) pass('Gutter service page uses the current rates.');
else fail('Gutter service page rates are incorrect.');

if (/\$1\.75\b|\$1\.00\b|rate:1\.75\b|rate:1\.00\b/.test(recoveryText)) fail('A superseded gutter rate remains in recovery-critical files.');
else pass('No superseded gutter rates remain in recovery-critical files.');

if (index.includes('Math.max(150,Math.round(customerTotal*.95))')) pass('Displayed estimate ranges cannot fall below the $150 minimum.');
else fail('Estimator range is not clamped to the $150 minimum.');

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
