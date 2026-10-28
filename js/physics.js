// =============================================================
// physics.js — Small math helpers about the player's jump.
// The obstacle spawner uses these so it never creates an
// obstacle layout that is impossible to jump over.
// =============================================================

OMJ.Physics = {
  // The jump the player has RIGHT NOW. Boosts (like Spring Shoes) change
  // these during a run, and everything that plans around the jump (the
  // spawner, the boss, coin arcs) reads them, so spacing stays fair.
  jumpVelocity: OMJ.CONFIG.JUMP_VELOCITY,
  gravity: OMJ.CONFIG.GRAVITY,

  resetJump() {
    this.jumpVelocity = OMJ.CONFIG.JUMP_VELOCITY;
    this.gravity = OMJ.CONFIG.GRAVITY;
  },

  // How long a full jump lasts (seconds), from take-off to landing.
  airTime() {
    return (2 * this.jumpVelocity) / this.gravity;
  },

  // The highest point of a jump, in pixels above the ground.
  maxJumpHeight() {
    return (this.jumpVelocity * this.jumpVelocity) / (2 * this.gravity);
  },

  // Height above the ground `t` seconds after take-off.
  heightAt(t) {
    return this.jumpVelocity * t - 0.5 * this.gravity * t * t;
  },

  // How far the world scrolls during one full jump.
  airDistance(speed) {
    return speed * this.airTime();
  },

  // How long (seconds) the player's feet stay above `height` during a jump.
  timeAbove(height) {
    const v = this.jumpVelocity;
    const disc = v * v - 2 * this.gravity * height;
    if (disc <= 0) return 0;
    return (2 * Math.sqrt(disc)) / this.gravity;
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
