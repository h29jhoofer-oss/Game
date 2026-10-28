// =============================================================
// particles.js — Little pixel bits for dust, sparkles and crashes.
// Uses a fixed pool, so no objects are created during gameplay.
// =============================================================

OMJ.Particles = class {
  constructor(poolSize) {
    this.pool = [];
    for (let i = 0; i < poolSize; i++) {
      this.pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, gravity: 0, color: '#fff' });
    }
    this.next = 0;
  }

  reset() {
    for (let i = 0; i < this.pool.length; i++) this.pool[i].active = false;
  }

  spawn(x, y, vx, vy, life, size, color, gravity) {
    // Re-use the next slot in a circle (oldest particle gets replaced).
    const p = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    p.active = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life;
    p.size = size; p.color = color; p.gravity = gravity;
  }

  // A handful of particles flying out in a spread.
  burst(x, y, count, speedMin, speedMax, angleMin, angleMax, life, colors, gravity) {
    for (let i = 0; i < count; i++) {
      const a = OMJ.rand(angleMin, angleMax);
      const s = OMJ.rand(speedMin, speedMax);
      const color = colors[i % colors.length];
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * OMJ.rand(0.6, 1), OMJ.randInt(1, 2), color, gravity);
    }
  }

  update(dt, scrollSpeed) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      p.x += (p.vx - scrollSpeed) * dt;   // particles drift with the world
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      // Shrink as they fade (big ones shrink step by step).
      const size = Math.max(1, Math.min(p.size, Math.ceil(p.size * (p.life / p.maxLife) * 1.6)));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size);
    }
  }
};
