// =============================================================
// coins.js — Spinning gold coins to collect.
// The spawner places them (in jump arcs, rows and on platforms);
// this file moves, collects and draws them. Fixed pool, re-used.
// =============================================================

OMJ.Coins = class {
  constructor(poolSize) {
    this.pool = [];
    for (let i = 0; i < poolSize; i++) this.pool.push({ active: false, x: 0, y: 0, spin: 0, pulled: false });
  }

  reset() {
    for (let i = 0; i < this.pool.length; i++) this.pool[i].active = false;
  }

  // (x, y) is the coin's center.
  spawn(x, y) {
    for (let i = 0; i < this.pool.length; i++) {
      const c = this.pool[i];
      if (c.active) continue;
      c.active = true;
      c.x = x;
      c.y = y;
      c.spin = Math.random() * 3;
      c.pulled = false;
      return c;
    }
    return null;
  }

  // Coin Vacuum: every coin on screen flies to you.
  pullAll() {
    for (let i = 0; i < this.pool.length; i++) {
      const c = this.pool[i];
      if (c.active && c.x < OMJ.CONFIG.VIEW_W) c.pulled = true;
    }
  }

  // Move every coin left by `distance` (used by Blink).
  shift(distance) {
    for (let i = 0; i < this.pool.length; i++) if (this.pool[i].active) this.pool[i].x -= distance;
  }

  // Returns how many coins were picked up this step.
  update(dt, speed, player, magnet) {
    let picked = 0;
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    for (let i = 0; i < this.pool.length; i++) {
      const c = this.pool[i];
      if (!c.active) continue;
      c.x -= speed * dt;
      c.spin += dt;
      // Coin Magnet: nearby coins fly to you.
      const dx = px - c.x;
      const dy = py - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (c.pulled || (magnet > 0 && dist < magnet)) {
        c.pulled = true;
        const pull = (260 * dt) / Math.max(dist, 1);
        c.x += dx * Math.min(1, pull) + speed * dt;   // (cancel the scrolling while pulled)
        c.y += dy * Math.min(1, pull);
      }
      // Pick up: the coin's 6x6 box touches the player (with a little slack).
      if (Math.abs(dx) < player.w / 2 + 5 && Math.abs(dy) < player.h / 2 + 5) {
        c.active = false;
        picked++;
        continue;
      }
      if (c.x < -10) c.active = false;
    }
    return picked;
  }

  draw(ctx) {
    const P = OMJ.PALETTE;
    for (let i = 0; i < this.pool.length; i++) {
      const c = this.pool[i];
      if (!c.active) continue;
      const x = Math.round(c.x);
      const y = Math.round(c.y + Math.sin(c.spin * 4) * 1);   // gentle bob
      // Three spin frames: full face, narrower, edge-on.
      const frame = Math.floor(c.spin * 8) % 4;
      const half = frame === 0 ? 3 : frame === 2 ? 1 : 2;
      ctx.fillStyle = P.ink;
      ctx.fillRect(x - half - 1, y - 3, half * 2 + 2, 7);
      ctx.fillRect(x - half, y - 4, half * 2, 9);
      ctx.fillStyle = '#c99a10';
      ctx.fillRect(x - half, y - 3, half * 2, 7);
      ctx.fillStyle = P.gold;
      ctx.fillRect(x - half, y - 3, Math.max(1, half * 2 - 1), 6);
      if (half > 1) {
        ctx.fillStyle = '#fff2a8';                 // shine
        ctx.fillRect(x - half + 1, y - 2, 1, 3);
      }
    }
  }
};
