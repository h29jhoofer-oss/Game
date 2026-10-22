// Rooted monsters (floors 11-19) are drawn with roots growing through them. Run: node tests/rooted.js
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const FILE = 'file://' + path.resolve(__dirname, '..', 'hollow_depths.html');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 820 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE);
  await page.waitForTimeout(300);
  const ev = s => page.evaluate(s);
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
  check('every ordinary monster, and each of its frames, has a rooted copy', await ev('ROOTED_BASES.every(b=>SPR[b+"_r"]&&SPR[b+"_atk_r"]&&SPR[b+"_walk_0_r"])&&!!SPR.troll_s2_r'));
  check('same pixel size, on a bigger canvas so the roots can reach out', await ev('ROOTED_BASES.every(b=>{const r=SPR[b+"_r"],[l,t,rr,bb]=r.pad;return r.width===SPR[b].width+l+rr&&r.height===SPR[b].height+t+bb;})'));
  const diff = await ev(`ROOTED_BASES.map(b=>{const a=SPR[b+"_r"],c=document.createElement("canvas");c.width=a.width;c.height=a.height;const x=c.getContext("2d");x.drawImage(SPR[b],a.pad[0],a.pad[1]);
    const p=x.getImageData(0,0,a.width,a.height).data,q=a.getContext("2d").getImageData(0,0,a.width,a.height).data;let n=0,out=0;for(let i=0;i<p.length;i+=4){if(p[i]!==q[i]||p[i+1]!==q[i+1]||p[i+3]!==q[i+3])n++;if(p[i+3]===0&&q[i+3]>0)out++;}return [n,out];})`);
  check('the roots run through the body and out past it', diff.every(([n, out]) => n > 25 && out > 6), diff);
  check('the bosses and gilded guardians have none', await ev('!SPR.king_r&&!SPR.thing_r&&!SPR.ghost_queen_r&&!SPR.guardian_r'));
  await ev('(()=>{start("cade");S.depth=14;newFloor(14);descentT=0;fade=0;mons=[];spawnMon("orc",S.px+1,S.py);})()');
  check('below the throne a monster is rooted', await ev('mons[0].t.deep>0&&rootSpr(mons[0].t,"orc")==="orc_r"'));
  await ev('(()=>{S.depth=5;newFloor(5);mons=[];spawnMon("orc",S.px+1,S.py);})()');
  check('above it, it is not', await ev('rootSpr(mons[0].t,"orc")==="orc"'));
  await ev('(()=>{S.depth=14;newFloor(14);descentT=0;fade=0;S.hp=S.maxhp=999;mons=[];spawnMon("troll",S.px+1,S.py);startBattle(mons[0]);B.dlg=null;for(let i=0;i<20;i++)tick(.05);render();})()');
  check('it fights rooted, with no errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
