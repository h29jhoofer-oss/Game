// Floor 5's ward: furniture, and the Queen's papers you keep. Run: node tests/ward.js
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
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

  await ev('localStorage.clear();META.papers=[];start("cade")');
  const st = await ev(`(()=>{const B={props:0,papers:0,cut:0,other:0};for(let i=0;i<30;i++){S.depth=5;newFloor(5);
    B.props+=PROPS.size;B.papers+=[...PROPS.values()].filter(p=>p.paper).length;
    for(const d of DOORS)map[d.y][d.x]=FLOOR;const f=floodFrom(S.px,S.py);
    if(!f.has(S.sx+","+S.sy))B.cut++;
    for(const l of LEVERS){let ok=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(f.has((l.x+dx)+","+(l.y+dy)))ok=true;if(!ok)B.cut++;}
    for(const o of [...items,...CHASMS,...mons.filter(m=>!m.t.guardian)])if(!f.has(o.x+","+o.y))B.cut++;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(map[y][x]!==WALL&&!f.has(x+","+y))B.cut++;
    S.depth=4;newFloor(4);B.other+=PROPS.size;}return B;})()`);
  check('floor 5 is furnished', st.props / 30 > 15, st);
  check('papers lie on some of its tables', st.papers / 30 >= 2, st);
  check('furniture never cuts anything off', st.cut === 0, st);
  check('other floors have no ward furniture', st.other === 0, st);

  await ev('S.depth=5;newFloor(5);descentT=0;fade=0;');
  const at = await ev(`(()=>{const pr=[...PROPS.values()].find(p=>p.paper);for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){const x=pr.x+dx,y=pr.y+dy;
    if(map[y]&&map[y][x]===FLOOR){S.px=x;S.py=y;S.fx=x+.5;S.fy=y+.5;mons=[];computeFOV();return pr.paper;}}return null})()`);
  check('you can see past the furniture', await ev('[...PROPS.keys()].some(k=>visible.has(k))'));
  await page.keyboard.press('e');
  await page.waitForTimeout(150);
  check('E takes the papers and shows them', await ev(`paperOpen&&META.papers.includes("${at}")&&!!document.querySelector(".paper-card")`));
  check('they are kept between runs', await ev(`JSON.parse(localStorage.getItem(META_KEY)).papers.includes("${at}")`));
  check('the table is left empty', await ev('![...PROPS.values()].some(p=>p.paper===' + JSON.stringify(at) + ')'));
  await page.keyboard.press('Escape');
  await ev('start("rook")');
  await page.keyboard.press('l');
  await page.waitForTimeout(150);
  check('the codex lists them on the next run', await ev(`document.querySelector("#card").innerText.includes("The Queen's papers")`));

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
