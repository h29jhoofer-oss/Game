// Floors 11-20: roots burst out of the floor and snare you; the purple parry bar tears you free. Run: node tests/root_snare.js
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
  const floor = d => ev(`(()=>{tamChatter=false;start("cade");S.depth=${d};newFloor(${d});descentT=0;fade=0;S.hp=S.maxhp=500;mons=[];S.snareCD=0;SNARE=null;})()`);

  // how often they come
  await floor(9);
  const none = await ev('(()=>{const r=Math.random;Math.random=()=>0;for(let i=0;i<40;i++)snareTick(.05);Math.random=r;return !SNARE;})()');
  check('none above the throne', none);
  const gaps = await ev('[11,15,20].map(d=>{S.depth=d;return snareGap();})');
  check('more often the deeper you go (about a minute on 11, fifteen seconds on 20)', gaps[0] > gaps[1] && gaps[1] > gaps[2] && gaps[0] >= 55 && gaps[2] <= 16, gaps);
  await floor(13);
  const seen = await ev('(()=>{let n=0;for(let i=0;i<400;i++){snareTick(.5);if(SNARE){n++;SNARE=null;S.snareCD=0;}}return n;})()');
  check('on floor 13 they come out now and then, at random', seen > 0 && seen < 20, seen);

  // the snare itself
  await floor(15);
  await ev('snareWarn()');
  check('first a crack opens under you, and you can still move', await ev('SNARE.stage==="warn"&&!freePaused()'));
  await step(0.9);
  check('stay on it and the roots grab you', await ev('SNARE.stage==="grab"&&freePaused()'));
  await step(0.5);
  check('then the parry bar comes up, purple', await ev('(()=>{const o=document.getElementById("parryOverlay");return o.classList.contains("show")&&o.classList.contains("roots")&&getComputedStyle(o.querySelector(".parry-zone")).backgroundImage.includes("200, 168, 240")||getComputedStyle(o.querySelector(".parry-zone")).backgroundImage.includes("224, 200, 255");})()'),
    await ev('getComputedStyle(document.querySelector(".parry-zone")).backgroundImage'));
  check('and says what it is', await ev('/ROOTS/.test(document.querySelector(".parry-title").textContent)&&/TEAR FREE/.test(document.getElementById("parryBtn").textContent)'));
  const hp0 = await ev('S.hp');
  await ev('(()=>{const b=SNARE.bar;SNARE.t=b.t0+(b.z0+b.w/2)*SNARE_BAR;})()');
  await page.keyboard.press('Space');
  check('Space in the glow tears you free, unhurt', await ev(`SNARE.stage==="broken"&&S.hp===${hp0}&&!document.getElementById("parryOverlay").classList.contains("show")`));
  await step(0.6);
  check('and you can walk again', await ev('!SNARE&&!freePaused()'));
  check('the battle parry bar is blue again', await ev('!document.getElementById("parryOverlay").classList.contains("roots")&&/PARRY/.test(document.querySelector(".parry-title").textContent)'));

  // missing it
  await ev('S.snareCD=0;snareWarn()'); await step(0.9); await step(0.5);
  const h1 = await ev('S.hp');
  await ev('(()=>{const b=SNARE.bar;SNARE.t=b.t0+.05*SNARE_BAR;snarePress();})()');
  const h2 = await ev('S.hp');
  check('press too early and they squeeze', h2 < h1 && await ev('SNARE.stage==="grab"'), [h1, h2]);
  for (let i = 0; i < 80 && await ev('!!SNARE&&SNARE.stage==="grab"'); i++) await step(0.1);
  check('let the bar run out and they squeeze harder, then let go after three tries', await ev(`!SNARE||SNARE.stage==="broken"`) && (await ev('S.hp')) < h2);

  // stepping off in time
  await ev('S.snareCD=0;snareWarn()');
  await ev('(()=>{for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(map[S.py+dy][S.px+dx]===FLOOR){S.px+=dx;S.py+=dy;S.fx=S.px+.5;S.fy=S.py+.5;return;}})()');
  await step(0.9);
  check('step off the crack in time and they grasp at nothing', await ev('!SNARE||SNARE.missed'));

  // they can kill you
  await ev('S.snareCD=0;SNARE=null;S.hp=2;snareWarn()'); await step(0.9); await step(0.5);
  await ev('(()=>{const b=SNARE.bar;SNARE.t=b.t0+1.01*SNARE_BAR;})()'); await step(0.1);
  check('and the roots can drag you down', await ev('S.over&&/roots close over/.test(document.getElementById("card").textContent)'));

  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
