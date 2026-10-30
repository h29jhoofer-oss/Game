// =====================================================================
//  NEON BREAKER  -  Stage 2: complete arcade loop
//
//  The file is organised top to bottom:
//    1. Settings        - numbers you can tweak to change the game
//    2. Colors & art    - palette, brick types, levels, font, sprites
//    3. Canvas setup    - low-res canvas + scaling to fit the window
//    4. Game state      - every variable that changes while playing
//    5. Game actions    - start game, next level, pause, lose life, ...
//    6. Update          - moves things and checks collisions
//    7. Drawing         - paints everything onto the canvas
//    8. Input           - mouse, touch and keyboard
//    9. Main loop       - requestAnimationFrame
// =====================================================================

"use strict";

// ---------------------------------------------------------------------
// 1. SETTINGS
// ---------------------------------------------------------------------

// The game is drawn at this tiny size, then scaled up. Every position
// and size below is measured in these "game pixels".
const GAME_WIDTH = 320;
const GAME_HEIGHT = 180;
const HUD_HEIGHT = 12;            // the score bar at the top

const PADDLE_WIDTH = 32;
const PADDLE_HEIGHT = 5;
const PADDLE_Y = 166;             // distance from the top of the screen
const PADDLE_KEY_SPEED = 220;     // pixels per second when using keys

const BALL_SIZE = 4;              // the ball is a 4x4 pixel square
const BALL_SPEEDUP_PER_BRICK = 1.5;

// Each level makes the ball a little faster, up to a limit.
const BALL_START_SPEED = 110;     // level 1 launch speed (pixels/second)
const BALL_START_SPEED_LIMIT = 150;
const BALL_MAX_SPEED = 170;       // level 1 top speed
const BALL_MAX_SPEED_LIMIT = 210;
const SPEED_INCREASE_PER_LEVEL = 8;

// Where the ball goes after hitting the paddle depends on where it hit.
// Center = almost straight up, edges = up to 60 degrees to the side.
const MAX_BOUNCE_ANGLE = 60;      // degrees away from straight up
const MIN_BOUNCE_ANGLE = 10;      // never go perfectly straight up

const BRICK_COLUMNS = 14;
const BRICK_CELL_WIDTH = 20;      // each brick sits in a 20x8 cell...
const BRICK_CELL_HEIGHT = 8;
const BRICK_GAP = 1;              // ...with a 1 pixel gap to the next one
const BRICK_TOP = 24;
const BRICK_LEFT = (GAME_WIDTH - BRICK_COLUMNS * BRICK_CELL_WIDTH) / 2;

const MOVING_BRICK_RANGE = 16;    // pixels a moving brick slides each way
const MOVING_BRICK_SPEED = 14;    // pixels per second
const BRICK_HIT_FLASH = 0.08;     // seconds a brick flashes white when hit
const EXPLOSION_TIME = 0.25;      // seconds the explosion square is shown

const START_LIVES = 3;
const SCREEN_INPUT_DELAY = 0.6;   // seconds before menus accept input
const BEST_SCORE_KEY = "neonBreakerBestScore"; // name used in localStorage

// The pause button in the top-right corner (needed on phones).
// The tap area is bigger than the icon so it's easy to hit with a finger.
const PAUSE_ICON = { x: 308, y: 1, w: 10, h: 9 };
const PAUSE_TAP_AREA = { x: 284, y: 0, w: 36, h: 20 };

// ---------------------------------------------------------------------
// 2. COLORS & ART
// ---------------------------------------------------------------------

// A small, limited palette keeps the pixel art cohesive.
// Every brick color has three shades: light (top/left edge),
// base (the middle) and dark (bottom/right edge).
const COLORS = {
  background: "#0a0a1f",
  gridDot: "#16163a",
  hud: "#06061a",
  hudLine: "#2a2a5e",
  white: "#f0f0ff",
  dim: "#7a7ab8",
  shadow: "#1c0a3a",
  heart: "#ff2fd0",

  magenta: { light: "#ff9cf5", base: "#ff2fd0", dark: "#9a0f80" },
  purple:  { light: "#c9a2ff", base: "#8a4dff", dark: "#4a1fa0" },
  cyan:    { light: "#a8ffff", base: "#22e3ff", dark: "#0a7a9a" },
  green:   { light: "#b6ffb0", base: "#3dff6e", dark: "#138a3a" },
  orange:  { light: "#ffd29a", base: "#ff8a1e", dark: "#a34a08" },
  yellow:  { light: "#ffffc0", base: "#fff04a", dark: "#a08a10" },

  steel:     { light: "#e8e8ff", base: "#9a9ad0", dark: "#4a4a80" },
  heavy:     { light: "#d8c8ff", base: "#6a5aa8", dark: "#2e2460" },
  explosive: { light: "#fff04a", base: "#ff5a1e", dark: "#5a0a10" },
  mover:     { light: "#d0fff0", base: "#2affc0", dark: "#0a7a60" },
};

// Each character in a level layout means one kind of brick.
//   kind "normal"    - breaks in one hit
//   kind "armored"   - needs `hp` hits, shows cracks when damaged
//   kind "explosive" - destroys the bricks around it when it breaks
//   kind "moving"    - slides left and right along its row
const BRICK_TYPES = {
  M:   { kind: "normal",    colors: COLORS.magenta,   points: 50 },
  P:   { kind: "normal",    colors: COLORS.purple,    points: 40 },
  C:   { kind: "normal",    colors: COLORS.cyan,      points: 30 },
  G:   { kind: "normal",    colors: COLORS.green,     points: 20 },
  O:   { kind: "normal",    colors: COLORS.orange,    points: 10 },
  A:   { kind: "armored",   colors: COLORS.steel,     points: 60, hp: 2 },
  H:   { kind: "armored",   colors: COLORS.heavy,     points: 90, hp: 3 },
  X:   { kind: "explosive", colors: COLORS.explosive, points: 40 },
  "~": { kind: "moving",    colors: COLORS.mover,     points: 70 },
};

// Handcrafted levels: one string per row, one character per column.
// A dot "." means "no brick here". Every row must be 14 characters.
//
// Moving bricks ("~") all slide together, so rows containing them should
// hold ONLY moving bricks and dots (otherwise they'd slide into a still
// brick). After the last level, the levels repeat with a faster ball.
const LEVELS = [
  // Level 1 - warm up
  [
    "..MMMMMMMMMM..",
    ".PPPPPPPPPPPP.",
    "CCCCCCCCCCCCCC",
    "GGGGGG..GGGGGG",
    "OOOOOOOOOOOOOO",
    ".OOOO....OOOO.",
  ],
  // Level 2 - armored bricks appear
  [
    "..AAAAAAAAAA..",
    "..MMMMMMMMMM..",
    "PP..PPPPPP..PP",
    "CCCC..CC..CCCC",
    "GGGGGGGGGGGGGG",
    "OOOOOOOOOOOOOO",
  ],
  // Level 3 - explosive bricks appear
  [
    "MMMMMMMMMMMMMM",
    "PPPXPPPPPPXPPP",
    "CCCCCCCCCCCCCC",
    "AAA.GGXXGG.AAA",
    "OOOOOOOOOOOOOO",
    "..OOOXOOXOOO..",
  ],
  // Level 4 - moving bricks appear
  [
    "AAAAAAAAAAAAAA",
    "MMMXMMMMMMXMMM",
    "..............",
    "..~~~~~~~~~~..",
    "..............",
    "CCCCCCCCCCCCCC",
    "GGGGGGGGGGGGGG",
  ],
  // Level 5 - heavy armor
  [
    "HHHHHHHHHHHHHH",
    "MPCGOXAAXOGCPM",
    "~~~~..~~..~~~~",
    "PPPPPPPPPPPPPP",
    "C.C.C.CXC.C.C.",
    "GGGXGGGGGGXGGG",
    "OOOOOOOOOOOOOO",
  ],
  // Level 6 - everything at once
  [
    "HHAAAAAAAAAAHH",
    "XMMMMMMMMMMMMX",
    "..~~~~..~~~~..",
    "PPPPXPPPPXPPPP",
    "..~~~~..~~~~..",
    "CCAAAACCAAAACC",
    "GGGGGGGGGGGGGG",
    "OOOXOOOOOOXOOO",
  ],
];

// A tiny 3x5 pixel font. Each character is 15 digits: 5 rows of 3,
// read left to right, top to bottom. "1" = pixel on, "0" = pixel off.
// Example "A":  010
//               101
//               111
//               101
//               101
const FONT = {
  "A": "010101111101101", "B": "110101110101110", "C": "011100100100011",
  "D": "110101101101110", "E": "111100110100111", "F": "111100110100100",
  "G": "011100101101011", "H": "101101111101101", "I": "111010010010111",
  "J": "001001001101010", "K": "101101110101101", "L": "100100100100111",
  "M": "101111111101101", "N": "110101101101101", "O": "010101101101010",
  "P": "110101110100100", "Q": "010101101110011", "R": "110101110101101",
  "S": "011100010001110", "T": "111010010010010", "U": "101101101101111",
  "V": "101101101101010", "W": "101101111111101", "X": "101101010101101",
  "Y": "101101010010010", "Z": "111001010100111",
  "0": "111101101101111", "1": "010110010010111", "2": "110001010100111",
  "3": "110001010001110", "4": "101101111001001", "5": "111100110001110",
  "6": "011100111101111", "7": "111001010010010", "8": "111101111101111",
  "9": "111101111001110",
  " ": "000000000000000", ".": "000000000000010", ",": "000000000010100",
  ":": "000010000010000", "!": "010010010000010", "?": "110001010000010",
  "-": "000000111000000", "/": "001001010100100",
};

// Small sprites drawn pixel by pixel. Each character picks a color
// from the matching color map; "." means transparent.
const BALL_SPRITE = [
  ".ww.",
  "wwwc",
  "wwwc",
  ".cc.",
];
const BALL_COLORS = { w: COLORS.white, c: COLORS.cyan.base };

const HEART_SPRITE = [
  "hh.hh",
  "hhhhh",
  ".hhh.",
  "..h..",
];
const HEART_COLORS = { h: COLORS.heart };

// Catch typing mistakes in the level layouts early.
LEVELS.forEach((layout, i) => {
  layout.forEach((row) => {
    if (row.length !== BRICK_COLUMNS) {
      console.warn(`Level ${i + 1}: row "${row}" should be ${BRICK_COLUMNS} characters long`);
    }
  });
});

// ---------------------------------------------------------------------
// 3. CANVAS SETUP
// ---------------------------------------------------------------------

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// The canvas really is only 320x180 pixels...
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;
// ...and we tell it never to blur pixels when drawing images.
ctx.imageSmoothingEnabled = false;

// Make the canvas as big as possible without stretching it.
function resizeCanvas() {
  const fit = Math.min(
    window.innerWidth / GAME_WIDTH,
    window.innerHeight / GAME_HEIGHT
  );
  // When there's room, use a whole number (2x, 3x, 4x...) so every game
  // pixel becomes the same number of screen pixels: perfectly crisp.
  // On small screens (like phones) use whatever fits.
  const scale = fit >= 2 ? Math.floor(fit) : fit;
  canvas.style.width = Math.floor(GAME_WIDTH * scale) + "px";
  canvas.style.height = Math.floor(GAME_HEIGHT * scale) + "px";
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Draw the dotted background grid once into a hidden canvas,
// then copy it every frame (much faster than redrawing every dot).
const backgroundCanvas = document.createElement("canvas");
backgroundCanvas.width = GAME_WIDTH;
backgroundCanvas.height = GAME_HEIGHT;
(function drawBackgroundOnce() {
  const bg = backgroundCanvas.getContext("2d");
  bg.fillStyle = COLORS.background;
  bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  bg.fillStyle = COLORS.gridDot;
  for (let y = HUD_HEIGHT + 4; y < GAME_HEIGHT; y += 8) {
    for (let x = 4; x < GAME_WIDTH; x += 8) {
      bg.fillRect(x, y, 1, 1);
    }
  }
})();

// ---------------------------------------------------------------------
// 4. GAME STATE
// ---------------------------------------------------------------------

// Which screen we are on:
//   "title", "playing", "paused", "levelcomplete" or "gameover"
let gameState = "title";
let screenTimer = 0;     // seconds spent on the current screen
let score = 0;
let bestScore = loadBestScore();
let isNewBest = false;   // did this run beat the old best score?
let lives = START_LIVES;
let level = 1;
let levelTime = 0;       // seconds played on this level (drives moving bricks)
let ballStartSpeed = BALL_START_SPEED;
let ballMaxSpeed = BALL_MAX_SPEED;
let bricks = [];
let explosions = [];     // short-lived explosion squares
let paddle = null;
let ball = null;

const keys = {};                    // which keys are held down right now
const pointer = { x: -100, y: -100 }; // mouse/finger position in game pixels

// ---------------------------------------------------------------------
// 5. GAME ACTIONS
// ---------------------------------------------------------------------

// Begin a completely fresh run. Everything is reset here or in
// startLevel(), so nothing from the previous game can leak into the new one.
function startGame() {
  score = 0;
  isNewBest = false;
  lives = START_LIVES;
  level = 1;
  startLevel();
}

// Set up the bricks, paddle and ball for the current `level`.
function startLevel() {
  const layout = LEVELS[(level - 1) % LEVELS.length];
  bricks = buildBricks(layout);
  explosions = [];
  levelTime = 0;

  // Each level is a bit faster than the one before.
  const extraSpeed = (level - 1) * SPEED_INCREASE_PER_LEVEL;
  ballStartSpeed = Math.min(BALL_START_SPEED_LIMIT, BALL_START_SPEED + extraSpeed);
  ballMaxSpeed = Math.min(BALL_MAX_SPEED_LIMIT, BALL_MAX_SPEED + extraSpeed);

  paddle = {
    x: (GAME_WIDTH - PADDLE_WIDTH) / 2,
    y: PADDLE_Y,
    w: PADDLE_WIDTH,
    h: PADDLE_HEIGHT,
  };
  resetBall();
  changeState("playing");
}

function nextLevel() {
  level++;
  startLevel();
}

function changeState(newState) {
  gameState = newState;
  screenTimer = 0;
  // Hide the mouse cursor during play (the paddle replaces it).
  canvas.style.cursor = newState === "playing" ? "none" : "default";
}

function pauseGame() {
  if (gameState === "playing") changeState("paused");
}

function resumeGame() {
  if (gameState === "paused") changeState("playing");
}

// Turn the text layout into a list of brick objects.
function buildBricks(layout) {
  const list = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < BRICK_COLUMNS; col++) {
      const type = BRICK_TYPES[layout[row][col]];
      if (!type) continue; // "." or unknown letter = empty cell
      const x = BRICK_LEFT + col * BRICK_CELL_WIDTH;
      list.push({
        x: x,
        y: BRICK_TOP + row * BRICK_CELL_HEIGHT,
        w: BRICK_CELL_WIDTH - BRICK_GAP,
        h: BRICK_CELL_HEIGHT - BRICK_GAP,
        kind: type.kind,
        colors: type.colors,
        points: type.points,
        hp: type.hp || 1,
        maxHp: type.hp || 1,
        flash: 0,                        // seconds left of the white hit flash
        startX: x,                       // moving bricks slide around this x
        rowDirection: row % 2 === 0 ? 1 : -1, // alternate rows slide opposite ways
      });
    }
  }
  return list;
}

// Put a new ball on top of the paddle, waiting to be launched.
function resetBall() {
  ball = { x: 0, y: 0, vx: 0, vy: 0, speed: ballStartSpeed, stuck: true };
  placeBallOnPaddle();
}

function placeBallOnPaddle() {
  ball.x = paddle.x + paddle.w / 2 - BALL_SIZE / 2;
  ball.y = paddle.y - BALL_SIZE;
}

function launchBall() {
  if (!ball.stuck) return;
  ball.stuck = false;
  // Launch upward at a random angle of 10-30 degrees, left or right.
  const angle = 10 + Math.random() * 20;
  setBallAngle(Math.random() < 0.5 ? -angle : angle);
}

// Point the ball in a direction. 0 = straight up, negative = left,
// positive = right. The ball's speed stays the same.
function setBallAngle(degrees) {
  const radians = (degrees * Math.PI) / 180;
  ball.vx = Math.sin(radians) * ball.speed;
  ball.vy = -Math.cos(radians) * ball.speed;
}

function loseLife() {
  lives--;
  if (lives <= 0) {
    changeState("gameover");
  } else {
    resetBall();
  }
}

function addScore(points) {
  score += points;
  if (score > bestScore) {
    bestScore = score;
    isNewBest = true;
    saveBestScore();
  }
}

// The ball hit a brick: take away one hit point, break it at zero.
function hitBrick(brick) {
  brick.hp--;
  brick.flash = BRICK_HIT_FLASH;
  if (brick.hp <= 0) destroyBrick(brick);
}

function destroyBrick(brick) {
  const index = bricks.indexOf(brick);
  if (index === -1) return; // already destroyed (e.g. by an explosion)
  bricks.splice(index, 1);
  addScore(brick.points);

  // Speed the ball up a little with every brick, up to a limit.
  ball.speed = Math.min(ballMaxSpeed, ball.speed + BALL_SPEEDUP_PER_BRICK);
  const currentSpeed = Math.hypot(ball.vx, ball.vy);
  if (currentSpeed > 0) {
    ball.vx *= ball.speed / currentSpeed;
    ball.vy *= ball.speed / currentSpeed;
  }

  if (brick.kind === "explosive") explode(brick);

  if (bricks.length === 0 && gameState === "playing") {
    changeState("levelcomplete");
  }
}

// Destroy every brick touching the 3x3 block of cells around `center`.
// If one of those is also explosive, it explodes too (a chain reaction).
function explode(center) {
  explosions.push({
    x: center.x - BRICK_CELL_WIDTH,
    y: center.y - BRICK_CELL_HEIGHT,
    w: center.w + BRICK_CELL_WIDTH * 2,
    h: center.h + BRICK_CELL_HEIGHT * 2,
    timeLeft: EXPLOSION_TIME,
  });

  const blastArea = {
    x: center.x - BRICK_CELL_WIDTH / 2,
    y: center.y - BRICK_CELL_HEIGHT / 2,
    w: center.w + BRICK_CELL_WIDTH,
    h: center.h + BRICK_CELL_HEIGHT,
  };
  const caught = bricks.filter((b) =>
    rectsOverlap(b.x, b.y, b.w, b.h, blastArea.x, blastArea.y, blastArea.w, blastArea.h)
  );
  for (const brick of caught) destroyBrick(brick);
}

// --- Best score (saved in the browser with localStorage) -------------
// localStorage can be blocked (e.g. some private windows), so every use
// is wrapped in try/catch: the game still works, it just won't remember.
function loadBestScore() {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch (error) {
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  } catch (error) {
    // Saving isn't possible here; ignore it.
  }
}

// --- Fullscreen (handy on desktop: press F) --------------------------
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } catch (error) {
    // Some browsers (or embedded pages) don't allow fullscreen.
  }
}

// ---------------------------------------------------------------------
// 6. UPDATE (movement and collisions)
// ---------------------------------------------------------------------

function update(dt) {
  screenTimer += dt;
  if (gameState !== "playing") return;

  levelTime += dt;
  updatePaddle(dt);
  updateBricks(dt);
  updateExplosions(dt);
  if (gameState !== "playing") return; // a moving brick may have ended the level

  if (ball.stuck) {
    placeBallOnPaddle(); // the waiting ball rides along with the paddle
    return;
  }

  // Move the ball in small steps of at most 1 pixel. Checking
  // collisions after every tiny step means the ball can never jump
  // through a brick or a wall, even if the frame rate drops.
  const distance = Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) * dt;
  const steps = Math.max(1, Math.ceil(distance));
  for (let i = 0; i < steps; i++) {
    moveBall(dt / steps);
    if (gameState !== "playing" || ball.stuck) break;
  }
}

function updatePaddle(dt) {
  let direction = 0;
  if (keys["ArrowLeft"] || keys["KeyA"]) direction -= 1;
  if (keys["ArrowRight"] || keys["KeyD"]) direction += 1;
  paddle.x += direction * PADDLE_KEY_SPEED * dt;
  clampPaddle();
}

// Center the paddle on a position (used by mouse and touch).
function movePaddleTo(x) {
  paddle.x = x - paddle.w / 2;
  clampPaddle();
}

function clampPaddle() {
  paddle.x = Math.max(0, Math.min(GAME_WIDTH - paddle.w, paddle.x));
}

function updateBricks(dt) {
  // How far moving bricks are from their starting spot right now.
  // This "zig-zag" goes smoothly from 0 to +RANGE, back to -RANGE and
  // back to 0, over and over: a simple, predictable back-and-forth path.
  const R = MOVING_BRICK_RANGE;
  const travelled = (levelTime * MOVING_BRICK_SPEED) % (4 * R);
  let offset;
  if (travelled < R) offset = travelled;                // 0 -> +R
  else if (travelled < 3 * R) offset = 2 * R - travelled; // +R -> -R
  else offset = travelled - 4 * R;                      // -R -> 0
  const movingRight = travelled < R || travelled >= 3 * R;

  for (const brick of [...bricks]) {
    if (brick.flash > 0) brick.flash -= dt;
    if (brick.kind !== "moving") continue;

    brick.x = brick.startX + offset * brick.rowDirection;

    // If the brick slid into the ball, push the ball out of the way
    // (in the direction the brick is moving) and count it as a hit.
    if (!ball.stuck &&
        rectsOverlap(ball.x, ball.y, BALL_SIZE, BALL_SIZE, brick.x, brick.y, brick.w, brick.h)) {
      const pushRight = movingRight === (brick.rowDirection === 1);
      if (pushRight) {
        ball.x = brick.x + brick.w;
        ball.vx = Math.abs(ball.vx);
      } else {
        ball.x = brick.x - BALL_SIZE;
        ball.vx = -Math.abs(ball.vx);
      }
      hitBrick(brick);
      if (gameState !== "playing") return;
    }
  }
}

function updateExplosions(dt) {
  for (const explosion of explosions) explosion.timeLeft -= dt;
  explosions = explosions.filter((explosion) => explosion.timeLeft > 0);
}

// Move the ball one small step. We move horizontally first and check
// for hits, then vertically and check again. Doing the two directions
// separately tells us exactly which side of a brick was hit, so we know
// whether to flip the horizontal or the vertical speed.
function moveBall(dt) {
  // --- Horizontal movement ---
  ball.x += ball.vx * dt;

  if (ball.x < 0) {                                  // left wall
    ball.x = 0;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + BALL_SIZE > GAME_WIDTH) {      // right wall
    ball.x = GAME_WIDTH - BALL_SIZE;
    ball.vx = -Math.abs(ball.vx);
  }

  let brick = findBrickTouchingBall();
  if (brick) {
    // Push the ball back outside the brick, then bounce.
    if (ball.vx > 0) ball.x = brick.x - BALL_SIZE;
    else ball.x = brick.x + brick.w;
    ball.vx = -ball.vx;
    hitBrick(brick);
    if (gameState !== "playing") return;
  }

  // --- Vertical movement ---
  ball.y += ball.vy * dt;

  if (ball.y < HUD_HEIGHT) {                         // ceiling
    ball.y = HUD_HEIGHT;
    ball.vy = Math.abs(ball.vy);
  }

  brick = findBrickTouchingBall();
  if (brick) {
    if (ball.vy > 0) ball.y = brick.y - BALL_SIZE;
    else ball.y = brick.y + brick.h;
    ball.vy = -ball.vy;
    hitBrick(brick);
    if (gameState !== "playing") return;
  }

  // Paddle: only bounce if the ball is moving down and hits the top
  // half of the paddle (a ball that is already below it is lost).
  const ballCenterY = ball.y + BALL_SIZE / 2;
  if (
    ball.vy > 0 &&
    rectsOverlap(ball.x, ball.y, BALL_SIZE, BALL_SIZE,
                 paddle.x, paddle.y, paddle.w, paddle.h) &&
    ballCenterY < paddle.y + paddle.h / 2
  ) {
    bounceOffPaddle();
  }

  // Fell off the bottom of the screen.
  if (ball.y > GAME_HEIGHT) {
    loseLife();
  }
}

function bounceOffPaddle() {
  // -1 = hit the far left edge, 0 = center, 1 = far right edge
  const ballCenterX = ball.x + BALL_SIZE / 2;
  const paddleCenterX = paddle.x + paddle.w / 2;
  let hitPosition = (ballCenterX - paddleCenterX) / (paddle.w / 2);
  hitPosition = Math.max(-1, Math.min(1, hitPosition));

  let angle = hitPosition * MAX_BOUNCE_ANGLE;

  // Never send the ball perfectly straight up: it could bounce up and
  // down forever without the player being able to aim it.
  if (Math.abs(angle) < MIN_BOUNCE_ANGLE) {
    if (angle === 0) angle = Math.random() < 0.5 ? -1 : 1;
    angle = Math.sign(angle) * MIN_BOUNCE_ANGLE;
  }

  setBallAngle(angle);
  ball.y = paddle.y - BALL_SIZE; // sit exactly on top of the paddle
}

function findBrickTouchingBall() {
  for (const brick of bricks) {
    if (rectsOverlap(ball.x, ball.y, BALL_SIZE, BALL_SIZE,
                     brick.x, brick.y, brick.w, brick.h)) {
      return brick;
    }
  }
  return null;
}

// True if two rectangles overlap. Every collision in the game uses this.
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ---------------------------------------------------------------------
// 7. DRAWING
// ---------------------------------------------------------------------

function draw() {
  ctx.drawImage(backgroundCanvas, 0, 0);

  if (gameState === "title") {
    drawTitleScreen();
  } else {
    drawBricks();
    drawExplosions();
    drawPaddle();
    if (gameState === "playing" || gameState === "paused") drawBall();
    drawHud();

    if (gameState === "playing" && ball.stuck) {
      if (levelTime < 2.5) {
        drawText("LEVEL " + level, GAME_WIDTH / 2, 110, COLORS.cyan.base, 2, "center",
                 COLORS.cyan.dark);
      }
      if (blink(0.5)) {
        drawText("TAP, CLICK OR SPACE TO LAUNCH", GAME_WIDTH / 2, 130,
                 COLORS.white, 1, "center");
      }
    }
    if (gameState === "paused") drawPauseScreen();
    if (gameState === "levelcomplete") drawLevelCompleteScreen();
    if (gameState === "gameover") drawGameOverScreen();
  }

  drawButtons();
}

// Every rectangle is drawn at whole-pixel positions so the art stays crisp.
function fillPixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawSprite(sprite, x, y, colorMap) {
  x = Math.round(x);
  y = Math.round(y);
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const color = colorMap[sprite[row][col]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col, y + row, 1, 1);
    }
  }
}

// The basic brick: base color, light top/left edge, dark bottom/right
// edge. This gives a chunky "bevelled" pixel look.
function drawBrickShape(x, y, w, h, colors) {
  fillPixelRect(x, y, w, h, colors.base);
  fillPixelRect(x, y, w, 1, colors.light);           // top edge
  fillPixelRect(x, y, 1, h, colors.light);           // left edge
  fillPixelRect(x, y + h - 1, w, 1, colors.dark);    // bottom edge
  fillPixelRect(x + w - 1, y, 1, h, colors.dark);    // right edge
}

function drawShine(x, y, colors) {
  fillPixelRect(x + 2, y + 2, 3, 1, colors.light);
  fillPixelRect(x + 2, y + 3, 1, 1, colors.light);
}

function drawBricks() {
  for (const brick of bricks) {
    const x = Math.round(brick.x);
    const y = Math.round(brick.y);
    const { w, h, colors } = brick;

    // A brick that was just hit flashes white for a moment.
    if (brick.flash > 0) {
      fillPixelRect(x, y, w, h, COLORS.white);
      continue;
    }

    if (brick.kind === "normal") {
      drawBrickShape(x, y, w, h, colors);
      drawShine(x, y, colors);
    } else if (brick.kind === "armored") {
      drawArmoredBrick(brick, x, y);
    } else if (brick.kind === "explosive") {
      drawExplosiveBrick(x, y, w, h, colors);
    } else if (brick.kind === "moving") {
      drawMovingBrick(x, y, w, h, colors);
    }
  }
}

// Armored: metal plate with rivets in the corners. Heavy armor (3 hits)
// also has a raised center plate. Cracks appear as it takes damage.
function drawArmoredBrick(brick, x, y) {
  const { w, h, colors } = brick;
  drawBrickShape(x, y, w, h, colors);
  // Rivets
  fillPixelRect(x + 2, y + 2, 1, 1, colors.light);
  fillPixelRect(x + w - 3, y + 2, 1, 1, colors.light);
  fillPixelRect(x + 2, y + h - 3, 1, 1, colors.light);
  fillPixelRect(x + w - 3, y + h - 3, 1, 1, colors.light);
  if (brick.maxHp >= 3) {
    fillPixelRect(x + 5, y + 2, w - 10, h - 4, colors.light);
    fillPixelRect(x + 6, y + 3, w - 12, h - 6, colors.base);
  }
  const damage = brick.maxHp - brick.hp;
  if (damage >= 1) { // first crack
    fillPixelRect(x + 7, y + 1, 1, 2, colors.dark);
    fillPixelRect(x + 8, y + 3, 1, 2, colors.dark);
    fillPixelRect(x + 7, y + 5, 1, 1, colors.dark);
  }
  if (damage >= 2) { // second crack
    fillPixelRect(x + 13, y + 1, 1, 1, colors.dark);
    fillPixelRect(x + 12, y + 2, 1, 2, colors.dark);
    fillPixelRect(x + 13, y + 4, 1, 2, colors.dark);
  }
}

// Explosive: hazard stripes with a blinking core.
function drawExplosiveBrick(x, y, w, h, colors) {
  drawBrickShape(x, y, w, h, colors);
  ctx.fillStyle = colors.dark;
  for (let py = 1; py < h - 1; py++) {
    for (let px = 1; px < w - 1; px++) {
      if ((px + py) % 6 < 2) ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
  const core = blink(0.25) ? colors.light : COLORS.white;
  fillPixelRect(x + Math.floor(w / 2) - 2, y + 2, 4, h - 4, colors.dark);
  fillPixelRect(x + Math.floor(w / 2) - 1, y + 2, 2, h - 4, core);
}

// Moving: arrows on both ends show it slides sideways.
function drawMovingBrick(x, y, w, h, colors) {
  drawBrickShape(x, y, w, h, colors);
  // "<" on the left
  fillPixelRect(x + 4, y + 2, 1, 1, colors.dark);
  fillPixelRect(x + 3, y + 3, 1, 1, colors.dark);
  fillPixelRect(x + 4, y + 4, 1, 1, colors.dark);
  // ">" on the right
  fillPixelRect(x + w - 5, y + 2, 1, 1, colors.dark);
  fillPixelRect(x + w - 4, y + 3, 1, 1, colors.dark);
  fillPixelRect(x + w - 5, y + 4, 1, 1, colors.dark);
}

// An explosion is a hollow square that flickers yellow/orange.
function drawExplosions() {
  for (const e of explosions) {
    const color = blink(0.05) ? COLORS.yellow.base : COLORS.orange.base;
    // Shrink the square inward as the explosion fades.
    const inset = Math.floor((1 - e.timeLeft / EXPLOSION_TIME) * 4);
    const x = e.x + inset, y = e.y + inset;
    const w = e.w - inset * 2, h = e.h - inset * 2;
    fillPixelRect(x, y, w, 1, color);
    fillPixelRect(x, y + h - 1, w, 1, color);
    fillPixelRect(x, y, 1, h, color);
    fillPixelRect(x + w - 1, y, 1, h, color);
  }
}

function drawPaddle() {
  const { x, y, w, h } = paddle;
  fillPixelRect(x, y, w, h, COLORS.cyan.base);
  fillPixelRect(x, y, w, 1, COLORS.cyan.light);         // top highlight
  fillPixelRect(x, y + h - 1, w, 1, COLORS.cyan.dark);  // bottom shadow
  // Purple end caps
  fillPixelRect(x, y + 1, 2, h - 2, COLORS.purple.base);
  fillPixelRect(x + w - 2, y + 1, 2, h - 2, COLORS.purple.base);
  // Center marker helps the player aim
  fillPixelRect(x + w / 2 - 1, y + 2, 2, 1, COLORS.white);
}

function drawBall() {
  drawSprite(BALL_SPRITE, ball.x, ball.y, BALL_COLORS);
}

function drawHud() {
  fillPixelRect(0, 0, GAME_WIDTH, HUD_HEIGHT, COLORS.hud);
  fillPixelRect(0, HUD_HEIGHT - 1, GAME_WIDTH, 1, COLORS.hudLine);

  drawText("SCORE", 4, 4, COLORS.dim);
  drawText(String(score).padStart(6, "0"), 28, 4, COLORS.white);
  drawText("BEST", 60, 4, COLORS.dim);
  drawText(String(bestScore).padStart(6, "0"), 80, 4, COLORS.yellow.base);

  drawText("LEVEL " + level, GAME_WIDTH / 2 + 10, 4, COLORS.cyan.base, 1, "center");

  // Hearts are drawn right-to-left, ending just before the pause button.
  const heartsLeft = 302 - lives * 7;
  drawText("LIVES", heartsLeft - 22, 4, COLORS.dim);
  for (let i = 0; i < lives; i++) {
    drawSprite(HEART_SPRITE, heartsLeft + i * 7 + 2, 4, HEART_COLORS);
  }

  // Pause button: two bars "||"
  const p = PAUSE_ICON;
  fillPixelRect(p.x, p.y, p.w, p.h, COLORS.hudLine);
  fillPixelRect(p.x + 3, p.y + 2, 1, p.h - 4, COLORS.white);
  fillPixelRect(p.x + 6, p.y + 2, 1, p.h - 4, COLORS.white);
}

function drawTitleScreen() {
  drawText("NEON", GAME_WIDTH / 2, 18, COLORS.magenta.base, 4, "center",
           COLORS.magenta.dark);
  drawText("BREAKER", GAME_WIDTH / 2, 42, COLORS.cyan.base, 4, "center",
           COLORS.cyan.dark);

  // A decorative row of bricks in every color
  const colorList = [COLORS.magenta, COLORS.purple, COLORS.cyan,
                     COLORS.green, COLORS.orange];
  for (let i = 0; i < 10; i++) {
    const colors = colorList[i % colorList.length];
    drawBrickShape(60 + i * 20, 72, 19, 7, colors);
    drawShine(60 + i * 20, 72, colors);
  }

  drawText("MOUSE, A/D OR ARROWS TO MOVE", GAME_WIDTH / 2, 88, COLORS.dim, 1, "center");
  drawText("CLICK, TAP OR SPACE TO LAUNCH", GAME_WIDTH / 2, 96, COLORS.dim, 1, "center");
  drawText("ESC OR P TO PAUSE  -  F FOR FULLSCREEN", GAME_WIDTH / 2, 104, COLORS.dim, 1, "center");

  if (bestScore > 0) {
    drawText("BEST " + bestScore, GAME_WIDTH / 2, 145, COLORS.yellow.base, 1, "center");
  }
  if (blink(0.6)) {
    drawText("PRESS SPACE", GAME_WIDTH / 2, 160, COLORS.white, 1, "center");
  }
}

// Darken the frozen game behind a menu.
function dimGameArea() {
  ctx.fillStyle = "rgba(5, 5, 20, 0.8)";
  ctx.fillRect(0, HUD_HEIGHT, GAME_WIDTH, GAME_HEIGHT - HUD_HEIGHT);
}

function drawPauseScreen() {
  dimGameArea();
  drawText("PAUSED", GAME_WIDTH / 2, 40, COLORS.purple.base, 3, "center",
           COLORS.purple.dark);
  drawText("ESC OR P TO RESUME", GAME_WIDTH / 2, 150, COLORS.dim, 1, "center");
}

function drawLevelCompleteScreen() {
  dimGameArea();
  drawText("LEVEL " + level, GAME_WIDTH / 2, 34, COLORS.green.base, 3, "center",
           COLORS.green.dark);
  drawText("COMPLETE!", GAME_WIDTH / 2, 56, COLORS.green.base, 3, "center",
           COLORS.green.dark);
  drawText("SCORE " + score, GAME_WIDTH / 2, 84, COLORS.white, 1, "center");
  drawText("NEXT UP: LEVEL " + (level + 1) + "  -  FASTER BALL!", GAME_WIDTH / 2, 94,
           COLORS.dim, 1, "center");
  if (screenTimer > SCREEN_INPUT_DELAY && blink(0.6)) {
    drawText("OR PRESS SPACE", GAME_WIDTH / 2, 150, COLORS.dim, 1, "center");
  }
}

function drawGameOverScreen() {
  dimGameArea();
  drawText("GAME OVER", GAME_WIDTH / 2, 36, COLORS.magenta.base, 3, "center",
           COLORS.magenta.dark);
  drawText("FINAL SCORE", GAME_WIDTH / 2, 64, COLORS.dim, 1, "center");
  drawText(String(score), GAME_WIDTH / 2, 74, COLORS.white, 2, "center", COLORS.shadow);
  if (isNewBest) {
    if (blink(0.3)) {
      drawText("NEW BEST SCORE!", GAME_WIDTH / 2, 92, COLORS.yellow.base, 1, "center");
    }
  } else {
    drawText("BEST " + bestScore, GAME_WIDTH / 2, 92, COLORS.yellow.base, 1, "center");
  }
  if (screenTimer > SCREEN_INPUT_DELAY && blink(0.6)) {
    drawText("OR PRESS SPACE", GAME_WIDTH / 2, 150, COLORS.dim, 1, "center");
  }
}

// --- Buttons ---------------------------------------------------------
// Buttons are drawn on the canvas, so they are pixel art too. Each
// screen lists its buttons here; the same list is used for drawing
// and for detecting clicks/taps.
function getButtons() {
  if (gameState === "title") {
    return [{ label: "PLAY", x: 128, y: 120, w: 64, h: 18, action: startGame }];
  }
  if (gameState === "paused") {
    return [
      { label: "RESUME", x: 100, y: 76, w: 120, h: 18, action: resumeGame },
      { label: "RESTART", x: 100, y: 100, w: 120, h: 18, action: startGame },
    ];
  }
  if (gameState === "levelcomplete") {
    return [{ label: "CONTINUE", x: 100, y: 112, w: 120, h: 18, action: nextLevel }];
  }
  if (gameState === "gameover") {
    return [{ label: "PLAY AGAIN", x: 100, y: 112, w: 120, h: 18, action: startGame }];
  }
  return [];
}

function drawButtons() {
  for (const button of getButtons()) {
    const hovered = isInside(pointer, button);
    const { x, y, w, h } = button;
    // Outer frame with cut corners for a chunky arcade look
    fillPixelRect(x + 1, y, w - 2, h, COLORS.cyan.base);
    fillPixelRect(x, y + 1, w, h - 2, COLORS.cyan.base);
    if (!hovered) {
      fillPixelRect(x + 2, y + 2, w - 4, h - 4, COLORS.hud);
    }
    fillPixelRect(x + 2, y + h - 2, w - 4, 1, COLORS.cyan.dark); // bottom shade
    drawText(button.label, x + w / 2, y + (h - 10) / 2, hovered ? COLORS.hud : COLORS.white,
             2, "center");
  }
}

function isInside(point, rect) {
  return point.x >= rect.x && point.x < rect.x + rect.w &&
         point.y >= rect.y && point.y < rect.y + rect.h;
}

// --- Pixel font ------------------------------------------------------
// Draws text using the FONT table. scale 2 = each font pixel is 2x2.
// align can be "left", "center" or "right". An optional shadow color
// draws a hard offset shadow behind the text.
function drawText(text, x, y, color, scale = 1, align = "left", shadowColor = null) {
  text = String(text).toUpperCase();
  const width = textWidth(text, scale);
  if (align === "center") x -= width / 2;
  if (align === "right") x -= width;
  x = Math.round(x);
  y = Math.round(y);

  if (shadowColor) {
    const offset = Math.max(1, Math.floor(scale / 2));
    drawTextPixels(text, x + offset, y + offset, shadowColor, scale);
  }
  drawTextPixels(text, x, y, color, scale);
}

function drawTextPixels(text, x, y, color, scale) {
  ctx.fillStyle = color;
  for (let i = 0; i < text.length; i++) {
    const glyph = FONT[text[i]] || FONT["?"];
    for (let p = 0; p < 15; p++) {
      if (glyph[p] !== "1") continue;
      const col = p % 3;
      const row = Math.floor(p / 3);
      ctx.fillRect(x + (i * 4 + col) * scale, y + row * scale, scale, scale);
    }
  }
}

// Each character is 3 pixels wide plus 1 pixel of space.
function textWidth(text, scale = 1) {
  return (text.length * 4 - 1) * scale;
}

// Returns true/false alternating every `seconds` (for blinking text).
function blink(seconds) {
  return Math.floor(performance.now() / 1000 / seconds) % 2 === 0;
}

// ---------------------------------------------------------------------
// 8. INPUT
// ---------------------------------------------------------------------

// Menus ignore input for a moment after they appear, so a click or key
// press meant for the game doesn't accidentally press a button.
// The pause menu reacts quickly so resuming feels instant.
function menuAcceptsInput() {
  const delay = gameState === "paused" ? 0.15 : SCREEN_INPUT_DELAY;
  return screenTimer >= delay;
}

// Convert a mouse/touch position on the page into game pixels.
function toGamePosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * GAME_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * GAME_HEIGHT,
  };
}

// "Pointer" events cover mouse, finger and pen all at once.
// They are attached to the whole window, so moving the mouse in the
// black border around the game still moves the paddle.
window.addEventListener("pointermove", (event) => {
  const pos = toGamePosition(event);
  pointer.x = pos.x;
  pointer.y = pos.y;
  if (gameState === "playing") movePaddleTo(pos.x);
});

window.addEventListener("pointerdown", (event) => {
  event.preventDefault(); // stop touch from scrolling/zooming the page
  const pos = toGamePosition(event);
  pointer.x = pos.x;
  pointer.y = pos.y;

  if (gameState === "playing") {
    if (isInside(pos, PAUSE_TAP_AREA)) {
      pauseGame();
      return;
    }
    movePaddleTo(pos.x);
    launchBall();
    return;
  }

  if (!menuAcceptsInput()) return;
  for (const button of getButtons()) {
    if (isInside(pos, button)) {
      button.action();
      return;
    }
  }
});

// On touch screens the finger "leaves" when lifted; forget its
// position so buttons don't stay highlighted.
window.addEventListener("pointerup", (event) => {
  if (event.pointerType !== "mouse") {
    pointer.x = -100;
    pointer.y = -100;
  }
});

window.addEventListener("keydown", (event) => {
  // Stop arrow keys and space from scrolling the page.
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  keys[event.code] = true;
  if (event.repeat) return; // ignore auto-repeat from holding a key

  if (event.code === "KeyF") {
    toggleFullscreen();
    return;
  }

  if (event.code === "Escape" || event.code === "KeyP") {
    if (gameState === "playing") pauseGame();
    else if (gameState === "paused") resumeGame();
    return;
  }

  if (event.code === "Space" || event.code === "Enter") {
    if (gameState === "playing") {
      launchBall();
    } else if (!menuAcceptsInput()) {
      // too soon after the screen appeared; ignore
    } else if (gameState === "paused") {
      resumeGame();
    } else if (gameState === "levelcomplete") {
      nextLevel();
    } else {
      startGame(); // title or game over
    }
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

// If the player switches tabs or windows, pause the game and release
// all keys so the paddle doesn't keep sliding on its own.
window.addEventListener("blur", () => {
  for (const code in keys) keys[code] = false;
  pauseGame();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});

// ---------------------------------------------------------------------
// 9. MAIN LOOP
// ---------------------------------------------------------------------

let lastTime = performance.now();

function frame(now) {
  // dt = "delta time": seconds since the last frame. Multiplying speeds
  // by dt makes the game run at the same speed on 60Hz and 144Hz
  // screens. It is capped so a lag spike (or switching tabs) can't
  // make things jump a huge distance in one frame.
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  update(dt);
  draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
