// =====================================================================
// characters.js — the playable heroes.
//
// Every hero uses the same pixel-art body, just in different colors.
// Their stats are multipliers on the normal values in config.js, so
// "speed: 1.75" means 1.75x the normal speed. The multipliers keep
// working on top of upgrades (a 1.5x damage hero still does 1.5x after
// Heavy Shots).
//
// Each hero starts with the gun that matches their color (`startGun`, see
// guns.js); the other guns are rare drops.
//
// To add a new hero, add one more entry to this list.
// =====================================================================

const CHARACTERS = [
  {
    id: 'runner',
    name: 'RUNNER',
    tagline: 'ALL-ROUNDER',
    uiColor: PALETTE.cyan,
    // Sprite colors: c = bright body, b = suit, d = suit shading.
    colors: { c: PALETTE.cyan, b: PALETTE.blue, d: PALETTE.darkBlue },
    speed: 1,
    damage: 1,
    range: 1,
    startHealth: HEALTH_CONFIG.startHealth,
    maxHealth: 4,
    dashDistance: 1, // 1 = normal dash
    dashDamage: 0, // damage the dash does to monsters you run into (0 = none)
    gasImmune: false, // true = Toxic Slime gas clouds can't hurt this hero
    perk: '', // one short line shown on the select screen
    startGun: 'blaster',
  },
  {
    id: 'brute',
    name: 'BRUTE',
    tagline: 'SLOW, HITS HARD',
    uiColor: PALETTE.orange,
    colors: { c: '#ffb347', b: PALETTE.orange, d: '#a34a0a' },
    speed: 0.75,
    damage: 1.5,
    range: 1,
    startHealth: HEALTH_CONFIG.startHealth,
    maxHealth: HEALTH_CONFIG.maxHealth,
    dashDistance: 1,
    dashDamage: 4, // ramming! Enough to destroy a fresh Chaser
    gasImmune: false,
    perk: 'DASH RAMS ENEMIES',
    startGun: 'shotgun',
  },
  {
    id: 'speeder',
    name: 'SPEEDER',
    tagline: 'FAST BUT FRAGILE',
    uiColor: '#d08aff',
    colors: { c: '#d08aff', b: PALETTE.purple, d: '#5a1a9a' },
    speed: 1.75,
    damage: 1,
    range: 1.5,
    startHealth: 3,
    maxHealth: 3,
    dashDistance: 2, // dashes twice as far (twice as fast, same short time)
    dashDamage: 0,
    gasImmune: false,
    perk: 'DASH GOES 2X FAR',
    startGun: 'smg',
  },
  {
    id: 'viper',
    name: 'VIPER',
    tagline: 'POISON-PROOF',
    uiColor: PALETTE.green,
    colors: { c: '#b6ffc8', b: PALETTE.green, d: '#139a3c' },
    // Strengths: hits harder and reaches farther, and toxic gas can't hurt it.
    // Weaknesses: a little slow, and only 3 hearts.
    speed: 0.9,
    damage: 1.4, // a Sniper bullet (1.5 x 1.4 = 2.1) one-shots a fresh Chaser
    range: 1.25,
    startHealth: 3,
    maxHealth: 3,
    dashDistance: 1,
    dashDamage: 0,
    gasImmune: true,
    perk: 'TOXIC GAS IMMUNE',
    startGun: 'sniper',
  },
];

// Look up a hero by id. Unknown ids (like an old save) fall back to the first.
function getCharacter(id) {
  return CHARACTERS.find((character) => character.id === id) || CHARACTERS[0];
}

// The colors of a hero's explosion when they are defeated.
function getCharacterExplosionColors(character) {
  return [PALETTE.white, character.colors.c, character.colors.b, character.colors.d, PALETTE.void];
}
