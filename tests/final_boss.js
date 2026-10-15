// The deep (floors 11-20) and the Thing Under the Hill. Run: node tests/final_boss.js
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
  const fresh = d => ev(`start("cade");S.hp=S.maxhp=400;S.depth=${d};newFloor(${d});descentT=0;fade=0;S.pendLvl=0;`);
  const duelBoss = async id => {
    const i = await ev(`mons.findIndex(m=>m.t.id==="${id}")`);
    await ev(`S.px=mons[${i}].x-1;S.py=mons[${i}].y;S.fx=S.px+.5;S.fy=S.py+.5;startBattle(mons[${i}])`);
    await step(1);
  };

  // 1. The King's fall opens a stair instead of ending the run.
  await fresh(10);
  check('floor 10 has no stair before the King falls', (await ev('S.sx')) === -1);
  await ev('mons=mons.filter(m=>m.t.id==="king")');   // no stray knight wandering into the next check
  await duelBoss('king');
  check('the King speaks before the fight', await ev('!!B.dlg&&B.dlg.who==="king"&&B.phase!=="choose"'));
  await ev('for(let i=0;i<20&&B&&B.dlg;i++){dlgAdvance();dlgAdvance();}');
  await ev('hurtMon(Math.ceil(B.mhp-B.mmax*.45),false)');
  check('at half health he draws his sword, and says so', await ev('B.phaseNum===2&&!!B.dlg&&/blade/.test(B.dlg.lines[1].text)'));
  await ev('for(let i=0;i<20&&B&&B.dlg;i++){dlgAdvance();dlgAdvance();}');
  await ev('B.mhp=0;winBattle()'); await step(.5);
  check('beaten, he warns you about what is below', await ev('!!B.dlg&&/still down there/.test(B.dlg.lines.at(-1).text)'));
  await ev('for(let i=0;i<20&&B&&B.dlg;i++){dlgAdvance();dlgAdvance();}'); await step(2);
  check('killing the King keeps the run going', await ev('!S.over&&S.mode==="map"&&S.kingSlain'));
  check('a stair opens where he fell', await ev('S.sx>=0&&map[S.sy][S.sx]===STAIRS'));
  await ev('S.px=S.sx;S.py=S.sy;S.fx=S.px+.5;S.fy=S.py+.5;descend()');
  check('the stair leads to floor 11', (await ev('S.depth')) === 11);

  // 2. Floors 11-19: stairs down, and rooted monsters that scale with depth.
  await fresh(15);
  check('deep floors have a stair down', await ev('S.sx>=0'));
  const orc = await ev('(()=>{spawnMon("orc",1,1);const m=mons[mons.length-1];return [m.t.name,m.hp,MONSTERS.find(x=>x.id==="orc").hp]})()');
  check('deep monsters are rooted and tougher', orc[0] === 'rooted orc' && orc[1] > orc[2], orc);

  // 3. Floor 20: the Thing, in two shapes.
  await fresh(20);
  check('floor 20 has a stair out, and no Thing yet', await ev('S.sx>=0&&map[S.sy][S.sx]===STAIRS&&!mons.some(m=>m.t.id==="thing")'));
  await ev('mons=[];S.px=S.sx;S.py=S.sy;S.fx=S.px+.5;S.fy=S.py+.5;S.vx=S.px;S.vy=S.py;computeFOV();refresh();descend()');
  check('trying to leave brings someone walking in', await ev('ARRIVE&&ARRIVE.stage==="walk"&&freePaused()&&S.depth===20'));
  const d0 = await ev('Math.hypot(ARRIVE.x-S.px,ARRIVE.y-S.py)');
  await step(1.5);
  check('the old man from the top of the stair, at an old man\'s pace, no smoke yet', await ev(`!ARRIVE.thing&&ARRIVE.puffs.length===0&&Math.hypot(ARRIVE.x-S.px,ARRIVE.y-S.py)<${d0}&&Math.hypot(ARRIVE.x-S.px,ARRIVE.y-S.py)>${d0}-3`));
  for (let i = 0; i < 300 && await ev('ARRIVE.stage==="walk"'); i++) await step(.1);
  check('he comes right up to you, glad you made it', await ev('ARRIVE.stage==="talk"&&!!MAPD.dlg&&Math.hypot(ARRIVE.x-S.px,ARRIVE.y-S.py)<=1.01&&dlgLine().who==="oldman"&&/made it here in one piece/.test(dlgLine().text)'));
  const said = [];
  for (let i = 0; i < 30 && await ev('!!MAPD.dlg'); i++) { said.push(await ev('(dlgLine().who||"thing")+":"+dlgLine().text')); await ev('dlgAdvance();dlgAdvance()'); }
  check('"How did you get here before me?" "I have always been here."', said[1] === 'hero:How did you get down here before me?' && said[2] === 'oldman:I have always been here.', said.slice(0, 4));
  check('then he turns into the Thing: "I am the hill, and the hill is me."', said[3] === 'thing:I am the hill, and the hill is me.' && await ev('ARRIVE.thing===true'), said[3]);
  check('and offers to let you pass, for your soul', said.slice(4).some(t => /^thing:.*Your soul/.test(t)), said.slice(4, 10));
  check('you turn it down, and it decides to take it anyway', said.some(t => t === 'hero:No.') && /take it off your body/.test(said[said.length - 1]), said);
  await step(.3);
  check('then the fight', await ev('S.mode==="battle"&&B&&B.mon.t.id==="thing"'));
  await step(1); await ev('for(let i=0;i<20&&B.dlg;i++){dlgAdvance();dlgAdvance();}');   // it speaks first (the dark gifts reveal)
  check('phase 1', await ev('B.mon.t.id==="thing"&&B.phaseNum===1&&B.mmax===960'));
  await ev('B.mhp=0;winBattle()'); await step(2.4);
  check('when its cloak falls it taunts you', await ev('!!B.dlg&&/that easy/.test(dlgLine().text)&&B.phase!=="choose"'));
  await ev('for(let i=0;i<20&&B&&B.dlg;i++){dlgAdvance();dlgAdvance();}');
  check('beating phase 1 reveals phase 2 at full health', await ev('S.mode==="battle"&&B.mon.t.id==="thing2"&&B.phaseNum===2&&B.mhp===B.mmax&&B.mmax===1120'));
  check('phase 2 has the slam', await ev('!!B.mon.t.qteSp'));
  await ev('B.mhp=0;winBattle()'); await step(1.5);
  check('beaten again, it is afraid, then angry', await ev('!!B.dlg&&B.dlg.lines[0].mood==="fear"&&B.dlg.lines.at(-1).mood==="anger"'));
  await step(4);
  check('the chase waits until you have read it', await ev('S.mode==="battle"&&!S.chase'));
  await ev('for(let i=0;i<20&&B&&B.dlg;i++){dlgAdvance();dlgAdvance();}'); await step(2.2);
  check('beating phase 2 starts the chase', await ev('S.mode==="map"&&!!S.chase&&mons.length===0&&!S.over'));
  check('a way out opens on the floor', await ev('S.sx>=0&&map[S.sy][S.sx]===STAIRS&&distFrom(S.px,S.py)[S.sx+S.sy*W]>0'));
  await step(7);
  check('standing still gets you caught', await ev('S.over&&!S.chase&&/falls/.test(document.querySelector("#card h3").textContent)'));

  // 4. Running for it: each stair up leads to a fresh floor with it climbing after you, all the way to floor 1.
  await fresh(20); await ev('spawnMon("thing",S.sx,S.sy)');
  await duelBoss('thing'); await step(1); await ev('for(let i=0;i<20&&B.dlg;i++){dlgAdvance();dlgAdvance();}');   // it speaks first (the dark gifts reveal)
  await ev('B.mhp=0;winBattle()'); await step(2.4); await ev('for(let i=0;i<20&&B&&B.dlg;i++){dlgAdvance();dlgAdvance();}'); await ev('B.mhp=0;winBattle()'); await step(1.5); await ev('for(let i=0;i<20&&B&&B.dlg;i++){dlgAdvance();dlgAdvance();}'); await step(2.2);
  const run = async (stopDepth) => {
    for (let i = 0; i < 2000; i++) {
      const r = await ev(`(()=>{if(S.over)return document.querySelector("#card h3").textContent;
        if(S.depth<=${stopDepth})return "floor "+S.depth;
        if(window._dd!==S.depth){window._D=distFrom(S.sx,S.sy);window._dd=S.depth;}
        const D=_D,x=S.px,y=S.py;let bx=null,bd=D[x+y*W];
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const v=D[x+dx+(y+dy)*W];if(v>=0&&v<bd){bd=v;bx=[x+dx+.5-S.fx,y+dy+.5-S.fy];}}
        if(!bx)bx=[S.sx+.5-S.fx,S.sy+.5-S.fy];const l=Math.hypot(bx[0],bx[1])||1;
        freeStep(bx[0]/l,bx[1]/l,.05);tick(.05);return null;})()`);
      if (r) return r;
    }
    return 'timeout';
  };
  const up2 = await run(18);
  check('the stair up leads to floor 19, then 18, with it still chasing', up2 === 'floor 18' && await ev('!!S.chase&&mons.length===0&&S.sx>=0&&map[S.sy][S.sx]===STAIRS'), up2);
  check('escape floors are open: no chasms left unbridged', await ev('CHASMS.every(c=>c.bridged)&&DOORS.every(d=>d.open)'));
  await ev('S.depth=2;ascend()');
  check('floor 1 is the last floor', (await ev('S.depth')) === 1);
  const end = await run(0);
  check('reaching daylight from floor 1 wins the run', end === 'Out from under the hill', end);

  // Robed, it does not lunge: the robe parts and an arm comes out of it.
  const robe = await ev(`(()=>{start("cade");S.depth=10;newFloor(10);descentT=0;fade=0;S.hp=S.maxhp=999;S.betrayed=true;mons=[];spawnMon("thing",S.px+1,S.py);startBattle(mons[0]);
    return {open:!!SPR.thing_open};})()`);
  await page.waitForTimeout(1800);
  const px = await ev(`(()=>{const L=B.layout,cv=document.getElementById("cv"),g=cv.getContext("2d");
    const grab=()=>{const d=g.getImageData(0,0,cv.width,cv.height).data;let red=0;for(let i=0;i<d.length;i+=16)if(d[i]>110&&d[i+1]<45&&d[i+2]<45)red++;return red;};
    B.lunge=0;B.lungeSide=0;render();const before=grab();
    B.lunge=.55;B.lungeSide=-1;render();const during=grab();return {before,during};})()`);
  check('robed, it strikes with a red arm out of its robe', robe.open && px.during > px.before * 1.5 + 40, px);
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
