// Sir Brannoc, the Iron Knight: slow, strong, never parries, tears through roots, no healing moves.
// Run: node tests/brute.js   (needs Playwright: npm i -D playwright, or set PW to its install path)
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
  const hero = id => ev(`PLAYTEST=false;tamChatter=false;DICE_ROLL=0;META.tutorialDone=true;hideOverlay();start("${id}");descentT=0;fade=0;mons=[];`);

  await hero('cade');
  const cade = await ev('({hp:S.maxhp,stam:S.maxstam})');
  await hero('brute');
  check('he is a hero you can pick, drawn as a knight', await ev('!!charById("brute")&&CHAR().name==="Sir Brannoc"&&!!SPR.brute&&!!SPR.brute_atk&&!!SPR.brute_walk_0'));
  check('normal health: the same as Cade', await ev('S.maxhp') === cade.hp, [await ev('S.maxhp'), cade.hp]);
  check('he carries the Oathblade', await ev('S.weapon.id==="oath"&&!LOOT_WEAPONS.some(w=>w.id==="oath")'));
  check('he is unlocked by felling five ogres or trolls', await ev('(()=>{const q=QUESTS.find(q=>q.unlock==="brute");return q&&q.stat==="giants"&&q.goal===5;})()'));

  // slow across the map: hold right for a second and compare with Cade
  const walk = async id => {
    await hero(id);
    return ev(`(()=>{for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)map[y][x]=FLOOR;S.px=5;S.py=5;S.fx=5.5;S.fy=5.5;S.vx=5;S.vy=5;S.stam=S.maxstam;
      held.clear();held.add("ArrowRight");const x0=S.fx;for(let i=0;i<20;i++)freeTick(.05);held.clear();return S.fx-x0;})()`);
  };
  const dc = await walk('cade'), db = await walk('brute');
  check('he walks across the map much more slowly', db > 0 && db < dc * .75, [dc, db]);

  // slow to get his breath back
  const breath = async id => {
    await hero(id);
    return ev(`(()=>{S.stam=20;S.exhausted=false;S.stillT=1;held.clear();for(let i=0;i<20;i++)freeTick(.05);return S.stam-20;})()`);
  };
  const bc = await breath('cade'), bb = await breath('brute');
  check('his stamina comes back slower', bb > 0 && bb < bc * .75, [bc, bb]);

  // never parries
  await hero('brute');
  check('he cannot parry', await ev('parryChance(false)===0&&parryChance(true)===0'));
  await ev('S.offhand=OFFHAND_ITEMS.find(o=>o.id==="pdagger");S.dodge=.2;');
  check('...not even with a parrying dagger and dodge', await ev('parryChance(false)===0'));

  // hits harder
  const avg = async id => {
    await hero(id);
    return ev(`(()=>{S.weapon=WEAPONS.find(w=>w.id==="sword");spawnMon("orc",S.px+1,S.py);startBattle(mons[mons.length-1]);B.mon.t=Object.assign({},B.mon.t,{def:0});
      let t=0,n=0;for(let i=0;i<400;i++){const r=pDamage({id:"strike",mult:1},{noMiss:true});if(!r.miss){t+=r.dmg;n++;}}const a=t/n;B=null;S.mode="map";return a;})()`);
  };
  const ac = await avg('cade'), ab = await avg('brute');
  check('with the same sword he deals about 35% more damage', ab > ac * 1.2, [ac, ab]);

  // roots
  await hero('brute');
  await ev('S.depth=15;newFloor(15);descentT=0;fade=0;mons=[];S.hp=S.maxhp=500;SNARE=null;S.snareCD=0;snareWarn();');
  for (let i = 0; i < 40; i++) await ev('tick(0.05)');
  check('the roots still grab him', await ev('SNARE&&SNARE.stage==="grab"&&!!SNARE.bar'));
  check('but his glow is far wider', await ev('SNARE.bar.w>=Math.max(.12,.24-(S.depth-11)*.012)*1.7'), await ev('SNARE.bar.w'));
  const hp0 = await ev('S.hp');
  await ev('(()=>{const b=SNARE.bar;SNARE.t=b.t0+Math.max(0,b.z0-.08)*SNARE_BAR;snarePress();})()');
  check('and even a clumsy pull tears him free, unhurt', await ev('SNARE.stage==="broken"') && await ev('S.hp') === hp0, [await ev('SNARE&&SNARE.stage'), hp0, await ev('S.hp')]);
  await ev('SNARE=null;');

  // no healing among his level-up moves
  await hero('brute');
  const mv = await ev('moveListFor(CHAR()).map(m=>({id:m.id,lvl:m.lvl,kind:m.kind||"",drain:m.drain||0}))');
  check('a move for every level from 1 to 9', [1,2,3,4,5,6,7,8,9].every(l => mv.some(m => m.lvl === l)), mv);
  check('none of them heal him: no Rally, no Last Light, nothing that drinks', mv.every(m => m.kind !== 'buff' && !m.drain && m.id !== 'rally' && m.id !== 'last'), mv);
  check('his own blows, Crushing Blow and Earthbreaker, have icons', await ev('!!SPR.move_crush&&!!SPR.move_quake') && mv.some(m => m.id === 'crush') && mv.some(m => m.id === 'quake'));

  // the hero select shows him
  await ev('PLAYTEST=true;chooseHero();');
  await page.waitForTimeout(300);
  check('he is on the hero select', await ev('!!document.querySelector(\'#card .charcard[data-id="brute"]\')'));
  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'heroes.png') });

  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
