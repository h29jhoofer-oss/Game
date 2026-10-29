// =====================================================================
// spawner.js — decides when and where new enemies appear.
//
// Before an enemy appears, a flashing warning marker shows the spot for
// a moment. That way enemies never pop into existence right next to you
// without warning, which would feel unfair.
// =====================================================================

class Spawner {
  constructor() {
    this.timer = 1.0; // the first enemy comes after 1 second
    this.warnings = []; // spots where an enemy is about to appear
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

  update(dt, survivalTime, player, enemies) {
    // 1. Count down to the next spawn.
    this.timer -= dt;
    const roomLeft = SPAWN_CONFIG.maxEnemies - enemies.length - this.warnings.length;
    if (this.timer <= 0 && roomLeft > 0) {
      // Small random variation so spawns don't feel like a metronome.
      this.timer = this.getInterval(survivalTime) * randomRange(0.75, 1.25);
      const spot = this.pickSpawnPoint(player);
      // Sometimes a small pack arrives together from the same spot.
      // Packs become more common the longer you survive.
      const groupChance = SPAWN_CONFIG.groupChanceMax * Math.min(1, survivalTime / SPAWN_CONFIG.groupChanceRampTime);
      const groupSize = Math.random() < groupChance ? randomInt(2, 3) : 1;
      for (let i = 0; i < Math.min(groupSize, roomLeft); i++) {
        const spread = i === 0 ? 0 : SPAWN_CONFIG.groupSpread;
        this.warnings.push({
          x: clamp(spot.x + randomRange(-spread, spread), ARENA.x + 6, ARENA.x + ARENA.width - 6),
          y: clamp(spot.y + randomRange(-spread, spread), ARENA.y + 6, ARENA.y + ARENA.height - 6),
          time: SPAWN_CONFIG.warningTime,
        });
      }
    }

    // 2. Turn finished warnings into real enemies.
    for (const warning of this.warnings) {
      warning.time -= dt;
      if (warning.time <= 0) {
        enemies.push(new Chaser(warning.x, warning.y, this.getChaserSpeed(survivalTime)));
      }
    }
    this.warnings = this.warnings.filter((warning) => warning.time > 0);
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
      const size = 3 + Math.ceil((warning.time / SPAWN_CONFIG.warningTime) * 3);
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
