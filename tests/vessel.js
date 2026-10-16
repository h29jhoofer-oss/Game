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
  // count the red of the crystal in the side panel, full and then hurt
  const red = () => ev(`(()=>{const c=document.getElementById("hpcry"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let n=0;
    for(let i=0;i<d.length;i+=4)if(d[i]>150&&d[i+1]<110&&d[i+2]<100&&d[i]-d[i+1]>80)n++;return n;})()`);
  const full = await red();
  check('health is a crystal in the side panel, full of red', full > 300, full);
  check('the old health bar is gone', await ev('!document.getElementById("hpbar")&&!document.getElementById("manabar")'));
  check('mana is a smaller purple gem beside it', await ev(`(()=>{const a=document.getElementById("hpcry"),b=document.getElementById("mpcry"),d=b.getContext("2d").getImageData(0,0,b.width,b.height).data;let n=0;
    for(let i=0;i<d.length;i+=4)if(d[i+2]>150&&d[i]>100&&d[i+1]<130)n++;return n>50&&b.width<a.width&&b.height<a.height;})()`));
  await ev('S.hp=Math.round(S.maxhp*.3);refresh();');
  await page.waitForTimeout(150);
  check('right after a hit, a pale part shows what was just lost', await ev('HV.hpLag>S.hp+1&&HV.hit>0'), await ev('[HV.hpLag,S.hp,HV.hit]'));
  await page.waitForTimeout(2000);
  const hurt = await red();
  check('then the red has gone down', hurt > 0 && hurt < full * .6, [full, hurt]);
  check('and the pale part has drained to meet it', await ev('Math.abs(HV.hpLag-S.hp)<1'));
  check("in a fight the hero's statuses sit under the crystals", await ev('B.pStat.burn=2;true') && (await page.waitForTimeout(100), await ev('/BURN 2/.test(document.getElementById("hudChips").textContent)')));
  await ev('S.hp=S.maxhp;refresh();');
  await page.waitForTimeout(100);
  check('healing fills it straight back up', await ev('HV.hpLag===S.hp'));
  check('a hero with no mana has no gem', await ev('B=null;S.mode="map";start("monk");refreshMana();getComputedStyle(document.getElementById("manarow")).display==="none"'));

  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
