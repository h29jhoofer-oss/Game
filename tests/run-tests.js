// Headless test runner (requires Playwright + Chromium):  node tests/run-tests.js
// 1) checks every special mechanic, 2) plays AI-vs-AI matches at each difficulty.
const path = require('path');
const { chromium } = require('playwright');
const EXPECT = {
  titanSplit: (v) => v === 2, necroSpawn: (v) => v === 3, denSpawn: (v) => v >= 2, trapGone: (v) => v === true,
  moleBurrowingUntargetable: (v) => v === true, moleEnemyTowerHp: (v) => v < 3000, infernoMeltsBrute: (v) => v === true,
  ramY: (v) => v > 15 && v < 17, squireCrossX: (v) => Math.abs(v - 14.5) <= 1, drummerBuff: (v) => v > 1, frostSlow: (v) => v < 1,
  meteorKillsArchers: (v) => v === true, arrowsTowerDmg: (v) => v > 0 && v < 150, stormStunned: (v) => v >= 1, galePush: (v) => v > 0.3,
  paladinCharged: (v) => v === true, zepDeathDmg: (v) => v > 0, druidHealed: (v) => v > 0, ballistaTowerDmg: (v) => v > 0,
  pocketBefore: (v) => v === false, pocketAfter: (v) => v === true, kingActiveAfterPrincess: (v) => v === true, crowns: (v) => v === 1,
  endReason: (v) => v === 'king', winner: (v) => v === 0, cantAfford: (v) => v === true, cycle: (v) => v === true,
};
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('file://' + path.resolve(__dirname, 'sim.html'));
  const mech = await p.evaluate(() => runMechanics());
  let fail = 0;
  for (const [k, ok] of Object.entries(EXPECT)) {
    const pass = ok(mech[k]);
    if (!pass) fail++;
    console.log((pass ? 'PASS ' : 'FAIL ') + k + ' = ' + JSON.stringify(mech[k]));
  }
  for (const [d0, d1] of [['hard', 'easy'], ['medium', 'easy'], ['hard', 'medium']]) {
    const r = await p.evaluate(([a, c]) => runSims(6, a, c, 5), [d0, d1]);
    const w = [0, 0, 0];
    r.results.forEach((x) => { w[x.winner === -1 ? 2 : x.winner]++; });
    console.log(`${d0} vs ${d1}: ${w[0]}-${w[1]} (draws ${w[2]})` + (r.errors.length ? ' ERRORS ' + r.errors[0] : ''));
    if (r.errors.length) fail++;
  }
  if (errs.length) { console.log('page errors', errs); fail++; }
  await b.close();
  console.log(fail ? `${fail} FAILURE(S)` : 'ALL PASSED');
  process.exit(fail ? 1 : 0);
})();
