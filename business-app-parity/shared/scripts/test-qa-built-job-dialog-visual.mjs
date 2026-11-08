/**
 * Real built-Worker, signed-in estimate/job detail visual contract.
 * The hosting harness supplies one disposable synthetic local QA customer
 * and saved estimate. No send, save, call, payment or provider action occurs.
 */
export async function exerciseBuiltJobDialogVisual({page,check}){
  const originalViewport=page.viewportSize();
  const originalTheme=await page.locator('html').getAttribute('data-theme');
  const cases=[[320,568],[390,844],[820,1180],[1366,900]];
  try{
    for(const [width,height] of cases)for(const theme of ['light','dark']){
      await page.setViewportSize({width,height});
      await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
      const isMobile=width<=760;
      const section=isMobile
        ?page.locator('.bottom-nav button').filter({hasText:'Estimates'}).first()
        :page.locator('.sidebar nav button').filter({hasText:'Estimates'}).first();
      await section.click();
      const estimate=page.locator('.estimate-list .estimate-card').filter({hasText:'Synthetic HTTP Customer'});
      await estimate.waitFor({state:'visible',timeout:12000});
      await estimate.click();
      const dialog=page.getByRole('dialog',{name:'Synthetic Gutter Service',exact:true});
      await dialog.waitFor({state:'visible',timeout:12000});
      // Radix's zoom-in-95 opening animation scales *all* element rectangles
      // briefly. Measure final tap sizes only after those transforms settle;
      // do not silently accept a truly undersized control.
      await dialog.evaluate(async node=>{
        await Promise.all(node.getAnimations({subtree:false})
          .filter(animation=>animation.playState==='running')
          .map(animation=>animation.finished.catch(()=>{})));
      });
      const initial=await dialog.evaluate(node=>{
        const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        const close=node.querySelector('[data-slot="dialog-close"]');
        const icon=close?.querySelector('svg');
        const actions=[...node.querySelectorAll('.detail-actions > a, .detail-actions > button')]
          .filter(el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
        const box=rect(node);
        return {box,close:close?rect(close):null,icon:icon?rect(icon):null,
          scrollable:node.scrollHeight>node.clientHeight+2,
          actions:actions.map(rect),
          docOverflow:document.documentElement.scrollWidth-innerWidth};
      });
      const at=width+'x'+height+' '+theme;
      console.log('REAL JOB DETAIL GEOMETRY '+at+' '+JSON.stringify(initial));
      check(initial.box.width>0&&initial.box.x>=-1&&initial.box.right<=width+1&&
        initial.box.y>=-1&&initial.box.bottom<=height+1,
        'Real signed-in job detail fits on '+at+': '+JSON.stringify(initial.box));
      check(initial.close?.width>=43&&initial.close.height>=43&&
        initial.icon?.width>=15&&initial.icon.width<=17&&
        initial.close.y-initial.box.y>=-2&&initial.close.y-initial.box.y<=14&&
        initial.box.right-initial.close.right>=-2&&initial.box.right-initial.close.right<=14,
        'Real job-detail top-right X is small with 44px hit region on '+at+': '+JSON.stringify(initial));
      check(initial.actions.every(a=>a.height>=47&&a.x>=-1&&a.right<=width+1),
        'Real job-detail owner actions maintain full-size touch/keyboard controls at '+at+': '+JSON.stringify(initial.actions));
      check(initial.docOverflow<=1,'Real job details do not cause document horizontal overflow at '+at);
      if(initial.scrollable){
        await dialog.evaluate(node=>{node.scrollTop=node.scrollHeight;});
        const scrolled=await dialog.evaluate(node=>{
          const close=node.querySelector('[data-slot="dialog-close"]'),r=close?.getBoundingClientRect();
          const root=node.getBoundingClientRect();
          const point=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return {scrollTop:node.scrollTop,closeTop:r?.top,rootTop:root.top,
            closeVisible:!!r&&r.top>=-1&&r.bottom<=innerHeight+1,
            hit:!!close&&!!point&&(point===close||close.contains(point))};
        });
        check(scrolled.scrollTop>0&&scrolled.closeVisible&&scrolled.hit&&
          Math.abs(scrolled.closeTop-scrolled.rootTop)<=14,
          'Real long job-detail X stays visible, top-right and tappable after inner scrolling at '+at+': '+JSON.stringify(scrolled));
      }
      const close=dialog.getByRole('button',{name:'Close',exact:true});
      await close.focus();await page.keyboard.press('Enter');
      await dialog.waitFor({state:'hidden',timeout:12000});
      check(!(await dialog.isVisible()),'Keyboard activation of real top-right X closes job detail at '+at);
    }
  }finally{
    // Preserve the original visual assertion on failure. An open Radix overlay
    // otherwise intercepts the Home click and buries the useful geometry.
    try{
      const dialog=page.getByRole('dialog',{name:'Synthetic Gutter Service',exact:true});
      if(await dialog.isVisible().catch(()=>false)){
        await page.keyboard.press('Escape');
        await dialog.waitFor({state:'hidden',timeout:3500});
      }
    }catch(error){console.warn('Job detail test cleanup: modal dismissal unavailable: '+String(error));}
    try{
      await page.evaluate(t=>{
        if(t===null)document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme',t);
      },originalTheme);
      if(originalViewport)await page.setViewportSize(originalViewport);
      const width=originalViewport?.width??390;
      const home=width<=760
        ?page.locator('.bottom-nav button').filter({hasText:'Home'}).first()
        :page.locator('.sidebar nav button').filter({hasText:'Dashboard'}).first();
      if(!(await page.getByRole('dialog',{name:'Synthetic Gutter Service',exact:true}).isVisible().catch(()=>false))){
        await home.click({timeout:3500});
        await page.locator('.dashboard-view').waitFor({state:'visible',timeout:3500});
      }
    }catch(error){console.warn('Job detail test cleanup: Home return unavailable: '+String(error));}
  }
}
