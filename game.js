// =====================================================================
//  NEON BREAKER  -  Stage 1: core prototype
//  Plain JavaScript + HTML Canvas. No libraries.
// =====================================================================
"use strict";

// ---------------------------------------------------------------------
// 1. SCREEN SETUP
//    The game is drawn on a tiny 320x180 canvas, then CSS scales it up.
//    That's what makes the pixels big, square and crisp.
// ---------------------------------------------------------------------
const W = 320;
const H = 180;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = W;
canvas.height = H;
ctx.imageSmoothingEnabled = false; // no blurry smoothing

// Make the canvas as big as possible without stretching it.
function resize() {
  let scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  // Whole-number scales (2x, 3x, 4x...) keep every pixel the same size.
  if (scale >= 2) scale = Math.floor(scale);
  canvas.style.width = Math.floor(W * scale) + "px";
  canvas.style.height = Math.floor(H * scale) + "px";
}
window.addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------------
// 2. SETTINGS - change these numbers to tweak the game
// ---------------------------------------------------------------------
const ARENA = { left: 4, right: W - 4, top: 14 }; // inside edges of the walls

const START_LIVES = 3;
const BALL_SIZE = 4;
const BALL_START_SPEED = 120;   // pixels per second
const BALL_MAX_SPEED = 190;
const BALL_SPEEDUP_PER_HIT = 1.5;
const MAX_BOUNCE_ANGLE = 1.05;  // ~60 degrees from straight up (paddle edges)
const MIN_BOUNCE_ANGLE = 0.12;  // ~7 degrees: never go perfectly straight up
const PADDLE_WIDTH = 32;
const PADDLE_HEIGHT = 5;
const PADDLE_KEY_SPEED = 210;   // pixels per second when using the keyboard
const BOARD_CLEAR_BONUS = 500;

// Colors (a small, limited palette)
const COLORS = {
  bg: "#070718",
  dots: "#141436",
  wall: "#5a2bc0",
  wallLight: "#9a6bff",
  wallDark: "#2c1366",
  white: "#ffffff",
  dim: "#6a6a9a",
  cyan: "#2ee6ff",
  cyanLight: "#b2fbff",
  cyanDark: "#0b7f99",
  magenta: "#ff2fd1",
  orange: "#ff8a1e",
  green: "#3ee85a",
  panel: "#0d1030",
};

// Each brick color has a light edge, a main color, a dark edge and points.
const BRICK_TYPES = {
  M: { light: "#ff9cf2", base: "#ff2fd1", dark: "#9c1080", points: 50 },
  P: { light: "#c9a2ff", base: "#9a4dff", dark: "#5320a8", points: 40 },
  O: { light: "#ffd08a", base: "#ff8a1e", dark: "#a84c00", points: 30 },
  G: { light: "#b4ff9c", base: "#3ee85a", dark: "#16852b", points: 20 },
  C: { light: "#b2fbff", base: "#2ee6ff", dark: "#0b7f99", points: 10 },
};

// The brick layout. Each letter is a brick, "." is an empty space.
const LAYOUT = [
  "..MMMMMM..",
  ".PPPPPPPP.",
  "OOOOOOOOOO",
  "GGGGGGGGGG",
  "CCCCCCCCCC",
  "CC.CCCC.CC",
];
const BRICK_W = 26;
const BRICK_H = 8;
const BRICK_GAP = 2;
const BRICKS_TOP = 24;

// ---------------------------------------------------------------------
// 3. PIXEL FONT
//    Each character is a 3x5 grid. "1" = draw a pixel, "0" = empty.
//    Drawing our own font guarantees perfectly crisp pixel text.
// ---------------------------------------------------------------------
const FONT = {
  A: ["010", "101", "111", "101", "101"], B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"], D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"], F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"], H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"], J: ["001", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"], L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"], N: ["110", "101", "101", "101", "101"],
  O: ["010", "101", "101", "101", "010"], P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "110", "011"], R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"], T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"], V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"], X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"], Z: ["111", "001", "010", "100", "111"],
  0: ["111", "101", "101", "101", "111"], 1: ["010", "110", "010", "010", "111"],
  2: ["110", "001", "010", "100", "111"], 3: ["110", "001", "010", "001", "110"],
  4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "110", "001", "110"],
  6: ["011", "100", "111", "101", "111"], 7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"], 9: ["111", "101", "111", "001", "110"],
  " ": ["000", "000", "000", "000", "000"], ":": ["000", "010", "000", "010", "000"],
  "-": ["000", "000", "111", "000", "000"], "!": ["010", "010", "010", "000", "010"],
  ".": ["000", "000", "000", "000", "010"], "/": ["001", "001", "010", "100", "100"],
  "?": ["110", "001", "010", "000", "010"], "+": ["000", "010", "111", "010", "000"],
  ",": ["000", "000", "000", "010", "100"], "'": ["010", "010", "000", "000", "000"],
};

// Width in pixels of a piece of text (each letter is 3 wide + 1 space).
function textWidth(text, scale) {
  return String(text).length * 4 * scale - scale;
}

// Draw text. align can be "left", "center" or "right".
// If shadowColor is given, a copy is drawn one "pixel" lower first.
function drawText(text, x, y, color, scale = 1, align = "left", shadowColor = null) {
  text = String(text).toUpperCase();
  if (align === "center") x -= Math.floor(textWidth(text, scale) / 2);
  if (align === "right") x -= textWidth(text, scale);
  x = Math.round(x);
  y = Math.round(y);

  if (shadowColor) drawText(text, x, y + scale, shadowColor, scale, "left");

  ctx.fillStyle = color;
  for (const ch of text) {
    const glyph = FONT[ch] || FONT["?"];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (glyph[row][col] === "1") {
          ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
        }
      }
    }
    x += 4 * scale;
  }
}

// ---------------------------------------------------------------------
// 4. GAME OBJECTS AND STATE
// ---------------------------------------------------------------------
// state is one of: "title", "play", "gameover"
let state = "title";
let score = 0;
let lives = START_LIVES;
let time = 0;            // seconds since the page loaded (used for blinking)
let message = "";        // big message in the middle of the screen
let messageTimer = 0;    // how many seconds the message stays

const paddle = {
  x: (W - PADDLE_WIDTH) / 2,
  y: H - 16,
  w: PADDLE_WIDTH,
  h: PADDLE_HEIGHT,
};

const ball = {
  x: 0,
  y: 0,
  size: BALL_SIZE,
  vx: 0,             // horizontal speed (pixels per second)
  vy: 0,             // vertical speed (negative = moving up)
  speed: BALL_START_SPEED,
  stuck: true,       // true = resting on the paddle, waiting to launch
};

let bricks = [];

// Turn the LAYOUT strings into brick objects.
function buildBricks() {
  bricks = [];
  const cols = LAYOUT[0].length;
  const totalWidth = cols * BRICK_W + (cols - 1) * BRICK_GAP;
  const startX = Math.floor((W - totalWidth) / 2);

  for (let row = 0; row < LAYOUT.length; row++) {
    for (let col = 0; col < cols; col++) {
      const letter = LAYOUT[row][col];
      const type = BRICK_TYPES[letter];
      if (!type) continue; // "." or unknown letter = no brick
      bricks.push({
        x: startX + col * (BRICK_W + BRICK_GAP),
        y: BRICKS_TOP + row * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        type: type,
        hits: 1,      // hits left before it breaks
        alive: true,
      });
    }
  }
}

// Start a completely fresh run.
function startGame() {
  score = 0;
  lives = START_LIVES;
  message = "";
  messageTimer = 0;
  buildBricks();
  paddle.w = PADDLE_WIDTH;
  paddle.x = (W - paddle.w) / 2;
  resetBall();
  state = "play";
}

// Put the ball back on the paddle.
function resetBall() {
  ball.stuck = true;
  ball.vx = 0;
  ball.vy = 0;
  ball.speed = BALL_START_SPEED;
  placeBallOnPaddle();
}

function placeBallOnPaddle() {
  ball.x = paddle.x + paddle.w / 2 - ball.size / 2;
  ball.y = paddle.y - ball.size;
}

// Launch the ball upward at a slightly random angle.
function launchBall() {
  if (state !== "play" || !ball.stuck) return;
  ball.stuck = false;
  const side = Math.random() < 0.5 ? -1 : 1;
  const angle = side * (0.2 + Math.random() * 0.35); // 11 to 31 degrees
  ball.vx = Math.sin(angle) * ball.speed;
  ball.vy = -Math.cos(angle) * ball.speed;
}

function showMessage(text, seconds) {
  message = text;
  messageTimer = seconds;
}

// ---------------------------------------------------------------------
// 5. INPUT (keyboard, mouse and touch)
// ---------------------------------------------------------------------
const keys = {};                 // which keys are held down right now
const pointer = { x: -1, y: -1 }; // mouse/finger position in game pixels

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  // Stop arrow keys and space from scrolling the page.
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  if (e.repeat) return;
  if (e.code === "Space" || e.code === "Enter") {
    if (state === "play") launchBall();
    else startGame(); // title or game over: start a new run
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// If the window loses focus, forget held keys so the paddle doesn't drift.
window.addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
});

// Convert a screen position into a position on our 320x180 canvas.
function toGamePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  };
}

function movePaddleTo(x) {
  paddle.x = x - paddle.w / 2;
  clampPaddle();
}

function clampPaddle() {
  if (paddle.x < ARENA.left) paddle.x = ARENA.left;
  if (paddle.x + paddle.w > ARENA.right) paddle.x = ARENA.right - paddle.w;
}

// Pointer events work for both the mouse and touchscreens.
window.addEventListener("pointermove", (e) => {
  const p = toGamePos(e);
  pointer.x = p.x;
  pointer.y = p.y;
  if (state === "play") movePaddleTo(p.x);
});

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const p = toGamePos(e);
  pointer.x = p.x;
  pointer.y = p.y;

  if (state === "play") {
    movePaddleTo(p.x);
    launchBall(); // tapping / clicking launches the ball
  } else if (pointInRect(p, currentButton())) {
    startGame();
  }
});

// ---------------------------------------------------------------------
// 6. COLLISION HELPERS
// ---------------------------------------------------------------------
// Do two rectangles overlap? (each has x, y, w, h)
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointInRect(p, r) {
  return r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

function ballRect() {
  return { x: ball.x, y: ball.y, w: ball.size, h: ball.size };
}

// Change the ball's speed but keep its direction.
function setBallSpeed(newSpeed) {
  const factor = newSpeed / ball.speed;
  ball.vx *= factor;
  ball.vy *= factor;
  ball.speed = newSpeed;
}

// Stop the ball from moving almost flat (endless side-to-side bouncing)
// or almost perfectly vertical (endless up-and-down bouncing).
function keepAngleSane() {
  const s = ball.speed;
  const minVy = s * 0.3;
  if (Math.abs(ball.vy) < minVy) {
    ball.vy = (ball.vy < 0 ? -1 : 1) * minVy;
    ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(s * s - minVy * minVy);
  }
  const minVx = s * 0.1;
  if (Math.abs(ball.vx) < minVx) {
    ball.vx = (ball.vx < 0 ? -1 : 1) * minVx;
    ball.vy = (ball.vy < 0 ? -1 : 1) * Math.sqrt(s * s - minVx * minVx);
  }
}

// ---------------------------------------------------------------------
// 7. BALL MOVEMENT AND BOUNCING
//    The ball moves in many tiny steps (max 1.5 pixels each) so it can
//    never skip through a brick or a wall, even if the game lags.
//    In each step we move X first and check for hits, then Y. Knowing
//    which direction caused the hit tells us which speed to flip.
// ---------------------------------------------------------------------
function moveBall(dt) {
  const distance = ball.speed * dt;
  const steps = Math.max(1, Math.ceil(distance / 1.5));
  const stepTime = dt / steps;

  for (let i = 0; i < steps; i++) {
    // ---- Horizontal movement ----
    ball.x += ball.vx * stepTime;
    if (ball.x < ARENA.left) {
      ball.x = ARENA.left;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.size > ARENA.right) {
      ball.x = ARENA.right - ball.size;
      ball.vx = -Math.abs(ball.vx);
    }
    collideWithBricks("x");

    // ---- Vertical movement ----
    const oldBottom = ball.y + ball.size;
    ball.y += ball.vy * stepTime;
    if (ball.y < ARENA.top) {
      ball.y = ARENA.top;
      ball.vy = Math.abs(ball.vy);
      keepAngleSane();
    }
    collideWithBricks("y");

    // Paddle: only bounce if the ball is falling and came from above.
    if (ball.vy > 0 && rectsOverlap(ballRect(), paddle) && oldBottom <= paddle.y + 2) {
      bounceOffPaddle();
    }

    // Fell off the bottom of the screen?
    if (ball.y > H) {
      loseLife();
      return;
    }

    // All bricks gone?
    if (!bricks.some((b) => b.alive)) {
      boardCleared();
      return;
    }
  }
}

// Check the ball against every brick. axis is "x" or "y": the direction
// the ball just moved in, which decides how it bounces.
function collideWithBricks(axis) {
  const br = ballRect();
  let hit = false;
  let edge = null; // where to put the ball so it is outside the brick(s)

  for (const b of bricks) {
    if (!b.alive || !rectsOverlap(br, b)) continue;
    hit = true;
    if (axis === "x") {
      edge = ball.vx > 0 ? Math.min(edge ?? Infinity, b.x - ball.size)
                         : Math.max(edge ?? -Infinity, b.x + b.w);
    } else {
      edge = ball.vy > 0 ? Math.min(edge ?? Infinity, b.y - ball.size)
                         : Math.max(edge ?? -Infinity, b.y + b.h);
    }
    hitBrick(b);
  }

  if (!hit) return;

  // Push the ball out and reverse the matching direction.
  if (axis === "x") {
    ball.x = edge;
    ball.vx = -ball.vx;
  } else {
    ball.y = edge;
    ball.vy = -ball.vy;
  }
  setBallSpeed(Math.min(BALL_MAX_SPEED, ball.speed + BALL_SPEEDUP_PER_HIT));
  keepAngleSane();
}

function hitBrick(b) {
  b.hits -= 1;
  if (b.hits <= 0) {
    b.alive = false;
    score += b.type.points;
  }
}

// Where the ball lands on the paddle decides where it goes:
// hit the middle -> goes up, hit the edges -> goes off at a steep angle.
function bounceOffPaddle() {
  const ballCenter = ball.x + ball.size / 2;
  const paddleCenter = paddle.x + paddle.w / 2;
  let offset = (ballCenter - paddleCenter) / (paddle.w / 2 + ball.size / 2);
  offset = Math.max(-1, Math.min(1, offset)); // keep between -1 and 1

  let angle = offset * MAX_BOUNCE_ANGLE;
  if (Math.abs(angle) < MIN_BOUNCE_ANGLE) {
    // Too close to straight up: tilt it a little.
    const side = angle !== 0 ? Math.sign(angle) : (ball.vx >= 0 ? 1 : -1);
    angle = side * MIN_BOUNCE_ANGLE;
  }

  ball.vx = Math.sin(angle) * ball.speed;
  ball.vy = -Math.cos(angle) * ball.speed;
  ball.y = paddle.y - ball.size; // sit exactly on top of the paddle
}

function loseLife() {
  lives -= 1;
  if (lives <= 0) {
    state = "gameover";
  } else {
    showMessage("MISS!", 1.2);
    resetBall();
  }
}

// Stage 1 has a single layout, so clearing it rebuilds the same board.
function boardCleared() {
  score += BOARD_CLEAR_BONUS;
  showMessage("BOARD CLEAR +" + BOARD_CLEAR_BONUS, 2);
  buildBricks();
  resetBall();
}

// ---------------------------------------------------------------------
// 8. UPDATE - runs every frame, moves everything
// ---------------------------------------------------------------------
function update(dt) {
  time += dt;
  if (messageTimer > 0) messageTimer -= dt;
  if (state !== "play") return;

  // Keyboard paddle movement
  let dir = 0;
  if (keys.ArrowLeft || keys.KeyA) dir -= 1;
  if (keys.ArrowRight || keys.KeyD) dir += 1;
  paddle.x += dir * PADDLE_KEY_SPEED * dt;
  clampPaddle();

  if (ball.stuck) {
    placeBallOnPaddle();
  } else {
    moveBall(dt);
  }
}

// ---------------------------------------------------------------------
// 9. DRAWING
// ---------------------------------------------------------------------
// The background and walls never change, so we draw them once onto a
// hidden canvas and copy it each frame.
const background = makeBackground();

function makeBackground() {
  const bg = document.createElement("canvas");
  bg.width = W;
  bg.height = H;
  const g = bg.getContext("2d");

  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, W, H);

  // Dotted grid
  g.fillStyle = COLORS.dots;
  for (let y = ARENA.top + 4; y < H; y += 8) {
    for (let x = ARENA.left + 4; x < ARENA.right; x += 8) {
      g.fillRect(x, y, 1, 1);
    }
  }

  // Walls: top bar and both sides, with a light inner edge
  g.fillStyle = COLORS.wall;
  g.fillRect(0, ARENA.top - 3, W, 3);
  g.fillRect(0, ARENA.top - 3, ARENA.left, H);
  g.fillRect(ARENA.right, ARENA.top - 3, W - ARENA.right, H);
  g.fillStyle = COLORS.wallLight;
  g.fillRect(ARENA.left - 1, ARENA.top - 1, ARENA.right - ARENA.left + 2, 1);
  g.fillRect(ARENA.left - 1, ARENA.top - 1, 1, H);
  g.fillRect(ARENA.right, ARENA.top - 1, 1, H);
  // Rivets on the walls
  g.fillStyle = COLORS.wallDark;
  for (let y = ARENA.top + 4; y < H; y += 10) {
    g.fillRect(1, y, 2, 2);
    g.fillRect(W - 3, y, 2, 2);
  }
  for (let x = 8; x < W - 8; x += 12) {
    g.fillRect(x, ARENA.top - 2, 2, 1);
  }
  return bg;
}

function drawBrick(b) {
  const t = b.type;
  ctx.fillStyle = t.dark;   // dark outline / shadow (bottom and right)
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = t.base;   // main color
  ctx.fillRect(b.x, b.y, b.w - 1, b.h - 1);
  ctx.fillStyle = t.light;  // light edge (top and left)
  ctx.fillRect(b.x, b.y, b.w - 1, 1);
  ctx.fillRect(b.x, b.y, 1, b.h - 1);
  ctx.fillRect(b.x + 2, b.y + 2, 3, 1); // little shine
  ctx.fillStyle = t.dark;   // small groove detail
  ctx.fillRect(b.x + b.w - 5, b.y + b.h - 3, 2, 1);
}

function drawPaddle() {
  const x = Math.round(paddle.x);
  const y = Math.round(paddle.y);
  const w = paddle.w;
  const h = paddle.h;
  ctx.fillStyle = COLORS.cyanDark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(x, y, w, h - 1);
  ctx.fillStyle = COLORS.cyanLight;
  ctx.fillRect(x + 1, y, w - 2, 1);
  // Magenta caps on both ends
  ctx.fillStyle = COLORS.magenta;
  ctx.fillRect(x, y + 1, 2, h - 2);
  ctx.fillRect(x + w - 2, y + 1, 2, h - 2);
}

function drawBall() {
  const x = Math.round(ball.x);
  const y = Math.round(ball.y);
  // A 4x4 square with the corners cut off looks round in pixel art.
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(x + 1, y, 2, 4);
  ctx.fillRect(x, y + 1, 4, 2);
  ctx.fillStyle = COLORS.cyanLight;
  ctx.fillRect(x + 2, y + 2, 1, 1);
}

function drawHUD() {
  drawText("SCORE", 4, 3, COLORS.dim);
  drawText(String(score).padStart(6, "0"), 28, 3, COLORS.white);

  drawText("LIVES", W - 4 - 20 - 4 * 8, 3, COLORS.dim);
  // One little paddle icon per life
  for (let i = 0; i < lives; i++) {
    const x = W - 4 - 6 - i * 8;
    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(x, 4, 6, 3);
    ctx.fillStyle = COLORS.cyanLight;
    ctx.fillRect(x, 4, 6, 1);
  }
}

// Buttons for the menu screens
const PLAY_BUTTON = { x: W / 2 - 30, y: 116, w: 60, h: 15, label: "PLAY" };
const AGAIN_BUTTON = { x: W / 2 - 40, y: 116, w: 80, h: 15, label: "PLAY AGAIN" };

function currentButton() {
  if (state === "title") return PLAY_BUTTON;
  if (state === "gameover") return AGAIN_BUTTON;
  return null;
}

function drawButton(btn) {
  const hover = pointInRect(pointer, btn);
  ctx.fillStyle = hover ? COLORS.cyan : COLORS.panel;
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
  // 1-pixel border
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(btn.x, btn.y, btn.w, 1);
  ctx.fillRect(btn.x, btn.y + btn.h - 1, btn.w, 1);
  ctx.fillRect(btn.x, btn.y, 1, btn.h);
  ctx.fillRect(btn.x + btn.w - 1, btn.y, 1, btn.h);
  drawText(btn.label, btn.x + btn.w / 2, btn.y + 5, hover ? COLORS.bg : COLORS.cyan, 1, "center");
}

function dimScreen() {
  ctx.fillStyle = "rgba(4, 4, 16, 0.8)";
  ctx.fillRect(0, 0, W, H);
}

function blinkOn() {
  return Math.floor(time * 2) % 2 === 0; // on for 0.5s, off for 0.5s
}

function drawTitleScreen() {
  dimScreen();
  drawText("NEON", W / 2, 22, COLORS.cyan, 4, "center", COLORS.magenta);
  drawText("BREAKER", W / 2, 48, COLORS.cyan, 4, "center", COLORS.magenta);
  drawText("MOVE: MOUSE / A D / ARROWS", W / 2, 80, COLORS.white, 1, "center");
  drawText("LAUNCH: SPACE OR TAP", W / 2, 89, COLORS.white, 1, "center");
  drawText("BREAK EVERY BRICK!", W / 2, 98, COLORS.orange, 1, "center");
  drawButton(PLAY_BUTTON);
  if (blinkOn()) drawText("PRESS SPACE", W / 2, 140, COLORS.dim, 1, "center");
}

function drawGameOverScreen() {
  dimScreen();
  drawText("GAME OVER", W / 2, 40, COLORS.magenta, 3, "center", COLORS.wallDark);
  drawText("FINAL SCORE", W / 2, 72, COLORS.dim, 1, "center");
  drawText(String(score).padStart(6, "0"), W / 2, 82, COLORS.white, 2, "center");
  drawButton(AGAIN_BUTTON);
  if (blinkOn()) drawText("PRESS SPACE", W / 2, 140, COLORS.dim, 1, "center");
}

function draw() {
  ctx.drawImage(background, 0, 0);

  for (const b of bricks) {
    if (b.alive) drawBrick(b);
  }
  drawPaddle();
  if (state === "play") drawBall();
  drawHUD();

  if (state === "play" && ball.stuck && messageTimer <= 0 && blinkOn()) {
    drawText("SPACE / TAP TO LAUNCH", W / 2, 120, COLORS.white, 1, "center");
  }
  if (messageTimer > 0) {
    drawText(message, W / 2, 110, COLORS.orange, 2, "center", COLORS.wallDark);
  }

  if (state === "title") drawTitleScreen();
  if (state === "gameover") drawGameOverScreen();
}

// ---------------------------------------------------------------------
// 10. GAME LOOP
//     requestAnimationFrame calls loop() about 60 times a second.
//     dt = seconds since the last frame, so speed is the same on any
//     computer, whether it runs at 30, 60 or 144 frames per second.
// ---------------------------------------------------------------------
let lastTime = performance.now();

function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.05) dt = 0.05; // after a lag spike or tab switch, don't jump
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

buildBricks(); // so bricks show behind the title screen
requestAnimationFrame(loop);
