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
  const dice = () => ev('DICE.dice.map(d=>({kind:d.kind,value:d.value,done:d.done,side:d.side}))');
  // wait (up to ms) until the expression is true in the page
  const until = async (expr, ms = 4000) => { for (let i = 0; i < ms / 25; i++) { if (await ev(expr)) return true; await wait(25); } return false; };
  const ready = async () => { for (let i = 0; i < 200 && !await ev('B&&B.phase==="choose"&&!B.dlg'); i++) await wait(50); };

  await ev(`PLAYTEST=false;tamChatter=false;META.tutorialDone=true;hideOverlay();start("rook");descentT=0;fade=0;S.lvl=9;S.hp=S.maxhp=300;
    spawnMon("gob",S.px+1,S.py);const m=mons[mons.length-1];m.hp=m.max=500;startBattle(m);parryChance=()=>0;`);
  await ready();
  check('the tray sits under the health, stamina, mana and torch bars', await ev(`(()=>{const el=document.getElementById("diceTray"),t=el.getBoundingClientRect(),p=document.querySelector(".rail .panel").getBoundingClientRect();
    return getComputedStyle(el).display!=="none"&&el.parentElement.classList.contains("rail")&&t.top>=p.bottom&&t.top-p.bottom<40&&Math.abs(t.left-p.left)<4;})()`));

  // your attack: a blue die, and nothing lands until it stops
  const h0 = await ev('B.mhp');
  await ev('chooseMove("strike")');
  await wait(450);
  const mid = await dice();
  check('your attack rolls a blue d20, in from the left', mid.length === 1 && mid[0].kind === 'blue' && mid[0].side === 'left', mid);
  check('while it rolls, the blow has not landed', await ev('B.mhp') === h0 && !mid[0].done, [h0, await ev('B.mhp')]);
  check('it is drawn as a pixel d20 on a canvas', await ev('(()=>{const c=document.querySelector("#diceFelt .die3 canvas");return !!c&&c.width===26&&getComputedStyle(c).imageRendering.includes("pixel")||getComputedStyle(c).imageRendering.includes("crisp");})()'));
  await until('DICE.dice[0]&&DICE.dice[0].done');
  check('when it stops it shows its number, and the blow still waits a moment', await ev('B.mhp') === h0);
  await wait(250);
  check('...about half a second, so the number can be read', await ev('B.mhp') === h0);
  const missed = await ev('DICE.dice[0].value==="x"');
  if (missed) await wait(700); else await until(`B.mhp!==${h0}`);
  const landed = await dice();
  const dealt = h0 - await ev('B.mhp');
  check('then the blow lands for exactly the number shown', landed[0].done && (landed[0].value === 'x' ? dealt === 0 : +landed[0].value === dealt), [landed, dealt]);

  // the goblin answers: its red die sweeps yours away
  await wait(500);
  for (let i = 0; i < 40 && !(await dice()).some(d => d.kind === 'red'); i++) await wait(50);
  const foe = await dice();
  check('the monster\'s attack rolls red, in from the right, and your old dice are gone', foe.length === 1 && foe[0].kind === 'red' && foe[0].side === 'right', foe);
  const hp0 = await ev('S.hp');
  check('its blow waits for its die too', !foe[0].done ? await ev('S.hp') === hp0 : true);
  await ready();

  // three quick stabs: three blue dice in one tray
  await ev('chooseMove("flurry")');
  for (let i = 0; i < 240; i++) { await wait(50); const d = await dice(); if (d.filter(x => x.kind === "blue" && x.done).length >= 3) break; }
  const fl = await dice();
  check('a three-hit move rolls three blue dice together', fl.filter(d => d.kind === 'blue').length === 3 && fl.every(d => d.done), fl);
  await ready();

  // a draught: green, and the health comes when the die stops
  await ev(`S.hp=100;const h=POTIONS.find(p=>p.id==="heal");S.pack.push({kind:"use",ref:h,glyph:h.glyph,col:h.col,name:h.name,note:h.note});useItemBattle(S.pack.length-1);`);
  await wait(300);
  const g = await dice();
  check('drinking a healing draught rolls green', g.length === 1 && g[0].kind === 'green', g);
  check('the health waits for the die', await ev('S.hp') === 100);
  await until('S.hp!==100');
  check('then you heal by the number it shows', await ev('S.hp') === 100 + +(await dice())[0].value, [await ev('S.hp'), await dice()]);
  await ready();

  // the monster knits its wounds: black
  await ev('B.phase="anim";B.mhp=100;seq=[];diceClear();enemyStrike({name:"Knit",heal:.2},1,false);');
  await wait(300);
  const bk = await dice();
  check('a monster healing itself rolls black', bk.length === 1 && bk[0].kind === 'black', bk);
  check('and its wounds close only when the die stops', await ev('B.mhp') === 100);
  await until('B.mhp!==100');
  check('by the number on the black die', await ev('B.mhp') === 100 + +(await dice())[0].value, [await ev('B.mhp'), await dice()]);

  // wounds at the end of the round: all roll at once, from the side of whoever has them
  await ready();
  await ev('B.phase="anim";seq=[];diceClear();B.mhp=300;S.hp=200;B.mStat.burn=2;B.mStat.poison=2;B.mStat.poisonDmg=4;B.mStat.bleed=2;B.mStat.bleedDmg=3;B.pStat.burn=1;B.pStat.bleed=0;S.lvl=9;endRound();');
  await wait(300);
  const w = await dice();
  check('every wound rolls its die at the same time', w.length === 4 && w.every(d => !d.done), w);
  check('orange for fire, dark green for poison, dark red for bleeding', w.map(d => d.kind).join() === 'burn,poison,bleed,burn', w);
  check('the monster\'s wounds come in from the right, yours from the left', w.slice(0, 3).every(d => d.side === 'right') && w[3].side === 'left', w);
  check('and nothing lands while they roll', await ev('B.mhp') === 300 && await ev('S.hp') === 200);
  await until('B.mhp!==300');
  check('they all land together: 14 fire, 4 poison, 3 bleeding on it, 5 fire on you', await ev('B.mhp') === 300 - 14 - 4 - 3 && await ev('S.hp') === 195, [await ev('B.mhp'), await ev('S.hp')]);
  check('the wound dice have their own colours', await ev('DIE_COLS.bleed.mid!==DIE_COLS.red.mid&&DIE_COLS.poison.mid!==DIE_COLS.green.mid&&!!DIE_COLS.burn'));
  await until('B.phase==="choose"', 3000);
  check('and then it is your turn again', await ev('B.phase==="choose"'));

  // a heal at full health still rolls its die
  await ev(`S.hp=S.maxhp;const h=POTIONS.find(p=>p.id==="heal");S.pack.push({kind:"use",ref:h,glyph:h.glyph,col:h.col,name:h.name,note:h.note});useItemBattle(S.pack.length-1);`);
  await wait(300);
  const rl = await dice();
  check('a draught at full health still rolls its green die', rl.length === 1 && rl[0].kind === 'green' && +rl[0].value > 0, rl);
  await until('B.phase==="choose"', 8000);
  check('...and does not take you past your maximum', await ev('S.hp<=S.maxhp'));
  check('the tray is tall enough for two rows of dice', await ev('document.getElementById("diceFelt").clientHeight>=124'));

  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'dice.png') });
  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
