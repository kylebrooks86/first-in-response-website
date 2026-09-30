import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
const names=['00-launch','01-sh-mix','02-equipment','03-chemicals','04-chemical-index','05-job-math','06-field-guide','07-tools'];
const themes=['light','dark'];
const report=[];
for(const theme of themes){
  for(const name of names){
    const livePath=path.join(OUT,`live-${theme}-${name}.png`);
    const stagingPath=path.join(OUT,`staging-${theme}-${name}.png`);
    if(!fs.existsSync(livePath)||!fs.existsSync(stagingPath)){report.push({theme,name,status:'missing'});continue}
    const live=PNG.sync.read(fs.readFileSync(livePath));
    const staging=PNG.sync.read(fs.readFileSync(stagingPath));
    const dimensionMatch=live.width===staging.width&&live.height===staging.height;
    let diffPixels=null,diffPercent=null;
    if(dimensionMatch){
      const diff=new PNG({width:live.width,height:live.height});
      diffPixels=pixelmatch(live.data,staging.data,diff.data,live.width,live.height,{threshold:0.1,includeAA:false});
      diffPercent=Number((diffPixels/(live.width*live.height)*100).toFixed(4));
      fs.writeFileSync(path.join(OUT,`diff-${theme}-${name}.png`),PNG.sync.write(diff));
    }
    report.push({theme,name,status:'compared',live:{width:live.width,height:live.height},staging:{width:staging.width,height:staging.height},dimensionMatch,diffPixels,diffPercent});
  }
}
const ranked=[...report].filter(x=>x.status==='compared').sort((a,b)=>{
  if(a.dimensionMatch!==b.dimensionMatch)return a.dimensionMatch?1:-1;
  return (b.diffPercent??100)-(a.diffPercent??100);
});
const summary={generated_at:new Date().toISOString(),rule:'Measurement only. A route is not VERIFIED IDENTICAL merely because its diff percentage is low.',report,ranked};
fs.writeFileSync(path.join(OUT,'visual-diff-report.json'),JSON.stringify(summary,null,2));
const md=['# FIRE Calculator visual diff report','','| Theme | Route | Dimensions | Pixel difference |','|---|---|---:|---:|',...ranked.map(x=>`| ${x.theme} | ${x.name} | ${x.dimensionMatch?'MATCH':`${x.live.width}×${x.live.height} vs ${x.staging.width}×${x.staging.height}`} | ${x.diffPercent===null?'n/a':x.diffPercent.toFixed(4)+'%'} |`),'','Lower is closer. 0.0000% with matching dimensions is a pixel-identical render at this viewport.'];
fs.writeFileSync(path.join(OUT,'visual-diff-report.md'),md.join('\n'));
console.log(md.join('\n'));
