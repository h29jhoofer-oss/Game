// The dice tray: every blow and heal in a fight is rolled on a pixel d20 first, and only lands once the die
// stops. Blue: your attacks. Green: your heals. Red: the monster's attacks. Black: the monster's heals.
// Run: node tests/dice.js   (needs Playwright: npm i -D playwright, or set PW to its install path)
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
  const wait = ms => page.waitForTimeout(ms);
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
  const dice = () => ev('DICE.dice.map(d=>({kind:d.kind,value:d.value,done:d.done}))');
  const ready = async () => { for (let i = 0; i < 80 && !await ev('B&&B.phase==="choose"&&!B.dlg'); i++) await wait(50); };

  await ev(`PLAYTEST=false;tamChatter=false;META.tutorialDone=true;hideOverlay();start("rook");descentT=0;fade=0;S.lvl=9;S.hp=S.maxhp=300;
    spawnMon("gob",S.px+1,S.py);const m=mons[mons.length-1];m.hp=m.max=500;startBattle(m);parryChance=()=>0;`);
  await ready();
  check('the tray sits in the bottom-left corner of the fight', await ev(`(()=>{const t=document.getElementById("diceTray").getBoundingClientRect(),w=document.getElementById("mapwrap").getBoundingClientRect();
    return getComputedStyle(document.getElementById("diceTray")).display!=="none"&&t.left-w.left<30&&w.bottom-t.bottom<30&&t.width>150;})()`));

  // your attack: a blue die, and nothing lands until it stops
  const h0 = await ev('B.mhp');
  await ev('chooseMove("strike")');
  await wait(450);
  const mid = await dice();
  check('your attack rolls a blue d20', mid.length === 1 && mid[0].kind === 'blue', mid);
  check('while it rolls, the blow has not landed', await ev('B.mhp') === h0 && !mid[0].done, [h0, await ev('B.mhp')]);
  check('it is drawn as a pixel d20 on a canvas', await ev('(()=>{const c=document.querySelector("#diceFelt .die3 canvas");return !!c&&c.width===26&&getComputedStyle(c).imageRendering.includes("pixel")||getComputedStyle(c).imageRendering.includes("crisp");})()'));
  await wait(900);
  const landed = await dice();
  const dealt = h0 - await ev('B.mhp');
  check('when it stops, it shows the damage, and the blow lands', landed[0].done && (landed[0].value === 'x' ? dealt === 0 : +landed[0].value === dealt), [landed, dealt]);

  // the goblin answers: its red die sweeps yours away
  await wait(500);
  for (let i = 0; i < 40 && !(await dice()).some(d => d.kind === 'red'); i++) await wait(50);
  const foe = await dice();
  check('the monster\'s attack rolls red, and your old dice are gone', foe.length === 1 && foe[0].kind === 'red', foe);
  const hp0 = await ev('S.hp');
  check('its blow waits for its die too', !foe[0].done ? await ev('S.hp') === hp0 : true);
  await ready();

  // three quick stabs: three blue dice in one tray
  await ev('chooseMove("flurry")');
  for (let i = 0; i < 120; i++) { await wait(50); const d = await dice(); if (d.filter(x => x.kind === 'blue' && x.done).length >= 3) break; }
  const fl = await dice();
  check('a three-hit move rolls three blue dice together', fl.filter(d => d.kind === 'blue').length === 3 && fl.every(d => d.done), fl);
  await ready();

  // a draught: green, and the health comes when the die stops
  await ev(`S.hp=100;const h=POTIONS.find(p=>p.id==="heal");S.pack.push({kind:"use",ref:h,glyph:h.glyph,col:h.col,name:h.name,note:h.note});useItemBattle(S.pack.length-1);`);
  await wait(300);
  const g = await dice();
  check('drinking a healing draught rolls green', g.length === 1 && g[0].kind === 'green', g);
  check('the health waits for the die', await ev('S.hp') === 100);
  await wait(900);
  check('then you heal by the number it shows', await ev('S.hp') === 100 + +(await dice())[0].value, [await ev('S.hp'), await dice()]);
  await ready();

  // the monster knits its wounds: black
  await ev('B.phase="anim";B.mhp=100;seq=[];enemyStrike({name:"Knit",heal:.2},1,false);');
  await wait(300);
  const bk = await dice();
  check('a monster healing itself rolls black', bk.length === 1 && bk[0].kind === 'black', bk);
  check('and its wounds close only when the die stops', await ev('B.mhp') === 100);
  await wait(900);
  check('by the number on the black die', await ev('B.mhp') === 100 + +(await dice())[0].value, [await ev('B.mhp'), await dice()]);

  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'dice.png') });
  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
