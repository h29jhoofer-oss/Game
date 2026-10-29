// =====================================================================
// upgrades.js — the upgrades offered when you level up.
//
// Each upgrade is a plain object:
//   id          : a unique name used to count how many times it was taken
//   name        : shown on the card
//   lines       : the short description (one string per line on the card)
//   icon        : 7x7 pixel art, same format as sprites.js
//   maxLevel    : how many times it can be taken (Infinity = no limit)
//   weapons     : optional list of guns it belongs to, e.g. ['shotgun'].
//                 Without it, the upgrade works for every gun.
//   canOffer()  : optional extra rule for when it may appear
//   apply()     : what it actually does to the game
//
// To add a new upgrade, add one more object to this list. Nothing else
// needs to change.
// =====================================================================

const ICON_COLORS = {
  k: PALETTE.void,
  y: PALETTE.yellow,
  w: PALETTE.white,
  g: PALETTE.green,
  o: PALETTE.orange,
  c: PALETTE.cyan,
  b: PALETTE.blue,
  r: PALETTE.red,
  p: '#ff8a9a',
};

const UPGRADES = [
  {
    id: 'rapidFire',
    name: 'RAPID FIRE',
    lines: ['SHOOT 15%', 'FASTER'],
    maxLevel: 5,
    icon: [
      '....yy.',
      '...yy..',
      '..yyy..',
      '.ywyyy.',
      '...yy..',
      '..yy...',
      '.yy....',
    ],
    apply(game) {
      game.weapon.stats.fireInterval *= 0.85;
    },
  },
  {
    id: 'heavyShots',
    name: 'HEAVY SHOTS',
    lines: ['+1 DAMAGE', 'PER SHOT'],
    maxLevel: 4,
    icon: [
      '.......',
      '..ooo..',
      '.oyyyo.',
      'boywyo.',
      '.oyyyo.',
      '..ooo..',
      '.......',
    ],
    apply(game) {
      game.weapon.stats.damage += 1;
    },
  },
  {
    id: 'speedBoost',
    name: 'SPEED BOOST',
    lines: ['MOVE 10%', 'FASTER'],
    maxLevel: 4,
    icon: [
      'c..c...',
      '.c..c..',
      '..c..c.',
      '...w..w',
      '..c..c.',
      '.c..c..',
      'c..c...',
    ],
    apply(game) {
      game.player.speed *= 1.1;
    },
  },
  {
    id: 'magnet',
    name: 'MAGNET',
    lines: ['PULL ENERGY', 'FROM FARTHER'],
    maxLevel: 4,
    icon: [
      'ww...ww',
      'rr...rr',
      'rr...rr',
      'rr...rr',
      'rrr.rrr',
      '.rrrrr.',
      '..rrr..',
    ],
    apply(game) {
      game.player.magnetRadius += 14;
    },
  },
  {
    id: 'piercing',
    weapons: ['blaster'],
    name: 'PIERCING',
    lines: ['SHOTS PASS', 'THROUGH +1', 'ENEMY'],
    maxLevel: 3,
    icon: [
      '...r...',
      '...rc..',
      '...r.c.',
      'cccrccw',
      '...r.c.',
      '...rc..',
      '...r...',
    ],
    apply(game) {
      game.weapon.stats.pierce += 1;
    },
  },
  {
    id: 'multiShot',
    weapons: ['blaster'],
    name: 'MULTI-SHOT',
    lines: ['+1 BOLT', 'FANNED OUT'],
    maxLevel: 3,
    icon: [
      'c......',
      '.cw....',
      '..c....',
      'cwcwccw',
      '..c....',
      '.cw....',
      'c......',
    ],
    apply(game) {
      game.weapon.stats.projectileCount += 1;
    },
  },
  {
    id: 'twinShot',
    weapons: ['blaster'],
    name: 'TWIN SHOT',
    lines: ['+1 BOLT IN A', 'LINE AT THE', 'SAME TARGET'],
    maxLevel: 2,
    icon: [
      '.......',
      '.......',
      '......r',
      'bcwbcwr',
      '......r',
      '.......',
      '.......',
    ],
    apply(game) {
      game.weapon.stats.burstExtra += 1;
    },
  },
  {
    id: 'shield',
    name: 'SHIELD',
    lines: ['BLOCKS 1 HIT', 'THEN', 'RECHARGES'],
    maxLevel: 3,
    icon: [
      'kkkkkkk',
      'kcwccck',
      'kwcccck',
      'kccccck',
      '.kccck.',
      '..kck..',
      '...k...',
    ],
    apply(game) {
      game.player.addShieldLevel();
    },
  },
  // ---------------- Shotgun upgrades ----------------
  {
    id: 'extraPellets',
    name: 'EXTRA PELLETS',
    weapons: ['shotgun'],
    lines: ['+2 PELLETS', 'EVERY BLAST'],
    maxLevel: 3,
    icon: [
      '.......',
      '.yo.yo.',
      '.oo.oo.',
      '.......',
      '.yo.yo.',
      '.oo.oo.',
      '.......',
    ],
    apply(game) {
      game.weapon.stats.projectileCount += 2;
    },
  },
  {
    id: 'longBarrel',
    name: 'LONG BARREL',
    weapons: ['shotgun'],
    lines: ['PELLETS FLY', '25% FARTHER'],
    maxLevel: 3,
    icon: [
      '.......',
      '.......',
      'wwwwwwy',
      'ooooo..',
      'oo.....',
      'oo.....',
      '.......',
    ],
    apply(game) {
      game.weapon.stats.range *= 1.25;
      game.weapon.stats.projectileLifetime *= 1.25;
    },
  },
  {
    id: 'stoppingPower',
    name: 'STOPPING POWER',
    weapons: ['shotgun'],
    lines: ['BLASTS KNOCK', 'ENEMIES FAR', 'BACK'],
    maxLevel: 2,
    icon: [
      '...o...',
      '...oo..',
      'ooooyo.',
      'oooooyo',
      'ooooyo.',
      '...oo..',
      '...o...',
    ],
    apply(game) {
      game.weapon.stats.hitKnockback += 60;
    },
  },
  // ---------------- Sniper upgrades ----------------
  {
    id: 'seekerRounds',
    name: 'SEEKER ROUNDS',
    weapons: ['sniper'],
    lines: ['BULLETS CURVE', 'HARDER TOWARD', 'TARGETS'],
    maxLevel: 3,
    icon: [
      '.....rr',
      '...g.rr',
      '..g....',
      '.g.....',
      '.g.....',
      'g......',
      'g......',
    ],
    apply(game) {
      game.weapon.stats.homing += 2;
    },
  },
  {
    id: 'penetrator',
    name: 'PENETRATOR',
    weapons: ['sniper'],
    lines: ['BULLETS PIERCE', '+1 ENEMY'],
    maxLevel: 3,
    icon: [
      '.r..r..',
      '.r..r..',
      '.r..r..',
      'gggggww',
      '.r..r..',
      '.r..r..',
      '.r..r..',
    ],
    apply(game) {
      game.weapon.stats.pierce += 1;
    },
  },
  {
    id: 'criticalHit',
    name: 'CRITICAL HIT',
    weapons: ['sniper'],
    lines: ['25% CHANCE OF', 'TRIPLE DAMAGE'],
    maxLevel: 2,
    icon: [
      '...r...',
      '.rrrrr.',
      '.r...r.',
      'rr.w.rr',
      '.r...r.',
      '.rrrrr.',
      '...r...',
    ],
    apply(game) {
      game.weapon.stats.critChance += 0.25;
    },
  },
];

// Used only when every other upgrade is maxed out.
const FALLBACK_UPGRADE = {
  id: 'bonusPoints',
  name: 'BONUS POINTS',
  lines: ['+500 SCORE'],
  maxLevel: Infinity,
  icon: [
    '..yyy..',
    '.yyyyy.',
    'yywwyyy',
    'yywyyyy',
    'yyyyyyy',
    '.yyyyy.',
    '..yyy..',
  ],
  apply(game) {
    game.score += 500;
  },
};

const Upgrades = {
  init() {
    // Bake each icon into a small canvas, just like the other sprites.
    for (const upgrade of [...UPGRADES, FALLBACK_UPGRADE]) {
      upgrade.iconImage = bakeSprite(upgrade.icon, ICON_COLORS);
    }
  },

  // Pick `count` different upgrades the player is allowed to take.
  pickChoices(game, count) {
    const available = UPGRADES.filter((upgrade) => {
      const taken = game.upgradeLevels[upgrade.id] || 0;
      if (taken >= upgrade.maxLevel) return false;
      if (upgrade.weapons && !upgrade.weapons.includes(game.weapon.id)) return false; // another gun's upgrade
      if (upgrade.canOffer && !upgrade.canOffer(game)) return false;
      return true;
    });

    // Shuffle (Fisher-Yates), then take the first few.
    for (let i = available.length - 1; i > 0; i--) {
      const j = randomInt(0, i);
      [available[i], available[j]] = [available[j], available[i]];
    }
    const choices = available.slice(0, count);
    if (choices.length === 0) choices.push(FALLBACK_UPGRADE);
    return choices;
  },
};
