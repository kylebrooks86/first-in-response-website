import { chromium } from 'playwright';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const cases=[
  {name:'blank house wash',field:['houseWashArea','svcHouse'],value:'',kind:'house'},
  {name:'zero house wash',field:['houseWashArea','svcHouse'],value:'0',kind:'house'},
  {name:'negative house wash',field:['houseWashArea','svcHouse'],value:'-100',kind:'house'},
  {name:'decimal house wash',field:['houseWashArea','svcHouse'],value:'1234.5',kind:'house'},
  {name:'very large house wash',field:['houseWashArea','svcHouse'],value:'1000000',kind:'house'},
  {name:'missing roof rate',field:['roofArea','svcRoof'],value:'1000',kind:'roof'}
];
async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.click();return true}}return false}
async function root(page){for(const id of ['houseWashArea','svcHouse']){const f=page.locator('#'+id);if(await f.count()){for(const r of ['view-job','job']){const x=f.locator(`xpath=ancestor::*[@id='${r}']`);if(await x.count())return x.first()}}}for(const s of ['#view-job','#job']){const x=page.locator(s);if(await x.count())return x.first()}return null}
async function open(page){await clickVisibleText(page,'Job Math');await page.waitForTimeout(180);const r=await root(page);if(!r)throw new Error('missing Job Math');await r.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return r}
async function set(page,ids,value){for(const id of ids){const e=page.locator('#'+id);if(await e.count()){await e.evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},value);return}}throw new Error('missing '+ids.join('/'))}
function money(text,label){const esc=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=text.match(new RegExp(esc+'\\s*\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)','i'));return m?Number(m[1]):null}
async function snapshot(page){const r=await root(page),text=(await r.innerText()).replace(/,/g,'').replace(/\s+/g,' ');return {subtotal:money(text,'Subtotal'),total:money(text,'Customer total'),deposit:money(text,'50% deposit'),noServices:/No services entered\./i.test(text),needsRate:/needs approved rate|set a rate|approved default rate/i.test(text),roofMention:/Roof cleaning/i.test(text)} }
async function run(base,browser){const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await ctx.newPage();await page.goto(base,{waitUntil:'networkidle',timeout:60000});await open(page);const out={};for(const c of cases){await set(page,['houseWashArea','svcHouse'],'');await set(page,['roofArea','svcRoof'],'');await set(page,['discountPct','fullDiscount'],'0');await set(page,['quotedPrice','fullOverride'],'0');await set(page,c.field,c.value);await page.waitForTimeout(180);out[c.name]=await snapshot(page)}await ctx.close();return out}
const browser=await chromium.launch({headless:true});let live,staging;try{live=await run(LIVE,browser);staging=await run(STAGING,browser)}finally{await browser.close()}
let failed=false;for(const c of cases){const a=live[c.name],b=staging[c.name],ok=JSON.stringify(a)===JSON.stringify(b);console.log(`${ok?'PASS':'FAIL'} ${c.name}: live=${JSON.stringify(a)} staging=${JSON.stringify(b)}`);if(!ok)failed=true}if(failed)process.exit(1);console.log('ESTIMATOR EDGE LIVE PARITY PASS');
