// =====================================================================
// player.js — the little neon hero: movement, dash and animation.
// =====================================================================

const WALK_CYCLE = ['walkA', 'idle', 'walkB', 'idle'];
const GHOST_INTERVAL = 0.025; // seconds between dash trail images
const GHOST_LIFETIME = 0.15; // how long each trail image stays
const TRAIL_COLOR_COUNT = 3; // the first 3 silhouette colors are for the dash trail
const HIT_FLASH_INDEX = 3; // the 4th silhouette is the white "hit" flash

class Player {
  constructor(x, y) {
    // Position of the CENTER of the player, in internal pixels.
    // We keep decimals here so movement is smooth, and only round
    // to whole pixels when drawing.
    this.x = x;
    this.y = y;
    this.vx = 0; // velocity (pixels per second)
    this.vy = 0;

    this.width = 8;
    this.height = 10;
    this.facing = 1; // 1 = right, -1 = left

    // Stats that upgrades can improve.
    this.speed = PLAYER_CONFIG.speed;
    this.magnetRadius = ORB_CONFIG.magnetRadius;

    // Dash state
    this.dashTime = 0; // > 0 while dashing
    this.dashCooldown = 0; // > 0 while waiting to dash again
    this.dashDirX = 1;
    this.dashDirY = 0;
    this.ghosts = []; // trail images left behind by the dash
    this.ghostTimer = 0;

    // Health state
    this.health = HEALTH_CONFIG.maxHealth;
    this.maxHealth = HEALTH_CONFIG.maxHealth;
    this.radius = HEALTH_CONFIG.hitRadius;
    this.invulnerableTime = 0; // > 0 while the player can't be hurt
    this.hitFlashTime = 0; // > 0 while the player flashes white
    this.deathTime = 0; // seconds since the final hit

    // Animation state
    this.isMoving = false;
    this.animTime = 0;
    this.blinkTimer = randomRange(2, 4);
  }

  update(dt) {
    // --- 1. Read the keyboard ---
    const input = Input.getMoveDirection();
    let dirX = input.x;
    let dirY = input.y;

    // Normalize: moving diagonally (1, 1) would be ~1.41 times faster
    // than moving straight. Dividing by the length makes it exactly 1.
    const length = Math.hypot(dirX, dirY);
    if (length > 0) {
      dirX /= length;
      dirY /= length;
    }
    this.isMoving = length > 0;
    if (dirX !== 0) this.facing = Math.sign(dirX);

    // --- 2. Dash ---
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (Input.wasPressed('Space') && this.dashCooldown === 0 && this.dashTime === 0) {
      this.startDash(dirX, dirY);
    }

    // --- 3. Velocity ---
    if (this.dashTime > 0) {
      this.dashTime = Math.max(0, this.dashTime - dt);
      this.vx = this.dashDirX * PLAYER_CONFIG.dashSpeed;
      this.vy = this.dashDirY * PLAYER_CONFIG.dashSpeed;
      if (this.dashTime === 0) {
        // Dash finished: drop back to normal running speed.
        this.vx = this.dashDirX * this.speed;
        this.vy = this.dashDirY * this.speed;
      }
    } else {
      // Ease the velocity toward the target speed. Using Math.exp makes
      // the easing behave the same at 30, 60 or 144 frames per second.
      const targetVX = dirX * this.speed;
      const targetVY = dirY * this.speed;
      const blend = 1 - Math.exp(-PLAYER_CONFIG.acceleration * dt);
      this.vx += (targetVX - this.vx) * blend;
      this.vy += (targetVY - this.vy) * blend;
    }

    // --- 4. Move, then keep the player inside the arena ---
    // Multiplying by dt (seconds since last frame) keeps speed the same
    // on fast and slow computers.
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.keepInsideArena();

    // --- 5. Timers ---
    this.invulnerableTime = Math.max(0, this.invulnerableTime - dt);
    this.hitFlashTime = Math.max(0, this.hitFlashTime - dt);
    this.updateGhosts(dt);
    this.animTime += dt;
    this.blinkTimer -= dt;
    if (this.blinkTimer < -0.12) this.blinkTimer = randomRange(2, 4);
  }

  startDash(dirX, dirY) {
    // No direction held? Dash the way we're facing.
    if (dirX === 0 && dirY === 0) {
      dirX = this.facing;
      dirY = 0;
    }
    this.dashDirX = dirX;
    this.dashDirY = dirY;
    this.dashTime = PLAYER_CONFIG.dashDuration;
    this.dashCooldown = PLAYER_CONFIG.dashCooldown;
    this.ghostTimer = 0;
  }

  isDashing() {
    return this.dashTime > 0;
  }

  // Dashing makes you briefly untouchable, so a well-timed dash can
  // carry you straight through an enemy.
  canBeHit() {
    return this.invulnerableTime === 0 && !this.isDashing();
  }

  // Get one health point back (never above the maximum).
  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  // Lose one health point. Returns true if this hit was fatal.
  takeHit() {
    this.health = Math.max(0, this.health - 1);
    this.invulnerableTime = HEALTH_CONFIG.invulnerableTime;
    this.hitFlashTime = HEALTH_CONFIG.hitFlashTime;
    return this.health === 0;
  }

  isDead() {
    return this.health === 0;
  }

  // While the game shows the death moment, only the death timer runs.
  updateDeath(dt) {
    this.deathTime += dt;
  }

  keepInsideArena() {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const minX = ARENA.x + halfW;
    const maxX = ARENA.x + ARENA.width - halfW;
    const minY = ARENA.y + halfH;
    const maxY = ARENA.y + ARENA.height - halfH;

    // If we hit a wall, also stop moving into it.
    if (this.x < minX) { this.x = minX; this.vx = Math.max(0, this.vx); }
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx); }
    if (this.y < minY) { this.y = minY; this.vy = Math.max(0, this.vy); }
    if (this.y > maxY) { this.y = maxY; this.vy = Math.min(0, this.vy); }
  }

  updateGhosts(dt) {
    // Age existing trail images and throw away old ones.
    for (const ghost of this.ghosts) ghost.age += dt;
    this.ghosts = this.ghosts.filter((ghost) => ghost.age < GHOST_LIFETIME);

    // While dashing, drop a new trail image every GHOST_INTERVAL seconds.
    if (this.isDashing()) {
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.ghostTimer = GHOST_INTERVAL;
        this.ghosts.push({ x: this.x, y: this.y, facing: this.facing, frame: this.getFrameName(), age: 0 });
      }
    }
  }

  // Pick which picture to show this frame.
  getFrameName() {
    if (this.isMoving || this.isDashing()) {
      const index = Math.floor(this.animTime / PLAYER_CONFIG.walkFrameTime) % WALK_CYCLE.length;
      return WALK_CYCLE[index];
    }
    if (this.blinkTimer < 0) return 'blink';
    const breathing = Math.floor(this.animTime / PLAYER_CONFIG.idleFrameTime) % 2 === 1;
    return breathing ? 'idleBreath' : 'idle';
  }

  draw(ctx) {
    // Dash trail first, so it appears behind the player.
    for (const ghost of this.ghosts) {
      const sprite = Sprites.player[ghost.frame];
      // Older ghosts use darker colors. No transparency or blur needed.
      const colorIndex = Math.min(TRAIL_COLOR_COUNT - 1, Math.floor((ghost.age / GHOST_LIFETIME) * TRAIL_COLOR_COUNT));
      const image = ghost.facing === 1 ? sprite.ghosts[colorIndex].right : sprite.ghosts[colorIndex].left;
      ctx.drawImage(image, Math.round(ghost.x - this.width / 2), Math.round(ghost.y - this.height / 2));
    }

    // Round to whole pixels so the sprite always lines up with the grid.
    const drawX = Math.round(this.x - this.width / 2);
    const drawY = Math.round(this.y - this.height / 2);

    // After the death flicker the player is gone (shadow included).
    if (this.isDead() && this.deathTime > 0.6) return;

    // Small shadow under the feet.
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(drawX + 1, drawY + this.height, 6, 1);

    // Defeated: flicker between white and normal, then vanish.
    // (The pixel explosion itself is spawned by game.js.)
    if (this.isDead()) {
      const sprite = Sprites.player.idle;
      const white = Math.floor(this.deathTime / 0.06) % 2 === 0;
      const image = white ? sprite.ghosts[HIT_FLASH_INDEX] : sprite;
      ctx.drawImage(this.facing === 1 ? image.right : image.left, drawX, drawY);
      return;
    }

    // While invulnerable, blink on and off every 0.08 seconds so the
    // player can see they are safe for a moment.
    if (this.invulnerableTime > 0 && this.hitFlashTime === 0) {
      if (Math.floor(this.invulnerableTime / 0.08) % 2 === 0) return;
    }

    const sprite = Sprites.player[this.getFrameName()];
    if (this.hitFlashTime > 0) {
      const flash = sprite.ghosts[HIT_FLASH_INDEX];
      ctx.drawImage(this.facing === 1 ? flash.right : flash.left, drawX, drawY);
      return;
    }
    ctx.drawImage(this.facing === 1 ? sprite.right : sprite.left, drawX, drawY);
  }
}
