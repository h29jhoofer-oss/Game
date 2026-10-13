// The dark gifts were the Thing's: it reveals this at the start of the final fight and turns them on you.
// Run: node tests/gifts.js   (needs Playwright: npm i -D playwright, or set PW to its install path)
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
  const step = async secs => { for (let i = 0; i < Math.ceil(secs / 0.05); i++) await ev('tick(0.05)'); };
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
  const duelThing = async gifts => {
    await ev(`localStorage.clear();start("cade");S.hp=S.maxhp=400;S.gold=120;S.perks={};for(const g of ${JSON.stringify(gifts)})S.perks[g]=true;
      S.depth=20;newFloor(20);descentT=0;fade=0;S.pendLvl=0;
      const m=mons.find(m=>m.t.id==="thing");S.px=m.x-1;S.py=m.y;S.fx=S.px+.5;S.fy=S.py+.5;`);
  };

  await duelThing(['keen', 'troll', 'gilded', 'riposte', 'iron']);
  check('before the fight, the gifts work for you', await ev('hasPerk("troll")&&gearMod("crit")>=.08&&!S.betrayed'));
  await ev('startBattle(mons.find(m=>m.t.id==="thing"))');
  await step(1.5);
  check('it speaks in a dialogue box, and waits for you', await ev('!!B.dlg&&B.dlg.i===0&&B.phase!=="choose"'));
  await page.waitForTimeout(1400);
  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'dlg_1.png') });
  await step(6);
  check('it does not move on by itself', await ev('!!B.dlg&&B.dlg.i===0'));
  await page.keyboard.press('Space');
  check('Space goes to the next line', await ev('B.dlg.i===1'));
  await ev('B.dlg.t0=performance.now()');
  await page.keyboard.press('Space');
  check('Space on a line still typing finishes it first', await ev('B.dlg.i===1&&dlgShown()===dlgLine().text.length'));
  await page.keyboard.press('Space');
  await page.waitForTimeout(900);
  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'dlg_gift.png') });
  check('each gift gets its own line as it is taken', await ev('!!dlgLine().sub&&B.mStat.gifts===1'));
  await page.mouse.click(600, 300); await page.mouse.click(600, 300);
  await page.waitForTimeout(100);
  check('a click moves it on too', await ev('B.dlg.i===3&&B.mStat.gifts===2'));
  await ev('for(let i=0;i<40&&B.dlg;i++){dlgAdvance();dlgAdvance();}');
  await step(.5);
  const log = await ev('B.log.map(l=>l.t).join("\\n")');
  check('it reveals the gifts were its own', /Every gift you took was a clause/.test(log), log);
  check('each gift is named as it is torn out', ['Keen Edge', 'Troll Blood', 'Gilded Palm', 'Riposte', 'Iron Hide'].every(n => log.includes(n + ' is torn out of you')), log);
  check('then the fight begins', await ev('B.phase==="choose"'));
  check('the gifts no longer work for you', await ev('S.betrayed&&!hasPerk("troll")&&!hasPerk("keen")&&gearMod("crit")<.08'));
  check('it wears them: STOLEN GIFTS on its plate', await ev('B.mStat.gifts===5'));
  check('Gilded Palm takes your gold and feeds it', await ev('S.gold===0&&B.mmax>480&&B.mhp===B.mmax'), await ev('[S.gold,B.mmax]'));
  check('Iron Hide hardens it', await ev(`(()=>{const R=Math.random;Math.random=()=>.5;S.str=30;const a=pDamage({mult:1},{noMiss:true}).dmg;S.perks.iron=false;const b=pDamage({mult:1},{noMiss:true}).dmg;S.perks.iron=true;Math.random=R;return a<b})()`));
  check('Troll Blood closes its wounds', await ev(`(()=>{B.mhp-=100;const h=B.mhp;B.phase="anim";endRound();return B.mhp>=h+6})()`));
  check('Riposte turns your blows back on you', await ev(`(()=>{const R=Math.random;Math.random=()=>.05;const r=pDamage({mult:1});Math.random=R;return r.miss&&r.riposted})()`));
  check('Keen Edge sharpens its blows instead', await ev('turned("keen")&&!hasPerk("keen")'));
  check('no more black cards are dealt', await ev('(()=>{S.blackPity=99;const h=dealLevelHand();return !h.some(c=>c.kind==="black")})()'));
  await ev('B.mhp=0;winBattle()'); await step(5);
  check('it is still wearing them in its second shape', await ev('B&&B.mon.t.id==="thing2"&&B.mStat.gifts===5'));
  await ev('endBattle();togglePack()');
  check('the pack shows them as taken back', await ev('document.querySelector("#card").innerText.toLowerCase().includes("it took them back")'));
  await ev('togglePack()');

  // With no gifts taken, it has nothing to turn on you.
  await duelThing([]);
  await ev('startBattle(mons.find(m=>m.t.id==="thing"))');
  await step(1.5);
  check('a hero who took nothing gets two lines of mockery', await ev('B.dlg&&B.dlg.lines.length===2'));
  await ev('for(let i=0;i<8&&B.dlg;i++){dlgAdvance();dlgAdvance();}');
  const log2 = await ev('B.log.map(l=>l.t).join("\\n")');
  check('then fights at once', /You took nothing from me/.test(log2) && await ev('B.phase==="choose"&&!B.mStat.gifts'), log2);

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  let fail = 0;
  for (const r of results) {
    if (!r.ok) fail++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok || r.detail === undefined ? '' : '  ' + JSON.stringify(r.detail)}`);
  }
  console.log(`${results.length - fail}/${results.length} passed`);
  process.exit(fail ? 1 : 0);
})();
