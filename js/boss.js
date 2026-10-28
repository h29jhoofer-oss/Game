// =============================================================
// boss.js — BIG BONK, the boss who shows up after each night.
//
// How the fight works:
//   - Normal obstacles stop. Big Bonk flies in and hovers on the right.
//   - It throws attacks (bombs, spiky balls, fireballs) you jump over.
//   - Ground smash (DOWN while in the air) sends a shockwave along the
//     ground. Each shockwave that reaches Big Bonk takes 1 health.
//     (Shuriken and Supernova hurt it too.)
//   - Beat it for a big bonus. If you take too long, it flies away.
//
// Fairness: before launching, the boss works out when each attack will
// reach you. Attacks are never closer together than one full jump plus
// reaction time (MIN_GAP). If one would arrive too soon, the boss holds
// its wind-up pose and waits.
// =============================================================

OMJ.BOSS = {
  name: 'BIG BONK',
  firstAt: 1500,          // score when the first night ends (themes change every 500)
  every: 1500,            // and again after every night after that
  baseHealth: 6,          // +2 health each time it comes back
  timeLimit: 35,          // seconds before it gets bored and leaves
  reward: 250,            // bonus points per level for beating it
  x: 296,                 // where it hovers (screen x of its center)
  y: 62,                  // ... and how high (always above your jumps)
  windUp: 0.45,           // seconds of warning before each attack
  reaction: 0.4,          // extra reaction time between attacks
};

OMJ.Boss = class {
  constructor() {
    // Ground-smash shockwaves heading for the boss (small pool, re-used)
    this.waves = [];
    for (let i = 0; i < 4; i++) this.waves.push({ active: false, x: 0, age: 0 });
    this.reset();
  }

  reset() {
    this.state = 'off';     // off | entering | fighting | defeated | leaving
    this.level = 0;
    this.nextAt = OMJ.BOSS.firstAt;
    this.x = OMJ.CONFIG.VIEW_W + 40;
    this.y = OMJ.BOSS.y;
    this.health = 0;
    this.maxHealth = 1;
    this.hurtTimer = 0;
    this.stateTimer = 0;
    this.attack = null;      // attack being wound up
    this.windUpTimer = 0;
    this.cooldown = 0;
    this.lastArrival = 0;    // game time when the last attack reaches you
    this.time = 0;
    for (let i = 0; i < this.waves.length; i++) this.waves[i].active = false;
  }

  get active() { return this.state !== 'off'; }
  get fighting() { return this.state === 'fighting'; }

  start(g) {
    const B = OMJ.BOSS;
    this.state = 'entering';
    this.x = OMJ.CONFIG.VIEW_W + 40;
    this.y = B.y;
    this.maxHealth = B.baseHealth + 2 * this.level;
    this.health = this.maxHealth;
    this.stateTimer = 0;
    this.attack = null;
    this.cooldown = 1;
    g.announce('WARNING: BOSS!', OMJ.PALETTE.danger);
    if (this.level === 0) g.announce('PRESS DOWN IN THE AIR TO SMASH', OMJ.PALETTE.white);
    g.sound.play('bossAlarm');
    g.music.play('boss');
  }

  // ---- Attacks --------------------------------------------------
  // Each returns how long (seconds) until it would reach the player.
  arrivalTime(kind, g) {
    const p = g.player;
    const distance = this.x - 6 - (p.x + p.w);
    const speed = g.worldSpeed;
    const fall = Math.sqrt((2 * (OMJ.CONFIG.GROUND_Y - this.y - 22)) / 900);
    if (kind === 'bomb') return fall + distance / (speed + 30);
    if (kind === 'spikeball') return fall + distance / speed;
    return distance / (speed + 150);   // fireball
  }

  launch(kind, g) {
    const o = g.obstacles.spawn(kind, this.x - 6, 0);
    if (!o) return;
    o.y = this.y + (kind === 'fireball' ? 6 : 12);
    g.sound.play(kind === 'fireball' ? 'fireball' : 'bossThrow');
  }

  // ---- Updating -------------------------------------------------
  update(dt, g) {
    const B = OMJ.BOSS;
    this.time += dt;
    this.stateTimer += dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    this.updateWaves(dt, g);

    if (this.state === 'entering') {
      this.x = Math.max(B.x, this.x - 90 * dt);
      if (this.x === B.x) {
        this.state = 'fighting';
        this.stateTimer = 0;
        // Don't attack until every obstacle already on screen has gone past.
        this.lastArrival = this.time + g.timeUntilClear();
      }
    } else if (this.state === 'fighting') {
      this.y = B.y + Math.round(Math.sin(this.time * 2) * 4);
      if (this.stateTimer > B.timeLimit) {
        this.state = 'leaving';
        g.announce('BIG BONK GOT BORED...', OMJ.PALETTE.metal);
        g.sound.play('bossEscape');
        return;
      }
      this.updateAttacks(dt, g);
    } else if (this.state === 'leaving') {
      this.x += 140 * dt;
      this.y -= 30 * dt;
      if (this.x > OMJ.CONFIG.VIEW_W + 60) this.finish(g, false);
    } else if (this.state === 'defeated') {
      this.y += 60 * dt;
      // Little explosions while it falls
      if (Math.random() < 0.3) {
        g.particles.burst(this.x + OMJ.rand(-16, 16), this.y + OMJ.rand(-12, 12), 6, 30, 90, 0, Math.PI * 2, 0.5,
          [OMJ.PALETTE.gold, OMJ.PALETTE.danger, OMJ.PALETTE.white], 100);
      }
      if (this.stateTimer > 1.4) this.finish(g, true);
    }
  }

  updateAttacks(dt, g) {
    const B = OMJ.BOSS;
    if (this.attack) {
      this.windUpTimer -= dt;
      if (this.windUpTimer > 0) return;
      // Ready to throw. Is it far enough after the previous attack?
      const minGap = OMJ.Physics.airTime() + B.reaction;
      const arrival = this.time + this.arrivalTime(this.attack, g);
      if (arrival < this.lastArrival + minGap) return;   // hold the pose and wait
      this.launch(this.attack, g);
      this.lastArrival = arrival;
      this.attack = null;
      // Gets angrier (faster) as it loses health.
      const anger = 1 - this.health / this.maxHealth;
      this.cooldown = OMJ.rand(0.5, 1.1) * (1 - 0.4 * anger);
      return;
    }
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      const roll = Math.random();
      this.attack = roll < 0.4 ? 'bomb' : roll < 0.7 ? 'fireball' : 'spikeball';
      this.windUpTimer = B.windUp;
    }
  }

  // Ground smash: send a shockwave along the ground toward the boss.
  sendShockwave(x) {
    for (let i = 0; i < this.waves.length; i++) {
      const w = this.waves[i];
      if (w.active) continue;
      w.active = true; w.x = x; w.age = 0;
      return;
    }
  }

  updateWaves(dt, g) {
    for (let i = 0; i < this.waves.length; i++) {
      const w = this.waves[i];
      if (!w.active) continue;
      w.x += 360 * dt;
      w.age += dt;
      if (this.fighting && w.x >= this.x - 18) {
        w.active = false;
        this.hit(1, g);
      } else if (w.x > OMJ.CONFIG.VIEW_W) {
        w.active = false;
      }
    }
  }

  hit(damage, g) {
    if (!this.fighting) return;
    this.health -= damage;
    this.hurtTimer = 0.15;
    g.shake = Math.max(g.shake, 3);
    g.particles.burst(this.x, this.y + 14, 10, 40, 110, 0, Math.PI * 2, 0.5, [OMJ.PALETTE.white, OMJ.PALETTE.gold], 200);
    if (this.health <= 0) {
      this.health = 0;
      this.state = 'defeated';
      this.stateTimer = 0;
      this.attack = null;
      g.sound.play('bossDefeated');
      g.flash = 0.15;
    } else {
      g.sound.play('bossHit');
    }
  }

  finish(g, defeated) {
    this.state = 'off';
    this.level++;
    g.onBossEnd(defeated, OMJ.BOSS.reward * this.level);
  }

  // ---- Drawing --------------------------------------------------
  draw(ctx, g) {
    this.drawWaves(ctx);
    if (!this.active) return;
    const P = OMJ.PALETTE;
    const x = Math.round(this.x) - 20;
    const y = Math.round(this.y);
    const flip = this.state === 'defeated';
    const hurt = this.hurtTimer > 0;
    const angry = this.attack !== null;
    const body = hurt ? P.white : '#5b4a8a';
    const shade = hurt ? P.white : '#3e3166';

    // Wind-up shake: a clear "here it comes!" signal.
    const sx = angry && Math.floor(this.time * 30) % 2 ? 1 : 0;

    ctx.save();
    if (flip) { ctx.translate(0, y * 2 + 30); ctx.scale(1, -1); }

    // Propeller
    const blade = Math.floor(this.time * 20) % 2;
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + sx + 19, y - 8, 2, 5);
    ctx.fillStyle = P.metalLight;
    if (blade) ctx.fillRect(x + sx + 11, y - 9, 18, 2);
    else ctx.fillRect(x + sx + 16, y - 9, 8, 2);

    // Crown
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + sx + 9, y - 4, 22, 6);
    ctx.fillStyle = P.gold;
    ctx.fillRect(x + sx + 10, y - 1, 20, 2);
    ctx.fillRect(x + sx + 10, y - 3, 2, 2); ctx.fillRect(x + sx + 19, y - 3, 2, 2); ctx.fillRect(x + sx + 28, y - 3, 2, 2);

    // Body
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + sx, y + 1, 40, 30);
    ctx.fillStyle = body;
    ctx.fillRect(x + sx + 1, y + 2, 38, 28);
    ctx.fillStyle = shade;
    ctx.fillRect(x + sx + 1, y + 24, 38, 6);
    ctx.fillStyle = hurt ? P.white : '#7b6aaa';
    ctx.fillRect(x + sx + 1, y + 2, 38, 2);
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + sx + 3, y + 5, 1, 1); ctx.fillRect(x + sx + 36, y + 5, 1, 1);
    ctx.fillRect(x + sx + 3, y + 27, 1, 1); ctx.fillRect(x + sx + 36, y + 27, 1, 1);

    // Eyes look toward you; red when winding up an attack.
    ctx.fillStyle = P.white;
    ctx.fillRect(x + sx + 7, y + 8, 9, 7);
    ctx.fillRect(x + sx + 24, y + 8, 9, 7);
    ctx.fillStyle = angry ? P.danger : P.ink;
    ctx.fillRect(x + sx + 8, y + 10, 3, 4);
    ctx.fillRect(x + sx + 25, y + 10, 3, 4);
    ctx.fillStyle = P.ink;                       // angry brows
    ctx.fillRect(x + sx + 6, y + 6, 4, 2); ctx.fillRect(x + sx + 10, y + 7, 4, 1);
    ctx.fillRect(x + sx + 30, y + 6, 4, 2); ctx.fillRect(x + sx + 26, y + 7, 4, 1);

    // Mouth: a grill that glows when a fireball is coming.
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + sx + 10, y + 18, 20, 6);
    ctx.fillStyle = this.attack === 'fireball' ? P.gold : '#2a2540';
    ctx.fillRect(x + sx + 11, y + 19, 18, 4);
    ctx.fillStyle = P.ink;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + sx + 14 + i * 4, y + 19, 1, 4);
    ctx.restore();
  }

  drawWaves(ctx) {
    const P = OMJ.PALETTE;
    const gy = OMJ.CONFIG.GROUND_Y;
    for (let i = 0; i < this.waves.length; i++) {
      const w = this.waves[i];
      if (!w.active) continue;
      const x = Math.round(w.x);
      const rise = Math.floor(w.age * 20) % 2;
      ctx.fillStyle = P.gold;
      ctx.fillRect(x, gy - 4 - rise, 2, 4 + rise);
      ctx.fillRect(x - 4, gy - 2, 3, 2);
      ctx.fillRect(x + 3, gy - 3 + rise, 3, 3 - rise);
      ctx.fillStyle = P.white;
      ctx.fillRect(x, gy - 5 - rise, 2, 1);
    }
  }

  // Health bar at the top of the screen.
  drawHud(ctx) {
    if (!this.active || this.state === 'leaving') return;
    const F = OMJ.PixelFont;
    const P = OMJ.PALETTE;
    const cx = OMJ.CONFIG.VIEW_W / 2;
    F.drawShadowed(ctx, OMJ.BOSS.name, cx, 7, 1, P.white, P.ink, 'center');
    ctx.fillStyle = P.ink;
    ctx.fillRect(cx - 51, 14, 102, 6);
    ctx.fillStyle = '#4a4570';
    ctx.fillRect(cx - 50, 15, 100, 4);
    ctx.fillStyle = this.hurtTimer > 0 ? P.white : P.danger;
    ctx.fillRect(cx - 50, 15, Math.round(100 * this.health / this.maxHealth), 4);
    // Time left before it leaves
    if (this.fighting) {
      const left = 1 - this.stateTimer / OMJ.BOSS.timeLimit;
      ctx.fillStyle = P.metalDark;
      ctx.fillRect(cx - 50, 21, Math.round(100 * Math.max(0, left)), 1);
    }
  }
};
