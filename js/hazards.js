// =====================================================================
// hazards.js — dangers on the floor of the arena:
//
//   GasCloud — left by a defeated Toxic Slime. Its life has three phases:
//     1. forming (0.5 s) — puffs up; harmless, so a point-blank kill is fair
//     2. active (~7 s)   — touching it costs a heart
//     3. fading (2.5 s)  — thins out pixel by pixel, then disappears
//   Pit  — a hole into darkness. Cracks warn you before it opens. Walking
//          in costs a heart; dashing carries you over. Walking monsters
//          that stumble in are gone for good.
//   Mine — step on it and it beeps, then explodes, hurting you AND any
//          monsters caught in the blast. Monsters can set it off too.
//   Goo  — a sticky orange puddle that halves walking speed (yours and the
//          monsters'). Dashing isn't slowed. It dries up after a while.
//
// The `Hazards` object at the bottom decides when they appear and checks
// who is standing on what.
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

// ---------------------------------------------------------------------
// Shared helper: an irregular blob made of a few overlapping circles.
// depthAt(x, y) > 0 means the point is inside (bigger = deeper inside).
// ---------------------------------------------------------------------
function makeBlob(radius, puffCount) {
  const puffs = [{ ox: 0, oy: 0, r: radius * 0.75 }];
  for (let i = 0; i < puffCount; i++) {
    const angle = randomRange(0, Math.PI * 2);
    const distance = randomRange(radius * 0.25, radius * 0.5);
    puffs.push({ ox: Math.cos(angle) * distance, oy: Math.sin(angle) * distance * 0.8, r: randomRange(radius * 0.45, radius * 0.6) });
  }
  return puffs;
}

function blobDepth(puffs, centerX, centerY, x, y) {
  let depth = -Infinity;
  for (const puff of puffs) {
    const d = puff.r - Math.hypot(x - (centerX + puff.ox), y - (centerY + puff.oy));
    if (d > depth) depth = d;
  }
  return depth;
}

// ---------------------------------------------------------------------
// Pit: a hole leading into darkness.
// ---------------------------------------------------------------------
class Pit {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.puffs = makeBlob(radius, 3);
    this.age = 0;
    // Jagged cracks that spread out from the middle before it opens.
    this.cracks = Array.from({ length: 5 }, () => {
      const path = [];
      let cx = 0;
      let cy = 0;
      let angle = randomRange(0, Math.PI * 2);
      for (let i = 0; i < radius + 2; i++) {
        angle += randomRange(-0.6, 0.6);
        cx += Math.cos(angle);
        cy += Math.sin(angle);
        path.push({ x: Math.round(cx), y: Math.round(cy) });
      }
      return path;
    });
    this.image = this.bakeImage();
  }

  isOpen() {
    return this.age >= HAZARD_CONFIG.pit.warningTime + 0.25;
  }

  depthAt(x, y) {
    return blobDepth(this.puffs, this.x, this.y, x, y);
  }

  // The finished hole is drawn once into its own little canvas: a rocky
  // rim, then deep blue shadow, then pure black in the middle, with a
  // dithered band between them so it looks like it goes down forever.
  bakeImage() {
    const size = Math.ceil(this.radius * 2 + 6);
    const half = size / 2;
    const { canvas, ctx } = createOffscreenCanvas(size, size);
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const depth = blobDepth(this.puffs, half, half, px + 0.5, py + 0.5);
        if (depth <= 0) continue;
        let color;
        if (depth < 1.2) color = (px + py) % 3 === 0 ? PALETTE.speck : PALETTE.wallDark; // rocky rim
        else if (depth < 2.5) color = PALETTE.void;
        else if (depth < 4 && BAYER_4X4[py % 4][px % 4] < 8) color = PALETTE.void; // dithered edge
        else color = '#000000';
        ctx.fillStyle = color;
        ctx.fillRect(px, py, 1, 1);
      }
    }
    return canvas;
  }

  update(dt) {
    const before = this.isOpen();
    this.age += dt;
    // Little bits of dust fall in while it cracks open.
    if (!this.isOpen() && Math.random() < dt * 12) {
      Effects.burst(this.x + randomRange(-4, 4), this.y + randomRange(-4, 4), 1, SPARK_COLORS.dust, { minSpeed: 5, maxSpeed: 15, life: 0.3 });
    }
    if (!before && this.isOpen()) {
      Effects.burst(this.x, this.y, 10, SPARK_COLORS.dust, { minSpeed: 15, maxSpeed: 40, life: 0.4 });
      Sound.play('pitOpen');
    }
  }

  draw(ctx) {
    const warning = HAZARD_CONFIG.pit.warningTime;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.age < warning) {
      // A blinking dotted outline shows exactly where the hole will open...
      if (Math.floor(this.age * 4) % 2 === 0) {
        const steps = Math.ceil(this.radius * 3);
        ctx.fillStyle = PALETTE.pink;
        for (let i = 0; i < steps; i += 2) {
          const angle = (i / steps) * Math.PI * 2;
          ctx.fillRect(x + Math.round(Math.cos(angle) * this.radius), y + Math.round(Math.sin(angle) * this.radius), 1, 1);
        }
      }
      // ...while cracks grow outward from the middle and flicker.
      const progress = this.age / warning;
      ctx.fillStyle = Math.floor(this.age * 10) % 2 === 0 ? '#000000' : PALETTE.void;
      for (const path of this.cracks) {
        const shown = Math.ceil(path.length * progress);
        for (let i = 0; i < shown; i++) ctx.fillRect(x + path[i].x, y + path[i].y, 1, 1);
      }
      return;
    }
    if (!this.isOpen()) {
      // Opening: a black hole grows from the middle.
      const progress = (this.age - warning) / 0.25;
      drawPixelDisc(ctx, x, y, Math.max(1, Math.round(this.radius * progress)), '#000000');
      return;
    }
    ctx.drawImage(this.image, x - Math.floor(this.image.width / 2), y - Math.floor(this.image.height / 2));
  }
}

// ---------------------------------------------------------------------
// Mine: blinks quietly until something steps on it, then beeps and blows.
// ---------------------------------------------------------------------
const MINE_SPRITE = [
  '.kkkkk.',
  'kddddsk',
  'kddrddk',
  'kdddddk',
  '.kkkkk.',
];

class Mine {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.age = 0;
    this.fuse = -1; // >= 0 once armed (counting up to the explosion)
    this.exploded = false;
  }

  isArmed() {
    return this.fuse >= 0;
  }

  arm() {
    if (this.isArmed()) return;
    this.fuse = 0;
    Sound.play('mineArm');
  }

  update(dt) {
    this.age += dt;
    if (!this.isArmed()) return;
    this.fuse += dt;
    if (this.fuse >= HAZARD_CONFIG.mine.fuse) this.exploded = true;
  }

  draw(ctx) {
    const x = Math.round(this.x) - 3;
    const y = Math.round(this.y) - 2;
    // It pops up out of the floor in its first moment.
    if (this.age < 0.3 && Math.floor(this.age * 20) % 2 === 0) return;
    // The red light blinks slowly when idle and very fast when armed.
    const blinkRate = this.isArmed() ? 16 : 2;
    const lightOn = Math.floor((this.isArmed() ? this.fuse : this.age) * blinkRate) % 2 === 0;
    // Light grey metal so it stands out against the dark floor.
    const colors = { k: PALETTE.void, d: '#5a6488', s: '#a8b0d0', r: lightOn ? PALETTE.red : '#5a1020' };
    for (let row = 0; row < MINE_SPRITE.length; row++) {
      for (let col = 0; col < MINE_SPRITE[row].length; col++) {
        const key = MINE_SPRITE[row][col];
        if (key === '.') continue;
        ctx.fillStyle = colors[key];
        ctx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }

  // Drawn on top of everything once armed: the blast area, flashing.
  drawWarning(ctx) {
    if (!this.isArmed() || Math.floor(this.fuse * 12) % 2 === 1) return;
    drawPixelCircle(ctx, Math.round(this.x), Math.round(this.y), HAZARD_CONFIG.mine.blastRadius, PALETTE.red);
  }
}

// ---------------------------------------------------------------------
// Goo: a sticky orange puddle that slows anything walking through it.
// ---------------------------------------------------------------------
const GOO_COLORS = { rim: '#7a3208', body: '#c45a10', shine: PALETTE.orange };

class Goo {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.puffs = makeBlob(HAZARD_CONFIG.goo.radius, 4);
    this.age = 0;
    this.bubbleTimer = 0;
  }

  getDensity() {
    const config = HAZARD_CONFIG.goo;
    if (this.age < 0.4) return this.age / 0.4; // spreads out
    return Math.min(1, (config.lifetime - this.age) / 3); // dries up at the end
  }

  isDone() {
    return this.age >= HAZARD_CONFIG.goo.lifetime;
  }

  // Sticky only while it's mostly there.
  contains(x, y) {
    return this.getDensity() > 0.3 && blobDepth(this.puffs, this.x, this.y, x, y) > 0;
  }

  update(dt) {
    this.age += dt;
    // Now and then a bubble pops on the surface.
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0 && this.getDensity() > 0.5) {
      this.bubbleTimer = randomRange(0.3, 0.9);
      Effects.burst(this.x + randomRange(-8, 8), this.y + randomRange(-5, 5), 2, [PALETTE.yellow, PALETTE.orange], { minSpeed: 4, maxSpeed: 12, life: 0.25 });
    }
  }

  draw(ctx) {
    const density = this.getDensity();
    if (density <= 0) return;
    const ripple = Math.floor(this.age * 3) % 2; // the glossy flecks shimmer between 2 frames
    if (density >= 1) {
      // Fully there: reuse a picture drawn once (much faster than
      // checking every pixel every frame, which matters on phones).
      if (!this.frames) this.frames = [this.bakeFrame(0), this.bakeFrame(1)];
      const image = this.frames[ripple];
      ctx.drawImage(image, Math.round(this.x) - image.width / 2, Math.round(this.y) - image.height / 2);
      return;
    }
    // Spreading out or drying up: draw pixel by pixel with a dithered fade.
    this.paint(ctx, Math.round(this.x), Math.round(this.y), density * 16, ripple);
  }

  bakeFrame(ripple) {
    const size = (HAZARD_CONFIG.goo.radius + 2) * 2;
    const { canvas, ctx } = createOffscreenCanvas(size, size);
    this.paint(ctx, size / 2, size / 2, 16, ripple);
    return canvas;
  }

  // Paint the puddle centered on (cx, cy). `threshold` (0-16) controls the
  // dithered fade: 16 = every pixel, smaller = fewer pixels.
  paint(ctx, cx, cy, threshold, ripple) {
    const size = HAZARD_CONFIG.goo.radius + 2;
    for (let py = -size; py < size; py++) {
      for (let px = -size; px < size; px++) {
        const depth = blobDepth(this.puffs, 0, 0, px + 0.5, py + 0.5);
        if (depth <= 0) continue;
        if (BAYER_4X4[(py + 64) % 4][(px + 64) % 4] >= threshold) continue; // dithered fade
        let color = GOO_COLORS.body;
        if (depth < 1.3) color = GOO_COLORS.rim;
        else if ((px * 3 + py * 5 + ripple * 4 + 64) % 11 === 0) color = GOO_COLORS.shine; // glossy flecks
        ctx.fillStyle = color;
        ctx.fillRect(cx + px, cy + py, 1, 1);
      }
    }
  }
}

// ---------------------------------------------------------------------
// The hazard manager: spawns hazards over time and applies their effects.
// ---------------------------------------------------------------------
const Hazards = {
  pits: [],
  mines: [],
  goos: [],
  pitTimer: 0,
  mineTimer: 0,
  gooTimer: 0,

  reset() {
    const config = HAZARD_CONFIG;
    this.pits = [];
    this.mines = [];
    this.goos = [];
    this.pitTimer = config.pit.firstAt;
    this.mineTimer = config.mine.firstAt;
    this.gooTimer = config.goo.firstAt;
  },

  all() {
    return [...this.pits, ...this.mines, ...this.goos];
  },

  // A random spot that's far enough from the player and other hazards.
  findSpot(player, radius) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const x = randomRange(ARENA.x + radius + 4, ARENA.x + ARENA.width - radius - 4);
      const y = randomRange(ARENA.y + radius + 4, ARENA.y + ARENA.height - radius - 4);
      if (Math.hypot(x - player.x, y - player.y) < HAZARD_CONFIG.safeDistance + radius) continue;
      const crowded = this.all().some((h) => Math.hypot(x - h.x, y - h.y) < HAZARD_CONFIG.spacing + radius);
      if (!crowded) return { x, y };
    }
    return null; // no room right now; try again next time
  },

  update(dt, game) {
    const config = HAZARD_CONFIG;
    const player = game.player;

    // 1. New hazards appear over time.
    this.pitTimer -= dt;
    if (this.pitTimer <= 0) {
      this.pitTimer = config.pit.every;
      const radius = randomRange(config.pit.minRadius, config.pit.maxRadius);
      const spot = this.pits.length < config.pit.max && this.findSpot(player, radius);
      if (spot) this.pits.push(new Pit(spot.x, spot.y, radius));
    }
    this.mineTimer -= dt;
    if (this.mineTimer <= 0) {
      this.mineTimer = randomRange(config.mine.everyMin, config.mine.everyMax);
      const spot = this.mines.length < config.mine.max && this.findSpot(player, 6);
      if (spot) this.mines.push(new Mine(spot.x, spot.y));
    }
    this.gooTimer -= dt;
    if (this.gooTimer <= 0) {
      this.gooTimer = config.goo.every;
      const spot = this.goos.length < config.goo.max && this.findSpot(player, config.goo.radius);
      if (spot) this.goos.push(new Goo(spot.x, spot.y));
    }

    for (const pit of this.pits) pit.update(dt);
    for (const mine of this.mines) mine.update(dt);
    for (const goo of this.goos) goo.update(dt);

    // 2. Effects on the player.
    const onGround = !player.isDashing() && !player.isFalling(); // dashing = airborne
    player.slowFactor = onGround && this.goos.some((goo) => goo.contains(player.x, player.y)) ? config.goo.slow : 1;
    if (onGround) {
      const pit = this.pits.find((p) => p.isOpen() && p.depthAt(player.x, player.y) > 2);
      if (pit) {
        player.startFalling(pit.x, pit.y, pit.radius);
        Sound.play('fall');
      } else if (!this.pits.some((p) => p.depthAt(player.x, player.y) > -8)) {
        // Remember a safe place (well clear of every pit) to climb back out to.
        player.safeX = player.x;
        player.safeY = player.y;
      }
      for (const mine of this.mines) {
        if (Math.hypot(player.x - mine.x, player.y - mine.y) < config.mine.triggerRadius) mine.arm();
      }
    }

    // 3. Effects on walking monsters.
    for (const enemy of game.enemies) {
      if (!enemy.grounded || enemy.dead || enemy.isFalling()) continue;
      enemy.slowFactor = this.goos.some((goo) => goo.contains(enemy.x, enemy.y)) ? config.goo.slow : 1;
      const pit = this.pits.find((p) => p.isOpen() && p.depthAt(enemy.x, enemy.y) > 1);
      if (pit) enemy.startFalling(pit.x, pit.y);
      for (const mine of this.mines) {
        if (Math.hypot(enemy.x - mine.x, enemy.y - mine.y) < config.mine.triggerRadius + enemy.radius) mine.arm();
      }
    }

    // 4. Mines that finished their fuse explode; dried-up goo goes away.
    for (const mine of this.mines) if (mine.exploded) this.explode(mine, game);
    this.mines = this.mines.filter((mine) => !mine.exploded);
    this.goos = this.goos.filter((goo) => !goo.isDone());
  },

  explode(mine, game) {
    const config = HAZARD_CONFIG.mine;
    Effects.explode(mine.x, mine.y, SPARK_COLORS.brute, 4);
    Effects.ring(mine.x, mine.y, config.blastRadius, [PALETTE.white, PALETTE.yellow, PALETTE.orange, PALETTE.red], 0.3);
    game.shake(4, 0.3);
    Sound.play('mineBoom');

    const player = game.player;
    if (player.canBeHit() && Math.hypot(player.x - mine.x, player.y - mine.y) < config.blastRadius + player.radius) {
      game.hurtPlayer(1);
    }
    // Monsters take big damage, which grows with the late game.
    const damage = config.enemyDamage * game.spawner.getLateGameBoost(game.survivalTime).health;
    for (const enemy of game.enemies) {
      if (enemy.dead || enemy.isFalling()) continue;
      const dx = enemy.x - mine.x;
      const dy = enemy.y - mine.y;
      const distance = Math.hypot(dx, dy);
      if (distance > config.blastRadius + enemy.radius) continue;
      const defeated = enemy.takeDamage(damage, dx / (distance || 1), dy / (distance || 1), 150);
      if (defeated) game.onEnemyDefeated(enemy);
    }
  },

  // Floor layer: drawn under everyone.
  drawFloor(ctx) {
    for (const pit of this.pits) pit.draw(ctx);
    for (const goo of this.goos) goo.draw(ctx);
    for (const mine of this.mines) mine.draw(ctx);
  },

  // Top layer: the flashing blast circle of armed mines.
  drawWarnings(ctx) {
    for (const mine of this.mines) mine.drawWarning(ctx);
  },
};
