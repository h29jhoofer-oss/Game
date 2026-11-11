/* DEEP DIG — a pixel-art daily rare-answer trivia game. */
(() => {
  "use strict";

  // ------------------------------------------------------------------
  // Config
  // ------------------------------------------------------------------
  const ROUNDS = 7;
  const ROUND_SECONDS = 20;
  const METERS_PER_POINT = 10;
  const LAUNCH = new Date(2026, 10, 11); // Dig #1 (local time)

  const TIERS = [
    { name: "BEDROCK", label: "No find", pts: 0,   emoji: "⬛", color: "#6a6470" },
    { name: "DIRT",    label: "Common",  pts: 10,  emoji: "🟫", color: "#8b5a2b" },
    { name: "COPPER",  label: "Uncommon",pts: 25,  emoji: "🟧", color: "#e07b39" },
    { name: "SILVER",  label: "Rare",    pts: 50,  emoji: "⬜", color: "#c9d4e0" },
    { name: "GOLD",    label: "Epic",    pts: 75,  emoji: "🟨", color: "#ffd23f" },
    { name: "DIAMOND", label: "Legendary", pts: 100, emoji: "💎", color: "#6ff0ff" },
  ];

  const RANKS = [
    [0, "Still at the surface. Grab a shovel!"],
    [500, "Garden digger."],
    [1500, "Sandbox explorer."],
    [2500, "Tunnel rat."],
    [3500, "Cave crawler."],
    [4500, "Deep delver."],
    [5500, "Core seeker."],
    [6500, "Legendary excavator!"],
  ];

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function localDayNumber(d = new Date()) {
    const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((mid - LAUNCH) / 86400000);
  }

  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  const store = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : fallback;
      } catch { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
    },
  };

  function titleCase(s) {
    return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
  }

  // ------------------------------------------------------------------
  // Question bank + answer matching
  // ------------------------------------------------------------------
  function normalize(s) {
    return s
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/['’`.]/g, "")
      .replace(/[^a-z0-9+#]+/g, " ")
      .trim()
      .replace(/^(the|a|an) /, "")
      .replace(/ /g, "");
  }

  function variants(key) {
    const v = new Set([key]);
    if (key.length > 3) {
      if (key.endsWith("ies")) v.add(key.slice(0, -3) + "y");
      if (key.endsWith("es")) v.add(key.slice(0, -2));
      if (key.endsWith("s")) v.add(key.slice(0, -1));
    }
    return v;
  }

  const QUESTIONS = window.QUESTION_BANK.map(([prompt, tierStr]) => {
    const keys = new Map();      // normalized key -> { tier, display }
    const byTier = [[], [], [], [], [], []];
    tierStr.split("|").forEach((group, i) => {
      const tier = i + 1;
      group.split(",").map((s) => s.trim()).filter(Boolean).forEach((entry) => {
        const aliases = entry.split("/").map((s) => s.trim()).filter(Boolean);
        const display = titleCase(aliases[0]);
        let added = false;
        aliases.forEach((al) => {
          for (const k of variants(normalize(al))) {
            if (k && !keys.has(k)) { keys.set(k, { tier, display }); added = true; }
          }
        });
        if (added) byTier[tier].push(display);
      });
    });
    return { prompt, keys, byTier };
  });

  function levenshtein(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        rowMin = Math.min(rowMin, cur[j]);
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function judge(q, raw) {
    const key = normalize(raw || "");
    if (!key) return { tier: 0, display: raw || "—" };
    for (const k of variants(key)) {
      if (q.keys.has(k)) return q.keys.get(k);
    }
    const tol = key.length >= 9 ? 2 : key.length >= 5 ? 1 : 0;
    if (tol) {
      let best = null, bestD = tol + 1;
      for (const [k, info] of q.keys) {
        const d = levenshtein(key, k, tol);
        if (d < bestD || (d === bestD && best && info.tier > best.tier)) { bestD = d; best = info; }
      }
      if (best && bestD <= tol) return best;
    }
    return { tier: 0, display: titleCase(raw.trim()) };
  }

  // ------------------------------------------------------------------
  // Daily selection — a fresh shuffled set every day
  // ------------------------------------------------------------------
  function dailyQuestionIndexes(day) {
    const n = QUESTIONS.length;
    const perCycle = Math.floor(n / ROUNDS); // days before any prompt repeats
    const cycle = Math.floor(day / perCycle);
    const slot = ((day % perCycle) + perCycle) % perCycle;
    const order = shuffle([...Array(n).keys()], mulberry32(cycle * 7919 + 1337));
    return order.slice(slot * ROUNDS, slot * ROUNDS + ROUNDS);
  }

  function randomQuestionIndexes() {
    const rng = mulberry32((Math.random() * 2 ** 32) >>> 0);
    return shuffle([...Array(QUESTIONS.length).keys()], rng).slice(0, ROUNDS);
  }

  // ------------------------------------------------------------------
  // Sound (tiny square-wave bleeps)
  // ------------------------------------------------------------------
  let soundOn = store.get("deepdig-sound", true);
  let actx = null;
  function beep(freqs, dur = 0.08, type = "square") {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      let t = actx.currentTime;
      freqs.forEach((f) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + dur);
        t += dur * 0.9;
      });
    } catch { /* audio unavailable */ }
  }
  const SFX = {
    tier: (t) => {
      if (t === 0) beep([180, 120], 0.12, "sawtooth");
      else if (t === 5) beep([523, 659, 784, 1047, 1319], 0.08);
      else beep([330, 392, 440, 523].slice(0, t + 1), 0.07);
    },
    tick: () => beep([880], 0.03),
    click: () => beep([440], 0.04),
  };

  // ------------------------------------------------------------------
  // Pixel scene
  // ------------------------------------------------------------------
  const canvas = $("scene");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const SURFACE = 30;          // world y of ground line
  const PX_PER_M = 1 / 25;     // world pixels per meter
  const WORLD_H = SURFACE + Math.ceil(7200 * PX_PER_M) + H;
  const SHAFT_X = 76, SHAFT_W = 9;

  const LAYERS = [ // [startMeters, base rgb, alt rgb]
    [0,    [120, 78, 40],  [96, 60, 30]],
    [1000, [150, 100, 60], [128, 82, 48]],
    [2500, [104, 100, 110],[84, 80, 92]],
    [4000, [66, 60, 84],   [50, 44, 66]],
    [5500, [70, 34, 40],   [52, 22, 30]],
    [6600, [90, 30, 20],   [140, 50, 20]],
  ];
  const ORE = [[224, 123, 57], [201, 212, 224], [255, 210, 63], [111, 240, 255], [180, 90, 200]];

  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const terrain = document.createElement("canvas");
  terrain.width = W; terrain.height = WORLD_H;
  (function buildTerrain() {
    const tctx = terrain.getContext("2d");
    const img = tctx.createImageData(W, WORLD_H);
    const d = img.data;
    for (let y = 0; y < WORLD_H; y++) {
      const meters = (y - SURFACE) / PX_PER_M;
      let layer = LAYERS[0];
      for (const L of LAYERS) if (meters >= L[0]) layer = L;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        let c;
        if (y < SURFACE) {
          // night sky, banded
          const band = Math.floor(y / 5);
          c = [[20, 16, 50], [30, 22, 66], [44, 30, 84], [64, 40, 100], [92, 52, 108], [130, 70, 110]][Math.min(band, 5)];
          if (hash2(x, y) > 0.985 && y < SURFACE - 8) c = [255, 240, 200];
        } else if (y < SURFACE + 2) {
          c = (x + y) % 3 === 0 ? [60, 160, 70] : [80, 190, 80];
        } else if (y < SURFACE + 3) {
          c = [52, 120, 52];
        } else {
          const r = hash2(x, y);
          c = r < 0.28 ? layer[2] : layer[1];
          // layer boundary seam
          const seam = LAYERS.some((L) => L[0] > 0 && Math.abs(meters - L[0]) < 25 && hash2(x, 3) > 0.3);
          if (seam) c = c.map((v) => v * 0.7);
          // ore specks — rarer and shinier the deeper you go
          const r2 = hash2(x * 7 + 3, y * 13 + 1);
          if (r2 > 0.993) {
            const oreTier = Math.min(ORE.length - 1, Math.floor((meters / 7000) * ORE.length * hash2(y, x)));
            c = ORE[Math.max(0, oreTier)];
          }
          // pebbles
          if (r > 0.97) c = c.map((v) => Math.min(255, v + 30));
        }
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    tctx.putImageData(img, 0, 0);
    // little shack + flag at the surface
    const px = (x, y, w, h, col) => { tctx.fillStyle = col; tctx.fillRect(x, y, w, h); };
    px(30, SURFACE - 10, 14, 10, "#7a4a2a");
    px(28, SURFACE - 13, 18, 3, "#a33b3b");
    px(30, SURFACE - 15, 14, 2, "#a33b3b");
    px(35, SURFACE - 6, 4, 6, "#2a1a10");
    px(32, SURFACE - 9, 2, 2, "#ffd23f");
    px(SHAFT_X - 4, SURFACE - 6, 1, 6, "#ddd");
    px(SHAFT_X - 3, SURFACE - 6, 4, 2, "#ffcc33");
    px(110, SURFACE - 4, 2, 4, "#5a3a1a"); // fence
    px(118, SURFACE - 4, 2, 4, "#5a3a1a");
    px(126, SURFACE - 4, 2, 4, "#5a3a1a");
    px(108, SURFACE - 3, 22, 1, "#7a5a2a");
    // moon
    px(140, 6, 6, 6, "#f4ead5"); px(139, 7, 1, 4, "#f4ead5"); px(146, 7, 1, 4, "#f4ead5");
    px(143, 8, 2, 2, "#d8cdb5");
  })();

  const MINER = [
    "..YYYY..",
    ".YYYYLY.",
    ".SSSSSS.",
    ".SKSSKS.",
    "..SSSS..",
    ".BBBBBB.",
    "SBBBBBBS",
    ".DDDDDD.",
    ".DD..DD.",
    ".KK..KK.",
  ];
  const MINER_PAL = { Y: "#ffcc33", L: "#fffbe0", S: "#f2b58a", K: "#2a1a10", B: "#3a7bd5", D: "#3b3355" };
  const GEM = [".XXX.", "XWXXX", "XXXXX", ".XXX.", "..X.."];
  const CLUMP = [".XX..", "XXXX.", "XXXXX", ".XXX."];

  function drawSprite(rows, pal, x, y, color) {
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        if (ch === ".") continue;
        ctx.fillStyle = color ? (ch === "W" ? "#ffffff" : color) : pal[ch];
        ctx.fillRect(x + rx, y + ry, 1, 1);
      }
    });
  }

  const scene = {
    depth: 0,          // displayed meters
    target: 0,         // target meters
    finds: [],         // { meters, tier, side }
    particles: [],
    frame: 0,
    celebrate: 0,
  };

  function setSceneTarget(meters) { scene.target = meters; }

  function addFind(meters, tier) {
    scene.finds.push({ meters, tier, side: scene.finds.length % 2 });
  }

  function resetScene() {
    scene.depth = 0; scene.target = 0; scene.finds = []; scene.particles = [];
  }

  function renderScene() {
    scene.frame++;
    const digging = scene.depth < scene.target - 0.5;
    if (digging) {
      const step = Math.max(6, (scene.target - scene.depth) * 0.04);
      scene.depth = Math.min(scene.target, scene.depth + step);
    } else {
      scene.depth = scene.target;
    }

    const minerY = SURFACE + scene.depth * PX_PER_M; // world y of feet
    const camY = Math.max(0, Math.min(WORLD_H - H, minerY - H * 0.55));

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(terrain, 0, Math.round(camY), W, H, 0, 0, W, H);

    const sy = (wy) => Math.round(wy - camY);

    // shaft
    const shaftTop = sy(SURFACE);
    const shaftBot = sy(minerY);
    if (shaftBot > shaftTop) {
      ctx.fillStyle = "#140c18";
      ctx.fillRect(SHAFT_X, Math.max(0, shaftTop), SHAFT_W, shaftBot - Math.max(0, shaftTop));
      ctx.fillStyle = "#24182c";
      ctx.fillRect(SHAFT_X, Math.max(0, shaftTop), 1, shaftBot - Math.max(0, shaftTop));
      // ladder rungs
      ctx.fillStyle = "#5a3a1a";
      for (let y = SURFACE + 4; y < minerY - 10; y += 4) {
        const yy = sy(y);
        if (yy >= -1 && yy < H) ctx.fillRect(SHAFT_X + 2, yy, SHAFT_W - 4, 1);
      }
    }

    // finds embedded in the wall
    scene.finds.forEach((f) => {
      const wy = SURFACE + f.meters * PX_PER_M;
      const yy = sy(wy) - 6;
      if (yy < -6 || yy > H) return;
      const x = f.side ? SHAFT_X + SHAFT_W + 1 : SHAFT_X - 6;
      const col = TIERS[f.tier].color;
      if (f.tier === 0) drawSprite(CLUMP, null, x, yy + 1, "#4a4450");
      else if (f.tier === 1) drawSprite(CLUMP, null, x, yy + 1, col);
      else {
        drawSprite(GEM, null, x, yy, col);
        if ((scene.frame + f.meters) % 60 < 4) { ctx.fillStyle = "#fff"; ctx.fillRect(x + 1, yy - 1, 1, 1); }
      }
    });

    // miner
    const mx = SHAFT_X;
    const my = sy(minerY) - MINER.length;
    const bob = digging ? (Math.floor(scene.frame / 4) % 2) : 0;
    drawSprite(MINER, MINER_PAL, mx, my + bob);
    // pickaxe
    const swing = digging ? Math.floor(scene.frame / 4) % 2 : 0;
    ctx.fillStyle = "#8a5a2a";
    if (swing) { ctx.fillRect(mx + 8, my + 6, 1, 4); ctx.fillStyle = "#bbb"; ctx.fillRect(mx + 7, my + 9, 3, 1); }
    else { ctx.fillRect(mx + 8, my + 4, 1, 4); ctx.fillStyle = "#bbb"; ctx.fillRect(mx + 7, my + 4, 3, 1); }

    // debris particles
    if (digging && scene.frame % 2 === 0) {
      for (let i = 0; i < 2; i++) {
        scene.particles.push({
          x: mx + 4 + (Math.random() * 6 - 3), y: my + MINER.length,
          vx: Math.random() * 1.6 - 0.8, vy: -Math.random() * 1.4, life: 18,
          c: Math.random() < 0.5 ? "#a07040" : "#d0a070",
        });
      }
    }
    if (scene.celebrate > 0) {
      scene.celebrate--;
      if (scene.frame % 2 === 0) {
        const cols = ["#6ff0ff", "#ffd23f", "#fff", "#ff7bd5"];
        scene.particles.push({
          x: mx + 4, y: my, vx: Math.random() * 3 - 1.5, vy: -Math.random() * 2 - 0.5, life: 26,
          c: cols[Math.floor(Math.random() * cols.length)],
        });
      }
    }
    scene.particles = scene.particles.filter((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      return p.life > 0;
    });

    // darkness deeper down, with a helmet-lamp glow
    const dark = Math.min(0.75, scene.depth / 7000 * 0.85);
    if (dark > 0.02) {
      const g = ctx.createRadialGradient(mx + 5, my + 1, 6, mx + 5, my + 1, 70);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(5,0,10,${dark})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    $("hud-depth").textContent = `${Math.round(scene.depth)}m`;
    requestAnimationFrame(renderScene);
  }

  // ------------------------------------------------------------------
  // Game state
  // ------------------------------------------------------------------
  const today = localDayNumber();
  const todayKey = dateKey();
  const digNumber = today + 1;

  let mode = "daily";           // "daily" | "practice"
  let game = null;              // { qIdx: [], results: [], round, startedAt }
  let timerHandle = null;

  function newGame(qIdx) {
    return { qIdx, results: [], round: 0, startedAt: null };
  }

  function saveDaily() {
    if (mode === "daily") store.set("deepdig-daily", { key: todayKey, game });
  }

  function loadDaily() {
    const saved = store.get("deepdig-daily", null);
    if (saved && saved.key === todayKey && saved.game) return saved.game;
    return null;
  }

  function totalPoints(g) {
    return g.results.reduce((s, r) => s + TIERS[r.tier].pts, 0);
  }

  // ------------------------------------------------------------------
  // Screens
  // ------------------------------------------------------------------
  const SCREENS = ["title", "question", "reveal", "results"];
  function show(name) {
    SCREENS.forEach((s) => $(`screen-${s}`).classList.toggle("hidden", s !== name));
  }

  function updateHudRound() {
    if (!game || game.round >= ROUNDS) { $("hud-round").textContent = mode === "practice" ? "PRACTICE" : `DIG #${digNumber}`; return; }
    $("hud-round").textContent = `${game.round + 1}/${ROUNDS}`;
  }

  function startRound() {
    const q = QUESTIONS[game.qIdx[game.round]];
    if (!game.startedAt) game.startedAt = Date.now();
    saveDaily();
    show("question");
    updateHudRound();
    $("q-round").textContent = `PROMPT ${game.round + 1}/${ROUNDS}`;
    $("q-text").textContent = q.prompt;
    const input = $("answer");
    input.value = "";
    input.disabled = false;
    setTimeout(() => input.focus(), 30);
    runTimer();
  }

  function runTimer() {
    clearInterval(timerHandle);
    let lastSec = null;
    const tick = () => {
      const left = Math.max(0, ROUND_SECONDS - (Date.now() - game.startedAt) / 1000);
      const fill = $("timer-fill");
      fill.style.width = `${(left / ROUND_SECONDS) * 100}%`;
      fill.classList.toggle("warn", left <= 5);
      const sec = Math.ceil(left);
      $("q-time").textContent = `${sec}s`;
      if (left <= 5 && sec !== lastSec && sec > 0) SFX.tick();
      lastSec = sec;
      if (left <= 0) submitAnswer($("answer").value, true);
    };
    tick();
    timerHandle = setInterval(tick, 100);
  }

  function submitAnswer(raw, timedOut = false) {
    if (!game || game.round >= ROUNDS || game.startedAt === null) return;
    clearInterval(timerHandle);
    const q = QUESTIONS[game.qIdx[game.round]];
    const res = judge(q, raw);
    const entry = { raw: (raw || "").trim(), tier: res.tier, display: res.display, timedOut: timedOut && !raw.trim() };
    game.results.push(entry);
    game.startedAt = null;
    const pts = totalPoints(game);
    addFind(pts * METERS_PER_POINT, res.tier);
    setSceneTarget(pts * METERS_PER_POINT);
    if (res.tier >= 4) scene.celebrate = 40;
    saveDaily();
    showReveal(q, entry);
  }

  function showReveal(q, entry) {
    show("reveal");
    SFX.tier(entry.tier);
    const t = TIERS[entry.tier];
    const badge = $("reveal-tier");
    badge.className = `tier-badge tier-${entry.tier}`;
    badge.textContent = entry.tier ? `${t.name}!` : (entry.timedOut ? "TIME UP" : "BEDROCK");
    void badge.offsetWidth; // restart animation
    $("reveal-answer").textContent = entry.raw ? `"${entry.display}"` : "(no answer)";
    $("reveal-points").textContent = entry.tier
      ? `${t.label.toUpperCase()} · +${t.pts} PTS · +${t.pts * METERS_PER_POINT}m`
      : (entry.raw ? "Not in our vein — +0" : "+0");

    // Show a sample of other answers, weighted toward the rare ones
    const rng = mulberry32(game.qIdx[game.round] * 31 + today);
    const ex = [];
    for (const tier of [5, 4, 3, 1]) {
      const pool = shuffle(q.byTier[tier].filter((d) => d !== entry.display), rng);
      const take = tier === 5 ? 2 : 1;
      pool.slice(0, take).forEach((d) => ex.push({ d, tier }));
    }
    const ul = $("reveal-examples");
    ul.innerHTML = "";
    ex.forEach(({ d, tier }) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = d;
      const chip = document.createElement("span");
      chip.className = `chip tier-${tier}`;
      chip.textContent = TIERS[tier].name;
      li.append(span, chip);
      ul.append(li);
    });

    game.round++;
    saveDaily();
    $("btn-next").textContent = game.round >= ROUNDS ? "SEE RESULTS" : "KEEP DIGGING";
    $("btn-next").focus();
  }

  function finish() {
    const pts = totalPoints(game);
    const meters = pts * METERS_PER_POINT;
    if (mode === "daily") recordStats(meters);
    showResults();
  }

  function rankFor(m) {
    let r = RANKS[0][1];
    for (const [min, txt] of RANKS) if (m >= min) r = txt;
    return r;
  }

  function showResults() {
    show("results");
    updateHudRound();
    const meters = totalPoints(game) * METERS_PER_POINT;
    setSceneTarget(meters);
    $("res-title").textContent = mode === "daily" ? `DIG #${digNumber} DONE` : "PRACTICE DONE";
    $("res-depth").textContent = meters;
    $("res-rank").textContent = rankFor(meters);
    const ol = $("res-list");
    ol.innerHTML = "";
    game.results.forEach((r, i) => {
      const li = document.createElement("li");
      const q = document.createElement("span");
      q.className = "q";
      q.textContent = QUESTIONS[game.qIdx[i]].prompt.replace(/^Name (a |an )?/i, "");
      const a = document.createElement("span");
      a.className = "a";
      a.textContent = r.raw ? r.display : "—";
      const chip = document.createElement("span");
      chip.className = `chip tier-${r.tier}`;
      chip.textContent = r.tier ? `+${TIERS[r.tier].pts}` : "0";
      li.append(q, a, chip);
      ol.append(li);
    });
    $("btn-again").classList.toggle("hidden", mode !== "practice");
    $("btn-share").classList.toggle("hidden", mode !== "daily");
    updateCountdown();
  }

  function shareText() {
    const meters = totalPoints(game) * METERS_PER_POINT;
    const row = game.results.map((r) => TIERS[r.tier].emoji).join("");
    return `DEEP DIG #${digNumber} ⛏️ ${meters}m\n${row}`;
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.add("hidden"), 1800);
  }

  function updateCountdown() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    const txt = `Next dig in ${hh}:${mm}:${ss}`;
    if (!$("screen-results").classList.contains("hidden")) $("res-next").textContent = txt;
    if (!$("screen-title").classList.contains("hidden") && dailyDone()) $("title-note").textContent = txt;
    if (s === 0) location.reload();
  }
  setInterval(updateCountdown, 1000);

  // ------------------------------------------------------------------
  // Stats
  // ------------------------------------------------------------------
  function getStats() {
    return store.get("deepdig-stats", { played: 0, streak: 0, maxStreak: 0, best: 0, total: 0, lastDay: null, tiers: [0, 0, 0, 0, 0, 0] });
  }

  function recordStats(meters) {
    const st = getStats();
    if (st.lastDay === today) return;
    st.played++;
    st.streak = st.lastDay === today - 1 ? st.streak + 1 : 1;
    st.maxStreak = Math.max(st.maxStreak, st.streak);
    st.best = Math.max(st.best, meters);
    st.total += meters;
    st.lastDay = today;
    game.results.forEach((r) => { st.tiers[r.tier]++; });
    store.set("deepdig-stats", st);
  }

  function dailyDone() {
    const g = loadDaily();
    return !!(g && g.results.length >= ROUNDS);
  }

  // ------------------------------------------------------------------
  // Modals
  // ------------------------------------------------------------------
  function openModal(html) {
    $("modal-body").innerHTML = html;
    $("modal").classList.remove("hidden");
  }
  function closeModal() { $("modal").classList.add("hidden"); }

  function helpHtml() {
    const rows = TIERS.slice(1).reverse().map((t, i) =>
      `<tr><td><span class="chip tier-${5 - i}">${t.name}</span></td><td>${t.label}</td><td>+${t.pts}</td></tr>`).join("");
    return `
      <h3>HOW TO PLAY</h3>
      <p>Every day you get <b>${ROUNDS} prompts</b> like <i>"Name a fruit"</i>. You have <b>${ROUND_SECONDS} seconds</b> and <b>one answer</b> each.</p>
      <p>Any correct answer counts — but obvious answers are just dirt. Dig up an answer few people would think of to strike gold.</p>
      <table class="tier-table">${rows}
        <tr><td><span class="chip tier-0">BEDROCK</span></td><td>Wrong / no answer</td><td>+0</td></tr></table>
      <p>Every point digs you ${METERS_PER_POINT}m deeper. A perfect dig reaches <b>${ROUNDS * 100 * METERS_PER_POINT}m</b>.</p>
      <p>Small typos are forgiven. Everyone gets the same prompts each day, and a new set unlocks at midnight.</p>
      <p>Want more? The <b>Practice Mine</b> serves up random prompts any time — it doesn't count toward your stats.</p>`;
  }

  function statsHtml() {
    const st = getStats();
    const avg = st.played ? Math.round(st.total / st.played) : 0;
    const max = Math.max(1, ...st.tiers);
    const bars = TIERS.map((t, i) => ({ t, i })).reverse().map(({ t, i }) =>
      `<div class="bar-row"><span class="lbl">${t.name}</span><span class="bar" style="width:${(st.tiers[i] / max) * 70}%;background:${t.color}"></span><span>${st.tiers[i]}</span></div>`).join("");
    return `
      <h3>STATS</h3>
      <div class="stat-grid">
        <div><b>${st.played}</b><span>digs</span></div>
        <div><b>${st.streak}</b><span>streak</span></div>
        <div><b>${st.maxStreak}</b><span>best streak</span></div>
        <div><b>${avg}</b><span>avg m</span></div>
      </div>
      <p>Deepest dig: <b>${st.best}m</b></p>
      <p class="small">Finds by tier</p>
      <div class="bars">${bars}</div>`;
  }

  // ------------------------------------------------------------------
  // Boot / wiring
  // ------------------------------------------------------------------
  function showTitle() {
    mode = "daily";
    show("title");
    $("title-dig").textContent = `DIG #${digNumber} · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    const saved = loadDaily();
    const btn = $("btn-play");
    resetScene();
    if (saved) {
      saved.results.forEach((r, i) => {
        const pts = saved.results.slice(0, i + 1).reduce((s, x) => s + TIERS[x.tier].pts, 0);
        addFind(pts * METERS_PER_POINT, r.tier);
      });
      setSceneTarget(totalPoints(saved) * METERS_PER_POINT);
    }
    if (saved && saved.results.length >= ROUNDS) {
      btn.textContent = "VIEW TODAY'S DIG";
      updateCountdown();
    } else if (saved && saved.results.length > 0) {
      btn.textContent = `RESUME (${saved.results.length}/${ROUNDS})`;
      $("title-note").textContent = "";
    } else {
      btn.textContent = "START DIG";
      $("title-note").textContent = "Same prompts for everyone today.";
    }
    updateHudRound();
  }

  $("btn-play").addEventListener("click", () => {
    SFX.click();
    mode = "daily";
    game = loadDaily() || newGame(dailyQuestionIndexes(today));
    if (game.results.length >= ROUNDS) { showResults(); return; }
    game.round = game.results.length;
    // If the page was reloaded mid-question, keep the original clock running.
    if (game.startedAt && (Date.now() - game.startedAt) / 1000 >= ROUND_SECONDS) {
      startRound();
      return;
    }
    startRound();
  });

  $("btn-practice").addEventListener("click", () => {
    SFX.click();
    mode = "practice";
    resetScene();
    game = newGame(randomQuestionIndexes());
    startRound();
  });

  $("btn-again").addEventListener("click", () => $("btn-practice").click());

  $("answer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("answer").value;
    if (!v.trim()) {
      const f = $("answer-form");
      f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
      return;
    }
    submitAnswer(v);
  });

  $("btn-skip").addEventListener("click", () => submitAnswer(""));

  $("btn-next").addEventListener("click", () => {
    SFX.click();
    if (game.round >= ROUNDS) finish();
    else startRound();
  });

  $("btn-share").addEventListener("click", async () => {
    const text = shareText();
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast("COPIED TO CLIPBOARD"); }
    } catch {
      toast("COULDN'T SHARE");
    }
  });

  $("btn-help").addEventListener("click", () => openModal(helpHtml()));
  $("btn-stats").addEventListener("click", () => openModal(statsHtml()));
  $("modal-close").addEventListener("click", closeModal);
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  const soundBtn = $("btn-sound");
  soundBtn.classList.toggle("off", !soundOn);
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    store.set("deepdig-sound", soundOn);
    soundBtn.classList.toggle("off", !soundOn);
    SFX.click();
  });

  // Logo returns to the title screen (abandons a practice run).
  document.querySelector(".logo").addEventListener("click", () => {
    if (mode === "practice" || !game || $("screen-question").classList.contains("hidden")) {
      clearInterval(timerHandle);
      showTitle();
    }
  });

  showTitle();
  requestAnimationFrame(renderScene);
  if (!store.get("deepdig-seen-help", false)) {
    store.set("deepdig-seen-help", true);
    openModal(helpHtml());
  }

  // Expose for debugging/tests.
  window.DeepDig = { QUESTIONS, judge, dailyQuestionIndexes, normalize };
})();
