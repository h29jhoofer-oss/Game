// =============================================================
// boss.js — BIG BONK, the boss who shows up after each night.
//
// How the fight works:
//   - Normal obstacles stop. Big Bonk flies in and hovers on the right.
//   - It uses its attacks (list below); you jump over what it sends.
//   - Ground smash (DOWN while in the air) sends a shockwave along the
//     ground. Each shockwave that reaches Big Bonk takes 1 health.
//     (Shuriken and Supernova hurt it too.)
//   - Beat it for a big bonus. If you take too long, it flies away.
//
// Attacks:
//   bomb        drops a bomb that rolls toward you
//   spikeball   drops a spiky ball that sits still
//   fireball    spits a fireball that swoops to the ground
//   burst       three fireballs in a row
//   stomp       Ground Pound: slams into the ground, sending a quake wave
//   crateDrop   drops a crate (jump it, or stand on it)
//
// Fairness: before launching, the boss works out when each attack will
// reach you. Attacks are never closer together than one full jump plus
// reaction time. If one would arrive too soon, the boss holds its
// wind-up pose and waits.
// =============================================================

OMJ.BOSS = {
  name: 'BIG BONK',
  firstAt: 1500,          // score when the first night ends (themes change every 500)
  every: 1500,            // and again after every night after that
  baseHealth: 6,          // +2 health each time it comes back
  timeLimit: 40,          // seconds before it gets bored and leaves
  reward: 250,            // bonus points per level for beating it
  x: 300,                 // where it hovers (screen x of its center)
  y: 46,                  // ... and how high (top of its body)
  scale: 2,               // drawn at double size
  windUp: 0.45,           // seconds of warning before each attack
  reaction: 0.4,          // extra reaction time between attacks
  // How likely each attack is (bigger number = more often).
  attacks: { bomb: 3, spikeball: 2, fireball: 3, burst: 2, stomp: 2, crateDrop: 2 },
};

OMJ.Boss = class {
  constructor() {
    // Ground-smash shockwaves heading for the boss (small pool, re-used)
    this.waves = [];
    for (let i = 0; i < 4; i++) this.waves.push({ active: false, x: 0, age: 0 });
    // The boss is drawn at normal size into this little canvas, then
    // scaled up, so the pixels stay crisp and chunky.
    this.sprite = document.createElement('canvas');
    this.sprite.width = 48;
    this.sprite.height = 44;
    this.spriteCtx = this.sprite.getContext('2d');
    this.reset();
  }

  reset() {
    this.state = 'off';     // off | entering | fighting | defeated | leaving
    this.level = 0;
    this.nextAt = OMJ.BOSS.firstAt;
    this.x = OMJ.CONFIG.VIEW_W + 60;
    this.y = OMJ.BOSS.y;
    this.health = 0;
    this.maxHealth = 1;
    this.hurtTimer = 0;
    this.stateTimer = 0;
    this.attack = null;      // attack being wound up
    this.windUpTimer = 0;
    this.burstLeft = 0;      // fireballs still to come in a burst
    this.stomp = 0;          // 0 = not stomping, 1 = slamming down, 2 = rising back up
    this.cooldown = 0;
    this.lastArrival = 0;    // game time when the last attack reaches you
    this.time = 0;
    for (let i = 0; i < this.waves.length; i++) this.waves[i].active = false;
  }

  get active() { return this.state !== 'off'; }
  get fighting() { return this.state === 'fighting'; }
  get leftEdge() { return this.x - 20 * OMJ.BOSS.scale; }   // where shockwaves hit it
  get bottom() { return this.y + 31 * OMJ.BOSS.scale; }

  start(g) {
    const B = OMJ.BOSS;
    this.state = 'entering';
    this.x = OMJ.CONFIG.VIEW_W + 60;
    this.y = B.y;
    this.maxHealth = B.baseHealth + 2 * this.level;
    this.health = this.maxHealth;
    this.stateTimer = 0;
    this.attack = null;
    this.burstLeft = 0;
    this.stomp = 0;
    this.cooldown = 1;
    g.announce('WARNING: BOSS!', OMJ.PALETTE.danger);
    if (this.level === 0) g.announce('PRESS DOWN IN THE AIR TO SMASH', OMJ.PALETTE.white);
    g.sound.play('bossAlarm');
    g.music.play('boss');
  }

  // ---- Attacks --------------------------------------------------

  // Seconds until an attack launched now would reach the player.
  arrivalTime(kind, g) {
    const p = g.player;
    const speed = g.worldSpeed;
    const fromX = this.x - 8;
    const distance = fromX - (p.x + p.w);
    // Time to fall from the boss to the ground (for dropped things).
    const fall = (height) => Math.sqrt((2 * (OMJ.CONFIG.GROUND_Y - height - this.bottom)) / 900);
    if (kind === 'bomb') return fall(10) + distance / (speed + 30);
    if (kind === 'spikeball') return fall(12) + distance / speed;
    if (kind === 'crateDrop') return fall(16) + distance / speed;
    if (kind === 'stomp') {
      // It slams down first, then the quake wave starts at its left side.
      return this.stompDropTime() + (this.quakeStartX() - (p.x + p.w)) / (speed + 140);
    }
    return distance / (speed + 150);   // fireball (and each fireball in a burst)
  }

  stompDropTime() { return 0.25; }
  quakeStartX() { return this.leftEdge - 14; }

  launch(kind, g) {
    if (kind === 'stomp') {
      this.stomp = 1;
      this.stompTimer = 0;
      g.sound.play('bossThrow');
      return;
    }
    const type = kind === 'crateDrop' ? 'crate' : kind;
    const o = g.obstacles.spawn(type, this.x - 8, kind === 'crateDrop' ? 1 : 0);
    if (!o) return;
    if (kind === 'fireball') {
      o.y = this.y + 40;                     // out of its mouth
      g.sound.play('fireball');
    } else {
      o.y = this.bottom;                     // dropped from underneath
      if (kind === 'crateDrop') o.dropping = true;
      g.sound.play('bossThrow');
    }
  }

  chooseAttack() {
    const list = OMJ.BOSS.attacks;
    let total = 0;
    for (const k in list) total += list[k];
    let roll = Math.random() * total;
    for (const k in list) {
      roll -= list[k];
      if (roll <= 0) return k;
    }
    return 'bomb';
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
      if (this.stomp) {
        this.updateStomp(dt, g);
        return;
      }
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
      if (this.x > OMJ.CONFIG.VIEW_W + 90) this.finish(g, false);
    } else if (this.state === 'defeated') {
      this.y += 60 * dt;
      // Little explosions while it falls
      if (Math.random() < 0.4) {
        g.particles.burst(this.x + OMJ.rand(-36, 36), this.y + OMJ.rand(0, 60), 6, 30, 90, 0, Math.PI * 2, 0.5,
          [OMJ.PALETTE.gold, OMJ.PALETTE.danger, OMJ.PALETTE.white], 100);
      }
      if (this.stateTimer > 1.6) this.finish(g, true);
    }
  }

  // Ground Pound: slam down, send a quake wave, float back up.
  updateStomp(dt, g) {
    const B = OMJ.BOSS;
    const groundY = OMJ.CONFIG.GROUND_Y - 31 * B.scale;   // body resting on the ground
    this.stompTimer += dt;
    if (this.stomp === 1) {
      const t = Math.min(1, this.stompTimer / this.stompDropTime());
      this.y = B.y + (groundY - B.y) * t * t;
      if (t >= 1) {
        this.stomp = 2;
        this.stompTimer = 0;
        g.obstacles.spawn('quake', this.quakeStartX(), 0);
        g.shake = Math.max(g.shake, 5);
        g.sound.play('bossStomp');
        g.particles.burst(this.x, OMJ.CONFIG.GROUND_Y - 2, 24, 40, 140, Math.PI, Math.PI * 2, 0.6,
          [OMJ.PALETTE.dust, OMJ.PALETTE.dustDark, OMJ.PALETTE.dirtLight], 300);
      }
    } else {
      const t = Math.min(1, this.stompTimer / 0.7);
      this.y = groundY + (B.y - groundY) * t;
      if (t >= 1) {
        this.stomp = 0;
        this.cooldown = 0.6;
      }
    }
  }

  updateAttacks(dt, g) {
    const B = OMJ.BOSS;
    if (this.attack) {
      this.windUpTimer -= dt;
      if (this.windUpTimer > 0) return;
      // Ready to go. Is it far enough after the previous attack?
      const kind = this.attack === 'burst' ? 'fireball' : this.attack;
      const minGap = OMJ.Physics.airTime() + B.reaction;
      const arrival = this.time + this.arrivalTime(kind, g);
      if (arrival < this.lastArrival + minGap) return;   // hold the pose and wait
      this.launch(kind, g);
      this.lastArrival = arrival;
      if (this.attack === 'burst' && --this.burstLeft > 0) {
        this.windUpTimer = 0.1;          // next fireball of the burst
        return;
      }
      this.attack = null;
      // Gets angrier (faster) as it loses health.
      const anger = 1 - this.health / this.maxHealth;
      this.cooldown = OMJ.rand(0.4, 1.0) * (1 - 0.4 * anger);
      return;
    }
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.attack = this.chooseAttack();
      this.burstLeft = this.attack === 'burst' ? 3 : 0;
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
      if (this.fighting && w.x >= this.leftEdge) {
        w.active = false;
        this.hit(g.mods.smashDamage, g);     // Heavy Stomp boost hits harder
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
    g.particles.burst(this.x, this.y + 30, 14, 40, 130, 0, Math.PI * 2, 0.5, [OMJ.PALETTE.white, OMJ.PALETTE.gold], 200);
    if (this.health <= 0) {
      this.health = 0;
      this.state = 'defeated';
      this.stateTimer = 0;
      this.attack = null;
      this.stomp = 0;
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

  // Draws Big Bonk at normal size. (x, y) is the top-left of its body.
  drawSprite(ctx, x, y) {
    const P = OMJ.PALETTE;
    const hurt = this.hurtTimer > 0;
    const angry = this.attack !== null;
    const body = hurt ? P.white : '#5b4a8a';
    const shade = hurt ? P.white : '#3e3166';
    // Wind-up shake: a clear "here it comes!" signal.
    const sx = angry && Math.floor(this.time * 30) % 2 ? 1 : 0;
    x += sx;

    // Propeller
    const blade = Math.floor(this.time * 20) % 2;
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 19, y - 8, 2, 5);
    ctx.fillStyle = P.metalLight;
    if (blade) ctx.fillRect(x + 11, y - 9, 18, 2);
    else ctx.fillRect(x + 16, y - 9, 8, 2);

    // Crown with a jewel
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 9, y - 4, 22, 6);
    ctx.fillStyle = P.gold;
    ctx.fillRect(x + 10, y - 1, 20, 2);
    ctx.fillRect(x + 10, y - 3, 2, 2); ctx.fillRect(x + 19, y - 3, 2, 2); ctx.fillRect(x + 28, y - 3, 2, 2);
    ctx.fillStyle = P.danger;
    ctx.fillRect(x + 19, y - 1, 2, 1);

    // Body
    ctx.fillStyle = P.ink;
    ctx.fillRect(x, y + 1, 40, 30);
    ctx.fillStyle = body;
    ctx.fillRect(x + 1, y + 2, 38, 28);
    ctx.fillStyle = shade;
    ctx.fillRect(x + 1, y + 24, 38, 6);
    ctx.fillStyle = hurt ? P.white : '#7b6aaa';
    ctx.fillRect(x + 1, y + 2, 38, 2);
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 3, y + 5, 1, 1); ctx.fillRect(x + 36, y + 5, 1, 1);
    ctx.fillRect(x + 3, y + 27, 1, 1); ctx.fillRect(x + 36, y + 27, 1, 1);
    // Little fists on each side
    ctx.fillRect(x - 3, y + 16, 4, 6); ctx.fillRect(x + 39, y + 16, 4, 6);
    ctx.fillStyle = shade;
    ctx.fillRect(x - 2, y + 17, 2, 4); ctx.fillRect(x + 40, y + 17, 2, 4);

    // Eyes look toward you; red when winding up an attack.
    ctx.fillStyle = P.white;
    ctx.fillRect(x + 7, y + 8, 9, 7);
    ctx.fillRect(x + 24, y + 8, 9, 7);
    ctx.fillStyle = angry ? P.danger : P.ink;
    ctx.fillRect(x + 8, y + 10, 3, 4);
    ctx.fillRect(x + 25, y + 10, 3, 4);
    ctx.fillStyle = P.ink;                       // angry brows
    ctx.fillRect(x + 6, y + 6, 4, 2); ctx.fillRect(x + 10, y + 7, 4, 1);
    ctx.fillRect(x + 30, y + 6, 4, 2); ctx.fillRect(x + 26, y + 7, 4, 1);

    // Mouth: a grill that glows when a fireball is coming.
    const fire = this.attack === 'fireball' || this.attack === 'burst';
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 10, y + 18, 20, 6);
    ctx.fillStyle = fire ? P.gold : '#2a2540';
    ctx.fillRect(x + 11, y + 19, 18, 4);
    ctx.fillStyle = P.ink;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 14 + i * 4, y + 19, 1, 4);
  }

  draw(ctx, g) {
    this.drawWaves(ctx);
    if (!this.active) return;
    const s = OMJ.BOSS.scale;
    // Draw at 1x into the sprite canvas (body top-left at 4, 10)...
    const c = this.spriteCtx;
    const w = this.sprite.width;
    const h = this.sprite.height;
    c.clearRect(0, 0, w, h);
    this.drawSprite(c, 4, 10);
    // ...then copy it to the screen at double size.
    const dx = Math.round(this.x) - 24 * s;
    const dy = Math.round(this.y) - 10 * s;
    if (this.state === 'defeated') {
      ctx.save();                         // upside down as it falls
      ctx.translate(dx, dy + h * s);
      ctx.scale(1, -1);
      ctx.drawImage(this.sprite, 0, 0, w * s, h * s);
      ctx.restore();
    } else {
      ctx.drawImage(this.sprite, dx, dy, w * s, h * s);
    }
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
    const cx = OMJ.CONFIG.VIEW_W / 2 - 20;
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
