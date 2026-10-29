// =====================================================================
// enemies.js — enemy behavior.
//
// `Enemy` holds everything all enemies share (position, health, being
// knocked back, drawing). Each enemy type is a small class that
// "extends" Enemy and only adds what makes it different. New enemy
// types (Shooter, Brute) will be added the same way in Stage 5.
// =====================================================================

const ENEMY_SEPARATION = 7; // enemies push apart if their centers are closer than this

class Enemy {
  constructor(x, y, settings) {
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
    this.explosionColors = settings.explosionColors;
    this.explosionSize = settings.explosionSize;

    // Knockback velocity: added on top of normal movement, fades quickly.
    this.pushX = 0;
    this.pushY = 0;

    this.facing = 1;
    this.animTime = Math.random(); // so enemies don't all bounce in sync
    this.flashTime = 0.12; // flash white for a moment when appearing
    this.dead = false; // dead enemies are removed at the end of the frame
  }

  // Each enemy type overrides this to decide where it wants to go.
  // It should return a direction {x, y} with a length of 1 (or 0).
  think(player) {
    return { x: 0, y: 0 };
  }

  update(dt, player) {
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
    this.pushX = dirX * knockback;
    this.pushY = dirY * knockback;
    if (this.health <= 0) this.dead = true;
    return this.dead;
  }

  // Push the enemy away from a point (used when it hits the player).
  knockBackFrom(x, y, strength) {
    const dx = this.x - x;
    const dy = this.y - y;
    const length = Math.hypot(dx, dy) || 1;
    this.pushX = (dx / length) * strength;
    this.pushY = (dy / length) * strength;
  }

  keepInsideArena() {
    const half = this.width / 2;
    this.x = clamp(this.x, ARENA.x + half, ARENA.x + ARENA.width - half);
    this.y = clamp(this.y, ARENA.y + this.height / 2, ARENA.y + ARENA.height - this.height / 2);
  }

  draw(ctx) {
    const drawX = Math.round(this.x - this.width / 2);
    const drawY = Math.round(this.y - this.height / 2);

    // Shadow under the enemy.
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(drawX + 1, drawY + this.height, this.width - 2, 1);

    const index = Math.floor(this.animTime / this.frameTime) % this.frameNames.length;
    const sprite = this.sprites[this.frameNames[index]];
    if (this.flashTime > 0) {
      const flash = sprite.ghosts[0];
      ctx.drawImage(this.facing === 1 ? flash.right : flash.left, drawX, drawY);
    } else {
      ctx.drawImage(this.facing === 1 ? sprite.right : sprite.left, drawX, drawY);
    }
  }
}

// ---------------------------------------------------------------------
// Chaser: walks straight toward the player. Simple, but dangerous in groups.
// ---------------------------------------------------------------------
class Chaser extends Enemy {
  constructor(x, y, speed) {
    super(x, y, {
      radius: CHASER_CONFIG.radius,
      health: CHASER_CONFIG.health,
      speed: speed,
      sprites: Sprites.chaser,
      frameTime: 0.18,
      width: 8,
      height: 8,
      energyValue: 1,
      explosionColors: SPARK_COLORS.enemy,
      explosionSize: 1,
    });
  }

  think(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.5) return { x: 0, y: 0 };
    return { x: dx / length, y: dy / length };
  }
}

// Stop enemies from piling into one single blob. Any two enemies that
// overlap are nudged apart a little each frame.
function separateEnemies(enemies) {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i];
      const b = enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= ENEMY_SEPARATION) continue;

      // If two enemies sit exactly on top of each other, pick a random direction.
      const nx = distance > 0 ? dx / distance : Math.cos(Math.random() * Math.PI * 2);
      const ny = distance > 0 ? dy / distance : Math.sin(Math.random() * Math.PI * 2);
      const overlap = (ENEMY_SEPARATION - distance) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
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
