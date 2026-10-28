// =============================================================
// background.js — Parallax sky, mountains, hills, town and ground.
//
// Each layer is drawn ONCE into an off-screen canvas when the game
// loads, then simply slid sideways every frame (very fast).
// Layers further away move slower — that's the "parallax" effect.
//
// The sky changes theme every THEME_EVERY points (day -> sunset ->
// night -> ...). Add a theme by adding an entry to THEMES.
// =============================================================

(function () {
  const C = OMJ.CONFIG;
  const P = OMJ.PALETTE;
  const W = C.VIEW_W;
  const H = C.VIEW_H;
  const HORIZON = C.GROUND_Y;
  const THEME_EVERY = 500;
  const FADE_TIME = 2; // seconds for the sky to blend into the next theme

  const THEMES = [
    { name: 'day',
      sky: ['#5ab4f0', '#76c4f5', '#94d3f8', '#b6e2fa', '#d8f0fc'],
      sun: { x: 300, y: 44, r: 11, color: '#fff3b0', glow: '#ffe98a' },
      cloud: '#ffffff', cloudShade: '#d4e8f8',
      far: '#8aa9d6', farLight: '#a9c2e6', snow: '#f2f7ff',
      mid: '#5fb06a', midLight: '#7fcc7a', midDark: '#3f8f50',
      near: '#3d7a5a', nearLight: '#55977a', windows: '#8fc2a8',
      groundTint: 0 },
    { name: 'sunset',
      sky: ['#3a1f5c', '#6b2d6b', '#b0446e', '#e8705e', '#ffae6b'],
      sun: { x: 250, y: 150, r: 18, color: '#ffe08a', glow: '#ffbf6b' },
      cloud: '#ffb3a0', cloudShade: '#d97a8a',
      far: '#7a3a6e', farLight: '#9a4e80', snow: '#e8a0b0',
      mid: '#8a3f5c', midLight: '#a8526c', midDark: '#5e2a48',
      near: '#4a2240', nearLight: '#64305a', windows: '#ffc36b',
      groundTint: 0.15 },
    { name: 'night',
      sky: ['#0b0f2b', '#121842', '#1a2254', '#232d66', '#2e3a78'],
      sun: { x: 310, y: 40, r: 8, color: '#f4f1d0', glow: '#b8b8a0', moon: true },
      cloud: '#3a4380', cloudShade: '#2a3266',
      far: '#232a5c', farLight: '#2f3870', snow: '#5a6496',
      mid: '#1b2148', midLight: '#262e5c', midDark: '#121733',
      near: '#111533', nearLight: '#1b2148', windows: '#ffd86b',
      groundTint: 0.35, stars: true },
  ];

  // ---- Layer painters ----------------------------------------
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // A smooth wavy line that repeats perfectly every W pixels,
  // so the layer can scroll forever without a visible seam.
  function wave(x, parts) {
    let y = 0;
    for (let i = 0; i < parts.length; i += 3) {
      y += parts[i] * Math.sin((Math.PI * 2 * parts[i + 1] * x) / W + parts[i + 2]);
    }
    return y;
  }

  function paintSky(t) {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const bands = t.sky;
    const bandH = Math.ceil(HORIZON / bands.length);
    for (let i = 0; i < bands.length; i++) {
      ctx.fillStyle = bands[i];
      ctx.fillRect(0, i * bandH, W, bandH);
      // Checkerboard "dither" rows blend each band into the next one.
      if (i < bands.length - 1) {
        ctx.fillStyle = bands[i + 1];
        const y = (i + 1) * bandH - 2;
        for (let x = 0; x < W; x += 2) {
          ctx.fillRect(x, y, 1, 1);
          ctx.fillRect(x + 1, y + 1, 1, 1);
        }
      }
    }
    if (t.stars) {
      const rnd = OMJ.Sprites.seededRandom(7);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = rnd() < 0.3 ? '#ffe9a8' : '#cfd6ff';
        ctx.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * (HORIZON - 60)), 1, 1);
      }
    }
    const s = t.sun;
    OMJ.Sprites.circle(ctx, s.x, s.y, s.r + 3, s.glow);
    OMJ.Sprites.circle(ctx, s.x, s.y, s.r, s.color);
    if (s.moon) {
      ctx.fillStyle = s.glow;
      ctx.fillRect(s.x - 3, s.y - 2, 2, 2);
      ctx.fillRect(s.x + 2, s.y + 2, 3, 2);
      ctx.fillRect(s.x - 1, s.y + 4, 1, 1);
    }
    return c;
  }

  function paintClouds(t) {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const rnd = OMJ.Sprites.seededRandom(42);
    for (let i = 0; i < 6; i++) {
      const cx = Math.floor((i / 6) * W + rnd() * 40);
      const cy = Math.floor(18 + rnd() * 60);
      const size = 4 + Math.floor(rnd() * 4);
      for (let copy = -1; copy <= 0; copy++) {   // draw twice so it wraps
        const x = cx + copy * W;
        OMJ.Sprites.circle(ctx, x, cy, size, t.cloud);
        OMJ.Sprites.circle(ctx, x + size + 2, cy + 1, size - 1, t.cloud);
        OMJ.Sprites.circle(ctx, x - size - 1, cy + 2, size - 2, t.cloud);
        ctx.fillStyle = t.cloudShade;
        ctx.fillRect(x - size * 2, cy + size - 1, size * 4 + 2, 2);
      }
    }
    return c;
  }

  function paintMountains(t) {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    for (let x = 0; x < W; x++) {
      let h = 62 + wave(x, [18, 1, 0.5, 12, 3, 1.3, 6, 7, 2.1]);
      h = Math.round(h / 2) * 2;                 // stepped = chunkier pixels
      const top = HORIZON - h;
      ctx.fillStyle = t.far;
      ctx.fillRect(x, top, 1, h);
      ctx.fillStyle = t.farLight;
      ctx.fillRect(x, top, 1, 1);
      if (h > 78) {                              // snowy peaks
        ctx.fillStyle = t.snow;
        ctx.fillRect(x, top, 1, Math.min(4, h - 78));
      }
    }
    return c;
  }

  function paintHills(t) {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const heights = [];
    for (let x = 0; x < W; x++) {
      const h = Math.round(30 + wave(x, [8, 2, 0, 5, 5, 1]));
      heights.push(h);
      ctx.fillStyle = t.mid;
      ctx.fillRect(x, HORIZON - h, 1, h);
      ctx.fillStyle = t.midLight;
      ctx.fillRect(x, HORIZON - h, 1, 2);
    }
    // Little round trees dotted on the hills
    const rnd = OMJ.Sprites.seededRandom(9);
    for (let i = 0; i < 14; i++) {
      const tx = Math.floor(rnd() * W);
      const ty = HORIZON - heights[tx] + 1;
      for (let copy = -1; copy <= 1; copy++) {
        const x = tx + copy * W;
        ctx.fillStyle = t.midDark;
        ctx.fillRect(x, ty - 2, 1, 3);
        OMJ.Sprites.circle(ctx, x, ty - 5, 3, t.midDark);
      }
    }
    return c;
  }

  function paintTown(t) {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const rnd = OMJ.Sprites.seededRandom(1234);
    let x = 0;
    while (x < W - 10) {
      const isHouse = rnd() < 0.55;
      if (isHouse) {
        const w = 12 + Math.floor(rnd() * 14);
        const h = 14 + Math.floor(rnd() * 26);
        const windowSeed = rnd();
        for (let copy = -1; copy <= 1; copy++) {
          const bx = x + copy * W;
          ctx.fillStyle = t.near;
          ctx.fillRect(bx, HORIZON - h, w, h);
          ctx.fillStyle = t.nearLight;
          ctx.fillRect(bx, HORIZON - h, w, 1);
          // Windows: same pattern every time thanks to the seed.
          const wr = OMJ.Sprites.seededRandom(Math.floor(windowSeed * 99999));
          ctx.fillStyle = t.windows;
          for (let wy = HORIZON - h + 3; wy < HORIZON - 4; wy += 5) {
            for (let wx = bx + 2; wx < bx + w - 2; wx += 4) {
              if (wr() < 0.6) ctx.fillRect(wx, wy, 2, 2);
            }
          }
        }
        x += w + 1 + Math.floor(rnd() * 6);
      } else {
        const r = 4 + Math.floor(rnd() * 4);
        for (let copy = -1; copy <= 1; copy++) {
          const tx = x + r + copy * W;
          ctx.fillStyle = t.near;
          ctx.fillRect(tx - 1, HORIZON - r - 3, 2, r + 3);
          OMJ.Sprites.circle(ctx, tx, HORIZON - r - 5, r, t.near);
          ctx.fillStyle = t.nearLight;
          ctx.fillRect(tx - 2, HORIZON - r * 2 - 4, 3, 1);
        }
        x += r * 2 + 2 + Math.floor(rnd() * 8);
      }
    }
    return c;
  }

  function paintGroundTile() {
    const tileW = 32;
    const tileH = H - HORIZON;
    const c = makeCanvas(tileW, tileH);
    const ctx = c.getContext('2d');
    ctx.fillStyle = P.dirt;
    ctx.fillRect(0, 0, tileW, tileH);
    ctx.fillStyle = P.grass;
    ctx.fillRect(0, 0, tileW, 4);
    ctx.fillStyle = P.grassLight;
    ctx.fillRect(0, 0, tileW, 1);
    ctx.fillStyle = P.grassDark;
    for (let x = 0; x < tileW; x += 4) ctx.fillRect(x + (x % 8 ? 1 : 0), 4, 2, 1);
    ctx.fillRect(0, 5, tileW, 1);
    ctx.fillStyle = P.dirtDark;
    ctx.fillRect(0, 14, tileW, 1);
    const rnd = OMJ.Sprites.seededRandom(5);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = rnd() < 0.5 ? P.dirtDark : P.dirtLight;
      ctx.fillRect(Math.floor(rnd() * (tileW - 2)), 7 + Math.floor(rnd() * (tileH - 9)), 2, 1);
    }
    return c;
  }

  // ---- The Background object used by the game ----------------
  OMJ.Background = class {
    constructor() {
      // [canvas, parallax factor] per layer, for every theme
      this.themes = THEMES.map((t) => ({
        tint: t.groundTint,
        layers: [
          [paintSky(t), 0],
          [paintClouds(t), 0.06],
          [paintMountains(t), 0.12],
          [paintHills(t), 0.3],
          [paintTown(t), 0.55],
        ],
      }));
      this.groundTile = paintGroundTile();
      this.reset();
    }

    reset() {
      this.distance = 0;     // how far the world has scrolled
      this.cloudDrift = 0;   // clouds also drift slowly on their own
      this.current = 0;
      this.next = 0;
      this.fade = 0;
    }

    update(dt, speed, score) {
      this.distance += speed * dt;
      this.cloudDrift += 6 * dt;
      const wanted = Math.floor(score / THEME_EVERY) % this.themes.length;
      if (wanted !== this.current && this.fade === 0) {
        this.next = wanted;
        this.fade = 0.0001;
      }
      if (this.fade > 0) {
        this.fade += dt / FADE_TIME;
        if (this.fade >= 1) {
          this.current = this.next;
          this.fade = 0;
        }
      }
    }

    drawTheme(ctx, theme) {
      for (let i = 0; i < theme.layers.length; i++) {
        const layer = theme.layers[i];
        let offset = this.distance * layer[1];
        if (i === 1) offset += this.cloudDrift;
        offset = Math.floor(offset % W);
        ctx.drawImage(layer[0], -offset, 0);
        if (layer[1] > 0 || i === 1) ctx.drawImage(layer[0], W - offset, 0);
      }
    }

    draw(ctx) {
      this.drawTheme(ctx, this.themes[this.current]);
      if (this.fade > 0) {
        ctx.globalAlpha = this.fade;
        this.drawTheme(ctx, this.themes[this.next]);
        ctx.globalAlpha = 1;
      }
    }

    drawGround(ctx) {
      const tileW = this.groundTile.width;
      const offset = Math.floor(this.distance % tileW);
      for (let x = -offset; x < W; x += tileW) ctx.drawImage(this.groundTile, x, HORIZON);
    }

    // Darken the ground a little at sunset/night (drawn before obstacles,
    // so obstacles always stay bright and easy to see).
    drawGroundTint(ctx) {
      const a = OMJ.lerp(this.themes[this.current].tint, this.themes[this.next].tint, this.fade);
      if (a <= 0) return;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#0b0f2b';
      ctx.fillRect(0, HORIZON, W, H - HORIZON);
      ctx.globalAlpha = 1;
    }
  };
})();
