// =============================================================
// spawner.js — Decides WHAT obstacles appear and WHEN.
//
// Obstacles come in "patterns". Each pattern has:
//   minDifficulty  0..1  — it only appears once the game is this hard
//   weight               — how often it's picked compared to others
//   build(api, d)        — places obstacles, returns the total width
//
// The api uses OMJ.Physics so every pattern can be jumped over
// at the current speed. Spacing BETWEEN patterns is always at least
// one full jump plus reaction time, so nothing is ever impossible.
// =============================================================

OMJ.PATTERNS = [
  {
    name: 'spikes', minDifficulty: 0, weight: 4,
    build(api, d) {
      const count = OMJ.randInt(1, d < 0.3 ? 2 : 3);
      return api.place('spike', 0, count);
    },
  },
  {
    name: 'crate', minDifficulty: 0, weight: 3,
    build(api) { return api.place('crate', 0, 1); },
  },
  {
    name: 'gap', minDifficulty: 0.1, weight: 2,
    build(api, d) {
      const maxWidth = Math.floor(api.airDistance * 0.55);
      const width = OMJ.clamp(OMJ.randInt(24, 24 + Math.floor(28 * d)), 24, maxWidth);
      return api.place('gap', 0, width);
    },
  },
  {
    name: 'barrier', minDifficulty: 0.2, weight: 2,
    build(api, d) {
      const height = d < 0.6 ? 34 : 42;
      return api.place('barrier', 0, height);
    },
  },
  {
    name: 'spikePair', minDifficulty: 0.35, weight: 2,
    build(api) {
      // Two spikes close together — clear them both in ONE jump.
      const maxSpan = api.clearDistance(9) * 0.7;
      const space = Math.min(OMJ.randInt(10, 26), Math.floor(maxSpan - 16));
      let width = api.place('spike', 0, 1);
      if (space < 6) return width;
      width += space;
      width += api.place('spike', width, 1);
      return width;
    },
  },
  {
    name: 'crateStack', minDifficulty: 0.4, weight: 2,
    build(api) { return api.place('crate', 0, 2); },
  },
  {
    name: 'spikeGap', minDifficulty: 0.55, weight: 1.5,
    build(api) {
      // A spike right before a hole: one long jump.
      const maxSpan = Math.floor(api.airDistance * 0.6);
      let width = api.place('spike', 0, 1) + 4;
      const gapWidth = OMJ.clamp(maxSpan - width, 0, 36);
      if (gapWidth < 20) return width - 4;
      width += api.place('gap', width, gapWidth);
      return width;
    },
  },
  {
    name: 'saw', minDifficulty: 0.15, weight: 2,
    build(api, d) {
      // Slides further as it gets harder.
      return api.place('saw', 0, OMJ.randInt(24, 32 + Math.floor(24 * d)));
    },
  },
  {
    name: 'sawLift', minDifficulty: 0.25, weight: 1.5,
    build(api) { return api.place('sawLift', 0, 0); },
  },
  {
    name: 'crusher', minDifficulty: 0.3, weight: 1.5,
    build(api) { return api.place('crusher', 0, 1); },
  },
  {
    name: 'crossbow', minDifficulty: 0.4, weight: 1.5,
    build(api) { return api.place('crossbow', 0, 1); },
  },
  // ---- Wooden platforms: an optional high road over a hazard ----
  // The hazard underneath is always jumpable on its own; the platform
  // just gives you another way across.
  {
    name: 'platformSpikes', minDifficulty: 0.05, weight: 1.5,
    build(api, d) {
      const count = OMJ.randInt(2, d < 0.4 ? 2 : 3);
      const width = 8 * count + OMJ.randInt(20, 36);
      api.place('platform', 0, width);
      api.place('spike', Math.floor((width - 8 * count) / 2), count);
      return width;
    },
  },
  {
    name: 'platformGap', minDifficulty: 0.25, weight: 1.2,
    build(api, d) {
      const maxWidth = Math.floor(api.airDistance * 0.55);
      const gapWidth = OMJ.clamp(OMJ.randInt(28, 28 + Math.floor(24 * d)), 24, maxWidth);
      const width = gapWidth + OMJ.randInt(24, 40);
      api.place('platform', 0, width);
      api.place('gap', Math.floor((width - gapWidth) / 2), gapWidth);
      return width;
    },
  },
  {
    name: 'platformSaw', minDifficulty: 0.35, weight: 1.2,
    build(api) {
      const range = OMJ.randInt(16, 28);
      const width = range + 23 + OMJ.randInt(20, 32);
      api.place('platform', 0, width);
      api.place('saw', Math.floor((width - range - 23) / 2), range);
      return width;
    },
  },
  {
    name: 'crateSpikes', minDifficulty: 0.65, weight: 1.5,
    build(api) {
      // A crate with spikes behind it: jump over both, or hop on the crate first.
      let width = api.place('crate', 0, 1);
      if (api.clearDistance(16) * 0.7 < width + 8) return width;
      width += api.place('spike', width, 1);
      return width;
    },
  },
];

OMJ.Spawner = class {
  constructor(obstacles) {
    this.obstacles = obstacles;
    this.lastPattern = null;

    // The "api" object given to patterns (created once, re-used).
    const self = this;
    this.api = {
      startX: 0,
      speed: 0,
      airDistance: 0,
      place(typeName, offsetX, variant) {
        const o = self.obstacles.spawn(typeName, this.startX + offsetX, variant);
        return o ? o.w : 0;   // the width it takes up
      },
      clearDistance(height) {
        return OMJ.Physics.clearDistance(height, this.speed);
      },
    };
    this.reset();
  }

  reset() {
    this.distanceUntilNext = OMJ.CONFIG.FIRST_OBSTACLE_DISTANCE;
    this.lastPattern = null;
  }

  update(dt, speed, difficulty) {
    this.distanceUntilNext -= speed * dt;
    if (this.distanceUntilNext > 0) return;

    const C = OMJ.CONFIG;
    const pattern = this.choosePattern(difficulty);
    this.api.startX = C.VIEW_W + 4;
    this.api.speed = speed;
    this.api.airDistance = OMJ.Physics.airDistance(speed);
    const width = pattern.build(this.api, difficulty);
    this.lastPattern = pattern;

    // Minimum gap = one full jump + reaction time. Then add a random extra.
    // (The 1.05 adds a little safety because the game keeps speeding up.)
    const reaction = OMJ.lerp(C.REACTION_TIME_EASY, C.REACTION_TIME_HARD, difficulty);
    const extra = OMJ.rand(0, OMJ.lerp(C.RANDOM_EXTRA_EASY, C.RANDOM_EXTRA_HARD, difficulty));
    const gap = speed * 1.05 * (OMJ.Physics.airTime() + reaction + extra);
    this.distanceUntilNext = width + gap;
  }

  // Weighted random pick among the patterns allowed at this difficulty.
  choosePattern(difficulty) {
    const list = OMJ.PATTERNS;
    let total = 0;
    for (let i = 0; i < list.length; i++) {
      if (difficulty >= list[i].minDifficulty) total += list[i].weight;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      let roll = Math.random() * total;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (difficulty < p.minDifficulty) continue;
        roll -= p.weight;
        if (roll <= 0) {
          // Re-roll once if it's the same as last time (more variety).
          if (p === this.lastPattern && attempt === 0) break;
          return p;
        }
      }
    }
    return list[0];
  }
};
