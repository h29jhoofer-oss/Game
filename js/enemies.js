// =====================================================================
// enemies.js — enemy behavior.
//
// `Enemy` holds everything all enemies share (position, health, being
// knocked back, drawing). Each enemy type is a small class that
// "extends" Enemy and only adds what makes it different:
//
//   Chaser  — runs straight at you
//   Toxic   — a weaker green chaser that leaves poison gas when defeated
//   Shooter — keeps its distance, circles you, and fires slow shots
//   Brute   — big, slow, very tough, barely flinches
// =====================================================================

class Enemy {
  constructor(x, y, settings) {
    this.type = settings.type; // 'chaser', 'toxic', 'shooter' or 'brute'
    this.x = x;
    this.y = y;
    this.radius = settings.radius;
    this.health = settings.health;
    this.speed = settings.speed;
    this.sprites = settings.sprites; // { frameName: spriteSet }
    this.frameNames = Object.keys(settings.sprites);
    this.frameTime = settings.frameTime;
    this.width = settings.width;
    this.height = settings.height;
    this.energyValue = settings.energyValue; // energy dropped when defeated
    this.scoreValue = settings.scoreValue; // points for defeating it
    this.explosionColors = settings.explosionColors;
    this.explosionSize = settings.explosionSize;
    this.knockbackScale = settings.knockbackScale ?? 1; // 1 = normal, 0 = can't be pushed

    // Knockback velocity: added on top of normal movement, fades quickly.
    this.pushX = 0;
    this.pushY = 0;

    this.facing = 1;
    this.animTime = Math.random(); // so enemies don't all animate in sync
    this.flashTime = 0.12; // flash white for a moment when appearing
    this.dead = false; // dead enemies are removed at the end of the frame
  }

  // Each enemy type overrides this to decide where it wants to go.
  // It should return a direction {x, y} with a length of 1 (or 0).
  think(player) {
    return { x: 0, y: 0 };
  }

  // `world` is the Game object, so enemies can create things like shots.
  update(dt, player, world) {
    const dir = this.think(player);
    if (dir.x !== 0) this.facing = Math.sign(dir.x);

    // Knockback fades out exponentially (same at any frame rate).
    const fade = Math.exp(-8 * dt);
    this.pushX *= fade;
    this.pushY *= fade;

    this.x += (dir.x * this.speed + this.pushX) * dt;
    this.y += (dir.y * this.speed + this.pushY) * dt;
    this.keepInsideArena();

    this.animTime += dt;
    this.flashTime = Math.max(0, this.flashTime - dt);
  }

  // Called when a projectile hits. (dirX, dirY) is the direction the
  // shot was travelling, so the enemy gets pushed the same way.
  // Returns true if this hit defeated the enemy.
  takeDamage(amount, dirX, dirY, knockback) {
    this.health -= amount;
    this.flashTime = 0.08;
    this.pushX = dirX * knockback * this.knockbackScale;
    this.pushY = dirY * knockback * this.knockbackScale;
    if (this.health <= 0) this.dead = true;
    return this.dead;
  }

  // Push the enemy away from a point (used when it hits the player).
  knockBackFrom(x, y, strength) {
    const dx = this.x - x;
    const dy = this.y - y;
    const length = Math.hypot(dx, dy) || 1;
    this.pushX = (dx / length) * strength * this.knockbackScale;
    this.pushY = (dy / length) * strength * this.knockbackScale;
  }

  keepInsideArena() {
    const half = this.width / 2;
    this.x = clamp(this.x, ARENA.x + half, ARENA.x + ARENA.width - half);
    this.y = clamp(this.y, ARENA.y + this.height / 2, ARENA.y + ARENA.height - this.height / 2);
  }

  // Which animation frame to show right now.
  getFrameIndex() {
    return Math.floor(this.animTime / this.frameTime) % this.frameNames.length;
  }

  // Which sprite set to draw. Shooter overrides this to glow while charging.
  getSpriteSet() {
    return this.sprites[this.frameNames[this.getFrameIndex()]];
  }

  draw(ctx) {
    const drawX = Math.round(this.x - this.width / 2);
    const drawY = Math.round(this.y - this.height / 2);

    // Shadow under the enemy.
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(drawX + 1, drawY + this.height, this.width - 2, 1);

    const sprite = this.getSpriteSet();
    const image = this.flashTime > 0 ? sprite.ghosts[0] : sprite;
    ctx.drawImage(this.facing === 1 ? image.right : image.left, drawX, drawY);
  }
}

// Direction from one point to another, with a length of 1.
function directionTo(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return { x: 0, y: 0, length };
  return { x: dx / length, y: dy / length, length };
}

// ---------------------------------------------------------------------
// Chaser: walks straight toward the player. Simple, but dangerous in groups.
// ---------------------------------------------------------------------
class Chaser extends Enemy {
  constructor(x, y, speed, health) {
    super(x, y, {
      type: 'chaser',
      radius: CHASER_CONFIG.radius,
      health: health,
      speed: speed,
      sprites: Sprites.chaser,
      frameTime: 0.18,
      width: 8,
      height: 8,
      energyValue: 1,
      scoreValue: CHASER_CONFIG.score,
      explosionColors: SPARK_COLORS.enemy,
      explosionSize: 1,
    });
  }

  think(player) {
    return directionTo(this.x, this.y, player.x, player.y);
  }
}

// ---------------------------------------------------------------------
// Toxic Slime: moves exactly like a Chaser but is a bit weaker. The
// danger comes after you defeat it: game.js turns its death into a
// cloud of poison gas (see hazards.js) that lingers for a while.
// ---------------------------------------------------------------------
class ToxicSlime extends Chaser {
  constructor(x, y, speed, health) {
    super(x, y, speed, health);
    this.type = 'toxic';
    this.sprites = Sprites.toxic;
    this.frameNames = Object.keys(Sprites.toxic);
    this.energyValue = TOXIC_CONFIG.energy;
    this.scoreValue = TOXIC_CONFIG.score;
    this.explosionColors = SPARK_COLORS.toxic;
  }
}

// ---------------------------------------------------------------------
// Shooter: hovers at medium range, circling the player, and fires a
// slow shot every few seconds. Its eye glows pink just before it fires.
// ---------------------------------------------------------------------
class Shooter extends Enemy {
  constructor(x, y, health) {
    super(x, y, {
      type: 'shooter',
      radius: SHOOTER_CONFIG.radius,
      health: health,
      speed: SHOOTER_CONFIG.speed,
      sprites: Sprites.shooter,
      frameTime: 0.25,
      width: 9,
      height: 9,
      energyValue: SHOOTER_CONFIG.energy,
      scoreValue: SHOOTER_CONFIG.score,
      explosionColors: SPARK_COLORS.shooter,
      explosionSize: 2,
    });
    // Random start so a group of shooters doesn't fire all at once.
    this.fireTimer = randomRange(1.2, SHOOTER_CONFIG.fireInterval);
    this.orbitDirection = Math.random() < 0.5 ? 1 : -1; // circle clockwise or not
    this.orbitTimer = randomRange(2, 4);
  }

  think(player) {
    const toPlayer = directionTo(this.x, this.y, player.x, player.y);
    // Too far: move in. Too close: back off. In between: circle around.
    if (toPlayer.length > SHOOTER_CONFIG.preferredMax) return toPlayer;
    if (toPlayer.length < SHOOTER_CONFIG.preferredMin) return { x: -toPlayer.x, y: -toPlayer.y };
    // Turning a direction 90 degrees: (x, y) becomes (-y, x).
    return { x: -toPlayer.y * this.orbitDirection, y: toPlayer.x * this.orbitDirection };
  }

  isCharging() {
    return this.fireTimer <= SHOOTER_CONFIG.chargeTime;
  }

  update(dt, player, world) {
    super.update(dt, player, world);

    // Now and then, switch which way it circles.
    this.orbitTimer -= dt;
    if (this.orbitTimer <= 0) {
      this.orbitTimer = randomRange(2, 4);
      this.orbitDirection *= -1;
    }

    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;

    const toPlayer = directionTo(this.x, this.y, player.x, player.y);
    if (toPlayer.length <= SHOOTER_CONFIG.fireRange) {
      world.spawnEnemyShot(this.x, this.y, toPlayer.x, toPlayer.y);
      Effects.burst(this.x, this.y, 3, SPARK_COLORS.shooter, { maxSpeed: 30, life: 0.2 });
    }
    this.fireTimer = SHOOTER_CONFIG.fireInterval * randomRange(0.85, 1.15);
  }

  getSpriteSet() {
    // While charging, blink between the normal and pink-eyed version.
    const frame = this.frameNames[this.getFrameIndex()];
    if (this.isCharging() && Math.floor(this.fireTimer / 0.06) % 2 === 0) return Sprites.shooterCharge[frame];
    return this.sprites[frame];
  }
}

// ---------------------------------------------------------------------
// Brute: slow and huge. Takes many hits, shrugs off knockback, and
// kicks up dust with every stomp.
// ---------------------------------------------------------------------
class Brute extends Enemy {
  constructor(x, y, health) {
    super(x, y, {
      type: 'brute',
      radius: BRUTE_CONFIG.radius,
      health: health,
      speed: BRUTE_CONFIG.speed,
      sprites: Sprites.brute,
      frameTime: 0.3,
      width: 12,
      height: 12,
      energyValue: BRUTE_CONFIG.energy,
      scoreValue: BRUTE_CONFIG.score,
      explosionColors: SPARK_COLORS.brute,
      explosionSize: 4,
      knockbackScale: BRUTE_CONFIG.knockbackScale,
    });
    this.lastFrame = 0;
  }

  think(player) {
    return directionTo(this.x, this.y, player.x, player.y);
  }

  update(dt, player, world) {
    super.update(dt, player, world);
    // Each time the foot comes down (frame changes to the stomp), puff dust.
    const frame = this.getFrameIndex();
    if (frame !== this.lastFrame && frame === 1) {
      Effects.burst(this.x, this.y + this.height / 2, 3, SPARK_COLORS.dust, { minSpeed: 8, maxSpeed: 22, life: 0.3 });
    }
    this.lastFrame = frame;
  }
}

// ---------------------------------------------------------------------
// Enemy shot: a slow, flickering pink orb. Dodge it or dash through it.
// ---------------------------------------------------------------------
class EnemyShot {
  constructor(x, y, dirX, dirY) {
    this.x = x;
    this.y = y;
    this.vx = dirX * ENEMY_SHOT_CONFIG.speed;
    this.vy = dirY * ENEMY_SHOT_CONFIG.speed;
    this.radius = ENEMY_SHOT_CONFIG.radius;
    this.life = ENEMY_SHOT_CONFIG.lifetime;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    const outside = this.x < ARENA.x || this.x >= ARENA.x + ARENA.width || this.y < ARENA.y || this.y >= ARENA.y + ARENA.height;
    if (this.life <= 0 || outside) this.dead = true;
  }

  // A 3x3 "plus" with a white center, flickering between pink and purple.
  draw(ctx) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    ctx.fillStyle = Math.floor(this.life * 12) % 2 === 0 ? PALETTE.pink : PALETTE.purple;
    ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillRect(x, y - 1, 1, 3);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(x, y, 1, 1);
  }
}

// Stop enemies from piling into one single blob. Any two enemies that
// overlap are nudged apart a little each frame. Bigger enemies need
// more room, so the spacing depends on both of their sizes.
function separateEnemies(enemies) {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i];
      const b = enemies[j];
      const minDistance = a.radius + b.radius + 1;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= minDistance) continue;

      // If two enemies sit exactly on top of each other, pick a random direction.
      const nx = distance > 0 ? dx / distance : Math.cos(Math.random() * Math.PI * 2);
      const ny = distance > 0 ? dy / distance : Math.sin(Math.random() * Math.PI * 2);
      // Heavy enemies (brutes) get pushed less than light ones.
      const total = a.knockbackScale + b.knockbackScale;
      const overlap = minDistance - distance;
      a.x -= nx * overlap * (a.knockbackScale / total);
      a.y -= ny * overlap * (a.knockbackScale / total);
      b.x += nx * overlap * (b.knockbackScale / total);
      b.y += ny * overlap * (b.knockbackScale / total);
    }
  }
}

// Do two circles touch? Comparing squared distances avoids a square root.
function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const reach = a.radius + b.radius;
  return dx * dx + dy * dy < reach * reach;
}
