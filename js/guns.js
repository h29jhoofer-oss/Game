// =====================================================================
// guns.js — the three guns you can choose before a run.
//
// Each gun is one object:
//   aim    : how it picks where to shoot
//              'nearest'  — at the closest enemy (Blaster)
//              'movement' — the way you are moving (Shotgun)
//              'sniper'   — at a Shooter if there is one, otherwise the
//                           farthest enemy in range (Sniper)
//   style  : how its bullets look ('bolt', 'pellet' or 'sniper')
//   sound  : which sound recipe (audio.js) it plays when firing
//   stats  : the numbers the Weapon uses. They start from WEAPON_CONFIG
//            (the Blaster) and change only what is different.
//   sprite : a small pixel-art picture for the select screen and HUD
//
// To add a gun, add one more entry here (and its upgrades in upgrades.js).
// =====================================================================

const GUNS = [
  {
    id: 'blaster',
    name: 'BLASTER',
    tagline: 'AIMS AT NEAREST',
    uiColor: PALETTE.cyan,
    aim: 'nearest',
    style: 'bolt',
    sound: 'shoot',
    stats: { ...WEAPON_CONFIG },
    sprite: [
      '..kkkkkkk...',
      '.kbbbbbbckk.',
      'kbbccccccwwk',
      'kbbkkkkkkkk.',
      'kbbk........',
      '.kk.........',
    ],
    spriteColors: { k: PALETTE.void, b: PALETTE.blue, c: PALETTE.cyan, w: PALETTE.white },
  },
  {
    id: 'shotgun',
    name: 'SHOTGUN',
    tagline: 'FIRES WHERE YOU MOVE',
    uiColor: PALETTE.orange,
    aim: 'movement',
    style: 'pellet',
    sound: 'shotgun',
    stats: {
      ...WEAPON_CONFIG,
      fireInterval: WEAPON_CONFIG.fireInterval / 0.5, // half as fast
      gunDamage: 2, // each pellet does double damage
      projectileCount: 4, // 4 pellets per blast
      spread: 0.2, // radians between pellets (~11 degrees)
      range: 55, // only fires when an enemy is this close...
      projectileSpeed: 210,
      projectileLifetime: 0.27, // ...and pellets vanish after about 55 pixels
      hitKnockback: 70,
    },
    sprite: [
      '............',
      'kkkkkkkkkkkk',
      'kdddoooooooy',
      'kdddoooooooy',
      'kddkkkkkkkkk',
      '.kk.........',
    ],
    spriteColors: { k: PALETTE.void, d: '#7a3208', o: PALETTE.orange, y: PALETTE.yellow },
  },
  {
    id: 'sniper',
    name: 'SNIPER',
    tagline: 'HUNTS SHOOTERS',
    uiColor: PALETTE.green,
    aim: 'sniper',
    style: 'sniper',
    sound: 'sniper',
    stats: {
      ...WEAPON_CONFIG,
      fireInterval: WEAPON_CONFIG.fireInterval / 0.75, // 0.75x as fast
      gunDamage: 1.5,
      range: 200, // reaches most of the arena
      projectileSpeed: 280,
      projectileLifetime: 1,
      homing: 1.5, // how sharply bullets curve toward their target (radians per second)
    },
    sprite: [
      '....kkkk....',
      '....kggk....',
      'kkkkkkkkkkkk',
      'kdddgggggggw',
      'kddkkkkkkkkk',
      '.kk.........',
    ],
    spriteColors: { k: PALETTE.void, d: '#0b4a20', g: PALETTE.green, w: PALETTE.white },
  },
];

const Guns = {
  init() {
    for (const gun of GUNS) gun.image = bakeSprite(gun.sprite, gun.spriteColors);
  },
};

// Look up a gun by id. Unknown ids (like an old save) fall back to the Blaster.
function getGun(id) {
  return GUNS.find((gun) => gun.id === id) || GUNS[0];
}
