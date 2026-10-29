// =============================================================
// coins.js — Spinning gold coins to collect.
// The spawner places them (in jump arcs, rows and on platforms);
// this file moves, collects and draws them. Fixed pool, re-used.
// =============================================================

// Half-width of each pixel row of a coin, top to bottom (a round 8x8 coin).
const COIN_ROWS = [2, 3, 4, 4, 4, 4, 3, 2];
const COIN_SQUASH = [1, 0.6, 0.25, 0.6];

OMJ.Coins = class {
  constructor(poolSize) {
    this.pool = [];
    for (let i = 0; i < poolSize; i++) this.pool.push({ active: false, x: 0, y: 0, spin: 0, pulled: false, popping: false, vx: 0, vy: 0 });
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
      c.popping = false;
      return c;
    }
    return null;
  }

  // A coin that pops out of something (like a broken crate), flies up
  // with speed (vx, vy) and bounces to a stop on the ground.
  pop(x, y, vx, vy) {
    const c = this.spawn(x, y);
    if (!c) return;
    c.popping = true;
    c.vx = vx;
    c.vy = vy;
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
      if (c.popping && !c.pulled) {
        c.vy += 700 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        const floor = OMJ.CONFIG.GROUND_Y - 6;
        if (c.y >= floor && c.vy > 0) {
          c.y = floor;
          c.vy *= -0.4;                          // a little bounce...
          c.vx *= 0.5;
          if (c.vy > -40) c.popping = false;     // ...then it settles
        }
      }
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
      // Spin frames: full face, narrower, edge-on, narrower.
      const squash = COIN_SQUASH[Math.floor(c.spin * 8) % 4];
      for (let r = 0; r < COIN_ROWS.length; r++) {
        const hw = Math.max(1, Math.round(COIN_ROWS[r] * squash));
        const ry = y - 4 + r;
        ctx.fillStyle = P.ink;                              // outline
        ctx.fillRect(x - hw - 1, ry, hw * 2 + 2, 1);
        if (r === 0 || r === COIN_ROWS.length - 1) ctx.fillRect(x - hw, ry + (r === 0 ? -1 : 1), hw * 2, 1);
        ctx.fillStyle = '#c99a10';                          // shaded rim
        ctx.fillRect(x - hw, ry, hw * 2, 1);
        if (r < COIN_ROWS.length - 1) {
          ctx.fillStyle = P.gold;                           // face
          ctx.fillRect(x - hw, ry, Math.max(1, hw * 2 - 1), 1);
        }
      }
      if (squash > 0.3) {
        ctx.fillStyle = '#fff2a8';                          // shine
        ctx.fillRect(x - Math.round(2 * squash), y - 2, 1, 3);
      }
    }
  }
};
