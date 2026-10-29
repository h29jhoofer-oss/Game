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
//                 It is only offered once you own one of those guns.
//                 Without it, the upgrade works for every gun.
//   canOffer()  : optional extra rule for when it may appear
//   apply()     : what it actually does to the game, OR
//   improveWeapon(stats) : for weapon upgrades, how it changes one gun's
//                 stats. It is applied to every gun you own (or only to
//                 the guns in `weapons`), and to guns you pick up later.
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
  v: PALETTE.purple,
  l: '#d08aff',
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
    improveWeapon(stats) {
      stats.fireInterval *= 0.85;
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
    improveWeapon(stats) {
      stats.damage += 1;
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
    improveWeapon(stats) {
      stats.pierce += 1;
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
    improveWeapon(stats) {
      stats.projectileCount += 1;
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
    improveWeapon(stats) {
      stats.burstExtra += 1;
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
    improveWeapon(stats) {
      stats.projectileCount += 2;
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
    improveWeapon(stats) {
      stats.range *= 1.25;
      stats.projectileLifetime *= 1.25;
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
    improveWeapon(stats) {
      stats.hitKnockback += 60;
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
    improveWeapon(stats) {
      stats.homing += 2;
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
    improveWeapon(stats) {
      stats.pierce += 1;
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
    improveWeapon(stats) {
      stats.critChance += 0.25;
    },
  },
  // ---------------- SMG upgrades ----------------
  {
    id: 'bulletHose',
    name: 'BULLET HOSE',
    weapons: ['smg'],
    lines: ['SMG FIRES', '20% FASTER'],
    maxLevel: 3,
    icon: [
      '.......',
      'l.l.l.l',
      '.......',
      'v.v.v.v',
      '.......',
      'l.l.l.l',
      '.......',
    ],
    improveWeapon(stats) {
      stats.fireInterval *= 0.8;
    },
  },
  {
    id: 'hollowPoints',
    name: 'HOLLOW POINTS',
    weapons: ['smg'],
    lines: ['SMG BULLETS', 'HIT 50% HARDER'],
    maxLevel: 3,
    icon: [
      '..vvv..',
      '.vlllv.',
      'vll.llv',
      'vl...lv',
      'vll.llv',
      '.vlllv.',
      '..vvv..',
    ],
    improveWeapon(stats) {
      stats.gunDamage += 0.25; // 0.5 -> 0.75 is +50% of the starting damage
    },
  },
  {
    id: 'spray',
    name: 'SPRAY',
    weapons: ['smg'],
    lines: ['+1 SMG BULLET', 'IN A TIGHT FAN'],
    maxLevel: 2,
    icon: [
      '.....l.',
      '...l...',
      'vvv..l.',
      'vvvl...',
      'vvv..l.',
      '...l...',
      '.....l.',
    ],
    improveWeapon(stats) {
      stats.projectileCount += 1;
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

  // Take an upgrade. Weapon upgrades go to the right guns; others use apply().
  applyUpgrade(game, upgrade) {
    if (!upgrade.improveWeapon) {
      upgrade.apply(game);
      return;
    }
    for (const weapon of game.weapons) {
      if (!upgrade.weapons || upgrade.weapons.includes(weapon.id)) upgrade.improveWeapon(weapon.stats);
    }
  },

  // A gun picked up mid-run catches up on every general weapon upgrade
  // you already have (for example Rapid Fire x2), so it isn't left behind.
  catchUpNewWeapon(game, weapon) {
    for (const upgrade of UPGRADES) {
      if (!upgrade.improveWeapon || upgrade.weapons) continue;
      const taken = game.upgradeLevels[upgrade.id] || 0;
      for (let i = 0; i < taken; i++) upgrade.improveWeapon(weapon.stats);
    }
  },

  // Pick `count` different upgrades the player is allowed to take.
  pickChoices(game, count) {
    const available = UPGRADES.filter((upgrade) => {
      const taken = game.upgradeLevels[upgrade.id] || 0;
      if (taken >= upgrade.maxLevel) return false;
      if (upgrade.weapons && !upgrade.weapons.some((id) => game.hasGun(id))) return false; // a gun you don't own
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
