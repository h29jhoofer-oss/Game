// Floor 10's throne room: the King on his throne, the torches lighting, and him stepping down to fight.
// Run: node tests/throne.js   (needs Playwright: npm i -D playwright, or set PW to its install path; SHOTS=dir saves screenshots)
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
  const st = await ev(`(()=>{const B={throne:0,seated:0,solid:0,torches:0,unlit:0,onWall:0,cut:0,shrine:0,steps:0,other:0};
    for(let i=0;i<25;i++){S.depth=10;newFloor(10);if(!THRONE)continue;B.throne++;
      const k=mons.find(m=>m.t.id==="king");if(k&&k.seated&&k.x===THRONE.x&&k.y===THRONE.y)B.seated++;
      if(map[THRONE.y][THRONE.x]===WALL)B.solid++;
      B.torches+=THRONE.torches.length>=4?1:0;B.unlit+=THRONE.torches.every(t=>t.lit<0)?1:0;
      if(THRONE.torches.every(t=>map[t.y][t.x]===WALL))B.onWall++;
      if(SHR&&SHR.room===THRONE.room)B.shrine++;
      for(const o of [...mons,...items,...traps])if(o!==k&&o.x===THRONE.x&&o.y>THRONE.y&&o.y<=THRONE.y+2)B.steps++;
      for(const d of DOORS)map[d.y][d.x]=FLOOR;const f=floodFrom(S.px,S.py);
      for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(map[y][x]!==WALL&&!f.has(x+","+y))B.cut++;
      S.depth=9;newFloor(9);if(THRONE)B.other++;}
    return B;})()`);
  check('floor 10 always has the throne room', st.throne === 25, st);
  check('the King waits seated on his throne', st.seated === 25, st);
  check('the throne is solid', st.solid === 25, st);
  check('the hall has torches on its walls, all dark', st.torches === 25 && st.unlit === 25 && st.onWall === 25, st);
  check('nothing stands on the steps before the throne', st.steps === 0, st);
  check('the shrine stays out of the hall', st.shrine === 0, st);
  check('the throne never cuts anything off', st.cut === 0, st);
  check('no other floor has one', st.other === 0, st);

  // Walk up to the doorway, then in.
  await ev(`S.depth=10;newFloor(10);descentT=0;fade=0;S.hp=S.maxhp=999;
    mons=mons.filter(m=>m.t.id==="king");const r=THRONE.room;
    for(const d of DOORS){d.open=true;map[d.y][d.x]=FLOOR;}
    let best=null;
    for(let y=1;y<H-1&&!best;y++)for(let x=1;x<W-1&&!best;x++){if(map[y][x]!==FLOOR||inThroneRoom(x,y))continue;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(inThroneRoom(x+dx,y+dy)&&map[y+dy][x+dx]===FLOOR){best={x,y,ix:x+dx,iy:y+dy};break;}}
    window._out=best;S.px=best.x-(best.ix-best.x);S.py=best.y-(best.iy-best.y);if(map[S.py][S.px]!==FLOOR){S.px=best.x;S.py=best.y;}
    S.fx=S.px+.5;S.fy=S.py+.5;S.vx=S.px;S.vy=S.py;computeFOV();`);
  await page.waitForTimeout(500);
  check('outside the hall, nothing happens', await ev('THRONE.stage==="dark"&&THRONE.king.seated'));
  await shot('throne_dark');
  await ev(`(()=>{const r=THRONE.room;let p=null;for(let y=r.y;y<r.y+r.h&&!p;y++)for(let x=r.x;x<r.x+r.w&&!p;x++)if(map[y][x]===FLOOR&&!onCarpet(x,y)&&Math.abs(x-THRONE.x)>=2&&y>THRONE.y+2)p={x,y};
    S.px=p.x;S.py=p.y;S.fx=S.px+.5;S.fy=S.py+.5;S.vx=S.px;S.vy=S.py;computeFOV();})()`);
  await page.waitForTimeout(400);
  check('in the hall but off the carpet, the torches stay dark', await ev('THRONE.stage==="dark"&&THRONE.torches.every(t=>t.lit<0)&&THRONE.king.seated'));
  await ev('S.px=THRONE.x;S.py=THRONE.room.y+THRONE.room.h-1;S.fx=S.px+.5;S.fy=S.py+.5;S.vx=S.px;S.vy=S.py;computeFOV();');
  await page.waitForTimeout(300);
  check('at the foot of the carpet you can still look at him', await ev('THRONE.stage==="dark"&&THRONE.king.seated'));
  await ev('S.py=THRONE.y+THRONE_WAKE_NEAR;S.fy=S.py+.5;S.vy=S.py;computeFOV();');
  await page.waitForTimeout(200);
  check('stepping onto the red carpet wakes him', await ev('THRONE.stage==="wake"&&freePaused()'));
  await page.waitForTimeout(700);
  check('the torches light one after another', await ev('THRONE.torches.some(t=>t.lit>=0)&&THRONE.torches.some(t=>t.lit<0)'), await ev('THRONE.torches.map(t=>t.lit>=0)'));
  await shot('throne_torches');
  await page.waitForFunction('!THRONE.king.seated',null,{timeout:6000});
  await page.waitForTimeout(300);
  check('he rises from the throne and steps down', await ev('!THRONE.king.seated&&THRONE.king.y>THRONE.y'));
  await shot('throne_step');
  await page.waitForFunction('S.mode==="battle"&&B&&B.dlg',null,{timeout:6000}).catch(()=>{});
  check('then the fight, and his speech', await ev('S.mode==="battle"&&B&&B.mon.t.id==="king"&&!!B.dlg&&B.dlg.who==="king"'));
  check('every torch is lit', await ev('THRONE.torches.every(t=>t.lit>=0)'));
  check('he came down to the foot of the steps', await ev('B.mon.y===THRONE.y+2'));

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
