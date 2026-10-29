// =====================================================================
// characters.js — the playable heroes.
//
// Every hero uses the same pixel-art body, just in different colors.
// Their stats are multipliers on the normal values in config.js, so
// "speed: 1.75" means 1.75x the normal speed. The multipliers keep
// working on top of upgrades (a 1.5x damage hero still does 1.5x after
// Heavy Shots).
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
    perk: '', // one short line shown on the select screen
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
    perk: 'DASH RAMS ENEMIES',
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
    perk: 'DASH GOES 2X FAR',
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
