/** Entire built QA application, local native D1 only. */
export async function exerciseDoorKnocking({page,origin,request,check}){
 const before=await(await request('/api/door-knocking')).json();check(Array.isArray(before.book?.houses),'Built owner API returns house tracker');
 await page.goto(origin);await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.locator('.sidebar').getByRole('button',{name:'Door knocking',exact:true}).click();
 await page.getByLabel('House address',{exact:true}).waitFor();await page.getByLabel('House address',{exact:true}).fill('999 Native Synthetic Lane, Tulsa');await page.getByRole('button',{name:'Save house',exact:true}).click();
 const house=page.getByRole('article',{name:'House: 999 Native Synthetic Lane, Tulsa'});await house.getByText('Never visited',{exact:true}).waitFor();await house.getByLabel('Visit outcome').selectOption('door-hanger');await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(el=>el.textContent?.trim()==='Save visit');if(!b)return false;const r=b.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&(at===b||!!(at&&b.contains(at)));},null,{timeout:5000});check(true,'New house Save visit is not obscured by bottom navigation at 390px');await house.getByRole('button',{name:'Save visit',exact:true}).click();await house.getByText('Previously visited',{exact:false}).waitFor();
 const saved=await(await request('/api/door-knocking')).json(),h=saved.book.houses.find(h=>h.address==='999 Native Synthetic Lane, Tulsa');check(h?.visits.length===1&&h.visits[0].status==='door-hanger','Built mobile dropdown persisted one native D1 visit');
 await house.getByLabel('Visit outcome').selectOption('follow-up');
 check(await house.getByRole('button',{name:'Save visit'}).isDisabled(),'Built UI requires callback date before saving');
 await house.getByLabel('Follow-up date').fill('2026-01-01');
 await house.getByRole('button',{name:'Save visit'}).click();
 await house.getByText('Revisit scheduled · 2026-01-01').waitFor();
 const dated=await(await request('/api/door-knocking/followups')).json();
 check(dated.dueCount>=1&&dated.items.some(item=>item.address==='999 Native Synthetic Lane, Tulsa'&&item.followUpOn==='2026-01-01'),'Actual native D1 owner-only dashboard queue retains dated house reminder');
 await page.locator('.mobile-home-button').click();
 await page.getByRole('button',{name:'Review due door knocking revisits'}).waitFor();
 await page.getByRole('button',{name:'Review due door knocking revisits'}).click();
 await page.getByRole('article',{name:'House: 999 Native Synthetic Lane, Tulsa'}).getByText('Revisit scheduled · 2026-01-01').waitFor();
 check(true,'Dashboard callback alert opens the exact saved house in the actual mobile app');
 await page.getByLabel('Show houses').selectOption('unvisited');check(await house.count()===0,'Built tracker excludes visited home from never-visited view');
 const template=(await(await request('/api/backup')).json());check(JSON.stringify(template).includes('999 Native Synthetic Lane, Tulsa'),'Existing full backup includes owner house visit history');
}
