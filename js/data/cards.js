// Card definitions. Stats are level-1 values; RR.Cards.stat() scales them by level.
// Speeds are tiles/second, ranges are tiles (edge-to-edge), hitSpeed is seconds between attacks.
(function (RR) {
  'use strict';

  const SPEED = { slow: 0.75, medium: 1.0, fast: 1.5, veryfast: 2.0 };
  const SPEED_NAME = (s) => (s >= 2 ? 'Very Fast' : s >= 1.5 ? 'Fast' : s >= 1 ? 'Medium' : 'Slow');

  const RARITY = {
    common: { name: 'Common', color: '#9fb4c9', dark: '#4f6378', glow: '#dbe7f3', order: 0 },
    rare: { name: 'Rare', color: '#f39a2b', dark: '#9a4f0c', glow: '#ffd59a', order: 1 },
    epic: { name: 'Epic', color: '#b34ee8', dark: '#5d1a85', glow: '#e7b6ff', order: 2 },
    legendary: { name: 'Legendary', color: '#3fe0c8', dark: '#1a6b8c', glow: '#fff4a8', order: 3 },
  };

  const MAX_LEVEL = 10;
  // cards needed to go from level L to L+1 (index L-1)
  const UPGRADE_CARDS = {
    common: [2, 4, 10, 20, 50, 100, 200, 400, 800],
    rare: [2, 4, 8, 15, 30, 50, 100, 200, 400],
    epic: [1, 2, 4, 8, 15, 25, 40, 60, 100],
    legendary: [1, 1, 2, 3, 5, 8, 12, 18, 25],
  };
  const UPGRADE_GOLD = [10, 30, 80, 200, 500, 1000, 2000, 4000, 8000];
  const UPGRADE_XP = [4, 8, 15, 30, 50, 80, 120, 180, 250];

  const C = {};
  function def(d) {
    d.count = d.count || 1;
    d.sight = d.sight || 5.5;
    d.deployTime = d.deployTime == null ? 1 : d.deployTime;
    d.mass = d.mass || 5;
    d.radius = d.radius || 0.45;
    d.size = d.size || 1;
    C[d.id] = d;
  }

  // ======================= TROOPS =======================
  def({ id: 'iron_squire', name: 'Iron Squire', type: 'troop', rarity: 'common', cost: 3, arena: 0,
    desc: 'A sturdy shield-bearer who holds the line. Cheap, tough and reliable.',
    hp: 1350, dmg: 155, hitSpeed: 1.2, speed: SPEED.medium, range: 0.6, targets: 'ground',
    radius: 0.45, mass: 6, sprite: 'squire', roles: ['mini-tank', 'melee'], sound: 'sword' });

  def({ id: 'longbow_twins', name: 'Longbow Twins', type: 'troop', rarity: 'common', cost: 3, arena: 0,
    desc: 'Two sharp-eyed archers. They shoot air and ground from a safe distance.',
    hp: 310, dmg: 95, hitSpeed: 1.0, speed: SPEED.medium, range: 5, targets: 'both', count: 2,
    radius: 0.4, mass: 3, projectile: { type: 'arrow', speed: 12 }, sprite: 'archer', roles: ['ranged', 'anti-air'], sound: 'bow' });

  def({ id: 'gremlin_gang', name: 'Gremlin Gang', type: 'troop', rarity: 'common', cost: 2, arena: 0,
    desc: 'Three cackling gremlins with daggers. Very fast, very fragile.',
    hp: 165, dmg: 92, hitSpeed: 1.1, speed: SPEED.veryfast, range: 0.5, targets: 'ground', count: 3,
    radius: 0.35, mass: 2, size: 0.78, sprite: 'gremlin', roles: ['swarm', 'melee', 'cycle'], sound: 'stab' });

  def({ id: 'bone_rattlers', name: 'Bone Rattlers', type: 'troop', rarity: 'common', cost: 1, arena: 0,
    desc: 'Three rattling skeletons. Great for distracting big, slow hitters.',
    hp: 72, dmg: 66, hitSpeed: 1.0, speed: SPEED.fast, range: 0.5, targets: 'ground', count: 3,
    radius: 0.3, mass: 1, size: 0.72, sprite: 'skeleton', roles: ['swarm', 'cycle', 'distract'], sound: 'stab' });

  def({ id: 'boulder_brute', name: 'Boulder Brute', type: 'troop', rarity: 'rare', cost: 5, arena: 0,
    desc: 'A mountain of muscle that only cares about smashing buildings.',
    hp: 3400, dmg: 210, hitSpeed: 1.5, speed: SPEED.slow, range: 0.7, targets: 'buildings',
    radius: 0.75, mass: 18, size: 1.45, sprite: 'brute', roles: ['tank', 'win'], sound: 'punch' });

  def({ id: 'powder_gnome', name: 'Powder Gnome', type: 'troop', rarity: 'common', cost: 2, arena: 0,
    desc: 'Lobs bouncing powder kegs that blast groups of ground troops.',
    hp: 300, dmg: 185, hitSpeed: 1.9, speed: SPEED.medium, range: 4.5, targets: 'ground', splash: 1.5,
    radius: 0.38, mass: 3, size: 0.85, projectile: { type: 'bomb', speed: 7, arc: true }, sprite: 'gnome', roles: ['splash', 'ranged'], sound: 'throw' });

  def({ id: 'bat_imps', name: 'Bat Imps', type: 'troop', rarity: 'common', cost: 3, arena: 0,
    desc: 'Three winged imps that spit embers. Ground troops can\'t touch them.',
    hp: 195, dmg: 86, hitSpeed: 1.0, speed: SPEED.veryfast, range: 1.6, targets: 'both', count: 3, flying: true,
    radius: 0.35, mass: 2, size: 0.8, projectile: { type: 'spit', speed: 14 }, sprite: 'imp', roles: ['air', 'swarm', 'dps'], sound: 'spit' });

  def({ id: 'steam_knight', name: 'Steam Knight', type: 'troop', rarity: 'rare', cost: 4, arena: 1,
    desc: 'Clockwork armour, one enormous cleaver. Shreds tanks in a few hits.',
    hp: 1100, dmg: 570, hitSpeed: 1.8, speed: SPEED.fast, range: 0.7, targets: 'ground',
    radius: 0.5, mass: 7, size: 1.08, sprite: 'steamknight', roles: ['dps', 'melee', 'anti-tank'], sound: 'heavy' });

  def({ id: 'whirlwind_berserker', name: 'Whirlwind Berserker', type: 'troop', rarity: 'rare', cost: 4, arena: 1,
    desc: 'Spins her great-axe in a full circle, cutting down everything around her.',
    hp: 1500, dmg: 205, hitSpeed: 1.5, speed: SPEED.medium, range: 0.6, targets: 'ground', selfSplash: 1.7,
    radius: 0.5, mass: 7, size: 1.05, sprite: 'berserker', roles: ['splash', 'melee', 'mini-tank'], sound: 'whoosh' });

  def({ id: 'forest_druid', name: 'Forest Druid', type: 'troop', rarity: 'rare', cost: 4, arena: 1,
    desc: 'Heals every nearby ally in pulses of forest magic while tossing thorn-seeds.',
    hp: 760, dmg: 72, hitSpeed: 1.2, speed: SPEED.medium, range: 4, targets: 'both',
    heal: { amount: 85, radius: 3.2, interval: 1.5 },
    radius: 0.42, mass: 4, projectile: { type: 'leaf', speed: 10 }, sprite: 'druid', roles: ['support', 'ranged'], sound: 'magic' });

  def({ id: 'drakeling', name: 'Drakeling', type: 'troop', rarity: 'epic', cost: 4, arena: 1,
    desc: 'A grumpy baby dragon. Breathes fireballs that splash air and ground.',
    hp: 960, dmg: 125, hitSpeed: 1.5, speed: SPEED.fast, range: 3.5, targets: 'both', splash: 1.2, flying: true,
    radius: 0.55, mass: 6, size: 1.05, projectile: { type: 'flame', speed: 9 }, sprite: 'drake', roles: ['air', 'splash'], sound: 'fire' });

  def({ id: 'flame_wizard', name: 'Flame Wizard', type: 'troop', rarity: 'rare', cost: 5, arena: 2,
    desc: 'Hurls roaring fireballs that splash crowds of air and ground troops.',
    hp: 610, dmg: 235, hitSpeed: 1.4, speed: SPEED.medium, range: 5.5, targets: 'both', splash: 1.1,
    radius: 0.42, mass: 4, projectile: { type: 'fireball', speed: 10 }, sprite: 'wizard', roles: ['splash', 'ranged', 'anti-air'], sound: 'fire' });

  def({ id: 'ram_rider', name: 'Ram Rider', type: 'troop', rarity: 'rare', cost: 4, arena: 2,
    desc: 'Leaps over the river and charges straight for enemy buildings.',
    hp: 1420, dmg: 245, hitSpeed: 1.6, speed: SPEED.veryfast, range: 0.6, targets: 'buildings', jumpsRiver: true,
    radius: 0.55, mass: 8, size: 1.12, sprite: 'ramrider', roles: ['win', 'fast'], sound: 'heavy' });

  def({ id: 'necromancer', name: 'Necromancer', type: 'troop', rarity: 'epic', cost: 5, arena: 3,
    desc: 'Raises three Bone Rattlers every few seconds and hurls cursed orbs.',
    hp: 760, dmg: 110, hitSpeed: 1.1, speed: SPEED.medium, range: 5, targets: 'both', splash: 0.9,
    spawner: { card: 'bone_rattlers', count: 3, interval: 7, onDeploy: true },
    radius: 0.42, mass: 4, projectile: { type: 'darkorb', speed: 9 }, sprite: 'necro', roles: ['spawner', 'ranged', 'support'], sound: 'magic' });

  def({ id: 'gas_zeppelin', name: 'Gas Zeppelin', type: 'troop', rarity: 'epic', cost: 5, arena: 3,
    desc: 'A floating bomb factory. Drops huge bombs on buildings — and one last big one when popped.',
    hp: 1500, dmg: 700, hitSpeed: 3.0, speed: SPEED.medium, range: 0.3, targets: 'buildings', flying: true,
    deathDamage: { dmg: 320, radius: 2.2 },
    radius: 0.65, mass: 9, size: 1.2, sprite: 'zeppelin', roles: ['win', 'air'], sound: 'bomb' });

  def({ id: 'charging_paladin', name: 'Charging Paladin', type: 'troop', rarity: 'epic', cost: 5, arena: 3,
    desc: 'After a short run-up he charges at double speed. His first lance strike deals double damage.',
    hp: 1550, dmg: 320, hitSpeed: 1.4, speed: SPEED.medium, range: 1.2, targets: 'ground',
    charge: { distance: 2.5, speedMul: 2, dmgMul: 2 },
    radius: 0.6, mass: 9, size: 1.15, sprite: 'paladin', roles: ['dps', 'win', 'melee'], sound: 'lance' });

  def({ id: 'war_drummer', name: 'War Drummer', type: 'troop', rarity: 'epic', cost: 3, arena: 3,
    desc: 'His thunderous rhythm makes nearby allies move and attack 30% faster.',
    hp: 820, dmg: 92, hitSpeed: 1.2, speed: SPEED.medium, range: 0.6, targets: 'ground',
    aura: { radius: 4, mul: 1.3 },
    radius: 0.48, mass: 6, sprite: 'drummer', roles: ['support', 'melee'], sound: 'punch' });

  def({ id: 'storm_caller', name: 'Storm Caller', type: 'troop', rarity: 'legendary', cost: 4, arena: 4,
    desc: 'Lightning chains between up to 3 enemies and stuns them. Zaps the area when she arrives.',
    hp: 660, dmg: 115, hitSpeed: 1.6, speed: SPEED.fast, range: 5, targets: 'both',
    chain: { count: 3, range: 3, stun: 0.5 }, deployZap: { dmg: 130, radius: 2.5, stun: 0.5 },
    radius: 0.42, mass: 4, sprite: 'storm', roles: ['support', 'ranged', 'anti-air', 'reset'], sound: 'zap' });

  def({ id: 'tunneling_mole', name: 'Tunneling Mole', type: 'troop', rarity: 'legendary', cost: 3, arena: 4,
    desc: 'Digs underground and pops up ANYWHERE in the arena. Ignores the river.',
    hp: 1000, dmg: 145, hitSpeed: 1.2, speed: SPEED.fast, range: 0.6, targets: 'ground', deployAnywhere: true,
    radius: 0.48, mass: 6, sprite: 'mole', roles: ['win', 'melee', 'mini-tank'], sound: 'stab' });

  def({ id: 'mountain_titan', name: 'Mountain Titan', type: 'troop', rarity: 'legendary', cost: 8, arena: 5,
    desc: 'A walking mountain that only targets buildings. Bursts into two Pebble Golems when destroyed.',
    hp: 6200, dmg: 290, hitSpeed: 2.5, speed: SPEED.slow, range: 0.8, targets: 'buildings',
    deathSpawn: { card: 'pebble_golem', count: 2 }, deathDamage: { dmg: 260, radius: 2 },
    radius: 0.95, mass: 30, size: 1.9, sprite: 'titan', roles: ['tank', 'win'], sound: 'punch' });

  // Token unit (not collectable) produced by Mountain Titan.
  def({ id: 'pebble_golem', name: 'Pebble Golem', type: 'troop', rarity: 'legendary', cost: 0, arena: 99, token: true,
    hp: 1250, dmg: 95, hitSpeed: 2.5, speed: SPEED.slow, range: 0.6, targets: 'buildings', deathDamage: { dmg: 100, radius: 1.5 },
    radius: 0.6, mass: 12, size: 1.15, sprite: 'pebble', deployTime: 0.3, roles: [], sound: 'punch' });

  // ======================= BUILDINGS =======================
  def({ id: 'bolt_turret', name: 'Bolt Turret', type: 'building', rarity: 'common', cost: 3, arena: 0,
    desc: 'A sturdy turret that fires heavy bolts at ground troops. Great at pulling big walkers.',
    hp: 900, dmg: 140, hitSpeed: 0.9, range: 5.5, targets: 'ground', lifetime: 30,
    radius: 0.9, mass: 100, projectile: { type: 'cannonball', speed: 13 }, sprite: 'turret', roles: ['building', 'defense'], sound: 'cannon' });

  def({ id: 'imp_den', name: 'Imp Den', type: 'building', rarity: 'rare', cost: 5, arena: 1,
    desc: 'A ramshackle hut that releases a Gremlin every 5 seconds.',
    hp: 1100, dmg: 0, hitSpeed: 0, range: 0, targets: 'none', lifetime: 40,
    spawner: { card: 'gremlin_gang', count: 1, interval: 5, onDeploy: true },
    radius: 1.0, mass: 100, sprite: 'den', roles: ['building', 'spawner'], sound: 'none' });

  def({ id: 'rune_trap', name: 'Rune Trap', type: 'building', rarity: 'epic', cost: 2, arena: 2,
    desc: 'An invisible rune. Explodes when an enemy ground troop steps on it, stunning everything nearby.',
    hp: 1, dmg: 260, hitSpeed: 0, range: 0, targets: 'ground', lifetime: 60, trap: { trigger: 1.0, radius: 2.2, stun: 2 },
    radius: 0.6, mass: 100, sprite: 'trap', deployTime: 0.5, roles: ['trap', 'defense'], sound: 'none' });

  def({ id: 'inferno_spire', name: 'Inferno Spire', type: 'building', rarity: 'rare', cost: 5, arena: 3,
    desc: 'Its beam heats up the longer it locks on. Melts even the biggest tanks.',
    hp: 1350, dmg: 28, hitSpeed: 0.4, range: 6, targets: 'both', lifetime: 40, ramp: [1, 4, 14], rampTime: [2, 4],
    radius: 0.9, mass: 100, sprite: 'inferno', roles: ['building', 'defense', 'anti-tank'], sound: 'beam' });

  def({ id: 'siege_ballista', name: 'Siege Ballista', type: 'building', rarity: 'epic', cost: 6, arena: 4,
    desc: 'Long-range bolt thrower. Planted near the river it can pick off enemy towers.',
    hp: 1150, dmg: 34, hitSpeed: 0.3, range: 11, targets: 'ground', lifetime: 40, deployTime: 3.5,
    radius: 0.9, mass: 100, projectile: { type: 'bolt', speed: 18 }, sprite: 'ballista', roles: ['building', 'win', 'siege'], sound: 'bow' });

  def({ id: 'elixir_well', name: 'Elixir Well', type: 'building', rarity: 'rare', cost: 6, arena: 4,
    desc: 'Pumps up 1 Elixir every 8.5 seconds. Pays for itself if left alone!',
    hp: 900, dmg: 0, hitSpeed: 0, range: 0, targets: 'none', lifetime: 70, elixirGen: { interval: 8.5 },
    radius: 0.9, mass: 100, sprite: 'well', roles: ['building', 'economy'], sound: 'none' });

  // ======================= SPELLS =======================
  def({ id: 'arrow_volley', name: 'Arrow Volley', type: 'spell', rarity: 'common', cost: 3, arena: 0,
    desc: 'Three waves of arrows rain on a wide area. Clears swarms of any kind.',
    dmg: 82, radius: 4, waves: 3, crownMul: 0.35, sprite: 'sp_arrows', roles: ['spell', 'small-spell'], sound: 'arrows' });

  def({ id: 'meteor', name: 'Meteor', type: 'spell', rarity: 'rare', cost: 4, arena: 0,
    desc: 'A blazing rock that smashes an area and knocks troops back.',
    dmg: 530, radius: 2.5, knockback: 1.2, crownMul: 0.35, travel: 9, sprite: 'sp_meteor', roles: ['spell', 'big-spell'], sound: 'explode' });

  def({ id: 'thunder_strike', name: 'Thunder Strike', type: 'spell', rarity: 'common', cost: 2, arena: 0,
    desc: 'An instant lightning bolt that damages and briefly stuns everything it hits.',
    dmg: 175, radius: 2.5, stun: 0.5, crownMul: 0.35, sprite: 'sp_thunder', roles: ['spell', 'small-spell', 'reset'], sound: 'zap' });

  def({ id: 'frost_mist', name: 'Frost Mist', type: 'spell', rarity: 'epic', cost: 3, arena: 1,
    desc: 'A freezing cloud that slows enemy movement and attacks by 45% for 5 seconds.',
    dmg: 40, radius: 3.2, duration: 5, slow: 0.45, crownMul: 0.35, sprite: 'sp_frost', roles: ['spell', 'control'], sound: 'frost' });

  def({ id: 'gale_blast', name: 'Gale Blast', type: 'spell', rarity: 'rare', cost: 2, arena: 2,
    desc: 'A rolling gust that sweeps forward, damaging and pushing back ground troops.',
    dmg: 210, length: 10, width: 3.8, knockback: 1.6, crownMul: 0.35, speed: 9, sprite: 'sp_gale', roles: ['spell', 'small-spell'], sound: 'wind' });

  def({ id: 'battle_cry', name: 'Battle Cry', type: 'spell', rarity: 'epic', cost: 2, arena: 2,
    desc: 'A rallying horn. Allies in the area move and attack 40% faster for 7 seconds.',
    dmg: 0, radius: 4, duration: 7, buff: 1.4, sprite: 'sp_rage', roles: ['spell', 'buff'], sound: 'horn' });

  def({ id: 'sky_lance', name: 'Sky Lance', type: 'spell', rarity: 'epic', cost: 6, arena: 4,
    desc: 'A colossal enchanted spear. Devastating damage to a small area.',
    dmg: 1300, radius: 2, crownMul: 0.35, travel: 6, sprite: 'sp_lance', roles: ['spell', 'big-spell'], sound: 'explode' });

  // ======================= TOWERS (not cards) =======================
  const TOWERS = {
    princess: { hp: 3000, dmg: 100, hitSpeed: 0.8, range: 7.5, radius: 1.5 },
    king: { hp: 4600, dmg: 120, hitSpeed: 1.0, range: 7, radius: 2.0 },
  };

  const levelMul = (level) => Math.pow(1.1, (level || 1) - 1);

  RR.Cards = {
    all: C,
    SPEED_NAME, RARITY, MAX_LEVEL, UPGRADE_CARDS, UPGRADE_GOLD, UPGRADE_XP, TOWERS,
    get: (id) => C[id],
    list: () => Object.values(C).filter((c) => !c.token),
    levelMul,
    stat: (card, key, level) => Math.round((card[key] || 0) * levelMul(level)),
    cardsToUpgrade: (card, level) => (level >= MAX_LEVEL ? Infinity : UPGRADE_CARDS[card.rarity][level - 1]),
    goldToUpgrade: (level) => (level >= MAX_LEVEL ? Infinity : UPGRADE_GOLD[level - 1]),
    xpForUpgrade: (level) => UPGRADE_XP[level - 1] || 0,
    typeName: (c) => (c.type === 'troop' ? 'Troop' : c.type === 'building' ? 'Building' : 'Spell'),
    starterDeck: ['iron_squire', 'longbow_twins', 'gremlin_gang', 'boulder_brute', 'bat_imps', 'bolt_turret', 'arrow_volley', 'meteor'],
  };
})(window.RR);
