// Floor 8's tomb: the candle-ringed vault, the Queen's ghost waking, and her fight. Run: node tests/tomb.js
// Needs Playwright: npm i -D playwright (or set PW to its install path). SHOTS=dir saves screenshots.
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
  const shot = async n => { if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, n + '.png') }); };
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

  await ev('localStorage.clear();start("cade")');
  const st = await ev(`(()=>{const B={tomb:0,walls:0,ring:0,candles:0,cut:0,onRing:0,guards:0,shrine:0,other:0};
    for(let i=0;i<40;i++){S.depth=8;newFloor(8);if(!TOMB)continue;B.tomb++;
      for(const k of TOMB.tiles){const [x,y]=k.split(",").map(Number);if(map[y][x]===WALL)B.walls++;}
      for(let y=TOMB.y-1;y<=TOMB.y+2;y++)for(let x=TOMB.x-1;x<=TOMB.x+2;x++)if(!TOMB.tiles.has(x+","+y)&&map[y][x]===FLOOR)B.ring++;
      B.candles+=TOMB.candles.length;
      if(inTombRing(S.px,S.py)||inTombRing(S.sx,S.sy))B.onRing++;
      for(const o of [...items,...traps,...mons])if(inTombRing(o.x,o.y))B.onRing++;
      const r=TOMB.room;B.guards+=mons.filter(m=>m.guard&&m.t.id==="troll"&&m.x>=r.x&&m.x<r.x+r.w&&m.y>=r.y&&m.y<r.y+r.h).length;
      if(SHR&&SHR.room===r)B.shrine++;
      for(const d of DOORS)map[d.y][d.x]=FLOOR;const f=floodFrom(S.px,S.py);
      for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(map[y][x]!==WALL&&!f.has(x+","+y))B.cut++;
      S.depth=7;newFloor(7);if(TOMB)B.other++;}
    return B;})()`);
  check('floor 8 always has the tomb', st.tomb === 40, st);
  check('the tomb is a solid 2x2 in the middle of its room', st.walls === 160, st);
  check('a ring of twelve candles surrounds it', st.ring === 480 && st.candles === 480, st);
  check('nothing spawns on the ring, nor the start or stairs', st.onRing === 0, st);
  check('two troll guards keep watch in the vault', st.guards === 80, st);
  check('the shrine stays out of the vault', st.shrine === 0, st);
  check('the tomb never cuts anything off', st.cut === 0, st);
  check('no other floor has a tomb', st.other === 0, st);

  // Walk up to the ring, but not onto it: nothing happens.
  await ev(`S.depth=8;newFloor(8);descentT=0;fade=0;S.hp=S.maxhp=999;mons=[];
    const r=TOMB.room;S.px=TOMB.x-2;S.py=TOMB.y;S.fx=S.px+.5;S.fy=S.py+.5;S.vx=S.px;S.vy=S.py;computeFOV();`);
  await page.waitForTimeout(400);
  check('you can see the tomb from the walkway', await ev('[...TOMB.tiles].some(k=>visible.has(k))'));
  check('the walkway does not wake her', await ev('TOMB.stage==="lit"&&TOMB.lit===1'));
  await shot('tomb_lit');
  // Step onto the ring.
  await ev('S.px=TOMB.x-1;S.fx=S.px+.5;S.vx=S.px;computeFOV();');
  await page.waitForTimeout(200);
  check('stepping inside the candles wakes her', await ev('TOMB.stage==="wake"&&freePaused()'));
  await page.waitForTimeout(900);
  check('the candles go out', await ev('TOMB.lit<1'), await ev('TOMB.lit'));
  await page.waitForTimeout(1300);
  await shot('tomb_lid');
  check('the lid slides open', await ev('TOMB.lid>0'));
  await page.waitForTimeout(900);
  await shot('tomb_rise');
  check('the ghost rises out of it', await ev('TOMB.rise>0'));
  await page.waitForTimeout(1600);
  check('then the fight begins', await ev('S.mode==="battle"&&B&&B.mon.t.id==="queen"'));
  check('every candle is out', await ev('TOMB.lit===0&&TOMB.candles.every(c=>c.out>=0)'));
  await page.waitForTimeout(900);
  await shot('queen_battle');
  check('there is no running from her', await ev('tryFlee(),S.mode==="battle"'));

  // Her special attacks.
  const fx = await ev(`(()=>{const sps=B.mon.t.sps2,g=n=>sps.find(s=>s.name===n);const R=Math.random;Math.random=()=>.5;
    const o={};B.phase="anim";
    enemyStrike(g("Fade"),1,false);o.fade=B.mStat.fade;
    let miss=0;Math.random=()=>.2;for(let i=0;i<10;i++)if(pDamage({mult:1}).ghost)miss++;o.through=miss;
    Math.random=()=>.5;B.mStat.fade=0;
    const d0=pDamage({mult:1},{noMiss:true}).dmg;
    enemyStrike(g("Grave Chill"),1,false);o.chill=B.pStat.chill;
    o.weaker=pDamage({mult:1},{noMiss:true}).dmg<d0;
    enemyStrike(g("Mourning Wail"),1,false);o.skip=B.pStat.skip;
    const h=S.hp;enemyStrike(g("Cold Embrace"),1,false);o.drained=S.hp<h;
    Math.random=R;return o;})()`);
  check('Fade makes her hard to hit', fx.fade > 0 && fx.through === 10, fx);
  check('Grave Chill weakens your blows', fx.chill > 0 && fx.weaker, fx);
  check('Mourning Wail costs you your next turn', fx.skip > 0, fx);
  check('Cold Embrace drains you', fx.drained, fx);
  await ev('B.pStat.skip=0;B.pStat.skipMsg=null;B.pStat.chill=0;');
  await ev('hurtMon(Math.ceil(B.mhp-B.mmax*.45),false)');
  check('at half health she turns to phase 2', await ev('B.phaseNum===2'));
  const tal = await ev(`(()=>{const h=S.hp;B.phase="anim";seq=[];ghostTalons(B.mon.t.sps2.find(s=>s.hits));return h})()`);
  await page.waitForTimeout(1600);
  check('Spectral Talons rake three times, then it is your turn', await ev(`S.hp<${tal}&&B.phase==="choose"`), await ev('B.phase'));
  await shot('queen_phase2');

  // Put her to rest.
  await ev('B.mhp=0;winBattle()');
  await page.waitForTimeout(1800);
  check('beating her ends the fight', await ev('S.mode==="map"&&!mons.some(m=>m.t.id==="queen")&&!S.over'));
  check('her coffer and grave gold are left behind', await ev(`items.some(i=>i.name==="The Queen's Coffer")&&items.some(i=>i.kind==="gold")`));
  check('the candles take light again', await ev('TOMB.stage==="rest"&&TOMB.lit>0'));
  await page.waitForTimeout(1500);
  await shot('tomb_rest');
  check('she does not rise twice', await ev('TOMB.stage==="rest"'));

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
