// =============================================================
// physics.js — Small math helpers about the player's jump.
// The obstacle spawner uses these so it never creates an
// obstacle layout that is impossible to jump over.
// =============================================================

OMJ.Physics = {
  // How long a full jump lasts (seconds), from take-off to landing.
  airTime() {
    const C = OMJ.CONFIG;
    return (2 * C.JUMP_VELOCITY) / C.GRAVITY;
  },

  // The highest point of a jump, in pixels above the ground.
  maxJumpHeight() {
    const C = OMJ.CONFIG;
    return (C.JUMP_VELOCITY * C.JUMP_VELOCITY) / (2 * C.GRAVITY);
  },

  // How far the world scrolls during one full jump.
  airDistance(speed) {
    return speed * this.airTime();
  },

  // How long (seconds) the player's feet stay above `height` during a jump.
  timeAbove(height) {
    const C = OMJ.CONFIG;
    const v = C.JUMP_VELOCITY;
    const disc = v * v - 2 * C.GRAVITY * height;
    if (disc <= 0) return 0;
    return (2 * Math.sqrt(disc)) / C.GRAVITY;
  },

  // The widest obstacle of a given height that a single jump can clear.
  clearDistance(height, speed) {
    return speed * this.timeAbove(height) - OMJ.CONFIG.PLAYER_W;
  },
};

// Tiny random helpers used all over the game.
OMJ.rand = (min, max) => min + Math.random() * (max - min);
OMJ.randInt = (min, max) => Math.floor(OMJ.rand(min, max + 1));
OMJ.clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
OMJ.lerp = (a, b, t) => a + (b - a) * t;
