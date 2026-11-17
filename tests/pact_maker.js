// Pact Maker (Eric) tests. Run: node tests/pact_maker.js
// Needs Playwright: npm i -D playwright (or set PW to its install path).
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

  // A fresh duel against a sturdy foe, with randomness pinned so damage is comparable.
  const duel = async (setup, pre) => {
    await ev(`${pre || ''};mons=[];spawnMon("orc",S.px+1,S.py);startBattle(mons[mons.length-1]);${setup || ''}`);
    await step(1);
  };
  const settle = () => step(2.5);

  // 1. Quest: unlocks at exactly three battles survived at <=15% health.
  await ev('DICE_ROLL=0;PLAYTEST=false;localStorage.clear();META={unlocked:{cade:true},stats:{},done:{}};start("cade");S.maxhp=100;');
  for (let n = 1; n <= 3; n++) {
    await duel('', 'S.hp=10');
    if (n < 3) check(`quest locked after ${n} low-health win${n > 1 ? 's' : ''}`, !(await ev('isUnlocked("pact_maker")')));
    await ev('B.mhp=0;winBattle()'); await settle();
  }
  check('quest unlocks after the third', await ev('isUnlocked("pact_maker")'));
  await duel('', 'S.hp=S.maxhp');
  const before = await ev('META.stats.lowhp');
  await ev('B.mhp=0;winBattle()'); await settle();
  check('a healthy win does not count', (await ev('META.stats.lowhp')) === before);

  // 2. Hero setup.
  await ev('start("pact_maker")');
  const st = await ev('[S.maxhp,S.maxmana,S.offhand.id,S.pack.map(i=>i.ref.id).join()]');
  check('starts with 36 hp, no mana, quill-knife, one ink flask', st[0] === 36 && st[1] === 0 && st[2] === 'quill' && st[3] === 'ink', st);
  check('mana bar hidden', await ev('$("manarow").style.display==="none"'));

  // 3. Clauses: gained, capped at three, expire on their own turn counts.
  await ev('S.lvl=9;S.hp=S.maxhp=200;');
  await duel();
  await ev('addClause("blood");addClause("brittle");addClause("sleepless");addClause("unsteady")');
  check('at most three clauses, oldest dropped', await ev('clauses().map(c=>c.id).join()') === 'brittle,sleepless,unsteady');
  check('clause damage multiplier', Math.abs((await ev('clauseMult()')) - 1.45) < 1e-9);
  await ev('B.pStat.clauses=[];addClause("unsteady");addClause("blood");');
  await ev('endRound()');
  check('clauses count down', await ev('clauses().map(c=>c.id+c.t).join()') === 'unsteady1,blood2');
  await ev('endRound()');
  check('Unsteady expires after 2 turns', await ev('clauses().map(c=>c.id).join()') === 'blood');
  await ev('endRound()');
  check('Blood Price expires after 3 turns', await ev('clauses().length') === 0);
  await ev('addClause("blood");B.mhp=0;winBattle()'); await settle();
  await duel();
  check('clauses cleared when a battle ends', await ev('clauses().length') === 0);
  await ev('B.mhp=0;winBattle()'); await settle();

  // 4. Forfeit scales with the number of clauses spent.
  const forfeit = async (n) => {
    await duel(`S.cds={};Math._r=Math._r||Math.random;Math.random=()=>0.5;B.mon.t=Object.assign({},B.mon.t,{def:0});`);
    await ev(`B.pStat.clauses=[];${['blood', 'brittle', 'sleepless'].slice(0, n).map(c => `addClause("${c}");`).join('')}B.mhp=B.mmax=9999;S.hp=100;B.phase="choose";B.combo=0`);
    await ev('chooseMove("forfeit")'); await step(0.4);
    const r = await ev('[9999-B.mhp,S.hp-100,clauses().length]');
    await ev('Math.random=Math._r'); await settle();
    await ev('B.mhp=0;winBattle()'); await settle();
    return r;
  };
  const f1 = await forfeit(1), f3 = await forfeit(3);
  check('Forfeit spends every clause', f1[2] === 0 && f3[2] === 0);
  check('Forfeit hits harder with more clauses', f3[0] > f1[0] * 2, { f1, f3 });
  check('Forfeit heals 6 per clause', f1[1] === 6 && f3[1] === 18, { f1, f3 });

  // 5. The Terms: once per fight.
  await duel('S.cds={};B.mhp=B.mmax=9999;S.hp=S.maxhp;B.phase="choose";');
  await ev('addClause("blood");chooseMove("terms")'); await settle();
  const hpAfter = await ev('S.hp');
  check('The Terms costs 20% max hp', hpAfter <= (await ev('S.maxhp')) * 0.8 + 1);
  await ev('S.cds={};B.phase="choose";const m0=B.mhp;window._m0=m0;chooseMove("terms")'); await step(0.4);
  check('The Terms refuses a second use', await ev('B.phase==="choose"&&B.mhp===_m0'));
  await ev('B.mhp=0;winBattle()'); await settle();

  // 6. Sprites in battle.
  await duel();
  check('battle uses his idle sprite', await ev('pspr("")') === 'pact_maker');
  check('battle uses his strike sprite', await ev('pspr("_atk")') === 'pact_maker_atk');
  check('battle uses his parry sprite', await ev('pspr("_parry")') === 'pact_maker_parry');

  // 7. Ink flask in battle costs the next turn.
  await ev(`(()=>{const ink=POTIONS.find(p=>p.id==="ink");S.pack=[{kind:"use",ref:ink,glyph:"!",col:ink.col,name:ink.name,note:""}];S.hp=50;B.phase="choose";B.pStat.clauses=[];addClause("blood");})()`);
  const heal = await ev('inkHeal()');
  await ev('useItemBattle(0)'); await step(3.5);
  check('ink flask heals (base + 5 per clause)', heal === 6 + 2 * 9 + 5);
  check('ink flask skips his next turn', await ev('B.pStat.skip===0&&B.phase==="choose"'));

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
