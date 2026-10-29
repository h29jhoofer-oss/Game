// =====================================================================
// transition.js — a pixel "wipe" between screens.
//
// Dark squares grow diagonally across the screen until it is covered,
// the screen switches behind them, then they shrink away again.
// =====================================================================

const TRANSITION_CELL = 16; // size of each square, in pixels
const TRANSITION_HALF = 0.32; // seconds to cover (and again to uncover)

const Transition = {
  active: false,
  time: 0,
  switched: false,
  onMiddle: null, // what to do once the screen is fully covered

  start(onMiddle) {
    if (this.active) return; // ignore double clicks during a wipe
    this.active = true;
    this.time = 0;
    this.switched = false;
    this.onMiddle = onMiddle;
  },

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    if (!this.switched && this.time >= TRANSITION_HALF) {
      this.switched = true;
      this.onMiddle();
    }
    if (this.time >= TRANSITION_HALF * 2) this.active = false;
  },

  draw(ctx) {
    if (!this.active) return;
    // 0 -> 1 while covering, then 1 -> 0 while uncovering.
    const coverage = this.time < TRANSITION_HALF ? this.time / TRANSITION_HALF : 2 - this.time / TRANSITION_HALF;
    const cols = Math.ceil(VIEW_WIDTH / TRANSITION_CELL);
    const rows = Math.ceil(VIEW_HEIGHT / TRANSITION_CELL);
    ctx.fillStyle = PALETTE.void;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Cells further to the bottom-right start a little later.
        const delay = ((col + row) / (cols + rows)) * 0.5;
        const local = clamp((coverage - delay) / 0.5, 0, 1);
        // Grow in 2-pixel steps so the squares stay on the pixel grid.
        const size = Math.ceil((local * TRANSITION_CELL) / 2) * 2;
        if (size === 0) continue;
        const offset = (TRANSITION_CELL - size) / 2;
        ctx.fillRect(col * TRANSITION_CELL + offset, row * TRANSITION_CELL + offset, size, size);
      }
    }
  },
};
