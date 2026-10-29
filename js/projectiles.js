// =====================================================================
// projectiles.js — the player's auto-aiming blaster and its shots.
// =====================================================================

class Projectile {
  constructor(x, y, dirX, dirY, stats) {
    this.x = x;
    this.y = y;
    this.dirX = dirX; // direction, length 1
    this.dirY = dirY;
    this.speed = stats.projectileSpeed;
    this.damage = stats.damage;
    this.pierceLeft = stats.pierce; // extra enemies it may pass through
    this.life = stats.projectileLifetime;
    this.radius = 2;
    this.dead = false;
    // Remember who we already hit, so a piercing shot can't hit
    // the same enemy twice while passing through it.
    this.alreadyHit = new Set();
  }

  update(dt) {
    this.x += this.dirX * this.speed * dt;
    this.y += this.dirY * this.speed * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;

    // Shots that reach a wall fizzle with a tiny spark.
    const insideArena =
      this.x >= ARENA.x && this.x < ARENA.x + ARENA.width &&
      this.y >= ARENA.y && this.y < ARENA.y + ARENA.height;
    if (!insideArena) {
      this.dead = true;
      Effects.burst(clamp(this.x, ARENA.x, ARENA.x + ARENA.width - 1), clamp(this.y, ARENA.y, ARENA.y + ARENA.height - 1),
        2, SPARK_COLORS.wall, { maxSpeed: 30, life: 0.15 });
    }
  }

  // A bolt is 4 pixels in a line: white tip, cyan body, blue tail.
  // Each pixel is placed on the whole-pixel grid so it stays sharp.
  draw(ctx) {
    const colors = [PALETTE.white, PALETTE.cyan, PALETTE.cyan, PALETTE.blue];
    for (let i = colors.length - 1; i >= 0; i--) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(Math.round(this.x - this.dirX * i), Math.round(this.y - this.dirY * i), 1, 1);
    }
  }
}

// The weapon fires on its own. All its numbers live in `stats`,
// so upgrades only need to change those numbers.
class Weapon {
  constructor() {
    this.stats = { ...WEAPON_CONFIG }; // a copy, so upgrades don't change the defaults
    this.cooldown = 0.3; // short delay before the very first shot
    this.muzzleFlash = 0; // > 0 while the little flash is visible
    this.flashX = 0;
    this.flashY = 0;
  }

  update(dt, player, enemies, projectiles) {
    this.cooldown -= dt;
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    if (this.cooldown > 0) return;

    const target = findNearestEnemy(player.x, player.y, enemies, this.stats.range);
    if (!target) {
      this.cooldown = 0; // ready to fire the moment something comes in range
      return;
    }
    if (projectiles.length >= MAX_PROJECTILES) return;

    // Aim from the player's chest toward the target.
    const startX = player.x;
    const startY = player.y - 1;
    const aim = Math.atan2(target.y - startY, target.x - startX);

    // Multi-shot: extra bolts fan out evenly on both sides of the aim.
    // For 3 bolts the offsets are -1, 0, +1 times the spread angle.
    const count = this.stats.projectileCount;
    for (let i = 0; i < count; i++) {
      if (projectiles.length >= MAX_PROJECTILES) break;
      const angle = aim + (i - (count - 1) / 2) * MULTISHOT_SPREAD;
      projectiles.push(new Projectile(startX, startY, Math.cos(angle), Math.sin(angle), this.stats));
    }

    this.cooldown = this.stats.fireInterval;
    this.muzzleFlash = 0.05;
    this.flashX = startX + Math.cos(aim) * 5;
    this.flashY = startY + Math.sin(aim) * 5;
  }

  draw(ctx) {
    if (this.muzzleFlash <= 0) return;
    // A tiny white "plus" right where the shot leaves the blaster.
    const x = Math.round(this.flashX);
    const y = Math.round(this.flashY);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillRect(x, y - 1, 1, 3);
  }
}

// The closest living enemy within `range` pixels, or null.
function findNearestEnemy(x, y, enemies, range) {
  let nearest = null;
  let nearestDistSq = range * range;
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistSq) {
      nearest = enemy;
      nearestDistSq = distSq;
    }
  }
  return nearest;
}
