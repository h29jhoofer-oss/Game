// =====================================================================
// game.js — the main game object: state, the game loop, and the HUD.
//
// The game loop runs about 60 times per second:
//   1. update(dt) — move things forward in time by dt seconds
//   2. draw()     — paint the current state onto the canvas
// =====================================================================

const Game = {
  canvas: null,
  ctx: null,

  state: 'playing', // 'playing' or 'paused' (more states come in later stages)
  player: null,
  time: 0, // seconds since the page loaded (used for animations)
  showDebug: false,

  // Game loop bookkeeping
  animationFrameId: null,
  lastTimestamp: null,
  fps: 0,
  fpsFrames: 0,
  fpsTimer: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Turn off smoothing so scaled images stay sharp.
    this.ctx.imageSmoothingEnabled = false;

    Sprites.init();
    Arena.init();
    this.resetRun();

    // Pause automatically when the player switches to another tab/window.
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.state = 'paused';
    });
  },

  // Put everything back to the starting state.
  resetRun() {
    const centerX = ARENA.x + ARENA.width / 2;
    const centerY = ARENA.y + ARENA.height / 2;
    this.player = new Player(centerX, centerY);
    this.state = 'playing';
  },

  // Start the loop. The check makes sure we never run two loops at once
  // (two loops would make the game run at double speed).
  start() {
    if (this.animationFrameId !== null) return;
    this.lastTimestamp = null;
    this.animationFrameId = requestAnimationFrame((timestamp) => this.frame(timestamp));
  },

  frame(timestamp) {
    // dt = seconds since the last frame. Clamped so a long pause in the
    // browser (like switching tabs) doesn't cause a giant jump.
    if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, MAX_DELTA);
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.draw();
    Input.endFrame();

    this.animationFrameId = requestAnimationFrame((t) => this.frame(t));
  },

  update(dt) {
    this.trackFps(dt);

    if (Input.wasPressed('Escape')) {
      this.state = this.state === 'playing' ? 'paused' : 'playing';
    }
    if (Input.wasPressed('KeyG')) this.showDebug = !this.showDebug;

    // When paused, nothing in the world moves.
    if (this.state !== 'playing') return;

    this.time += dt;
    Arena.update(dt);
    this.player.update(dt);
  },

  draw() {
    const ctx = this.ctx;
    Arena.draw(ctx, this.time);
    this.player.draw(ctx);
    this.drawHud(ctx);
    if (this.showDebug) this.drawDebug(ctx);
    if (this.state === 'paused') this.drawPauseScreen(ctx);
  },

  // ---------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------
  drawHud(ctx) {
    // Title in the top-left corner.
    drawText(ctx, 'NEON SURVIVOR', ARENA.x, 5, PALETTE.cyan, { shadow: PALETTE.darkBlue });
    drawText(ctx, 'STAGE 1', VIEW_WIDTH - ARENA.x, 5, PALETTE.pink, { align: 'right', shadow: PALETTE.void });

    // Dash meter in the top middle: fills up while the dash recharges.
    const meterWidth = 30;
    const meterX = Math.floor(VIEW_WIDTH / 2 - meterWidth / 2) + 12;
    const meterY = 6;
    drawText(ctx, 'DASH', meterX - 4, 5, PALETTE.cyanDim, { align: 'right' });
    const charge = 1 - this.player.dashCooldown / PLAYER_CONFIG.dashCooldown;
    drawPixelBar(ctx, meterX, meterY, meterWidth, 3, charge, charge >= 1 ? PALETTE.cyan : PALETTE.blue);

    // Control reminder under the arena.
    drawText(ctx, 'WASD/ARROWS MOVE   SPACE DASH   ESC PAUSE', VIEW_WIDTH / 2, VIEW_HEIGHT - 7, PALETTE.darkBlue, {
      align: 'center',
    });
  },

  drawPauseScreen(ctx) {
    // Darken the game with a checkerboard of black pixels. This "dither"
    // is a classic retro trick instead of a smooth transparent overlay.
    ctx.drawImage(getDitherOverlay(), 0, 0);

    const panelW = 120;
    const panelH = 40;
    const panelX = Math.floor((VIEW_WIDTH - panelW) / 2);
    const panelY = Math.floor((VIEW_HEIGHT - panelH) / 2);
    drawPixelPanel(ctx, panelX, panelY, panelW, panelH);
    drawText(ctx, 'PAUSED', VIEW_WIDTH / 2, panelY + 9, PALETTE.cyan, { align: 'center', scale: 2, shadow: PALETTE.darkBlue });
    drawText(ctx, 'PRESS ESC TO RESUME', VIEW_WIDTH / 2, panelY + 27, PALETTE.white, { align: 'center' });
  },

  drawDebug(ctx) {
    const p = this.player;
    const lines = [
      'FPS ' + this.fps,
      'SCALE ' + currentScale + 'X',
      'X ' + p.x.toFixed(1) + ' Y ' + p.y.toFixed(1),
      'SPEED ' + Math.round(Math.hypot(p.vx, p.vy)),
    ];
    lines.forEach((line, i) => {
      drawText(ctx, line, ARENA.x + 3, ARENA.y + 3 + i * 7, PALETTE.yellow, { shadow: PALETTE.black });
    });
  },

  trackFps(dt) {
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }
  },
};

// The checkerboard overlay is drawn once and reused, since filling
// thousands of single pixels every frame would be wasteful.
let ditherOverlay = null;
function getDitherOverlay() {
  if (ditherOverlay) return ditherOverlay;
  const { canvas, ctx } = createOffscreenCanvas(VIEW_WIDTH, VIEW_HEIGHT);
  ctx.fillStyle = PALETTE.black;
  for (let y = 0; y < VIEW_HEIGHT; y++) {
    for (let x = y % 2; x < VIEW_WIDTH; x += 2) ctx.fillRect(x, y, 1, 1);
  }
  ditherOverlay = canvas;
  return ditherOverlay;
}

// A bordered progress bar. `fraction` goes from 0 (empty) to 1 (full).
function drawPixelBar(ctx, x, y, width, height, fraction, color) {
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.fillStyle = PALETTE.gridLine;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(width * clamp(fraction, 0, 1)), height);
}

// A retro window: dark fill, double border, and notched corners.
function drawPixelPanel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = PALETTE.cyanDim;
  ctx.fillRect(x + 1, y, width - 2, 1);
  ctx.fillRect(x + 1, y + height - 1, width - 2, 1);
  ctx.fillRect(x, y + 1, 1, height - 2);
  ctx.fillRect(x + width - 1, y + 1, 1, height - 2);
  ctx.fillStyle = PALETTE.wallDark;
  ctx.fillRect(x + 2, y + 2, width - 4, 1);
  ctx.fillRect(x + 2, y + height - 3, width - 4, 1);
  ctx.fillRect(x + 2, y + 2, 1, height - 4);
  ctx.fillRect(x + width - 3, y + 2, 1, height - 4);
}
