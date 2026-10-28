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

OMJ.SWORDS = [
  { id: 'wood', name: 'Wooden Sword', price: 0, damage: 1, range: 14, cut: 1,
    blade: '#c9843e', edge: '#e8a95c', hilt: '#6b4220', power: 'spinSlash' },
  { id: 'iron', name: 'Iron Sword', price: 150, damage: 2, range: 16, cut: 2,
    blade: '#a3acb9', edge: '#ffffff', hilt: '#4a3a2a', power: 'swordBeam' },
  { id: 'flame', name: 'Flame Blade', price: 400, damage: 2, range: 18, cut: 2,
    blade: '#ff8a3d', edge: '#ffd23f', hilt: '#2a2540', power: 'fireWave' },
  { id: 'thunder', name: 'Thunder Sword', price: 800, damage: 3, range: 18, cut: 2,
    blade: '#7bd6ff', edge: '#ffffff', hilt: '#3a3a4e', power: 'thunderstorm' },
  { id: 'hero', name: 'Hero Sword', price: 1500, damage: 4, range: 20, cut: 2,
    blade: '#ffd23f', edge: '#fff2a8', hilt: '#3b8bff', power: 'heroShield' },
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
  draw(ctx, g) {
    const p = g.player;
    if (!p.dead) this.drawSword(ctx, p, g.time);
    this.drawShots(ctx, g.time);
    this.drawStrikes(ctx, g.time);
  }

  // The sword held in the hand. Angles: -90 = straight up, 0 = forward.
  drawSword(ctx, p, time) {
    const sw = this.sword;
    let angle = -60;
    if (this.spinTimer > 0) {
      angle = (time * 1800) % 360;
    } else if (this.swingTimer > 0) {
      const t = 1 - this.swingTimer / this.SWING_TIME;  // 0 -> 1 through the swing
      angle = -110 + 160 * t;
    }
    const hx = Math.round(p.x + 9);
    const hy = Math.round(p.y + 8);
    const a = (angle * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const length = 8;
    // Slash trail during a swing
    if (this.swingTimer > 0 || this.spinTimer > 0) {
      ctx.fillStyle = sw.edge;
      ctx.globalAlpha = 0.6;
      const from = this.spinTimer > 0 ? angle - 160 : -110;
      for (let d = from; d < angle; d += 8) {
        const r = (d * Math.PI) / 180;
        ctx.fillRect(Math.round(hx + Math.cos(r) * (length + 2)), Math.round(hy + Math.sin(r) * (length + 2)), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    // Handle behind the hand
    ctx.fillStyle = sw.hilt;
    ctx.fillRect(Math.round(hx - ca * 2), Math.round(hy - sa * 2), 2, 2);
    // Blade with an outline, then the bright edge
    for (let i = 1; i <= length; i++) {
      ctx.fillStyle = OMJ.PALETTE.ink;
      ctx.fillRect(Math.round(hx + ca * i) - 1, Math.round(hy + sa * i) - 1, 3, 3);
    }
    for (let i = 1; i <= length; i++) {
      ctx.fillStyle = i > length / 2 ? sw.edge : sw.blade;
      ctx.fillRect(Math.round(hx + ca * i), Math.round(hy + sa * i), 1, 1);
    }
    // Crossguard
    ctx.fillStyle = sw.hilt;
    ctx.fillRect(Math.round(hx + ca - sa * 2), Math.round(hy + sa + ca * 2), 1, 1);
    ctx.fillRect(Math.round(hx + ca + sa * 2), Math.round(hy + sa - ca * 2), 1, 1);
    ctx.fillRect(Math.round(hx + ca), Math.round(hy + sa), 1, 1);
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

// ---- Little pictures for the shop ----------------------------
OMJ.GearArt = {
  drawSwordIcon(canvas, sword) {
    canvas.width = 16;
    canvas.height = 16;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 16, 16);
    for (let i = 0; i < 10; i++) {               // diagonal blade, bottom-left to top-right
      c.fillStyle = OMJ.PALETTE.ink;
      c.fillRect(3 + i, 11 - i, 3, 3);
    }
    for (let i = 0; i < 10; i++) {
      c.fillStyle = i > 4 ? sword.edge : sword.blade;
      c.fillRect(4 + i, 12 - i, 1, 1);
    }
    c.fillStyle = sword.hilt;                     // crossguard and handle
    c.fillRect(2, 10, 5, 2);
    c.fillRect(4, 8, 2, 5);
    c.fillRect(1, 13, 2, 2);
  },

  drawScarfIcon(canvas, scarf, time) {
    canvas.width = 16;
    canvas.height = 16;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 16, 16);
    const color = scarf.rainbow ? 'hsl(' + Math.floor((time || 0) * 120) % 360 + ', 90%, 62%)' : scarf.color;
    c.fillStyle = OMJ.PALETTE.ink;
    c.fillRect(2, 4, 12, 5);
    c.fillRect(9, 8, 5, 6);
    c.fillStyle = color;
    c.fillRect(3, 5, 10, 3);
    c.fillRect(10, 8, 3, 5);
    c.fillStyle = OMJ.PALETTE.white;
    c.globalAlpha = 0.4;
    c.fillRect(3, 5, 10, 1);
    c.globalAlpha = 1;
  },
};
