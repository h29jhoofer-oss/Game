// In a fight the hero's health is a vessel of red instead of a bar, a different one for every hero.
// Run: node tests/vessel.js   (needs Playwright: npm i -D playwright, or set PW to its install path)
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

  check('every hero has a vessel of their own', await ev('CHARACTERS.every(c=>VESSELS[c.id])&&new Set(CHARACTERS.map(c=>VESSELS[c.id].join())).size===CHARACTERS.length'));
  check('each one has an inside to fill', await ev('Object.values(VESSELS).every(g=>g.some(r=>r.includes("#"))&&g.every(r=>r.length===g[0].length))'));

  await ev(`PLAYTEST=false;tamChatter=false;META.tutorialDone=true;hideOverlay();start("cade");descentT=0;fade=0;mons=[];
    spawnMon("gob",S.px+1,S.py);startBattle(mons[mons.length-1]);`);
  await page.waitForTimeout(1500);
  // count the red of the vessel on the canvas, full and then hurt
  const red = () => ev(`(()=>{const c=document.getElementById("cv"),g=c.getContext("2d"),r=c.getBoundingClientRect();
    const d=g.getImageData(Math.round(c.width*.75),Math.round(c.height*.55),Math.round(c.width*.25),Math.round(c.height*.45)).data;let n=0;
    for(let i=0;i<d.length;i+=4)if(d[i]>150&&d[i+1]<110&&d[i+2]<100&&d[i]-d[i+1]>80)n++;return n;})()`);
  const full = await red();
  check('at full health the vessel is full of red', full > 200, full);
  await ev('S.hp=Math.round(S.maxhp*.3);refresh();');
  await page.waitForTimeout(150);
  check('right after a hit, a pale part shows what was just lost', await ev('B.pLag>S.hp+1'), await ev('[B.pLag,S.hp]'));
  await page.waitForTimeout(2000);
  const hurt = await red();
  check('then the red has gone down', hurt > 0 && hurt < full * .6, [full, hurt]);
  check('and the pale part has drained to meet it', await ev('Math.abs(B.pLag-S.hp)<1'));
  await ev('S.hp=S.maxhp;refresh();');
  await page.waitForTimeout(100);
  check('healing fills it straight back up', await ev('B.pLag===S.hp'));

  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
