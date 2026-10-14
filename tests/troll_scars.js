// Trolls show their wounds: scarred sprites at 3/4, 1/2 and 1/4 health, going back as they knit. And you tell
// the Queen her guards were sorry. Run: node tests/troll_scars.js  (PW=playwright path, SHOTS=dir for screenshots)
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
  const shot = async n => { if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, n + '.png') }); };
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
  await ev('localStorage.clear();start("cade")');

  const px = await ev(`(()=>{const diff=(a,b)=>{const A=a.getContext("2d").getImageData(0,0,a.width,a.height).data,B2=b.getContext("2d").getImageData(0,0,b.width,b.height).data;let n=0;for(let i=0;i<A.length;i+=4)if(A[i]!==B2[i]||A[i+1]!==B2[i+1]||A[i+2]!==B2[i+2])n++;return n;};
    const out={};for(const k of ["troll","troll_atk","troll_walk_0","troll_walk_3"])out[k]=[1,2,3].map(n=>SPR[k+"_s"+n]?diff(SPR[k],SPR[k+"_s"+n]):-1);return out;})()`);
  check('every troll frame has three scarred versions', Object.values(px).every(a => a.every(n => n > 0)), px);
  check('each one more scarred than the one before', Object.values(px).every(a => a[0] < a[1] && a[1] < a[2]), px);
  check('the stages start at 3/4, 1/2 and 1/4 health', await ev('[1,.76,.75,.51,.5,.26,.25,.01].map(f=>hurtSpr("troll",f)).join()') ===
    'troll,troll,troll_s1,troll_s1,troll_s2,troll_s2,troll_s3,troll_s3');
  check('other monsters are left alone', await ev('hurtSpr("ogre",.1)==="ogre"'));

  // In a duel: the sprite follows its health, and knitting sends it back a stage.
  await ev(`(()=>{S.depth=8;newFloor(8);descentT=0;fade=0;S.hp=S.maxhp=999;mons=[];spawnMon("troll",S.px+1,S.py);startBattle(mons[0]);})()`);
  await page.waitForTimeout(1300);
  await ev('B.mhp=Math.round(B.mmax*.4)');
  await page.waitForTimeout(200);
  check('a badly hurt troll wears its scars', await ev('B.mon.scar===2'));
  await shot('troll_scarred');
  await ev('B.mhp=Math.round(B.mmax*.8)');
  await page.waitForTimeout(200);
  check('knitting its wounds sets it back', await ev('B.mon.scar===0&&B.log.some(l=>/knits its wounds/.test(l.t))'));
  await ev('endBattle()');

  // On the map too.
  await ev(`(()=>{mons=[];spawnMon("troll",S.px+2,S.py);const m=mons[0];m.hp=Math.round(m.max*.2);computeFOV();})()`);
  await page.waitForTimeout(200);
  check('on the map, too', await ev('mons[0].scar===3'));
  await shot('troll_map');

  // The Queen hears what her guards said.
  await ev(`(()=>{S.guardsSorry=true;mons=[];spawnMon("queen",S.px+1,S.py);startBattle(mons[0]);})()`);
  await page.waitForTimeout(1300);
  for (let i = 0; i < 12 && await ev('!!(B&&B.dlg)'); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(30); await page.keyboard.press('Space'); await page.waitForTimeout(30); }
  await ev('B.mhp=0;winBattle()');
  await page.waitForTimeout(200);
  check('you tell the Queen her trolls were sorry', await ev('B.dlg&&dlgLine().who==="hero"&&/sorry/.test(dlgLine().text)'));
  await page.waitForTimeout(1500);
  await shot('queen_told');
  await page.keyboard.press('Space'); await page.keyboard.press('Space');
  check('and she answers', await ev('B.dlg&&!dlgLine().who&&/trolls/.test(dlgLine().text)'));
  check('no page errors', errors.length === 0, errors);

  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
