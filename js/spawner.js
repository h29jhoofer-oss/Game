// =====================================================================
// spawner.js — decides when and where new enemies appear, and how the
// difficulty grows over time.
//
// Before an enemy appears, a flashing warning marker shows the spot for
// a moment. That way enemies never pop into existence right next to you
// without warning, which would feel unfair.
//
// The difficulty curve (all numbers are in config.js):
//   - Spawns get more frequent over time.
//   - Chasers get faster; every enemy gets tougher every 100 seconds.
//   - Small packs of 2-3 chasers become more common.
//   - Toxic Slimes join after 25 s, Shooters after 40 s, Sprinters after
//     60 s, Brutes after 90 s.
//   - At 90 s the boss (King Slime) arrives, once.
//   - Every 40-55 seconds a "swarm surge" rings the player from all sides.
// =====================================================================

class Spawner {
  constructor() {
    this.timer = 1.0; // the first enemy comes after 1 second
    this.warnings = []; // spots where an enemy is about to appear
    this.surgeTimer = SURGE_CONFIG.firstSurge;
    // A message shown at the top of the arena, like "SWARM INCOMING!".
    this.banner = { text: '', color: PALETTE.red, time: 0 };
    this.introduced = new Set(); // enemy types we've already announced
    this.bossSpawned = false;
  }

  showBanner(text, color, time = 1.6) {
    this.banner = { text, color, time };
    Sound.play('alarm');
  }

  // How many seconds between spawns, given how long the run has lasted.
  getInterval(survivalTime) {
    const interval = SPAWN_CONFIG.startInterval - survivalTime * SPAWN_CONFIG.intervalDropPerSecond;
    return Math.max(SPAWN_CONFIG.minInterval, interval);
  }

  // Chasers speed up slowly over time, up to a limit.
  getChaserSpeed(survivalTime) {
    const progress = Math.min(1, survivalTime / CHASER_CONFIG.speedRampTime);
    return CHASER_CONFIG.baseSpeed + CHASER_CONFIG.maxExtraSpeed * progress;
  }

  // Every enemy type gets a little tougher every HEALTH_GROWTH.interval seconds.
  getHealth(type, survivalTime) {
    const steps = Math.floor(survivalTime / HEALTH_GROWTH.interval);
    const base = {
      chaser: CHASER_CONFIG.health,
      toxic: CHASER_CONFIG.health * TOXIC_CONFIG.healthRatio,
      shooter: SHOOTER_CONFIG.health,
      brute: BRUTE_CONFIG.health,
      sprinter: SPRINTER_CONFIG.health,
    }[type];
    return base + steps * HEALTH_GROWTH[type];
  }

  // How likely each enemy type is to be picked for a regular spawn.
  // Bigger number = more likely. Zero = not allowed yet.
  getTypeWeights(survivalTime, enemies) {
    const weights = { chaser: 10, toxic: 0, sprinter: 0, shooter: 0, brute: 0 };
    if (survivalTime >= SPRINTER_CONFIG.introduceAt) {
      weights.sprinter = Math.min(1.5, 0.6 + (survivalTime - SPRINTER_CONFIG.introduceAt) / 60);
    }
    if (survivalTime >= TOXIC_CONFIG.introduceAt) {
      weights.toxic = Math.min(3, 1 + (survivalTime - TOXIC_CONFIG.introduceAt) / 30);
    }
    if (survivalTime >= SHOOTER_CONFIG.introduceAt) {
      weights.shooter = Math.min(2.5, 0.6 + (survivalTime - SHOOTER_CONFIG.introduceAt) / 30);
    }
    if (survivalTime >= BRUTE_CONFIG.introduceAt) {
      weights.brute = Math.min(1.5, 0.6 + (survivalTime - BRUTE_CONFIG.introduceAt) / 60);
    }
    // Never too many of the special enemies at once, so it stays fair.
    if (this.countType('toxic', enemies) >= TOXIC_CONFIG.maxAlive) weights.toxic = 0;
    if (this.countType('sprinter', enemies) >= SPRINTER_CONFIG.maxAlive) weights.sprinter = 0;
    if (this.countType('shooter', enemies) >= SHOOTER_CONFIG.maxAlive) weights.shooter = 0;
    if (this.countType('brute', enemies) >= BRUTE_CONFIG.maxAlive) weights.brute = 0;
    return weights;
  }

  // Living enemies plus ones that are about to appear.
  countType(type, enemies) {
    return enemies.filter((e) => e.type === type).length + this.warnings.filter((w) => w.type === type).length;
  }

  // Pick a random key from { name: weight }, where heavier weights win more often.
  pickWeighted(weights) {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    for (const [name, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll < 0) return name;
    }
    return 'chaser';
  }

  createEnemy(type, x, y, survivalTime) {
    if (type === 'boss') return new Boss(x, y, this.getChaserSpeed(survivalTime));
    const health = this.getHealth(type, survivalTime);
    if (type === 'sprinter') return new Sprinter(x, y, health);
    if (type === 'shooter') return new Shooter(x, y, health);
    if (type === 'brute') return new Brute(x, y, health);
    if (type === 'toxic') return new ToxicSlime(x, y, this.getChaserSpeed(survivalTime), health);
    return new Chaser(x, y, this.getChaserSpeed(survivalTime), health);
  }

  roomLeft(enemies) {
    return SPAWN_CONFIG.maxEnemies - enemies.length - this.warnings.length;
  }

  update(dt, survivalTime, player, enemies) {
    // 1. Regular spawns.
    this.timer -= dt;
    if (this.timer <= 0 && this.roomLeft(enemies) > 0) {
      // Small random variation so spawns don't feel like a metronome.
      this.timer = this.getInterval(survivalTime) * randomRange(0.75, 1.25);
      this.spawnGroup(survivalTime, player, enemies);
    }

    // 2. The boss arrives once, at 90 seconds, on the far side from you.
    if (!this.bossSpawned && survivalTime >= BOSS_CONFIG.spawnAt) {
      this.bossSpawned = true;
      const spot = this.pickFarSpot(player);
      this.addWarning(spot.x, spot.y, BOSS_CONFIG.warningTime, 'boss');
      this.showBanner('BOSS INCOMING!', PALETTE.red, BOSS_CONFIG.warningTime + 0.6);
    }

    // 3. Swarm surges.
    this.surgeTimer -= dt;
    this.banner.time = Math.max(0, this.banner.time - dt);
    if (this.surgeTimer <= 0) {
      this.surgeTimer = randomRange(SURGE_CONFIG.minGap, SURGE_CONFIG.maxGap);
      this.spawnSurge(survivalTime, player, enemies);
    }

    // 4. Turn finished warnings into real enemies.
    for (const warning of this.warnings) {
      warning.time -= dt;
      if (warning.time <= 0) {
        enemies.push(this.createEnemy(warning.type, warning.x, warning.y, survivalTime));
      }
    }
    this.warnings = this.warnings.filter((warning) => warning.time > 0);
  }

  // One enemy, or sometimes a small pack of chasers, near a wall.
  spawnGroup(survivalTime, player, enemies) {
    const spot = this.pickSpawnPoint(player);
    const type = this.pickWeighted(this.getTypeWeights(survivalTime, enemies));

    if (type !== 'chaser') {
      // The first time a new enemy type shows up, announce it.
      if (!this.introduced.has(type)) {
        this.introduced.add(type);
        if (type === 'toxic') this.showBanner('NEW ENEMY: TOXIC SLIME', PALETTE.green, 2.2);
        if (type === 'sprinter') this.showBanner('NEW ENEMY: SPRINTER', PALETTE.yellow, 2.2);
        if (type === 'shooter') this.showBanner('NEW ENEMY: SHOOTER', PALETTE.purple, 2.2);
        if (type === 'brute') this.showBanner('NEW ENEMY: BRUTE', PALETTE.orange, 2.2);
      }
      this.addWarning(spot.x, spot.y, SPAWN_CONFIG.warningTime, type);
      return;
    }

    // Packs become more common the longer you survive.
    const groupChance = SPAWN_CONFIG.groupChanceMax * Math.min(1, survivalTime / SPAWN_CONFIG.groupChanceRampTime);
    const groupSize = Math.random() < groupChance ? randomInt(2, 3) : 1;
    const count = Math.min(groupSize, this.roomLeft(enemies));
    for (let i = 0; i < count; i++) {
      const spread = i === 0 ? 0 : SPAWN_CONFIG.groupSpread;
      this.addWarning(spot.x + randomRange(-spread, spread), spot.y + randomRange(-spread, spread), SPAWN_CONFIG.warningTime, 'chaser');
    }
  }

  // A ring of enemies around the player that you have to break out of
  // (dashing through it works well!).
  spawnSurge(survivalTime, player, enemies) {
    const minutes = survivalTime / 60;
    const wanted = Math.min(SURGE_CONFIG.maxCount, Math.round(SURGE_CONFIG.baseCount + minutes * SURGE_CONFIG.extraPerMinute));
    const count = Math.min(wanted, this.roomLeft(enemies));
    if (count <= 0) return;

    const startAngle = randomRange(0, Math.PI * 2); // a different ring every time
    for (let i = 0; i < count; i++) {
      const angle = startAngle + (i / count) * Math.PI * 2;
      this.addWarning(
        player.x + Math.cos(angle) * SURGE_CONFIG.ringRadius,
        player.y + Math.sin(angle) * SURGE_CONFIG.ringRadius,
        SURGE_CONFIG.warningTime,
        'chaser',
      );
    }
    this.showBanner('SWARM INCOMING!', PALETTE.red);
  }

  addWarning(x, y, time, type) {
    this.warnings.push({
      type,
      x: clamp(x, ARENA.x + 6, ARENA.x + ARENA.width - 6),
      y: clamp(y, ARENA.y + 6, ARENA.y + ARENA.height - 6),
      time,
      totalTime: time,
    });
  }

  // The middle of whichever half of the arena the player is NOT in.
  pickFarSpot(player) {
    const centerX = ARENA.x + ARENA.width / 2;
    const x = player.x < centerX ? ARENA.x + ARENA.width - 30 : ARENA.x + 30;
    return { x, y: ARENA.y + ARENA.height / 2 };
  }

  // Choose a random point near one of the four walls, far enough from the player.
  pickSpawnPoint(player) {
    const m = SPAWN_CONFIG.edgeMargin;
    const left = ARENA.x + 6;
    const right = ARENA.x + ARENA.width - 6;
    const top = ARENA.y + 6;
    const bottom = ARENA.y + ARENA.height - 6;

    let best = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      let x;
      let y;
      const side = randomInt(0, 3); // 0 = top, 1 = right, 2 = bottom, 3 = left
      if (side === 0) { x = randomRange(left, right); y = randomRange(top, top + m); }
      if (side === 1) { x = randomRange(right - m, right); y = randomRange(top, bottom); }
      if (side === 2) { x = randomRange(left, right); y = randomRange(bottom - m, bottom); }
      if (side === 3) { x = randomRange(left, left + m); y = randomRange(top, bottom); }

      const distance = Math.hypot(x - player.x, y - player.y);
      if (distance >= SPAWN_CONFIG.minDistanceFromPlayer) return { x, y };
      // Remember the farthest spot in case every attempt is too close.
      if (!best || distance > best.distance) best = { x, y, distance };
    }
    return best;
  }

  // Warning marker: four little corner brackets that blink, colored
  // like the enemy that's coming. Brutes get a bigger marker.
  draw(ctx) {
    const colors = { chaser: PALETTE.red, toxic: PALETTE.green, sprinter: PALETTE.yellow, shooter: PALETTE.purple, brute: PALETTE.orange, boss: PALETTE.red };
    for (const warning of this.warnings) {
      if (Math.floor(warning.time / 0.08) % 2 === 0) continue; // blink
      const x = Math.round(warning.x);
      const y = Math.round(warning.y);
      // The brackets close in as the enemy is about to arrive.
      const baseSize = warning.type === 'boss' ? 16 : warning.type === 'brute' ? 6 : 3;
      const size = baseSize + Math.ceil((warning.time / warning.totalTime) * 3);
      ctx.fillStyle = colors[warning.type];
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const cx = x + sx * size;
          const cy = y + sy * size;
          ctx.fillRect(cx, cy, 1, 1);
          ctx.fillRect(cx - sx, cy, 1, 1);
          ctx.fillRect(cx, cy - sy, 1, 1);
        }
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
