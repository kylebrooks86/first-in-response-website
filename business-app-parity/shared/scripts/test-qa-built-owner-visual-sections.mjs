/**
 * Actual authenticated FIRE owner-section visual smoke test.
 * Runs inside disposable LOCAL built workerd + synthetic native D1 + local
 * Chromium created by test-qa-worker-http-browser.mjs. No remote QA,
 * customer records, providers, screenshots, publishing, or site writes.
 * Navigation is exercised using real app buttons and React view transitions.
 */
export async function exerciseBuiltOwnerVisualSections({page,check}){
  const originalViewport=page.viewportSize();
  const originalTheme=await page.locator('html').getAttribute('data-theme');
  const sections=[
    ['customers','Customers','.customers-view',true],
    ['estimates','Estimates','.workspace-view',true],
    ['schedule','Schedule','.schedule-view',true],
    ['followups','Follow-ups','.followups-view',true],
    ['invoices','Invoices','.invoices-view',false],
    ['payments','Payments','.payments-view',false],
    ['business','Business','.workspace-view',false],
    ['insights','Insights','.insights-view',false],
    ['settings','Settings','.settings-view',false],
  ];
  const cases=[[390,844],[820,1180],[1366,900]];
  const mobileButtons=new Set(['customers','estimates','schedule','followups']);
  try{
    for(const [width,height] of cases){
      for(const theme of ['light','dark']){
        await page.setViewportSize({width,height});
        await page.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);
        for(const [id,label,selector,bottomNav] of sections){
          const isMobile=width<=760;
          const sidebar=page.locator('.sidebar nav button').filter({hasText:label}).first();
          if(isMobile&&bottomNav&&mobileButtons.has(id)){
            await page.locator('.bottom-nav button').filter({hasText:label}).first().click();
          }else{
            if(isMobile){
              await page.getByRole('button',{name:'Open menu',exact:true}).click();
              await page.locator('.sidebar.mobile-open').waitFor();
            }
            if(['business','insights','settings'].includes(id)){
              const group=page.locator('.sidebar details.sidebar-more-nav');
              if(!await group.evaluate(node=>node.open))await group.locator('summary').click();
            }
            await sidebar.click();
          }
          const selected=page.locator('.sidebar nav button[aria-current="page"]').filter({hasText:label});
          await selected.waitFor({state:'attached',timeout:12000});
          const view=page.locator(selector).first();
          await view.waitFor({state:'visible',timeout:12000});
          const state=await page.evaluate(sel=>{
            const root=document.querySelector(sel),r=root?.getBoundingClientRect();
            const viewport=window.innerWidth;
            const cards=[...document.querySelectorAll(sel+' .customer-card,'+
              sel+' .estimate-card,'+sel+' .invoice-card,'+
              sel+' .followup-card,'+sel+' .business-panel')]
              .filter(el=>getComputedStyle(el).display!=='none')
              .slice(0,5).map(el=>{const x=el.getBoundingClientRect();return {x:x.x,right:x.right,width:x.width};});
            const active=[...document.querySelectorAll('.sidebar nav button[aria-current="page"]')];
            const bottom=[...document.querySelectorAll('.bottom-nav button[aria-current="page"]')];
            return {width:viewport,docOverflow:document.documentElement.scrollWidth-viewport,
              root:r?{x:r.x,right:r.right,width:r.width}:null,cards,
              activeSidebar:active.map(el=>el.textContent?.trim()||''),
              activeBottom:bottom.map(el=>el.textContent?.trim()||''),
              bodyState:document.querySelector('.app-shell')?.getAttribute('data-app-ready')};
          },selector);
          const at=id+' '+width+'x'+height+' '+theme;
          check(state.bodyState==='true'&&state.activeSidebar.length===1&&
            state.activeSidebar[0].includes(label),
            'Actual authenticated '+at+' resolves one selected sidebar section');
          check(state.root&&state.root.width>100&&state.root.x>=-2&&state.root.right<=width+2,
            'Actual '+at+' section container fits viewport: '+JSON.stringify(state.root));
          check(state.docOverflow<=1,
            'Actual '+at+' has no document horizontal overflow: '+state.docOverflow);
          check(state.cards.every(c=>c.width>0&&c.x>=-2&&c.right<=width+2),
            'Actual '+at+' representative cards stay in viewport: '+JSON.stringify(state.cards));
          if(isMobile&&bottomNav){
            check(state.activeBottom.length===1&&state.activeBottom[0].includes(label),
              'Actual mobile '+at+' has one accessible selected bottom-navigation item');
          }
        }
      }
    }
  }finally{
    await page.evaluate(value=>{
      if(value===null)document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme',value);
    },originalTheme);
    if(originalViewport)await page.setViewportSize(originalViewport);
    // Return to signed-in Home before the existing synthetic estimate workflow.
    const width=originalViewport?.width??390;
    if(width<=760)await page.locator('.bottom-nav button').filter({hasText:'Home'}).first().click();
    else await page.locator('.sidebar nav button').filter({hasText:'Dashboard'}).first().click();
    await page.locator('.dashboard-view').waitFor({state:'visible',timeout:12000});
  }
}
