// Tam, the violet wisp, and what he says about the King, the Queen and the fall to each hero. Run: node tests/wisp_talk.js
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
  const giveWisp = h => ev(`(()=>{start("${h}");descentT=0;fade=0;})()`);

  check('the wisp is violet now, not blue', await ev('["wisp_0","wisp_1","wisp_orb"].every(k=>ART[k].join("").includes("V")&&!/[234]/.test(ART[k].join("")))&&SPELL_COL.wisp==="#a87fe0"'));
  await giveWisp('rook');
  await page.keyboard.press('h');
  check('H opens the talk menu', await ev('wispTalkOpen&&freePaused()&&/Talk to Tam/.test(document.getElementById("card").textContent)'));
  check('the questions are dealt as cards, like the level-up hand', await ev('document.querySelectorAll("#card .chargrid.fan .charcard.wispcard").length===4&&!document.querySelector("#card button")'));
  await page.keyboard.press('2'); await page.waitForTimeout(700);
  check('asking about the King starts his answer', await ev('!wispTalkOpen&&!!MAPD.dlg&&MAPD.dlg.who==="wisp"'));
  for (let i = 0; i < 30 && await ev('!!MAPD.dlg'); i++) await ev('dlgAdvance();dlgAdvance()');
  check('then the menu comes back, marking what was asked', await ev('wispTalkOpen&&/Asked before/.test(document.querySelector(\'.wispcard[data-id="king"]\').textContent)&&S.wispAsked.king'));
  await page.keyboard.press('Escape');
  check('and Esc puts them away', await ev('!wispTalkOpen&&!freePaused()'));

  // every hero hears something different
  const heroes = ['cade', 'rook', 'doctor', 'mage', 'monk'];
  for (const t of ['who', 'king', 'queen', 'fall']) {
    const said = [];
    for (const h of heroes) { await ev(`start("${h}")`); said.push(await ev(`wispLines("${t}").map(l=>l.text).join("|")`)); }
    check(`"${t}": a different answer for each of the five heroes`, new Set(said).size === 5, said.map(x => x.slice(0, 40)));
  }
  const starts = [];
  for (const h of heroes) { await ev(`start("${h}")`); starts.push(await ev('S.pack.filter(isWisp).length===1&&!!activeWisp()')); }
  check('every hero starts out with Tam\'s scroll', starts.every(Boolean), starts);
  check('the playtest kit keeps it', await ev('(()=>{start("monk");playtestKit();return S.pack.filter(isWisp).length===1;})()'));
  await ev('start("cade");S.pack=S.pack.filter(it=>!isWisp(it))');
  check('without a wisp, H does nothing', await (async () => { await page.keyboard.press('h'); return ev('!wispTalkOpen'); })());

  // Tam's word on every floor
  check('he has something to say on all twenty floors', await ev('Array.from({length:20},(_,i)=>i+1).every(d=>(TAM_FLOOR[d].all||[]).length>0)'));
  const per = [];
  for (let d = 1; d <= 10; d++) { const v = []; for (const h of heroes) { await ev(`start("${h}")`); v.push(await ev(`tamFloorLines(${d}).map(l=>l.text).join("|")`)); } per.push(new Set(v).size); }
  check('on the castle floors (1-10) each hero hears him differently', per.every(n => n === 5), per);
  const step = async secs => { for (let i = 0; i < Math.ceil(secs / 0.05); i++) await ev('tick(0.05)'); };
  await ev('start("doctor");descentT=0;fade=0;');
  check('not the instant you arrive', await ev('!MAPD.dlg'));
  await step(1.2);
  check('a moment after reaching floor 1, he speaks', await ev('!!MAPD.dlg&&MAPD.dlg.who==="wisp"&&/leeches/.test(MAPD.dlg.lines.map(l=>l.text).join(" "))'));
  for (let i = 0; i < 20 && await ev('!!MAPD.dlg'); i++) await ev('dlgAdvance();dlgAdvance()');
  await step(2);
  check('only once per floor', await ev('!MAPD.dlg'));
  await ev('S.px=S.sx;S.py=S.sy;S.fx=S.px+.5;S.fy=S.py+.5;descend()');
  await step(0.3);
  check('he waits until the way down is over', await ev('!MAPD.dlg'));
  for (let i = 0; i < 200 && !await ev('!!MAPD.dlg'); i++) await step(.1);
  check('and on the next floor he speaks again', await ev('S.depth===2&&!!MAPD.dlg&&/stitched/.test(MAPD.dlg.lines.map(l=>l.text).join(" "))'), await ev('[S.depth,descentT,!!MAPD.dlg]'));
  await ev('start("cade");descentT=0;fade=0;S.pack=S.pack.filter(it=>!isWisp(it))'); await step(2);
  check('no wisp, no remarks', await ev('!MAPD.dlg'));

  check('rooted monsters have red eyes', await ev('ROOTED_BASES.every(b=>{const r=SPR[b+"_r"];if(!r.eyes||!r.eyes.length)return false;const d=r.getContext("2d").getImageData(0,0,r.width,r.height).data;return r.eyes.every(([x,y])=>{const i=(y*r.width+x)*4;return d[i]>240&&d[i+1]<100;});})'));
  check('their walk and attack frames too', await ev('["orc_atk_r","troll_walk_2_r","wraith_walk_1_r","troll_s3_r"].every(k=>SPR[k].eyes&&SPR[k].eyes.length===2)'));
  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
