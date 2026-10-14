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
  const giveWisp = h => ev(`(()=>{start("${h}");descentT=0;fade=0;const w=POTIONS.find(x=>x.id==="wisp");S.pack.push({kind:"use",ref:w,glyph:"?",col:w.col,name:w.name});})()`);

  check('the wisp is violet now, not blue', await ev('["wisp_0","wisp_1","wisp_orb"].every(k=>ART[k].join("").includes("V")&&!/[234]/.test(ART[k].join("")))&&SPELL_COL.wisp==="#a87fe0"'));
  await giveWisp('rook');
  await page.keyboard.press('h');
  check('H opens the talk menu', await ev('wispTalkOpen&&freePaused()&&/Talk to Tam/.test(document.getElementById("card").textContent)'));
  await page.keyboard.press('2');
  check('asking about the King starts his answer', await ev('!wispTalkOpen&&!!MAPD.dlg&&MAPD.dlg.who==="wisp"'));
  for (let i = 0; i < 30 && await ev('!!MAPD.dlg'); i++) await ev('dlgAdvance();dlgAdvance()');
  check('then the menu comes back, marking what was asked', await ev('wispTalkOpen&&/\\(asked\\)/.test(document.getElementById("card").textContent)&&S.wispAsked.king'));
  await page.keyboard.press('5');
  check('and Never mind closes it', await ev('!wispTalkOpen&&!freePaused()'));

  // every hero hears something different
  const heroes = ['cade', 'rook', 'doctor', 'mage', 'monk'];
  for (const t of ['who', 'king', 'queen', 'fall']) {
    const said = [];
    for (const h of heroes) { await ev(`start("${h}")`); said.push(await ev(`wispLines("${t}").map(l=>l.text).join("|")`)); }
    check(`"${t}": a different answer for each of the five heroes`, new Set(said).size === 5, said.map(x => x.slice(0, 40)));
  }
  await ev('start("cade")');
  check('without a wisp, H does nothing', await (async () => { await page.keyboard.press('h'); return ev('!wispTalkOpen'); })());

  check('rooted monsters have red eyes', await ev('ROOTED_BASES.every(b=>{const r=SPR[b+"_r"];if(!r.eyes||!r.eyes.length)return false;const d=r.getContext("2d").getImageData(0,0,r.width,r.height).data;return r.eyes.every(([x,y])=>{const i=(y*r.width+x)*4;return d[i]>240&&d[i+1]<100;});})'));
  check('their walk and attack frames too', await ev('["orc_atk_r","troll_walk_2_r","wraith_walk_1_r","troll_s3_r"].every(k=>SPR[k].eyes&&SPR[k].eyes.length===2)'));
  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
