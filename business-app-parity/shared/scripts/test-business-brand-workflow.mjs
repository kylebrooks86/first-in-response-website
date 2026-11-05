/** Built app, native local D1, authenticated HTTP, real browser layouts. */
import assert from 'node:assert/strict';
import {LEGACY_BUSINESS_TEMPLATE_DEFAULTS} from '../lib/legacy-business-template-defaults.mjs';
export async function exerciseBusinessBrand({page,request,origin,check}){
 page.setDefaultTimeout(15000);
 const legacy=LEGACY_BUSINESS_TEMPLATE_DEFAULTS.estimate;
 const saved=await request('/api/message-templates','PUT',{key:'estimate',...legacy});assert.equal(saved.status(),200);
 const read=await request('/api/message-templates');assert.equal(read.status(),200);const template=(await read.json()).templates.find(item=>item.key==='estimate');
 check(!/\bKyle\b/.test(template.body)&&template.body.includes('First In Response Exteriors')&&template.body.includes('@estimate_link')&&template.body.includes('@estimate_total')&&template.body.includes('50%')&&template.body!==legacy.body,'Saved legacy default displays current business identity, amount, approval link and booking deposit without preserving old wording');
 const backupResponse=await request('/api/backup');assert.equal(backupResponse.status(),200);const archive=await backupResponse.json();
 const tables=archive.tables??archive.data?.tables;assert.ok(tables,'Native backup table structure');
 const raw=tables.message_templates.find(row=>row.key==='estimate');
 check(raw.body===legacy.body&&raw.subject===legacy.subject,'Brand display compatibility does not rewrite persisted template or backup bytes');
 const custom={key:'estimate',subject:'Customer Kyle Brooks',body:'Hi @customer_first_name, call kyle@example.invalid about the custom request.'};
 assert.equal((await request('/api/message-templates','PUT',custom)).status(),200);
 const after=(await (await request('/api/message-templates')).json()).templates.find(item=>item.key==='estimate');
 check(after.subject===custom.subject&&after.body===custom.body,'Owner-authored custom text, customer name and email stay intact');
 assert.equal((await request('/api/message-templates','PUT',{key:'estimate',reset:true})).status(),200);
 for(const width of [390,768,1366]){
  await page.setViewportSize({width,height:900});await page.goto(origin+'/');await page.locator('[data-app-ready="true"]').waitFor();
  await page.getByRole('heading',{name:'Today',exact:true}).waitFor();
  assert.equal(await page.locator('.brand strong').textContent(),'FIRE','Compact app navigation preserves FIRE identity');
  assert.equal(await page.locator('.sidebar-foot strong').textContent(),'First In Response Exteriors','Business name stays in owner navigation without a duplicate Home subtitle');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+'px business heading stays inside viewport');
  if(await page.getByRole('button',{name:'Open menu',exact:true}).isVisible()){await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.locator('.sidebar-foot').click();}else await page.locator('.avatar-button').click();await page.getByRole('heading',{name:'Owner Account',exact:true}).waitFor();
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('.owner-account-view').getByRole('button',{name:/Switch to .* mode/}).click();
   const profile=page.locator('.owner-account-view');
   check(!(await profile.innerText()).includes('Kyle')&&(await profile.innerText()).includes('First In Response Exteriors'),width+'px '+theme+' owner profile uses business display name');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+'px '+theme+' branded profile has no horizontal overflow');
  }
 }
}
