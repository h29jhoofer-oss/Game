// Heroes are earned through quests and nothing else; what you've earned (and the crash course) survives a reload.
// Run: node tests/unlocks.js
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const FILE = 'file://' + path.resolve(__dirname, '..', 'hollow_depths.html');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 820 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE);
  const ev = s => page.evaluate(s);
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
  const reload = async () => { await page.reload(); await page.waitForTimeout(300); };

  await ev('localStorage.clear()'); await reload();
  check('a new player has only Cade', await ev('isUnlocked("cade")&&!["rook","doctor","mage","monk"].some(isUnlocked)'));
  // an old playtest save that marked every hero unlocked, with no quests done
  await ev('localStorage.setItem("hd-meta",JSON.stringify({unlocked:{cade:true,rook:true,doctor:true,mage:true,monk:true},stats:{},done:{}}))'); await reload();
  check('an old save with every hero unlocked but no quests done gets only Cade', await ev('!["rook","doctor","mage","monk"].some(isUnlocked)'), await ev('META.unlocked'));
  await ev('(()=>{chooseHero();})()');
  check('the hero select shows the others locked, with their quests', await ev('document.querySelectorAll("#card .charcard.locked").length===4'));
  // finish a quest
  await ev('(()=>{for(let i=0;i<20;i++)bumpStat("wounds");})()');
  check('opening 20 wounds unlocks Rook', await ev('isUnlocked("rook")&&META.done.blood'));
  await reload();
  check('and Rook is still there after a reload, the others still locked', await ev('isUnlocked("rook")&&!["doctor","mage","monk"].some(isUnlocked)'));
  await ev('META.tutorialDone=true;metaSave()'); await reload();
  check('finishing the crash course survives a reload', await ev('META.tutorialDone===true&&/Choose your hero/.test(document.getElementById("go").textContent)'));
  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
