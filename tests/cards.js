// The card-table look: moves held as a hand of cards, the flip between map and fight, the scorepad log,
// and the bestiary of beaten monsters (face down until beaten, kept between runs). Run: node tests/cards.js
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
  await ev('localStorage.clear();META.beasts={};tamChatter=false;');

  // the bestiary
  await ev('start("cade");descentT=0;fade=0;togglePack()');
  check('the pack has a Bestiary button', await ev('!!document.getElementById("openBest")'));
  await ev('document.getElementById("openBest").click()');
  check('it opens a page of cards, all face down at first', await ev(`document.querySelectorAll("#card .beastcard").length===BEASTS.length&&document.querySelectorAll("#card .beastcard.down").length===BEASTS.length&&/0\\/${15}/.test(document.querySelector(".bestiary h3").textContent)`));
  await ev('togglePack()');
  await ev('(()=>{S.hp=S.maxhp=999;mons=[];spawnMon("gob",S.px+1,S.py);startBattle(mons[0]);B.dlg=null;B.mhp=0;winBattle();})()');
  check('beating a goblin turns its card face up', await ev('META.beasts.gob===true'));
  check('and is saved between runs', await ev('JSON.parse(localStorage.getItem("hd-meta")).beasts.gob===true'));
  await ev('(()=>{if(B)endBattle();start("rook");descentT=0;fade=0;togglePack();})()');
  await page.keyboard.press('b');
  check('B flips from the pack to the bestiary', await ev('bestiaryView&&!!document.querySelector(".bestgrid")'));
  const face = await ev('(()=>{const c=[...document.querySelectorAll("#card .beastcard")].find(c=>!c.classList.contains("down"));return c?c.textContent:"";})()');
  check('its card names it, with strengths and weaknesses', /Goblin/i.test(face) && /Strengths/.test(face) && /Weaknesses/.test(face) && /Dirty Trick/.test(face), face.slice(0, 120));
  check('every card has both', await ev('BEASTS.every(b=>b.strong.length&&b.weak.length&&b.blurb)'));
  await page.keyboard.press('b');
  check('B again goes back to the pack', await ev('!bestiaryView&&!!document.getElementById("openBest")'));
  await page.keyboard.press('Escape');
  check('Esc closes it', await ev('!packOpen'));
  check('the Thing counts once both its shapes are beaten', await ev('beastId({id:"thing2"})==="thing"'));

  // the hand of moves
  await ev('(()=>{start("monk");descentT=0;fade=0;S.lvl=9;S.hp=S.maxhp=999;mons=[];spawnMon("skel",S.px+1,S.py);startBattle(mons[0]);B.dlg=null;parryChance=()=>0;})()');
  await page.waitForTimeout(1200);
  await ev('B.dlg=null;S.cds={penance:3};renderMoveBar()');
  check('the moves are a hand of cards, one per move', await ev('document.querySelectorAll("#movebar .mcard").length===unlocked().length'));
  check('each shows the level that taught it', await ev('[...document.querySelectorAll("#movebar .mcard:not(.down) .mc-pip")].map(e=>+e.textContent).every((v,i,a)=>v>0)'));
  check('a move cooling down lies face down, with its turns left', await ev('(()=>{const c=document.querySelector(\'#movebar .mcard[data-mv="penance"]\');return c.classList.contains("down")&&c.querySelector(".mc-back b").textContent==="3";})()'));
  check('the hand fans out', await ev('(()=>{const a=[...document.querySelectorAll("#movebar .mcard")];return getComputedStyle(a[0]).transform!==getComputedStyle(a[Math.floor(a.length/2)]).transform;})()'));
  await ev('B.phase="choose";chooseMove("crosssign")');
  check('playing one sends its card up off the hand', await ev('!!document.querySelector("#mapwrap .mcard.fly")'));

  // the table
  check('a card turns over the table when a fight starts', await ev('document.getElementById("flipwipe").classList.contains("go")'));
  check('the log is kept on a scorepad', await ev('getComputedStyle(document.getElementById("log")).backgroundColor==="rgb(230, 223, 203)"'));
  check('the panels are baize in a wooden rail', await ev('getComputedStyle(document.querySelector(".rail .panel")).backgroundColor==="rgb(20, 35, 27)"'));

  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
