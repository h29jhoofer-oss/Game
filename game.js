// =====================================================================
//  NEON BREAKER  -  Stage 1: core prototype
//
//  The file is organised top to bottom:
//    1. Settings        - numbers you can tweak to change the game
//    2. Colors & art    - palette, brick layout, pixel font, sprites
//    3. Canvas setup    - low-res canvas + scaling to fit the window
//    4. Game state      - every variable that changes while playing
//    5. Game actions    - start game, launch ball, lose life, ...
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
const BALL_START_SPEED = 110;     // pixels per second
const BALL_MAX_SPEED = 170;
const BALL_SPEEDUP_PER_BRICK = 1.5;

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

const START_LIVES = 3;
const SCREEN_INPUT_DELAY = 0.6;   // seconds before menus accept input

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
};

// Each letter in the layout below means one kind of brick.
const BRICK_TYPES = {
  M: { colors: COLORS.magenta, points: 50 },
  P: { colors: COLORS.purple,  points: 40 },
  C: { colors: COLORS.cyan,    points: 30 },
  G: { colors: COLORS.green,   points: 20 },
  O: { colors: COLORS.orange,  points: 10 },
};

// The level layout: one string per row, one character per column.
// A dot "." means "no brick here". Each row must be 14 characters.
const LEVEL_LAYOUT = [
  "..MMMMMMMMMM..",
  ".PPPPPPPPPPPP.",
  "CCCCCCCCCCCCCC",
  "GGGGGG..GGGGGG",
  "OOOOOOOOOOOOOO",
  ".OOOO....OOOO.",
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

// Which screen we are on: "title", "playing", "gameover" or "cleared".
let gameState = "title";
let screenTimer = 0;     // seconds spent on the current screen
let score = 0;
let lives = START_LIVES;
let bricks = [];
let paddle = null;
let ball = null;

const keys = {};                    // which keys are held down right now
const pointer = { x: -100, y: -100 }; // mouse/finger position in game pixels

// ---------------------------------------------------------------------
// 5. GAME ACTIONS
// ---------------------------------------------------------------------

// Begin a completely fresh run. Everything is recreated from scratch,
// so nothing from the previous game can leak into the new one.
function startGame() {
  score = 0;
  lives = START_LIVES;
  bricks = buildBricks(LEVEL_LAYOUT);
  paddle = {
    x: (GAME_WIDTH - PADDLE_WIDTH) / 2,
    y: PADDLE_Y,
    w: PADDLE_WIDTH,
    h: PADDLE_HEIGHT,
  };
  resetBall();
  changeState("playing");
}

function changeState(newState) {
  gameState = newState;
  screenTimer = 0;
  // Hide the mouse cursor during play (the paddle replaces it).
  canvas.style.cursor = newState === "playing" ? "none" : "default";
}

// Turn the text layout into a list of brick objects.
function buildBricks(layout) {
  const list = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < BRICK_COLUMNS; col++) {
      const type = BRICK_TYPES[layout[row][col]];
      if (!type) continue; // "." or unknown letter = empty cell
      list.push({
        x: BRICK_LEFT + col * BRICK_CELL_WIDTH,
        y: BRICK_TOP + row * BRICK_CELL_HEIGHT,
        w: BRICK_CELL_WIDTH - BRICK_GAP,
        h: BRICK_CELL_HEIGHT - BRICK_GAP,
        colors: type.colors,
        points: type.points,
      });
    }
  }
  return list;
}

// Put a new ball on top of the paddle, waiting to be launched.
function resetBall() {
  ball = { x: 0, y: 0, vx: 0, vy: 0, speed: BALL_START_SPEED, stuck: true };
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

function destroyBrick(brick) {
  bricks.splice(bricks.indexOf(brick), 1);
  score += brick.points;

  // Speed the ball up a little with every brick, up to a limit.
  ball.speed = Math.min(BALL_MAX_SPEED, ball.speed + BALL_SPEEDUP_PER_BRICK);
  const currentSpeed = Math.hypot(ball.vx, ball.vy);
  ball.vx *= ball.speed / currentSpeed;
  ball.vy *= ball.speed / currentSpeed;

  if (bricks.length === 0) {
    changeState("cleared");
  }
}

// ---------------------------------------------------------------------
// 6. UPDATE (movement and collisions)
// ---------------------------------------------------------------------

function update(dt) {
  screenTimer += dt;
  if (gameState !== "playing") return;

  updatePaddle(dt);

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
    destroyBrick(brick);
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
    destroyBrick(brick);
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
    drawPaddle();
    if (gameState === "playing") drawBall();
    drawHud();

    if (gameState === "playing" && ball.stuck && blink(0.5)) {
      drawText("TAP, CLICK OR SPACE TO LAUNCH", GAME_WIDTH / 2, 130,
               COLORS.white, 1, "center");
    }
    if (gameState === "gameover") drawEndScreen("GAME OVER", COLORS.magenta);
    if (gameState === "cleared") drawEndScreen("BOARD CLEARED!", COLORS.green);
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

// A brick: base color, light top/left edge, dark bottom/right edge,
// and a little shine mark. This gives a chunky "bevelled" pixel look.
function drawBrickShape(x, y, w, h, colors) {
  fillPixelRect(x, y, w, h, colors.base);
  fillPixelRect(x, y, w, 1, colors.light);           // top edge
  fillPixelRect(x, y, 1, h, colors.light);           // left edge
  fillPixelRect(x, y + h - 1, w, 1, colors.dark);    // bottom edge
  fillPixelRect(x + w - 1, y, 1, h, colors.dark);    // right edge
  fillPixelRect(x + 2, y + 2, 3, 1, colors.light);   // shine
  fillPixelRect(x + 2, y + 3, 1, 1, colors.light);
}

function drawBricks() {
  for (const brick of bricks) {
    drawBrickShape(brick.x, brick.y, brick.w, brick.h, brick.colors);
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

  drawText("LEVEL 1", GAME_WIDTH / 2, 4, COLORS.cyan.base, 1, "center");

  drawText("LIVES", GAME_WIDTH - 52, 4, COLORS.dim);
  for (let i = 0; i < lives; i++) {
    drawSprite(HEART_SPRITE, GAME_WIDTH - 30 + i * 7, 4, HEART_COLORS);
  }
}

function drawTitleScreen() {
  drawText("NEON", GAME_WIDTH / 2, 22, COLORS.magenta.base, 4, "center",
           COLORS.magenta.dark);
  drawText("BREAKER", GAME_WIDTH / 2, 46, COLORS.cyan.base, 4, "center",
           COLORS.cyan.dark);

  // A decorative row of bricks in every color
  const colorList = [COLORS.magenta, COLORS.purple, COLORS.cyan,
                     COLORS.green, COLORS.orange];
  for (let i = 0; i < 10; i++) {
    drawBrickShape(60 + i * 20, 76, 19, 7, colorList[i % colorList.length]);
  }

  drawText("MOUSE, A/D OR ARROWS TO MOVE", GAME_WIDTH / 2, 94, COLORS.dim, 1, "center");
  drawText("CLICK, TAP OR SPACE TO LAUNCH", GAME_WIDTH / 2, 102, COLORS.dim, 1, "center");
  drawText("BREAK EVERY BRICK!", GAME_WIDTH / 2, 110, COLORS.white, 1, "center");

  if (blink(0.6)) {
    drawText("PRESS SPACE", GAME_WIDTH / 2, 160, COLORS.dim, 1, "center");
  }
}

function drawEndScreen(title, colors) {
  // Darken the frozen game behind the message
  ctx.fillStyle = "rgba(5, 5, 20, 0.8)";
  ctx.fillRect(0, HUD_HEIGHT, GAME_WIDTH, GAME_HEIGHT - HUD_HEIGHT);

  drawText(title, GAME_WIDTH / 2, 44, colors.base, 3, "center", colors.dark);
  drawText("FINAL SCORE", GAME_WIDTH / 2, 72, COLORS.dim, 1, "center");
  drawText(String(score), GAME_WIDTH / 2, 82, COLORS.white, 2, "center",
           COLORS.shadow);
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
    return [{ label: "PLAY", x: 128, y: 124, w: 64, h: 18, action: startGame }];
  }
  if (gameState === "gameover" || gameState === "cleared") {
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
    movePaddleTo(pos.x);
    launchBall();
    return;
  }

  if (screenTimer < SCREEN_INPUT_DELAY) return; // avoid accidental clicks
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

  if (event.code === "Space" || event.code === "Enter") {
    if (gameState === "playing") {
      launchBall();
    } else if (screenTimer >= SCREEN_INPUT_DELAY) {
      startGame();
    }
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

// If the window loses focus, release all keys so the paddle
// doesn't keep sliding on its own.
window.addEventListener("blur", () => {
  for (const code in keys) keys[code] = false;
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
