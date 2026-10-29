// =====================================================================
// config.js — all the numbers and colors that control the game.
// Tweak values here to change how the game looks and feels.
// =====================================================================

// The game is drawn at this tiny resolution, then scaled up.
const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 180;

// Size of one floor tile in pixels.
const TILE_SIZE = 8;

// The playable rectangle inside the screen (in internal pixels).
// 38 x 19 tiles of 8 pixels each.
const ARENA = {
  x: 8,
  y: 16,
  width: 38 * TILE_SIZE, // 304
  height: 19 * TILE_SIZE, // 152
};

// The limited color palette. Every color in the game comes from here,
// which keeps the art looking consistent and retro.
const PALETTE = {
  // Darks
  black: '#05060f',
  void: '#0a0e24',
  navy: '#0b1230',
  navyAlt: '#0c1434',
  gridLine: '#121c45',
  speck: '#17235a',
  wallDark: '#1b2a6b',

  // Blues / cyan (player colors)
  darkBlue: '#123a8a',
  blue: '#1b6fd1',
  cyanDim: '#1f9bbf',
  cyan: '#2ee6ff',
  white: '#eaffff',

  // Accent colors (used sparingly)
  pink: '#ff3df2',
  yellow: '#ffe83d',
  red: '#ff3b4f',
  orange: '#ff8a1f',
  purple: '#a23dff',
};

// Player tuning.
const PLAYER_CONFIG = {
  speed: 80, // pixels per second
  acceleration: 22, // how quickly the player reaches full speed (higher = snappier)
  dashSpeed: 240, // pixels per second while dashing
  dashDuration: 0.14, // seconds
  dashCooldown: 0.9, // seconds before you can dash again
  walkFrameTime: 0.1, // seconds per walking animation frame
  idleFrameTime: 0.5, // seconds per idle animation frame
};

// Longest time step we allow in one update (in seconds).
// If the tab freezes for a second, we don't want the player to teleport.
const MAX_DELTA = 0.05;
