// =============================================================
// config.js — Every number that controls how the game FEELS.
// Tweak these first when you want to change the gameplay.
// =============================================================

// One shared "namespace" object so the game never clashes with
// other scripts on a website that embeds it.
window.OMJ = window.OMJ || {};

OMJ.CONFIG = {
  // ---- Screen ------------------------------------------------
  // The game is drawn at this tiny "virtual" resolution and then
  // scaled up, which keeps the pixel art crisp and chunky.
  VIEW_W: 384,
  VIEW_H: 216,
  GROUND_Y: 184,            // y position of the top of the ground

  // ---- Timing ------------------------------------------------
  // Each frame is split into small physics steps no longer than this,
  // so fast obstacles can't skip through the player. Movement uses exact
  // formulas, so the game behaves the same at 30, 60 or 144 frames per second.
  MAX_STEP: 1 / 120,
  MAX_FRAME_TIME: 0.1,      // after a lag spike, don't jump ahead more than this

  // ---- Player ------------------------------------------------
  PLAYER_X: 56,             // the player stays at this x position
  PLAYER_W: 10,             // hitbox width
  PLAYER_H: 12,             // hitbox height
  GRAVITY: 1500,            // pixels per second², pulls you down
  JUMP_VELOCITY: 430,       // upward speed at the start of a jump
  MAX_FALL_SPEED: 900,
  SMASH_SPEED: 650,         // ground smash (DOWN): instant downward speed
  COYOTE_TIME: 0.08,        // you can still jump this long after leaving a ledge
  JUMP_BUFFER_TIME: 0.12,   // a press this early before landing still counts

  // ---- Speed & difficulty ------------------------------------
  START_SPEED: 150,         // pixels per second
  MAX_SPEED: 330,
  DIFFICULTY_MAX_SCORE: 1500, // at this score the game is at full difficulty

  // ---- Obstacle spawning -------------------------------------
  FIRST_OBSTACLE_DISTANCE: 260,
  // Extra time (seconds) the player gets to react between obstacles,
  // on top of the time a full jump takes. Easy -> hard.
  REACTION_TIME_EASY: 0.45,
  REACTION_TIME_HARD: 0.2,
  // Random extra spacing (in seconds of running) on top of the minimum.
  RANDOM_EXTRA_EASY: 0.9,
  RANDOM_EXTRA_HARD: 0.35,

  // ---- Scoring -----------------------------------------------
  SCORE_PER_PIXEL: 0.05,    // score earned per pixel travelled
  MILESTONE_EVERY: 100,
  MILESTONE_BONUS: 10,

  // ---- Feel & effects ----------------------------------------
  HITSTOP_TIME: 0.1,        // tiny freeze when you crash
  DEATH_TO_GAMEOVER: 0.8,   // seconds of death animation before the menu
  RESTART_LOCK_TIME: 0.35,  // SPACE can't restart instantly (prevents accidents)

  // ---- Misc --------------------------------------------------
  DEBUG_HITBOXES: false,    // true = draw collision boxes (press H in game)
  STORAGE_KEY: 'oneMoreJump.save.v1',
};
