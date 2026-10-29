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

// Health and getting hit.
const HEALTH_CONFIG = {
  maxHealth: 3,
  invulnerableTime: 1.0, // seconds of safety after taking a hit
  hitFlashTime: 0.1, // seconds the player flashes white when hit
  hitRadius: 3, // the player's hitbox is smaller than the sprite to feel fair
};

// Chaser enemy: a small red slime that walks straight at the player.
const CHASER_CONFIG = {
  health: 2, // two basic shots to defeat
  radius: 3, // hitbox size
  baseSpeed: 28, // pixels per second at the start of a run
  maxExtraSpeed: 22, // speed added gradually as time goes on
  speedRampTime: 150, // seconds until the full extra speed is reached
  knockback: 70, // how hard an enemy bounces off after hitting you
};

// How enemies appear over time.
const SPAWN_CONFIG = {
  startInterval: 1.3, // seconds between spawns at the start
  minInterval: 0.45, // fastest spawn rate allowed
  intervalDropPerSecond: 0.008, // how much faster spawning gets each second
  warningTime: 0.7, // a flashing marker shows where an enemy is about to appear
  minDistanceFromPlayer: 70, // never spawn right on top of the player
  edgeMargin: 24, // how far from the walls enemies may appear
  maxEnemies: 40, // performance + fairness limit
  groupChanceMax: 0.45, // highest chance that a spawn is a small group
  groupChanceRampTime: 90, // seconds until groups reach that chance
  groupSpread: 10, // how far apart group members appear
};

// The player's automatic blaster. Stage 4 upgrades will change these.
const WEAPON_CONFIG = {
  fireInterval: 0.6, // seconds between shots
  range: 95, // only shoot at enemies closer than this
  damage: 1,
  projectileSpeed: 190, // pixels per second
  projectileLifetime: 1.2, // seconds before a missed shot fizzles out
  pierce: 0, // how many extra enemies one shot can pass through
  hitKnockback: 45, // how far a shot pushes an enemy back
};

// Energy orbs dropped by defeated enemies.
const ORB_CONFIG = {
  magnetRadius: 22, // orbs closer than this fly toward the player
  collectRadius: 5, // orbs closer than this are collected
  magnetSpeed: 160, // top speed while flying toward the player
  lifetime: 18, // seconds before an uncollected orb disappears
  maxOrbs: 120,
};

// Limits that protect performance.
const MAX_PROJECTILES = 120;
const MAX_PARTICLES = 400;
