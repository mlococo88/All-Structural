import fs from 'fs'; import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const OUT=process.argv[2]; const setup=process.argv[3]||'';
const o=await openPage(path.join(REPO,'BasePlateAnchorDesigner.html'),{vw:1400,vh:1000});
await o.p.waitForFunction(()=>typeof S!=='undefined'&&document.getElementById('tabBar').children.length>0,null,{timeout:60000});
if(setup) await o.p.evaluate(setup);
await o.p.evaluate(()=>{ S.ui.tab='tabDrawings'; buildTabs(); });
await o.p.waitForSelector('#bpdwPrint1');
const sv=await o.p.evaluate(()=>BPDW.B.S.map(s=>({id:s.id,k:s.k,over:s.over,svg:SharedDxf.sheetSVG(BPDW.B.D,s)})));
await o.p.screenshot({path:path.join(OUT,'tab.png')});
const ctx=await o.b.newContext({viewport:{width:1700,height:1100},deviceScaleFactor:2}); const q=await ctx.newPage();
for(const s of sv){ await q.setContent(`<body style="margin:0;background:#fff">${s.svg.replace('<svg ','<svg width="1700" height="1100" ')}</body>`); await q.screenshot({path:path.join(OUT,s.id+'.png')}); console.log(s.id,'k',s.k,'over',s.over); }
console.log('errors',o.errs);
await o.b.close();
