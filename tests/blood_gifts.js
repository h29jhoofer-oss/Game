// Blood gifts: black-and-red dark gifts that put a savage blow in your hand, paid for in max health and an
// attack you would have learned. Run: node tests/blood_gifts.js
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
  await ev('tamChatter=false;window.sfxBloodGift=()=>{}');

  check('there are four blood gifts, each with its own blow', await ev('["harvest","butcher","hunger","debt"].every(id=>PERKS[id].blood&&MOVES.some(m=>m.id===PERKS[id].move&&m.blood))'));
  check('no hero has a blood blow without the gift', await ev('["cade","rook","doctor","mage","monk"].every(h=>{start(h);return !moveList().some(m=>m.blood);})'));
  // deal one and look at it
  await ev('(()=>{start("cade");descentT=0;fade=0;S.lvl=4;S.pendLvl=1;const d=dealLevelHand;dealLevelHand=()=>{const h=d();h[1]={kind:"black",id:"harvest",c:PERKS.harvest,price:bloodPrice()};return h;};openLevelUp();dealLevelHand=d;})()');
  const card = await ev('(()=>{const c=document.querySelector(".lvlcard.blood");return c?{txt:c.textContent,bg:getComputedStyle(c).backgroundColor,gain:getComputedStyle(c.querySelector(".cgain")).color}:null;})()');
  check('it is dealt as a black-and-red card', card && card.bg === 'rgb(18, 10, 11)' && card.gain === 'rgb(255, 143, 128)', card);
  check('which says it is a blood gift, what it gives, and exactly what it costs', card && /Blood gift/.test(card.txt) && /Reaping Cut/.test(card.txt) && /10 max health/.test(card.txt) && /Ember Brand/.test(card.txt) && /level 5/.test(card.txt), card && card.txt);
  await ev('pickLevelCard(document.querySelector(".lvlcard.blood"))'); await page.waitForTimeout(800);
  check('taking it costs the health', await ev('S.maxhp===30&&S.hp<=30'));
  check('and puts Reaping Cut in your hand', await ev('unlocked().some(m=>m.id==="reap")'));
  check('and Ember Brand is gone for good', await ev('S.forfeit.ember&&!moveList().some(m=>m.id==="ember")'));
  await ev('(()=>{S.xp=XPTABLE[4]-1;gainXp(1);})()');
  check('reaching level 5 no longer teaches it', await ev('S.lvl===5&&!newMovesAt(5).some(m=>m.id==="ember")&&!/You learn Ember/.test(document.getElementById("log").textContent)'));
  // the blow itself
  await ev('(()=>{hideOverlay();levelOpen=false;S.pendLvl=0;S.hp=S.maxhp=999;mons=[];spawnMon("orc",S.px+1,S.py);startBattle(mons[0]);B.dlg=null;})()');
  const dm = await ev('(()=>{const r0=Math.random;Math.random=()=>.5;const a=pDamage(MOVES.find(m=>m.id==="reap"),{noMiss:true}).dmg,b=pDamage(MOVES.find(m=>m.id==="strike"),{noMiss:true}).dmg;Math.random=r0;return [a,b];})()');
  check('Reaping Cut hits about twice as hard as a strike', dm[0] >= dm[1] * 1.8, dm);
  check('the blood blows are red cards in your hand', await ev('(renderMoveBar(),!!document.querySelector(\'#movebar .mcard.blood[data-mv="reap"]\'))'));
  // Pay in Full
  await ev('(()=>{S.perks.debt=true;S.hp=500;B.phase="choose";parryChance=()=>0;const r0=Math.random;Math.random=()=>.3;strikeOnce(MOVES.find(m=>m.id==="payfull"));Math.random=r0;})()');
  check('Pay in Full costs you blood each time', await ev('S.hp<500&&/paid in your blood/.test(document.getElementById("log").textContent)'));
  // the Thing wants them back
  await ev('(()=>{endBattle();S.betrayed=true;})()');
  check('when the Thing takes the gifts back, the blows leave your hand', await ev('!moveList().some(m=>m.blood)'));
  check('the attacks they ate stay gone', await ev('!moveList().some(m=>m.id==="ember")'));
  check('and it hits harder for each blood gift it took', await ev('(()=>{mons=[];spawnMon("thing",S.px+1,S.py);startBattle(mons[0]);B.dlg=null;const r0=Math.random;Math.random=()=>.0;const a=mDamage(null).dmg;S.perks.harvest=false;S.perks.debt=false;const b=mDamage(null).dmg;Math.random=r0;return a>b;})()'));
  await ev('(()=>{endBattle();start("monk");S.perks={butcher:true};})()');
  check('a blood gift breaks the monk\'s faith like any dark gift', await ev('!monkFaith()'));
  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
