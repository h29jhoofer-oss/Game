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
  green: '#39ff6a', // toxic neon green
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
  startHealth: 3, // hearts at the start of a run
  maxHealth: 5, // heart pickups can fill you up to this many
  invulnerableTime: 1.0, // seconds of safety after taking a hit
  hitFlashTime: 0.1, // seconds the player flashes white when hit
  hitRadius: 3, // the player's hitbox is smaller than the sprite to feel fair
};

// Chaser enemy: a small red slime that walks straight at the player.
const CHASER_CONFIG = {
  health: 2, // two basic shots to defeat
  score: 25, // points for defeating one
  radius: 3, // hitbox size
  baseSpeed: 28, // pixels per second at the start of a run
  maxExtraSpeed: 22, // speed added gradually as time goes on
  speedRampTime: 150, // seconds until the full extra speed is reached
  knockback: 70, // how hard an enemy bounces off after hitting you
};

// How enemies appear over time.
const SPAWN_CONFIG = {
  startInterval: 1.3, // seconds between spawns at the start
  minInterval: 0.35, // fastest spawn rate allowed
  intervalDropPerSecond: 0.007, // how much faster spawning gets each second
  warningTime: 0.7, // a flashing marker shows where an enemy is about to appear
  minDistanceFromPlayer: 70, // never spawn right on top of the player
  edgeMargin: 24, // how far from the walls enemies may appear
  maxEnemies: 50, // performance + fairness limit
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
  projectileCount: 1, // bolts fired per shot, fanned out (Multi-Shot adds more)
  burstExtra: 0, // extra bolts fired in a line at the same target (Twin Shot adds more)
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

// Swarm surges: every so often a ring of enemies closes in from all sides.
const SURGE_CONFIG = {
  firstSurge: 45, // seconds until the first surge
  minGap: 40, // seconds between surges (random between min and max)
  maxGap: 55,
  baseCount: 6, // enemies in the first surge
  extraPerMinute: 2, // more enemies per surge for every minute survived
  maxCount: 14,
  ringRadius: 85, // how far from the player the ring appears
  warningTime: 1.2, // surges get a longer warning, so they stay fair
};

// Experience and score.
const PROGRESSION_CONFIG = {
  xpBase: 5, // energy needed to go from level 1 to level 2
  xpPerLevel: 4, // each level after that needs this much more
  scorePerSecond: 10, // points for simply staying alive
  levelUpInputDelay: 0.6, // seconds before upgrade cards accept input
  postUpgradeSafety: 0.6, // seconds of invulnerability after choosing
};

// Shooter enemy: a purple drone that keeps its distance and fires slow shots.
const SHOOTER_CONFIG = {
  health: 3,
  radius: 4,
  speed: 26,
  preferredMin: 55, // backs away if the player gets closer than this
  preferredMax: 85, // moves closer if the player is farther than this
  fireInterval: 2.4, // seconds between shots
  chargeTime: 0.5, // its eye glows pink this long before firing (the warning)
  fireRange: 150, // only fires when the player is this close
  score: 50,
  energy: 2,
  introduceAt: 40, // seconds before shooters can appear
  maxAlive: 5,
};

// Brute enemy: a big, slow, tough orange monster.
const BRUTE_CONFIG = {
  health: 14,
  radius: 5,
  speed: 17,
  knockbackScale: 0.25, // brutes barely flinch when shot
  score: 120,
  energy: 5,
  introduceAt: 90,
  maxAlive: 3,
};

// Every this many seconds, all enemies get tougher.
const HEALTH_GROWTH = {
  interval: 100,
  chaser: 1, // extra health per step
  shooter: 1,
  brute: 5,
  toxic: 0.75,
};

// Shots fired by enemies.
const ENEMY_SHOT_CONFIG = {
  speed: 55, // slow enough to dodge
  radius: 2,
  lifetime: 4,
  max: 80,
};

// Shield upgrade: blocks one hit, then recharges.
const SHIELD_CONFIG = {
  rechargeTimes: [12, 9, 6.5], // seconds to recharge at shield level 1, 2, 3
  radius: 8, // size of the bubble drawn around the player
};

// Multi-shot: angle between neighbouring bolts, in radians (~12 degrees).
const MULTISHOT_SPREAD = 0.21;

// Twin Shot: seconds between the bolts of one burst. Short enough that
// they look like a quick "pew-pew", long enough to see two separate bolts.
const TWIN_SHOT_GAP = 0.08;

// Toxic Slime: a green chaser that leaves a poison gas cloud when defeated.
const TOXIC_CONFIG = {
  healthRatio: 0.75, // 3/4 of a chaser's health (1.5 at the start)
  radius: 3,
  score: 30,
  energy: 1,
  introduceAt: 25, // seconds before toxic slimes can appear
  maxAlive: 8,
};

// The gas cloud a Toxic Slime leaves behind.
const GAS_CONFIG = {
  duration: 10, // seconds the cloud stays (including fading away)
  formTime: 0.5, // harmless while it puffs up, so a point-blank kill is fair
  fadeTime: 2.5, // the last seconds, while it thins out and disappears
  radius: 10, // rough size of the cloud
  maxClouds: 12, // oldest clouds vanish if there are too many
};

// Hearts that defeated monsters sometimes drop. They fill you up to
// HEALTH_CONFIG.maxHealth; at full health they wait on the floor.
const HEART_DROP_CONFIG = {
  chance: { chaser: 0.05, toxic: 0.075, shooter: 0.1, brute: 0.15 }, // 0.05 = 5%
  bonusPerHeartLost: 0.05, // +5% to every chance each time you lose a heart
  maxOnFloor: 30, // performance limit for hearts lying around
};
