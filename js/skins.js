// =============================================================
// skins.js — Unlockable characters, each with its own powers.
// A skin unlocks once your personal BEST reaches `unlockAt`.
//
//   body / shade / light = the character's body colors
//   scarf                = the flappy scarf color
//   rainbow: true        = scarf cycles through colors
//   passive              = always-on perk (see OMJ.PASSIVE_DEFAULTS)
//   active               = name of an ability in abilities.js,
//                          used with B / SHIFT / right-click
//
// To add a skin, copy one entry and change it.
// =============================================================

// Every passive perk starts from these values; a skin only lists what it changes.
OMJ.PASSIVE_DEFAULTS = {
  scoreRate: 1,         // 1.1 = +10% score
  milestoneBonus: 1,    // multiplies the bonus for every 100 points
  coyoteTime: null,     // null = use the normal value from config.js
  jumpBufferTime: null,
  hitboxShrink: 0,      // pixels removed from each side of your hitbox
  cooldownRate: 1,      // 1.5 = abilities recharge 50% faster
  secondChance: false,  // survive one crash per run
};

OMJ.SKINS = [
  { id: 'classic', name: 'Classic', unlockAt: 0,
    body: '#ff7a3d', shade: '#c2412b', light: '#ffb36b', scarf: '#3b8bff',
    passive: { name: 'Lucky Streak', desc: 'Milestone bonus doubled', milestoneBonus: 2 },
    active: 'doubleJump' },

  { id: 'minty', name: 'Minty', unlockAt: 100,
    body: '#5fe0a0', shade: '#2a9d6f', light: '#b5ffd8', scarf: '#ff5c8a',
    passive: { name: 'Quick Feet', desc: 'Extra-forgiving jump timing', coyoteTime: 0.15, jumpBufferTime: 0.2 },
    active: 'dash' },

  { id: 'berry', name: 'Berry', unlockAt: 250,
    body: '#b45cff', shade: '#7a2fc2', light: '#dcb0ff', scarf: '#ffd23f',
    passive: { name: 'Sugar Rush', desc: '+10% score', scoreRate: 1.1 },
    active: 'slowmo' },

  { id: 'ghost', name: 'Ghost', unlockAt: 500,
    body: '#e8f0ff', shade: '#a8b4d0', light: '#ffffff', scarf: '#7bd6ff',
    passive: { name: 'Second Chance', desc: 'Survive one crash per run', secondChance: true },
    active: 'phase' },

  { id: 'ninja', name: 'Ninja', unlockAt: 750,
    body: '#3a3a4e', shade: '#22222e', light: '#8a8aac', scarf: '#ff3b3b',
    passive: { name: 'Slippery', desc: 'Smaller hitbox', hitboxShrink: 1 },
    active: 'shuriken' },

  { id: 'golden', name: 'Golden', unlockAt: 1000,
    body: '#ffd23f', shade: '#c99a10', light: '#fff2a8', scarf: '#ffffff',
    passive: { name: 'Midas Touch', desc: '+25% score', scoreRate: 1.25 },
    active: 'shield' },

  { id: 'cosmic', name: 'Cosmic', unlockAt: 2000,
    body: '#2b1b5c', shade: '#170e36', light: '#8b6fe0', scarf: '#ff4fd8', rainbow: true,
    passive: { name: 'Stardust', desc: 'Abilities recharge 50% faster, +15% score', cooldownRate: 1.5, scoreRate: 1.15 },
    active: 'supernova' },
];

OMJ.getSkin = function (id) {
  for (let i = 0; i < OMJ.SKINS.length; i++) {
    if (OMJ.SKINS[i].id === id) return OMJ.SKINS[i];
  }
  return OMJ.SKINS[0];
};

OMJ.isSkinUnlocked = function (skin, best) {
  return best >= skin.unlockAt;
};

// The skin's passive perk merged over the defaults.
OMJ.getPassive = function (skin) {
  return Object.assign({}, OMJ.PASSIVE_DEFAULTS, skin.passive);
};
