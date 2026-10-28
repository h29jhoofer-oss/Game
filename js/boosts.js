// =============================================================
// boosts.js — Run boosts you buy with coins.
//
// Collect enough coins during a run and the game pauses to offer
// three boost cards. Boosts last until the end of that run.
//
//   OMJ.BOOSTS          passive boosts (most cards). `apply(m)` changes
//                       the run's modifiers `m` (see OMJ.newRunMods).
//                       `max` = how many times you can stack it.
//   OMJ.BONUS_ABILITIES rare ACTIVE abilities no skin has. You get at
//                       most one per run, used with V.
//
// Every boost only ever helps, and anything that changes your jump
// goes through OMJ.Physics, so obstacle spacing adapts to it.
// =============================================================

OMJ.COINS = {
  firstBoostAt: 25,       // coins for the first boost...
  costIncrease: 10,       // ...and each boost after costs this many more
  rareChance: 0.15,       // chance per card of a rare active ability
};

// The run's modifiers. Every boost changes some of these.
OMJ.newRunMods = function () {
  return {
    speedScale: 1,        // world speed multiplier
    jumpScale: 1,         // jump speed multiplier
    magnet: 0,            // coins within this many pixels fly to you
    coinValue: 1,         // coins each pickup is worth
    scoreRate: 1,         // score multiplier
    cooldownRate: 1,      // ability recharge speed multiplier
    hitboxShrink: 0,      // extra pixels off each side of your hitbox
    extraCoyote: 0,       // extra seconds of jump grace time
    extraBuffer: 0,
    extraLives: 0,        // crashes you can survive
    smashDamage: 1,       // boss damage per ground-smash shockwave
    stacks: {},           // how many of each boost you have
  };
};

OMJ.BOOSTS = [
  { id: 'slower', name: 'Steady Pace', desc: 'The world moves 7% slower', max: 3,
    apply(m) { m.speedScale *= 0.93; } },
  { id: 'spring', name: 'Spring Shoes', desc: 'Jump higher and hang in the air longer', max: 3,
    apply(m) { m.jumpScale *= 1.05; } },
  { id: 'magnet', name: 'Coin Magnet', desc: 'Nearby coins fly to you', max: 3,
    apply(m) { m.magnet += 28; } },
  { id: 'double', name: 'Lucky Coins', desc: 'Every coin counts double', max: 1,
    apply(m) { m.coinValue = 2; } },
  { id: 'showoff', name: 'Show-Off', desc: '+15% score', max: 5,
    apply(m) { m.scoreRate *= 1.15; } },
  { id: 'recharge', name: 'Quick Recharge', desc: 'Abilities recharge 25% faster', max: 3,
    apply(m) { m.cooldownRate *= 1.25; } },
  { id: 'squeeze', name: 'Squeeze', desc: 'Smaller hitbox: near misses get nearer', max: 1,
    apply(m) { m.hitboxShrink += 1; } },
  { id: 'reflexes', name: 'Cat Reflexes', desc: 'Even more forgiving jump timing', max: 1,
    apply(m) { m.extraCoyote += 0.05; m.extraBuffer += 0.06; } },
  { id: 'life', name: 'Extra Life', desc: 'Survive one more crash', max: 2, weight: 0.5,
    apply(m) { m.extraLives += 1; } },
  { id: 'stomp', name: 'Heavy Stomp', desc: 'Ground-smash shockwaves hit bosses twice as hard', max: 1, weight: 0.7,
    apply(m) { m.smashDamage = 2; } },
];

// Rare ACTIVE abilities (V key). Same format as OMJ.ABILITIES in abilities.js.
OMJ.BONUS_ABILITIES = {
  rocket: {
    name: 'Rocket Jump', desc: 'Blast sky-high. You can\'t crash until you land', cooldown: 12, duration: 0,
    canUse(g) { return !g.player.dead; },
    activate(g, a) {
      const p = g.player;
      p.vy = -OMJ.Physics.jumpVelocity * 1.45;
      p.grounded = false;
      p.smashing = false;
      p.standingOn = null;
      p.squash = -1;
      a.rocketing = true;
      a.giveInvulnerability(0.3);
      g.particles.burst(p.x + 5, p.bottom, 16, 40, 120, Math.PI * 0.25, Math.PI * 0.75, 0.5, [OMJ.PALETTE.gold, '#ff8a3d', OMJ.PALETTE.danger], -100);
      g.sound.play('rocket');
    },
  },
  blink: {
    name: 'Blink', desc: 'Teleport past the next obstacle', cooldown: 10, duration: 0,
    canUse(g) { return g.nextThingAhead() !== null; },
    activate(g, a) {
      g.blinkPast(g.nextThingAhead());
      a.giveInvulnerability(0.35);
      g.sound.play('blink');
    },
  },
  bulldozer: {
    name: 'Bulldozer', desc: 'Smash through everything for 4 seconds', cooldown: 18, duration: 4,
    activate(g, a) {
      a.giveInvulnerability(4);
      g.sound.play('dash');
    },
  },
};

// Pick three different cards to offer. Returns a list like
// [{ kind: 'boost', boost }, { kind: 'bonus', key, ability }, ...]
OMJ.pickBoostChoices = function (mods, hasBonusAbility) {
  const choices = [];
  const used = {};
  let rareOffered = hasBonusAbility;   // only one rare card, and only if you have none
  for (let slot = 0; slot < 3; slot++) {
    if (!rareOffered && Math.random() < OMJ.COINS.rareChance) {
      const keys = Object.keys(OMJ.BONUS_ABILITIES);
      const key = keys[Math.floor(Math.random() * keys.length)];
      choices.push({ kind: 'bonus', key: key, ability: OMJ.BONUS_ABILITIES[key] });
      rareOffered = true;
      continue;
    }
    // Weighted pick among passive boosts you can still stack.
    let total = 0;
    for (let i = 0; i < OMJ.BOOSTS.length; i++) {
      const b = OMJ.BOOSTS[i];
      if (!used[b.id] && (mods.stacks[b.id] || 0) < b.max) total += b.weight || 1;
    }
    if (total === 0) break;
    let roll = Math.random() * total;
    for (let i = 0; i < OMJ.BOOSTS.length; i++) {
      const b = OMJ.BOOSTS[i];
      if (used[b.id] || (mods.stacks[b.id] || 0) >= b.max) continue;
      roll -= b.weight || 1;
      if (roll <= 0) {
        used[b.id] = true;
        choices.push({ kind: 'boost', boost: b });
        break;
      }
    }
  }
  return choices;
};
