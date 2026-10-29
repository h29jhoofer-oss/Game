// =====================================================================
// hazards.js — dangers left on the floor. Right now: the poison gas
// cloud a Toxic Slime releases when it is defeated.
//
// The cloud's life has three phases:
//   1. forming  (0.5 s)  — puffs up; harmless, so a point-blank kill is fair
//   2. active   (~7 s)   — touching it costs a heart
//   3. fading   (2.5 s)  — thins out pixel by pixel, then disappears
// =====================================================================

// A 4x4 "Bayer" pattern for ordered dithering. To draw something at,
// say, 50% strength, we only draw the pixels whose number here is below
// 8 (half of 16). This fades things out with crisp pixels instead of
// blurry transparency, just like old consoles did.
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const GAS_COLORS = {
  edge: '#0b4a20', // dark rim
  body: '#139a3c', // main cloud color
  glow: PALETTE.green, // bright swirls inside
};

class GasCloud {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.age = 0;
    this.dead = false;
    // A cloud is a few overlapping round "puffs" at random offsets,
    // so every cloud has a slightly different shape.
    this.puffs = [{ ox: 0, oy: 0, r: GAS_CONFIG.radius * 0.7, phase: 0 }];
    for (let i = 0; i < 4; i++) {
      const angle = randomRange(0, Math.PI * 2);
      const distance = randomRange(3, GAS_CONFIG.radius * 0.6);
      this.puffs.push({
        ox: Math.cos(angle) * distance,
        oy: Math.sin(angle) * distance * 0.7, // a bit flatter than it is wide
        r: randomRange(GAS_CONFIG.radius * 0.4, GAS_CONFIG.radius * 0.6),
        phase: randomRange(0, Math.PI * 2),
      });
    }
    this.bubbleTimer = 0;
  }

  // How "thick" the cloud is right now, from 0 (gone) to 1 (full).
  getDensity() {
    if (this.age < GAS_CONFIG.formTime) return this.age / GAS_CONFIG.formTime;
    const timeLeft = GAS_CONFIG.duration - this.age;
    if (timeLeft < GAS_CONFIG.fadeTime) return Math.max(0, timeLeft / GAS_CONFIG.fadeTime);
    return 1;
  }

  // Only dangerous once it has formed, and until it is mostly faded.
  isHarmful() {
    return this.age >= GAS_CONFIG.formTime && this.getDensity() > 0.35;
  }

  update(dt) {
    this.age += dt;
    if (this.age >= GAS_CONFIG.duration) this.dead = true;

    // Now and then a little bubble floats up out of the gas.
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0 && this.getDensity() > 0.3) {
      this.bubbleTimer = randomRange(0.15, 0.4);
      Effects.particles.push({
        x: this.x + randomRange(-GAS_CONFIG.radius, GAS_CONFIG.radius) * 0.7,
        y: this.y + randomRange(-3, 3),
        vx: randomRange(-4, 4),
        vy: randomRange(-18, -10),
        age: 0,
        life: randomRange(0.4, 0.8),
        colors: ['#b6ffc8', PALETTE.green, GAS_COLORS.body],
        size: 1,
      });
    }
  }

  // The puffs wobble gently, each on its own rhythm.
  getPuffCenter(puff) {
    return {
      x: this.x + puff.ox + Math.sin(this.age * 1.5 + puff.phase) * 1.5,
      y: this.y + puff.oy + Math.cos(this.age * 1.2 + puff.phase) * 1,
    };
  }

  // Does a circle (like the player) touch any puff of the cloud?
  touches(circle) {
    for (const puff of this.puffs) {
      const center = this.getPuffCenter(puff);
      const reach = puff.r + circle.radius - 1; // a little forgiving
      const dx = circle.x - center.x;
      const dy = circle.y - center.y;
      if (dx * dx + dy * dy < reach * reach) return true;
    }
    return false;
  }

  draw(ctx) {
    const density = this.getDensity();
    if (density <= 0) return;
    // Puffs grow while forming and shrink a little while fading.
    const sizeScale = this.age < GAS_CONFIG.formTime ? 0.4 + 0.6 * density : 0.75 + 0.25 * density;
    const centers = this.puffs.map((puff) => ({ ...this.getPuffCenter(puff), r: puff.r * sizeScale }));

    // Check every pixel in a box around the cloud.
    const size = Math.ceil(GAS_CONFIG.radius * 2);
    const left = Math.round(this.x) - size;
    const top = Math.round(this.y) - size;
    const threshold = density * 16; // how many of the 16 Bayer levels to draw
    const swirl = Math.floor(this.age * 6); // moves the bright pattern over time

    for (let py = top; py < top + size * 2; py++) {
      for (let px = left; px < left + size * 2; px++) {
        // How deep inside the cloud is this pixel? (> 0 means inside)
        let depth = -Infinity;
        for (const c of centers) {
          const d = c.r - Math.hypot(px + 0.5 - c.x, py + 0.5 - c.y);
          if (d > depth) depth = d;
        }
        if (depth <= 0) continue;

        // Ordered dithering: skip some pixels when the cloud is thin.
        // ">>> 0" keeps the index positive even for negative coordinates.
        const bayer = BAYER_4X4[(py >>> 0) % 4][(px >>> 0) % 4];
        if (bayer >= threshold) continue;

        let color = GAS_COLORS.body;
        if (depth < 1.5) color = GAS_COLORS.edge; // dark rim
        else if ((px + py + swirl) % 7 === 0 || (px - py - swirl) % 9 === 0) color = GAS_COLORS.glow; // bright swirls
        ctx.fillStyle = color;
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
}
