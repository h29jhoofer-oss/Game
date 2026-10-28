// =============================================================
// gear.js — Swords and scarves (bought in the shop with coins).
//
// SWORD  (SPACE or F to swing, Q for its power)
//   On the ground: a big OVERHEAD swing that hits above and in front.
//   In the air: a PLUNGE: you drop like a ground smash with the sword
//   pointing down, then slam the ground. It cuts one level tougher than
//   a normal swing (so even a Wooden Sword plunge breaks spikes).
//   Any swing or plunge defeats monsters (they have `enemy: true`).
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
// Spark colors when a sword drags along the ground.
OMJ.SPARK_COLORS = [OMJ.PALETTE.gold, OMJ.PALETTE.gold, OMJ.PALETTE.white];

OMJ.SWORDS = [
  { id: 'wood', name: 'Wooden Sword', price: 0, damage: 1, range: 16, cut: 1,
    edge: '#e8a95c', blade: '#c9843e', dark: '#8a5424', guard: '#6b4220', gem: '#8a5424',
    grip: '#4a2c15', pommel: '#6b4220', hilt: '#6b4220', power: 'spinSlash' },
  { id: 'iron', name: 'Iron Sword', price: 150, damage: 2, range: 17, cut: 2,
    edge: '#ffffff', blade: '#a3acb9', dark: '#6e7886', guard: '#4a525e', gem: '#7bd6ff',
    grip: '#6b4220', pommel: '#6e7886', hilt: '#4a3a2a', power: 'swordBeam' },
  { id: 'flame', name: 'Flame Blade', price: 400, damage: 2, range: 18, cut: 2,
    edge: '#ffd23f', blade: '#ff8a3d', dark: '#c2412b', guard: '#2a2540', gem: '#e8384f',
    grip: '#1d1a2f', pommel: '#2a2540', hilt: '#2a2540', power: 'fireWave',
    sparkSize: 2, sparkColors: ['#ffd23f', '#ff8a3d', '#e8384f', '#ff8a3d'] },   // fiery sparks
  { id: 'thunder', name: 'Thunder Sword', price: 800, damage: 3, range: 18, cut: 2,
    edge: '#ffffff', blade: '#7bd6ff', dark: '#3b8bff', guard: '#3a3a4e', gem: '#ffd23f',
    grip: '#22222e', pommel: '#3a3a4e', hilt: '#3a3a4e', power: 'thunderstorm',
    sparkColors: ['#7bd6ff', '#3b8bff', '#ffffff', '#7bd6ff'] },   // crackling blue sparks
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
    // The sword is HEAVY: a swing is a slow heave over your head, then a
    // fast chop down. It only hits during the chop.
    this.SWING_TIME = 0.75;       // whole swing, start to finish
    this.SWING_LIFT = 0.44;       // first 44% = lifting it (can't hit yet)
    this.SWING_CHOP = 0.64;       // chop ends here; the rest is hoisting it back
    this.SWING_COOLDOWN = 1.1;    // seconds between swings (from the press)
    this.PLUNGE_COOLDOWN = 1.5;   // seconds between plunge attacks
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
    this.plungeCooldown = 0;
    this.spinTimer = 0;
    this.plunging = false;     // falling sword-first after a mid-air attack
    this.slamTimer = 0;        // sword stuck in the ground after a plunge
    for (let i = 0; i < this.shots.length; i++) this.shots[i].active = false;
    for (let i = 0; i < this.strikes.length; i++) this.strikes[i].life = 0;
  }

  damage(g) { return this.sword.damage + g.mods.swordDamage; }

  // SPACE / F: overhead swing on the ground, plunge attack in the air.
  attack(g) {
    if (g.player.grounded) this.swing(g);
    else this.plunge(g);
  }

  swing(g) {
    if (g.player.dead || this.swingTimer > 0) return;
    if (this.cooldown > 0) { g.sound.play('denied'); return; }
    this.swingTimer = this.SWING_TIME;
    this.cooldown = this.SWING_COOLDOWN;
    g.sound.play('heave');
  }

  // How far through the current swing we are (0 = start, 1 = done).
  get swingT() { return 1 - this.swingTimer / this.SWING_TIME; }
  // Is the blade coming down right now (the only part that hits)?
  get chopping() {
    const t = this.swingT;
    return this.swingTimer > 0 && t >= this.SWING_LIFT && t < this.SWING_CHOP;
  }

  plunge(g) {
    const p = g.player;
    if (this.plunging || p.dead) return;
    if (this.plungeCooldown > 0) { g.sound.play('denied'); return; }
    this.plungeCooldown = this.PLUNGE_COOLDOWN;
    this.plunging = true;
    this.swingTimer = 0;
    p.smashing = true;                                   // fall like a ground smash
    p.vy = Math.max(p.vy, OMJ.CONFIG.SMASH_SPEED * 1.1);
    p.squash = -1;
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
    if (this.plungeCooldown > 0) this.plungeCooldown -= dt;
    const wasLifting = this.swingTimer > 0 && this.swingT < this.SWING_LIFT;
    if (this.swingTimer > 0) this.swingTimer -= dt;
    if (wasLifting && this.chopping) {
      g.sound.play('swing');                             // ...and down it comes!
      g.shake = Math.max(g.shake, 1.5);
    }
    if (this.spinTimer > 0) this.spinTimer -= dt;
    if (this.slamTimer > 0) this.slamTimer -= dt;
    for (let i = 0; i < this.strikes.length; i++) if (this.strikes[i].life > 0) this.strikes[i].life -= dt;

    const p = g.player;
    if (this.plunging) {
      if (p.dead) {
        this.plunging = false;
      } else if (p.grounded) {
        // SLAM: the sword hits the ground and everything close by.
        this.plunging = false;
        this.slamTimer = 0.18;
        this.hitZone(g, p.x - 14, p.x + p.w + 18, p.bottom - 18, p.bottom + 1, 1);
        g.shake = Math.max(g.shake, 3);
        g.sound.play('slam');
        g.particles.burst(p.x + 5, p.bottom - 1, 12, 50, 130, Math.PI * 1.05, Math.PI * 1.95, 0.4,
          this.sword.sparkColors || OMJ.SPARK_COLORS, 400);
      } else if (!p.smashing) {
        this.plunging = false;                           // cancelled (e.g. a Double Jump)
      } else {
        this.hitZone(g, p.x - 2, p.x + p.w + 4, p.y + 4, p.bottom + 12, 1);   // the blade below you
      }
    }
    if (this.spinTimer > 0) {
      this.hitZone(g, p.x - 20, p.x + p.w + 22, p.y - 14, p.bottom + 4);
    } else if (this.chopping) {
      // Overhead: it hits above your head as well as in front of you.
      this.hitZone(g, p.x - 4, p.x + p.w + this.sword.range, p.y - 16, p.bottom + 2);
    }
    this.updateShots(dt, g);
    this.dragSparks(g);
  }

  // Cut, knock back or defeat everything inside this box.
  // `cutBonus` lets plunges cut one level tougher.
  hitZone(g, x1, x2, y1, y2, cutBonus) {
    const pool = g.obstacles.pool;
    const cut = this.sword.cut + (cutBonus || 0);
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || o.type.isGap || o.type.harmless) continue;
      const left = o.x + o.bx;
      if (left > x2 || left + o.bw < x1 || o.y > y2 || o.y + o.h < y1) continue;
      if (o.type.enemy) {
        g.defeatEnemy(o);
      } else if (o.type.reflectable) {
        g.reflect(o, this.damage(g));
      } else if (o.type.toughness && o.type.toughness <= cut) {
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
    if (this.plunging || this.slamTimer > 0) return 180;        // pointing straight down
    if (this.swingTimer > 0) return this.swingPose(p, time).a;
    return this.restAngle(p, time);
  }

  // The angle when you're not attacking.
  restAngle(p, time) {
    if (OMJ.CONFIG.SWORD_POSE === 'drag') {
      // Trailing behind you, tip on the ground. In the air it dangles.
      return p.grounded ? -110 : -150 + (Math.floor(time * 8) % 2 ? 6 : 0);
    }
    // Held up in front of you, wobbling as you run (it's heavy!).
    const wobble = p.grounded ? (Math.floor(p.runTime * 12) % 2 ? 6 : 0) : -8;
    return 18 + wobble;
  }

  // Where your fist is when you're not attacking (relative to you).
  restGrip() {
    return OMJ.CONFIG.SWORD_POSE === 'drag' ? { x: -2, y: 7 } : { x: 10, y: 9 };
  }

  // The swing, as an angle plus where your fist is. The fist moves around
  // your shoulder with the sword, so it never jumps from back to front:
  //   1. a slow, straining heave up over your head (it's heavy!)
  //   2. a fast chop down in front, tip into the ground
  //   3. a short rest, then hoisting it back over your head to where it was
  swingPose(p, time) {
    const t = this.swingT;
    const rest = this.restGrip();
    const restA = this.restAngle(p, time);
    const top = -15;            // held up, just behind your head
    const down = 105;           // tip touching the ground in front of you
    let a;
    let blend = 0;              // 0 = fist on the shoulder arc, 1 = fist at the rest grip
    if (t < this.SWING_LIFT) {
      const k = t / this.SWING_LIFT;
      const e = k * k * (3 - 2 * k);                                  // ease in and out
      const wobble = k > 0.7 ? (Math.floor(time * 20) % 2 ? 4 : 0) : 0;
      a = restA + (top - restA) * e + wobble;
      blend = 1 - e;
    } else if (t < this.SWING_CHOP) {
      const k = (t - this.SWING_LIFT) / (this.SWING_CHOP - this.SWING_LIFT);
      a = top + (down - top) * (k * k);                               // gravity takes over
    } else {
      const k = (t - this.SWING_CHOP) / (1 - this.SWING_CHOP);
      const e = k < 0.3 ? 0 : ((k - 0.3) / 0.7) * ((k - 0.3) / 0.7);  // stuck a moment, then up
      a = down + (restA - down) * e;                                  // back over the top
      blend = e;
    }
    const r = (a * Math.PI) / 180;
    const arcX = 4 + Math.sin(r) * 6;           // shoulder at (4, 6), arm 6 px long
    const arcY = 6 - Math.cos(r) * 6;
    return {
      a: a,
      x: p.x + arcX + (rest.x - arcX) * blend,
      y: p.y + arcY + (rest.y - arcY) * blend,
    };
  }

  // Resting in the drag pose (not mid-swing)?
  get dragging() {
    return OMJ.CONFIG.SWORD_POSE === 'drag' && this.swingTimer <= 0 && this.spinTimer <= 0 &&
      !this.plunging && this.slamTimer <= 0;
  }

  // Drawn behind your body? (Dragging, or the start/end of a swing.)
  behind(p, time) {
    return this.dragging || (this.swingTimer > 0 && this.swingPose(p, time).a < -60);
  }

  // Where your little fist holds the sword: just behind you when
  // dragging it, under you when plunging, out in front otherwise.
  gripX(p, time) {
    if (this.plunging || this.slamTimer > 0) return Math.round(p.x + 6);
    if (this.swingTimer > 0 && this.spinTimer <= 0) return Math.round(this.swingPose(p, time).x);
    return Math.round(p.x + this.restGrip().x);
  }
  gripY(p, time) {
    if (this.slamTimer > 0) return Math.round(p.bottom - 8);      // blade buried in the ground
    if (this.plunging) return Math.round(p.bottom - 3);
    if (this.swingTimer > 0 && this.spinTimer <= 0) return Math.round(this.swingPose(p, time).y);
    return Math.round(p.y + this.restGrip().y);
  }

  // Sparks where the tip scrapes along the ground. The faster you run,
  // the bigger, wilder and more frequent they get. A sword can set a
  // bigger starting size (`sparkSize`) and its own `sparkColors`.
  dragSparks(g) {
    const p = g.player;
    if (!this.dragging || !p.grounded || p.dead) return;
    const C = OMJ.CONFIG;
    const fast = OMJ.clamp((g.worldSpeed - C.START_SPEED) / (C.MAX_SPEED - C.START_SPEED), 0, 1);
    if (Math.random() > 0.3 + 0.4 * fast) return;
    const a = (this.swordAngle(p, g.time) * Math.PI) / 180;
    const tipX = this.gripX(p, g.time) + Math.sin(a) * OMJ.SwordArt.LENGTH;
    const size = (this.sword.sparkSize || 1) + Math.round(fast * 2);       // 1 -> 3 px (fire: 2 -> 4)
    const colors = this.sword.sparkColors || OMJ.SPARK_COLORS;
    g.particles.spawn(tipX + OMJ.rand(-1, 1), p.bottom - size, OMJ.rand(-50, -10) * (1 + fast), OMJ.rand(-70, -25) * (1 + 0.5 * fast),
      0.22 + 0.12 * fast, size, colors[Math.floor(Math.random() * colors.length)], 400);
  }

  // Drawn BEFORE the player, so a dragged sword trails out from behind you.
  drawBehind(ctx, g) {
    const p = g.player;
    if (p.dead || !this.behind(p, g.time)) return;
    OMJ.SwordArt.draw(ctx, this.sword, this.swordAngle(p, g.time), this.gripX(p, g.time), this.gripY(p, g.time));
  }

  // Drawn after the player: the sword, your fist, shots and lightning.
  draw(ctx, g) {
    const p = g.player;
    if (!p.dead) {
      const swinging = this.chopping || this.spinTimer > 0;
      const angle = this.swordAngle(p, g.time);
      const hx = this.gripX(p, g.time);
      const hy = this.gripY(p, g.time);
      if (swinging) this.drawTrail(ctx, angle, hx, hy);
      if (!this.behind(p, g.time)) OMJ.SwordArt.draw(ctx, this.sword, angle, hx, hy);
      // The little fist wrapped around the handle
      ctx.fillStyle = OMJ.PALETTE.ink;
      ctx.fillRect(hx - 1, hy - 1, 3, 3);
      ctx.fillStyle = g.skin.body;
      ctx.fillRect(hx, hy, 1, 1);
    }
    this.drawShots(ctx, g.time);
    this.drawStrikes(ctx, g.time);
    if (!p.dead) this.drawCooldowns(ctx, p);
  }

  // Tiny bars over your head while the swing (gold) or the plunge
  // (blue) is recharging. They vanish once the attack is ready.
  drawCooldowns(ctx, p) {
    const bars = [
      [this.cooldown / this.SWING_COOLDOWN, OMJ.PALETTE.gold],
      [this.plungeCooldown / this.PLUNGE_COOLDOWN, '#7bd6ff'],
    ];
    let y = Math.round(p.y) - 5;
    for (let i = 0; i < bars.length; i++) {
      const left = bars[i][0];
      if (left <= 0) continue;
      const x = Math.round(p.x + p.w / 2 - 7);
      ctx.fillStyle = OMJ.PALETTE.ink;
      ctx.fillRect(x - 1, y - 1, 16, 3);
      ctx.fillStyle = bars[i][1];
      ctx.fillRect(x, y, Math.round(14 * (1 - left)), 1);
      y -= 3;
    }
  }

  // A pale crescent following the tip of the sword during a swing.
  drawTrail(ctx, angle, hx, hy) {
    const from = this.spinTimer > 0 ? angle - 150 : -15;
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
        // A wall of fire: a few flame tongues of different heights that
        // flicker and sway. The tallest one leads.
        const base = C.GROUND_Y;
        const t = time * 14 + s.age * 3;
        this.drawFlame(ctx, x - 9, base, 9 + Math.round(Math.sin(t * 1.3) * 2), 7, t + 2);
        this.drawFlame(ctx, x + 3, base, 11 + Math.round(Math.sin(t * 1.1 + 1) * 2), 7, t + 4);
        this.drawFlame(ctx, x - 3, base, 15 + Math.round(Math.sin(t) * 2), 9, t);
        // Glowing embers on the ground under it
        ctx.fillStyle = OMJ.PALETTE.gold;
        ctx.fillRect(x - 12, base - 1, 18, 1);
      }
    }
  }

  // One flame tongue: wide at the bottom, a swaying point at the top.
  // Four layers from the outside in: red, orange, gold, white-hot core.
  drawFlame(ctx, cx, baseY, height, width, phase) {
    const layers = [
      [OMJ.PALETTE.danger, 1, 1],
      ['#ff8a3d', 0.72, 0.8],
      [OMJ.PALETTE.gold, 0.45, 0.55],
      ['#fff2a8', 0.2, 0.28],
    ];
    for (let l = 0; l < layers.length; l++) {
      const color = layers[l][0];
      const h = Math.max(2, Math.round(height * layers[l][2]));
      const w = width * layers[l][1];
      ctx.fillStyle = color;
      for (let row = 0; row < h; row++) {
        const up = row / h;                                 // 0 at the base, 1 at the tip
        const half = Math.max(0.5, (w / 2) * Math.pow(1 - up, 0.8));
        const sway = Math.round(Math.sin(phase + row * 0.55) * up * 2.5);  // the top sways most
        const left = Math.round(cx + sway - half);
        const right = Math.round(cx + sway + half);
        ctx.fillRect(left, baseY - 1 - row, Math.max(1, right - left), 1);
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
