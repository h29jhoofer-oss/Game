// =============================================================
// boss.js — The bosses who show up after each night:
// BIG BONK (a grumpy flying box) and GLOOMWING (a giant bat).
//
// How the fight works:
//   - Normal obstacles stop. The boss flies in and hovers on the right.
//   - It uses its attacks (list below); you jump over what it sends.
//   - To hurt it, SWING your sword (SPACE) as a bomb, fireball, orb or
//     hex bolt reaches you:
//     it flies back into Big Bonk for your sword's damage. Sword powers,
//     Shuriken and Supernova hurt it too. Every attack can also simply
//     be jumped, so you never HAVE to swing.
//   - Beat it for a big bonus. If you take too long, it flies away.
//
// Big Bonk's attacks:
//   bomb        drops a bomb that rolls toward you
//   spikeball   drops a spiky ball that sits still
//   fireball    spits a fireball that swoops to the ground
//   burst       three fireballs in a row
//   stomp       Ground Pound: slams into the ground, sending a quake wave
//   crateDrop   drops a crate (jump it, or stand on it)
//
// Gloomwing's attacks:
//   orb         drops a shadow orb that rolls at you (swing it back!)
//   hex         spits a purple hex bolt (swing it back!)
//   hexBurst    two hex bolts in a row
//   bats        three little bats flap at you, one after another
//   egg         drops a spiky egg that sits still
//   swoop       dives to the ground; its wings send a gust along it
//
// Fairness: before launching, the boss works out when each attack will
// reach you. Attacks are never closer together than one full jump plus
// reaction time. If one would arrive too soon, the boss holds its
// wind-up pose and waits.
// =============================================================

OMJ.BOSS = {
  firstAt: 1500,          // score when the first night ends (themes change every 500)
  every: 1500,            // and again after every night after that
  timeLimit: 40,          // seconds before it gets bored and leaves
  reward: 250,            // bonus points per level for beating it
  x: 300,                 // where it hovers (screen x of its center)
  y: 46,                  // ... and how high (top of its body)
  scale: 2,               // drawn at double size
  windUp: 0.45,           // seconds of warning before each attack
  reaction: 0.4,          // extra reaction time between attacks
};

// The bosses take turns: Big Bonk after the 1st night, Gloomwing after
// the 2nd, Big Bonk again after the 3rd, and so on.
//
// Each attack: `weight` (bigger = more often) and either
//   type      the obstacle it sends (obstacles.js)
//   from      'drop' (falls from underneath) or 'mouth' (spat out)
//   count     how many in a row (a burst)
//   variant   obstacle variant
// or `special: 'stomp'` (slam into the ground and send a wave along it).
OMJ.BOSS_TYPES = {
  bonk: {
    name: 'BIG BONK',
    music: 'boss',
    baseHealth: 8,          // +3 health each time it comes back
    sprite: { w: 48, h: 44, bodyX: 4, bodyY: 10 },
    halfW: 20,              // half the body's width (1x pixels)
    bodyH: 31,
    mouthY: 40,             // where fireballs come out (screen pixels below its top)
    wave: 'quake',          // what its stomp sends along the ground
    hint: 'SWING (SPACE) TO HIT ATTACKS BACK!',
    attacks: {
      bomb:      { weight: 3, type: 'bomb', from: 'drop' },
      spikeball: { weight: 2, type: 'spikeball', from: 'drop' },
      fireball:  { weight: 3, type: 'fireball', from: 'mouth' },
      burst:     { weight: 2, type: 'fireball', from: 'mouth', count: 3 },
      stomp:     { weight: 2, special: 'stomp' },
      crateDrop: { weight: 2, type: 'crate', from: 'drop', variant: 1 },
    },
    draw(boss, ctx, x, y) { boss.drawBonk(ctx, x, y); },
  },

  gloomwing: {
    name: 'GLOOMWING',
    music: 'boss2',
    baseHealth: 10,
    sprite: { w: 72, h: 44, bodyX: 22, bodyY: 10 },
    halfW: 14,
    bodyH: 26,
    mouthY: 34,
    wave: 'gust',
    hint: 'SWING AT ITS ORBS AND HEXES!',
    attacks: {
      orb:     { weight: 3, type: 'shadowOrb', from: 'drop' },
      hex:     { weight: 3, type: 'hexBolt', from: 'mouth' },
      hexBurst: { weight: 2, type: 'hexBolt', from: 'mouth', count: 2 },
      bats:    { weight: 2, type: 'bat', from: 'mouth', count: 3 },
      egg:     { weight: 1, type: 'spikeball', from: 'drop' },
      swoop:   { weight: 2, special: 'stomp' },
    },
    draw(boss, ctx, x, y) { boss.drawGloomwing(ctx, x, y); },
  },
};
OMJ.BOSS_ORDER = ['bonk', 'gloomwing'];

OMJ.Boss = class {
  constructor() {
    // The boss is drawn at normal size into this little canvas, then
    // scaled up, so the pixels stay crisp and chunky.
    this.sprite = document.createElement('canvas');
    this.sprite.width = 48;
    this.sprite.height = 44;
    this.spriteCtx = this.sprite.getContext('2d');
    this.def = OMJ.BOSS_TYPES.bonk;
    this.reset();
  }

  reset() {
    this.state = 'off';     // off | entering | fighting | defeated | leaving
    this.level = 0;
    this.def = OMJ.BOSS_TYPES[OMJ.BOSS_ORDER[0]];
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
  }

  get active() { return this.state !== 'off'; }
  get fighting() { return this.state === 'fighting'; }
  get name() { return this.def.name; }
  get leftEdge() { return this.x - this.def.halfW * OMJ.BOSS.scale; }   // where knocked-back attacks hit it
  get bottom() { return this.y + this.def.bodyH * OMJ.BOSS.scale; }

  start(g) {
    const B = OMJ.BOSS;
    this.def = OMJ.BOSS_TYPES[OMJ.BOSS_ORDER[this.level % OMJ.BOSS_ORDER.length]];
    this.sprite.width = this.def.sprite.w;
    this.sprite.height = this.def.sprite.h;
    this.state = 'entering';
    this.x = OMJ.CONFIG.VIEW_W + 60;
    this.y = B.y;
    // Tougher every time the same boss comes back.
    this.maxHealth = this.def.baseHealth + 3 * Math.floor(this.level / OMJ.BOSS_ORDER.length);
    this.health = this.maxHealth;
    this.stateTimer = 0;
    this.attack = null;
    this.burstLeft = 0;
    this.stomp = 0;
    this.cooldown = 1;
    g.announce('WARNING: ' + this.def.name + '!', OMJ.PALETTE.danger);
    if (this.level < OMJ.BOSS_ORDER.length) g.announce(this.def.hint, OMJ.PALETTE.white);
    g.sound.play('bossAlarm');
    g.music.play(this.def.music);
  }

  // ---- Attacks --------------------------------------------------

  // Seconds until an attack launched now would reach the player.
  arrivalTime(attack, g) {
    const p = g.player;
    const speed = g.worldSpeed;
    if (attack.special === 'stomp') {
      // It slams down first, then the wave starts at its left side.
      return this.stompDropTime() + (this.quakeStartX() - (p.x + p.w)) / (speed + 140);
    }
    const fromX = this.x - 8;
    const distance = fromX - (p.x + p.w);
    // Time to fall from the boss to the ground (for dropped things).
    const fall = (height) => Math.sqrt((2 * (OMJ.CONFIG.GROUND_Y - height - this.bottom)) / 900);
    switch (attack.type) {
      case 'bomb': return fall(10) + distance / (speed + 30);
      case 'shadowOrb': return fall(10) + distance / (speed + 60);
      case 'spikeball': return fall(12) + distance / speed;
      case 'crate': return fall(16) + distance / speed;
      case 'bat': return distance / (speed + 90);
      default: return distance / (speed + 150);   // fireball, hex bolt
    }
  }

  stompDropTime() { return 0.25; }
  quakeStartX() { return this.leftEdge - 14; }

  launch(attack, g) {
    if (attack.special === 'stomp') {
      this.stomp = 1;
      this.stompTimer = 0;
      g.sound.play('bossThrow');
      return;
    }
    const o = g.obstacles.spawn(attack.type, this.x - 8, attack.variant || 0);
    if (!o) return;
    if (attack.from === 'mouth') {
      o.y = this.y + this.def.mouthY;        // out of its mouth
      g.sound.play(attack.type === 'bat' ? 'bat' : 'fireball');
    } else {
      o.y = this.bottom;                     // dropped from underneath
      if (attack.type === 'crate') o.dropping = true;
      g.sound.play('bossThrow');
    }
  }

  chooseAttack() {
    const list = this.def.attacks;
    let total = 0;
    for (const k in list) total += list[k].weight;
    let roll = Math.random() * total;
    for (const k in list) {
      roll -= list[k].weight;
      if (roll <= 0) return list[k];
    }
    return list[Object.keys(list)[0]];
  }

  // ---- Updating -------------------------------------------------
  update(dt, g) {
    const B = OMJ.BOSS;
    this.time += dt;
    this.stateTimer += dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;

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
        g.announce(this.def.name + ' GOT BORED...', OMJ.PALETTE.metal);
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
    const groundY = OMJ.CONFIG.GROUND_Y - this.def.bodyH * B.scale;   // body resting on the ground
    this.stompTimer += dt;
    if (this.stomp === 1) {
      const t = Math.min(1, this.stompTimer / this.stompDropTime());
      this.y = B.y + (groundY - B.y) * t * t;
      if (t >= 1) {
        this.stomp = 2;
        this.stompTimer = 0;
        g.obstacles.spawn(this.def.wave, this.quakeStartX(), 0);
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
      const minGap = OMJ.Physics.airTime() + B.reaction;
      const arrival = this.time + this.arrivalTime(this.attack, g);
      if (arrival < this.lastArrival + minGap) return;   // hold the pose and wait
      this.launch(this.attack, g);
      this.lastArrival = arrival;
      if (--this.burstLeft > 0) {
        this.windUpTimer = 0.1;          // next one of the burst
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
      this.burstLeft = this.attack.count || 1;
      this.windUpTimer = B.windUp;
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
    g.onBossEnd(defeated, OMJ.BOSS.reward * this.level, this.def.name);
  }

  // ---- Drawing --------------------------------------------------

  // Draws Big Bonk at normal size. (x, y) is the top-left of its body.
  drawBonk(ctx, x, y) {
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
    const fire = this.attack !== null && this.attack.from === 'mouth';
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 10, y + 18, 20, 6);
    ctx.fillStyle = fire ? P.gold : '#2a2540';
    ctx.fillRect(x + 11, y + 19, 18, 4);
    ctx.fillStyle = P.ink;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 14 + i * 4, y + 19, 1, 4);
  }

  // Draws Gloomwing at normal size. (x, y) is the top-left of its body
  // (28 x 26); the wings spread 20 px out on each side.
  drawGloomwing(ctx, x, y) {
    const P = OMJ.PALETTE;
    const hurt = this.hurtTimer > 0;
    const angry = this.attack !== null;
    const body = hurt ? P.white : '#3b2a5c';
    const shade = hurt ? P.white : '#24183d';
    const belly = hurt ? P.white : '#5a4685';
    const skin = hurt ? P.white : '#2a1d45';          // wing membrane
    const sx = angry && Math.floor(this.time * 30) % 2 ? 1 : 0;
    x += sx;

    // Wings: flap up, level, down (faster while winding up an attack).
    const flap = [-9, -2, 6, -2][Math.floor(this.time * (angry ? 14 : 8)) % 4];
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 20; i++) {
        const k = i / 19;                                // 0 at the body, 1 at the tip
        const top = Math.round(y + 7 + flap * k - 3 * Math.sin(k * Math.PI));
        let thick = Math.round(16 - 13 * k);
        if (i % 7 >= 5) thick -= 3;                      // scalloped edge
        const cx = side === 0 ? x - 1 - i : x + 28 + i;
        ctx.fillStyle = P.ink;
        ctx.fillRect(cx, top - 1, 1, thick + 2);
        ctx.fillStyle = skin;
        ctx.fillRect(cx, top + 1, 1, Math.max(0, thick - 1));
        ctx.fillStyle = hurt ? P.white : '#6b55a0';      // the arm bone along the top
        ctx.fillRect(cx, top, 1, 1);
        if (i === 7 || i === 14) {                       // finger bones
          ctx.fillStyle = P.ink;
          ctx.fillRect(cx, top + 1, 1, Math.max(0, thick - 2));
        }
      }
    }

    // Pointy ears
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 3, y - 6, 5, 8); ctx.fillRect(x + 20, y - 6, 5, 8);
    ctx.fillStyle = body;
    ctx.fillRect(x + 4, y - 4, 3, 6); ctx.fillRect(x + 21, y - 4, 3, 6);
    ctx.fillStyle = hurt ? P.white : '#c77dff';
    ctx.fillRect(x + 5, y - 2, 1, 3); ctx.fillRect(x + 22, y - 2, 1, 3);

    // Body
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 1, y, 26, 26);
    ctx.fillRect(x, y + 2, 28, 22);
    ctx.fillStyle = body;
    ctx.fillRect(x + 2, y + 1, 24, 24);
    ctx.fillRect(x + 1, y + 3, 26, 20);
    ctx.fillStyle = shade;
    ctx.fillRect(x + 1, y + 19, 26, 4);
    ctx.fillRect(x + 2, y + 23, 24, 2);
    ctx.fillStyle = belly;                               // fuzzy belly
    ctx.fillRect(x + 8, y + 15, 12, 8);
    ctx.fillStyle = shade;
    ctx.fillRect(x + 9, y + 17, 1, 1); ctx.fillRect(x + 13, y + 19, 1, 1); ctx.fillRect(x + 17, y + 17, 1, 1);
    ctx.fillStyle = hurt ? P.white : '#4d3a75';          // shine on its head
    ctx.fillRect(x + 4, y + 2, 6, 1);

    // Crescent-moon amulet
    ctx.fillStyle = P.gold;
    ctx.fillRect(x + 12, y + 22, 4, 3);
    ctx.fillStyle = belly;
    ctx.fillRect(x + 14, y + 22, 2, 2);

    // Glowing eyes: yellow, or red while winding up an attack.
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 4, y + 6, 8, 6);
    ctx.fillRect(x + 16, y + 6, 8, 6);
    ctx.fillStyle = angry ? P.danger : P.gold;
    ctx.fillRect(x + 5, y + 7, 6, 4);
    ctx.fillRect(x + 17, y + 7, 6, 4);
    ctx.fillStyle = angry ? '#ffb3a8' : '#fff2a8';
    ctx.fillRect(x + 5, y + 7, 2, 1); ctx.fillRect(x + 17, y + 7, 2, 1);
    ctx.fillStyle = P.ink;                               // slit pupils + mean brows
    ctx.fillRect(x + 8, y + 7, 1, 4); ctx.fillRect(x + 19, y + 7, 1, 4);
    ctx.fillRect(x + 3, y + 4, 4, 1); ctx.fillRect(x + 7, y + 5, 4, 1);
    ctx.fillRect(x + 21, y + 4, 4, 1); ctx.fillRect(x + 17, y + 5, 4, 1);

    // Mouth with fangs; glows purple when something is coming out.
    const mouth = angry && this.attack.from === 'mouth';
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 8, y + 13, 12, mouth ? 4 : 2);
    if (mouth) {
      ctx.fillStyle = '#c77dff';
      ctx.fillRect(x + 9, y + 14, 10, 2);
    }
    ctx.fillStyle = P.white;
    ctx.fillRect(x + 9, y + 13, 2, 3); ctx.fillRect(x + 17, y + 13, 2, 3);

    // Little clawed feet
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 7, y + 25, 4, 3); ctx.fillRect(x + 17, y + 25, 4, 3);
    ctx.fillStyle = P.metalLight;
    ctx.fillRect(x + 7, y + 27, 1, 1); ctx.fillRect(x + 10, y + 27, 1, 1);
    ctx.fillRect(x + 17, y + 27, 1, 1); ctx.fillRect(x + 20, y + 27, 1, 1);
  }

  draw(ctx, g) {
    if (!this.active) return;
    const s = OMJ.BOSS.scale;
    // Draw at 1x into the sprite canvas...
    const c = this.spriteCtx;
    const w = this.sprite.width;
    const h = this.sprite.height;
    const d = this.def;
    c.clearRect(0, 0, w, h);
    d.draw(this, c, d.sprite.bodyX, d.sprite.bodyY);
    // ...then copy it to the screen at double size.
    const dx = Math.round(this.x) - (d.sprite.bodyX + d.halfW) * s;
    const dy = Math.round(this.y) - d.sprite.bodyY * s;
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

  // Health bar at the top of the screen.
  drawHud(ctx) {
    if (!this.active || this.state === 'leaving') return;
    const F = OMJ.PixelFont;
    const P = OMJ.PALETTE;
    const cx = OMJ.CONFIG.VIEW_W / 2 - 20;
    F.drawShadowed(ctx, this.def.name, cx, 7, 1, P.white, P.ink, 'center');
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
