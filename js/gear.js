// =============================================================
// gear.js — Swords and scarves (bought in the shop with coins).
//
// SWORD  (F to swing, Q for its power)
//   A swing cuts things in front of you if the sword is strong enough
//   (each obstacle type has a `toughness`; the sword cuts if
//   `cut` >= toughness). Barriers, saws, crushers and pits have no
//   toughness, so a swing can never cut them: you jump those.
//   Swinging at a boss bomb or fireball knocks it back into the boss.
//
// SCARF  (E for its power)
//   Every skin wears the same Blue Scarf at first. Others are in the shop.
//
// To add a sword or scarf, copy an entry below. Its `power` is the name
// of an ability in OMJ.GEAR_ABILITIES (same format as abilities.js).
// =============================================================

// Colors: edge = bright side of the blade, blade = middle, dark = shadow
// side, guard = crossguard, gem = the jewel in it, grip = handle wrap,
// pommel = the knob on the end. `hilt` is used for small effects.
OMJ.SWORDS = [
  { id: 'wood', name: 'Wooden Sword', price: 0, damage: 1, range: 16, cut: 1,
    edge: '#e8a95c', blade: '#c9843e', dark: '#8a5424', guard: '#6b4220', gem: '#8a5424',
    grip: '#4a2c15', pommel: '#6b4220', hilt: '#6b4220', power: 'spinSlash' },
  { id: 'iron', name: 'Iron Sword', price: 150, damage: 2, range: 17, cut: 2,
    edge: '#ffffff', blade: '#a3acb9', dark: '#6e7886', guard: '#4a525e', gem: '#7bd6ff',
    grip: '#6b4220', pommel: '#6e7886', hilt: '#4a3a2a', power: 'swordBeam' },
  { id: 'flame', name: 'Flame Blade', price: 400, damage: 2, range: 18, cut: 2,
    edge: '#ffd23f', blade: '#ff8a3d', dark: '#c2412b', guard: '#2a2540', gem: '#e8384f',
    grip: '#1d1a2f', pommel: '#2a2540', hilt: '#2a2540', power: 'fireWave' },
  { id: 'thunder', name: 'Thunder Sword', price: 800, damage: 3, range: 18, cut: 2,
    edge: '#ffffff', blade: '#7bd6ff', dark: '#3b8bff', guard: '#3a3a4e', gem: '#ffd23f',
    grip: '#22222e', pommel: '#3a3a4e', hilt: '#3a3a4e', power: 'thunderstorm' },
  { id: 'hero', name: 'Hero Sword', price: 1500, damage: 4, range: 20, cut: 2,
    edge: '#ffffff', blade: '#c8ccd8', dark: '#7d8299', guard: '#ffd23f', gem: '#3b8bff',
    grip: '#3b8bff', pommel: '#ffd23f', hilt: '#3b8bff', power: 'heroShield' },
];

OMJ.SCARVES = [
  { id: 'blue', name: 'Blue Scarf', price: 0, color: '#3b8bff', power: 'float' },
  { id: 'green', name: 'Green Scarf', price: 150, color: '#5fe0a0', power: 'vacuum' },
  { id: 'purple', name: 'Purple Scarf', price: 400, color: '#b45cff', power: 'timeFreeze' },
  { id: 'red', name: 'Red Scarf', price: 700, color: '#e8384f', power: 'coinRush' },
  { id: 'gold', name: 'Gold Scarf', price: 1200, color: '#ffd23f', power: 'luckyCharm' },
  { id: 'rainbow', name: 'Rainbow Scarf', price: 2000, color: '#ff4fd8', rainbow: true, power: 'prism' },
];

OMJ.getSword = function (id) {
  for (let i = 0; i < OMJ.SWORDS.length; i++) if (OMJ.SWORDS[i].id === id) return OMJ.SWORDS[i];
  return OMJ.SWORDS[0];
};
OMJ.getScarf = function (id) {
  for (let i = 0; i < OMJ.SCARVES.length; i++) if (OMJ.SCARVES[i].id === id) return OMJ.SCARVES[i];
  return OMJ.SCARVES[0];
};

// ---- Sword (Q) and scarf (E) powers -------------------------
OMJ.GEAR_ABILITIES = {
  // Swords
  spinSlash: {
    name: 'Spin Slash', desc: 'Whirl your sword, cutting all around you', cooldown: 7, duration: 0.4,
    activate(g) { g.sword.startSpin(0.4); g.sound.play('swing'); },
  },
  swordBeam: {
    name: 'Sword Beam', desc: 'Fire a slicing beam that cuts the next thing', cooldown: 5, duration: 0,
    activate(g) { g.sword.fire('beam', g); g.sound.play('beam'); },
  },
  fireWave: {
    name: 'Fire Wave', desc: 'A wall of fire burns through 3 obstacles', cooldown: 12, duration: 0,
    activate(g) { g.sword.fire('fire', g); g.sound.play('fireWave'); },
  },
  thunderstorm: {
    name: 'Thunderstorm', desc: 'Lightning strikes everything on screen', cooldown: 20, duration: 0,
    activate(g) { g.sword.thunderstorm(g); g.sound.play('thunder'); },
  },
  heroShield: {
    name: 'Hero Shield', desc: '3 seconds of glowing armor that smashes all', cooldown: 18, duration: 3,
    activate(g, a) { a.giveInvulnerability(3); g.sound.play('shield'); },
  },

  // Scarves
  float: {
    name: 'Float', desc: 'Drift down slowly for 1.5 seconds', cooldown: 8, duration: 1.5,
    activate(g) { g.sound.play('float'); },
  },
  vacuum: {
    name: 'Coin Vacuum', desc: 'Pull in every coin on screen', cooldown: 10, duration: 0,
    activate(g) { g.coins.pullAll(); g.sound.play('vacuum'); },
  },
  timeFreeze: {
    name: 'Time Freeze', desc: 'Saws, crushers, crossbows and bosses freeze for 3 s', cooldown: 16, duration: 3,
    activate(g) { g.sound.play('freeze'); },
  },
  coinRush: {
    name: 'Coin Rush', desc: 'Turn everything on screen into coins', cooldown: 25, duration: 0,
    activate(g) { g.coinRush(); g.sound.play('coinRush'); },
  },
  luckyCharm: {
    name: 'Lucky Charm', desc: 'Coins are worth triple for 8 seconds', cooldown: 20, duration: 8,
    activate(g) { g.sound.play('boostReady'); },
  },
  prism: {
    name: 'Prism', desc: 'Instantly recharge all your other powers', cooldown: 30, duration: 0,
    activate(g, a) {
      a.refresh('skin'); a.refresh('sword'); a.refresh('bonus');
      g.sound.play('boostPick');
    },
  },
};

// A boss attack you hit back with your sword becomes one of these:
// harmless to you, and it flies into the boss.
OMJ.REFLECTED = {
  harmless: true,
  debris: [OMJ.PALETTE.white, OMJ.PALETTE.gold],
  deathLines: [''],
  update(o, dt, g, speed) {
    o.x += (speed + 420) * dt;               // fly right, against the scrolling
    const targetY = g.boss.y + 30;
    o.y += OMJ.clamp(targetY - o.y, -260 * dt, 260 * dt);
    if (Math.random() < 0.5) g.particles.spawn(o.x, o.y + 3, -60, OMJ.rand(-20, 20), 0.2, 1, OMJ.PALETTE.white, 0);
    if (g.boss.fighting && o.x >= g.boss.leftEdge) {
      g.boss.hit(o.extra, g);
      o.active = false;
    } else if (o.x > OMJ.CONFIG.VIEW_W + 10) {
      o.active = false;
    }
  },
  draw(ctx, o, g) { o.origType.draw(ctx, o, g); },
};

// ---- The sword in your hands ---------------------------------
OMJ.SwordSystem = class {
  constructor() {
    this.SWING_TIME = 0.2;     // how long a swing can hit things
    this.SWING_COOLDOWN = 0.45;
    this.shots = [];           // beams and fire waves (fixed pool)
    for (let i = 0; i < 4; i++) this.shots.push({ active: false, kind: '', x: 0, y: 0, hits: 0, age: 0 });
    this.strikes = [];         // lightning bolts, just for drawing
    for (let i = 0; i < 12; i++) this.strikes.push({ life: 0, x: 0, y: 0 });
    this.reset(OMJ.SWORDS[0]);
  }

  reset(sword) {
    this.sword = sword;
    this.swingTimer = 0;
    this.cooldown = 0;
    this.spinTimer = 0;
    for (let i = 0; i < this.shots.length; i++) this.shots[i].active = false;
    for (let i = 0; i < this.strikes.length; i++) this.strikes[i].life = 0;
  }

  damage(g) { return this.sword.damage + g.mods.swordDamage; }

  swing(g) {
    if (this.cooldown > 0 || g.player.dead) return;
    this.swingTimer = this.SWING_TIME;
    this.cooldown = this.SWING_COOLDOWN;
    g.sound.play('swing');
  }

  startSpin(seconds) { this.spinTimer = seconds; }

  fire(kind, g) {
    const p = g.player;
    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i];
      if (s.active) continue;
      s.active = true;
      s.kind = kind;
      s.x = p.x + p.w;
      s.y = kind === 'fire' ? OMJ.CONFIG.GROUND_Y - 6 : p.y + 6;
      s.hits = kind === 'fire' ? 3 : 1;
      s.age = 0;
      return;
    }
  }

  thunderstorm(g) {
    const pool = g.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || o.type.isGap || o.type.harmless || o.x > OMJ.CONFIG.VIEW_W) continue;
      this.addStrike(o.x + o.bx + o.bw / 2, o.y + o.h);
      g.smash(o);
    }
    if (g.boss.fighting) {
      this.addStrike(g.boss.x, g.boss.y + 20);
      g.boss.hit(3, g);
    }
    g.flash = 0.12;
    g.shake = Math.max(g.shake, 3);
  }

  addStrike(x, y) {
    for (let i = 0; i < this.strikes.length; i++) {
      const s = this.strikes[i];
      if (s.life > 0) continue;
      s.life = 0.3; s.x = x; s.y = y;
      return;
    }
  }

  update(dt, g) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.swingTimer > 0) this.swingTimer -= dt;
    if (this.spinTimer > 0) this.spinTimer -= dt;
    for (let i = 0; i < this.strikes.length; i++) if (this.strikes[i].life > 0) this.strikes[i].life -= dt;

    const p = g.player;
    if (this.spinTimer > 0) {
      this.hitZone(g, p.x - 20, p.x + p.w + 22, p.y - 14, p.bottom + 4);
    } else if (this.swingTimer > 0) {
      this.hitZone(g, p.x + p.w - 2, p.x + p.w + this.sword.range, p.y - 8, p.bottom + 2);
    }
    this.updateShots(dt, g);
  }

  // Cut or knock back everything inside this box.
  hitZone(g, x1, x2, y1, y2) {
    const pool = g.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || o.type.isGap || o.type.harmless) continue;
      const left = o.x + o.bx;
      if (left > x2 || left + o.bw < x1 || o.y > y2 || o.y + o.h < y1) continue;
      if (o.type.reflectable) {
        g.reflect(o, this.damage(g));
      } else if (o.type.toughness && o.type.toughness <= this.sword.cut) {
        g.cut(o);
      }
    }
  }

  updateShots(dt, g) {
    const C = OMJ.CONFIG;
    const pool = g.obstacles.pool;
    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i];
      if (!s.active) continue;
      s.age += dt;
      s.x += 360 * dt;
      if (s.kind === 'fire' && Math.random() < 0.7) {
        g.particles.spawn(s.x + OMJ.rand(-4, 4), C.GROUND_Y - OMJ.rand(2, 12), OMJ.rand(-40, 0), OMJ.rand(-60, -20), 0.3, OMJ.randInt(1, 2),
          Math.random() < 0.5 ? OMJ.PALETTE.gold : '#ff8a3d', -40);
      }
      if (g.boss.fighting && s.x >= g.boss.leftEdge) {
        g.boss.hit(s.kind === 'fire' ? 3 : this.damage(g), g);
        s.active = false;
        continue;
      }
      if (s.x > C.VIEW_W + 10) { s.active = false; continue; }
      for (let j = 0; j < pool.length && s.active; j++) {
        const o = pool[j];
        if (!o.active || o.type.isGap || o.type.harmless) continue;
        const left = o.x + o.bx;
        const top = s.kind === 'fire' ? C.GROUND_Y - 14 : s.y - 5;
        const bottom = s.kind === 'fire' ? C.GROUND_Y : s.y + 5;
        if (s.x + 4 < left || s.x - 4 > left + o.bw || bottom < o.y || top > o.y + o.h) continue;
        // The beam only cuts what the sword could cut; fire burns anything.
        if (s.kind === 'beam' && !(o.type.reflectable || (o.type.toughness && o.type.toughness <= 2))) {
          s.active = false;              // it bounces off tough things
          break;
        }
        g.smash(o);
        if (--s.hits <= 0) s.active = false;
      }
    }
  }

  // ---- Drawing ----
  // Angles for the sword: 0 = pointing straight up, 90 = pointing forward.
  swordAngle(p, time) {
    if (this.spinTimer > 0) return (time * 1440) % 360;
    if (this.swingTimer > 0) {
      // A big heave over the top: hauled back behind your head, then
      // brought down in front.
      const t = 1 - this.swingTimer / this.SWING_TIME;
      return -40 + 170 * (1 - (1 - t) * (1 - t));     // fast start, heavy finish
    }
    // Held up in front of you, wobbling as you run (it's heavy!).
    const wobble = p.grounded ? (Math.floor(p.runTime * 12) % 2 ? 6 : 0) : -8;
    return 18 + wobble;
  }

  // Where your little fist holds the sword.
  gripX(p) { return Math.round(p.x + 10); }
  gripY(p) { return Math.round(p.y + 9); }

  // Drawn after the player: the sword, your fist, shots and lightning.
  draw(ctx, g) {
    const p = g.player;
    if (!p.dead) {
      const swinging = this.swingTimer > 0 || this.spinTimer > 0;
      const angle = this.swordAngle(p, g.time);
      const hx = this.gripX(p);
      const hy = this.gripY(p);
      if (swinging) this.drawTrail(ctx, angle, hx, hy);
      OMJ.SwordArt.draw(ctx, this.sword, angle, hx, hy);
      // The little fist wrapped around the handle
      ctx.fillStyle = OMJ.PALETTE.ink;
      ctx.fillRect(hx - 1, hy - 1, 3, 3);
      ctx.fillStyle = g.skin.body;
      ctx.fillRect(hx, hy, 1, 1);
    }
    this.drawShots(ctx, g.time);
    this.drawStrikes(ctx, g.time);
  }

  // A pale crescent following the tip of the sword during a swing.
  drawTrail(ctx, angle, hx, hy) {
    const from = this.spinTimer > 0 ? angle - 150 : -40;
    const reach = OMJ.SwordArt.LENGTH;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = this.sword.edge;
    for (let d = from; d < angle - 4; d += 6) {
      const r = (d * Math.PI) / 180;
      for (let k = reach - 4; k <= reach; k += 2) {
        ctx.fillRect(Math.round(hx + Math.sin(r) * k), Math.round(hy - Math.cos(r) * k), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawShots(ctx, time) {
    const C = OMJ.CONFIG;
    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i];
      if (!s.active) continue;
      const x = Math.round(s.x);
      if (s.kind === 'beam') {
        const y = Math.round(s.y);
        ctx.fillStyle = OMJ.PALETTE.ink;
        ctx.fillRect(x - 1, y - 5, 4, 11);
        ctx.fillStyle = this.sword.edge;
        ctx.fillRect(x, y - 4, 2, 9);
        ctx.fillRect(x + 2, y - 2, 1, 5);
        ctx.fillStyle = this.sword.blade;
        ctx.fillRect(x - 3, y - 1, 3, 3);
      } else {
        const f = Math.floor(time * 16) % 2;
        ctx.fillStyle = OMJ.PALETTE.danger;
        ctx.fillRect(x - 4, C.GROUND_Y - 12 - f, 8, 12 + f);
        ctx.fillStyle = '#ff8a3d';
        ctx.fillRect(x - 3, C.GROUND_Y - 9 + f, 6, 9 - f);
        ctx.fillStyle = OMJ.PALETTE.gold;
        ctx.fillRect(x - 1, C.GROUND_Y - 5, 3, 5);
      }
    }
  }

  drawStrikes(ctx, time) {
    for (let i = 0; i < this.strikes.length; i++) {
      const s = this.strikes[i];
      if (s.life <= 0) continue;
      // A jagged bolt from the sky
      let x = Math.round(s.x);
      for (let y = 0; y < s.y; y += 6) {
        const nx = x + ((Math.floor(y / 6) + Math.floor(time * 30)) % 3) - 1;
        ctx.fillStyle = OMJ.PALETTE.white;
        ctx.fillRect(nx, y, 2, 6);
        ctx.fillStyle = '#7bd6ff';
        ctx.fillRect(nx + 2, y, 1, 6);
        x = nx;
      }
    }
  }
};

// ---- Sword sprite --------------------------------------------
// The sword is drawn pointing up, then rotated in 32 steps ONCE (per
// sword) into little canvases. Rotating pixel by pixel this way keeps
// the pixels crisp, instead of the blur you'd get rotating on the fly.
// It's 21 px long; the runner is only 12 px tall. Too big? Exactly.
OMJ.SwordArt = (function () {
  const ROWS = [
    '...O...',   // tip
    '..OEO..',
    '.OEBDO.',
    '.OEBDO.',
    '.OEBDO.',
    '.OEBDO.',
    '.OEBDO.',
    '.OEBDO.',
    '.OEBDO.',
    '.OEBDO.',
    '.OEBDO.',
    '.OEBDO.',
    '.OEBDO.',
    'OOOOOOO',   // crossguard
    'OGGJGGO',
    'OOOOOOO',
    '..OHO..',   // handle (you hold it here)
    '..OhO..',
    '..OHO..',
    '.OPPPO.',   // pommel
    '..OOO..',
  ];
  const PIVOT_X = 3;
  const PIVOT_Y = 17;
  const STEPS = 32;
  const R = 19;                 // frames are (2R+1) square, pivot in the middle
  const cache = {};

  function shade(hex, amount) {   // darken (amount < 0) or lighten a color
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }

  function build(sword) {
    const pal = {
      O: OMJ.PALETTE.ink, E: sword.edge, B: sword.blade, D: sword.dark,
      G: sword.guard, J: sword.gem, H: sword.grip, h: shade(sword.grip, 0.15), P: sword.pommel,
    };
    const frames = [];
    for (let i = 0; i < STEPS; i++) {
      const a = (i / STEPS) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = R * 2 + 1;
      const c = canvas.getContext('2d');
      for (let v = -R; v <= R; v++) {
        for (let u = -R; u <= R; u++) {
          // Which sprite pixel lands on output pixel (u, v)?
          const sx = Math.round(u * ca + v * sa) + PIVOT_X;
          const sy = Math.round(-u * sa + v * ca) + PIVOT_Y;
          if (sy < 0 || sy >= ROWS.length || sx < 0 || sx >= ROWS[0].length) continue;
          const color = pal[ROWS[sy][sx]];
          if (!color) continue;
          c.fillStyle = color;
          c.fillRect(u + R, v + R, 1, 1);
        }
      }
      frames.push(canvas);
    }
    return frames;
  }

  function frames(sword) {
    if (!cache[sword.id]) cache[sword.id] = build(sword);
    return cache[sword.id];
  }

  // Draw `sword` at `angle` degrees (0 = up, 90 = forward) with its
  // handle at (x, y).
  function draw(ctx, sword, angle, x, y) {
    const list = frames(sword);
    const i = ((Math.round((angle / 360) * STEPS) % STEPS) + STEPS) % STEPS;
    ctx.drawImage(list[i], x - R, y - R);
  }

  return { draw, frames, shade, LENGTH: PIVOT_Y, SIZE: R * 2 + 1 };
})();

// ---- Little pictures for the shop ----------------------------
OMJ.GearArt = {
  // The sword, tilted like it's leaning in a display rack.
  drawSwordIcon(canvas, sword) {
    const size = 24;
    canvas.width = canvas.height = size;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, size, size);
    // 45 degrees, handle at the bottom-left
    OMJ.SwordArt.draw(c, sword, 45, 6, 18);
  },

  // A knitted scarf: a loop with two tails, stripes and fringe.
  //   O outline, C main color, S shade, L light stripe, F fringe
  SCARF: [
    '...OOOOOOOOOOOOOO...',
    '..OLLLLLLLLLLLLLLO..',
    '.OCCCCCCCCCCCCCCCCO.',
    '.OCSOOOOOOOOOOOOSCO.',
    '.OCSO..........OSCO.',
    '.OCCO..........OCCO.',
    '.OSCCO........OCCSO.',
    '..OSCCOOOOOOOOCCSO..',
    '...OSSCCCCCCCCSSO...',
    '....OOOSCCCCSOOO....',
    '......OCCCOCCCO.....',
    '......OLLLOLLLO.....',
    '......OCCCOCCCO.....',
    '......OCCCOCCCO.....',
    '......OLLLOLLLO.....',
    '......OCCCOCCCO.....',
    '......OSSSOSSSO.....',
    '......OOOOOOOOO.....',
    '......F.F.F.F.F.....',
    '......F.F...F.F.....',
  ],

  drawScarfIcon(canvas, scarf, time) {
    const rows = this.SCARF;
    canvas.width = canvas.height = 24;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 24, 24);
    const ox = 2;
    const oy = 2;
    for (let y = 0; y < rows.length; y++) {
      // The Rainbow Scarf gets a different color on every row.
      const main = scarf.rainbow ? 'hsl(' + Math.floor((y * 24 + (time || 0) * 120) % 360) + ', 85%, 60%)' : scarf.color;
      const pal = {
        O: OMJ.PALETTE.ink,
        C: main,
        S: scarf.rainbow ? main : OMJ.SwordArt.shade(scarf.color, -0.22),
        L: scarf.rainbow ? OMJ.PALETTE.white : OMJ.SwordArt.shade(scarf.color, 0.2),
        F: scarf.rainbow ? main : OMJ.SwordArt.shade(scarf.color, -0.1),
      };
      for (let x = 0; x < rows[y].length; x++) {
        const color = pal[rows[y][x]];
        if (!color) continue;
        c.fillStyle = color;
        c.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  },
};
