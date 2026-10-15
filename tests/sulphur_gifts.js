// Sulphur gifts: very rare black-and-yellow dark gifts. A lot of one stat, but the blessing that gives a little of it
// burns: it still turns up in the hand, torn in three, and can't be taken. Run: node tests/sulphur_gifts.js
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
  await ev('tamChatter=false;window.sfxSulphur=()=>{};start("cade");descentT=0;fade=0;');

  check('four of them: damage, health, dodge and endurance', await ev('["wrath","marrow","smoke","lungs"].every(id=>PERKS[id].sulphur)&&["might","vit","evade","endure"].every(c=>Object.values(PERKS).some(p=>p.seals===c))'));
  const rate = await ev('(()=>{let n=0,N=20000;for(let i=0;i<N;i++){S.blackPity=0;if(dealLevelHand().some(h=>h.c&&h.c.sulphur))n++;}return n/N;})()');
  check('they are very rare (about 1 level-up in 20)', rate > .03 && rate < .07, rate);
  check('and never come with another black card', await ev('(()=>{for(let i=0;i<4000;i++){const h=dealLevelHand();if(h.some(x=>x.c&&x.c.sulphur)&&h.filter(x=>x.kind==="black").length>1)return false;}return true;})()'));
  // take one
  await ev('(()=>{S.lvl=3;S.pendLvl=1;const d=dealLevelHand;dealLevelHand=()=>{const h=d();h[1]={kind:"black",id:"wrath",c:PERKS.wrath};return h;};openLevelUp();dealLevelHand=d;})()');
  const card = await ev('(()=>{const c=document.querySelector(".lvlcard.sulphur");return c?{txt:c.textContent,bg:getComputedStyle(c).backgroundColor,name:getComputedStyle(c.querySelector(".cname")).color}:null;})()');
  check('it is a black-and-yellow card', card && card.bg === 'rgb(15, 13, 7)' && card.name === 'rgb(255, 242, 122)', card);
  check('it says what it gives and which blessing burns', card && /\+8 Strike/.test(card.txt) && /Might/.test(card.txt) && /never take it again/.test(card.txt));
  const str0 = await ev('S.str');
  await ev('pickLevelCard(document.querySelector(".lvlcard.sulphur"))'); await page.waitForTimeout(800);
  check('taking it gives +8 Strike', await ev(`S.str===${str0}+8`));
  // Might is burnt from now on
  const hands = await ev('(()=>{let seen=0,torn=0,whole=0;for(let i=0;i<500;i++)for(const h of dealLevelHand())if(h.c.id==="might"){seen++;if(h.kind==="torn")torn++;else whole++;}return [seen,torn,whole];})()');
  check('Might still turns up, but always burnt', hands[0] > 0 && hands[2] === 0, hands);
  await ev('(()=>{hideOverlay();levelOpen=false;S.lvl=4;S.pendLvl=1;const d=dealLevelHand;dealLevelHand=()=>[{kind:"torn",c:LVL_CARDS[0],by:PERKS.wrath},{kind:"white",c:LVL_CARDS[1]},{kind:"white",c:LVL_CARDS[2]}];openLevelUp();dealLevelHand=d;})()');
  check('torn into three scorched pieces', await ev('(()=>{const c=document.querySelector(".lvlcard.torn");return c&&c.querySelectorAll(".tchunk").length===3&&/Burnt/.test(c.textContent)&&getComputedStyle(c.querySelector(".t1 .tface")).clipPath!=="none";})()'));
  await ev('pickLevelCard(document.querySelector(".lvlcard.torn"))');
  check('and it cannot be taken', await ev('levelOpen&&!levelPicked&&/burnt/.test(document.getElementById("log").textContent)'));
  await page.keyboard.press('1');
  check('not by its number either', await ev('levelOpen&&!levelPicked'));
  await ev('pickLevelCard(document.querySelectorAll(".lvlcard")[1])'); await page.waitForTimeout(800);
  check('the whole ones still can', await ev('levelPicked||!levelOpen'));
  // something to take, always
  await ev('(()=>{start("monk");S.perks={wrath:true,marrow:true,smoke:true,lungs:true};})()');
  check('with every blessing burnt, there is still a card to take', await ev('(()=>{for(let i=0;i<200;i++){const h=dealLevelHand();if(!h.some(x=>x.kind==="white"))return false;}return true;})()'));
  check('(a Respite, when nothing else is left)', await ev('dealLevelHand().some(x=>x.kind==="white"&&x.c.id==="respite")'));
  check('they break the monk\'s faith like any dark gift', await ev('!monkFaith()'));
  // the Thing takes it back
  await ev('(()=>{start("cade");S.perks={marrow:true};applyMods(PERKS.marrow.gold,1);})()');
  const hp1 = await ev('S.maxhp');
  await ev('(()=>{S.hp=S.maxhp;mons=[];spawnMon("thing",S.px+1,S.py);startBattle(mons[0]);})()');
  await page.waitForTimeout(1500);
  check('and taunts you with it by name', await ev('(()=>{const l=B.dlg&&B.dlg.lines.map(x=>x.text).join(" ");return /sulphur in your bones/.test(l)&&!/undefined/.test(l);})()'));
  check('the Thing takes the sulphur back (and the health with it)', await ev(`S.maxhp===${hp1}-45`), [hp1, await ev('S.maxhp')]);
  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
