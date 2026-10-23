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
  const MAX_HP = 5;
  const HELI_FUEL = 25, HELI_COOLDOWN = 15;
  const ONCOMING_LANES = 2; // lanes 0-1 drive toward you, lanes 2-3 go your way
  const PAD = 48; // extra road tile width on each side so curves never show an edge
  const SHIFT_OFF = 60;

  const laneX = (lane, w = CAR_W) => ROAD_X + LANE_W * lane + (LANE_W - w) / 2;
  const laneDir = (lane) => (lane < ONCOMING_LANES ? -1 : 1);
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
  // Every paint has a passive perk and an active ability (B key) with a cooldown.
  const PAINTS = [
    {
      name: 'WHITE', color: '#f2f2f2', need: 0,
      passive: 'blend', passiveText: 'BLEND IN: COPS AT 110 MPH',
      active: 'ghost', activeName: 'GHOST', activeText: 'PHASE THROUGH CARS', cooldown: 20, duration: 3,
    },
    {
      name: 'RED', color: '#d82828', need: 1500,
      passive: 'hotrod', passiveText: 'HOT ROD: +15 MPH TOP SPEED',
      active: 'nitro', activeName: 'NITRO', activeText: 'HUGE BURST OF SPEED', cooldown: 14, duration: 3,
    },
    {
      name: 'BLUE', color: '#2f6fe0', need: 4000,
      passive: 'coolhead', passiveText: 'COOL HEAD: HEAT RISES SLOWER',
      active: 'shockwave', activeName: 'SHOCKWAVE', activeText: 'SHOVE NEARBY CARS AWAY', cooldown: 12, duration: 0,
    },
    {
      name: 'YELLOW', color: '#f0c419', need: 8000,
      passive: 'fares', passiveText: 'BIG FARES: 2X CLOSE BONUS',
      active: 'horn', activeName: 'HORN', activeText: 'CARS CLEAR YOUR LANE', cooldown: 8, duration: 0,
    },
    {
      name: 'GREEN', color: '#2fae4f', need: 15000,
      passive: 'offroad', passiveText: "OFF-ROADER: DIRT DOESN'T SLOW",
      active: 'oil', activeName: 'OIL SLICK', activeText: 'COPS BEHIND SPIN OUT', cooldown: 10, duration: 0,
    },
    {
      name: 'BLACK', color: '#34343f', need: 25000,
      passive: 'shadow', passiveText: 'SHADOW: COPS NEED 2X TO BUST',
      active: 'smoke', activeName: 'SMOKE', activeText: 'BLINDS COPS BEHIND YOU', cooldown: 16, duration: 4,
    },
    {
      name: 'HOT PINK', color: '#f060b0', need: 40000,
      passive: 'fab', passiveText: 'FABULOUS: 1.5X ALL POINTS',
      active: 'slowmo', activeName: 'SLOW-MO', activeText: 'TIME CRAWLS AROUND YOU', cooldown: 20, duration: 4,
    },
  ];
  // Shop. Cash comes from your score at the end of every run.
  const UPGRADES = [
    { id: 'armor', name: 'ARMOR', desc: '+1 HP AGAINST THE CHOPPER', prices: [2000, 5000, 10000] },
    { id: 'engine', name: 'ENGINE', desc: '+8 MPH TOP SPEED', prices: [1500, 4000, 9000] },
    { id: 'tires', name: 'TIRES', desc: 'MORE GRIP IN TURNS AND CURVES', prices: [1500, 4000, 8000] },
    { id: 'cooler', name: 'COOLER', desc: 'ABILITY RECHARGES FASTER', prices: [2500, 6000, 12000] },
    { id: 'suspension', name: 'SUSPENSION', desc: 'POTHOLES HURT LESS', prices: [2000, 6000] },
    { id: 'jammer', name: 'RADAR JAMMER', desc: 'COPS TAKE LONGER TO BUST YOU', prices: [3000, 8000] },
    { id: 'springs', name: 'SPRINGS', desc: 'LONGER JUMPS OFF RAMPS', prices: [2000, 5000] },
  ];
  const COSMETICS = [
    { id: 'stripes', slot: 'decal', name: 'RACING STRIPES', price: 1000, desc: 'TWO STRIPES NOSE TO TAIL' },
    { id: 'checker', slot: 'decal', name: 'CHECKER ROOF', price: 2000, desc: 'A CHECKERED FLAG ON TOP' },
    { id: 'flames', slot: 'decal', name: 'FLAME DECALS', price: 3000, desc: 'HOT RODS GO FASTER. MAYBE.' },
    { id: 'fire', slot: 'trail', name: 'FIRE TRAIL', price: 2500, desc: 'LEAVE FLAMES IN YOUR WAKE' },
    { id: 'sparkle', slot: 'trail', name: 'SPARKLE TRAIL', price: 4000, desc: 'A SHOWER OF SPARKS' },
    { id: 'rainbow', slot: 'trail', name: 'RAINBOW TRAIL', price: 6000, desc: 'TASTE THE RAINBOW' },
    { id: 'neon-blue', slot: 'glow', name: 'BLUE NEON', price: 3000, rgb: '60,140,255', desc: 'UNDERGLOW. VERY STREET.' },
    { id: 'neon-pink', slot: 'glow', name: 'PINK NEON', price: 3000, rgb: '255,80,200', desc: 'UNDERGLOW. VERY STREET.' },
    { id: 'neon-green', slot: 'glow', name: 'GREEN NEON', price: 3000, rgb: '80,255,120', desc: 'UNDERGLOW. VERY STREET.' },
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

  // Road hazards: a pothole to avoid and a launch ramp (chevrons point the way up).
  const POTHOLE = ['..rrrrr...', '.rkkkkkrr.', 'rkkqkkkkkr', 'rkkkkkkqkr', '.rkkkkkkr.', '...rrrr...'];
  const RAMP = [
    'CCCCCCCCCCCC',
    'CCCCCYYCCCCC',
    'CCCCYYYYCCCC',
    'CCCYYCCYYCCC',
    'CCYYCCCCYYCC',
    'CCCCCYYCCCCC',
    'CCCCYYYYCCCC',
    'CCCYYCCYYCCC',
    'CCYYCCCCYYCC',
    'cccccccccccc',
    'kkkkkkkkkkkk',
  ];
  // Police helicopter, nose pointing down at you. Rotors are drawn spinning on top.
  const HELI = [
    '.......kk.......',
    '......kTTk......',
    '.......kk.......',
    '.......BB.......',
    '.......BB.......',
    '.......WW.......',
    '.......BB.......',
    '.......BB.......',
    '.....kBBBBk.....',
    '....kBBBBBBk....',
    '...kBBBBBBBBk...',
    '...kWWWWWWWWk...',
    'kk.kBBBBBBBBk.kk',
    'kk.kBBBBBBBBk.kk',
    'kk.kBBwwwwBBk.kk',
    'kk.kBwwwwwwBk.kk',
    'kk.kBwwggwwBk.kk',
    '....kwwwwwwk....',
    '.....kwwwwk.....',
    '......kyyk......',
  ];
  const HELI_PAL = { B: '#2a3346', W: '#e8e8e8', w: '#4a6aa5', g: '#b0c8f0', T: '#555a66', k: '#0e0e12', y: '#fff3a0' };
  // Nitro pickup: a blue bottle with a white band.
  const NITRO_CAN = ['..kk..', '.kggk.', 'kbbbbk', 'kbwwbk', 'kbbbbk', 'kbBbbk', 'kbBbbk', 'kbbbbk', '.kkkk.'];
  const NITRO_PAL = { k: '#0e1a3a', b: '#2f6fe0', B: '#9fd0ff', w: '#ffffff', g: '#c0c0c8' };
  const HAZARD_PAL = { r: '#5a5a62', k: '#16161a', q: '#2c2c36', C: '#9aa0a8', c: '#6a707a', Y: '#f2c200' };

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
  // Pixels a decal paints on top of the car body, as [x, y, color].
  function decalPixels(id, body) {
    const px = [];
    const [r, g, b] = hexToRgb(body);
    const light = (r * 0.3 + g * 0.59 + b * 0.11) / 255 > 0.6;
    if (id === 'stripes') {
      const c = light ? '#1e2a6e' : '#f2f2f2';
      CAR.forEach((row, y) => { for (const x of [4, 5]) if ('BHS'.includes(row[x])) px.push([x, y, c]); });
    } else if (id === 'checker') {
      for (let y = 6; y <= 9; y++) for (let x = 2; x <= 7; x++) px.push([x, y, (x + y) % 2 ? '#111111' : '#f2f2f2']);
    } else if (id === 'flames') {
      const map = { 1: '...b..b...', 2: '..baabab..', 3: '..aaaaaa..', 11: '.a......a.', 12: '.ab....ba.', 13: '.a......a.' };
      for (const y in map) {
        [...map[y]].forEach((ch, x) => { if (ch !== '.') px.push([x, +y, ch === 'a' ? '#ff6a00' : '#ffd000']); });
      }
    }
    return px;
  }

  function vehicleSprite(kind, color, accent = TRAILER_COLORS[0], wrecked = false, flip = false, decal = null) {
    const key = kind + color + accent + wrecked + flip + decal;
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
    const map = kind === 'truck' ? TRUCK : CAR;
    s = buildSprite(flip ? [...map].reverse() : map, pal);
    if (decal && !wrecked) {
      const g = s.getContext('2d');
      for (const [x, y, c] of decalPixels(decal, color)) {
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    }
    spriteCache.set(key, s);
    return s;
  }

  const decorSprites = {};
  for (const k in DECOR_MAPS) decorSprites[k] = buildSprite(DECOR_MAPS[k], DECOR_PAL);
  const policeSprite = buildSprite(POLICE, POLICE_PAL);
  const potholeSprite = buildSprite(POTHOLE, HAZARD_PAL);
  const nitroSprite = buildSprite(NITRO_CAN, NITRO_PAL);
  const heliSprite = buildSprite(HELI, HELI_PAL);
  const HELI_W = HELI[0].length, HELI_H = HELI.length;
  const rampSprite = buildSprite(RAMP, HAZARD_PAL);
  const policeWreckSprite = buildSprite(POLICE, Object.fromEntries(
    Object.entries(POLICE_PAL).map(([k, v]) => [k, mix(v, '#000000', 0.6)])));
  const oilSprite = buildSprite(
    ['...kkkkkk...', '.kkkkqkkkkk.', 'kkkqkkkkkkkk', 'kkkkkkkqkkkk', '.kkkkkkkkkk.', '...kkkkkk...'],
    { k: '#101014', q: '#4a3a6a' });

  // Pre-rendered road tile: dirt shoulders, curbs, asphalt and lane markings.
  // Every pattern period divides TILE_H so the tile loops seamlessly.
  const roadTile = (() => {
    const c = document.createElement('canvas');
    c.width = W + PAD * 2;
    c.height = TILE_H;
    const g = c.getContext('2d');
    const rx = ROAD_X + PAD, rr = ROAD_R + PAD;
    for (let y = 0; y < TILE_H; y++) {
      g.fillStyle = Math.floor(y / 12) % 2 ? '#7d6b4f' : '#776549';
      g.fillRect(0, y, c.width, 1);
    }
    for (let i = 0; i < 520; i++) {
      const left = Math.random() < 0.5;
      const x = left ? randInt(0, rx - 4) : randInt(rr + 3, c.width - 1);
      g.fillStyle = pick(['#6a5a40', '#8f7d5f', '#9a9a90', '#5f5038']);
      g.fillRect(x, randInt(0, TILE_H - 1), 1, 1);
    }
    for (let y = 0; y < TILE_H; y += 6) {
      g.fillStyle = (y / 6) % 2 ? '#eeeeee' : '#f07a1a';
      g.fillRect(rx - 3, y, 2, 6);
      g.fillRect(rr + 1, y, 2, 6);
    }
    g.fillStyle = '#45454f';
    g.fillRect(rx - 1, 0, ROAD_W + 2, TILE_H);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#3d3d46' : '#50505a';
      g.fillRect(randInt(rx - 1, rr), randInt(0, TILE_H - 1), 1, 1);
    }
    g.fillStyle = '#e8e8e8';
    g.fillRect(rx + 1, 0, 1, TILE_H);
    g.fillRect(rr - 2, 0, 1, TILE_H);
    for (let lane = 1; lane < LANES; lane++) {
      const x = rx + LANE_W * lane;
      if (lane === ONCOMING_LANES) {
        // Double yellow line between the two directions.
        g.fillStyle = '#f0c419';
        g.fillRect(x - 2, 0, 1, TILE_H);
        g.fillRect(x + 1, 0, 1, TILE_H);
      } else {
        g.fillStyle = '#dcdcdc';
        for (let y = 0; y < TILE_H; y += 20) g.fillRect(x - 1, y, 2, 10);
      }
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
    gunshot() { this.noise(0.06, 0.18); this.tone(180, 0.05, 'square', 0.05, 90); },
    lockOn() { this.tone(1200, 0.06, 'square', 0.05); this.tone(1200, 0.06, 'square', 0.05, null, 0.12); },
    hurt() { this.noise(0.2, 0.4); this.tone(300, 0.2, 'sawtooth', 0.1, 80); },
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
    Enter: 'start',
    Space: 'drift', ShiftLeft: 'drift', ShiftRight: 'drift',
    KeyP: 'pause', Escape: 'pause',
    KeyM: 'mute',
    KeyB: 'ability',
  };

  function actDown(a) {
    if (!keys.has(a)) pressed.add(a);
    keys.add(a);
  }
  function actUp(a) { keys.delete(a); }
  // Space doubles as start on menus and drift while driving.
  const startPressed = () => pressed.has('start') || pressed.has('drift');

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

  let player, traffic, cops, copWrecks, slicks, particles, popups, banners;
  let score, dist, spawnTimer, combo, comboTimer, shake, level, crashTimer, overTimer;
  let wanted, heat, calm, copCool, copsShaken, copsWrecked, sirenTimer, sirenHigh, endReason;
  let abilityCd, abilityTime;
  let driftPts, driftCurve, skidTimer, driftTipShown, crashCause;
  let roadItems, nextPothole, nextRamp, nextNitro, rampTipShown;
  let heli, heliCool, bullets, hp, hurtTimer, rotorTimer, heliTipShown;
  let curves = [], curveEnd = 0;
  const shiftRows = new Float32Array(H + SHIFT_OFF * 2);
  let newUnlocks = [], isNewBest = false;
  let roadScroll = 0, time = 0;
  let decor = [];
  const decorNext = { left: 0, right: 0 };

  let cash = store.get('cash', 0);
  const upgrades = store.get('upgrades', {});
  const owned = store.get('owned', []);
  const equipped = store.get('equipped', {});
  let shopTab = 0, shopSel = 0, cashEarned = 0;
  let shopMsg = null; // { text, color, life } shown in place of the item description
  const lvl = (id) => upgrades[id] || 0;
  const cosmetic = (slot) => COSMETICS.find((c) => c.id === equipped[slot]);
  const maxHp = () => MAX_HP + lvl('armor');
  const cooldownOf = (a) => a.cooldown * (1 - 0.15 * lvl('cooler'));
  function saveShop() {
    store.set('cash', cash);
    store.set('upgrades', upgrades);
    store.set('owned', owned);
    store.set('equipped', equipped);
  }

  // Paint perks.
  const paint = () => PAINTS[paintIdx];
  const hasPassive = (id) => paint().passive === id;
  const abilityOn = (id) => paint().active === id && abilityTime > 0;
  const policeSpeed = () => (hasPassive('blend') ? 110 : POLICE_MPH) / MPH;
  const maxSpeed = () => MAX_SPEED + (hasPassive('hotrod') ? 25 : 0) + lvl('engine') * 13;
  const pullTime = () => (hasPassive('shadow') ? 3 : 1.5) * (1 + 0.25 * lvl('jammer'));
  const wantedStep = () => (hasPassive('coolhead') ? 9 : WANTED_STEP);
  function addScore(n) {
    const pts = n * (hasPassive('fab') ? 1.5 : 1);
    score += pts;
    return Math.round(pts);
  }

  function reset() {
    player = { x: laneX(2), vx: 0, speed: CRUISE, braking: false, gas: false, angle: 0, air: 0, airMax: 1, wobble: 0, boost: 0 };
    heli = null;
    heliCool = 0;
    bullets = [];
    hp = maxHp();
    hurtTimer = 0;
    rotorTimer = 0;
    heliTipShown = false;
    roadItems = [];
    nextPothole = 500;
    nextRamp = 900;
    nextNitro = 700;
    rampTipShown = false;
    traffic = [];
    cops = [];
    copWrecks = [];
    slicks = [];
    copsWrecked = 0;
    abilityCd = 0;
    abilityTime = 0;
    driftPts = 0;
    driftCurve = false;
    skidTimer = 0;
    driftTipShown = false;
    crashCause = 'traffic';
    curves = [];
    curveEnd = 1400;
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
    banners = [];
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

  // Messages stay out of the driving view. Announcements (no points, centred)
  // queue up in a slim banner under the top bar; everything else (points and
  // callouts about your car) goes to a short feed in the bottom-right corner.
  // x and y are kept for callers but only decide which of the two it is.
  function popup(text, x, y, color = '#fff', life = 1) {
    if (/\+\d/.test(text) || x !== W / 2) {
      popups.push({ text, color, life: Math.max(life, 1.2), max: Math.max(life, 1.2) });
      if (popups.length > 3) popups.shift();
    } else if (!banners.some((b) => b.text === text)) {
      banners.push({ text, color, life: Math.min(life, 1.6) });
    }
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
  // Road curves
  // ---------------------------------------------------------------------------
  // Curves are stretches of road with a curvature (sideways bend per pixel)
  // that eases in and out. Everything lives in straight "road space" and is
  // drawn shifted by the bend at its screen row. The camera keeps the road
  // straight at your car, so a curve shows up as the road ahead bending away,
  // and as a sideways push you have to steer (or drift) against.
  function ensureCurves(upto) {
    while (curveEnd < upto) {
      const len = rand(500, 900);
      const sharpest = Math.min(0.0038, 0.0024 + level * 0.0002);
      const k = (Math.random() < 0.5 ? -1 : 1) * rand(0.0018, sharpest);
      curves.push({ start: curveEnd, end: curveEnd + len, k, warned: false });
      curveEnd += len + rand(1200, 2600);
    }
    curves = curves.filter((c) => c.end > dist - 300);
  }

  function curvAt(pos) {
    for (const c of curves) {
      if (pos >= c.start && pos < c.end) return c.k * Math.sin(Math.PI * (pos - c.start) / (c.end - c.start));
    }
    return 0;
  }

  function computeShifts() {
    let h = 0, o = 0;
    shiftRows[PLAYER_Y + SHIFT_OFF] = 0;
    for (let s = 1; PLAYER_Y - s + SHIFT_OFF >= 0; s++) {
      h += curvAt(dist + s);
      o += h;
      shiftRows[PLAYER_Y - s + SHIFT_OFF] = o;
    }
    h = 0;
    o = 0;
    for (let s = 1; PLAYER_Y + s + SHIFT_OFF < shiftRows.length; s++) {
      h -= curvAt(dist - s);
      o -= h;
      shiftRows[PLAYER_Y + s + SHIFT_OFF] = o;
    }
  }

  const shiftAt = (y) => clamp(shiftRows[clamp(Math.round(y) + SHIFT_OFF, 0, shiftRows.length - 1)], -PAD, PAD);
  // Screen x for something at road-space x whose middle is at screen row y.
  const sx = (x, y) => Math.round(x + shiftAt(y));

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
    const dir = laneDir(lane);
    traffic.push({
      kind: truck ? 'truck' : 'car',
      lane, targetLane: lane, targetX: null, dir,
      x: laneX(lane, w), y: -h - 2, w, h,
      base: dir < 0 ? (truck ? rand(50, 75) : rand(60, 110)) : truck ? rand(45, 70) : rand(50, 115),
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
      if (c.stopped || c.wrecked) {
        sp = 0;
      } else {
        // Don't rear-end the car ahead (above you going up, below you coming down).
        for (const o of traffic) {
          if (o === c || Math.abs(o.x - c.x) >= 11 || (o.dir !== c.dir && !o.stopped)) continue;
          const gap = c.dir > 0 ? c.y - (o.y + o.h) : o.y - (c.y + c.h);
          const ahead = c.dir > 0 ? o.y < c.y : o.y > c.y;
          if (ahead && gap < 10) sp = Math.min(sp, o.stopped ? 0 : o.speed || o.base);
        }
      }
      c.speed = sp;
      // World velocity: forward lanes move up the road, oncoming lanes down it.
      // A car wrecked by you stays put beside your car while you slide to a stop.
      const vel = c.wrecked && !c.stopped ? player.speed : c.dir * sp;
      c.y += (player.speed - vel) * dt;

      if (c.wrecked) continue;
      if (c.targetX === null) {
        if (c.kind === 'truck') continue;
        c.lcTimer -= dt;
        if (c.lcTimer <= 0) {
          c.lcTimer = rand(1.5, 4);
          if (Math.random() < 0.15 + level * 0.05 && c.y > -10 && c.y < H - 40) {
            const dir = Math.random() < 0.5 ? -1 : 1;
            const nl = c.lane + dir;
            if (nl >= 0 && nl < LANES && laneDir(nl) === c.dir && laneClear(nl, c.y - 24, c.y + c.h + 24, c)) {
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
        const step = (c.lcSpeed || 16) * dt;
        if (Math.abs(d) <= step) {
          c.x = c.targetX;
          c.lane = c.targetLane;
          c.targetX = null;
          c.lcSpeed = 0;
        } else {
          c.x += Math.sign(d) * step;
        }
      }
    }
    traffic = traffic.filter((c) => c.y < H + 40 && c.y > -120);
  }

  const overlaps = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  // Steer a traffic car into the next lane over, quickly and without signalling.
  function forceLaneChange(c, dirs, speed) {
    if (c.wrecked || c.targetX !== null) return false;
    for (const dir of dirs) {
      const nl = c.lane + dir;
      if (nl >= 0 && nl < LANES && laneDir(nl) === c.dir && laneClear(nl, c.y - 14, c.y + c.h + 14, c)) {
        c.targetLane = nl;
        c.targetX = laneX(nl, c.w);
        c.signal = 0;
        c.blinkDir = dir;
        c.lcSpeed = speed;
        return true;
      }
    }
    return false;
  }

  function checkPlayerVsTraffic() {
    const px = player.x, py = PLAYER_Y;
    const ghost = abilityOn('ghost');
    const airborne = player.air > 0;
    for (const c of traffic) {
      if (overlaps(px + 1, py + 1, CAR_W - 2, CAR_H - 2, c.x + 1, c.y + 1, c.w - 2, c.h - 2)) {
        if (airborne) {
          c.jumped = true;
        } else if (!ghost) {
          crash(c);
          return;
        }
      }
      const gap = Math.max(c.x - (px + CAR_W), px - (c.x + c.w));
      if (c.y < py + CAR_H && c.y + c.h > py) c.minGap = Math.min(c.minGap, gap);
      if (!c.passed && c.y > py + CAR_H) {
        c.passed = true;
        if (c.jumped) {
          const bonus = addScore(c.dir < 0 ? 300 : 200);
          popup('JUMPED IT! +' + bonus, W / 2, PLAYER_Y - 30, '#f2c200', 1.1);
          sfx.tone(880, 0.08, 'square', 0.08);
          sfx.tone(1320, 0.12, 'square', 0.08, null, 0.08);
        } else if (c.minGap <= NEAR_MISS_GAP && player.speed >= 90 && !c.wrecked) {
          nearMiss(c);
        }
      }
    }
  }

  function nearMiss(c) {
    combo = comboTimer > 0 ? combo + 1 : 1;
    comboTimer = 2.5;
    const headOn = c.dir < 0;
    const bonus = addScore(50 * combo * (hasPassive('fares') ? 2 : 1) * (headOn ? 2 : 1));
    popup((headOn ? 'HEAD-ON! +' : 'CLOSE! +') + bonus, player.x + CAR_W / 2, PLAYER_Y - 8, combo > 2 ? '#ff7ab8' : '#ffd34d', 0.9);
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
  // Going over the police limit puts a cruiser on your tail. Staying over it
  // raises your wanted level, adding faster cruisers. To pull you over a cop
  // has to hold position right beside you. While lining up it has tunnel
  // vision, so you can ram it, or lead it, into other cars.
  function spawnCop() {
    if (cops.length >= MAX_COPS) return;
    const playerLane = Math.round((player.x + CAR_W / 2 - ROAD_X - LANE_W / 2) / LANE_W);
    const lane = clamp(playerLane + randInt(-1, 1), 0, LANES - 1);
    const max = 180 + wanted * 11;
    cops.push({
      x: laneX(lane), y: H + 10, w: CAR_W, h: CAR_H, speed: max, max,
      side: 0, pull: 0, shove: 0, stun: 0, spin: 0, blind: 0, wander: 0, dead: false,
    });
  }

  function updatePolice(dt) {
    copCool = Math.max(0, copCool - dt);
    if (player.speed > policeSpeed()) {
      calm = 0;
      if (wanted === 0) {
        wanted = 1;
        heat = 0;
        spawnCop();
        popup('COPS! OUTRUN THEM!', W / 2, 70, '#6fa8ff', 1.8);
        sfx.copAlert();
      } else {
        heat += dt;
        if (heat >= wantedStep()) {
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
        if (hp < maxHp()) {
          hp = maxHp();
          popup('CAR PATCHED UP', W / 2, 80, '#57c062', 1.4);
        }
      }
    }

    const hadCops = cops.length > 0;
    updateCops(dt);
    if (state !== 'play') return;

    for (const cop of cops) {
      if (cop.y > COP_ESCAPE_Y) {
        copsShaken++;
        popup('SHOOK A COP! +' + addScore(250), W / 2, H - 30, '#6fa8ff', 1.2);
        sfx.tone(880, 0.1, 'square', 0.08);
      }
    }
    cops = cops.filter((c) => c.y <= COP_ESCAPE_Y);

    if (hadCops && cops.length === 0) {
      popup('LOST THEM! +' + addScore(200 * wanted), W / 2, 70, '#57c062', 1.6);
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
  }

  // The x a cop aims for to pull up beside you. Each cop sticks to one side,
  // preferring a side no other cop has taken.
  function flankX(cop) {
    const left = player.x - cop.w - 2, right = player.x + CAR_W + 2;
    const leftOk = left >= ROAD_X + 1, rightOk = right + cop.w <= ROAD_R - 1;
    if ((cop.side < 0 && !leftOk) || (cop.side > 0 && !rightOk)) cop.side = 0;
    if (!cop.side) {
      if (leftOk && rightOk) {
        const leftTaken = cops.some((o) => o !== cop && o.side < 0);
        const rightTaken = cops.some((o) => o !== cop && o.side > 0);
        // Cops prefer your right side, away from oncoming traffic.
        cop.side = leftTaken && !rightTaken ? 1 : rightTaken && !leftTaken ? -1 : 1;
      } else {
        cop.side = leftOk ? -1 : 1;
      }
    }
    return cop.side < 0 ? left : right;
  }

  function updateCops(dt) {
    const chasing = state === 'play';
    const ghost = abilityOn('ghost');
    for (const cop of cops) {
      if (!chasing) {
        cop.speed = player.speed;
        continue;
      }
      cop.stun = Math.max(0, cop.stun - dt);
      cop.spin = Math.max(0, cop.spin - dt);
      cop.blind = Math.max(0, cop.blind - dt);
      const lost = cop.spin > 0 || cop.blind > 0;
      const dy = cop.y - PLAYER_Y;
      const flanking = Math.abs(dy) < 40;

      // Race up from behind, then match your speed to sit level with you.
      let target = clamp(player.speed + dy * 3, 40, cop.max);
      if (cop.stun > 0) target = Math.min(target, 80);
      if (cop.spin > 0) target = 70;
      else if (cop.blind > 0) target = Math.min(target, 120);

      let desired;
      if (lost) {
        cop.wander = clamp(cop.wander + rand(-300, 300) * dt, -40, 40);
        desired = cop.x + cop.wander;
      } else {
        desired = flankX(cop);
        for (const c of traffic) {
          const look = c.dir < 0 && !c.stopped ? 70 : flanking ? 18 : 30;
          const ahead = c.x < cop.x + cop.w + 1 && c.x + c.w > cop.x - 1 &&
            c.y < cop.y && c.y + c.h > cop.y - look;
          if (!ahead) continue;
          if (flanking) {
            // Locked on to you: it brakes for the car ahead but won't swerve,
            // not even for oncoming traffic.
            if (c.dir < 0 && !c.stopped) continue;
            target = Math.min(target, c.speed);
          } else {
            const left = c.x - cop.w - 3, right = c.x + c.w + 3;
            const leftOk = left >= ROAD_X + 1, rightOk = right + cop.w <= ROAD_R - 1;
            if (leftOk && rightOk) desired = Math.abs(player.x - left) < Math.abs(player.x - right) ? left : right;
            else desired = leftOk ? left : right;
          }
          break;
        }
      }
      cop.speed += clamp(target - cop.speed, -220 * dt, 140 * dt);
      cop.y += (player.speed - cop.speed) * dt;

      if (Math.abs(cop.shove) > 1) {
        cop.x += cop.shove * dt;
        cop.shove -= cop.shove * Math.min(1, 5 * dt);
      }
      if (Math.abs(cop.shove) < 30) {
        const step = (lost ? 40 : 70) * dt;
        cop.x += clamp(desired - cop.x, -step, step);
      }

      // Shoved hard into the construction barriers.
      const minX = ROAD_X + 1, maxX = ROAD_R - 1 - cop.w;
      if ((cop.x < minX || cop.x > maxX) && Math.abs(cop.shove) > 70) {
        wreckCop(cop, null);
        continue;
      }
      cop.x = clamp(cop.x, minX, maxX);

      // Hitting traffic takes the cop out of the chase.
      const hit = traffic.find((c) => !c.stopped &&
        overlaps(cop.x + 1, cop.y + 1, cop.w - 2, cop.h - 2, c.x + 1, c.y + 1, c.w - 2, c.h - 2));
      if (hit) {
        wreckCop(cop, hit);
        continue;
      }

      if (cop.spin <= 0) {
        for (const s of slicks) {
          if (overlaps(cop.x, cop.y, cop.w, cop.h, s.x, s.y, s.w, s.h)) {
            cop.spin = 1.6;
            cop.shove = (Math.random() < 0.5 ? -1 : 1) * 120;
            cop.pull = 0;
            sfx.tone(600, 0.4, 'sawtooth', 0.06, 200);
            break;
          }
        }
      }

      // Contact with the player.
      if (!ghost && player.air <= 0 && overlaps(player.x, PLAYER_Y, CAR_W, CAR_H, cop.x, cop.y, cop.w, cop.h)) {
        const dir = Math.sign(cop.x + cop.w / 2 - (player.x + CAR_W / 2)) || 1;
        if (Math.abs(dy) < CAR_H - 5) {
          // Side contact: swerving into a cop rams it sideways.
          cop.x = dir > 0 ? player.x + CAR_W : player.x - cop.w;
          if (Math.sign(player.vx) === dir && Math.abs(player.vx) > 25) {
            cop.shove = dir * 170;
            cop.stun = 0.5;
            cop.pull = 0;
            shake = Math.max(shake, 2);
            for (let i = 0; i < 10; i++) {
              particle(dir > 0 ? cop.x : cop.x + cop.w, cop.y + cop.h / 2, rand(-30, 30), rand(-30, 30), 0.3,
                pick(['#fff3a0', '#ffb000', '#ffffff']));
            }
            sfx.bump();
          }
        } else if (dy > 0) {
          cop.y = PLAYER_Y + CAR_H;
          cop.speed = Math.min(cop.speed, player.speed);
        } else {
          cop.y = PLAYER_Y - cop.h;
          cop.speed = Math.max(cop.speed, player.speed);
        }
      }

      // Holding position right beside you fills the pull-over meter.
      const gap = Math.max(cop.x - (player.x + CAR_W), player.x - (cop.x + cop.w));
      const beside = Math.abs(cop.y - PLAYER_Y) < 8 && gap >= -1 && gap <= 5;
      if (beside && !lost && cop.stun <= 0 && !ghost && player.air <= 0) {
        cop.pull += dt;
        if (cop.pull >= pullTime()) {
          bust();
          break;
        }
      } else {
        cop.pull = Math.max(0, cop.pull - dt * 0.75);
      }
    }
    cops = cops.filter((c) => !c.dead);
  }

  function wreckCop(cop, car) {
    cop.dead = true;
    copWrecks.push({ x: cop.x, y: cop.y, w: cop.w, h: cop.h });
    if (car) {
      car.wrecked = true;
      car.stopped = true;
      car.targetX = null;
    }
    copsWrecked++;
    popup('COP DOWN! +' + addScore(500), W / 2, 90, '#6fa8ff', 1.4);
    const cx = cop.x + cop.w / 2, cy = cop.y + cop.h / 2;
    for (let i = 0; i < 30; i++) {
      particle(cx, cy, rand(-60, 60), rand(-60, 60), rand(0.3, 0.9),
        pick(['#fff3a0', '#ffb000', '#ff6a00', '#555555', '#3a7bff']), randInt(1, 2));
    }
    shake = Math.max(shake, 3);
    sfx.crash();
  }

  // Cop wrecks and oil slicks sit still on the road.
  function updateHazards(dt) {
    for (const w of copWrecks) {
      w.y += player.speed * dt;
      if (Math.random() < 0.4) {
        particle(w.x + rand(2, 8), w.y + rand(3, 10), rand(-5, 5), rand(-25, -10), rand(0.4, 0.8),
          pick(['#555555', '#777777', '#ff6a00']), randInt(1, 2), true);
      }
    }
    copWrecks = copWrecks.filter((w) => w.y < H + 40);
    for (const s of slicks) s.y += player.speed * dt;
    slicks = slicks.filter((s) => s.y < H + 10);
    for (const it of roadItems) it.y += player.speed * dt;
    roadItems = roadItems.filter((it) => it.y < H + 20);

    if (state === 'play') {
      const p = player;
      for (const it of roadItems) {
        if (it.used) continue;
        if (it.kind === 'ramp') {
          if (p.air <= 0 && overlaps(p.x + 1, PLAYER_Y, CAR_W - 2, CAR_H, it.x, it.y, it.w, it.h)) launch(it);
        } else if (it.kind === 'nitro') {
          // Grab it on the ground or in the air.
          if (overlaps(p.x - 1, PLAYER_Y, CAR_W + 2, CAR_H, it.x, it.y, it.w, it.h)) collectNitro(it);
        } else if (p.air <= 0 && !abilityOn('ghost') &&
          overlaps(p.x + 1, PLAYER_Y + 2, CAR_W - 2, CAR_H - 4, it.x + 2, it.y + 1, it.w - 4, it.h - 2)) {
          hitPothole(it);
        }
      }
      for (const cop of cops) {
        if (cop.stun > 0) continue;
        const hole = roadItems.find((it) => it.kind === 'pothole' &&
          overlaps(cop.x + 1, cop.y + 2, cop.w - 2, cop.h - 4, it.x + 2, it.y + 1, it.w - 4, it.h - 2));
        if (hole) {
          cop.stun = 0.6;
          cop.pull = 0;
          cop.shove = (Math.random() < 0.5 ? -1 : 1) * 60;
          sfx.bump();
        }
      }
    }

    if (state === 'play' && !abilityOn('ghost') && player.air <= 0) {
      const w = copWrecks.find((w) => overlaps(player.x + 1, PLAYER_Y + 1, CAR_W - 2, CAR_H - 2, w.x + 1, w.y + 1, w.w - 2, w.h - 2));
      if (w) {
        crashCause = 'wreck';
        crash(w);
      }
    }
  }

  // Potholes and ramps are bolted to the road, spaced out by distance travelled.
  function spawnRoadItems() {
    if (dist >= nextNitro) {
      const lane = randInt(0, LANES - 1);
      const w = NITRO_CAN[0].length;
      roadItems.push({ kind: 'nitro', x: laneX(lane, w), y: -NITRO_CAN.length - 2, w, h: NITRO_CAN.length, used: false });
      nextNitro = dist + rand(700, 1300);
    }
    if (dist >= nextPothole) {
      const lane = randInt(0, LANES - 1);
      roadItems.push({ kind: 'pothole', x: laneX(lane, POTHOLE[0].length) + randInt(-4, 4), y: -8,
        w: POTHOLE[0].length, h: POTHOLE.length, used: false });
      nextPothole = dist + rand(300, 650) / (1 + level * 0.1);
    }
    if (dist >= nextRamp) {
      const lane = randInt(0, LANES - 1);
      const w = RAMP[0].length;
      // Keep the ramp clear of potholes so the run-up is fair.
      roadItems = roadItems.filter((it) => !(it.kind === 'pothole' && it.y < 40 && Math.abs(it.x - laneX(lane, w)) < 14));
      roadItems.push({ kind: 'ramp', x: laneX(lane, w), y: -RAMP.length - 2, w, h: RAMP.length, used: false });
      nextRamp = dist + rand(1100, 1900);
      if (!rampTipShown) {
        rampTipShown = true;
        popup('RAMP AHEAD! JUMP THE CARS', W / 2, 46, '#f2c200', 2);
      }
    }
  }

  function collectNitro(it) {
    it.used = true;
    it.y = H + 100; // gone from the road
    player.boost = 2.5;
    shake = Math.max(shake, 2);
    for (let i = 0; i < 14; i++) {
      particle(player.x + CAR_W / 2, PLAYER_Y + CAR_H / 2, rand(-50, 50), rand(-50, 50), 0.4, pick(['#9fd0ff', '#2f6fe0', '#ffffff']));
    }
    popup('NITRO! +' + addScore(100), player.x + CAR_W / 2, PLAYER_Y, '#9fd0ff');
    sfx.noise(0.5, 0.3);
    sfx.tone(160, 0.5, 'sawtooth', 0.1, 520);
  }

  function hitPothole(it) {
    const p = player;
    it.used = true;
    p.speed = Math.max(MIN_SPEED, p.speed * (0.65 + 0.12 * lvl('suspension')));
    p.vx += (Math.random() < 0.5 ? -1 : 1) * 90;
    p.wobble = 0.5 * (1 - 0.5 * lvl('suspension'));
    shake = Math.max(shake, 4);
    combo = 0;
    comboTimer = 0;
    driftPts = 0;
    for (let i = 0; i < 12; i++) {
      particle(p.x + rand(0, CAR_W), PLAYER_Y + rand(4, CAR_H), rand(-40, 40), rand(-40, 20), 0.4,
        pick(['#5a5a62', '#8a8a90', '#2c2c36']), 1, true);
    }
    popup('POTHOLE!', p.x + CAR_W / 2, PLAYER_Y - 10, '#ff9d3d', 0.9);
    sfx.noise(0.25, 0.45);
    sfx.tone(90, 0.25, 'square', 0.12, 50);
  }

  function launch(ramp) {
    const p = player;
    ramp.used = true;
    p.airMax = p.air = (0.8 + p.speed / 300) * (1 + 0.2 * lvl('springs'));
    p.wobble = 0;
    popup('AIRBORNE!', p.x + CAR_W / 2, PLAYER_Y - 12, '#f2c200', 0.9);
    sfx.tone(200, 0.5, 'square', 0.09, 700);
  }

  function land() {
    const p = player;
    shake = Math.max(shake, 2);
    for (let i = 0; i < 10; i++) {
      particle(p.x + rand(0, CAR_W), PLAYER_Y + CAR_H - 2, rand(-30, 30), rand(-10, 10), 0.4, pick(['#bdbdbd', '#8a8a8a']), 1, true);
    }
    sfx.noise(0.15, 0.3);
    if (abilityOn('ghost')) return;
    const on = traffic.find((c) => !c.wrecked &&
      overlaps(p.x + 1, PLAYER_Y + 1, CAR_W - 2, CAR_H - 2, c.x + 1, c.y + 1, c.w - 2, c.h - 2)) ||
      cops.find((c) => overlaps(p.x + 1, PLAYER_Y + 1, CAR_W - 2, CAR_H - 2, c.x + 1, c.y + 1, c.w - 2, c.h - 2));
    if (on) {
      crashCause = 'landing';
      crash(on);
    }
  }

  // ---------------------------------------------------------------------------
  // Helicopter boss
  // ---------------------------------------------------------------------------
  // At max heat a police chopper hovers ahead of you. It locks a red target on
  // where you're headed, then sprays a burst of bullets at that spot. Get out
  // of the target before the burst lands. Too many hits and the car blows up.
  // It runs out of fuel and leaves after a while, then comes back if you're
  // still at max heat.
  function updateHeli(dt) {
    heliCool = Math.max(0, heliCool - dt);
    if (!heli && state === 'play' && wanted >= MAX_WANTED && heliCool <= 0) {
      heli = { x: player.x + CAR_W / 2 - HELI_W / 2, y: -HELI_H - 10, fuel: HELI_FUEL, fireTimer: 2.5,
        target: null, aim: 0, leaving: false, spin: 0 };
      popup('CHOPPER INBOUND!', W / 2, 60, '#ff4d4d', 2);
      if (!heliTipShown) {
        heliTipShown = true;
        popup('DODGE THE RED TARGETS', W / 2, 70, '#ffd34d', 2.4);
      }
      sfx.copAlert();
    }

    if (state !== 'play') {
      bullets = [];
      if (heli) heli.target = null;
    } else {
      updateBullets(dt);
    }
    if (!heli) return;

    heli.spin += dt;
    rotorTimer -= dt;
    if (rotorTimer <= 0) {
      rotorTimer = 0.11;
      sfx.tone(55, 0.07, 'square', heli.leaving ? 0.015 : 0.03);
    }

    if (!heli.leaving) {
      heli.fuel -= dt;
      if (wanted < MAX_WANTED || heli.fuel <= 0) {
        heli.leaving = true;
        heli.target = null;
        heliCool = HELI_COOLDOWN;
        if (state === 'play') popup('CHOPPER BUGGING OUT', W / 2, 60, '#57c062', 1.6);
      }
    }
    if (heli.leaving) {
      heli.y -= 70 * dt;
      if (heli.y < -HELI_H - 30) heli = null;
      return;
    }

    // Hover ahead of you, drifting side to side.
    const tx = player.x + CAR_W / 2 - HELI_W / 2 + Math.sin(time * 0.9) * 18;
    const ty = 46 + Math.sin(time * 1.3) * 10;
    heli.x = clamp(heli.x + clamp(tx - heli.x, -75 * dt, 75 * dt), 0, W - HELI_W);
    heli.y += (ty - heli.y) * Math.min(1, 1.5 * dt);

    if (state !== 'play') return;
    if (heli.target) {
      heli.aim -= dt;
      if (heli.aim <= 0) fireBurst();
    } else if (!abilityOn('smoke')) {
      // Smoke hides you from the chopper too.
      heli.fireTimer -= dt;
      if (heli.fireTimer <= 0) {
        heli.target = {
          x: clamp(player.x + CAR_W / 2 + player.vx * 0.5, ROAD_X - 4, ROAD_R + 4),
          y: PLAYER_Y + CAR_H / 2,
        };
        heli.aim = 0.75;
        sfx.lockOn();
      }
    }
  }

  function fireBurst() {
    const gx = heli.x + HELI_W / 2, gy = heli.y + HELI_H;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const tx = heli.target.x + rand(-9, 9), ty = heli.target.y + rand(-7, 7);
      const d = Math.hypot(tx - gx, ty - gy) || 1;
      const speed = 240;
      bullets.push({ x: gx, y: gy, vx: (tx - gx) / d * speed, vy: (ty - gy) / d * speed,
        left: d / speed, delay: i * 0.07, tx, ty });
    }
    heli.target = null;
    heli.fireTimer = rand(1.4, 2.3);
  }

  // Bullets fly to their target spot and hit whatever is there when they land.
  function updateBullets(dt) {
    for (const b of bullets) {
      if (b.delay > 0) {
        b.delay -= dt;
        if (b.delay <= 0) sfx.gunshot();
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.left -= dt;
      if (b.left <= 0) {
        b.dead = true;
        for (let i = 0; i < 3; i++) {
          particle(b.tx, b.ty, rand(-25, 25), rand(-25, 25), 0.25, pick(['#fff3a0', '#ffb000', '#8a8a90']), 1, true);
        }
        const hitbox = overlaps(b.tx - 1, b.ty - 1, 2, 2, player.x - 1, PLAYER_Y - 1, CAR_W + 2, CAR_H + 2);
        if (hitbox && hurtTimer <= 0 && !abilityOn('ghost') && state === 'play') hitPlayer();
      }
    }
    bullets = bullets.filter((b) => !b.dead);
  }

  function hitPlayer() {
    hp--;
    hurtTimer = 0.8;
    shake = Math.max(shake, 3);
    for (let i = 0; i < 12; i++) {
      particle(player.x + rand(0, CAR_W), PLAYER_Y + rand(0, CAR_H), rand(-50, 50), rand(-50, 50), 0.4,
        pick(['#ffffff', '#fff3a0', '#ffb000']), 1);
    }
    sfx.hurt();
    if (hp <= 0) {
      crashCause = 'heli';
      for (let i = 0; i < 40; i++) {
        particle(player.x + CAR_W / 2, PLAYER_Y + CAR_H / 2, rand(-90, 90), rand(-90, 90), rand(0.5, 1.2),
          pick(['#fff3a0', '#ffb000', '#ff6a00', '#d02000']), randInt(1, 3));
      }
      crash({ x: player.x, y: PLAYER_Y, w: CAR_W, h: CAR_H });
    } else {
      popup(hp === 1 ? 'ONE HIT LEFT!' : 'HIT! ' + hp + ' LEFT', player.x + CAR_W / 2, PLAYER_Y - 10, '#ff4d4d', 0.9);
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

  // ---------------------------------------------------------------------------
  // Abilities
  // ---------------------------------------------------------------------------
  function activateAbility() {
    const a = paint();
    abilityCd = cooldownOf(a);
    abilityTime = a.duration;
    popup(a.activeName + '!', player.x + CAR_W / 2, PLAYER_Y - 16, '#ffffff', 1);
    const cx = player.x + CAR_W / 2, cy = PLAYER_Y + CAR_H / 2;
    switch (a.active) {
      case 'ghost':
        sfx.tone(300, 0.4, 'sine', 0.12, 900);
        break;
      case 'nitro':
        sfx.noise(0.5, 0.3);
        sfx.tone(120, 0.5, 'sawtooth', 0.12, 400);
        shake = 2;
        break;
      case 'shockwave':
        for (let i = 0; i < 28; i++) {
          const ang = (i / 28) * Math.PI * 2;
          particle(cx, cy, Math.cos(ang) * 110, Math.sin(ang) * 110, 0.35, pick(['#9fd0ff', '#ffffff']));
        }
        for (const cop of cops) {
          const dx = cop.x + cop.w / 2 - cx, dy = cop.y + cop.h / 2 - cy;
          if (Math.hypot(dx, dy) < 48) {
            cop.shove = (Math.sign(dx) || 1) * 200;
            cop.stun = 0.6;
            cop.pull = 0;
          }
        }
        for (const c of traffic) {
          const dx = c.x + c.w / 2 - cx, dy = c.y + c.h / 2 - cy;
          if (Math.hypot(dx, dy) < 48) forceLaneChange(c, [Math.sign(dx) || 1], 70);
        }
        shake = 3;
        sfx.tone(220, 0.35, 'square', 0.12, 50);
        sfx.noise(0.3, 0.3);
        break;
      case 'horn':
        for (const c of traffic) {
          if (c.y < PLAYER_Y && c.y + c.h > PLAYER_Y - 110 && c.x < player.x + CAR_W + 1 && c.x + c.w > player.x - 1) {
            if (!forceLaneChange(c, Math.random() < 0.5 ? [-1, 1] : [1, -1], 45)) c.base += 50;
          }
        }
        sfx.tone(440, 0.45, 'square', 0.08);
        sfx.tone(554, 0.45, 'square', 0.08);
        break;
      case 'oil':
        // A wide spill that also covers the spots beside you where cops pull up.
        slicks.push({ x: Math.round(player.x) - 12, y: PLAYER_Y + CAR_H + 1, w: 34, h: 6 });
        sfx.noise(0.25, 0.2);
        break;
      case 'smoke':
        sfx.noise(0.6, 0.25);
        break;
      case 'slowmo':
        sfx.tone(900, 0.6, 'sine', 0.12, 150);
        break;
    }
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
    cashEarned = final;
    cash += final;
    saveShop();
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
    if (pressed.has('brake')) {
      state = 'shop';
      shopSel = 0;
      sfx.blip();
      return;
    }
    if (startPressed()) {
      if (PAINTS[paintIdx].need <= best) startGame();
      else { sfx.buzz(); shake = 2; }
    }
  }

  const shopItems = () => (shopTab === 0 ? UPGRADES : COSMETICS);

  function updateShop(dt) {
    scrollWorld(CRUISE * 0.5 * dt);
    if (shopMsg && (shopMsg.life -= dt) <= 0) shopMsg = null;
    const items = shopItems();
    if (pressed.has('gas')) { shopSel = (shopSel - 1 + items.length) % items.length; sfx.blip(); }
    if (pressed.has('brake')) { shopSel = (shopSel + 1) % items.length; sfx.blip(); }
    if (pressed.has('left') || pressed.has('right')) { shopTab = 1 - shopTab; shopSel = 0; sfx.blip(); }
    if (pressed.has('pause') || pressed.has('ability')) { state = 'title'; sfx.blip(); return; }
    if (startPressed()) buySelected();
  }

  function buySelected() {
    const it = shopItems()[shopSel];
    const say = (text, color) => { shopMsg = { text, color, life: 1.4 }; };
    if (shopTab === 0) {
      const l = lvl(it.id);
      if (l >= it.prices.length) { say('ALREADY MAXED', '#aaaaaa'); sfx.buzz(); return; }
      const price = it.prices[l];
      if (cash < price) { say('NEED ' + (price - cash) + ' MORE CASH', '#ff4d4d'); sfx.buzz(); return; }
      cash -= price;
      upgrades[it.id] = l + 1;
      say(it.name + ' LEVEL ' + (l + 1) + '!', '#57c062');
      sfx.unlock();
    } else if (owned.includes(it.id)) {
      equipped[it.slot] = equipped[it.slot] === it.id ? null : it.id;
      say(equipped[it.slot] ? 'EQUIPPED' : 'TAKEN OFF', '#ffffff');
      sfx.blip();
    } else {
      if (cash < it.price) { say('NEED ' + (it.price - cash) + ' MORE CASH', '#ff4d4d'); sfx.buzz(); return; }
      cash -= it.price;
      owned.push(it.id);
      equipped[it.slot] = it.id;
      say('BOUGHT ' + it.name + '!', '#57c062');
      sfx.unlock();
    }
    saveShop();
  }

  function updatePlay(dt) {
    const p = player;
    abilityCd = Math.max(0, abilityCd - dt);
    abilityTime = Math.max(0, abilityTime - dt);
    if (pressed.has('ability')) {
      if (abilityCd <= 0) activateAbility();
      else sfx.buzz();
    }
    // Slow-mo slows the world down; your steering stays full speed.
    const wdt = abilityOn('slowmo') ? dt * 0.4 : dt;

    p.gas = keys.has('gas');
    p.braking = keys.has('brake') && !p.gas;
    p.boost = Math.max(0, p.boost - dt);
    const nitro = abilityOn('nitro') || p.boost > 0;
    const top = maxSpeed() + (nitro ? 80 : 0);
    const airborne = p.air > 0;
    p.wobble = Math.max(0, p.wobble - dt);

    if (airborne) {
      // No grip in the air: speed holds steady.
    } else if (nitro) p.speed = Math.max(p.speed, Math.min(top, p.speed + 220 * dt));
    else if (p.gas) p.speed += 85 * dt;
    else if (p.braking) p.speed -= 170 * dt;
    else p.speed += (CRUISE - p.speed) * Math.min(1, 0.6 * dt);

    const offroad = !airborne && (p.x < ROAD_X - 2 || p.x + CAR_W > ROAD_R + 2);
    if (offroad) {
      if (!hasPassive('offroad')) {
        p.speed -= (p.speed - 55) * Math.min(1, 2.5 * dt);
        shake = Math.max(shake, 1);
      }
      if (Math.random() < 0.7) {
        particle(p.x + rand(0, CAR_W), PLAYER_Y + CAR_H, rand(-15, 15), rand(0, 20), 0.4,
          pick(['#8b6b3e', '#a5865a', '#6f5530']), 1, true);
      }
    }
    p.speed = Math.max(MIN_SPEED, p.speed);
    // Nitro wears off gradually instead of snapping back to top speed.
    if (p.speed > top) p.speed = Math.max(top, p.speed - 90 * dt);

    // Steering and drifting. Drifting slides the car sideways much harder and
    // shrugs off most of a curve's push, at the cost of a little speed.
    ensureCurves(dist + 600);
    const k = curvAt(dist);
    const dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const steer = (55 + Math.min(p.speed, MAX_SPEED) * 0.15) * (1 + 0.1 * lvl('tires'));
    const drifting = keys.has('drift') && p.speed > 90 && !airborne;
    if (airborne) {
      p.vx += (dir * steer * 0.6 - p.vx) * Math.min(1, 3 * dt);
    } else if (p.wobble > 0) {
      // Knocked off line by a pothole: the wheel is out of your hands for a moment.
      p.vx -= p.vx * Math.min(1, 2 * dt);
    } else if (drifting) {
      p.vx += (dir * steer * 1.6 - p.vx) * Math.min(1, 5 * dt);
      p.speed -= 25 * dt;
      const targetAngle = dir !== 0 ? dir * 0.4 : p.angle;
      p.angle += (targetAngle - p.angle) * Math.min(1, 8 * dt);
    } else {
      p.vx += (dir * steer - p.vx) * Math.min(1, 12 * dt);
      p.angle -= p.angle * Math.min(1, 10 * dt);
    }
    const push = airborne ? 0 : k * p.speed * p.speed * 0.55 * (drifting ? 0.35 : 1) * (1 - 0.1 * lvl('tires'));
    const lateral = p.vx - push;
    const minX = ROAD_X - 8, maxX = ROAD_R + 8 - CAR_W;
    p.x += lateral * dt;
    // A curve throwing you into the barriers at speed is a wreck.
    if (((p.x < minX && lateral < -45) || (p.x > maxX && lateral > 45)) && Math.abs(push) > 35 && !abilityOn('ghost')) {
      p.x = clamp(p.x, minX, maxX);
      crashCause = 'barrier';
      crash({ x: p.x < ROAD_X ? p.x - 4 : p.x + CAR_W, y: PLAYER_Y, w: 4, h: CAR_H });
      return;
    }
    p.x = clamp(p.x, minX, maxX);

    if (drifting && p.speed > 110) {
      if (Math.abs(p.angle) > 0.15) {
        const curve = Math.abs(k) > 0.001;
        driftPts += p.speed * dt * 0.3 * (curve ? 2 : 1);
        driftCurve = driftCurve || curve;
        for (const wx of [1, 8]) particle(p.x + wx, PLAYER_Y + 13, 0, 0, 1.6, '#1e1e22', 1, true);
        if (Math.random() < 0.4) {
          particle(p.x + rand(0, CAR_W), PLAYER_Y + CAR_H, rand(-10, 10), rand(-5, 10), 0.6, pick(['#bdbdbd', '#d8d8d8']), 2, true);
        }
        skidTimer -= dt;
        if (skidTimer <= 0) {
          skidTimer = 0.09;
          sfx.noise(0.09, 0.05);
        }
      }
    } else if (driftPts > 0) {
      if (driftPts >= 15) {
        popup((driftCurve ? 'CURVE DRIFT +' : 'DRIFT +') + addScore(driftPts), W / 2, PLAYER_Y - 26, '#ff9de2', 1.3);
        sfx.tone(660, 0.08, 'square', 0.07);
        sfx.tone(990, 0.1, 'square', 0.07, null, 0.07);
      }
      driftPts = 0;
      driftCurve = false;
    }

    for (const cv of curves) {
      if (!cv.warned && cv.start - dist < 260) {
        cv.warned = true;
        popup(cv.k > 0 ? 'CURVE AHEAD >>' : '<< CURVE AHEAD', W / 2, 46, '#ffd34d', 1.8);
        if (!driftTipShown) {
          driftTipShown = true;
          popup(isTouch ? 'HOLD DFT TO DRIFT' : 'HOLD SPACE TO DRIFT', W / 2, 56, '#ff9de2', 2.2);
        }
        sfx.tone(520, 0.1, 'triangle', 0.08);
        sfx.tone(520, 0.1, 'triangle', 0.08, null, 0.15);
      }
    }

    const trail = cosmetic('trail');
    if (trail) {
      const rx = p.x + CAR_W / 2, ry = PLAYER_Y + CAR_H;
      if (trail.id === 'fire') {
        particle(rx + rand(-3, 3), ry, rand(-8, 8), rand(20, 45), 0.35, pick(['#fff3a0', '#ffb000', '#ff6a00', '#d02000']), randInt(1, 2), true);
      } else if (trail.id === 'rainbow') {
        const c = 'hsl(' + Math.floor((time * 300) % 360) + ',100%,60%)';
        particle(p.x + 2, ry, 0, 0, 0.5, c, 2, true);
        particle(p.x + 6, ry, 0, 0, 0.5, c, 2, true);
      } else if (Math.random() < 0.7) {
        particle(rx + rand(-5, 5), ry, rand(-30, 30), rand(-10, 30), 0.4, pick(['#ffffff', '#fff3a0', '#9fd0ff']), 1, true);
      }
    }
    if (p.gas && Math.random() < 0.5) {
      particle(p.x + (Math.random() < 0.5 ? 2 : 7), PLAYER_Y + CAR_H, rand(-4, 4), 15, 0.35,
        pick(['#9a9a9a', '#bdbdbd']), 1, true);
    }
    if (nitro) {
      for (let i = 0; i < 2; i++) {
        particle(p.x + (i ? 7 : 2), PLAYER_Y + CAR_H, rand(-6, 6), rand(20, 50), 0.25,
          pick(['#fff3a0', '#ffb000', '#3a7bff']), randInt(1, 2), true);
      }
    }
    if (abilityOn('smoke')) {
      for (let i = 0; i < 3; i++) {
        particle(p.x + rand(0, CAR_W), PLAYER_Y + CAR_H, rand(-25, 25), rand(-10, 10), rand(0.8, 1.4),
          pick(['#8a8a8a', '#a0a0a0', '#6a6a6a']), randInt(2, 3), true);
      }
      for (const cop of cops) {
        if (cop.y > PLAYER_Y - 6 && cop.y < PLAYER_Y + 130) cop.blind = 1;
      }
    }

    if (p.air > 0) {
      p.air -= wdt;
      if (p.air <= 0) {
        p.air = 0;
        land();
        if (state !== 'play') return;
      }
    }

    const moved = p.speed * wdt;
    dist += moved;
    spawnRoadItems();
    addScore(moved * 0.1 * (p.speed >= RECKLESS_SPEED ? 2 : 1));
    scrollWorld(moved);

    const newLevel = 1 + Math.floor(dist / 4000);
    if (newLevel > level) {
      level = newLevel;
      popup('TRAFFIC UP!', W / 2, 60, '#ff9d3d', 1.5);
      sfx.tone(440, 0.12, 'triangle', 0.1);
      sfx.tone(330, 0.15, 'triangle', 0.1, null, 0.12);
    }

    spawnTimer -= wdt * (p.speed / CRUISE);
    if (spawnTimer <= 0) {
      spawnCar();
      spawnTimer = Math.max(0.28, 1.0 - level * 0.08) + Math.random() * 0.5;
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    updateTraffic(wdt);
    updateHazards(wdt);
    if (state === 'play') checkPlayerVsTraffic();
    if (state === 'play') updatePolice(wdt);
    updateHeli(wdt);
    hurtTimer = Math.max(0, hurtTimer - dt);
    if (hp <= 2 && state === 'play' && Math.random() < (hp === 1 ? 0.6 : 0.3)) {
      particle(p.x + rand(2, 8), PLAYER_Y + rand(0, 6), rand(-6, 6), rand(-25, -10), rand(0.4, 0.8),
        hp === 1 ? pick(['#555555', '#ff6a00']) : '#777777', randInt(1, 2), true);
    }
    sfx.engineSet(p.speed * (abilityOn('slowmo') ? 0.6 : 1));
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
    dist += player.speed * dt;
    scrollWorld(player.speed * dt);
    updateTraffic(dt);
    updateCops(dt);
    updateHazards(dt);
    updateHeli(dt);
    if (endReason === 'wreck') burnParticles(0.9);
    crashTimer -= dt;
    if (crashTimer <= 0) gameOver();
  }

  function updateOver(dt) {
    overTimer += dt;
    updateTraffic(dt);
    updateCops(dt);
    updateHazards(dt);
    updateHeli(dt);
    if (endReason === 'wreck') burnParticles(0.5);
    if (overTimer < 0.7) return;
    if (startPressed()) startGame();
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
      if (pressed.has('pause') || startPressed()) {
        state = 'play';
        sfx.engineOn();
      }
      pressed.clear();
      return;
    }

    computeShifts();
    if (state === 'title') updateTitle(dt);
    else if (state === 'shop') updateShop(dt);
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
    for (const p of popups) p.life -= dt;
    popups = popups.filter((p) => p.life > 0);
    if (banners.length) {
      // Hurry the current banner along when others are waiting.
      if (banners.length > 2) banners[0].life = Math.min(banners[0].life, 0.6);
      banners[0].life -= dt;
      if (banners[0].life <= 0) banners.shift();
    }
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
    const x = sx(c.x, c.y + c.h / 2), y = Math.round(c.y);
    drawVehicle(vehicleSprite(c.kind, c.color, c.accent, c.wrecked, c.dir < 0), x, y, c.w, c.h);
    if (c.targetX !== null && Math.floor(time * 6) % 2 === 0) {
      ctx.fillStyle = '#ffb000';
      const bx = c.blinkDir < 0 ? x : x + c.w - 1;
      ctx.fillRect(bx, y + 1, 1, 1);
      ctx.fillRect(bx, y + c.h - 2, 1, 1);
    }
  }

  // Neon underglow: a soft outer halo and a brighter inner pool, gently pulsing.
  function drawGlow(glow, x, y, scale) {
    const a = 0.3 + 0.15 * Math.sin(time * 6);
    ctx.fillStyle = 'rgba(' + glow.rgb + ',' + (a * 0.45).toFixed(2) + ')';
    ctx.fillRect(x - 3 * scale, y + scale, (CAR_W + 6) * scale, (CAR_H - 2) * scale);
    ctx.fillRect(x - scale, y - 2 * scale, (CAR_W + 2) * scale, (CAR_H + 4) * scale);
    ctx.fillStyle = 'rgba(' + glow.rgb + ',' + a.toFixed(2) + ')';
    ctx.fillRect(x - scale, y, (CAR_W + 2) * scale, CAR_H * scale);
  }

  function drawPlayer() {
    const x = Math.round(player.x), y = PLAYER_Y;
    const wrecked = (state === 'crash' || state === 'over') && endReason === 'wreck';
    if (abilityOn('ghost')) ctx.globalAlpha = Math.floor(time * 12) % 2 ? 0.35 : 0.6;
    else if (hurtTimer > 0 && Math.floor(time * 20) % 2) ctx.globalAlpha = 0.3;
    const spr = vehicleSprite('car', paint().color, undefined, wrecked, false, equipped.decal);
    const glow = cosmetic('glow');
    if (glow && !wrecked) drawGlow(glow, x, y, 1);
    const hgt = player.air > 0 ? Math.sin(Math.PI * (1 - player.air / player.airMax)) : 0;
    if (hgt > 0) {
      // In the air: the shadow falls away and the car looms bigger.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 2 + Math.round(hgt * 5), y + 2 + Math.round(hgt * 8), CAR_W, CAR_H);
      ctx.save();
      ctx.translate(x + CAR_W / 2, y + CAR_H / 2);
      ctx.scale(1 + 0.55 * hgt, 1 + 0.55 * hgt);
      ctx.rotate(player.angle);
      ctx.drawImage(spr, -CAR_W / 2, -CAR_H / 2);
      ctx.restore();
    } else if (Math.abs(player.angle) > 0.02) {
      ctx.save();
      ctx.translate(x + CAR_W / 2, y + CAR_H / 2);
      ctx.rotate(player.angle);
      drawVehicle(spr, -CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H);
      ctx.restore();
    } else {
      drawVehicle(spr, x, y, CAR_W, CAR_H);
    }
    ctx.globalAlpha = 1;
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
    // A spinning cop shudders side to side.
    const jitter = cop.spin > 0 ? (Math.floor(time * 20) % 2 ? 1 : -1) : 0;
    const x = sx(cop.x, cop.y + cop.h / 2) + jitter, y = Math.round(cop.y);
    const flip = lightsOn();
    ctx.fillStyle = flip ? 'rgba(255,40,40,0.22)' : 'rgba(60,120,255,0.22)';
    ctx.fillRect(x - 2, y + 3, cop.w + 4, 7);
    drawVehicle(policeSprite, x, y, cop.w, cop.h);
    ctx.fillStyle = flip ? '#ff2a2a' : '#5a1010';
    ctx.fillRect(x + 3, y + 6, 2, 1);
    ctx.fillStyle = flip ? '#1a2a60' : '#3a7bff';
    ctx.fillRect(x + 5, y + 6, 2, 1);
    if (cop.blind > 0 && Math.floor(time * 4) % 2) drawText('?', x + cop.w / 2, y - 7, '#ffffff', 1, 'center');
  }

  function drawWorld() {
    // Draw the road one row at a time so it can bend.
    const off = Math.floor(roadScroll);
    for (let y = 0; y < H; y++) {
      const srcY = (((y - off) % TILE_H) + TILE_H) % TILE_H;
      ctx.drawImage(roadTile, PAD - Math.round(shiftAt(y)), srcY, W, 1, 0, y, W, 1);
    }
    for (const d of decor) {
      const spr = decorSprites[d.kind];
      ctx.drawImage(spr, sx(d.x, d.y + spr.height / 2), Math.round(d.y));
    }
    const inMenu = state === 'title' || state === 'shop';
    if (!inMenu) {
      for (const it of roadItems) {
        if (it.kind === 'nitro') {
          // Bob and glow so it stands out on the asphalt.
          const nx = sx(it.x, it.y + it.h / 2), ny = Math.round(it.y + Math.sin(time * 6) * 1.5);
          ctx.fillStyle = 'rgba(80,160,255,' + (0.25 + 0.15 * Math.sin(time * 8)).toFixed(2) + ')';
          ctx.fillRect(nx - 2, ny - 1, it.w + 4, it.h + 2);
          ctx.drawImage(nitroSprite, nx, ny);
        } else {
          ctx.drawImage(it.kind === 'ramp' ? rampSprite : potholeSprite, sx(it.x, it.y + it.h / 2), Math.round(it.y));
        }
      }
      for (const s of slicks) {
        for (let i = 0; i < 3; i++) ctx.drawImage(oilSprite, sx(s.x, s.y) + i * 11, Math.round(s.y) + (i === 1 ? 1 : 0));
      }
      if (heli) {
        // Chopper shadow on the road.
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(Math.round(heli.x) + 9, Math.round(heli.y) + 44, HELI_W - 4, HELI_H - 6);
      }
      if (heli && heli.target) {
        // Red lock-on reticle; blinks faster just before the burst.
        const t = heli.target;
        if (heli.aim > 0.3 || Math.floor(time * 16) % 2) {
          const rx = Math.round(t.x), ry = Math.round(t.y);
          ctx.fillStyle = '#ff2a2a';
          for (const [dx, dy] of [[-7, -7], [4, -7], [-7, 4], [4, 4]]) {
            ctx.fillRect(rx + dx, ry + dy, 3, 1);
            ctx.fillRect(rx + dx + (dx < 0 ? 0 : 2), ry + dy + (dy < 0 ? 0 : -2), 1, 3);
          }
          ctx.fillRect(rx, ry, 1, 1);
        }
      }
      for (const w of copWrecks) drawVehicle(policeWreckSprite, sx(w.x, w.y + w.h / 2), Math.round(w.y), w.w, w.h);
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
    if (!inMenu) {
      for (const b of bullets) {
        if (b.delay > 0) continue;
        ctx.fillStyle = 'rgba(255,200,60,0.5)';
        ctx.fillRect(Math.round(b.x - b.vx * 0.02), Math.round(b.y - b.vy * 0.02), 1, 1);
        ctx.fillStyle = '#fff3a0';
        ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
      }
      if (heli) drawHeli();
    }
  }

  function drawHeli() {
    const x = Math.round(heli.x), y = Math.round(heli.y);
    ctx.drawImage(heliSprite, x, y);
    // Main rotor: two long blades spinning around the cabin.
    const cx = x + HELI_W / 2, cy = y + 12;
    const a = heli.spin * 22;
    ctx.fillStyle = 'rgba(210,215,225,0.75)';
    for (const off of [0, Math.PI / 2]) {
      const c = Math.cos(a + off), s = Math.sin(a + off);
      for (let t = -14; t <= 14; t++) ctx.fillRect(Math.round(cx + c * t), Math.round(cy + s * t), 1, 1);
    }
    // Tail rotor flicker.
    ctx.fillStyle = '#cfd3da';
    if (Math.floor(time * 30) % 2) ctx.fillRect(cx - 3, y + 1, 6, 1);
    else ctx.fillRect(cx - 1, y - 2, 1, 6);
    // Police light on the nose.
    ctx.fillStyle = lightsOn() ? '#ff2a2a' : '#3a7bff';
    ctx.fillRect(cx - 1, y + 8, 2, 1);
  }

  function drawPopups() {
    const b = banners[0];
    if (b) {
      const y = state === 'title' || state === 'shop' ? H - 22 : 31;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, y - 2, W, 9);
      if (b.life > 0.2 || Math.floor(time * 20) % 2) drawText(b.text, W / 2, y, b.color, 1, 'center');
    }
    popups.forEach((p, i) => {
      const y = H - 12 - (popups.length - 1 - i) * 7;
      ctx.globalAlpha = clamp(p.life / 0.4, 0, 1);
      drawText(p.text, W - 2, y, p.color, 1, 'right');
      ctx.globalAlpha = 1;
    });
  }

  function drawHUD() {
    if (abilityOn('slowmo')) {
      ctx.fillStyle = 'rgba(170,80,255,0.14)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 9);
    drawText('SCORE ' + Math.floor(score), 2, 2, '#ffffff');
    const reckless = player.speed >= RECKLESS_SPEED;
    drawText(Math.round(player.speed * MPH) + ' MPH', W - 2, 2, reckless ? '#ff4d4d' : '#ffffff', 1, 'right');
    if (reckless && Math.floor(time * 4) % 2 === 0) drawText('RECKLESS X2', W - 2, 12, '#ff4d4d', 1, 'right');

    // Active ability: name plus a cooldown bar (yellow while it's running).
    const a = paint();
    if (heli || hp < maxHp()) {
      // Armor: one block per hit you can still take.
      const bx = W - 2 - maxHp() * 5 + 1;
      drawText('HP', bx - 2, 20, hp <= 1 && lightsOn() ? '#ff4d4d' : '#ffffff', 1, 'right');
      for (let i = 0; i < maxHp(); i++) {
        ctx.fillStyle = '#000';
        ctx.fillRect(bx + i * 5, 20, 4, 5);
        ctx.fillStyle = i < hp ? (hp <= 2 ? '#ff4d4d' : '#57c062') : '#3a3a3a';
        ctx.fillRect(bx + i * 5, 21, 4, 3);
      }
    }
    const label = 'B ' + a.activeName;
    const ready = abilityCd <= 0;
    const running = abilityTime > 0;
    drawText(label, 2, 12, running ? '#ffd34d' : ready ? '#ffffff' : '#888888');
    const barW = textWidth(label);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(2, 18, barW, 2);
    ctx.fillStyle = running ? '#ffd34d' : ready ? '#57c062' : '#6a6a6a';
    const frac = running ? abilityTime / a.duration : ready ? 1 : 1 - abilityCd / cooldownOf(a);
    ctx.fillRect(2, 18, Math.round(barW * frac), 2);
    if (combo > 1 && comboTimer > 0) drawText('COMBO X' + combo, 2, 23, '#ffd34d');

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

    const flip = lightsOn();
    if (driftPts > 0) {
      const label = 'DRIFT ' + Math.floor(driftPts * (hasPassive('fab') ? 1.5 : 1)) + (driftCurve ? ' X2' : '');
      drawText(label, clamp(player.x + CAR_W / 2, 24, W - 24), PLAYER_Y + CAR_H + 5, driftCurve ? '#ffd34d' : '#ff9de2', 1, 'center');
    }
    // Chevrons point the way while you're in a curve.
    const bend = curvAt(dist);
    if (Math.abs(bend) > 0.0012 && state === 'play' && Math.floor(time * 5) % 2) {
      if (bend > 0) drawText('>>>', W - 3, 90, '#ffd34d', 1, 'right');
      else drawText('<<<', 3, 90, '#ffd34d', 1, 'left');
    }
    // Pull-over meter above your car while a cop is lined up beside you.
    const pull = cops.reduce((m, c) => Math.max(m, c.pull), 0);
    if (pull > 0 && state === 'play') {
      const px = clamp(Math.round(player.x + CAR_W / 2), 20, W - 20);
      const bw = 20;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(px - bw / 2 - 1, PLAYER_Y - 6, bw + 2, 4);
      ctx.fillStyle = flip ? '#ff2a2a' : '#3a7bff';
      ctx.fillRect(px - bw / 2, PLAYER_Y - 5, Math.round(bw * Math.min(1, pull / pullTime())), 2);
      drawText('PULL OVER', px, PLAYER_Y - 13, flip ? '#ff4d4d' : '#6fa8ff', 1, 'center');
    }

    // Cops coming up from behind but still off screen.
    for (const cop of cops) {
      if (cop.y < H - 6) continue;
      const ix = sx(cop.x, H - 8) + 3;
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
    const span = maxSpeed() - MIN_SPEED;
    const sf = clamp((player.speed - MIN_SPEED) / span, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, H - 3, W, 3);
    ctx.fillStyle = abilityOn('nitro') || player.boost > 0 ? (flip ? '#3a7bff' : '#ffffff') : reckless ? '#ff4d4d' : sf > 0.6 ? '#ffd34d' : '#57c062';
    ctx.fillRect(1, H - 2, Math.round((W - 2) * sf), 1);
    ctx.fillStyle = '#6fa8ff';
    ctx.fillRect(1 + Math.round((W - 2) * (policeSpeed() - MIN_SPEED) / span), H - 3, 1, 3);
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
    drawText('BEST ' + best + '   CASH ' + cash, W / 2, 64, '#ffffff', 1, 'center');

    const paint = PAINTS[paintIdx];
    const locked = paint.need > best;
    const spr = vehicleSprite('car', paint.color, undefined, false, false, equipped.decal);
    if (cosmetic('glow') && !locked) drawGlow(cosmetic('glow'), W / 2 - 10, 78, 2);
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
      drawText('LOCKED - SCORE ' + paint.need, W / 2, 113, '#aaaaaa', 1, 'center');
    } else {
      drawText(paint.name, W / 2, 113, paint.name === 'BLACK' ? '#9a9aae' : paint.color, 1, 'center');
    }
    const dimText = locked ? '#888888' : null;
    drawText(paint.passiveText, W / 2, 121, dimText || '#9fe0a0', 1, 'center');
    drawText('B: ' + paint.activeName, W / 2, 129, dimText || '#ffd34d', 1, 'center');
    drawText(paint.activeText, W / 2, 137, dimText || '#ffffff', 1, 'center');

    const chipW = 6, gap = 3;
    const total = PAINTS.length * (chipW + gap) - gap;
    let cx = Math.round(W / 2 - total / 2);
    for (let i = 0; i < PAINTS.length; i++) {
      const p = PAINTS[i];
      if (i === paintIdx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 1, 145, chipW + 2, chipW + 2);
      }
      ctx.fillStyle = p.need <= best ? p.color : '#2a2a2a';
      ctx.fillRect(cx, 146, chipW, chipW);
      if (p.need > best) {
        ctx.fillStyle = '#666666';
        ctx.fillRect(cx + 2, 148, 2, 2);
      }
      cx += chipW + gap;
    }

    if (Math.floor(time * 2) % 2 === 0) {
      drawText(isTouch ? 'TAP TO DRIVE' : 'PRESS ENTER TO DRIVE', W / 2, 157, '#ffd34d', 1, 'center');
    }
    drawText('ARROWS/WASD DRIVE  SPACE DRIFT', W / 2, 167, '#ffffff', 1, 'center');
    drawText('OVER ' + POLICE_MPH + ' MPH = COPS!', W / 2, 175, '#6fa8ff', 1, 'center');
    drawText(isTouch ? 'BRK: SHOP   B: ABILITY' : 'DOWN: SHOP   B: ABILITY', W / 2, 183,
      Math.floor(time * 2) % 2 ? '#57c062' : '#aaaaaa', 1, 'center');
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
      const why = {
        traffic: 'TOTALED IN TRAFFIC', barrier: 'SPUN INTO THE BARRIERS',
        wreck: 'PLOWED INTO A WRECK', landing: 'LANDED ON A CAR', heli: 'SHOT DOWN BY THE CHOPPER',
      };
      drawText(why[crashCause] || why.traffic, W / 2, 42, '#aaaaaa', 1, 'center');
    }
    drawText('SCORE', W / 2, 54, '#aaaaaa', 1, 'center');
    drawText(Math.floor(score), W / 2, 62, '#ffffff', 2, 'center');
    if (isNewBest) {
      if (Math.floor(time * 4) % 2 === 0) drawText('NEW BEST!', W / 2, 80, '#ffd34d', 1, 'center');
    } else {
      drawText('BEST ' + best, W / 2, 80, '#ffffff', 1, 'center');
    }
    if (copsShaken || copsWrecked) {
      drawText('COPS: ' + copsShaken + ' SHAKEN ' + copsWrecked + ' WRECKED', W / 2, 89, '#6fa8ff', 1, 'center');
    }
    if (newUnlocks.length) {
      drawText('NEW PAINT UNLOCKED!', W / 2, 102, '#57c062', 1, 'center');
      newUnlocks.forEach((p, i) => drawText(p.name, W / 2, 111 + i * 8, p.color, 1, 'center'));
    }
    drawText('+' + cashEarned + ' CASH', W / 2, 136, '#57c062', 1, 'center');
    if (overTimer >= 0.7) {
      if (Math.floor(time * 2) % 2 === 0) {
        drawText(isTouch ? 'TAP TO RETRY' : 'ENTER: RETRY', W / 2, 150, '#ffd34d', 1, 'center');
      }
      drawText(isTouch ? 'ARROWS: GARAGE + SHOP' : 'ESC: GARAGE + SHOP', W / 2, 160, '#ffffff', 1, 'center');
    }
  }

  function drawShop() {
    dim(0.72);
    drawText('SHOP', W / 2, 4, '#ffd34d', 2, 'center', '#5a3a00');
    drawText('CASH ' + cash, W / 2, 18, '#57c062', 1, 'center');
    ['UPGRADES', 'STYLE'].forEach((t, i) => {
      const cx = i ? 96 : 32;
      drawText(t, cx, 27, i === shopTab ? '#ffffff' : '#777777', 1, 'center');
      if (i === shopTab) {
        ctx.fillStyle = '#ffd34d';
        ctx.fillRect(cx - textWidth(t) / 2, 33, textWidth(t), 1);
      }
    });

    const items = shopItems();
    items.forEach((it, i) => {
      const y = 38 + i * 9;
      if (i === shopSel) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(1, y - 2, W - 2, 9);
        drawText('>', 2, y, '#ffd34d');
      }
      let right, rightColor;
      if (shopTab === 0) {
        const l = lvl(it.id);
        for (let k = 0; k < it.prices.length; k++) {
          ctx.fillStyle = k < l ? '#57c062' : '#444444';
          ctx.fillRect(62 + k * 4, y + 1, 3, 3);
        }
        if (l >= it.prices.length) { right = 'MAX'; rightColor = '#57c062'; }
        else { right = String(it.prices[l]); rightColor = cash >= it.prices[l] ? '#ffd34d' : '#aa5555'; }
      } else if (equipped[it.slot] === it.id) { right = 'ON'; rightColor = '#57c062'; }
      else if (owned.includes(it.id)) { right = 'OWNED'; rightColor = '#aaaaaa'; }
      else { right = String(it.price); rightColor = cash >= it.price ? '#ffd34d' : '#aa5555'; }
      drawText(it.name, 7, y, '#ffffff');
      drawText(right, W - 2, y, rightColor, 1, 'right');
    });

    const sel = items[shopSel];
    if (shopMsg) drawText(shopMsg.text, W / 2, 124, shopMsg.color, 1, 'center');
    else drawText(sel.desc, W / 2, 124, '#cfcfcf', 1, 'center');

    // Preview: your current look, trying on the selected style item.
    const look = { decal: equipped.decal, glow: equipped.glow, trail: equipped.trail };
    if (shopTab === 1) look[sel.slot] = sel.id;
    const px = W / 2 - 10, py = 136;
    const glow = COSMETICS.find((c) => c.id === look.glow);
    if (glow) drawGlow(glow, px, py, 2);
    if (look.trail) {
      for (let i = 0; i < 6; i++) {
        const c = look.trail === 'rainbow' ? 'hsl(' + Math.floor((time * 300 + i * 40) % 360) + ',100%,60%)'
          : look.trail === 'fire' ? ['#fff3a0', '#ffb000', '#ff6a00', '#d02000', '#d02000', '#555555'][i]
            : (Math.floor(time * 10) + i) % 2 ? '#ffffff' : '#9fd0ff';
        ctx.fillStyle = c;
        ctx.fillRect(px + 8 + (look.trail === 'sparkle' ? rand(-4, 4) : 0), py + 33 + i * 2, 4, 2);
      }
    }
    ctx.drawImage(vehicleSprite('car', paint().color, undefined, false, false, look.decal), px, py, 20, 32);

    drawText(isTouch ? 'GAS/BRK PICK  ARROWS: TAB' : 'UP/DOWN PICK  LEFT/RIGHT TAB', W / 2, 176, '#aaaaaa', 1, 'center');
    drawText(isTouch ? 'TAP: BUY   B: BACK' : 'ENTER: BUY/EQUIP   ESC: BACK', W / 2, 184, '#aaaaaa', 1, 'center');
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
    else if (state === 'shop') {
      drawShop();
      drawPopups();
    } else {
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
