// Difficulty, the casino-chip scrolls, the deeper lore, and the secret whispers (each in its own place or hour).
// Run: node tests/secrets.js   (needs Playwright: npm i -D playwright, or set PW to its install path)
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
  const run = (id = 'cade') => ev(`PLAYTEST=false;tamChatter=false;DICE_ROLL=0;META.tutorialDone=true;hideOverlay();start("${id}");descentT=0;fade=0;mons=[];S.hp=S.maxhp=200;`);

  // 1. difficulty
  await ev('localStorage.clear();SET.diff="easy";');
  await ev('openSettings()');
  check('settings has a difficulty, and it starts on Easy', await ev('$("setDiff").textContent==="Easy"'));
  await ev('$("setDiff").click()');
  check('clicking it goes to Medium, then Hard, then back to Easy', await ev('(()=>{const a=$("setDiff").textContent;$("setDiff").click();const b=$("setDiff").textContent;$("setDiff").click();return [a,b,$("setDiff").textContent].join()})()') === 'Medium,Hard,Easy');
  await run();
  const hpOf = d => ev(`(()=>{SET.diff="${d}";mons=[];spawnMon("orc",S.px+3,S.py);return mons[0].max;})()`);
  const he = await hpOf('easy'), hm = await hpOf('medium'), hh = await hpOf('hard');
  check('Easy monsters are as they always were', he === await ev('MONSTERS.find(m=>m.id==="orc").hp'), he);
  check('Medium and Hard monsters have more health', hm > he * 1.25 && hh > hm * 1.2, [he, hm, hh]);
  const hit = d => ev(`(()=>{SET.diff="${d}";mons=[];spawnMon("orc",S.px+1,S.py);startBattle(mons[0]);B.phase="anim";seq=[];
    const r=Math.random;Math.random=()=>.5;S.hp=200;enemyStrike(null,1,false);Math.random=r;const d=200-S.hp;B=null;S.mode="map";document.body.classList.remove("inbattle");return d;})()`);
  const de = await hit('easy'), dh = await hit('hard');
  check('and on Hard they hit harder', dh > de * 1.3, [de, dh]);
  await ev('SET.diff="easy";saveSettings();');

  // 2. scroll chips
  await run();
  await ev(`(()=>{for(const id of ["flame","ice"]){const r=POTIONS.find(p=>p.id===id);S.pack.push({kind:"use",ref:r,glyph:r.glyph,col:r.col,name:r.name,note:r.note});}
    spawnMon("gob",S.px+1,S.py);startBattle(mons[mons.length-1]);renderSpellBar();})()`);
  check('in a fight the scrolls are round casino chips in their spell colours, with their price on a tab', await ev(`(()=>{const a=[...document.querySelectorAll("#spellbar .spellslot")];
    return a.length===2&&a.every(b=>getComputedStyle(b).borderRadius==="50%"&&/conic/.test(getComputedStyle(b).backgroundImage)&&+b.querySelector(".chipv").textContent>0);})()`));
  await ev('B=null;S.mode="map";document.body.classList.remove("inbattle");');

  // 3. lore
  check('the codex has an entry for every floor from 11 to 20', await ev('[11,12,13,14,15,16,17,18,19,20].every(d=>LORE.some(l=>l.at===d))'));
  check('and a hint for every secret', await ev('["stairgame","bunk","candlesong","hollis","manners","miners","strike","lamprule","whisper"].every(id=>LORE.some(l=>l.id===id))'));

  // 4. whispers
  await run();
  check('a whisper in the wrong place does nothing', await ev('(()=>{const hp=S.maxhp;whisper("pray");return S.maxhp===hp&&!S.prayed;})()'));
  check('an unknown word does nothing either', await ev('(()=>{whisper("xyzzy");return true;})()'));
  check('PRAY at a shrine heals you and adds 5 to your health', await ev('(()=>{S.atShrine=true;S.hp=10;const m=S.maxhp;whisper("PRAY");return S.maxhp===m+5&&S.hp===S.maxhp;})()'));
  check('...once a descent', await ev('(()=>{const m=S.maxhp;whisper("pray");return S.maxhp===m;})()'));
  check('LIGHT only by the Queen\'s tomb, and then the Queen is weaker', await ev(`(()=>{for(let i=0;i<30&&!TOMB;i++){S.depth=8;newFloor(8);}
    whisper("light");const away=!S.candlesLit;S.px=TOMB.x;S.py=TOMB.y+2;whisper("light");
    mons=[];spawnMon("queen",S.px+1,S.py);const q=mons[0],full=q.hp;startBattle(q);const w=B.mhp;B=null;S.mode="map";document.body.classList.remove("inbattle");
    return away&&S.candlesLit&&w===Math.round(full*.75);})()`));
  check('HOLLIS only on the knights\' floor', await ev(`(()=>{const s0=S.str;whisper("hollis");const a=S.str===s0;S.depth=9;whisper("hollis");return a&&S.str===s0+2;})()`));
  check('KNEEL only before the King', await ev(`(()=>{S.depth=10;newFloor(10);whisper("kneel");const a=!!S.knelt===!!(THRONE&&Math.max(Math.abs(S.px-THRONE.x),Math.abs(S.py-THRONE.y))<=9);
    S.px=THRONE.x;S.py=THRONE.y+3;whisper("kneel");return a&&S.knelt;})()`));
  check('MOON only works between midnight and one', await ev(`(()=>{const D=Date;S.moonFloor=0;
    window.Date=class extends D{getHours(){return 14;}};whisper("moon");const day=S.moonFloor!==S.depth;
    window.Date=class extends D{getHours(){return 0;}};whisper("moon");window.Date=D;return day&&S.moonFloor===S.depth;})()`));
  await run('cade');
  check('VOID is only Eric\'s to say, on floor 17', await ev('(()=>{S.depth=17;whisper("void");return !S.voided;})()'));
  await run('pact_maker');
  check('...and when he does, the Thing is weaker', await ev(`(()=>{S.depth=17;whisper("void");mons=[];spawnMon("thing",S.px+1,S.py);const t=mons[0],full=t.hp;startBattle(t);const w=B.mhp;B=null;S.mode="map";document.body.classList.remove("inbattle");
    return S.voided&&w===Math.round(full*.85);})()`));
  check('TAM heals your wisp, if you have one', await ev(`(()=>{const r=POTIONS.find(p=>p.id==="wisp");S.pack.push({kind:"use",ref:r,glyph:r.glyph,col:r.col,name:r.name,note:r.note});
    const w=activeWisp();w.whp=1;whisper("tam");return w.whp===w.wmax;})()`));
  check('the whisper box opens with / on the map', await ev('(()=>{S.mode="map";hideOverlay();window.dispatchEvent(new KeyboardEvent("keydown",{key:"/"}));const o=whisperOpen&&!!document.getElementById("whIn");closeWhisper();return o;})()'));

  // the stair game on the title
  await ev('META.konami=false;title();');
  for (const k of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']) await page.keyboard.press(k === 'b' || k === 'a' ? `Key${k.toUpperCase()}` : k);
  check('up, up, down, down, left, right, left, right, B, A on the title is heard', await ev('META.konami===true'));
  await run();
  check('and the next descent begins with 100 gold and three healing draughts', await ev('S.gold===100&&S.pack.filter(i=>i.ref&&i.ref.id==="heal").length>=3&&!META.konami'));
  check('the codex counts the secrets found', await ev('(()=>{toggleCodex();const t=document.querySelector("#card h3").textContent;toggleCodex();return /✶ \\d+\\/\\d+/.test(t);})()'));

  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
