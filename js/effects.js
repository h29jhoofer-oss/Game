// =====================================================================
// effects.js — short-lived visual effects: particles and pixel rings.
//
// Effects don't affect gameplay. They are tiny squares that fly out,
// slow down, step through a few colors, and disappear.
// =====================================================================

// Color sets for different explosions (bright first, dark last).
const SPARK_COLORS = {
  enemy: [PALETTE.white, PALETTE.yellow, PALETTE.orange, PALETTE.red, '#a3173a'],
  energy: [PALETTE.white, '#fffbd0', PALETTE.yellow],
  wall: [PALETTE.cyan, PALETTE.cyanDim],
  shooter: [PALETTE.white, PALETTE.pink, PALETTE.purple, '#5a1a9a'],
  brute: [PALETTE.white, PALETTE.yellow, PALETTE.orange, '#a34a0a', PALETTE.void],
  dust: [PALETTE.speck, PALETTE.gridLine],
  shield: [PALETTE.white, PALETTE.cyan, PALETTE.blue],
  levelUp: [PALETTE.white, PALETTE.yellow, PALETTE.orange],
  toxic: [PALETTE.white, '#b6ffc8', PALETTE.green, '#139a3c', '#0b4a20'],
  heart: [PALETTE.white, '#ff8a9a', PALETTE.red, '#a3173a'],
  ram: [PALETTE.white, PALETTE.yellow, PALETTE.orange, '#a34a0a'],
};

const Effects = {
  particles: [],
  rings: [],
  texts: [], // floating words like "+120" or "BLOCKED!"

  reset() {
    this.particles = [];
    this.rings = [];
    this.texts = [];
  },

  // Words that float upward and blink out, drawn with the pixel font.
  text(x, y, message, color, duration = 0.8) {
    if (this.texts.length >= 20) this.texts.shift();
    this.texts.push({ x, y, message, color, age: 0, duration });
  },

  // Throw `count` particles out from a point in random directions.
  burst(x, y, count, colors, options = {}) {
    const minSpeed = options.minSpeed ?? 20;
    const maxSpeed = options.maxSpeed ?? 70;
    const life = options.life ?? 0.4;
    const size = options.size ?? 1;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(minSpeed, maxSpeed);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: life * randomRange(0.6, 1.2),
        colors,
        size: Math.random() < 0.3 ? size + 1 : size, // a few bigger chunks
      });
    }
  },

  // An expanding pixel circle, like a little shockwave.
  ring(x, y, maxRadius, colors, duration = 0.2) {
    this.rings.push({ x, y, maxRadius, colors, age: 0, duration });
  },

  // A full enemy explosion: shockwave + chunks.
  explode(x, y, colors, size = 1) {
    this.ring(x, y, 5 + size * 2, colors);
    this.burst(x, y, 8 + size * 4, colors, { maxSpeed: 60 + size * 15, life: 0.45 });
  },

  update(dt) {
    // Particles slow down over time ("friction"), the same at any frame rate.
    const friction = Math.exp(-5 * dt);
    for (const p of this.particles) {
      p.age += dt;
      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    // Remove finished effects so the lists don't grow forever.
    this.particles = this.particles.filter((p) => p.age < p.life);

    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.duration);

    for (const t of this.texts) t.age += dt;
    this.texts = this.texts.filter((t) => t.age < t.duration);
  },

  draw(ctx) {
    for (const p of this.particles) {
      // Step through the color list as the particle ages.
      const index = Math.min(p.colors.length - 1, Math.floor((p.age / p.life) * p.colors.length));
      ctx.fillStyle = p.colors[index];
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }

    for (const r of this.rings) {
      const progress = r.age / r.duration;
      const radius = Math.max(1, Math.round(progress * r.maxRadius));
      const index = Math.min(r.colors.length - 1, Math.floor(progress * r.colors.length));
      drawPixelCircle(ctx, Math.round(r.x), Math.round(r.y), radius, r.colors[index]);
    }

    for (const t of this.texts) {
      // Rise one pixel at a time; blink during the last third.
      const progress = t.age / t.duration;
      if (progress > 0.66 && Math.floor(t.age / 0.05) % 2 === 0) continue;
      const rise = Math.floor(Math.min(progress * 3, 1) * 8);
      drawText(ctx, t.message, t.x, t.y - rise, t.color, { align: 'center', shadow: PALETTE.void });
    }
  },
};

// Draw the outline of a circle one pixel at a time (no anti-aliasing).
function drawPixelCircle(ctx, cx, cy, radius, color) {
  ctx.fillStyle = color;
  // More steps for bigger circles so there are no gaps.
  const steps = Math.max(8, Math.ceil(radius * 6));
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    ctx.fillRect(cx + Math.round(Math.cos(angle) * radius), cy + Math.round(Math.sin(angle) * radius), 1, 1);
  }
}
