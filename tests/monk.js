// Brother Anselm, the monk: weak, slow, no magic, mocked by every boss; and if he takes none of the dark gifts,
// the choice at the end not to run. Run: node tests/monk.js  (PW=playwright path, SHOTS=dir for screenshots)
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
  const shot = async n => { if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, n + '.png') }); };
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
  const skip = async () => { for (let i = 0; i < 40 && await ev('!!(DH().dlg)'); i++) await ev('dlgAdvance();dlgAdvance()'); };

  await ev('localStorage.clear()');
  check('he has to be earned: laying the King to rest unlocks him', await ev('!isUnlocked("monk")&&(()=>{bumpStat("kings");return isUnlocked("monk");})()'));
  await ev('start("monk")');
  check('weak: 30 health, 20% less damage', await ev('S.maxhp===30&&CHAR().dmgMult===.8&&S.weapon.id==="pilgrim"'));
  const sp = await ev(`(()=>{S.fx=S.px+.5;S.fy=S.py+.5;const x0=S.fx;S.stam=999;held.clear();freeStep(1,0,.1);const d=S.fx-x0;S.fx=x0;return d;})()`);
  check('slow: walks at 80% speed', Math.abs(sp - 4.2 * .1 * .8) < .02, sp);
  check('no magic: he will not read a scroll', await ev('!canPay(1)&&/not of God/.test(payMsg({name:"Scroll of Flame"},5))&&CHAR().noMana'));
  check('holy: more damage to the dead', await ev('HOLY_FOES.has("wraith")&&HOLY_FOES.has("king")&&CHAR().holy'));

  // Every boss mocks him.
  for (const [id, re] of [['queen', /cross/], ['king', /monk/]]) {
    await ev(`(()=>{start("monk");S.depth=${id === 'queen' ? 8 : 10};newFloor(S.depth);descentT=0;fade=0;S.hp=S.maxhp=999;mons=[];spawnMon("${id}",S.px+1,S.py);const m=mons[0];m.seated=false;startBattle(m);})()`);
    await step(1.2);
    const lines = await ev('B.dlg?B.dlg.lines.map(l=>l.text).join(" | "):""');
    check(`the ${id === 'queen' ? 'Queen' : 'King'} mocks his faith`, re.test(lines) && /god/i.test(lines), lines);
    await ev('endBattle()');
  }

  // Floor 20, no gifts taken: the Thing mocks him too, and at the end he may stand.
  const toChase = async () => {
    await ev(`(()=>{S.depth=20;newFloor(20);descentT=0;fade=0;S.hp=S.maxhp=9999;mons=[];spawnMon("thing",S.sx,S.sy);const m=mons[0];S.px=m.x-1;S.py=m.y;S.fx=S.px+.5;S.fy=S.py+.5;startBattle(m);})()`);
    await step(1.4);
    const said = await ev('B.dlg?B.dlg.lines.map(l=>l.text).join(" | "):""');
    await skip();
    await ev('B.mhp=0;winBattle()'); await step(2.4); await skip();
    await ev('B.mhp=0;winBattle()'); await step(1.5); await skip(); await step(2.3);
    return said;
  };
  await ev('start("monk")');
  const said = await toChase();
  check('the Thing mocks his god', /god/i.test(said) && /monk/.test(said), said);
  check('beaten twice, he refuses to run', await ev('S.mode==="map"&&!!S.chase&&!!MAPD.dlg&&dlgLine().who==="hero"&&MAPD.dlg.lines.some(l=>/will not run/.test(l.text))'));
  await shot('monk_refuses');
  const c0 = await ev('[S.chase.fx,S.chase.fy,S.chase.wait]');
  await step(1);
  check('the chase waits while he speaks', JSON.stringify(c0) === JSON.stringify(await ev('[S.chase.fx,S.chase.fy,S.chase.wait]')));
  await skip();
  check('then the choice: run, or stand', await ev('monkChoiceOpen&&!!document.getElementById("mStand")&&freePaused()'));
  await shot('monk_choice');
  await page.keyboard.press('2');
  check('he stands, and will not move', await ev('!monkChoiceOpen&&S.monkStand'));
  const p0 = await ev('[S.fx,S.fy]');
  await page.keyboard.down('ArrowLeft'); await step(.5); await page.keyboard.up('ArrowLeft');
  check('...kneeling where he is', JSON.stringify(p0) === JSON.stringify(await ev('[S.fx,S.fy]')));
  for (let i = 0; i < 200 && await ev('!S.jump&&!S.over'); i++) await step(.1);
  check('it catches him', await ev('S.jump&&S.jump.holy&&!S.over'));
  await step(1.5); await shot('monk_cross');
  check('he holds up the cross, and it is still alive at the end of it', await ev('S.jump&&S.jump.t>1.4&&!S.over'));
  await step(3.5);
  check('it shrinks into the shadows', await ev('!S.jump&&!S.over&&mons.some(m=>m.t.id==="shade")'));
  await step(1.6);
  check('and he can finish it', await ev('S.mode==="battle"&&B.mon.t.id==="shade"&&B.mmax<100'));
  await shot('monk_shade');
  await skip();
  await ev('B.mhp=0;winBattle()'); await step(.4); await skip(); await step(2);
  check('once and for all', await ev('S.over&&/Once and for all/.test(document.querySelector("#card h3").textContent)'));
  await shot('monk_win');

  // Choosing to run: the ordinary chase.
  await ev('start("monk")'); await toChase(); await skip();
  await page.keyboard.press('1');
  check('he can still choose to run', await ev('!monkChoiceOpen&&!S.monkStand&&!!S.chase&&!freePaused()'));
  // With a dark gift taken: no choice, he runs like anyone else.
  await ev('start("monk");S.perks={keen:true}'); await toChase();
  check('take a single gift, and there is no standing', await ev('!!S.chase&&!MAPD.dlg&&!monkChoiceOpen'));
  // Any other hero: no choice either.
  await ev('start("cade")'); await toChase();
  check('nobody else gets the choice', await ev('!!S.chase&&!MAPD.dlg&&!monkChoiceOpen'));

  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
