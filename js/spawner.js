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
//   - Chasers get faster, then tougher (+1 health every 100 seconds).
//   - Small packs of 2-3 become more common.
//   - Every 40-55 seconds a "swarm surge" rings the player from all sides.
// =====================================================================

class Spawner {
  constructor() {
    this.timer = 1.0; // the first enemy comes after 1 second
    this.warnings = []; // spots where an enemy is about to appear
    this.surgeTimer = SURGE_CONFIG.firstSurge;
    this.surgeBannerTime = 0; // > 0 while "SWARM!" is shown
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

  // Chasers gain 1 health every `healthGrowthTime` seconds.
  getChaserHealth(survivalTime) {
    return CHASER_CONFIG.health + Math.floor(survivalTime / CHASER_CONFIG.healthGrowthTime);
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

    // 2. Swarm surges.
    this.surgeTimer -= dt;
    this.surgeBannerTime = Math.max(0, this.surgeBannerTime - dt);
    if (this.surgeTimer <= 0) {
      this.surgeTimer = randomRange(SURGE_CONFIG.minGap, SURGE_CONFIG.maxGap);
      this.spawnSurge(survivalTime, player, enemies);
    }

    // 3. Turn finished warnings into real enemies.
    for (const warning of this.warnings) {
      warning.time -= dt;
      if (warning.time <= 0) {
        enemies.push(new Chaser(warning.x, warning.y, this.getChaserSpeed(survivalTime), this.getChaserHealth(survivalTime)));
      }
    }
    this.warnings = this.warnings.filter((warning) => warning.time > 0);
  }

  // One enemy, or sometimes a small pack, near a wall.
  spawnGroup(survivalTime, player, enemies) {
    const spot = this.pickSpawnPoint(player);
    // Packs become more common the longer you survive.
    const groupChance = SPAWN_CONFIG.groupChanceMax * Math.min(1, survivalTime / SPAWN_CONFIG.groupChanceRampTime);
    const groupSize = Math.random() < groupChance ? randomInt(2, 3) : 1;
    const count = Math.min(groupSize, this.roomLeft(enemies));
    for (let i = 0; i < count; i++) {
      const spread = i === 0 ? 0 : SPAWN_CONFIG.groupSpread;
      this.addWarning(spot.x + randomRange(-spread, spread), spot.y + randomRange(-spread, spread), SPAWN_CONFIG.warningTime);
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
      );
    }
    this.surgeBannerTime = 1.6;
  }

  addWarning(x, y, time) {
    this.warnings.push({
      x: clamp(x, ARENA.x + 6, ARENA.x + ARENA.width - 6),
      y: clamp(y, ARENA.y + 6, ARENA.y + ARENA.height - 6),
      time,
      totalTime: time,
    });
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

  // Warning marker: four little red corner brackets that blink.
  draw(ctx) {
    for (const warning of this.warnings) {
      if (Math.floor(warning.time / 0.08) % 2 === 0) continue; // blink
      const x = Math.round(warning.x);
      const y = Math.round(warning.y);
      // The brackets close in as the enemy is about to arrive.
      const size = 3 + Math.ceil((warning.time / warning.totalTime) * 3);
      ctx.fillStyle = PALETTE.red;
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
