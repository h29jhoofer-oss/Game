// =====================================================================
// game.js — the main game object: state, the game loop, and the HUD.
//
// The game loop runs about 60 times per second:
//   1. update(dt) — move things forward in time by dt seconds
//   2. draw()     — paint the current state onto the canvas
// =====================================================================

const DYING_DURATION = 0.9; // seconds between the final hit and the results panel
const GAMEOVER_INPUT_DELAY = 0.5; // seconds before restart input is accepted

const Game = {
  canvas: null,
  ctx: null,

  // Which "mode" the game is in:
  //   'playing'  — normal gameplay
  //   'paused'   — frozen, waiting for ESC
  //   'dying'    — short dramatic moment after the last heart is lost
  //   'gameover' — results panel with a restart button
  state: 'playing',
  player: null,
  enemies: [],
  spawner: null,
  survivalTime: 0, // seconds survived in the current run
  animTime: 0, // seconds of animation (keeps running on the game-over screen)
  stateTime: 0, // seconds since the current state started
  showDebug: false,

  // Screen shake
  shakeTime: 0,
  shakeStrength: 0,

  // Mouse position in game pixels (for the restart button)
  mouseX: -1,
  mouseY: -1,

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
      if (this.state === 'playing') this.setState('paused');
    });

    // Mouse support for the restart button.
    canvas.addEventListener('mousemove', (event) => this.onMouseMove(event));
    canvas.addEventListener('mouseleave', () => { this.mouseX = -1; this.mouseY = -1; });
    canvas.addEventListener('click', (event) => this.onClick(event));
  },

  setState(newState) {
    this.state = newState;
    this.stateTime = 0;
  },

  // Put everything back to the starting state.
  resetRun() {
    const centerX = ARENA.x + ARENA.width / 2;
    const centerY = ARENA.y + ARENA.height / 2;
    this.player = new Player(centerX, centerY);
    this.enemies = [];
    this.spawner = new Spawner();
    this.survivalTime = 0;
    this.shakeTime = 0;
    Input.clear(); // forget keys held from the previous run
    this.setState('playing');
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
    if (Input.wasPressed('KeyG')) this.showDebug = !this.showDebug;
    this.stateTime += dt;

    if (this.state === 'paused') {
      if (Input.wasPressed('Escape')) this.setState('playing');
      return; // nothing in the world moves while paused
    }

    // Everything below keeps animating in every state except 'paused'.
    this.animTime += dt;
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    Arena.update(dt);

    if (this.state === 'playing') this.updatePlaying(dt);
    else if (this.state === 'dying') this.updateDying(dt);
    else if (this.state === 'gameover') this.updateGameOver();
  },

  updatePlaying(dt) {
    if (Input.wasPressed('Escape')) {
      this.setState('paused');
      return;
    }

    this.survivalTime += dt;
    this.player.update(dt);
    this.spawner.update(dt, this.survivalTime, this.player, this.enemies);
    for (const enemy of this.enemies) enemy.update(dt, this.player);
    separateEnemies(this.enemies);
    this.checkPlayerCollisions();

    // Remove defeated enemies (combat arrives in Stage 3).
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);
  },

  // Did any enemy touch the player this frame?
  checkPlayerCollisions() {
    const player = this.player;
    for (const enemy of this.enemies) {
      if (!player.canBeHit()) return;
      if (!circlesOverlap(player, enemy)) continue;

      const fatal = player.takeHit();
      enemy.knockBackFrom(player.x, player.y, CHASER_CONFIG.knockback);
      this.shake(3, 0.2);
      if (fatal) {
        this.shake(4, 0.5);
        this.setState('dying');
      }
    }
  },

  // A short freeze after the final hit, so the player sees what happened.
  updateDying(dt) {
    this.player.updateDeath(dt);
    if (this.stateTime >= DYING_DURATION) this.setState('gameover');
  },

  updateGameOver() {
    // Ignore input for a moment so a key held during the final hit
    // doesn't instantly skip the results.
    if (this.stateTime < GAMEOVER_INPUT_DELAY) return;
    if (Input.wasPressed('Enter') || Input.wasPressed('KeyR')) {
      this.resetRun();
    }
  },

  shake(strength, duration) {
    // Keep the strongest shake if two happen at once.
    if (strength >= this.shakeStrength || this.shakeTime === 0) this.shakeStrength = strength;
    this.shakeTime = Math.max(this.shakeTime, duration);
  },

  draw() {
    const ctx = this.ctx;

    // Screen shake moves the whole world by a few WHOLE pixels.
    ctx.save();
    if (this.shakeTime > 0) {
      const offsetX = randomInt(-this.shakeStrength, this.shakeStrength);
      const offsetY = randomInt(-this.shakeStrength, this.shakeStrength);
      ctx.translate(offsetX, offsetY);
    }
    Arena.draw(ctx, this.animTime);
    this.spawner.draw(ctx);
    // Draw enemies above the player's head first, so sprites overlap naturally.
    const things = [...this.enemies, this.player].sort((a, b) => a.y - b.y);
    for (const thing of things) thing.draw(ctx);
    ctx.restore();

    this.drawHud(ctx);
    if (this.showDebug) this.drawDebug(ctx);
    if (this.state === 'paused') this.drawPauseScreen(ctx);
    if (this.state === 'gameover') this.drawGameOverScreen(ctx);
  },

  // ---------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------
  drawHud(ctx) {
    // Hearts in the top-left corner.
    for (let i = 0; i < this.player.maxHealth; i++) {
      const image = i < this.player.health ? Sprites.heart.full : Sprites.heart.empty;
      ctx.drawImage(image, ARENA.x + i * 9, 4);
    }

    // Survival timer in the top middle.
    drawText(ctx, formatTime(this.survivalTime), VIEW_WIDTH / 2, 5, PALETTE.white, {
      align: 'center',
      shadow: PALETTE.darkBlue,
    });

    // Dash meter in the top-right: fills up while the dash recharges.
    const meterWidth = 30;
    const meterX = VIEW_WIDTH - ARENA.x - meterWidth - 1;
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

  drawGameOverScreen(ctx) {
    ctx.drawImage(getDitherOverlay(), 0, 0);

    // Pixel transition: the panel grows open in 8-pixel steps.
    const panelW = 160;
    const panelH = 92;
    const reveal = Math.min(1, this.stateTime / 0.3);
    const shownH = Math.max(8, Math.floor((panelH * reveal) / 8) * 8);
    const panelX = Math.floor((VIEW_WIDTH - panelW) / 2);
    const panelY = Math.floor((VIEW_HEIGHT - panelH) / 2);
    drawPixelPanel(ctx, panelX, panelY + Math.floor((panelH - shownH) / 2), panelW, shownH);
    if (reveal < 1) return;

    const cx = VIEW_WIDTH / 2;
    // The title flickers between red and pink like an old arcade sign.
    const titleColor = Math.floor(this.animTime * 4) % 2 === 0 ? PALETTE.red : PALETTE.pink;
    drawText(ctx, 'GAME OVER', cx, panelY + 9, titleColor, { align: 'center', scale: 2, shadow: PALETTE.void });

    drawText(ctx, 'SURVIVED', cx - 4, panelY + 30, PALETTE.cyanDim, { align: 'right' });
    drawText(ctx, formatTime(this.survivalTime), cx + 4, panelY + 30, PALETTE.white);
    drawText(ctx, getGameOverMessage(this.survivalTime), cx, panelY + 42, PALETTE.yellow, { align: 'center' });

    // Restart button: highlighted when hovered.
    const button = this.getRestartButton();
    const hovered = this.isMouseOver(button);
    ctx.fillStyle = hovered ? PALETTE.cyan : PALETTE.blue;
    ctx.fillRect(button.x, button.y, button.width, button.height);
    ctx.fillStyle = hovered ? PALETTE.white : PALETTE.cyanDim;
    ctx.fillRect(button.x, button.y, button.width, 1); // light top edge
    ctx.fillStyle = PALETTE.darkBlue;
    ctx.fillRect(button.x, button.y + button.height - 1, button.width, 1); // dark bottom edge
    drawText(ctx, 'RESTART', cx, button.y + 5, hovered ? PALETTE.void : PALETTE.white, { align: 'center' });

    drawText(ctx, 'OR PRESS ENTER / R', cx, button.y + button.height + 5, PALETTE.blue, { align: 'center' });
  },

  getRestartButton() {
    const width = 60;
    const height = 15;
    const panelY = Math.floor((VIEW_HEIGHT - 92) / 2);
    return { x: Math.floor((VIEW_WIDTH - width) / 2), y: panelY + 54, width, height };
  },

  // ---------------------------------------------------------------
  // Mouse
  // ---------------------------------------------------------------
  // The canvas is scaled up on screen, so convert the mouse position
  // from screen pixels back into the game's 320x180 pixels.
  onMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    this.mouseY = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT;
    const overButton = this.state === 'gameover' && this.isMouseOver(this.getRestartButton());
    this.canvas.style.cursor = overButton ? 'pointer' : 'default';
  },

  onClick(event) {
    this.onMouseMove(event);
    if (this.state !== 'gameover' || this.stateTime < GAMEOVER_INPUT_DELAY) return;
    if (this.isMouseOver(this.getRestartButton())) {
      this.canvas.style.cursor = 'default';
      this.resetRun();
    }
  },

  isMouseOver(box) {
    return (
      this.mouseX >= box.x && this.mouseX < box.x + box.width &&
      this.mouseY >= box.y && this.mouseY < box.y + box.height
    );
  },

  drawDebug(ctx) {
    const p = this.player;
    const lines = [
      'FPS ' + this.fps,
      'SCALE ' + currentScale + 'X',
      'X ' + p.x.toFixed(1) + ' Y ' + p.y.toFixed(1),
      'SPEED ' + Math.round(Math.hypot(p.vx, p.vy)),
      'ENEMIES ' + this.enemies.length,
      'SPAWN EVERY ' + this.spawner.getInterval(this.survivalTime).toFixed(2) + 'S',
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

// Turn seconds into a clock like 1:05.
function formatTime(seconds) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes + ':' + String(rest).padStart(2, '0');
}

// A short fun message depending on how long the player lasted.
function getGameOverMessage(seconds) {
  if (seconds < 15) return 'TIP: DASH THROUGH ENEMIES!';
  if (seconds < 40) return 'NOT BAD, NEON RUNNER.';
  if (seconds < 80) return 'SLICK MOVES!';
  if (seconds < 150) return 'THE SLIMES FEAR YOU.';
  return 'LEGENDARY SURVIVOR!';
}

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
