// =====================================================================
// orbs.js — energy orbs (and heart pickups) that defeated enemies leave behind.
//
// Orbs pop out, settle on the floor, and get pulled toward the player
// when they come close (the "magnet"). The energy you collect fills
// the experience bar.
// =====================================================================

class Orb {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    // Pop out in a random direction, then slide to a stop.
    const angle = randomRange(0, Math.PI * 2);
    const speed = randomRange(20, 45);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.age = 0;
    this.attracted = false; // becomes true once the magnet grabs it
    this.collected = false;
    this.animOffset = Math.random() * 2;
  }

  update(dt, player, magnetRadius) {
    this.age += dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy);

    // Once grabbed by the magnet, an orb keeps flying to the player.
    if (distance < magnetRadius) this.attracted = true;

    if (this.attracted && distance > 0) {
      // Speed up as it flies in, so it feels like it gets "sucked in".
      const blend = 1 - Math.exp(-10 * dt);
      const targetVX = (dx / distance) * ORB_CONFIG.magnetSpeed;
      const targetVY = (dy / distance) * ORB_CONFIG.magnetSpeed;
      this.vx += (targetVX - this.vx) * blend;
      this.vy += (targetVY - this.vy) * blend;
    } else {
      const friction = Math.exp(-6 * dt);
      this.vx *= friction;
      this.vy *= friction;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, ARENA.x + 3, ARENA.x + ARENA.width - 3);
    this.y = clamp(this.y, ARENA.y + 3, ARENA.y + ARENA.height - 3);

    if (distance < ORB_CONFIG.collectRadius) this.collected = true;
  }

  isExpired() {
    return this.age > ORB_CONFIG.lifetime;
  }

  draw(ctx) {
    // Blink during the last 3 seconds as a warning that it will vanish.
    const timeLeft = ORB_CONFIG.lifetime - this.age;
    if (timeLeft < 3 && Math.floor(timeLeft / 0.1) % 2 === 0) return;

    const t = this.age + this.animOffset;
    const image = Math.floor(t * 4) % 2 === 0 ? Sprites.orb.bright : Sprites.orb.dim;
    // Bob up and down by exactly one pixel.
    const bob = Math.floor(t * 2.5) % 2;
    const drawX = Math.round(this.x) - 2;
    const drawY = Math.round(this.y) - 2 - bob;

    ctx.fillStyle = PALETTE.void; // shadow
    ctx.fillRect(drawX + 1, Math.round(this.y) + 3, 3, 1);
    ctx.drawImage(image, drawX, drawY);
  }
}

// ---------------------------------------------------------------------
// Heart pickup: sometimes dropped by a defeated monster. It moves just
// like an energy orb (pops out, gets pulled in by the magnet), but it
// restores a heart instead of giving energy, and it never disappears.
// When your hearts are full it stays on the floor, saved for later.
// ---------------------------------------------------------------------
class HeartPickup extends Orb {
  constructor(x, y) {
    super(x, y, 1);
  }

  update(dt, player, magnetRadius) {
    if (!player.hasFullHealth()) {
      super.update(dt, player, magnetRadius);
      return;
    }
    // Full health: no magnet pull and no pickup, just settle in place.
    this.attracted = false;
    super.update(dt, player, 0);
    this.collected = false;
  }

  isExpired() {
    return false; // hearts wait for you as long as it takes
  }

  draw(ctx) {
    const t = this.age + this.animOffset;
    const bob = Math.floor(t * 2.5) % 2; // bob up and down by one pixel
    const drawX = Math.round(this.x) - 3;
    const drawY = Math.round(this.y) - 3 - bob;

    ctx.fillStyle = PALETTE.void; // shadow
    ctx.fillRect(drawX + 2, Math.round(this.y) + 4, 3, 1);
    ctx.drawImage(Sprites.heart.full, drawX, drawY);

    // A little white twinkle in the corner every second, so hearts
    // stand out among the yellow energy orbs.
    if (t % 1 < 0.15) {
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(drawX + 6, drawY - 1, 1, 1);
      ctx.fillRect(drawX + 5, drawY, 1, 1);
      ctx.fillRect(drawX + 7, drawY, 1, 1);
      ctx.fillRect(drawX + 6, drawY + 1, 1, 1);
    }
  }
}
