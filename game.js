/* DEEP DIG — a pixel-art daily rare-answer trivia game. */
(() => {
  "use strict";

  // ==================================================================
  // Config
  // ==================================================================
  const ROUNDS = 7;
  const ROUND_SECONDS = 20;
  const METERS_PER_POINT = 10;
  const MAX_METERS = ROUNDS * 100 * METERS_PER_POINT;
  const LAUNCH = new Date(2026, 10, 11); // Dig #1 (local time)
  const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TIERS = [
    { name: "BEDROCK", label: "No find",   pts: 0,   emoji: "⬛", color: "#6a6470" },
    { name: "DIRT",    label: "Common",    pts: 10,  emoji: "🟫", color: "#9a6434" },
    { name: "COPPER",  label: "Uncommon",  pts: 25,  emoji: "🟧", color: "#e07b39" },
    { name: "SILVER",  label: "Rare",      pts: 50,  emoji: "⬜", color: "#c9d4e0" },
    { name: "GOLD",    label: "Epic",      pts: 75,  emoji: "🟨", color: "#ffd23f" },
    { name: "DIAMOND", label: "Legendary", pts: 100, emoji: "💎", color: "#6ff0ff" },
  ];

  const RANKS = [
    [0, "Still at the surface"],
    [500, "Garden digger"],
    [1500, "Sandbox explorer"],
    [2500, "Tunnel rat"],
    [3500, "Cave crawler"],
    [4500, "Deep delver"],
    [5500, "Core seeker"],
    [6500, "Legendary excavator"],
  ];

  // ==================================================================
  // Utilities
  // ==================================================================
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

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
      try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
    },
  };

  function titleCase(s) {
    return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
  }

  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ==================================================================
  // Question bank + answer matching
  // ==================================================================
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
    const keys = new Map();
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

  // Optimal string alignment distance (Levenshtein + adjacent swaps)
  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v;
        rowMin = Math.min(rowMin, v);
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
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
        const d = editDistance(key, k, tol);
        if (d < bestD || (d === bestD && best && info.tier > best.tier)) { bestD = d; best = info; }
      }
      if (best && bestD <= tol) return best;
    }
    return { tier: 0, display: titleCase(raw.trim()) };
  }

  // ==================================================================
  // Daily selection — a fresh shuffled set every day
  // ==================================================================
  function dailyQuestionIndexes(day) {
    const n = QUESTIONS.length;
    const perCycle = Math.floor(n / ROUNDS);
    const cycle = Math.floor(day / perCycle);
    const slot = ((day % perCycle) + perCycle) % perCycle;
    const order = shuffle([...Array(n).keys()], mulberry32(cycle * 7919 + 1337));
    return order.slice(slot * ROUNDS, slot * ROUNDS + ROUNDS);
  }

  function randomQuestionIndexes() {
    const rng = mulberry32((Math.random() * 2 ** 32) >>> 0);
    return shuffle([...Array(QUESTIONS.length).keys()], rng).slice(0, ROUNDS);
  }

  // ==================================================================
  // Sound (tiny square-wave bleeps)
  // ==================================================================
  let soundOn = store.get("deepdig-sound", true);
  let actx = null;
  function beep(freqs, dur = 0.08, type = "square", vol = 0.06) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      let t = actx.currentTime;
      freqs.forEach((f) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(vol, t);
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
      else if (t === 5) beep([523, 659, 784, 1047, 1319, 1568], 0.08);
      else beep([330, 392, 440, 523, 659].slice(0, t + 1), 0.07);
    },
    tick: () => beep([880], 0.03),
    click: () => beep([440], 0.04),
    key: () => beep([1200 + Math.random() * 300], 0.015, "square", 0.02),
    strike: () => beep([70 + Math.random() * 30], 0.06, "triangle", 0.12),
  };

  // ==================================================================
  // Pixel scene (320 x 200)
  // ==================================================================
  const canvas = $("scene");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const SURFACE = 70;
  const PX_PER_M = 1 / 12.5;
  const WORLD_H = SURFACE + Math.ceil(MAX_METERS * PX_PER_M) + H;
  const SHAFT_W = 22;
  const SHAFT_X = Math.round(W / 2 - SHAFT_W / 2);
  const mToY = (m) => SURFACE + m * PX_PER_M;

  const LAYERS = [
    { m: 0,    name: "TOPSOIL",  c: [[118, 76, 40],  [96, 60, 30],  [140, 94, 54]] },
    { m: 1000, name: "CLAY",     c: [[160, 102, 60], [136, 84, 48], [184, 124, 78]] },
    { m: 2500, name: "STONE",    c: [[108, 106, 120],[86, 84, 100], [132, 130, 144]] },
    { m: 4000, name: "SLATE",    c: [[64, 60, 90],   [48, 44, 72],  [84, 80, 112]] },
    { m: 5500, name: "OBSIDIAN", c: [[46, 26, 48],   [32, 16, 34],  [70, 42, 72]] },
    { m: 6400, name: "MAGMA",    c: [[100, 36, 24],  [72, 22, 16],  [134, 54, 28]] },
  ];
  const layerIndexAt = (m) => { let i = 0; LAYERS.forEach((L, j) => { if (m >= L.m) i = j; }); return i; };

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const SKY = [[12, 10, 36], [24, 20, 62], [50, 34, 92], [96, 54, 114], [168, 90, 112]];

  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const s = (t) => t * t * (3 - 2 * t);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    const u = s(xf), v = s(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
  const farH = (x) => 16 + vnoise(x / 40, 3) * 18;
  const nearH = (x) => 6 + vnoise(x / 22, 7) * 12;

  // World features (generated once, deterministic)
  const caves = [], crystals = [], lavaPools = [], worms = [], lanterns = [];

  const terrain = document.createElement("canvas");
  terrain.width = W; terrain.height = WORLD_H;
  (function buildTerrain() {
    const t = terrain.getContext("2d");
    const img = t.createImageData(W, WORLD_H);
    const d = img.data;
    for (let y = 0; y < WORLD_H; y++) {
      const meters = (y - SURFACE) / PX_PER_M;
      const li = layerIndexAt(meters);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        let c;
        if (y < SURFACE) {
          const tt = (y / SURFACE) * (SKY.length - 1);
          const si = Math.floor(tt);
          c = SKY[Math.min(SKY.length - 1, si + ((tt - si) > bayer(x, y) ? 1 : 0))];
          if (y >= SURFACE - nearH(x)) c = [30, 22, 50];
          else if (y >= SURFACE - farH(x)) c = (y + x) % 7 === 0 ? [54, 38, 82] : [46, 32, 74];
        } else if (y < SURFACE + 3) {
          c = hash2(x, y) < 0.5 ? [96, 200, 92] : [72, 172, 74];
        } else if (y < SURFACE + 6) {
          c = bayer(x, y) < (y - SURFACE - 3) / 3 ? LAYERS[0].c[1] : [50, 124, 56];
        } else {
          let L = LAYERS[li];
          const next = LAYERS[li + 1];
          if (next && meters > next.m - 80 && bayer(x, y) < (meters - (next.m - 80)) / 80) L = next;
          const n = vnoise(x / 11, y / 7) * 0.7 + vnoise(x / 3, y / 3) * 0.3;
          c = n < 0.36 ? L.c[1] : n > 0.66 ? L.c[2] : L.c[0];
          if (hash2(x, y) > 0.985) c = L.c[2].map((v) => Math.min(255, v + 18));
        }
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    t.putImageData(img, 0, 0);

    const rng = mulberry32(4242);
    const px = (x, y, w, h, col) => { t.fillStyle = col; t.fillRect(x, y, w, h); };
    const circle = (cx, cy, r, col) => {
      t.fillStyle = col;
      for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.3));
        t.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
      }
    };
    const ellipse = (cx, cy, rx, ry, col) => {
      t.fillStyle = col;
      for (let dy = -ry; dy <= ry; dy++) {
        const w = Math.floor(rx * Math.sqrt(1 - (dy / ry) ** 2));
        t.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
      }
    };
    const groundBottom = WORLD_H - 4;
    const layerAtY = (y) => LAYERS[layerIndexAt((y - SURFACE) / PX_PER_M)];
    const awayFromShaft = () => {
      const left = rng() < 0.5;
      return left ? 4 + rng() * (SHAFT_X - 40) : SHAFT_X + SHAFT_W + 36 + rng() * (W - SHAFT_X - SHAFT_W - 40);
    };

    // embedded stones
    for (let i = 0; i < 700; i++) {
      const x = Math.floor(rng() * W);
      const y = Math.floor(SURFACE + 10 + rng() * (groundBottom - SURFACE - 10));
      const L = layerAtY(y);
      const r = 1 + Math.floor(rng() * rng() * 5);
      circle(x, y, r, rgb(L.c[1], 0.72));
      if (r > 1) circle(x, y, r - 1, rgb(L.c[2], 0.95));
      px(x - Math.max(0, r - 2), y - Math.max(0, r - 1), 1, 1, rgb(L.c[2], 1.25));
    }
    // roots under the grass
    for (let i = 0; i < 40; i++) {
      let x = Math.floor(rng() * W), y = SURFACE + 5;
      if (Math.abs(x - W / 2) < SHAFT_W) continue;
      const len = 6 + Math.floor(rng() * 26);
      for (let s = 0; s < len; s++) {
        px(x, y, 1, 1, s < 3 ? "#4a3018" : "#5c3a1e");
        y += 1;
        const r = rng();
        x += r < 0.28 ? -1 : r > 0.72 ? 1 : 0;
      }
    }
    // ore specks, richer the deeper you go
    const ORE = [[224, 123, 57], [201, 212, 224], [255, 210, 63], [111, 240, 255], [200, 110, 240]];
    for (let i = 0; i < 1100; i++) {
      const x = Math.floor(rng() * W);
      const y = Math.floor(SURFACE + 12 + rng() * (groundBottom - SURFACE - 12));
      const depthFrac = (y - SURFACE) / (MAX_METERS * PX_PER_M);
      const oi = clamp(Math.floor(depthFrac * ORE.length * rng() * 1.3), 0, ORE.length - 1);
      const c = ORE[oi];
      px(x, y, 1, 1, rgb(c));
      if (rng() < 0.4) px(x + 1, y, 1, 1, rgb(c, 0.7));
      if (rng() < 0.3) px(x, y + 1, 1, 1, rgb(c, 0.55));
    }
    // fossils in the clay
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(awayFromShaft());
      const y = Math.floor(mToY(1100 + rng() * 1300));
      if (i % 2 === 0) { // ammonite
        circle(x, y, 4, "#d8c8a0"); circle(x, y, 3, "#b8a07a"); circle(x, y, 2, "#d8c8a0"); px(x, y, 1, 1, "#8a7050");
      } else { // bone
        px(x - 4, y, 9, 2, "#e4d8bc");
        px(x - 5, y - 1, 2, 2, "#e4d8bc"); px(x - 5, y + 1, 2, 2, "#e4d8bc");
        px(x + 4, y - 1, 2, 2, "#e4d8bc"); px(x + 4, y + 1, 2, 2, "#e4d8bc");
        px(x - 3, y + 1, 7, 1, "#bfae8c");
      }
    }
    // caves with stalactites
    for (let i = 0; i < 12; i++) {
      const cx = Math.floor(awayFromShaft());
      const cy = Math.floor(mToY(2600 + rng() * 3600));
      const rx = 14 + Math.floor(rng() * 12), ry = 7 + Math.floor(rng() * 5);
      const L = layerAtY(cy);
      ellipse(cx, cy, rx + 1, ry + 1, rgb(L.c[1], 0.6));
      ellipse(cx, cy, rx, ry, "#140e1a");
      ellipse(cx, cy + 2, rx - 3, ry - 3, "#1a1222");
      for (let k = 0; k < 6; k++) {
        const sx = cx - rx + 4 + Math.floor(rng() * (rx * 2 - 8));
        const top = cy - Math.floor(ry * Math.sqrt(1 - ((sx - cx) / rx) ** 2));
        const len = 2 + Math.floor(rng() * 5);
        for (let s = 0; s < len; s++) px(sx - (s < len / 2 ? 1 : 0), top + s, s < len / 2 ? 3 : 1, 1, rgb(L.c[2]));
        const bot = cy + Math.floor(ry * Math.sqrt(1 - ((sx - cx + 3) / rx) ** 2));
        const blen = 1 + Math.floor(rng() * 4);
        for (let s = 0; s < blen; s++) px(sx + 3 - (s < blen / 2 ? 1 : 0), bot - s, s < blen / 2 ? 3 : 1, 1, rgb(L.c[0]));
      }
      caves.push({ cx, cy, rx, ry });
    }
    // crystal clusters in the deep
    const CRY = [[190, 120, 250], [110, 240, 255], [255, 120, 210]];
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(rng() * W);
      if (Math.abs(x - W / 2) < SHAFT_W) continue;
      const y = Math.floor(mToY(3800 + rng() * 3200));
      const col = CRY[Math.floor(rng() * CRY.length)];
      for (let s = 0; s < 3; s++) {
        const sx = x + (s - 1) * 3, h = 4 + Math.floor(rng() * 5);
        for (let k = 0; k < h; k++) {
          const w = k === 0 ? 1 : 2;
          px(sx, y - k, w, 1, rgb(col, k < h / 2 ? 0.75 : 1));
        }
        px(sx, y - h, 1, 1, "#ffffff");
      }
      crystals.push({ x, y: y - 6, col, ph: rng() * 10 });
    }
    // magma pools
    for (let i = 0; i < 10; i++) {
      const cx = Math.floor(awayFromShaft());
      const cy = Math.floor(mToY(6450 + rng() * 650));
      const rx = 10 + Math.floor(rng() * 12), ry = 4 + Math.floor(rng() * 3);
      ellipse(cx, cy, rx + 1, ry + 1, "#3a0e08");
      ellipse(cx, cy, rx, ry, "#e2561e");
      ellipse(cx, cy, rx - 3, ry - 2, "#ff9a2e");
      ellipse(cx - 2, cy - 1, Math.max(2, rx - 8), 1, "#ffd860");
      lavaPools.push({ cx, cy, rx, ry });
    }
    // worms (animated later)
    for (let i = 0; i < 16; i++) {
      worms.push({ x: Math.floor(awayFromShaft()), y: Math.floor(mToY(80 + rng() * 2200)), ph: rng() * 6, len: 5 + Math.floor(rng() * 4), dir: rng() < 0.5 ? 1 : -1 });
    }
    // lanterns along the shaft walls
    for (let m = 400; m < MAX_METERS + 600; m += 800) lanterns.push({ y: Math.floor(mToY(m)), side: (m / 800) % 2 < 1 ? 0 : 1 });

    // ---- surface props ----
    // moon
    circle(270, 18, 9, "#f4ead5"); circle(273, 16, 8, "#2a1f52");
    circle(270, 18, 9, "#f4ead5"); circle(266, 16, 2, "#d8cdb5"); circle(273, 22, 1, "#d8cdb5"); px(268, 22, 1, 1, "#d8cdb5");
    // pine trees
    const pine = (x, h) => {
      px(x - 1, SURFACE - 4, 3, 4, "#4a2e18");
      for (let k = 0; k < h; k++) {
        const w = Math.floor((k / h) * 7) + 1;
        px(x - w, SURFACE - 4 - (h - k), w * 2 + 1, 1, k % 4 === 3 ? "#1f5a34" : "#2a7440");
      }
      px(x - 1, SURFACE - 4 - h, 1, 1, "#4f9a5a");
    };
    pine(16, 22); pine(118, 16); pine(304, 26); pine(292, 14);
    // shack
    const sx = 40;
    for (let k = 0; k < 18; k++) px(sx, SURFACE - 18 + k, 32, 1, k % 3 === 2 ? "#6a3e22" : "#8a5430");
    for (let k = 0; k < 12; k++) px(sx - 3 + k, SURFACE - 19 - k, 38 - k * 2, 1, k % 2 ? "#b04444" : "#9a3838");
    px(sx + 23, SURFACE - 36, 5, 10, "#6e6a78"); px(sx + 22, SURFACE - 37, 7, 2, "#8a8696");
    px(sx + 18, SURFACE - 12, 7, 12, "#2a1a10"); px(sx + 23, SURFACE - 6, 1, 1, "#ffcc33");
    px(sx + 3, SURFACE - 14, 10, 8, "#3a2414");
    // headframe over the shaft
    const hl = SHAFT_X - 3, hr = SHAFT_X + SHAFT_W + 1, top = SURFACE - 34;
    px(hl, top, 2, 34, "#6a4222"); px(hr, top, 2, 34, "#6a4222");
    px(hl - 2, top - 2, hr - hl + 6, 3, "#8a5a2e");
    for (let k = 0; k < 30; k += 1) {
      const fx = Math.round(lerp(hl + 2, hr - 1, k / 30));
      px(fx, top + 3 + k, 1, 1, "#5a361a");
      px(hr - 1 - (fx - hl - 2), top + 3 + k, 1, 1, "#5a361a");
    }
    px(hl - 4, SURFACE - 2, hr - hl + 10, 2, "#4a2e18");
    // mine cart with ore
    const cx0 = 200;
    px(cx0, SURFACE - 9, 18, 7, "#5c5866"); px(cx0 + 1, SURFACE - 8, 16, 1, "#7a7686");
    px(cx0 + 2, SURFACE - 11, 4, 2, "#ffd23f"); px(cx0 + 7, SURFACE - 12, 4, 3, "#e07b39"); px(cx0 + 12, SURFACE - 11, 3, 2, "#6ff0ff");
    circle(cx0 + 4, SURFACE - 2, 2, "#2a2630"); circle(cx0 + 14, SURFACE - 2, 2, "#2a2630");
    px(cx0 - 6, SURFACE - 1, 32, 1, "#7a7686");
    // fence
    for (let x = 236; x < 286; x += 8) px(x, SURFACE - 7, 2, 7, "#6a4a2a");
    px(234, SURFACE - 6, 54, 1, "#8a6a3a"); px(234, SURFACE - 3, 54, 1, "#8a6a3a");
  })();

  // ---- sprites ----
  const MINER = [
    "....yYYYYy..",
    "...yYYYYYYLL",
    "..yYYYYYYYYL",
    "..KKKKKKKKK.",
    "...SSSSSSS..",
    "...SKSSKSs..",
    "...SSSSSSs..",
    "....SsssS...",
    "..BBBBBBBB..",
    ".BBOBBBBOBB.",
    ".SBOOOOOOBS.",
    "..bOOOOOOb..",
    "...OOOOOO...",
    "...OO..OO...",
    "...OO..OO...",
    "..GGG..GGG..",
  ];
  const MINER_BLINK = MINER.slice();
  MINER_BLINK[5] = "...SsSSsSs..";
  const MINER_PAL = {
    Y: "#ffcc33", y: "#c98a12", L: "#fffbe0", S: "#f2b58a", s: "#d48d64", K: "#2a1a10",
    B: "#3a7bd5", b: "#2a5aa0", O: "#7a5236", G: "#2a2028",
  };
  const GEM = ["..LLC..", ".LWCCD.", "LWCCCCD", "CCCCCCD", ".CCCDD.", "..CDD..", "...D..."];
  const CLUMP = ["..CC...", ".LCCCD.", "LCCCCCD", "CCCCDDD", ".DDDDD."];

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return k >= 1
      ? rgb(c.map((v) => v + (255 - v) * (k - 1)))
      : rgb(c, k);
  }

  function drawSprite(rows, pal, x, y) {
    for (let ry = 0; ry < rows.length; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        if (ch === "." || !pal[ch]) continue;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(x + rx, y + ry, 1, 1);
      }
    }
  }
  const gemPal = (hex) => ({ C: hex, L: shade(hex, 1.45), W: "#ffffff", D: shade(hex, 0.62) });

  // ---- scene state ----
  const S = {
    depth: 0, target: 0, camY: 0,
    finds: [], flying: [], particles: [],
    shake: 0, flash: 0, flashColor: "255,255,255",
    swing: 0, tap: 0, t: 0, last: 0,
    blink: 0, nextBlink: 2,
    wheel: 0, layer: 0, shoot: null, nextShoot: 4,
    smokeT: 0,
  };
  const stars = Array.from({ length: 80 }, (_, i) => {
    const x = Math.floor(hash2(i, 1) * W);
    return { x, y: Math.floor(hash2(i, 2) * (SURFACE - farH(x) - 4)), ph: hash2(i, 3) * 6.28, big: hash2(i, 4) > 0.85 };
  });
  const clouds = [0, 1, 2, 3].map((i) => ({ x: i * 90 + 20, y: 10 + i * 9 % 26, w: 18 + (i * 7) % 14, v: 2 + i * 0.7 }));
  const fireflies = Array.from({ length: 9 }, (_, i) => ({ x: 20 + hash2(i, 9) * 280, y: SURFACE - 4 - hash2(i, 8) * 16, ph: hash2(i, 7) * 6 }));
  const grass = [];
  for (let x = 0; x < W; x += 2 + Math.floor(hash2(x, 99) * 3)) {
    if (x > SHAFT_X - 5 && x < SHAFT_X + SHAFT_W + 4) continue;
    grass.push({ x, h: 2 + Math.floor(hash2(x, 98) * 3) });
  }

  function particle(o) {
    S.particles.push(Object.assign({ vx: 0, vy: 0, g: 60, life: 0.6, max: 0.6, size: 1, c: "#fff" }, o));
  }

  function minerPos() {
    const footY = mToY(S.depth);
    return { x: SHAFT_X + Math.floor((SHAFT_W - 12) / 2), y: footY - MINER.length };
  }

  function findSlot(meters, side) {
    const same = S.finds.filter((f) => f.side === side && Math.abs(f.meters - meters) < 80).length;
    const x = side ? SHAFT_X + SHAFT_W + 2 : SHAFT_X - 9;
    return { x, y: mToY(meters) - 9 - same * 9 };
  }

  function addFind(meters, tier, instant) {
    const side = (S.finds.length + S.flying.length) % 2;
    if (instant) {
      const slot = findSlot(meters, side);
      S.finds.push({ meters, tier, side, x: slot.x, y: slot.y, born: -10 });
      return;
    }
    S.flying.push({ meters, tier, side, t: 0, delayDepth: meters });
  }

  function resetScene() {
    S.depth = 0; S.target = 0; S.finds = []; S.flying = []; S.particles = [];
    S.camY = 0; S.layer = 0; S.flash = 0; S.shake = 0;
  }

  function burst(tier) {
    const m = minerPos();
    const cx = m.x + 6, cy = m.y + 4;
    if (tier === 0) {
      for (let i = 0; i < 14; i++) particle({ x: cx, y: cy + 8, vx: (Math.random() - 0.5) * 70, vy: -Math.random() * 60, g: 220, life: 0.7, max: 0.7, size: 2, c: i % 2 ? "#5a5462" : "#7a7484" });
      S.shake = REDUCED ? 0 : 2;
      return;
    }
    const col = TIERS[tier].color;
    const n = tier >= 4 ? 70 : 12 + tier * 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * (tier >= 4 ? 120 : 60);
      const confetti = tier >= 4 && i % 3 === 0;
      particle({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: confetti ? 50 : 120,
        life: 0.8 + Math.random() * 0.9, max: 1.6, size: Math.random() < 0.3 ? 2 : 1,
        c: confetti ? ["#ff7bd5", "#5fc9e8", "#ffcc33", "#9dff7b"][i % 4] : (i % 4 === 0 ? "#ffffff" : col),
      });
    }
    if (tier >= 4) {
      S.flash = tier === 5 ? 0.7 : 0.4;
      S.flashColor = tier === 5 ? "180,250,255" : "255,236,150";
      S.shake = REDUCED ? 0 : (tier === 5 ? 4 : 2);
    }
  }

  function tapPickaxe() {
    S.tap = 1;
    const m = minerPos();
    for (let i = 0; i < 3; i++) particle({ x: m.x + 14, y: m.y + MINER.length, vx: (Math.random() - 0.3) * 40, vy: -20 - Math.random() * 30, g: 160, life: 0.35, max: 0.35, c: "#c8a070" });
  }

  function onLayerChange(i) {
    const el = $("layer-banner");
    el.innerHTML = `<small>ENTERING</small>${LAYERS[i].name} LAYER`;
    el.classList.remove("hidden");
    restartAnim(el, "layer-banner");
  }

  // ---- drawing helpers ----
  function line(x0, y0, x1, y1, col) {
    ctx.fillStyle = col;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= steps; i++) {
      ctx.fillRect(Math.round(lerp(x0, x1, i / steps)), Math.round(lerp(y0, y1, i / steps)), 1, 1);
    }
  }

  function drawPickaxe(hx, hy, deg) {
    const a = (deg * Math.PI) / 180;
    const len = 11;
    const ex = hx + Math.cos(a) * len, ey = hy + Math.sin(a) * len;
    line(hx, hy, ex, ey, "#8a5a2a");
    const px = -Math.sin(a), py = Math.cos(a);
    line(ex - px * 5 + Math.cos(a) * 1, ey - py * 5 + Math.sin(a) * 1, ex + px * 4, ey + py * 4, "#b8b8c8");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(ex - px * 5), Math.round(ey - py * 5), 1, 1);
  }

  // ---- main loop ----
  function frame(ts) {
    const dt = Math.min(0.05, (ts - (S.last || ts)) / 1000);
    S.last = ts;
    S.t += dt;
    const t = S.t;

    // dig toward target
    const digging = S.depth < S.target - 0.5;
    if (digging) {
      const rate = clamp((S.target - S.depth) * 1.4, 380, 2600);
      S.depth = Math.min(S.target, S.depth + rate * dt);
      S.wheel += dt * 8;
    } else {
      S.depth = S.target;
    }
    const li = layerIndexAt(S.depth);
    if (li !== S.layer) { if (li > S.layer) onLayerChange(li); S.layer = li; }

    // camera
    const footY = mToY(S.depth);
    const want = clamp(footY - H * 0.58, 0, WORLD_H - H);
    S.camY = Math.abs(want - S.camY) < 0.5 ? want : lerp(S.camY, want, Math.min(1, dt * 7));
    const cam = Math.round(S.camY);
    const sy = (wy) => Math.round(wy) - cam;
    const inView = (wy, pad = 20) => wy - cam > -pad && wy - cam < H + pad;

    // pickaxe animation
    let angle;
    const prevSwing = S.swing;
    if (digging) {
      S.swing += dt * 3.2;
      const p = S.swing % 1;
      angle = p < 0.62 ? lerp(25, -115, p / 0.62) : lerp(-115, 25, (p - 0.62) / 0.38);
      if (Math.floor(S.swing) !== Math.floor(prevSwing)) {
        const m = minerPos();
        for (let i = 0; i < 6; i++) {
          const L = LAYERS[li];
          particle({ x: m.x + 14 + Math.random() * 4, y: m.y + MINER.length - 1, vx: (Math.random() - 0.4) * 70, vy: -30 - Math.random() * 50, g: 200, life: 0.6, max: 0.6, size: Math.random() < 0.4 ? 2 : 1, c: rgb(L.c[Math.floor(Math.random() * 3)], 1.15) });
        }
        if (!REDUCED) S.shake = Math.max(S.shake, 1);
        SFX.strike();
      }
    } else if (S.tap > 0) {
      S.tap = Math.max(0, S.tap - dt * 7);
      angle = lerp(25, -80, S.tap);
    } else {
      angle = -70 + Math.sin(t * 2) * 3;
    }

    // shake offset
    let ox = 0, oy = 0;
    if (S.shake > 0) {
      ox = Math.round((Math.random() - 0.5) * 2 * S.shake);
      oy = Math.round((Math.random() - 0.5) * 2 * S.shake);
      S.shake = Math.max(0, S.shake - dt * 10);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0d0910";
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, ox, oy);
    ctx.drawImage(terrain, 0, cam, W, H, 0, 0, W, H);

    // ---- sky & surface life ----
    if (cam < SURFACE + 10) {
      stars.forEach((s) => {
        const tw = Math.sin(t * 2.2 + s.ph);
        if (tw < -0.4) return;
        ctx.fillStyle = tw > 0.7 ? "#ffffff" : "#bfb4e0";
        const y = sy(s.y);
        ctx.fillRect(s.x, y, 1, 1);
        if (s.big && tw > 0.8) {
          ctx.fillStyle = "rgba(255,255,255,.55)";
          ctx.fillRect(s.x - 1, y, 1, 1); ctx.fillRect(s.x + 1, y, 1, 1);
          ctx.fillRect(s.x, y - 1, 1, 1); ctx.fillRect(s.x, y + 1, 1, 1);
        }
      });
      // shooting star
      S.nextShoot -= dt;
      if (S.nextShoot <= 0 && !S.shoot) {
        S.shoot = { x: 40 + Math.random() * 200, y: 4 + Math.random() * 14, life: 0.8 };
        S.nextShoot = 5 + Math.random() * 8;
      }
      if (S.shoot) {
        const sh = S.shoot;
        sh.x += 180 * dt; sh.y += 60 * dt; sh.life -= dt;
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = `rgba(255,255,230,${(1 - k / 8) * Math.min(1, sh.life * 2)})`;
          ctx.fillRect(Math.round(sh.x - k * 3), sy(sh.y - k), 2, 1);
        }
        if (sh.life <= 0) S.shoot = null;
      }
      // clouds
      clouds.forEach((c) => {
        c.x += c.v * dt;
        if (c.x > W + 30) c.x = -c.w - 10;
        const x = Math.round(c.x), y = sy(c.y);
        ctx.fillStyle = "#4a3678";
        ctx.fillRect(x, y + 2, c.w, 3);
        ctx.fillRect(x + 3, y, c.w - 8, 2);
        ctx.fillRect(x + 6, y - 2, Math.floor(c.w / 3), 2);
        ctx.fillStyle = "#6a50a0";
        ctx.fillRect(x + 4, y, c.w - 10, 1);
        ctx.fillRect(x + 7, y - 2, Math.floor(c.w / 3) - 2, 1);
      });
      // chimney smoke
      S.smokeT -= dt;
      if (S.smokeT <= 0) {
        S.smokeT = 0.35;
        particle({ x: 65 + Math.random() * 2, y: SURFACE - 38, vx: 4 + Math.random() * 3, vy: -8, g: -2, life: 2.6, max: 2.6, size: 2, c: "smoke" });
      }
      // shack window glow
      const flick = 0.75 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05;
      ctx.fillStyle = `rgba(255,200,90,${flick})`;
      ctx.fillRect(44, sy(SURFACE - 13), 8, 6);
      ctx.fillStyle = "#3a2414";
      ctx.fillRect(47, sy(SURFACE - 13), 1, 6);
      ctx.fillRect(44, sy(SURFACE - 10), 8, 1);
      // headframe wheel
      const wx = SHAFT_X + SHAFT_W / 2, wy = sy(SURFACE - 40);
      ctx.fillStyle = "#3a3640";
      for (let a = 0; a < 16; a++) {
        const an = (a / 16) * Math.PI * 2;
        ctx.fillRect(Math.round(wx + Math.cos(an) * 6), Math.round(wy + Math.sin(an) * 6), 1, 1);
      }
      for (let k = 0; k < 4; k++) {
        const an = S.wheel + (k * Math.PI) / 4;
        line(wx - Math.cos(an) * 5, wy - Math.sin(an) * 5, wx + Math.cos(an) * 5, wy + Math.sin(an) * 5, "#8a8696");
      }
      ctx.fillStyle = "#ffcc33"; ctx.fillRect(Math.round(wx), wy, 1, 1);
      // grass sway
      grass.forEach((g) => {
        const sw = Math.round(Math.sin(t * 2.4 + g.x * 0.35) * 1.2);
        ctx.fillStyle = "#4aa84e";
        ctx.fillRect(g.x, sy(SURFACE) - g.h + 1, 1, g.h - 1);
        ctx.fillStyle = "#7ddc72";
        ctx.fillRect(g.x + sw, sy(SURFACE) - g.h, 1, 1);
      });
      // fireflies
      fireflies.forEach((f) => {
        const on = Math.sin(t * 3 + f.ph * 3) > 0.2;
        if (!on) return;
        const x = Math.round(f.x + Math.sin(t * 0.7 + f.ph) * 12);
        const y = sy(f.y + Math.sin(t * 1.3 + f.ph) * 4);
        ctx.fillStyle = "rgba(220,255,120,.35)";
        ctx.fillRect(x - 1, y - 1, 3, 3);
        ctx.fillStyle = "#eaff8a";
        ctx.fillRect(x, y, 1, 1);
      });
    }

    // ---- underground critters ----
    worms.forEach((w) => {
      if (!inView(w.y)) return;
      const crawl = Math.sin(t * 0.8 + w.ph) * 4;
      for (let k = 0; k < w.len; k++) {
        const x = Math.round(w.x + (k * w.dir) + crawl);
        const y = sy(w.y + Math.round(Math.sin(t * 5 + k * 0.9 + w.ph)));
        ctx.fillStyle = k === 0 ? "#ff9ab0" : "#e27890";
        ctx.fillRect(x, y, 1, 1);
      }
    });
    caves.forEach((c, i) => {
      if (!inView(c.cy, 30)) return;
      // a bat flaps around in every cave
      const bx = Math.round(c.cx + Math.sin(t * 1.3 + i) * (c.rx - 6));
      const by = sy(c.cy - 2 + Math.sin(t * 2.6 + i * 2) * (c.ry - 5));
      const up = Math.floor(t * 10 + i) % 2 === 0;
      ctx.fillStyle = "#0a0610";
      ctx.fillRect(bx - 1, by, 3, 2);
      ctx.fillRect(bx - 3, by + (up ? -1 : 1), 2, 1);
      ctx.fillRect(bx + 2, by + (up ? -1 : 1), 2, 1);
      ctx.fillStyle = "#ff4060";
      ctx.fillRect(bx - 1, by, 1, 1); ctx.fillRect(bx + 1, by, 1, 1);
      // dripping water
      const dp = (t * 0.7 + i * 0.37) % 1;
      const dx = c.cx - 4 + (i % 3) * 4;
      const dy = sy(c.cy - c.ry + 3 + dp * (c.ry * 2 - 5));
      ctx.fillStyle = "#7ac8ff";
      ctx.fillRect(dx, dy, 1, dp < 0.15 ? 1 : 2);
    });

    // ---- shaft ----
    const shaftBottom = footY + 1;
    if (S.depth > 2) {
      const top = Math.max(sy(SURFACE), -2);
      const bot = sy(shaftBottom);
      if (bot > top) {
        ctx.fillStyle = "#1a1220";
        ctx.fillRect(SHAFT_X, top, SHAFT_W, bot - top);
        ctx.fillStyle = "#120c18";
        ctx.fillRect(SHAFT_X, top, 3, bot - top);
        ctx.fillStyle = "#2c2030";
        ctx.fillRect(SHAFT_X + SHAFT_W - 2, top, 2, bot - top);
        // ladder
        ctx.fillStyle = "#5a3a1a";
        ctx.fillRect(SHAFT_X + 3, top, 1, bot - top);
        ctx.fillRect(SHAFT_X + 8, top, 1, bot - top);
        for (let y = SURFACE + 2; y < shaftBottom - 2; y += 4) {
          if (inView(y, 2)) ctx.fillRect(SHAFT_X + 3, sy(y), 6, 1);
        }
        // support timbers
        for (let y = SURFACE + 24; y < shaftBottom - 4; y += 30) {
          if (!inView(y, 4)) continue;
          ctx.fillStyle = "#6a4422";
          ctx.fillRect(SHAFT_X, sy(y), SHAFT_W, 2);
          ctx.fillStyle = "#8a5c30";
          ctx.fillRect(SHAFT_X, sy(y), SHAFT_W, 1);
        }
      }
    }
    // rope from the wheel to the miner
    {
      const m = minerPos();
      const rx = SHAFT_X + SHAFT_W / 2 + 6;
      const ry0 = Math.max(sy(SURFACE - 40), -1);
      const ry1 = sy(m.y + 8);
      if (ry1 > ry0) {
        ctx.fillStyle = "#c8b48a";
        ctx.fillRect(Math.round(rx), ry0, 1, ry1 - ry0);
      }
    }
    // lanterns
    lanterns.forEach((l) => {
      if (l.y > shaftBottom - 6 || !inView(l.y)) return;
      const x = l.side ? SHAFT_X + SHAFT_W - 4 : SHAFT_X + 1;
      ctx.fillStyle = "#3a3640"; ctx.fillRect(x, sy(l.y) - 3, 3, 1);
      ctx.fillStyle = "#ffcc33"; ctx.fillRect(x, sy(l.y) - 2, 3, 3);
      ctx.fillStyle = "#fff6c0"; ctx.fillRect(x + 1, sy(l.y) - 1, 1, 1);
    });

    // ---- finds in the walls ----
    S.finds.forEach((f) => {
      if (!inView(f.y)) return;
      const y = sy(f.y);
      const col = f.tier === 0 ? "#4e4856" : TIERS[f.tier].color;
      const age = t - f.born;
      const pop = age < 0.25 ? -Math.round(Math.sin((age / 0.25) * Math.PI) * 2) : 0;
      if (f.tier <= 1) drawSprite(CLUMP, gemPal(col), f.x, y + 2 + pop);
      else {
        const bob = Math.round(Math.sin(t * 2 + f.meters) * 0.6);
        drawSprite(GEM, gemPal(col), f.x, y + pop + bob);
        const sp = (t * 0.6 + f.meters * 0.013) % 2;
        if (sp < 0.25) {
          const k = sp < 0.12 ? 1 : 2;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(f.x + 5, y - k + bob, 1, k * 2 + 1);
          ctx.fillRect(f.x + 5 - k, y + bob, k * 2 + 1, 1);
        }
      }
    });
    // flying finds (gem pops out of the rock and lands in the wall)
    S.flying = S.flying.filter((f) => {
      if (S.depth < f.delayDepth - 1) return true; // wait until the miner reaches it
      f.t += dt / 0.55;
      const m = minerPos();
      if (!f.slot) f.slot = findSlot(f.meters, f.side);
      const fx = lerp(m.x + 3, f.slot.x, Math.min(1, f.t));
      const fy = lerp(m.y + 4, f.slot.y, Math.min(1, f.t)) - Math.sin(Math.min(1, f.t) * Math.PI) * 18;
      const col = f.tier === 0 ? "#4e4856" : TIERS[f.tier].color;
      drawSprite(f.tier <= 1 ? CLUMP : GEM, gemPal(col), Math.round(fx), sy(fy));
      if (f.tier >= 2 && Math.random() < 0.6) particle({ x: fx + 3, y: fy + 3, vx: 0, vy: 6, g: 0, life: 0.3, max: 0.3, c: col });
      if (f.t >= 1) {
        S.finds.push({ meters: f.meters, tier: f.tier, side: f.side, x: f.slot.x, y: f.slot.y, born: t });
        for (let i = 0; i < 8; i++) particle({ x: f.slot.x + 3, y: f.slot.y + 3, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50, g: 40, life: 0.4, max: 0.4, c: i % 2 ? "#ffffff" : col });
        return false;
      }
      return true;
    });

    // ---- miner ----
    {
      const m = minerPos();
      S.nextBlink -= dt;
      if (S.nextBlink <= 0) { S.blink = 0.12; S.nextBlink = 2 + Math.random() * 3; }
      S.blink = Math.max(0, S.blink - dt);
      const breathe = !digging && Math.sin(t * 2.2) > 0.6 ? 1 : 0;
      const bob = digging ? (Math.floor(S.swing * 2) % 2) : 0;
      const my = sy(m.y) + bob;
      // body (legs stay planted while breathing)
      drawSprite((S.blink > 0 ? MINER_BLINK : MINER).slice(0, 13), MINER_PAL, m.x, my - breathe);
      drawSprite(MINER.slice(13), MINER_PAL, m.x, my + 13);
      // lamp flicker
      ctx.fillStyle = Math.sin(t * 14) > -0.3 ? "#ffffff" : "#fff2a0";
      ctx.fillRect(m.x + 10, my + 1 - breathe, 2, 1);
      drawPickaxe(m.x + 11, my + 10 - breathe, angle);
    }

    // ---- particles ----
    S.particles = S.particles.filter((p) => {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.c === "smoke") {
        const a = Math.max(0, p.life / p.max) * 0.45;
        ctx.fillStyle = `rgba(190,180,210,${a})`;
        const s = Math.round(lerp(4, 1, p.life / p.max));
        ctx.fillRect(Math.round(p.x), sy(p.y), s, s);
      } else {
        ctx.fillStyle = p.c;
        ctx.globalAlpha = clamp(p.life / (p.max * 0.4), 0, 1);
        ctx.fillRect(Math.round(p.x), sy(p.y), p.size, p.size);
        ctx.globalAlpha = 1;
      }
      return p.life > 0;
    });

    // ---- darkness + lights ----
    const dark = Math.min(0.8, (S.depth / MAX_METERS) * 0.95);
    if (dark > 0.02) {
      const m = minerPos();
      const lx = m.x + 11, ly = sy(m.y) + 1;
      const flick = Math.sin(t * 13) * 2;
      const g = ctx.createRadialGradient(lx, ly, 8, lx, ly, 120 + flick);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.5, `rgba(6,2,12,${dark * 0.55})`);
      g.addColorStop(1, `rgba(6,2,12,${dark})`);
      ctx.fillStyle = g;
      ctx.fillRect(-4, -4, W + 8, H + 8);

      ctx.globalCompositeOperation = "lighter";
      const glow = (x, y, r, col, a) => {
        const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
        gg.addColorStop(0, `rgba(${col},${a})`);
        gg.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gg;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      lanterns.forEach((l) => {
        if (l.y > shaftBottom - 6 || !inView(l.y, 30)) return;
        const x = l.side ? SHAFT_X + SHAFT_W - 3 : SHAFT_X + 2;
        glow(x, sy(l.y), 16 + Math.sin(t * 7 + l.y) * 1.5, "255,190,80", 0.35);
      });
      lavaPools.forEach((p, i) => {
        if (!inView(p.cy, 40)) return;
        glow(p.cx, sy(p.cy), p.rx + 14 + Math.sin(t * 2 + i) * 3, "255,110,30", 0.4);
      });
      crystals.forEach((c) => {
        if (!inView(c.y, 20)) return;
        glow(c.x, sy(c.y), 9, c.col.join(","), 0.25 + Math.max(0, Math.sin(t * 2 + c.ph)) * 0.3);
      });
      S.finds.forEach((f) => {
        if (f.tier < 3 || !inView(f.y)) return;
        const c = f.tier === 5 ? "111,240,255" : f.tier === 4 ? "255,210,63" : "200,212,224";
        glow(f.x + 3, sy(f.y) + 3, 10, c, 0.3 + Math.sin(t * 3 + f.meters) * 0.1);
      });
      ctx.globalCompositeOperation = "source-over";
    }

    // lava bubbles (always on top of the glow)
    lavaPools.forEach((p, i) => {
      if (!inView(p.cy, 20)) return;
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.8 + k * 0.33 + i * 0.17) % 1;
        const bx = p.cx - p.rx + 4 + ((k * 7 + i * 5) % Math.max(1, p.rx * 2 - 8));
        const by = sy(p.cy - ph * 6);
        ctx.fillStyle = ph > 0.85 ? "#fff0a0" : "#ffb040";
        ctx.fillRect(bx, by, ph > 0.85 ? 2 : 1, 1);
      }
    });
    crystals.forEach((c) => {
      if (!inView(c.y, 10)) return;
      const s = (t * 0.5 + c.ph) % 3;
      if (s < 0.2) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(c.x, sy(c.y) - 2, 1, 5);
        ctx.fillRect(c.x - 2, sy(c.y), 5, 1);
      }
    });

    // flash
    if (S.flash > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(${S.flashColor},${S.flash})`;
      ctx.fillRect(0, 0, W, H);
      S.flash = Math.max(0, S.flash - dt * 1.8);
    }

    const shown = `${Math.round(S.depth)}m`;
    if (hudDepth.textContent !== shown) hudDepth.textContent = shown;
    requestAnimationFrame(frame);
  }
  const hudDepth = $("hud-depth");

  // ==================================================================
  // Game state
  // ==================================================================
  const today = localDayNumber();
  const todayKey = dateKey();
  const digNumber = today + 1;

  let mode = "daily";
  let game = null;
  let timerHandle = null;
  let typeHandle = null;

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

  // ==================================================================
  // UI helpers
  // ==================================================================
  const SCREENS = ["title", "question", "reveal", "results"];
  function show(name) {
    SCREENS.forEach((s) => {
      const el = $(`screen-${s}`);
      const on = s === name;
      el.classList.toggle("hidden", !on);
      if (on) restartAnim(el, "enter");
    });
  }

  function typeText(el, text) {
    clearInterval(typeHandle);
    if (REDUCED) { el.textContent = text; return; }
    el.textContent = "";
    el.classList.add("typing");
    let i = 0;
    typeHandle = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(typeHandle);
        setTimeout(() => el.classList.remove("typing"), 600);
      }
    }, 28);
  }

  function countUp(el, to, ms, fmt = (v) => String(v)) {
    if (REDUCED || to === 0) { el.textContent = fmt(to); return; }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function floatText(text, color) {
    const el = document.createElement("div");
    el.className = "float-pts";
    el.textContent = text;
    el.style.color = color;
    $("float-layer").append(el);
    setTimeout(() => el.remove(), 1500);
  }

  function updateHudRound() {
    if (!game || game.round >= ROUNDS) { $("hud-round").textContent = mode === "practice" ? "PRACTICE" : `DIG #${digNumber}`; return; }
    $("hud-round").textContent = `${game.round + 1}/${ROUNDS}`;
  }

  // ==================================================================
  // Rounds
  // ==================================================================
  function startRound() {
    const q = QUESTIONS[game.qIdx[game.round]];
    if (!game.startedAt) game.startedAt = Date.now();
    saveDaily();
    show("question");
    updateHudRound();
    $("q-round").textContent = `PROMPT ${game.round + 1}/${ROUNDS}`;
    typeText($("q-text"), q.prompt);
    const input = $("answer");
    input.value = "";
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
      $("timer").classList.toggle("warn", left <= 5 && left > 0);
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
    clearInterval(typeHandle);
    $("timer").classList.remove("warn");
    const q = QUESTIONS[game.qIdx[game.round]];
    const res = judge(q, raw);
    const entry = { raw: (raw || "").trim(), tier: res.tier, display: res.display, timedOut: timedOut && !(raw || "").trim() };
    game.results.push(entry);
    game.startedAt = null;
    const meters = totalPoints(game) * METERS_PER_POINT;
    addFind(meters, res.tier, false);
    S.target = meters;
    burst(res.tier);
    if (res.tier === 5) restartAnim($("scene-wrap"), "quake");
    floatText(res.tier ? `+${TIERS[res.tier].pts}` : "+0", TIERS[res.tier].color);
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
    $("reveal-answer").textContent = entry.raw ? `"${entry.display}"` : "(no answer)";
    const pointsEl = $("reveal-points");
    if (entry.tier) {
      countUp(pointsEl, t.pts, 600, (v) => `${t.label.toUpperCase()} · +${v} PTS · +${v * METERS_PER_POINT}m`);
    } else {
      pointsEl.textContent = entry.raw ? "Not in our vein · +0" : "+0";
    }

    const rng = mulberry32(game.qIdx[game.round] * 31 + today);
    const ex = [];
    for (const tier of [5, 4, 3, 1]) {
      const pool = shuffle(q.byTier[tier].filter((d) => d !== entry.display), rng);
      pool.slice(0, tier === 5 ? 2 : 1).forEach((d) => ex.push({ d, tier }));
    }
    const ul = $("reveal-examples");
    ul.innerHTML = "";
    ex.forEach(({ d, tier }, i) => {
      const li = document.createElement("li");
      li.style.animationDelay = `${0.45 + i * 0.09}s`;
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
    const meters = totalPoints(game) * METERS_PER_POINT;
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
    S.target = meters;
    $("res-title").textContent = mode === "daily" ? `DIG #${digNumber} DONE` : "PRACTICE DONE";
    countUp($("res-depth"), meters, 1200);
    $("res-rank").textContent = rankFor(meters);
    const ol = $("res-list");
    ol.innerHTML = "";
    game.results.forEach((r, i) => {
      const li = document.createElement("li");
      li.style.animationDelay = `${0.2 + i * 0.1}s`;
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
    $("share-fallback").classList.add("hidden");
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
    restartAnim(t, "toast");
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
    if (dateKey() !== todayKey) location.reload();
  }
  setInterval(updateCountdown, 1000);

  // ==================================================================
  // Stats
  // ==================================================================
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

  // ==================================================================
  // Modals
  // ==================================================================
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
      <p>Any correct answer counts, but obvious answers are just dirt. Dig up an answer few people would think of to strike gold.</p>
      <table class="tier-table">${rows}
        <tr><td><span class="chip tier-0">BEDROCK</span></td><td>Wrong / no answer</td><td>+0</td></tr></table>
      <p>Every point digs you ${METERS_PER_POINT}m deeper. A perfect dig reaches <b>${MAX_METERS}m</b>, past the stone, slate and obsidian all the way to the magma.</p>
      <p>Small typos are forgiven. Everyone gets the same prompts each day, and a new set unlocks at midnight.</p>
      <p>Want more? The <b>Practice Mine</b> serves random prompts any time and doesn't count toward your stats.</p>`;
  }

  function statsHtml() {
    const st = getStats();
    const avg = st.played ? Math.round(st.total / st.played) : 0;
    const max = Math.max(1, ...st.tiers);
    const bars = TIERS.map((t, i) => ({ t, i })).reverse().map(({ t, i }, k) =>
      `<div class="bar-row"><span class="lbl">${t.name}</span><span class="bar" style="width:${(st.tiers[i] / max) * 70}%;background:${t.color};animation-delay:${k * 0.07}s"></span><span>${st.tiers[i]}</span></div>`).join("");
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

  // ==================================================================
  // Boot / wiring
  // ==================================================================
  function showTitle() {
    mode = "daily";
    clearInterval(timerHandle);
    show("title");
    $("title-dig").textContent = `DIG #${digNumber} · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    const saved = loadDaily();
    const btn = $("btn-play");
    resetScene();
    if (saved) {
      let pts = 0;
      saved.results.forEach((r) => {
        pts += TIERS[r.tier].pts;
        addFind(pts * METERS_PER_POINT, r.tier, true);
      });
      S.target = pts * METERS_PER_POINT;
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
    game = null;
    updateHudRound();
  }

  $("btn-play").addEventListener("click", () => {
    SFX.click();
    mode = "daily";
    game = loadDaily() || newGame(dailyQuestionIndexes(today));
    if (game.results.length >= ROUNDS) { showResults(); return; }
    game.round = game.results.length;
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
      restartAnim($("answer-form"), "shake");
      return;
    }
    submitAnswer(v);
  });

  $("answer").addEventListener("input", () => {
    restartAnim($("answer"), "key");
    tapPickaxe();
    SFX.key();
  });

  $("btn-skip").addEventListener("click", () => submitAnswer(""));

  $("btn-next").addEventListener("click", () => {
    SFX.click();
    if (game.round >= ROUNDS) finish();
    else startRound();
  });

  $("btn-share").addEventListener("click", () => {
    const text = shareText();
    const fallback = () => {
      const ta = $("share-fallback");
      ta.value = text;
      ta.classList.remove("hidden");
      ta.focus();
      ta.select();
      toast("SELECT & COPY");
    };
    try {
      navigator.clipboard.writeText(text).then(() => toast("COPIED!"), fallback);
    } catch { fallback(); }
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

  // Logo returns to the title screen (only when not mid-question in a daily dig).
  $("logo").addEventListener("click", () => {
    const midDaily = mode === "daily" && game && !$("screen-question").classList.contains("hidden");
    if (!midDaily) showTitle();
  });

  showTitle();
  requestAnimationFrame(frame);
  if (!store.get("deepdig-seen-help", false)) {
    store.set("deepdig-seen-help", true);
    openModal(helpHtml());
  }

  window.DeepDig = { QUESTIONS, judge, dailyQuestionIndexes, normalize };
})();
