import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startSyntheticCustomerPreview } from './serve-synthetic-customer-preview.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE || 'playwright');
const preview = await startSyntheticCustomerPreview();
const profile = mkdtempSync(join(tmpdir(), 'fire-screen-'));
let context, passed = 0; const remote = [], errors = [], checks = [];
const phrase = 'synthetic screen recovery phrase only';
async function check(name, fn) { await fn(); passed++; checks.push(name); console.log(`PASS: ${name}`); }
process.exitCode = 1;
try {
  context = await chromium.launchPersistentContext(profile, { executablePath: process.env.FIRE_BROWSER_TEST_EXECUTABLE || undefined,
    headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== preview.origin) { remote.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const p = await context.newPage(); p.on('pageerror', error => errors.push(error.message));
  const response = await p.goto(preview.origin); await p.waitForFunction(() => document.querySelector('#customers').dataset.localCustomerState === 'locked');
  await check('local review response has no-store and restrictive security headers', async () => {
    assert.equal(response.headers()['cache-control'], 'no-store'); assert.equal(response.headers()['x-content-type-options'], 'nosniff');
    assert.ok(response.headers()['content-security-policy'].includes("object-src 'none'"));
  });
  await check('first visit does not seed an encrypted snapshot', async () => {
    assert.equal(await p.getByLabel('New test phrase', { exact: true }).count(), 1);
    assert.match(await p.locator('#setup-status').innerText(), /No stored snapshot/);
    assert.equal(await p.locator('[data-customer-id]').count(), 0);
  });
  await check('explicit fixture creation clears phrase and starts locked', async () => {
    await p.getByLabel('New test phrase', { exact: true }).fill(phrase);
    await p.getByRole('button', { name: 'Create empty synthetic test vault' }).click();
    await p.waitForFunction(() => document.querySelector('#fixture').hidden);
    assert.equal(await p.locator('#fixture-phrase').inputValue(), ''); assert.equal(await p.locator('[data-customer-id]').count(), 0);
  });
  await p.getByLabel('Test recovery phrase', { exact: true }).fill(phrase);
  await p.getByRole('button', { name: 'Unlock local contacts' }).click();
  await p.waitForFunction(() => document.querySelector('#customers').dataset.localCustomerState === 'ready');
  await check('unlocked empty fixture accurately shows no contacts', async () => {
    assert.match(await p.locator('#customers').innerText(), /No local contacts in this unlocked vault/);
  });
  async function create(name) {
    await p.getByRole('button', { name: 'Add synthetic customer' }).click();
    await p.getByLabel('Name', { exact: true }).fill(name);
    await p.getByLabel('Test phrase for this local save', { exact: true }).fill(phrase);
    await p.getByRole('button', { name: 'Save locally', exact: true }).click();
    await p.waitForFunction(name => [...document.querySelectorAll('[data-customer-id] strong')].some(n => n.textContent === name), name);
  }
  await check('complete screen creates two encrypted contacts and displays receipts', async () => {
    await create('Synthetic Oak Lane'); await create('Synthetic Cedar Court');
    assert.equal(await p.locator('[data-customer-id]').count(), 2); assert.match(await p.locator('#customers').innerText(), /2 local operation receipts/);
  });
  for (const width of [320, 390, 768, 1280]) for (const theme of ['light', 'dark']) {
    await check(`${width}px ${theme} layout has no horizontal overflow or undersized controls`, async () => {
      await p.setViewportSize({ width, height: 844 });
      if (await p.locator('html').getAttribute('data-theme') !== theme) await p.locator('#theme').click();
      const violations = await p.evaluate(() => {
        const issues = []; if (document.documentElement.scrollWidth > innerWidth) issues.push('horizontal overflow');
        for (const node of document.querySelectorAll('button,input')) {
          const r = node.getBoundingClientRect(); if (!r.width || !r.height || node.closest('[hidden]')) continue;
          if (r.height < 44 || r.width < 44) issues.push('small control');
          if (r.left < -1 || r.right > innerWidth + 1) issues.push('control outside viewport');
        }
        return issues;
      }); assert.deepEqual(violations, []);
    });
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole('button', { name: 'Edit Synthetic Oak Lane', exact: true }).click();
  for (const theme of ['light','dark']) await check(`mobile ${theme} editor fits 320px and text contrast meets 4.5:1`, async () => {
    await p.setViewportSize({width:320,height:844});
    if(await p.locator('html').getAttribute('data-theme')!==theme)await p.locator('#theme').click();
    const issues=await p.evaluate(()=>{
      const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);
      const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
      const issues=[];
      if(document.documentElement.scrollWidth>innerWidth)issues.push('overflow');
      for(const n of document.querySelectorAll('p,label,strong,h1,h2,button,input,footer')){
        if(!n.getBoundingClientRect().width||n.closest('[hidden]')||n.tagName==='INPUT'&&!n.value)continue;
        let b=n,background=getComputedStyle(b).backgroundColor;
        while(background==='rgba(0, 0, 0, 0)'&&b.parentElement){b=b.parentElement;background=getComputedStyle(b).backgroundColor;}
        const a=lum(rgb(getComputedStyle(n).color)),z=lum(rgb(background));
        if((Math.max(a,z)+.05)/(Math.min(a,z)+.05)<4.5)issues.push(n.tagName+' low contrast');
      }return issues;
    });assert.deepEqual(issues,[]);
  });
  await p.setViewportSize({width:390,height:844});
  await check('mobile editor has labeled fields and visible keyboard focus', async () => {
    for (const label of ['Name', 'Email', 'Phone', 'Address', 'Lead source', 'Test phrase for this local save']) assert.equal(await p.getByLabel(label, { exact: true }).count(), 1);
    await p.getByLabel('Name', { exact: true }).focus(); await p.keyboard.press('Tab');
    assert.equal(await p.getByLabel('Email', { exact: true }).evaluate(n => n === document.activeElement), true);
    assert.equal(await p.getByLabel('Email', { exact: true }).evaluate(n => getComputedStyle(n).outlineStyle), 'solid');
  });
  await check('long synthetic values wrap without forcing sideways scrolling', async () => {
    await p.getByLabel('Name', { exact: true }).fill('Synthetic ' + 'longname'.repeat(80));
    await p.getByLabel('Test phrase for this local save', { exact: true }).fill(phrase);
    await p.getByRole('button', { name: 'Save locally', exact: true }).click();
    await p.waitForFunction(() => document.querySelector('#customers').innerText.includes('Revision 2'));
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.getByRole('button', {name:/^Edit Synthetic longname/}).click();
    await p.getByLabel('Name',{exact:true}).fill('Synthetic Oak Lane');
    await p.getByLabel('Test phrase for this local save',{exact:true}).fill(phrase);
    await p.getByRole('button',{name:'Save locally',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('#customers').innerText.includes('Revision 3'));
  });
  await check('mobile screen editing works offline after loading', async () => {
    await context.setOffline(true); await create('Synthetic Offline Contact'); await context.setOffline(false);
    assert.equal(await p.locator('[data-customer-id]').count(), 3);
  });
  await check('reload preserves fixture and cannot offer overwrite creation', async () => {
    await p.reload(); await p.waitForFunction(() => document.querySelector('#customers').dataset.localCustomerState === 'locked');
    assert.equal(await p.locator('#fixture').isVisible(), false); assert.match(await p.locator('#setup-status').innerText(), /test vault exists/);
    await p.getByLabel('Test recovery phrase', { exact: true }).fill(phrase); await p.getByRole('button', { name: 'Unlock local contacts' }).click();
    await p.waitForFunction(() => document.querySelectorAll('[data-customer-id]').length === 3);
  });
  await check('preview does not register a service worker or offer app/payment routes', async () => {
    assert.equal(await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
    for (const path of ['/api/customers', '/api/payments', '/worker.js']) assert.equal((await context.request.get(preview.origin + path)).status(), 404);
  });
  await check('sticky header stays visible at page bottom without viewport overflow', async () => {
    await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    assert.equal(await p.locator('.preview-topbar').evaluate(n=>Math.abs(n.getBoundingClientRect().top)<1),true);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  });
  await check('screen remains isolated with no script errors', async () => { assert.deepEqual(remote, []); assert.deepEqual(errors, []); });
  if (process.env.FIRE_PREVIEW_SCREENSHOT_DIR) {
    for (const theme of ['light', 'dark']) {
      if (await p.locator('html').getAttribute('data-theme') !== theme) await p.locator('#theme').click();
      await p.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
      await p.screenshot({ path: join(process.env.FIRE_PREVIEW_SCREENSHOT_DIR, `customers-mobile-${theme}.png`), fullPage: true });
    }
  }
  console.log(JSON.stringify({ passed, total: passed, checks, browserVersion: context.browser().version(), nativeIndexedDB: true,
    nativeWebCrypto: true, viewportWidths: [320,390,768,1280], themes: ['light','dark'], physicalMobileTested: false, productionActivated: false }));
  process.exitCode = 0;
} finally { if (context) await context.close(); await preview.close(); rmSync(profile, { recursive: true, force: true }); }
