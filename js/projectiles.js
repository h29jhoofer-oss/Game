// =====================================================================
// projectiles.js — the player's weapon and its bullets.
//
// One Weapon class handles every gun in guns.js. The gun decides how to
// aim and what its bullets look like; `weapon.stats` holds the numbers,
// so upgrades only need to change those numbers.
// =====================================================================

// Sparks when a bullet hits something, by bullet style.
const BULLET_SPARKS = {
  bolt: [PALETTE.white, PALETTE.cyan, PALETTE.cyanDim],
  pellet: [PALETTE.white, PALETTE.yellow, PALETTE.orange],
  sniper: [PALETTE.white, '#b6ffc8', PALETTE.green],
  smg: [PALETTE.white, '#d08aff', PALETTE.purple],
};

class Projectile {
  // `target` is only used by homing bullets (the Sniper).
  constructor(x, y, dirX, dirY, stats, style, target = null) {
    this.x = x;
    this.y = y;
    this.dirX = dirX; // direction, length 1
    this.dirY = dirY;
    this.style = style;
    this.speed = stats.projectileSpeed;
    // Base damage x the hero's multiplier x the gun's multiplier.
    this.damage = stats.damage * stats.damageMultiplier * stats.gunDamage;
    // Critical hits (a Sniper upgrade): sometimes triple damage.
    this.crit = Math.random() < stats.critChance;
    if (this.crit) this.damage *= 3;
    this.pierceLeft = stats.pierce; // extra enemies it may pass through
    this.knockback = stats.hitKnockback; // how far a hit pushes an enemy
    this.life = stats.projectileLifetime;
    this.radius = style === 'pellet' ? 3 : 2; // pellets are a bit bigger
    this.homing = stats.homing;
    this.target = target;
    this.dead = false;
    // Remember who we already hit, so a piercing shot can't hit
    // the same enemy twice while passing through it.
    this.alreadyHit = new Set();
  }

  getSparkColors() {
    return BULLET_SPARKS[this.style];
  }

  update(dt) {
    if (this.homing > 0 && this.target && !this.target.dead) this.steerTowardTarget(dt);

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
        2, this.getSparkColors(), { maxSpeed: 30, life: 0.15 });
    }
  }

  // Turn a little toward the target each frame. `homing` is the most it
  // may turn per second, so the bullet curves instead of snapping.
  steerTowardTarget(dt) {
    const current = Math.atan2(this.dirY, this.dirX);
    const wanted = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    // The difference, wrapped to between -PI and PI so it turns the short way.
    let difference = wanted - current;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    const maxTurn = this.homing * dt;
    const angle = current + clamp(difference, -maxTurn, maxTurn);
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
  }

  // Each style is a short line of pixels along the direction of travel,
  // brightest at the front. Every pixel lands on the whole-pixel grid.
  draw(ctx) {
    if (this.style === 'pellet') {
      // A chunky 2x2 orange pellet with a yellow hot spot and a short tail.
      const x = Math.round(this.x);
      const y = Math.round(this.y);
      ctx.fillStyle = '#a34a0a';
      ctx.fillRect(Math.round(this.x - this.dirX * 2), Math.round(this.y - this.dirY * 2), 1, 1);
      ctx.fillStyle = PALETTE.orange;
      ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.fillStyle = PALETTE.yellow;
      ctx.fillRect(x - 1, y - 1, 1, 1);
      return;
    }
    if (this.style === 'smg') {
      // Small and quick: just 2 pixels, light purple tip, purple tail.
      ctx.fillStyle = PALETTE.purple;
      ctx.fillRect(Math.round(this.x - this.dirX), Math.round(this.y - this.dirY), 1, 1);
      ctx.fillStyle = '#d08aff';
      ctx.fillRect(Math.round(this.x), Math.round(this.y), 1, 1);
      return;
    }
    const colors = this.style === 'sniper'
      ? [PALETTE.white, PALETTE.green, PALETTE.green, PALETTE.green, '#139a3c', '#139a3c', '#0b4a20'] // longer, green
      : [PALETTE.white, PALETTE.cyan, PALETTE.cyan, PALETTE.blue]; // the Blaster bolt
    if (this.crit) colors[0] = PALETTE.yellow; // critical hits glow gold at the tip
    for (let i = colors.length - 1; i >= 0; i--) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(Math.round(this.x - this.dirX * i), Math.round(this.y - this.dirY * i), 1, 1);
    }
  }
}

// The weapon fires on its own.
class Weapon {
  constructor(gun) {
    this.gun = gun;
    this.id = gun.id;
    this.stats = { ...gun.stats }; // a copy, so upgrades don't change the gun's defaults
    this.cooldown = 0.3; // short delay before the very first shot
    this.muzzleFlash = 0; // > 0 while the little flash is visible
    this.flashX = 0;
    this.flashY = 0;
    // Twin Shot: follow-up volleys waiting to fire, each { delay, target, aim }.
    this.followUps = [];
  }

  update(dt, player, enemies, projectiles) {
    this.cooldown -= dt;
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    this.updateFollowUps(dt, player, projectiles);
    if (this.cooldown > 0) return;

    const target = this.pickTarget(player, enemies);
    if (!target) {
      this.cooldown = 0; // ready to fire the moment something comes in range
      return;
    }
    if (projectiles.length >= MAX_PROJECTILES) return;

    // The Shotgun fires the way you're moving; the others aim at their target.
    const aim = this.gun.aim === 'movement' ? Math.atan2(player.aimY, player.aimX) : this.aimAt(player, target);
    this.fireVolley(player, aim, projectiles, target);
    this.cooldown = this.stats.fireInterval;

    // Twin Shot: queue extra volleys that fire a split second later along
    // the same line, at the same monster.
    for (let i = 1; i <= this.stats.burstExtra; i++) {
      this.followUps.push({ delay: i * TWIN_SHOT_GAP, target, aim });
    }
  }

  // Which enemy (if any) the gun wants to shoot at right now.
  pickTarget(player, enemies) {
    if (this.gun.aim === 'sniper') return findSniperTarget(player.x, player.y, enemies, this.stats.range);
    // Blaster: the nearest enemy. Shotgun: any enemy close enough is
    // a reason to fire (it still shoots the way you're moving).
    return findNearestEnemy(player.x, player.y, enemies, this.stats.range);
  }

  // Angle from the player's chest to a target.
  aimAt(player, target) {
    return Math.atan2(target.y - (player.y - 1), target.x - player.x);
  }

  updateFollowUps(dt, player, projectiles) {
    for (const followUp of this.followUps) {
      followUp.delay -= dt;
      if (followUp.delay > 0) continue;
      // Re-aim at the same monster if it's still alive (you or it may have
      // moved a little). If it already died, keep the original direction.
      if (!followUp.target.dead) followUp.aim = this.aimAt(player, followUp.target);
      this.fireVolley(player, followUp.aim, projectiles, followUp.target);
    }
    this.followUps = this.followUps.filter((followUp) => followUp.delay > 0);
  }

  // One volley: a single bullet, or a fan of them (Shotgun, SMG Spray).
  fireVolley(player, aim, projectiles, target) {
    const startX = player.x;
    const startY = player.y - 1;

    // Bullets fan out evenly on both sides of the aim.
    // For 3 bullets the offsets are -1, 0, +1 times the spread angle.
    const count = this.stats.projectileCount;
    const homingTarget = this.stats.homing > 0 ? target : null;
    for (let i = 0; i < count; i++) {
      if (projectiles.length >= MAX_PROJECTILES) break;
      const angle = aim + (i - (count - 1) / 2) * this.stats.spread;
      projectiles.push(new Projectile(startX, startY, Math.cos(angle), Math.sin(angle), this.stats, this.gun.style, homingTarget));
    }

    this.muzzleFlash = 0.05;
    Sound.play(this.gun.sound);
    this.flashX = startX + Math.cos(aim) * 5;
    this.flashY = startY + Math.sin(aim) * 5;
  }

  draw(ctx) {
    if (this.muzzleFlash <= 0) return;
    // A tiny "plus" right where the shot leaves the gun, in the gun's color.
    const x = Math.round(this.flashX);
    const y = Math.round(this.flashY);
    ctx.fillStyle = this.gun.style === 'bolt' ? PALETTE.white : this.gun.uiColor;
    ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillRect(x, y - 1, 1, 3);
  }
}

// The closest living enemy within `range` pixels, or null.
function findNearestEnemy(x, y, enemies, range) {
  let nearest = null;
  let nearestDistSq = range * range;
  for (const enemy of enemies) {
    if (enemy.dead || enemy.isFalling()) continue;
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

// The Sniper's choice:
//   1. a monster that's dangerously close (so it can defend itself),
//   2. otherwise the nearest Shooter in range,
//   3. otherwise the farthest enemy it can reach.
const SNIPER_DANGER_CLOSE = 45; // pixels
function findSniperTarget(x, y, enemies, range) {
  const tooClose = findNearestEnemy(x, y, enemies, SNIPER_DANGER_CLOSE);
  if (tooClose) return tooClose;

  let shooter = null;
  let shooterDistSq = Infinity;
  let farthest = null;
  let farthestDistSq = -1;
  for (const enemy of enemies) {
    if (enemy.dead || enemy.isFalling()) continue;
    const distSq = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
    if (distSq > range * range) continue;
    if (enemy.type === 'shooter' && distSq < shooterDistSq) {
      shooter = enemy;
      shooterDistSq = distSq;
    }
    if (distSq > farthestDistSq) {
      farthest = enemy;
      farthestDistSq = distSq;
    }
  }
  return shooter || farthest;
}
