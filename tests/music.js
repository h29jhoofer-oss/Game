// The score follows the game, and events have their own stingers. Run: node tests/music.js
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const FILE = 'file://' + path.resolve(__dirname, '..', 'hollow_depths.html');
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE);
  await page.waitForTimeout(300);
  const ev = s => page.evaluate(s);
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
  await ev('(()=>{tamChatter=false;menuQuiet=false;start("cade");descentT=0;fade=0;snareTick=()=>{};})()');
  const want = s => ev(`(()=>{${s};return musWanted();})()`);
  check('the castle floors have their own piece', await want('S.depth=3') === 'explore');
  check('below the throne the music changes', await want('S.depth=14') === 'deep');
  check('a fight changes it', await want('S.hp=S.maxhp=999;mons=[];spawnMon("orc",S.px+1,S.py);startBattle(mons[0]);B.dlg=null') === 'battle');
  check('the Ghost Queen has her own theme', await want('endBattle();mons=[];spawnMon("queen",S.px+1,S.py);startBattle(mons[0]);B.dlg=null') === 'queen');
  check('so does the Hollow King', await want('endBattle();mons=[];spawnMon("king",S.px+1,S.py);mons[0].seated=false;startBattle(mons[0]);B.dlg=null') === 'king');
  check('and the Thing', await want('endBattle();mons=[];spawnMon("thing",S.px+1,S.py);startBattle(mons[0]);B.dlg=null') === 'thing');
  check('the chase has its own', await want('B=null;S.mode="map";S.chase={wait:9,wait0:9}') === 'chase');
  check('the monk standing firm brings the light', await want('S.chase=null;S.monkStand=true') === 'holy');
  check('the crash course is gentler', await want('S.monkStand=false;S.tut={step:1,t:0,flags:{}}') === 'courtyard');
  check('the title has its own piece', await want('S.tut=null;menuMusic=true') === 'title');
  check('and the death screen is quiet', await want('menuMusic=false;S.over=true') === null);
  await ev('S.over=false');
  check('every piece exists and can play a bar', await ev('(()=>{ensureAudio();if(!amb)return "noaudio";musBus();const t=actx.currentTime;for(const k in TRACKS)for(let i=0;i<TRACKS[k].bar*4;i++)TRACKS[k].step(i,t+i*.01,.5);return true;})()'));
  // stingers fire on their events
  await ev('(()=>{window._s=[];for(const f of ["sfxLevelUp","sfxLearnMove","sfxVictory","sfxBossDown","sfxDeath","sfxUnlock","sfxCardNew","sfxPhase","sfxHit","sfxHurt","sfxParry","sfxSnare"]){const o=window[f];window[f]=(...a)=>{_s.push(f);};}})()');
  await ev('(()=>{menuQuiet=false;start("cade");descentT=0;fade=0;S.xp=XPTABLE[1]-1;gainXp(1);})()');
  check('levelling up plays a fanfare', await ev('_s.includes("sfxLevelUp")'));
  await page.waitForTimeout(900);
  check('and learning a new attack has its own sound', await ev('_s.includes("sfxLearnMove")'));
  await ev('(()=>{S.hp=S.maxhp=999;mons=[];spawnMon("orc",S.px+1,S.py);startBattle(mons[0]);B.dlg=null;hurtMon(3,false);hurtPlayer(2,false);})()');
  check('blows landing make a sound, both ways', await ev('_s.includes("sfxHit")&&_s.includes("sfxHurt")'));
  await ev('(()=>{B.mhp=0;winBattle();})()');
  check('winning plays a victory sting', await ev('_s.includes("sfxVictory")'));
  await ev('(()=>{for(let i=0;i<20;i++)bumpStat("wounds");})()'); await page.waitForTimeout(400);
  check('unlocking a hero plays a fanfare', await ev('_s.includes("sfxUnlock")'));
  check('no page errors', errors.length === 0, errors);
  let pass = 0;
  for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + JSON.stringify(r.detail))); if (r.ok) pass++; }
  console.log(`${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
