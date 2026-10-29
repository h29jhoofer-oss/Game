// =====================================================================
// upgrades.js — the upgrades offered when you level up.
//
// Each upgrade is a plain object:
//   id          : a unique name used to count how many times it was taken
//   name        : shown on the card
//   lines       : the short description (one string per line on the card)
//   icon        : 7x7 pixel art, same format as sprites.js
//   maxLevel    : how many times it can be taken (Infinity = no limit)
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
    id: 'extraHealth',
    name: 'EXTRA HEALTH',
    lines: ['RESTORE', '1 HEART'],
    maxLevel: Infinity,
    icon: [
      '.......',
      '.rr.rr.',
      'rprrrrr',
      'rrrrrrr',
      '.rrrrr.',
      '..rrr..',
      '...r...',
    ],
    // Only offered when it would actually do something.
    canOffer(game) {
      return game.player.health < game.player.maxHealth;
    },
    apply(game) {
      game.player.heal(1);
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
