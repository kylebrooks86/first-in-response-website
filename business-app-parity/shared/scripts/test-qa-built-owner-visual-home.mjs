/**
 * Authenticated, built QA Worker visual smoke test. The calling test uses only
 * an ephemeral native D1, synthetic customer/estimate and localhost browser.
 * No screenshots/data exports, provider calls, QA deployment or hosted records.
 * Unlike standalone CSS fixtures, this measures actual hydrated owner Home.
 */
import assert from 'node:assert/strict';

export async function exerciseBuiltOwnerVisualHome({page,check}){
  const originalViewport=page.viewportSize();
  const originalTheme=await page.locator('html').getAttribute('data-theme');
  const cases=[[320,568],[350,700],[375,812],[390,844],[430,932],
    [667,375],[760,760],[768,1024],[820,1180],[1024,768],[1366,900]];
  try{
    for(const [width,height] of cases){
      for(const theme of ['light','dark']){
        await page.setViewportSize({width,height});
        // CSS theme is verified without changing the owner's saved theme
        // or requiring a destructive navigation / customer interaction.
        await page.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);
        const actual=await page.evaluate(()=>{
          const cards=[...document.querySelectorAll('.dashboard-view .metric-grid > .metric-card')];
          const box=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,
            width:r.width,height:r.height,display:getComputedStyle(node).display};};
          const activeSidebar=document.querySelector('.sidebar nav button[aria-current="page"]');
          const activeMobile=document.querySelector('.bottom-nav button[aria-current="page"]');
          const navLabel=document.querySelector('.bottom-nav button:not(.active)');
          const metricSmall=cards.find(node=>node.querySelector('small'))?.querySelector('small');
          const visibleCards=cards.filter(node=>getComputedStyle(node).display!=='none');
          return {
            count:cards.length,
            visible:visibleCards.length,
            boxes:cards.map(box),
            columns:getComputedStyle(document.querySelector('.dashboard-view .metric-grid'))
              .gridTemplateColumns.split(' ').filter(Boolean).length,
            xOverflow:document.documentElement.scrollWidth-innerWidth,
            activeSidebar:activeSidebar?.textContent?.trim()||null,
            activeMobile:activeMobile?.textContent?.trim()||null,
            selectedDesktopVisible:activeSidebar?getComputedStyle(activeSidebar).visibility:'missing',
            selectedMobileVisible:activeMobile?getComputedStyle(activeMobile).visibility:'missing',
            iconDesktop:getComputedStyle(document.querySelector('.sidebar nav button svg')).width,
            iconMobile:getComputedStyle(document.querySelector('.bottom-nav button svg')).width,
            navFont:navLabel?getComputedStyle(navLabel).fontSize:null,
            navColor:navLabel?getComputedStyle(navLabel).color:null,
            captionFont:metricSmall?getComputedStyle(metricSmall).fontSize:null,
            captionColor:metricSmall?getComputedStyle(metricSmall).color:null,
          };
        });
        const label=width+'x'+height+' '+theme;
        check(actual.count===4&&actual.visible===4,
          'Actual hydrated owner Home keeps all four KPI cards visible: '+label+' '+JSON.stringify({count:actual.count,visible:actual.visible}));
        check(actual.boxes.every(b=>b.display!=='none'&&b.width>100&&b.x>=-1&&b.right<=width+1),
          'Actual KPI cards fit inside viewport without clipping: '+label+' '+JSON.stringify(actual.boxes));
        check(actual.columns===(width<=350?1:width<=1050?2:4),
          'Actual Home metric grid uses expected column count: '+label+' got '+actual.columns);
        check(actual.iconDesktop==='19px'&&actual.iconMobile==='20px',
          'Owner navigation retains consistent glyph geometry: '+label);
        check(actual.activeSidebar==='Dashboard'&&actual.activeMobile==='Home',
          'Active Home nav identified accessibly on both desktop and mobile: '+label);
        check(actual.captionFont==='12px'&&actual.navFont==='11px',
          'KPI descriptions and inactive mobile nav labels remain readable: '+label);
        const colors=theme==='dark'
          ?{caption:'rgb(181, 199, 218)',nav:'rgb(181, 199, 218)'}
          :{caption:'rgb(88, 107, 128)',nav:'rgb(88, 107, 128)'};
        check(actual.captionColor===colors.caption&&actual.navColor===colors.nav,
          'Hydrated app uses theme-specific supporting copy colors: '+label);
        check(actual.xOverflow<=1,
          'Actual hydrated Home has no horizontal document overflow: '+label+' overflow='+actual.xOverflow);
      }
    }
  }finally{
    await page.evaluate(theme=>{
      if(theme===null)document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme',theme);
    },originalTheme);
    if(originalViewport)await page.setViewportSize(originalViewport);
  }
}
