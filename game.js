// Reckless Driver — a pixelated top-down traffic weaving game.
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const W = 128, H = 192;
  const ROAD_X = 20, LANE_W = 22, LANES = 4, ROAD_W = LANE_W * LANES;
  const ROAD_R = ROAD_X + ROAD_W;
  const CAR_W = 10, CAR_H = 16;
  const PLAYER_Y = 148;
  const CRUISE = 100, MIN_SPEED = 40, MAX_SPEED = 240, RECKLESS_SPEED = 200;
  const NEAR_MISS_GAP = 4;
  const TILE_H = 240;
  const MPH = 0.6; // px/s -> displayed mph
  const POLICE_MPH = 100, POLICE_SPEED = POLICE_MPH / MPH;
  const MAX_COPS = 4, MAX_WANTED = 5, WANTED_STEP = 6;
  const COP_ESCAPE_Y = H + 140;

  const laneX = (lane, w = CAR_W) => ROAD_X + LANE_W * lane + (LANE_W - w) / 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function pickWeighted(list) {
    let r = Math.random() * list.reduce((s, e) => s + e.w, 0);
    for (const e of list) {
      r -= e.w;
      if (r < 0) return e;
    }
    return list[list.length - 1];
  }

  // The player always starts out white; other paints unlock with a high score.
  const PAINTS = [
    { name: 'WHITE', color: '#f2f2f2', need: 0 },
    { name: 'RED', color: '#d82828', need: 1500 },
    { name: 'BLUE', color: '#2f6fe0', need: 4000 },
    { name: 'YELLOW', color: '#f0c419', need: 8000 },
    { name: 'GREEN', color: '#2fae4f', need: 15000 },
    { name: 'BLACK', color: '#34343f', need: 25000 },
    { name: 'HOT PINK', color: '#f060b0', need: 40000 },
  ];
  const TRAFFIC_COLORS = [
    { color: '#ececec', w: 25 }, // white
    { color: '#8c9098', w: 25 }, // grey
    { color: '#222228', w: 25 }, // black
    { color: '#1f2f6b', w: 15 }, // dark blue
    { color: '#7a1a1a', w: 10 }, // dark red
  ];
  const TRAILER_COLORS = ['#c8ccd4', '#a8b0bc', '#d8c8a0', '#b8c8b0'];

  // ---------------------------------------------------------------------------
  // Canvas
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById('game');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function resize() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    const scale = s >= 1 ? Math.floor(s) : s;
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';
  }
  addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------------------
  // Storage (best score and paint survive reloads when the browser allows it)
  // ---------------------------------------------------------------------------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('recklessDriver.' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('recklessDriver.' + key, JSON.stringify(value));
      } catch (e) { /* storage unavailable */ }
    },
  };

  // ---------------------------------------------------------------------------
  // Pixel font (3x5)
  // ---------------------------------------------------------------------------
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001110',
    '!': '010010010000010', '.': '000000000000010', ':': '000010000010000', '-': '000000111000000',
    '+': '000010111010000', '/': '001001010100100', "'": '010010000000000', '?': '110001010000010',
    '<': '001010100010001', '>': '100010001010100', '=': '000111000111000',
  };

  const textWidth = (str, scale = 1) => (str.length ? str.length * 4 * scale - scale : 0);

  function drawTextRaw(str, x, y, color, scale) {
    ctx.fillStyle = color;
    for (let i = 0; i < str.length; i++) {
      const glyph = FONT[str[i]];
      if (!glyph) continue;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (glyph[r * 3 + c] === '1') {
            ctx.fillRect(x + i * 4 * scale + c * scale, y + r * scale, scale, scale);
          }
        }
      }
    }
  }

  function drawText(str, x, y, color = '#fff', scale = 1, align = 'left', shadow = '#000') {
    str = String(str).toUpperCase();
    const w = textWidth(str, scale);
    if (align === 'center') x -= Math.floor(w / 2);
    else if (align === 'right') x -= w;
    x = Math.round(x);
    y = Math.round(y);
    if (shadow) drawTextRaw(str, x + 1, y + 1, shadow, scale);
    drawTextRaw(str, x, y, color, scale);
  }

  // ---------------------------------------------------------------------------
  // Sprites
  // ---------------------------------------------------------------------------
  // B body, S body shade, H highlight, w window, g glass glint, k tire,
  // y headlight, r taillight, T trailer, U trailer shade.
  const CAR = [
    '..SBBBBS..',
    '.yBBBBBBy.',
    'kSBBBBBBSk',
    'kSBBBBBBSk',
    '.SwwwwwwS.',
    '.SwgwwwwS.',
    '.SBBHHBBS.',
    '.SBBHHBBS.',
    '.SBBHHBBS.',
    '.SBBHHBBS.',
    '.SwwwwwwS.',
    'kSBBBBBBSk',
    'kSBBBBBBSk',
    '.SBBBBBBS.',
    '.rSSSSSSr.',
    '..SSSSSS..',
  ];

  const TRUCK = [
    '..SBBBBBBS..',
    '.yBBBBBBBBy.',
    'kSBBBBBBBBSk',
    'kSwwwwwwwwSk',
    '.SwgwwwwwwS.',
    '.SBBBBBBBBS.',
    '..kkkkkkkk..',
    '.UTTTTTTTTU.',
    '.UTTTTTTTTU.',
    '.UTTTTTTTTU.',
    '.UTTTTTTTTU.',
    '.UTTTTTTTTU.',
    '.UUUUUUUUUU.',
    '.UTTTTTTTTU.',
    '.UTTTTTTTTU.',
    '.UTTTTTTTTU.',
    '.UTTTTTTTTU.',
    '.UTTTTTTTTU.',
    '.UUUUUUUUUU.',
    '.UTTTTTTTTU.',
    'kUTTTTTTTTUk',
    'kUTTTTTTTTUk',
    '.UTTTTTTTTU.',
    'kUTTTTTTTTUk',
    'kUTTTTTTTTUk',
    '.rUUUUUUUUr.',
  ];

  // Black-and-white cruiser; the light bar (row 6) is drawn flashing on top.
  const POLICE = [
    '..SKKKKS..',
    '.yKKKKKKy.',
    'kSKKKKKKSk',
    'kSKKKKKKSk',
    '.SwwwwwwS.',
    '.SwgwwwwS.',
    '.WWLLLLWW.',
    '.WWWWWWWW.',
    '.WWWWWWWW.',
    '.WWWWWWWW.',
    '.SwwwwwwS.',
    'kSKKKKKKSk',
    'kSKKKKKKSk',
    '.SKKKKKKS.',
    '.rSSSSSSr.',
    '..SSSSSS..',
  ];
  const POLICE_PAL = {
    K: '#1a1a1f', S: '#4a4a55', W: '#f0f0f0', L: '#333333',
    w: '#1c2541', g: '#7f9fdf', k: '#121212', y: '#fff3a0', r: '#d01818',
  };

  // Construction-zone roadside scenery.
  const DECOR_PAL = {
    o: '#ff7a1a', O: '#ffb060', w: '#ffffff', k: '#1e1e1e', q: '#5a5a5a',
    c: '#a9a9a2', C: '#c9c9c2', Y: '#f2b705', S: '#b07f08', b: '#1c2541',
    t: '#5a4a3a', d: '#8a7a62', D: '#a89880', l: '#6e5c40',
  };
  const DECOR_MAPS = {
    cone: ['.ooo.', 'owwwo', 'owOwo', 'owwwo', '.ooo.'],
    barrel: ['.www.', 'wooow', 'wokow', 'wooow', '.www.'],
    barrier: ['owwoowwoow', 'owwoowwoow', 'k........k'],
    jersey: ['.cc.', 'cCCc', 'cCCc', 'cCCc', 'cCCc', 'cCCc', 'cCCc', 'cCCc', 'cCCc', 'cCCc', 'cCCc', '.cc.'],
    sign: ['...o...', '..ooo..', '.ookoo.', 'ookkkoo', '.ookoo.', '..ooo..', '...o...', '...t...', '...t...'],
    excavator: [
      '....kkkk....',
      '....kYYk....',
      '.....YY.....',
      '.....YY.....',
      '.....YY.....',
      'kkk.YYYY.kkk',
      'kqkYYYYYYkqk',
      'kkkYbbYYYkkk',
      'kqkYbbYYYkqk',
      'kkkYYYYYYkkk',
      'kqkYYYYYYkqk',
      'kkkYYYYYYkkk',
      'kqkSSSSSSkqk',
      'kkk.SSSS.kkk',
    ],
    bulldozer: [
      'SSSSSSSSSSS',
      'SYYYYYYYYYS',
      '...k...k...',
      'kkkYYYYYkkk',
      'kqkYYYYYkqk',
      'kkkYbbbYkkk',
      'kqkYbbbYkqk',
      'kkkYYYYYkkk',
      'kqkYYYYYkqk',
      'kkkYYYYYkkk',
      'kqkSSSSSkqk',
      'kkk.qqq.kkk',
    ],
    dumptruck: [
      '.SYYYYYYS.',
      '.YbbbbbbY.',
      'kYbbbbbbYk',
      'kYYYYYYYYk',
      '.kkkkkkkk.',
      '.YSSSSSSY.',
      '.YllllllY.',
      '.YlllDllY.',
      '.YlDllllY.',
      '.YllllllY.',
      '.YllDlllY.',
      '.YllllllY.',
      'kYllllllYk',
      'kYlllDllYk',
      '.YllllllY.',
      'kYSSSSSSYk',
      'kYSSSSSSYk',
      '.SSSSSSSS.',
    ],
    gravel: ['..ddddd..', '.dDDDDDd.', 'dDDDDDDDd', 'dDDDDDDDd', '.dDDDDDd.', '..ddddd..'],
  };
  const DECOR_WEIGHTS = [
    { kind: 'cone', w: 30 }, { kind: 'barrel', w: 12 }, { kind: 'barrier', w: 12 },
    { kind: 'jersey', w: 10 }, { kind: 'sign', w: 8 }, { kind: 'excavator', w: 9 },
    { kind: 'bulldozer', w: 8 }, { kind: 'dumptruck', w: 7 }, { kind: 'gravel', w: 6 },
  ];
  const STAR = ['..1..', '.111.', '11111', '.111.', '.1.1.'];

  function buildSprite(map, pal) {
    const c = document.createElement('canvas');
    c.width = map[0].length;
    c.height = map.length;
    const g = c.getContext('2d');
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const col = pal[map[y][x]];
        if (col) {
          g.fillStyle = col;
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    return c;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    const out = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
    return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  const spriteCache = new Map();
  function vehicleSprite(kind, color, accent = TRAILER_COLORS[0], wrecked = false) {
    const key = kind + color + accent + wrecked;
    let s = spriteCache.get(key);
    if (s) return s;
    const body = wrecked ? mix(color, '#000000', 0.55) : color;
    const pal = {
      B: body,
      S: mix(body, '#000000', 0.3),
      H: mix(body, '#ffffff', 0.35),
      T: wrecked ? mix(accent, '#000000', 0.55) : accent,
      U: mix(accent, '#000000', wrecked ? 0.7 : 0.25),
      w: wrecked ? '#111111' : '#1c2541',
      g: wrecked ? '#333333' : '#7f9fdf',
      k: '#121212',
      y: wrecked ? '#555555' : '#fff3a0',
      r: wrecked ? '#440000' : '#d01818',
    };
    s = buildSprite(kind === 'truck' ? TRUCK : CAR, pal);
    spriteCache.set(key, s);
    return s;
  }

  const decorSprites = {};
  for (const k in DECOR_MAPS) decorSprites[k] = buildSprite(DECOR_MAPS[k], DECOR_PAL);
  const policeSprite = buildSprite(POLICE, POLICE_PAL);

  // Pre-rendered road tile: dirt shoulders, curbs, asphalt and lane markings.
  // Every pattern period divides TILE_H so the tile loops seamlessly.
  const roadTile = (() => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = TILE_H;
    const g = c.getContext('2d');
    for (let y = 0; y < TILE_H; y++) {
      g.fillStyle = Math.floor(y / 12) % 2 ? '#7d6b4f' : '#776549';
      g.fillRect(0, y, W, 1);
    }
    for (let i = 0; i < 320; i++) {
      const left = Math.random() < 0.5;
      const x = left ? randInt(0, ROAD_X - 4) : randInt(ROAD_R + 3, W - 1);
      g.fillStyle = pick(['#6a5a40', '#8f7d5f', '#9a9a90', '#5f5038']);
      g.fillRect(x, randInt(0, TILE_H - 1), 1, 1);
    }
    for (let y = 0; y < TILE_H; y += 6) {
      g.fillStyle = (y / 6) % 2 ? '#eeeeee' : '#f07a1a';
      g.fillRect(ROAD_X - 3, y, 2, 6);
      g.fillRect(ROAD_R + 1, y, 2, 6);
    }
    g.fillStyle = '#45454f';
    g.fillRect(ROAD_X - 1, 0, ROAD_W + 2, TILE_H);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#3d3d46' : '#50505a';
      g.fillRect(randInt(ROAD_X - 1, ROAD_R), randInt(0, TILE_H - 1), 1, 1);
    }
    g.fillStyle = '#e8e8e8';
    g.fillRect(ROAD_X + 1, 0, 1, TILE_H);
    g.fillRect(ROAD_R - 2, 0, 1, TILE_H);
    g.fillStyle = '#dcdcdc';
    for (let lane = 1; lane < LANES; lane++) {
      for (let y = 0; y < TILE_H; y += 20) g.fillRect(ROAD_X + LANE_W * lane - 1, y, 2, 10);
    }
    return c;
  })();

  // ---------------------------------------------------------------------------
  // Audio (tiny WebAudio synth; created on first input)
  // ---------------------------------------------------------------------------
  const sfx = {
    ctx: null,
    master: null,
    engine: null,
    engineGain: null,
    muted: store.get('muted', false),

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) {
        this.ctx = null;
      }
    },

    setMuted(m) {
      this.muted = m;
      store.set('muted', m);
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },

    tone(freq, dur, type = 'square', vol = 0.12, slideTo = null, delay = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    noise(dur, vol = 0.4) {
      if (!this.ctx) return;
      const n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1200;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
    },

    engineOn() {
      if (!this.ctx || this.engine) return;
      const o = this.ctx.createOscillator();
      const f = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 60;
      f.type = 'lowpass';
      f.frequency.value = 500;
      g.gain.value = 0.05;
      o.connect(f);
      f.connect(g);
      g.connect(this.master);
      o.start();
      this.engine = o;
      this.engineGain = g;
    },

    engineSet(speed) {
      if (this.engine) this.engine.frequency.setTargetAtTime(35 + speed * 0.35, this.ctx.currentTime, 0.05);
    },

    engineOff() {
      if (!this.engine) return;
      const t = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(0, t, 0.05);
      this.engine.stop(t + 0.3);
      this.engine = null;
      this.engineGain = null;
    },

    blip() { this.tone(660, 0.08, 'square', 0.08); },
    buzz() { this.tone(110, 0.2, 'square', 0.1); },
    nearMiss(combo) {
      const base = 520 + Math.min(combo, 8) * 60;
      this.tone(base, 0.07, 'square', 0.09);
      this.tone(base * 1.5, 0.1, 'square', 0.09, null, 0.06);
    },
    crash() {
      this.noise(0.9, 0.6);
      this.tone(140, 0.6, 'sawtooth', 0.2, 35);
    },
    unlock() {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'square', 0.08, null, i * 0.1));
    },
    siren(high, vol) { this.tone(high ? 960 : 720, 0.3, 'triangle', vol); },
    copAlert() {
      for (let i = 0; i < 4; i++) this.tone(i % 2 ? 720 : 960, 0.14, 'square', 0.07, null, i * 0.14);
    },
    bump() { this.noise(0.15, 0.25); },
    busted() {
      this.tone(960, 0.25, 'triangle', 0.12);
      this.tone(720, 0.25, 'triangle', 0.12, null, 0.25);
      this.tone(480, 0.6, 'square', 0.1, 120, 0.5);
    },
  };

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const keys = new Set();
  const pressed = new Set();
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'gas', KeyW: 'gas',
    ArrowDown: 'brake', KeyS: 'brake',
    Enter: 'start', Space: 'start',
    KeyP: 'pause', Escape: 'pause',
    KeyM: 'mute',
  };

  function actDown(a) {
    if (!keys.has(a)) pressed.add(a);
    keys.add(a);
  }
  function actUp(a) { keys.delete(a); }

  addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    sfx.init();
    actDown(a);
  });
  addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) actUp(a);
  });

  function autoPause() {
    keys.clear();
    if (state === 'play') {
      state = 'paused';
      sfx.engineOff();
    }
  }
  addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

  const isTouch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (isTouch) document.body.classList.add('touch');

  for (const btn of document.querySelectorAll('#touch button')) {
    const act = btn.dataset.act;
    const release = () => { btn.classList.remove('active'); actUp(act); };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sfx.init();
      btn.classList.add('active');
      actDown(act);
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sfx.init();
    if (state !== 'play') pressed.add('start');
  });

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  let state = 'title';
  let best = store.get('best', 0);
  let paintIdx = store.get('paint', 0);
  if (!PAINTS[paintIdx] || PAINTS[paintIdx].need > best) paintIdx = 0;

  let player, traffic, cops, particles, popups;
  let score, dist, spawnTimer, combo, comboTimer, shake, level, crashTimer, overTimer;
  let wanted, heat, calm, copCool, copsShaken, sirenTimer, sirenHigh, endReason;
  let newUnlocks = [], isNewBest = false;
  let roadScroll = 0, time = 0;
  let decor = [];
  const decorNext = { left: 0, right: 0 };

  function reset() {
    player = { x: laneX(1), vx: 0, speed: CRUISE, braking: false, gas: false };
    traffic = [];
    cops = [];
    wanted = 0;
    heat = 0;
    calm = 0;
    copCool = 0;
    copsShaken = 0;
    sirenTimer = 0;
    sirenHigh = false;
    endReason = 'wreck';
    particles = [];
    popups = [];
    score = 0;
    dist = 0;
    spawnTimer = 0.8;
    combo = 0;
    comboTimer = 0;
    shake = 0;
    level = 1;
    crashTimer = 0;
    overTimer = 0;
    newUnlocks = [];
    isNewBest = false;
  }

  function startGame() {
    reset();
    state = 'play';
    store.set('paint', paintIdx);
    sfx.engineOn();
    popup('GO GO GO!', W / 2, 80, '#ffd34d', 1.2);
  }

  function popup(text, x, y, color = '#fff', life = 1) {
    popups.push({ text, x, y, color, life, max: life });
  }

  function particle(x, y, vx, vy, life, color, size = 1, ground = false) {
    particles.push({ x, y, vx, vy, life, max: life, color, size, ground });
  }

  // ---------------------------------------------------------------------------
  // Scenery
  // ---------------------------------------------------------------------------
  // Each side of the road keeps its own column of scenery, placed bottom-up
  // so pieces never overlap. Everything stays clear of where the player can drive.
  function spawnDecorAt(side) {
    const bottom = decorNext[side];
    if (Math.random() < 0.15) {
      decorNext[side] = bottom - rand(8, 20);
      return;
    }
    const kind = pickWeighted(DECOR_WEIGHTS).kind;
    const spr = decorSprites[kind];
    const x = side === 'left'
      ? randInt(0, Math.max(0, ROAD_X - 8 - spr.width))
      : randInt(Math.min(ROAD_R + 8, W - spr.width), W - spr.width);
    decor.push({ kind, x, y: bottom - spr.height });
    decorNext[side] = bottom - spr.height - rand(3, 14);
  }

  function initDecor() {
    decor = [];
    for (const side of ['left', 'right']) {
      decorNext[side] = H + rand(0, 10);
      while (decorNext[side] > -1) spawnDecorAt(side);
    }
  }

  function scrollWorld(amount) {
    roadScroll = (roadScroll + amount) % TILE_H;
    for (const d of decor) d.y += amount;
    for (const side of ['left', 'right']) {
      decorNext[side] += amount;
      while (decorNext[side] > -1) spawnDecorAt(side);
    }
    decor = decor.filter((d) => d.y < H + 2);
  }

  // ---------------------------------------------------------------------------
  // Traffic
  // ---------------------------------------------------------------------------
  function spawnCar() {
    const truck = Math.random() < 0.12 + Math.min(0.1, level * 0.01);
    const w = truck ? 12 : CAR_W;
    const h = truck ? TRUCK.length : CAR_H;

    // Lanes already occupied near the top of the screen; always leave one open.
    const blocked = new Set();
    for (const c of traffic) {
      if (c.y < 30 && c.y + c.h > -40) {
        blocked.add(c.lane);
        if (c.targetX !== null) blocked.add(c.targetLane);
      }
    }
    const free = [];
    for (let l = 0; l < LANES; l++) if (!blocked.has(l)) free.push(l);
    if (free.length <= 1) return;

    const lane = pick(free);
    traffic.push({
      kind: truck ? 'truck' : 'car',
      lane, targetLane: lane, targetX: null,
      x: laneX(lane, w), y: -h - 2, w, h,
      base: truck ? rand(45, 70) : rand(50, 115),
      speed: 0,
      color: pickWeighted(TRAFFIC_COLORS).color,
      accent: pick(TRAILER_COLORS),
      signal: 0, blinkDir: 0, lcTimer: rand(0.5, 3),
      passed: false, minGap: Infinity, wrecked: false,
    });
  }

  function laneClear(lane, y0, y1, except) {
    return !traffic.some((o) => o !== except &&
      (o.lane === lane || o.targetLane === lane) &&
      o.y < y1 && o.y + o.h > y0);
  }

  function updateTraffic(dt) {
    for (const c of traffic) {
      let sp = c.base;
      if (c.wrecked) {
        sp = player.speed;
      } else {
        // Don't rear-end the car ahead in the same lane.
        for (const o of traffic) {
          if (o === c || Math.abs(o.x - c.x) >= 11 || o.y >= c.y) continue;
          if (c.y - (o.y + o.h) < 10) sp = Math.min(sp, o.speed || o.base);
        }
      }
      c.speed = sp;
      c.y += (player.speed - c.speed) * dt;

      if (c.wrecked || c.kind === 'truck') continue;
      if (c.targetX === null) {
        c.lcTimer -= dt;
        if (c.lcTimer <= 0) {
          c.lcTimer = rand(1.5, 4);
          if (Math.random() < 0.15 + level * 0.05 && c.y > -10 && c.y < H - 40) {
            const dir = Math.random() < 0.5 ? -1 : 1;
            const nl = c.lane + dir;
            if (nl >= 0 && nl < LANES && laneClear(nl, c.y - 24, c.y + c.h + 24, c)) {
              c.targetLane = nl;
              c.targetX = laneX(nl, c.w);
              c.signal = 0.8;
              c.blinkDir = dir;
            }
          }
        }
      } else if (c.signal > 0) {
        c.signal -= dt;
      } else {
        const d = c.targetX - c.x;
        const step = 16 * dt;
        if (Math.abs(d) <= step) {
          c.x = c.targetX;
          c.lane = c.targetLane;
          c.targetX = null;
        } else {
          c.x += Math.sign(d) * step;
        }
      }
    }
    traffic = traffic.filter((c) => c.y < H + 40 && c.y > -120);
  }

  const overlaps = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  function checkPlayerVsTraffic() {
    const px = player.x, py = PLAYER_Y;
    for (const c of traffic) {
      if (overlaps(px + 1, py + 1, CAR_W - 2, CAR_H - 2, c.x + 1, c.y + 1, c.w - 2, c.h - 2)) {
        crash(c);
        return;
      }
      const gap = Math.max(c.x - (px + CAR_W), px - (c.x + c.w));
      if (c.y < py + CAR_H && c.y + c.h > py) c.minGap = Math.min(c.minGap, gap);
      if (!c.passed && c.y > py + CAR_H) {
        c.passed = true;
        if (c.minGap <= NEAR_MISS_GAP && player.speed >= 90) nearMiss();
      }
    }
  }

  function nearMiss() {
    combo = comboTimer > 0 ? combo + 1 : 1;
    comboTimer = 2.5;
    const bonus = 50 * combo;
    score += bonus;
    popup('CLOSE! +' + bonus, player.x + CAR_W / 2, PLAYER_Y - 8, combo > 2 ? '#ff7ab8' : '#ffd34d', 0.9);
    sfx.nearMiss(combo);
  }

  function crash(c) {
    state = 'crash';
    crashTimer = 1.6;
    c.wrecked = true;
    shake = 6;
    const cx = (player.x + CAR_W / 2 + c.x + c.w / 2) / 2;
    const cy = (PLAYER_Y + CAR_H / 2 + c.y + c.h / 2) / 2;
    const colors = ['#fff3a0', '#ffb000', '#ff6a00', '#d02000', '#555555'];
    for (let i = 0; i < 50; i++) {
      particle(cx, cy, rand(-70, 70), rand(-70, 70), rand(0.4, 1.1), pick(colors), randInt(1, 2));
    }
    for (let i = 0; i < 12; i++) {
      particle(cx, cy, rand(-50, 50), rand(-50, 50), rand(0.5, 1), PAINTS[paintIdx].color, 1);
    }
    sfx.engineOff();
    sfx.crash();
  }

  // ---------------------------------------------------------------------------
  // Police
  // ---------------------------------------------------------------------------
  // Going over POLICE_MPH puts a cruiser on your tail. Staying over it raises
  // your wanted level every WANTED_STEP seconds, adding faster cruisers. Cops
  // only fall back if you out-drive them; if one reaches you, you're busted.
  function spawnCop() {
    if (cops.length >= MAX_COPS) return;
    const playerLane = Math.round((player.x + CAR_W / 2 - ROAD_X - LANE_W / 2) / LANE_W);
    const lane = clamp(playerLane + randInt(-1, 1), 0, LANES - 1);
    const max = 180 + wanted * 11;
    cops.push({ x: laneX(lane), y: H + 10, w: CAR_W, h: CAR_H, speed: max, max, stun: 0 });
  }

  function updatePolice(dt) {
    copCool = Math.max(0, copCool - dt);
    if (player.speed > POLICE_SPEED) {
      calm = 0;
      if (wanted === 0) {
        wanted = 1;
        heat = 0;
        spawnCop();
        popup('COPS! OUTRUN THEM!', W / 2, 70, '#6fa8ff', 1.8);
        sfx.copAlert();
      } else {
        heat += dt;
        if (heat >= WANTED_STEP) {
          heat = 0;
          wanted = Math.min(MAX_WANTED, wanted + 1);
          spawnCop();
          popup(wanted === MAX_WANTED ? 'MAX HEAT!' : 'MORE COPS!', W / 2, 70, '#6fa8ff', 1.5);
          sfx.copAlert();
        } else if (cops.length === 0 && copCool <= 0) {
          spawnCop();
          popup('ANOTHER COP!', W / 2, 70, '#6fa8ff', 1.2);
          sfx.copAlert();
        }
      }
    } else if (wanted > 0 && cops.length === 0) {
      // Drive under the limit with nobody on your tail and the heat dies down.
      calm += dt;
      if (calm >= 4) {
        wanted = 0;
        heat = 0;
        calm = 0;
        popup("HEAT'S OFF", W / 2, 70, '#57c062', 1.4);
      }
    }

    const hadCops = cops.length > 0;
    updateCops(dt);

    for (const cop of cops) {
      if (cop.y > COP_ESCAPE_Y) {
        copsShaken++;
        score += 250;
        popup('SHOOK A COP! +250', W / 2, H - 30, '#6fa8ff', 1.2);
        sfx.tone(880, 0.1, 'square', 0.08);
      }
    }
    cops = cops.filter((c) => c.y <= COP_ESCAPE_Y);

    if (hadCops && cops.length === 0) {
      const bonus = 200 * wanted;
      score += bonus;
      popup('LOST THEM! +' + bonus, W / 2, 70, '#57c062', 1.6);
      sfx.unlock();
      copCool = 3;
    }

    if (cops.length) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.32;
        sirenHigh = !sirenHigh;
        const nearest = Math.min(...cops.map((c) => c.y));
        sfx.siren(sirenHigh, 0.05 * clamp(1 - (nearest - PLAYER_Y) / 150, 0.15, 1));
      }
    }

    for (const cop of cops) {
      if (overlaps(player.x + 1, PLAYER_Y + 1, CAR_W - 2, CAR_H - 2, cop.x + 1, cop.y + 1, cop.w - 2, cop.h - 2)) {
        bust();
        return;
      }
    }
  }

  function updateCops(dt) {
    const chasing = state === 'play';
    for (const cop of cops) {
      if (!chasing) {
        cop.speed = player.speed;
        continue;
      }
      cop.stun = Math.max(0, cop.stun - dt);
      let target = cop.stun > 0 ? 80 : cop.max;
      // A cop that got ahead of you eases off so you run into it.
      if (cop.y + cop.h < PLAYER_Y) target = Math.min(target, player.speed * 0.85);
      cop.speed += clamp(target - cop.speed, -200 * dt, 120 * dt);
      cop.y += (player.speed - cop.speed) * dt;

      // Steer at the player, swerving around traffic in the way.
      let desired = player.x;
      for (const c of traffic) {
        if (c.y + c.h > cop.y - 30 && c.y < cop.y + cop.h && c.x < cop.x + cop.w + 2 && c.x + c.w > cop.x - 2) {
          const left = c.x - cop.w - 3, right = c.x + c.w + 3;
          const leftOk = left >= ROAD_X + 1, rightOk = right + cop.w <= ROAD_R - 1;
          if (leftOk && rightOk) desired = Math.abs(player.x - left) < Math.abs(player.x - right) ? left : right;
          else desired = leftOk ? left : right;
          break;
        }
      }
      const step = 70 * dt;
      cop.x = clamp(cop.x + clamp(desired - cop.x, -step, step), ROAD_X + 1, ROAD_R - 1 - cop.w);

      // Clipping traffic slows the cop down, which is your chance to pull away.
      if (cop.stun <= 0) {
        for (const c of traffic) {
          if (overlaps(cop.x + 1, cop.y + 1, cop.w - 2, cop.h - 2, c.x + 1, c.y + 1, c.w - 2, c.h - 2)) {
            cop.stun = 0.8;
            cop.speed = Math.min(cop.speed, c.speed);
            for (let i = 0; i < 8; i++) {
              particle(cop.x + cop.w / 2, cop.y, rand(-40, 40), rand(-40, 10), 0.4, pick(['#fff3a0', '#ffb000']));
            }
            sfx.bump();
            break;
          }
        }
      }
    }
  }

  function bust() {
    state = 'crash';
    endReason = 'busted';
    crashTimer = 1.8;
    shake = 2;
    popup('PULL OVER!', W / 2, PLAYER_Y - 14, '#6fa8ff', 1.6);
    sfx.engineOff();
    sfx.busted();
  }

  function gameOver() {
    const final = Math.floor(score);
    const oldBest = best;
    if (final > best) {
      best = final;
      isNewBest = true;
      store.set('best', best);
    }
    newUnlocks = PAINTS.filter((p) => p.need > oldBest && p.need <= best);
    if (newUnlocks.length) sfx.unlock();
    state = 'over';
    overTimer = 0;
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  function updateTitle(dt) {
    scrollWorld(CRUISE * 0.8 * dt);
    const n = PAINTS.length;
    if (pressed.has('left')) { paintIdx = (paintIdx - 1 + n) % n; sfx.blip(); }
    if (pressed.has('right')) { paintIdx = (paintIdx + 1) % n; sfx.blip(); }
    if (pressed.has('start')) {
      if (PAINTS[paintIdx].need <= best) startGame();
      else { sfx.buzz(); shake = 2; }
    }
  }

  function updatePlay(dt) {
    const p = player;
    p.gas = keys.has('gas');
    p.braking = keys.has('brake') && !p.gas;

    if (p.gas) p.speed += 85 * dt;
    else if (p.braking) p.speed -= 170 * dt;
    else p.speed += (CRUISE - p.speed) * Math.min(1, 0.6 * dt);

    const offroad = p.x < ROAD_X - 2 || p.x + CAR_W > ROAD_R + 2;
    if (offroad) {
      p.speed -= (p.speed - 55) * Math.min(1, 2.5 * dt);
      shake = Math.max(shake, 1);
      if (Math.random() < 0.7) {
        particle(p.x + rand(0, CAR_W), PLAYER_Y + CAR_H, rand(-15, 15), rand(0, 20), 0.4,
          pick(['#8b6b3e', '#a5865a', '#6f5530']), 1, true);
      }
    }
    p.speed = clamp(p.speed, MIN_SPEED, MAX_SPEED);

    const dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const steer = 55 + p.speed * 0.15;
    p.vx += (dir * steer - p.vx) * Math.min(1, 12 * dt);
    p.x = clamp(p.x + p.vx * dt, ROAD_X - 8, ROAD_R + 8 - CAR_W);

    if (p.gas && Math.random() < 0.5) {
      particle(p.x + (Math.random() < 0.5 ? 2 : 7), PLAYER_Y + CAR_H, rand(-4, 4), 15, 0.35,
        pick(['#9a9a9a', '#bdbdbd']), 1, true);
    }

    const moved = p.speed * dt;
    dist += moved;
    score += moved * 0.1 * (p.speed >= RECKLESS_SPEED ? 2 : 1);
    scrollWorld(moved);

    const newLevel = 1 + Math.floor(dist / 4000);
    if (newLevel > level) {
      level = newLevel;
      popup('TRAFFIC UP!', W / 2, 60, '#ff9d3d', 1.5);
      sfx.tone(440, 0.12, 'triangle', 0.1);
      sfx.tone(330, 0.15, 'triangle', 0.1, null, 0.12);
    }

    spawnTimer -= dt * (p.speed / CRUISE);
    if (spawnTimer <= 0) {
      spawnCar();
      spawnTimer = Math.max(0.28, 1.0 - level * 0.08) + Math.random() * 0.5;
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    updateTraffic(dt);
    checkPlayerVsTraffic();
    if (state === 'play') updatePolice(dt);
    sfx.engineSet(p.speed);
  }

  function burnParticles(rate) {
    if (Math.random() < rate) {
      const fire = Math.random() < 0.55;
      particle(player.x + rand(2, 8), PLAYER_Y + rand(3, 10), rand(-6, 6), rand(-30, -15),
        rand(0.4, 0.9), fire ? pick(['#ffb000', '#ff6a00', '#fff3a0']) : pick(['#555555', '#777777']),
        randInt(1, 2));
    }
  }

  function updateCrash(dt) {
    player.speed = Math.max(0, player.speed - (endReason === 'busted' ? 140 : 220) * dt);
    scrollWorld(player.speed * dt);
    updateTraffic(dt);
    updateCops(dt);
    if (endReason === 'wreck') burnParticles(0.9);
    crashTimer -= dt;
    if (crashTimer <= 0) gameOver();
  }

  function updateOver(dt) {
    overTimer += dt;
    updateTraffic(dt);
    updateCops(dt);
    if (endReason === 'wreck') burnParticles(0.5);
    if (overTimer < 0.7) return;
    if (pressed.has('start')) startGame();
    else if (pressed.has('pause') || pressed.has('left') || pressed.has('right')) {
      state = 'title';
      reset();
    }
  }

  function update(dt) {
    time += dt;
    if (pressed.has('mute')) {
      sfx.setMuted(!sfx.muted);
      popup(sfx.muted ? 'SOUND OFF' : 'SOUND ON', W / 2, 100, '#ffffff', 0.8);
    }

    if (state === 'paused') {
      if (pressed.has('pause') || pressed.has('start')) {
        state = 'play';
        sfx.engineOn();
      }
      pressed.clear();
      return;
    }

    if (state === 'title') updateTitle(dt);
    else if (state === 'play') {
      if (pressed.has('pause')) {
        state = 'paused';
        sfx.engineOff();
      } else {
        updatePlay(dt);
      }
    } else if (state === 'crash') updateCrash(dt);
    else if (state === 'over') updateOver(dt);

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += (p.vy + (p.ground ? player.speed : 0)) * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const p of popups) {
      p.y -= 12 * dt;
      p.life -= dt;
    }
    popups = popups.filter((p) => p.life > 0);
    shake = Math.max(0, shake - dt * 12);
    pressed.clear();
  }

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------
  function drawVehicle(spr, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 1, y + 2, w, h);
    ctx.drawImage(spr, x, y);
  }

  function drawTrafficCar(c) {
    const x = Math.round(c.x), y = Math.round(c.y);
    drawVehicle(vehicleSprite(c.kind, c.color, c.accent, c.wrecked), x, y, c.w, c.h);
    if (c.targetX !== null && Math.floor(time * 6) % 2 === 0) {
      ctx.fillStyle = '#ffb000';
      const bx = c.blinkDir < 0 ? x : x + c.w - 1;
      ctx.fillRect(bx, y + 1, 1, 1);
      ctx.fillRect(bx, y + c.h - 2, 1, 1);
    }
  }

  function drawPlayer() {
    const x = Math.round(player.x), y = PLAYER_Y;
    const wrecked = (state === 'crash' || state === 'over') && endReason === 'wreck';
    drawVehicle(vehicleSprite('car', PAINTS[paintIdx].color, undefined, wrecked), x, y, CAR_W, CAR_H);
    if (!wrecked && player.braking) {
      ctx.fillStyle = 'rgba(255,40,40,0.45)';
      ctx.fillRect(x, y + 15, 3, 2);
      ctx.fillRect(x + 7, y + 15, 3, 2);
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(x + 1, y + 14, 1, 1);
      ctx.fillRect(x + 8, y + 14, 1, 1);
    }
  }

  const lightsOn = () => Math.floor(time * 8) % 2 === 0;

  function drawCop(cop) {
    const x = Math.round(cop.x), y = Math.round(cop.y);
    const flip = lightsOn();
    ctx.fillStyle = flip ? 'rgba(255,40,40,0.22)' : 'rgba(60,120,255,0.22)';
    ctx.fillRect(x - 2, y + 3, cop.w + 4, 7);
    drawVehicle(policeSprite, x, y, cop.w, cop.h);
    ctx.fillStyle = flip ? '#ff2a2a' : '#5a1010';
    ctx.fillRect(x + 3, y + 6, 2, 1);
    ctx.fillStyle = flip ? '#1a2a60' : '#3a7bff';
    ctx.fillRect(x + 5, y + 6, 2, 1);
  }

  function drawWorld() {
    const off = Math.floor(roadScroll);
    ctx.drawImage(roadTile, 0, off - TILE_H);
    ctx.drawImage(roadTile, 0, off);
    for (const d of decor) ctx.drawImage(decorSprites[d.kind], d.x, Math.round(d.y));
    if (state !== 'title') {
      for (const c of traffic) drawTrafficCar(c);
      for (const cop of cops) drawCop(cop);
      drawPlayer();
    }
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max + 0.3, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups() {
    for (const p of popups) {
      if (p.life < 0.25 && Math.floor(time * 20) % 2) continue;
      drawText(p.text, p.x, p.y, p.color, 1, 'center');
    }
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 9);
    drawText('SCORE ' + Math.floor(score), 2, 2, '#ffffff');
    const reckless = player.speed >= RECKLESS_SPEED;
    drawText(Math.round(player.speed * MPH) + ' MPH', W - 2, 2, reckless ? '#ff4d4d' : '#ffffff', 1, 'right');
    if (combo > 1 && comboTimer > 0) drawText('COMBO X' + combo, 2, 12, '#ffd34d');
    if (reckless && Math.floor(time * 4) % 2 === 0) drawText('RECKLESS X2', W - 2, 12, '#ff4d4d', 1, 'right');

    // Wanted level stars.
    if (wanted > 0 && state !== 'over') {
      const total = MAX_WANTED * 7 - 2;
      const sx = Math.round(W / 2 - total / 2);
      for (let i = 0; i < MAX_WANTED; i++) {
        const lit = i < wanted;
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            if (STAR[r][c] !== '1') continue;
            ctx.fillStyle = '#000';
            ctx.fillRect(sx + i * 7 + c + 1, 21 + r, 1, 1);
            ctx.fillStyle = lit ? (lightsOn() && i === wanted - 1 ? '#ffffff' : '#ffd34d') : '#555555';
            ctx.fillRect(sx + i * 7 + c, 20 + r, 1, 1);
          }
        }
      }
    }

    // Cops coming up from behind but still off screen.
    const flip = lightsOn();
    for (const cop of cops) {
      if (cop.y < H - 6) continue;
      const ix = Math.round(cop.x) + 3;
      ctx.fillStyle = flip ? '#ff2a2a' : '#3a7bff';
      ctx.fillRect(ix + 1, H - 11, 2, 1);
      ctx.fillRect(ix, H - 10, 4, 1);
      ctx.fillStyle = flip ? '#3a7bff' : '#ff2a2a';
      ctx.fillRect(ix - 1, H - 9, 6, 2);
    }
    // Red/blue flash along the screen edges while a cop is in view.
    if (cops.some((c) => c.y < H) && state === 'play') {
      ctx.fillStyle = flip ? 'rgba(255,40,40,0.5)' : 'rgba(60,120,255,0.5)';
      ctx.fillRect(0, 9, 1, H - 12);
      ctx.fillStyle = flip ? 'rgba(60,120,255,0.5)' : 'rgba(255,40,40,0.5)';
      ctx.fillRect(W - 1, 9, 1, H - 12);
    }

    // Speedometer bar along the bottom, with a blue tick at the police threshold.
    const frac = (player.speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, H - 3, W, 3);
    ctx.fillStyle = reckless ? '#ff4d4d' : frac > 0.6 ? '#ffd34d' : '#57c062';
    ctx.fillRect(1, H - 2, Math.round((W - 2) * frac), 1);
    ctx.fillStyle = '#6fa8ff';
    ctx.fillRect(1 + Math.round((W - 2) * (POLICE_SPEED - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)), H - 3, 1, 3);
  }

  function dim(alpha) {
    ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
    ctx.fillRect(0, 0, W, H);
  }

  function drawTitle() {
    dim(0.4);
    drawText('RECKLESS', W / 2, 14, '#ff4d4d', 3, 'center', '#5a0000');
    drawText('DRIVER', W / 2, 33, '#ffffff', 3, 'center', '#333333');
    drawText('WEAVE PAST THE TRAFFIC', W / 2, 54, '#ffd34d', 1, 'center');
    drawText('BEST ' + best, W / 2, 64, '#ffffff', 1, 'center');

    const paint = PAINTS[paintIdx];
    const locked = paint.need > best;
    const spr = vehicleSprite('car', paint.color);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(W / 2 - 8, 82, 20, 32);
    ctx.drawImage(spr, W / 2 - 10, 78, 20, 32);
    if (locked) {
      dimRect(W / 2 - 10, 78, 20, 32);
      drawText('?', W / 2, 87, '#ffffff', 3, 'center');
    }
    if (Math.floor(time * 3) % 2 === 0) {
      drawText('<', W / 2 - 26, 89, '#ffffff', 2, 'left');
      drawText('>', W / 2 + 21, 89, '#ffffff', 2, 'left');
    }

    if (locked) {
      drawText('LOCKED', W / 2, 115, '#aaaaaa', 1, 'center');
      drawText('SCORE ' + paint.need + ' TO UNLOCK', W / 2, 123, '#aaaaaa', 1, 'center');
    } else {
      drawText(paint.name, W / 2, 115, paint.color, 1, 'center');
      drawText('YOUR RIDE', W / 2, 123, '#aaaaaa', 1, 'center');
    }

    const chipW = 6, gap = 3;
    const total = PAINTS.length * (chipW + gap) - gap;
    let cx = Math.round(W / 2 - total / 2);
    for (let i = 0; i < PAINTS.length; i++) {
      const p = PAINTS[i];
      if (i === paintIdx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 1, 132, chipW + 2, chipW + 2);
      }
      ctx.fillStyle = p.need <= best ? p.color : '#2a2a2a';
      ctx.fillRect(cx, 133, chipW, chipW);
      if (p.need > best) {
        ctx.fillStyle = '#666666';
        ctx.fillRect(cx + 2, 135, 2, 2);
      }
      cx += chipW + gap;
    }

    if (Math.floor(time * 2) % 2 === 0) {
      drawText(isTouch ? 'TAP TO DRIVE' : 'PRESS ENTER TO DRIVE', W / 2, 144, '#ffd34d', 1, 'center');
    }
    drawText('ARROWS / WASD TO DRIVE', W / 2, 154, '#ffffff', 1, 'center');
    drawText('GAS: UP   BRAKE: DOWN', W / 2, 162, '#ffffff', 1, 'center');
    drawText('PASS CLOSE FOR BONUS!', W / 2, 170, '#57c062', 1, 'center');
    drawText('OVER ' + POLICE_MPH + ' MPH = COPS!', W / 2, 178, '#6fa8ff', 1, 'center');
    drawText('P: PAUSE   M: MUTE', W / 2, 186, '#aaaaaa', 1, 'center');
  }

  function dimRect(x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x, y, w, h);
  }

  function drawOver() {
    dim(0.55);
    if (endReason === 'busted') {
      drawText('BUSTED!', W / 2, 26, lightsOn() ? '#6fa8ff' : '#ff4d4d', 2, 'center', '#0a1030');
      drawText('PULLED OVER BY THE COPS', W / 2, 42, '#aaaaaa', 1, 'center');
    } else {
      drawText('WRECKED!', W / 2, 26, '#ff4d4d', 2, 'center', '#5a0000');
      drawText('TOTALED IN TRAFFIC', W / 2, 42, '#aaaaaa', 1, 'center');
    }
    drawText('SCORE', W / 2, 54, '#aaaaaa', 1, 'center');
    drawText(Math.floor(score), W / 2, 62, '#ffffff', 2, 'center');
    if (isNewBest) {
      if (Math.floor(time * 4) % 2 === 0) drawText('NEW BEST!', W / 2, 80, '#ffd34d', 1, 'center');
    } else {
      drawText('BEST ' + best, W / 2, 80, '#ffffff', 1, 'center');
    }
    if (copsShaken > 0) drawText('COPS SHAKEN: ' + copsShaken, W / 2, 89, '#6fa8ff', 1, 'center');
    if (newUnlocks.length) {
      drawText('NEW PAINT UNLOCKED!', W / 2, 102, '#57c062', 1, 'center');
      newUnlocks.forEach((p, i) => drawText(p.name, W / 2, 111 + i * 8, p.color, 1, 'center'));
    }
    if (overTimer >= 0.7) {
      if (Math.floor(time * 2) % 2 === 0) {
        drawText(isTouch ? 'TAP TO RETRY' : 'ENTER: RETRY', W / 2, 150, '#ffd34d', 1, 'center');
      }
      drawText(isTouch ? 'ARROWS: GARAGE' : 'ESC: GARAGE', W / 2, 160, '#ffffff', 1, 'center');
    }
  }

  function drawPaused() {
    dim(0.5);
    drawText('PAUSED', W / 2, 80, '#ffffff', 2, 'center');
    drawText(isTouch ? 'TAP TO RESUME' : 'P TO RESUME', W / 2, 100, '#ffd34d', 1, 'center');
  }

  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) {
      ctx.translate(Math.round(rand(-shake, shake)), Math.round(rand(-shake, shake)));
    }
    drawWorld();
    ctx.restore();

    if (state === 'title') drawTitle();
    else {
      drawPopups();
      drawHUD();
      if (state === 'paused') drawPaused();
      else if (state === 'over') drawOver();
    }
    if (state === 'title') drawPopups();
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  reset();
  initDecor();
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
