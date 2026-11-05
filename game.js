/* =============================================================
   KINGDOM IDLE - GAME LOGIC              (Stage 6 + Military)
   -------------------------------------------------------------
   This file is split into numbered sections:

     1. CONFIGURATION   - numbers & data you can tweak
     2. GAME STATE      - everything that changes while playing
     3. PRODUCTION      - how resources are generated
     3a. POPULATION, RESEARCH & MILESTONES
     3b. COSTS & ACTIONS - building and upgrading
     3c. MILITARY       - barracks, knights, invasions, battles
     4. GAME LOOP       - time-based updates
     4b. SAVING         - localStorage, offline earnings
     5. NUMBER FORMAT   - turning 12345 into "12.3K"
     6. PIXEL ICONS     - tiny hand-made pixel art for the UI
     6b. UI ARTWORK     - parchment, wood, stone and frames painted in code
     7. USER INTERFACE  - resource bar, building panel, tabs
     7b. SOUND & MUSIC  - sound effects and music made in code
     7c. ARMY SCREEN    - barracks panel and the live battle window
     8. VILLAGE DRAWING - the pixel-art village on the canvas
     8b. BATTLE VIEW    - the battlefield canvas and unit sprites
     9. START THE GAME
   ============================================================= */

"use strict";


/* =============================================================
   1. CONFIGURATION
   ============================================================= */

// The four resources. "id" is used in code, "name" is shown to the player.
const RESOURCES = [
  { id: "food",  name: "Food"  },
  { id: "wood",  name: "Wood"  },
  { id: "stone", name: "Stone" },
  { id: "gold",  name: "Gold"  },
];

// Building types. Rates are written PER MINUTE because that is how the
// design document describes them; the code converts to per second.
//
//   produces         - the resource it makes (null = it does something else)
//   startingCount    - how many you own in a brand-new game
//   unlockPopulation - citizens needed before you can build it
//   buildCost        - price of your first newly built copy
//   upgradeBaseCost  - price of the FIRST upgrade (level 1 -> 2)
//   housing          - (houses) citizens each one holds
//   boosts           - (helpers) building types it makes more productive
//   boostPerBuilding - (helpers) bonus per copy, e.g. 0.05 = +5%
//   buildCostGrowth  - (optional) price growth per copy, instead of 25%
const BUILDING_TYPES = {
  farm: {
    name: "Farm",
    produces: "food",
    baseRatePerMinute: 10,
    description: "Golden wheat for hungry citizens.",
    startingCount: 1,
    buildCost: { wood: 50 },
    upgradeBaseCost: { wood: 60 },
  },
  lumberMill: {
    name: "Lumber Mill",
    produces: "wood",
    baseRatePerMinute: 8,
    description: "Saws timber from the nearby forest.",
    startingCount: 1,
    buildCost: { food: 50 },
    upgradeBaseCost: { food: 60 },
  },
  house: {
    name: "House",
    produces: null,
    housing: 5,
    description: "Cosy homes so more citizens can move in.",
    startingCount: 0,
    buildCost: { wood: 40 },
    upgradeBaseCost: { wood: 80, stone: 30 },
    buildCostGrowth: 1.12,
  },
  quarry: {
    name: "Quarry",
    produces: "stone",
    baseRatePerMinute: 5,
    description: "Cuts sturdy stone from the hillside.",
    startingCount: 0,
    unlockPopulation: 10,
    buildCost: { wood: 100 },
    upgradeBaseCost: { wood: 120, food: 40 },
  },
  market: {
    name: "Market",
    produces: "gold",
    baseRatePerMinute: 2,
    description: "Merchants trade goods for gold.",
    startingCount: 0,
    unlockPopulation: 25,
    buildCost: { wood: 100, stone: 50 },
    upgradeBaseCost: { wood: 120, stone: 60 },
  },
  blacksmith: {
    name: "Blacksmith",
    produces: null,
    boosts: ["lumberMill", "quarry"],
    boostPerBuilding: 0.05,
    description: "Forges sharp axes and picks for your workers.",
    startingCount: 0,
    unlockPopulation: 50,
    buildCost: { wood: 250, stone: 120 },
    upgradeBaseCost: { wood: 300, stone: 200 },
  },
  academy: {
    name: "Academy",
    produces: null,
    boosts: ["market"],
    boostPerBuilding: 0.1,
    description: "Scholars advise merchants and unlock advanced research.",
    startingCount: 0,
    unlockPopulation: 100,
    buildCost: { wood: 400, stone: 300, gold: 150 },
    upgradeBaseCost: { wood: 400, stone: 400, gold: 200 },
  },
};

// Each building level adds +15% production (compounding:
// level 2 = 115%, level 3 = 132%, level 4 = 152% ...).
const LEVEL_PRODUCTION_BONUS = 0.15;

// Each upgrade costs 25% more than the previous one.
const UPGRADE_COST_GROWTH = 1.25;

// Each extra copy of a building also costs 25% more than the last one,
// so you can't just spam the cheapest building forever.
const BUILD_COST_GROWTH = 1.25;

// Taxes: every citizen pays a tiny bit of gold per minute.
// This gives gold a trickle of income before Markets exist.
const TAX_GOLD_PER_CITIZEN_PER_MINUTE = 0.2;

// ---- Population ----
// The starting huts give room for this many citizens; houses add more.
const BASE_HOUSING = 10;
// When there is room and food, a new citizen arrives this often.
const SECONDS_PER_NEW_CITIZEN = 20;
// Food each new citizen needs to settle in: 5 + current population.
function getCitizenFoodCost(population) {
  return 5 + population;
}

// ---- Eras ----
const ERA_NAMES = ["", "The Settlement", "The Growing Town", "The Walled City", "The Kingdom", "The Empire"];
const ROMAN = ["", "I", "II", "III", "IV", "V"];

// ---- Kingdom milestones ----
// Reaching a population unlocks things. (Quarry comes before Market here,
// because markets cost stone, which only quarries produce.)
const MILESTONES = [
  { population: 10,  title: "Village",        reward: "Quarry unlocked" },
  { population: 25,  title: "Growing Town",   reward: "Market unlocked · Era II begins", era: 2 },
  { population: 50,  title: "Busy Town",      reward: "Blacksmith unlocked" },
  { population: 100, title: "Bustling Town",  reward: "Academy unlocked · advanced research" },
  { population: 250, title: "Proud City",     reward: "Castle Upgrade available" },
];

// ---- Castle upgrade (a one-time purchase) ----
const CASTLE_UPGRADE = {
  population: 250,
  cost: { wood: 3000, stone: 2500, gold: 1500 },
  productionBonus: 0.1,   // +10% to everything
};

// ---- Research ----
// requires: research ids or building ids (you need at least one built).
// Effects: `buildings` + `bonus` raise those buildings' production;
//          `taxBonus` raises gold from taxes.
const RESEARCH_BRANCHES = [
  { id: "agriculture", name: "Agriculture" },
  { id: "industry",    name: "Industry" },
  { id: "commerce",    name: "Commerce" },
];

const RESEARCH = [
  {
    id: "cropRotation", branch: "agriculture", name: "Crop Rotation",
    description: "Fields rest in turn, so the soil stays rich.",
    effectText: "+20% Farm production",
    cost: { gold: 30, food: 60 }, requires: [],
    buildings: ["farm"], bonus: 0.2,
  },
  {
    id: "improvedSeeds", branch: "agriculture", name: "Improved Seeds",
    description: "Scholars breed hardier grain with fuller ears.",
    effectText: "+30% Farm production",
    cost: { gold: 250, food: 500 }, requires: ["cropRotation", "academy"],
    buildings: ["farm"], bonus: 0.3,
  },
  {
    id: "betterTools", branch: "industry", name: "Better Tools",
    description: "Iron-headed axes and picks replace stone ones.",
    effectText: "+20% Lumber Mill and Quarry production",
    cost: { gold: 40, wood: 80 }, requires: [],
    buildings: ["lumberMill", "quarry"], bonus: 0.2,
  },
  {
    id: "efficientMachinery", branch: "industry", name: "Efficient Machinery",
    description: "Water-driven saws and stone cranes do the heavy lifting.",
    effectText: "+30% Lumber Mill and Quarry production",
    cost: { gold: 300, stone: 400 }, requires: ["betterTools", "academy"],
    buildings: ["lumberMill", "quarry"], bonus: 0.3,
  },
  {
    id: "tradeRoutes", branch: "commerce", name: "Trade Routes",
    description: "Caravans carry your goods to distant towns.",
    effectText: "+25% Market production",
    cost: { gold: 60, wood: 150 }, requires: ["market"],
    buildings: ["market"], bonus: 0.25,
  },
  {
    id: "betterTaxation", branch: "commerce", name: "Better Taxation",
    description: "Fair, well-kept ledgers mean every coin is collected.",
    effectText: "Taxes give twice as much gold",
    cost: { gold: 400 }, requires: ["tradeRoutes", "academy"],
    taxBonus: 1.0,
  },
];

// Player settings and their defaults (saved with the game).
const DEFAULT_SETTINGS = { sound: true, music: false };

// What a brand-new kingdom starts with.
const STARTING_RESOURCES = { food: 30, wood: 30, stone: 0, gold: 5 };
const STARTING_POPULATION = 5;

// How often (milliseconds) the game logic runs and the counters refresh.
// The amount produced does NOT depend on this number - see section 4.
const LOGIC_INTERVAL_MS = 200;

// ---- Saving & offline earnings ----
// The name the save is stored under in the browser's localStorage.
const SAVE_KEY = "kingdomIdle.save";
// If a save is damaged we keep a copy here instead of throwing it away.
const BROKEN_SAVE_KEY = "kingdomIdle.brokenSave";
// Save automatically this often (milliseconds).
const AUTOSAVE_INTERVAL_MS = 20000;
// The most time away that earns resources.
const OFFLINE_CAP_HOURS = 8;
// Gaps shorter than this count as normal play, not "being away".
const AWAY_THRESHOLD_SECONDS = 60;


// =============================================================
// ---- MILITARY SETTINGS ----
// Everything about knights, enemies and invasions lives here, so
// balancing the army means editing numbers in one place.
//   hp           - health points
//   attack       - damage per hit (before the target's defense)
//   defense      - damage blocked from every hit received
//   attackSpeed  - hits per second
//   moveSpeed    - battlefield pixels walked per second
//   range        - how close (pixels) a unit must be to hit
//   traits       - tags others can be strong against: "fast", "light", "armored"
//
// SPECIAL ABILITIES (optional):
//   aura: { attack, radius }        nearby allies deal +attack (0.25 = +25%) damage
//   protect: { reduction, radius }  nearby allies take less damage (0.2 = -20%)
//   heal: { amount, interval, radius }  heals the most hurt ally nearby
//   ranged: true                    shoots from a distance (shows arrows)
//   chargeMultiplier: 2.5           the first hit deals x2.5 damage
//   bonusVs: { fast: 1.5 }          x1.5 damage against units with that trait
//   support: true                   stays behind the front line
//   boss: true                      a boss (bigger, worth double rewards)
// =============================================================

const BARRACKS = {
  unlockPopulation: 100,
  buildCost: { wood: 300, stone: 200, gold: 100 },
  upgradeBaseCost: { wood: 400, stone: 300, gold: 150 },
  upgradeCostGrowth: 1.6,      // each barracks upgrade costs 60% more
  maxLevel: 10,
  baseCapacity: 5,             // army capacity = 5 + 5 per barracks level
  capacityPerLevel: 5,
  queueBase: 2,                // training slots = 2 + barracks level
};

const KNIGHT_TYPES = {
  swordsman: {
    name: "Swordsman",
    description: "A balanced, affordable frontline fighter.",
    abilityText: "No special ability - reliable in any army.",
    hp: 100, attack: 12, defense: 3, attackSpeed: 1.0, moveSpeed: 16, range: 9,
    cost: { food: 60, wood: 20, gold: 25 },
    trainSeconds: 30,
    barracksLevel: 1,          // barracks level needed to train it
  },
  guardian: {
    name: "Guardian",
    description: "A wall of steel with a tower shield. Hard to hurt, slow to kill.",
    abilityText: "Shield Wall: knights near a Guardian take 20% less damage.",
    hp: 190, attack: 6, defense: 8, attackSpeed: 0.8, moveSpeed: 12, range: 9,
    protect: { reduction: 0.2, radius: 28 },
    cost: { food: 80, wood: 40, stone: 40, gold: 30 },
    trainSeconds: 40,
    barracksLevel: 2,
  },
  ranger: {
    name: "Ranger",
    description: "A sharp-eyed archer who fights from behind the front line.",
    abilityText: "Longbow: shoots from far away. +40% damage against lightly armored enemies.",
    hp: 70, attack: 10, defense: 1, attackSpeed: 0.9, moveSpeed: 15, range: 70,
    ranged: true, bonusVs: { light: 1.4 },
    cost: { food: 70, wood: 50, gold: 35 },
    trainSeconds: 40,
    barracksLevel: 2,
  },
  cavalier: {
    name: "Cavalier",
    description: "A mounted knight who crashes into the enemy at full gallop.",
    abilityText: "Charge: first strike deals triple damage. +50% damage against fast enemies.",
    hp: 140, attack: 15, defense: 4, attackSpeed: 0.9, moveSpeed: 36, range: 10,
    chargeMultiplier: 3, bonusVs: { fast: 1.5 },
    cost: { food: 140, wood: 60, gold: 90 },
    trainSeconds: 55,
    barracksLevel: 3,
  },
  paladin: {
    name: "Paladin",
    description: "An elite holy knight in shining armor.",
    abilityText: "Blessing: heals the most wounded nearby knight for 10 health every 1.5 seconds.",
    hp: 230, attack: 20, defense: 6, attackSpeed: 0.9, moveSpeed: 15, range: 9,
    heal: { amount: 10, interval: 1.5, radius: 40 },
    cost: { food: 220, wood: 100, stone: 80, gold: 160 },
    trainSeconds: 90,
    barracksLevel: 5,
  },
};

// Front line first: this order decides where knights stand in battle.
const KNIGHT_FORMATION_ORDER = ["guardian", "cavalier", "swordsman", "paladin", "ranger"];

const ENEMY_CIVILIZATIONS = {
  barbarians: {
    name: "Barbarians",
    description: "Wild raiders from the northern hills. They come in great numbers and hit hard.",
  },
};

const ENEMY_TYPES = {
  raider: {
    name: "Raider", civilization: "barbarians",
    description: "Basic barbarian infantry with a hand axe.",
    hp: 70, attack: 9, defense: 1, attackSpeed: 1.0, moveSpeed: 18, range: 9,
    traits: ["light"],
  },
  berserker: {
    name: "Berserker", civilization: "barbarians",
    description: "Hits very hard, but wears no armor at all.",
    hp: 60, attack: 17, defense: 0, attackSpeed: 1.25, moveSpeed: 22, range: 9,
    traits: ["light"],
  },
  marauder: {
    name: "Marauder", civilization: "barbarians",
    description: "A quick raider in a wolf pelt who darts in with twin knives.",
    hp: 65, attack: 10, defense: 1, attackSpeed: 1.4, moveSpeed: 36, range: 9,
    traits: ["fast", "light"],
  },
  brute: {
    name: "Brute", civilization: "barbarians",
    description: "A giant with a tree-trunk club. Takes a lot of punishment.",
    hp: 240, attack: 15, defense: 4, attackSpeed: 0.65, moveSpeed: 11, range: 10,
    traits: ["armored"],
  },
  drummer: {
    name: "War Drummer", civilization: "barbarians",
    description: "Beats a war drum behind the lines.",
    abilityText: "War Drums: nearby barbarians deal 25% more damage.",
    hp: 80, attack: 5, defense: 1, attackSpeed: 0.8, moveSpeed: 14, range: 9,
    aura: { attack: 0.25, radius: 40 }, support: true,
    traits: ["light"],
  },
  chieftain: {
    name: "Chieftain", civilization: "barbarians",
    description: "The horned warlord of the northern clans. A boss!",
    abilityText: "Warlord: nearby barbarians deal 15% more damage. Appears every 5th wave.",
    hp: 750, attack: 30, defense: 6, attackSpeed: 0.8, moveSpeed: 14, range: 11,
    aura: { attack: 0.15, radius: 50 }, boss: true,
    traits: ["armored"],
  },
};

const INVASION = {
  firstDelaySeconds: 600,      // the first raid comes 10 minutes after the barracks is built
  intervalSeconds: 1200,       // then one raid every 20 minutes
  warningSeconds: 120,         // warning banner in the last 2 minutes
  maxOfflineBattles: 3,        // at most this many raids are fought while you're away
  battleTimeLimit: 60,         // after 60 seconds the side with more health left wins
  statGrowthPerWave: 0.08,     // enemies get 8% stronger every wave
  woundedHealSeconds: 20,      // one wounded knight recovers this often
};

// Which enemies attack in a given wave. New enemy types join as the
// waves grow, and every 5th wave the Chieftain leads the raid.
// (Listed front line first: this is also their battle formation.)
function getWaveEnemies(wave) {
  return [
    { type: "brute",     count: wave >= 4 ? Math.floor((wave - 1) / 3) : 0 },
    { type: "raider",    count: 2 + Math.ceil(wave * 0.6) },
    { type: "berserker", count: Math.floor(wave / 2) },
    { type: "marauder",  count: wave >= 3 ? Math.floor((wave - 1) / 2) : 0 },
    { type: "chieftain", count: isBossWave(wave) ? 1 : 0 },
    { type: "drummer",   count: wave >= 6 ? 1 + Math.floor((wave - 6) / 4) : 0 },
  ].filter(group => group.count > 0);
}

function isBossWave(wave) {
  return wave % 5 === 0;
}

// Loot for winning, and the repair bill for losing.
function getWaveRewards(wave) {
  const boss = isBossWave(wave) ? 2 : 1;      // boss raids pay double
  return { gold: Math.round(30 * Math.pow(wave, 1.2)) * boss, food: 50 * wave * boss };
}
function getWaveRepairs(wave) {
  return { wood: 80 * wave, stone: 50 * wave };
}


/* =============================================================
   2. GAME STATE
   -------------------------------------------------------------
   All data that changes during play lives in one object called
   `state`. Keeping it in one place makes saving (Stage 3) easy:
   we will simply store this object in localStorage.
   ============================================================= */

function createNewGameState() {
  return {
    version: 1,                                  // helps future save upgrades
    resources: { ...STARTING_RESOURCES },        // copy, don't share
    population: STARTING_POPULATION,
    populationProgress: 0,    // 0..1, how close the next citizen is to arriving
    castleLevel: 1,           // 2 after the Castle Upgrade
    military: createMilitaryState(),
    // One entry per building type, e.g. farm: { count: 1, level: 1 }
    //   count = how many of this building you own
    //   level = upgrade level (shared by all buildings of that type,
    //           so one upgrade improves every farm at once)
    buildings: createStartingBuildings(),
    era: 1,
    // Empty for now - filled in by later stages. Saving them already
    // means old saves keep working when those features arrive.
    research: {},
    unlocked: {},
    settings: { ...DEFAULT_SETTINGS },
    lastUpdate: Date.now(),   // real-world time (ms) production was last added
    lastSaved: 0,             // real-world time (ms) of the last save
  };
}

// Builds { farm: {count, level}, lumberMill: {...}, ... } from BUILDING_TYPES,
// so adding a new building type only requires editing the config.
function createStartingBuildings() {
  const buildings = {};
  for (const typeId in BUILDING_TYPES) {
    buildings[typeId] = { count: BUILDING_TYPES[typeId].startingCount, level: 1 };
  }
  return buildings;
}

let state = createNewGameState();


/* =============================================================
   3. PRODUCTION
   ============================================================= */

// Production per second for a building type with a given number of
// copies and a given level. Used for current output AND for previews
// ("what would I get with one more farm / one more level?").
function calculateRatePerSecond(typeId, count, level) {
  const type = BUILDING_TYPES[typeId];
  if (!type || !type.produces || count <= 0) return 0;

  // Level 1 = 100%, level 2 = 115%, level 3 = 132.25%, ...
  const levelMultiplier = Math.pow(1 + LEVEL_PRODUCTION_BONUS, level - 1);
  const perMinute = type.baseRatePerMinute * count * levelMultiplier * getProductionMultiplier(typeId);
  return perMinute / 60;
}

// Bonus from a helper building (Blacksmith, Academy), e.g. 0.1 = +10%.
// Each copy gives boostPerBuilding, and each level adds 15% of that.
// (It grows in a straight line on purpose: if helpers ALSO grew by
// x1.15 per level, they would multiply with the boosted building's
// own x1.15 per level and the economy would run away to infinity.)
function calculateBoost(typeId, count, level) {
  const type = BUILDING_TYPES[typeId];
  if (!type.boostPerBuilding || count <= 0) return 0;
  return type.boostPerBuilding * count * (1 + LEVEL_PRODUCTION_BONUS * (level - 1));
}

// All bonuses for one building type added together: research, helper
// buildings and the castle. 1.0 = no bonus, 1.45 = +45%.
function getProductionMultiplier(typeId) {
  let bonus = 0;
  for (const tech of RESEARCH) {
    if (state.research[tech.id] && tech.buildings && tech.buildings.includes(typeId)) bonus += tech.bonus;
  }
  for (const helperId in BUILDING_TYPES) {
    const helper = BUILDING_TYPES[helperId];
    if (helper.boosts && helper.boosts.includes(typeId)) {
      const owned = state.buildings[helperId];
      bonus += calculateBoost(helperId, owned.count, owned.level);
    }
  }
  if (state.castleLevel >= 2) bonus += CASTLE_UPGRADE.productionBonus;
  return 1 + bonus;
}

// Gold from taxes gets its own multiplier (Better Taxation, castle).
function getTaxMultiplier() {
  let bonus = 0;
  for (const tech of RESEARCH) {
    if (state.research[tech.id] && tech.taxBonus) bonus += tech.taxBonus;
  }
  if (state.castleLevel >= 2) bonus += CASTLE_UPGRADE.productionBonus;
  return 1 + bonus;
}

// How much a building type produces right now, per second.
function getBuildingRatePerSecond(typeId) {
  const owned = state.buildings[typeId];
  return calculateRatePerSecond(typeId, owned.count, owned.level);
}

// Extra production per second from building ONE more copy.
function getBuildGainPerSecond(typeId) {
  const owned = state.buildings[typeId];
  return calculateRatePerSecond(typeId, owned.count + 1, owned.level) - getBuildingRatePerSecond(typeId);
}

// Extra production per second from upgrading ONE level.
function getUpgradeGainPerSecond(typeId) {
  const owned = state.buildings[typeId];
  return calculateRatePerSecond(typeId, owned.count, owned.level + 1) - getBuildingRatePerSecond(typeId);
}

// Adds up every source of income and returns, for example:
//   { food: 0.1667, wood: 0.1333, stone: 0, gold: 0.0083 }
function getProductionPerSecond() {
  const rates = {};
  for (const res of RESOURCES) rates[res.id] = 0;

  // Buildings
  for (const typeId in BUILDING_TYPES) {
    const resourceId = BUILDING_TYPES[typeId].produces;
    if (resourceId) rates[resourceId] += getBuildingRatePerSecond(typeId);
  }

  // Taxes
  rates.gold += (state.population * TAX_GOLD_PER_CITIZEN_PER_MINUTE * getTaxMultiplier()) / 60;

  return rates;
}

// Gives the player everything produced during `seconds` seconds.
// Because income is a steady rate, 10 minutes at once gives exactly
// the same result as 3000 tiny 0.2-second steps.
function applyProduction(seconds) {
  if (seconds <= 0) return;
  const rates = getProductionPerSecond();
  for (const res of RESOURCES) {
    state.resources[res.id] += rates[res.id] * seconds;
  }
  growPopulation(seconds);
  advanceMilitary(seconds);
}


/* =============================================================
   3a. POPULATION, RESEARCH & MILESTONES
   ============================================================= */

// Citizens that one type of housing holds (houses get +15% per level).
function calculateHousing(count, level) {
  return Math.floor(count * BUILDING_TYPES.house.housing * Math.pow(1 + LEVEL_PRODUCTION_BONUS, level - 1));
}

// Total room for citizens.
function getHousingCapacity() {
  const houses = state.buildings.house;
  return BASE_HOUSING + calculateHousing(houses.count, houses.level);
}

// Why the population is or isn't growing (shown under the counter).
function getGrowthStatus() {
  if (state.population >= getHousingCapacity()) return "needs houses";
  if (state.resources.food < getCitizenFoodCost(state.population)) return "needs food";
  return "growing";
}

// New citizens arrive over time while there is room and food.
// populationProgress fills from 0 to 1; each time it is full, one
// citizen moves in and pays their food cost. If there's no room or
// food, progress waits at "full" until there is.
function growPopulation(seconds) {
  let progress = state.populationProgress + seconds / SECONDS_PER_NEW_CITIZEN;
  const capacity = getHousingCapacity();
  while (progress >= 1 && state.population < capacity) {
    const cost = getCitizenFoodCost(state.population);
    if (state.resources.food < cost) break;
    state.resources.food -= cost;
    state.population += 1;
    progress -= 1;
  }
  state.populationProgress = Math.min(progress, 1);
  checkMilestones();
}

// True once a building may be built.
function isBuildingUnlocked(typeId) {
  const type = BUILDING_TYPES[typeId];
  if (!type.unlockPopulation) return true;
  return state.unlocked[typeId] === true || state.buildings[typeId].count > 0 ||
    state.population >= type.unlockPopulation;
}

// Records newly reached milestones and building unlocks (only once each).
function checkMilestones() {
  for (const typeId in BUILDING_TYPES) {
    const type = BUILDING_TYPES[typeId];
    if (type.unlockPopulation && !state.unlocked[typeId] && state.population >= type.unlockPopulation) {
      state.unlocked[typeId] = true;
      if (uiReady) announce("New building unlocked", type.name, type.description, renderBuildingArt(typeId));
    }
  }
  for (const m of MILESTONES) {
    const key = "milestone" + m.population;
    if (!state.unlocked[key] && state.population >= m.population) {
      state.unlocked[key] = true;
      if (m.era) state.era = Math.max(state.era, m.era);
      if (uiReady) announce("Milestone reached", m.title, m.reward, createPixelIcon("crown"));
      playSound("milestone");
    }
  }
}

// Shows a message if the page is ready (it may not be while loading).
function notify(message) {
  if (typeof showToast === "function" && document.getElementById("toast")) showToast(message);
}

// Is a single research requirement met? (a research id or a building id)
function isRequirementMet(req) {
  if (BUILDING_TYPES[req]) return state.buildings[req].count > 0;
  return state.research[req] === true;
}

function getRequirementLabel(req) {
  if (BUILDING_TYPES[req]) return `Build a${/^[AEIOU]/.test(BUILDING_TYPES[req].name) ? "n" : ""} ${BUILDING_TYPES[req].name}`;
  const tech = RESEARCH.find(t => t.id === req);
  return tech ? tech.name : req;
}

// "done", "available" or "locked"
function getResearchStatus(tech) {
  if (state.research[tech.id]) return "done";
  return tech.requires.every(isRequirementMet) ? "available" : "locked";
}

// Called by a research button.
function researchTech(techId) {
  updateGame();
  const tech = RESEARCH.find(t => t.id === techId);
  if (!tech || getResearchStatus(tech) !== "available" || !canAfford(tech.cost)) return false;
  spendResources(tech.cost);
  state.research[tech.id] = true;
  playSound("research");
  announce("Discovery", tech.name, tech.effectText, createPixelIcon(tech.id));
  const el = researchCardElements[tech.id];
  if (el) { bumpElement(el.card, "just-done"); bumpElement(el.badge, "stamp"); }
  refreshUI();
  return true;
}

// Called by the Castle Upgrade button.
function upgradeCastle() {
  updateGame();
  if (state.castleLevel >= 2 || state.population < CASTLE_UPGRADE.population || !canAfford(CASTLE_UPGRADE.cost)) return false;
  spendResources(CASTLE_UPGRADE.cost);
  state.castleLevel = 2;
  markVillageDirty();
  requestVillageBurst("castle", "upgrade");
  playSound("milestone");
  announce("Royal decree", "A Mighty Castle", "Every building and your taxes now produce 10% more.", createPixelIcon("crest"));
  refreshUI();
  return true;
}


/* =============================================================
   3b. COSTS & ACTIONS
   -------------------------------------------------------------
   A "cost" is an object like { wood: 100, stone: 50 }.
   ============================================================= */

// Multiplies every resource in a cost and rounds UP to whole numbers,
// so the price shown is always exactly the price paid.
function scaleCost(baseCost, multiplier) {
  const cost = {};
  for (const resourceId in baseCost) {
    cost[resourceId] = Math.ceil(baseCost[resourceId] * multiplier);
  }
  return cost;
}

// Price of the next copy of a building.
// Example (Farm): 2nd farm = 50 wood, 3rd = 63, 4th = 79 ...
function getBuildCost(typeId) {
  const type = BUILDING_TYPES[typeId];
  const extraCopies = Math.max(0, state.buildings[typeId].count - type.startingCount);
  const growth = type.buildCostGrowth || BUILD_COST_GROWTH;
  return scaleCost(type.buildCost, Math.pow(growth, extraCopies));
}

// Price of the next upgrade.
// Example (1 Farm): Lv1->2 = 60 wood, Lv2->3 = 75, Lv3->4 = 94 ...
// An upgrade improves EVERY copy you own, so it is priced per copy:
// upgrading 3 farms costs 3 times as much as upgrading 1.
function getUpgradeCost(typeId) {
  const type = BUILDING_TYPES[typeId];
  const owned = state.buildings[typeId];
  const copies = Math.max(1, owned.count);
  return scaleCost(type.upgradeBaseCost, Math.pow(UPGRADE_COST_GROWTH, owned.level - 1) * copies);
}

// True if the player has enough of every resource in the cost.
function canAfford(cost) {
  for (const resourceId in cost) {
    if (state.resources[resourceId] < cost[resourceId]) return false;
  }
  return true;
}

// Removes the cost from the player's resources.
function spendResources(cost) {
  for (const resourceId in cost) {
    state.resources[resourceId] -= cost[resourceId];
  }
}

// Visual "level tier" of a building: 0 (Lv 1-2), 1 (Lv 3-5), 2 (Lv 6-9), 3 (Lv 10+).
// Buildings look grander in the village and the catalog at each tier.
function getBuildingTier(typeId) {
  const level = typeId === "barracks" ? state.military.barracksLevel : state.buildings[typeId].level;
  return level >= 10 ? 3 : level >= 6 ? 2 : level >= 3 ? 1 : 0;
}

function bumpCard(typeId) {
  const el = typeof buildingCardElements !== "undefined" && buildingCardElements[typeId];
  if (el) bumpElement(el.card);
}

// Called by the "Build" button. Returns true if it worked.
function buildBuilding(typeId) {
  updateGame(); // bank all production up to this exact moment first
  const cost = getBuildCost(typeId);
  if (!isBuildingUnlocked(typeId) || !canAfford(cost)) return false;

  spendResources(cost);
  state.buildings[typeId].count += 1;
  markVillageDirty();   // a new building appears in the village
  bumpCard(typeId);
  requestVillageBurst(typeId, "build");
  playSound("build");
  refreshUI();
  return true;
}

// Called by the "Upgrade" button. You must own at least one copy.
function upgradeBuilding(typeId) {
  updateGame();
  const owned = state.buildings[typeId];
  const cost = getUpgradeCost(typeId);
  if (owned.count <= 0 || !canAfford(cost)) return false;

  spendResources(cost);
  owned.level += 1;
  markVillageDirty();   // the building may now look grander
  bumpCard(typeId);
  requestVillageBurst(typeId, "upgrade");
  playSound("upgrade");
  refreshUI();
  return true;
}


/* =============================================================
   3c. MILITARY: BARRACKS, KNIGHTS AND INVASIONS
   -------------------------------------------------------------
   The army is stored as simple counts:
       state.military.army    = { swordsman: 6 }
       state.military.wounded = { swordsman: 2 }
   Training and healing use the same "how many seconds passed?"
   idea as production, so they also continue while you're away.

   BATTLES are simulated in small fixed steps of 0.05 seconds.
   The same code is used whether you watch the battle or it
   happens while you're away, and the "random" damage uses a
   seeded generator - so watching, skipping or being offline
   always gives exactly the same result.
   ============================================================= */

function createMilitaryState() {
  const army = {}, wounded = {};
  for (const typeId in KNIGHT_TYPES) { army[typeId] = 0; wounded[typeId] = 0; }
  return {
    barracksLevel: 0,                         // 0 = not built yet
    army,
    wounded,
    healProgress: 0,                          // 0..1 toward the next healed knight
    training: { queue: [], progress: 0 },     // queue of knight type ids
    invasion: { wave: 1, nextAt: 0 },         // nextAt = real time (ms) of the next raid
    experience: 0,
    battlesWon: 0,
    battlesLost: 0,
    totalTrained: 0,
    log: [],                                  // recent battle summaries
  };
}

function countKnights(group) {
  let total = 0;
  for (const typeId in group) total += group[typeId];
  return total;
}

function getArmyCapacity() {
  const level = state.military.barracksLevel;
  return level > 0 ? BARRACKS.baseCapacity + BARRACKS.capacityPerLevel * level : 0;
}

function getQueueSize() {
  return BARRACKS.queueBase + state.military.barracksLevel;
}

// Free places in the army (wounded and queued knights take a place).
function getKnightSpace() {
  const m = state.military;
  return getArmyCapacity() - countKnights(m.army) - countKnights(m.wounded) - m.training.queue.length;
}

function isBarracksUnlocked() {
  return state.military.barracksLevel > 0 || state.population >= BARRACKS.unlockPopulation;
}

function getBarracksUpgradeCost() {
  return scaleCost(BARRACKS.upgradeBaseCost, Math.pow(BARRACKS.upgradeCostGrowth, state.military.barracksLevel - 1));
}

function isKnightTypeUnlocked(typeId) {
  return state.military.barracksLevel >= KNIGHT_TYPES[typeId].barracksLevel;
}

function buildBarracks() {
  updateGame();
  const m = state.military;
  if (m.barracksLevel > 0 || !isBarracksUnlocked() || !canAfford(BARRACKS.buildCost)) return false;
  spendResources(BARRACKS.buildCost);
  m.barracksLevel = 1;
  m.invasion.nextAt = Date.now() + INVASION.firstDelaySeconds * 1000;   // time to prepare
  markVillageDirty();
  requestVillageBurst("barracks", "build");
  playSound("build");
  announce("New building", "Knight Barracks", "Train knights here. Scouts warn of barbarians in the hills...", renderBuildingArt("barracks"));
  refreshUI();
  return true;
}

function upgradeBarracks() {
  updateGame();
  const m = state.military;
  const cost = getBarracksUpgradeCost();
  if (m.barracksLevel < 1 || m.barracksLevel >= BARRACKS.maxLevel || !canAfford(cost)) return false;
  spendResources(cost);
  m.barracksLevel += 1;
  requestVillageBurst("barracks", "upgrade");
  playSound("upgrade");
  refreshUI();
  return true;
}

// Pays for a knight and adds it to the training queue.
function recruitKnight(typeId) {
  updateGame();
  const m = state.military;
  const type = KNIGHT_TYPES[typeId];
  if (!type || m.barracksLevel < 1 || !isKnightTypeUnlocked(typeId)) return false;
  if (m.training.queue.length >= getQueueSize() || getKnightSpace() <= 0 || !canAfford(type.cost)) return false;
  spendResources(type.cost);
  m.training.queue.push(typeId);
  playSound("click");
  refreshUI();
  return true;
}

// Training and healing move forward by `seconds` (also while away).
// Called from applyProduction().
function advanceMilitary(seconds) {
  const m = state.military;
  if (m.barracksLevel < 1) return;

  // Knights are trained one at a time, in order.
  let time = seconds;
  while (time > 0 && m.training.queue.length > 0) {
    const needed = KNIGHT_TYPES[m.training.queue[0]].trainSeconds - m.training.progress;
    if (time >= needed) {
      time -= needed;
      m.training.progress = 0;
      m.army[m.training.queue.shift()] += 1;
      m.totalTrained += 1;
    } else {
      m.training.progress += time;
      time = 0;
    }
  }

  // Wounded knights recover one by one.
  let heal = m.healProgress + seconds / INVASION.woundedHealSeconds;
  while (heal >= 1 && countKnights(m.wounded) > 0) {
    const typeId = Object.keys(m.wounded).find(id => m.wounded[id] > 0);
    m.wounded[typeId] -= 1;
    m.army[typeId] += 1;
    heal -= 1;
  }
  m.healProgress = countKnights(m.wounded) > 0 ? heal : 0;
}

// Enemy stats grow a little stronger every wave.
function getEnemyStats(typeId, wave) {
  const t = ENEMY_TYPES[typeId];
  const k = 1 + INVASION.statGrowthPerWave * (wave - 1);
  return { ...t, hp: Math.round(t.hp * k), attack: t.attack * k };
}

function getSecondsUntilInvasion() {
  return (state.military.invasion.nextAt - Date.now()) / 1000;
}


// ---------- The battle simulation ----------

const BATTLE_STEP = 0.05;                 // seconds per simulation step
const BATTLE_FIELD = { top: 58, bottom: 150 };

function makeUnit(side, typeId, stats, x, y) {
  return {
    side, typeId, x, y,
    maxHp: stats.hp, hp: stats.hp,
    attack: stats.attack, defense: stats.defense,
    attackSpeed: stats.attackSpeed, moveSpeed: stats.moveSpeed, range: stats.range,
    traits: stats.traits || [],
    // special abilities (undefined when the unit has none)
    aura: stats.aura, protect: stats.protect, heal: stats.heal, ranged: stats.ranged,
    chargeMultiplier: stats.chargeMultiplier, bonusVs: stats.bonusVs, support: stats.support, boss: stats.boss,
    hasCharged: false, healTimer: stats.heal ? stats.heal.interval : 0,
    attackBoost: 0, protection: 0,
    cooldown: 0.4, target: null, alive: true, facing: side === "knight" ? 1 : -1,
    flash: 0, lunge: 0, moving: false, deathTime: 0,
  };
}

// Places units in a formation: columns of 8, going back from the front line.
function formationPosition(index, frontX, direction) {
  const column = Math.floor(index / 8), row = index % 8;
  return [frontX - direction * column * 7, BATTLE_FIELD.top + 6 + row * 11 + (column % 2) * 5];
}

// Sets up a battle between the current army and the next wave.
function createBattle() {
  const m = state.military;
  const wave = m.invasion.wave;
  const units = [];
  let i = 0;
  for (const typeId of KNIGHT_FORMATION_ORDER) {
    for (let k = 0; k < m.army[typeId]; k++) {
      const [x, y] = formationPosition(i++, 60, 1);
      units.push(makeUnit("knight", typeId, KNIGHT_TYPES[typeId], x, y));
    }
  }
  let j = 0;
  for (const group of getWaveEnemies(wave)) {
    for (let k = 0; k < group.count; k++) {
      const [x, y] = formationPosition(j++, 262, -1);
      units.push(makeUnit("enemy", group.type, getEnemyStats(group.type, wave), x, y));
    }
  }
  return {
    wave, units, time: 0, over: false, victory: false, timedOut: false,
    rng: makeRandom(wave * 7919 + i * 131 + 17),
    effects: [], hits: 0, resultApplied: false,
  };
}

function nearestFoe(battle, unit) {
  let best = null, bestDistance = Infinity;
  for (const other of battle.units) {
    if (!other.alive || other.side === unit.side) continue;
    const d = (other.x - unit.x) ** 2 + (other.y - unit.y) ** 2;
    if (d < bestDistance) { bestDistance = d; best = other; }
  }
  return best;
}

// One attack. Damage = attack (with bonuses) minus the target's defense,
// times a small random spread, reduced by any Guardian protection.
function strike(battle, attacker, target) {
  let power = attacker.attack * (1 + attacker.attackBoost);
  if (attacker.chargeMultiplier && !attacker.hasCharged) {
    power *= attacker.chargeMultiplier;          // the first hit of a charge
    attacker.hasCharged = true;
  }
  if (attacker.bonusVs) {
    for (const trait of target.traits) if (attacker.bonusVs[trait]) power *= attacker.bonusVs[trait];
  }
  const variance = 0.85 + battle.rng() * 0.3;
  const damage = Math.max(1, Math.round((power - target.defense) * variance * (1 - target.protection)));
  target.hp -= damage;
  target.flash = 0.12;
  attacker.lunge = 0.15;
  attacker.cooldown = 1 / attacker.attackSpeed;
  battle.hits += 1;
  if (attacker.ranged) {
    battle.effects.push({ arrow: true, x1: attacker.x, y1: attacker.y - 8, x2: target.x, y2: target.y - 7, age: 0 });
  }
  battle.effects.push({ x: target.x, y: target.y - 15, value: damage, age: 0, side: target.side });
  if (battle.effects.length > 80) battle.effects.shift();
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    target.deathTime = battle.time;
  }
}

// Works out aura bonuses for this step: War Drums / Warlord (+damage)
// and Shield Wall (-damage taken). The strongest nearby aura counts.
function applyAuras(alive) {
  for (const u of alive) { u.attackBoost = 0; u.protection = 0; }
  for (const source of alive) {
    if (!source.aura && !source.protect) continue;
    for (const u of alive) {
      if (u.side !== source.side) continue;
      const d2 = (u.x - source.x) ** 2 + (u.y - source.y) ** 2;
      if (source.aura && u !== source && d2 <= source.aura.radius ** 2) {
        u.attackBoost = Math.max(u.attackBoost, source.aura.attack);
      }
      if (source.protect && d2 <= source.protect.radius ** 2) {
        u.protection = Math.max(u.protection, source.protect.reduction);
      }
    }
  }
}

// Paladin Blessing: heal the most hurt ally in range.
function tryHeal(battle, healer, alive, dt) {
  healer.healTimer -= dt;
  if (healer.healTimer > 0) return;
  let best = null, bestRatio = 1;
  for (const u of alive) {
    if (u.side !== healer.side || u.hp >= u.maxHp) continue;
    if ((u.x - healer.x) ** 2 + (u.y - healer.y) ** 2 > healer.heal.radius ** 2) continue;
    const ratio = u.hp / u.maxHp;
    if (ratio < bestRatio) { bestRatio = ratio; best = u; }
  }
  if (!best) { healer.healTimer = 0.2; return; }
  const amount = Math.min(healer.heal.amount, best.maxHp - best.hp);
  best.hp += amount;
  healer.healTimer = healer.heal.interval;
  battle.effects.push({ x: best.x, y: best.y - 15, value: Math.round(amount), age: 0, heal: true });
}

// Moves the battle forward by one small step.
// Each unit picks the nearest enemy, walks toward it, and attacks
// whenever it is in range and its attack has recharged.
function stepBattle(battle, dt) {
  if (battle.over) return;
  battle.time += dt;
  applyAuras(battle.units.filter(u => u.alive));
  for (const u of battle.units) {
    u.flash = Math.max(0, u.flash - dt);
    u.lunge = Math.max(0, u.lunge - dt);
    if (!u.alive) continue;
    u.cooldown -= dt;
    if (u.heal) tryHeal(battle, u, battle.units.filter(o => o.alive), dt);
    if (!u.target || !u.target.alive) u.target = nearestFoe(battle, u);
    const t = u.target;
    if (!t) { u.moving = false; continue; }
    const dx = t.x - u.x, dy = t.y - u.y;
    const distance = Math.hypot(dx, dy) || 0.001;
    u.facing = dx >= 0 ? 1 : -1;
    // Support units (drummers) hang back instead of charging in
    const holdDistance = u.support ? Math.max(u.range, 34) : u.range;
    if (distance > holdDistance) {
      const move = Math.min(distance - holdDistance, u.moveSpeed * dt);
      u.x += (dx / distance) * move;
      u.y += (dy / distance) * move;
      u.moving = true;
    } else {
      u.moving = false;
      if (distance <= u.range && u.cooldown <= 0) strike(battle, u, t);
    }
  }

  // Gently push apart units that stand inside each other
  const alive = battle.units.filter(u => u.alive);
  for (let a = 0; a < alive.length; a++) {
    for (let b = a + 1; b < alive.length; b++) {
      const p = alive[a], q = alive[b];
      const dx = q.x - p.x, dy = q.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 36 && d2 > 0.0001) {
        const d = Math.sqrt(d2), push = (6 - d) / 2;
        p.x -= (dx / d) * push; p.y -= (dy / d) * push;
        q.x += (dx / d) * push; q.y += (dy / d) * push;
      }
    }
  }
  for (const u of alive) u.y = Math.max(BATTLE_FIELD.top, Math.min(BATTLE_FIELD.bottom, u.y));

  // Is the battle over?
  const knightsLeft = alive.some(u => u.side === "knight");
  const enemiesLeft = alive.some(u => u.side === "enemy");
  if (!enemiesLeft) { battle.over = true; battle.victory = true; }
  else if (!knightsLeft) { battle.over = true; battle.victory = false; }
  else if (battle.time >= INVASION.battleTimeLimit) {
    // Time's up: the side with more of its health left holds the field
    const healthLeft = side => {
      const team = battle.units.filter(u => u.side === side);
      return team.reduce((sum, u) => sum + u.hp, 0) / team.reduce((sum, u) => sum + u.maxHp, 0);
    };
    battle.over = true;
    battle.timedOut = true;
    battle.victory = healthLeft("knight") >= healthLeft("enemy");
  }
}

function runBattleToEnd(battle) {
  while (!battle.over) stepBattle(battle, BATTLE_STEP);
}

// Applies a finished battle to the kingdom and returns a summary.
// Fallen knights are WOUNDED, not lost: they recover over time.
function applyBattleResult(battle) {
  const m = state.military;
  battle.resultApplied = true;
  const fallen = {};
  let knightsStart = 0, knightsSurviving = 0, enemiesTotal = 0, enemiesDefeated = 0;
  for (const u of battle.units) {
    if (u.side === "knight") {
      knightsStart++;
      if (u.alive) knightsSurviving++;
      else fallen[u.typeId] = (fallen[u.typeId] || 0) + 1;
    } else {
      enemiesTotal++;
      if (!u.alive) enemiesDefeated++;
    }
  }
  for (const typeId in fallen) {
    const lost = Math.min(fallen[typeId], m.army[typeId]);
    m.army[typeId] -= lost;
    m.wounded[typeId] += lost;
  }

  const summary = {
    time: Date.now(), wave: battle.wave, civilization: "Barbarians",
    victory: battle.victory, timedOut: battle.timedOut,
    knightsStart, knightsSurviving, wounded: knightsStart - knightsSurviving,
    enemiesTotal, enemiesDefeated, rewards: {}, repairs: {}, experience: 0,
  };

  if (battle.victory) {
    summary.rewards = getWaveRewards(battle.wave);
    for (const id in summary.rewards) state.resources[id] += summary.rewards[id];
    m.battlesWon += 1;
    m.invasion.wave += 1;                       // the next wave is stronger
  } else {
    // Temporary repairs: never more than 20% of what you have stored
    const bill = getWaveRepairs(battle.wave);
    for (const id in bill) {
      const paid = Math.floor(Math.min(bill[id], state.resources[id] * 0.2));
      state.resources[id] -= paid;
      summary.repairs[id] = paid;
    }
    m.battlesLost += 1;                         // the same wave tries again
  }
  summary.experience = Math.round(enemiesDefeated * 10 * (1 + 0.1 * (battle.wave - 1)) * (battle.victory ? 1 : 0.5));
  m.experience += summary.experience;
  m.invasion.nextAt = Date.now() + INVASION.intervalSeconds * 1000;
  m.log.unshift(summary);
  m.log = m.log.slice(0, 8);
  return summary;
}

// Checks whether a raid is due. While you're away it is fought
// instantly (at most INVASION.maxOfflineBattles of them); while
// you're watching, the battle plays on screen.
function processInvasions(isAway) {
  const m = state.military;
  if (m.barracksLevel < 1 || currentBattle) return [];
  const now = Date.now();
  if (now < m.invasion.nextAt) return [];

  if (isAway) {
    const due = 1 + Math.floor((now - m.invasion.nextAt) / (INVASION.intervalSeconds * 1000));
    const results = [];
    for (let i = 0; i < Math.min(due, INVASION.maxOfflineBattles); i++) {
      const battle = createBattle();
      runBattleToEnd(battle);
      results.push(applyBattleResult(battle));
    }
    return results;
  }
  if (uiReady && !document.hidden && !isModalOpen()) startLiveBattle();
  return [];
}


/* =============================================================
   4. GAME LOOP
   -------------------------------------------------------------
   KEY IDEA: we never assume a timer fires on time.
   Browsers slow down or pause timers in background tabs. So
   every update we look at the real clock, measure how many
   seconds passed since `state.lastUpdate`, and produce exactly
   that much. If the tab slept for 5 minutes, the next update
   simply sees "300 seconds passed" and catches up instantly.
   ============================================================= */

function updateGame() {
  const now = Date.now();
  let elapsedSeconds = (now - state.lastUpdate) / 1000;

  // If the computer clock was moved backwards, don't subtract resources.
  if (elapsedSeconds < 0) elapsedSeconds = 0;

  if (elapsedSeconds >= AWAY_THRESHOLD_SECONDS) {
    // The player was away (page closed, tab hidden or computer asleep).
    handleTimeAway(elapsedSeconds);
    state.lastUpdate = now;
    saveGame(); // save at once, so this time can never be paid out twice
  } else {
    applyProduction(elapsedSeconds);
    state.lastUpdate = now;
    processInvasions(false);   // a raid may start on screen
  }
}

// Pays out production for time spent away (up to OFFLINE_CAP_HOURS)
// and shows the welcome-back window.
function handleTimeAway(secondsAway) {
  const secondsPaid = Math.min(secondsAway, OFFLINE_CAP_HOURS * 3600);
  const before = { ...state.resources, citizens: state.population, knights: state.military.totalTrained };

  applyProduction(secondsPaid);
  const battles = processInvasions(true);   // raids that happened while you were away

  // Report the real change (new citizens may have eaten some food).
  const earned = { citizens: state.population - before.citizens, knights: state.military.totalTrained - before.knights };
  for (const res of RESOURCES) earned[res.id] = state.resources[res.id] - before[res.id];
  showWelcomeBack(secondsAway, secondsPaid, earned, battles);
}

// Refreshes everything on screen that shows numbers.
function refreshUI() {
  updateResourceBar();
  updateBuildingPanel();
  updateResearchPanel();
  updateKingdomPanel();
  updateArmyPanel();
  updateSaveStatus();
}

// Runs the logic and refreshes the numbers on screen.
// While the tab is hidden we do nothing: when the player returns,
// updateGame() sees the whole gap at once and treats it as time away.
function gameTick() {
  if (document.hidden) return;
  updateGame();
  refreshUI();
}

function handleVisibilityChange() {
  if (document.hidden) {
    updateGame();   // bank production up to this moment
    saveGame();
  } else {
    gameTick();     // catch up right away (may show "Welcome back")
  }
}


/* =============================================================
   4b. SAVING
   -------------------------------------------------------------
   The whole `state` object is turned into text (JSON) and stored
   in localStorage, which keeps it even after the browser closes.

   Saved resources always match state.lastUpdate, because
   updateGame() changes both together. So on the next visit,
   "now - lastUpdate" is exactly the time that hasn't been
   paid out yet.
   ============================================================= */

function saveGame() {
  try {
    state.lastSaved = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    // Storage can be blocked (private mode) or full.
    console.warn("Kingdom Idle: could not save.", error);
    return false;
  }
}

// Reads the save. Returns a clean state object, or null if there is
// no usable save (then a new game starts).
function loadGame() {
  let text;
  try {
    text = localStorage.getItem(SAVE_KEY);
  } catch (error) {
    return null;
  }
  if (!text) return null;

  try {
    return cleanSaveData(JSON.parse(text));
  } catch (error) {
    console.warn("Kingdom Idle: the save was damaged, starting fresh.", error);
    try { localStorage.setItem(BROKEN_SAVE_KEY, text); } catch (e) { /* ignore */ }
    return null;
  }
}

// Copies only valid values from saved data onto a fresh game state.
// Missing or broken values keep their default, so an old or edited
// save can never crash the game.
function cleanSaveData(data) {
  if (!data || typeof data !== "object") return null;
  const clean = createNewGameState();
  const isGoodNumber = value => typeof value === "number" && isFinite(value) && value >= 0;

  for (const res of RESOURCES) {
    const value = data.resources && data.resources[res.id];
    if (isGoodNumber(value)) clean.resources[res.id] = value;
  }

  for (const typeId in BUILDING_TYPES) {
    const saved = data.buildings && data.buildings[typeId];
    if (!saved) continue;
    if (isGoodNumber(saved.count)) clean.buildings[typeId].count = Math.floor(saved.count);
    if (isGoodNumber(saved.level) && saved.level >= 1) clean.buildings[typeId].level = Math.floor(saved.level);
  }

  if (isGoodNumber(data.population)) clean.population = Math.floor(data.population);
  if (isGoodNumber(data.populationProgress)) clean.populationProgress = Math.min(1, data.populationProgress);
  if (isGoodNumber(data.castleLevel) && data.castleLevel >= 1) clean.castleLevel = Math.floor(data.castleLevel);
  if (isGoodNumber(data.era) && data.era >= 1) clean.era = Math.floor(data.era);
  for (const key of ["research", "unlocked"]) {
    if (data[key] && typeof data[key] === "object") clean[key] = { ...data[key] };
  }
  // Settings: keep only known on/off switches
  if (data.settings && typeof data.settings === "object") {
    for (const key in DEFAULT_SETTINGS) {
      if (typeof data.settings[key] === "boolean") clean.settings[key] = data.settings[key];
    }
  }
  if (isGoodNumber(data.lastSaved)) clean.lastSaved = data.lastSaved;
  if (data.military && typeof data.military === "object") cleanMilitaryData(data.military, clean.military, isGoodNumber);
  // A timestamp in the future (clock changed) is treated as "now".
  if (isGoodNumber(data.lastUpdate) && data.lastUpdate <= Date.now()) {
    clean.lastUpdate = data.lastUpdate;
  }
  return clean;
}

// Copies valid military data from a save (unknown knight types are ignored).
function cleanMilitaryData(m, clean, isGoodNumber) {
  if (isGoodNumber(m.barracksLevel)) clean.barracksLevel = Math.min(BARRACKS.maxLevel, Math.floor(m.barracksLevel));
  for (const typeId in KNIGHT_TYPES) {
    if (m.army && isGoodNumber(m.army[typeId])) clean.army[typeId] = Math.floor(m.army[typeId]);
    if (m.wounded && isGoodNumber(m.wounded[typeId])) clean.wounded[typeId] = Math.floor(m.wounded[typeId]);
  }
  if (isGoodNumber(m.healProgress)) clean.healProgress = Math.min(1, m.healProgress);
  if (m.training && Array.isArray(m.training.queue)) {
    clean.training.queue = m.training.queue.filter(id => KNIGHT_TYPES[id]).slice(0, BARRACKS.queueBase + BARRACKS.maxLevel);
    if (isGoodNumber(m.training.progress)) clean.training.progress = m.training.progress;
  }
  if (m.invasion) {
    if (isGoodNumber(m.invasion.wave) && m.invasion.wave >= 1) clean.invasion.wave = Math.floor(m.invasion.wave);
    if (isGoodNumber(m.invasion.nextAt)) clean.invasion.nextAt = m.invasion.nextAt;
  }
  for (const key of ["experience", "battlesWon", "battlesLost", "totalTrained"]) {
    if (isGoodNumber(m[key])) clean[key] = m[key];
  }
  if (Array.isArray(m.log)) clean.log = m.log.filter(e => e && typeof e === "object").slice(0, 8);
}

// Wipes the save and starts a brand-new kingdom.
function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (error) { /* ignore */ }
  state = createNewGameState();
  welcomeTotals = null;
  if (currentBattle) { currentBattle = null; closeModal("battle-modal"); }
  closeModal("welcome-modal");
  markVillageDirty();
  saveGame();
  refreshUI();
  showToast("A new kingdom begins");
}

// Autosave timer. If the tab is hidden, the save made when it was
// hidden is already up to date, so we skip.
function autoSave() {
  if (document.hidden) return;
  updateGame();
  saveGame();
  updateSaveStatus();
}

// Last chance to save when the page is closed or reloaded.
function saveBeforeLeaving() {
  if (!document.hidden) updateGame();
  saveGame();
}


/* =============================================================
   5. NUMBER FORMATTING
   ============================================================= */

const NUMBER_SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

// 950 -> "950", 1234 -> "1.23K", 45678 -> "45.7K", 2500000 -> "2.50M"
function formatNumber(value) {
  if (!isFinite(value)) return "0";
  if (value < 1000) return Math.floor(value).toString();

  let tier = Math.floor(Math.log10(value) / 3);
  tier = Math.min(tier, NUMBER_SUFFIXES.length - 1);
  const scaled = value / Math.pow(1000, tier);

  // Keep about 3 significant digits: 1.23K, 12.3K, 123K
  const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  // toFixed can round 999.96 up to "1000.0"; floor first to avoid that
  const factor = Math.pow(10, decimals);
  const floored = Math.floor(scaled * factor) / factor;
  return floored.toFixed(decimals) + NUMBER_SUFFIXES[tier];
}

// Small rates need decimals: 0.1667 -> "+0.17/s", 25 -> "+25.0/s"
function formatRate(perSecond) {
  if (perSecond <= 0) return "+0/s";
  if (perSecond < 10) return "+" + perSecond.toFixed(2) + "/s";
  if (perSecond < 1000) return "+" + perSecond.toFixed(1) + "/s";
  return "+" + formatNumber(perSecond) + "/s";
}

// 90 -> "1m 30s", 8000 -> "2h 13m", 200000 -> "2d 7h"
function formatDuration(totalSeconds) {
  const s = Math.floor(totalSeconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Per-minute text used on building cards: 10 -> "10/min", 11.5 -> "11.5/min"
function formatPerMinute(perMinute) {
  const rounded = Math.round(perMinute * 10) / 10;
  return (Number.isInteger(rounded) ? rounded : rounded.toFixed(1)) + "/min";
}


/* =============================================================
   6. PIXEL ICONS
   -------------------------------------------------------------
   Each icon is a tiny grid of letters. Each letter is a color
   from ICON_COLORS, and "." means transparent. The grid is
   drawn onto a small canvas, then CSS scales it up with crisp
   (pixelated) edges. Edit the letters to redraw an icon!
   ============================================================= */

const ICON_COLORS = {
  e: "#efdcae", // paper
  n: "#9e2b25", // crimson cloth
  u: "#3a5fa8", // royal blue
  U: "#26407a", // dark royal blue
  v: "#f6f6f0", // white
  o: "#2b1d14", // outline
  r: "#c8442f", // red
  R: "#8e2a20", // dark red
  w: "#f6ead0", // shine
  g: "#5a8f3c", // green
  G: "#3e6b2a", // dark green
  b: "#8f6238", // bark
  B: "#5c3a21", // dark bark
  t: "#e0b77a", // cut wood
  T: "#b98a4e", // wood rings
  s: "#a3a396", // stone
  S: "#6f6f66", // dark stone
  l: "#cfcfc2", // light stone
  y: "#f2c14e", // gold
  Y: "#b8862b", // dark gold
  h: "#fff2b0", // gold shine
  p: "#e8b796", // skin
  c: "#3a5fa8", // blue clothing
  C: "#26407a", // dark blue
  k: "#5c3a21", // hair
  f: "#c8442f", // barn red
  F: "#8e2a20", // dark barn red
  d: "#d9a441", // wheat
};

const ICON_PIXELS = {
  food: [ // a red apple
    "....oo....",
    "...oGgo...",
    "..oooGoo..",
    ".orrroRro.",
    "orrwrrrrRo",
    "orwrrrrrRo",
    "orrrrrrrRo",
    "orrrrrrRRo",
    ".orrrRRRo.",
    "..oooooo..",
  ],
  wood: [ // two stacked logs
    "..........",
    ".oooooooo.",
    "obbBbbotto",
    "obBbbBotTo",
    "obbbbBotto",
    ".oooooooo.",
    "obbBbbotto",
    "obBbbBotTo",
    "obbbbBotto",
    ".oooooooo.",
  ],
  stone: [ // a gray rock
    "..........",
    "...oooo...",
    "..olllso..",
    ".olssssSo.",
    ".olsssSSo.",
    "olssssssSo",
    "olsSssssSo",
    "osssssSSSo",
    ".oSSSSSSo.",
    "..oooooo..",
  ],
  gold: [ // a gold coin
    "..oooooo..",
    ".ohyyyyyo.",
    "ohyyYYyyYo",
    "ohyYyyyyYo",
    "oyyYyyyyYo",
    "oyyYyyyyYo",
    "oyyYyyyyYo",
    "oyyyYYyyYo",
    ".oYyyyyYo.",
    "..oooooo..",
  ],
  population: [ // a little citizen
    "...oooo...",
    "..okkkko..",
    "..opppko..",
    "..opppo...",
    "...ooo....",
    ".occccco..",
    "occcCccco.",
    "opccCccpo.",
    ".ocCoCco..",
    "..oo.oo...",
  ],
  farm: [ // red barn with wheat
    "....oo....",
    "...offo...",
    "..offffo..",
    ".offwwffo.",
    "offfwwfffo",
    "oFffffffFo",
    "oFfwwwwfFo",
    "oFfwoowfFo",
    "oFfwoowfFo",
    "oooooooooo",
  ],
  quarry: [ // pickaxe over a rock
    "o.........",
    "oSo.......",
    ".olooo....",
    "..ollSo...",
    "..obolo...",
    "...ob.o...",
    "...oooooo.",
    "..olllssSo",
    ".olsssSSSo",
    "oooooooooo",
  ],
  market: [ // striped market stall
    "oooooooooo",
    "orwrwrwrwo",
    "orwrwrwrwo",
    "oooooooooo",
    ".ob....bo.",
    ".ob....bo.",
    "oooooooooo",
    "obyrgdyrbo",
    "obbbbbbbbo",
    "oooooooooo",
  ],
  crest: [ // the royal crest
    "oooooooooooo",
    "oyyyyyyyyyyo",
    "oyUuuyyuuuyo",
    "oyuuuyyuuuyo",
    "oyyyyyyyyyyo",
    "oyyyyyyyyyyo",
    "oyuuuyyuuuyo",
    "oyuuuyyuuuyo",
    "oyuuuyyuuuyo",
    ".oyuuyyuuyo.",
    "..oyuyyuyo..",
    "...oyyyyo...",
    "....oooo....",
  ],
  speaker: [
    "..........",
    "....o.....",
    "...oso..o.",
    "oooSso.o..",
    "ollSso..o.",
    "ollSso.oo.",
    "oooSso..o.",
    "...oso.o..",
    "....o...o.",
    "..........",
  ],
  note: [
    "....oooooo",
    "....oyyyyo",
    "....ooooyo",
    "....o..oyo",
    "....o..oyo",
    "..ooo..oyo",
    ".oyyo.ooyo",
    ".oyyooyyyo",
    "..oo.oyyo.",
    "......oo..",
  ],
  quill: [
    "........oo",
    ".......owo",
    "......owwo",
    ".....owwo.",
    "....owwo..",
    "...owwo...",
    "..owwo....",
    "..obo.....",
    ".obo......",
    "oo........",
  ],
  book: [
    "..........",
    ".oooooooo.",
    "onnnnnnnwo",
    "onyyyynnwo",
    "onnnnnnnwo",
    "onnyynnnwo",
    "onnnnnnnwo",
    "onnnnnnnwo",
    "oooooooowo",
    ".oeeeeeeeo",
  ],
  scroll: [
    ".oooooooo.",
    "oeeeeeeeeo",
    ".oeeeeeeo.",
    ".oeTTTTeo.",
    ".oeeeeeeo.",
    ".oeTTTeeo.",
    ".oeeeeeeo.",
    ".oeTTTTeo.",
    "oeeeeeeeeo",
    ".oooooooo.",
  ],
  crown: [
    "..........",
    ".o..o...o.",
    "oyooyo.oyo",
    "oyyoyyoyyo",
    "oyyyyyyyyo",
    "oyhyyhyyyo",
    "oyyyyyyyyo",
    "oYYYYYYYYo",
    "oooooooooo",
    "..........",
  ],
  heart: [
    ".oo.oo.",
    "orrorro",
    "orwrrro",
    "orrrrro",
    ".orrro.",
    "..oro..",
    "...o...",
  ],
  shield: [
    "oooooooo",
    "ollllsSo",
    "olsssSSo",
    "olsSsSSo",
    "olsssSSo",
    ".olssSo.",
    ".olsSSo.",
    "..oSSo..",
    "...oo...",
  ],
  boot: [
    "..oooo..",
    "..oBbo..",
    "..oBbo..",
    "..oBbo..",
    "..oBbooo",
    ".oBbbbbo",
    "obbbbbbo",
    "oooooooo",
  ],
  cropRotation: [
    "...d.d.d..",
    "..ddddddd.",
    "...ddddd..",
    "....ddd...",
    "....oGo...",
    "...odddo..",
    "..ddoGodd.",
    "..d.dGd.d.",
    ".....G....",
    "....GGG...",
  ],
  improvedSeeds: [
    "....oo....",
    "...oTTo...",
    "...oyyo...",
    "..obbbbo..",
    ".obbBbbbo.",
    "obbbbbBbbo",
    "obBbbbbbbo",
    "obbbbBbbbo",
    ".obbbbbbo.",
    "..oooooo.d",
  ],
  betterTools: [
    "oo......oo",
    "oso....oSo",
    ".oso..oso.",
    "..obooSo..",
    "...obbo...",
    "...obbo...",
    "..oboobo..",
    ".obo..obo.",
    "obo....obo",
    "oo......oo",
  ],
  efficientMachinery: [
    "...oo.oo..",
    "..ossoso..",
    ".osssssso.",
    "oossoossoo",
    "osso..osso",
    "osso..osso",
    "oossoossoo",
    ".osssssso.",
    "..ossoso..",
    "...oo.oo..",
  ],
  tradeRoutes: [
    "..........",
    ".oo.oo....",
    "odoodwo...",
    "oooooooooo",
    "obbbbbbbbo",
    "oBBBBBBBBo",
    "oooooooooo",
    ".ooo..ooo.",
    "oSsSo.oSso",
    ".ooo..ooo.",
  ],
  betterTaxation: [
    "..oooooo..",
    ".ohyyyyYo.",
    "..oooooo..",
    ".ohyyyyYo.",
    "..oooooo..",
    ".ohyyyyYo.",
    "..oooooo..",
    ".ohyyyyYo.",
    "..oooooo..",
    "..........",
  ],
  sword: [ // a knight's sword
    "........oo",
    ".......olo",
    "......olo.",
    ".....olo..",
    "....olo...",
    ".o.olo....",
    ".oyoo.....",
    "..oyo.....",
    ".obooy....",
    "obo..o....",
  ],
  house: [ // cottage with a red roof
    "....oo....",
    "...orro...",
    "..orrrro..",
    ".orrrrrro.",
    "orrrrrrrro",
    ".owwwwwwo.",
    ".owgowwwo.",
    ".owgowyyo.",
    ".owgowwwo.",
    ".oooooooo.",
  ],
  blacksmith: [ // anvil and hammer
    "......oo..",
    ".....oSSo.",
    "....oSSo..",
    "...obo....",
    "..obo.....",
    "oooooooo..",
    "olllllsSo.",
    ".oSssSSo..",
    "...oSSo...",
    "..oSSSSo..",
  ],
  academy: [ // open book
    "..........",
    ".oo....oo.",
    "owwoo.owwo",
    "owSwwowSwo",
    "owwSwowwwo",
    "owSwwowSwo",
    "owwwwowwwo",
    "ooccooccoo",
    "..oocco...",
    "....oo....",
  ],
  lumberMill: [ // axe in a stump
    "....oo....",
    "...osso...",
    "..ossSo...",
    "..olsSo...",
    "...oboo...",
    "....bo....",
    ".oooboooo.",
    "otTtbtTtto",
    "obbBbbBbbo",
    "oooooooooo",
  ],
};

// Draws a pixel grid onto a new <canvas> element and returns it.
function createPixelIcon(iconName) {
  const rows = ICON_PIXELS[iconName];
  const width = Math.max(...rows.map(row => row.length));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = rows.length;
  canvas.className = "pixel-icon";
  const ctx = canvas.getContext("2d");

  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = ICON_COLORS[row[x]];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  return canvas;
}


/* =============================================================
   6b. UI ARTWORK - textures and frames painted with code
   -------------------------------------------------------------
   Instead of image files, the interface's materials (parchment,
   wood planks, stone bricks, gold-riveted frames, ribbons, wax
   seals) are painted pixel by pixel on small hidden canvases.
   Each picture is turned into a "data URL" and handed to CSS as
   a variable, e.g.  --tex-wood: url(data:image/png;base64,...)
   style.css then uses them as backgrounds and border-images,
   scaled up 2x with crisp pixels.
   ============================================================= */

// Paints a small picture and returns it as a CSS url(...).
function paintArt(width, height, seed, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  draw(g, makeRandom(seed), width, height);
  return `url(${canvas.toDataURL()})`;
}

// Scatters single pixels of the given shades over the picture.
function speckle(g, random, width, height, shades, amount) {
  for (let i = 0; i < width * height * amount; i++) {
    rect(g, Math.floor(random() * width), Math.floor(random() * height), 1, 1,
      shades[Math.floor(random() * shades.length)]);
  }
}

function paintParchment(base, shades) {
  return (g, random, w, h) => {
    rect(g, 0, 0, w, h, base);
    speckle(g, random, w, h, shades, 0.28);
    for (let i = 0; i < 26; i++) {                         // paper fibers
      const x = Math.floor(random() * w), y = Math.floor(random() * h);
      rect(g, x, y, 2 + Math.floor(random() * 5), 1, shades[i % shades.length]);
    }
    for (let i = 0; i < 4; i++) {                          // faint stains
      const x = Math.floor(random() * w), y = Math.floor(random() * h);
      rect(g, x, y, 3, 2, shades[2]);
      rect(g, x + 1, y - 1, 2, 4, shades[2]);
    }
  };
}

function paintPlanks(colors, seam, grainDark, grainLight, nail) {
  return (g, random, w, h) => {
    for (let y = 0; y < h; y += 8) {
      rect(g, 0, y, w, 8, colors[(y / 8) % colors.length]);
      for (let i = 0; i < 9; i++) {                        // wood grain
        rect(g, Math.floor(random() * w), y + 1 + Math.floor(random() * 6),
          4 + Math.floor(random() * 16), 1, random() < 0.6 ? grainDark : grainLight);
      }
      rect(g, 0, y, w, 1, grainLight);                     // top edge catches light
      rect(g, 0, y + 7, w, 1, seam);                       // gap between planks
      const end = Math.floor(random() * (w - 4)) + 2;      // plank joint with nails
      rect(g, end, y, 1, 7, seam);
      rect(g, end - 2, y + 2, 1, 1, nail);
      rect(g, end + 2, y + 4, 1, 1, nail);
      if (random() < 0.5) {                                // a knot
        const kx = Math.floor(random() * w);
        rect(g, kx, y + 3, 3, 2, seam);
        rect(g, kx + 1, y + 3, 1, 1, grainDark);
      }
    }
  };
}

function paintBrickTexture(colors, mortar, light, dark) {
  return (g, random, w, h) => {
    rect(g, 0, 0, w, h, mortar);
    for (let row = 0; row * 8 < h; row++) {
      const y = row * 8;
      const offset = row % 2 ? 8 : 0;
      for (let x = -offset; x < w; x += 16) {
        const color = colors[Math.floor(random() * colors.length)];
        rect(g, x + 1, y + 1, 15, 7, color);
        rect(g, x + 1, y + 1, 15, 1, light);               // lit top edge
        rect(g, x + 1, y + 7, 15, 1, dark);                // shaded bottom edge
        for (let i = 0; i < 5; i++) rect(g, x + 2 + Math.floor(random() * 13), y + 2 + Math.floor(random() * 5), 1, 1, random() < 0.5 ? light : dark);
      }
    }
  };
}

// Frames: a square picture whose outer `slice` pixels form the border.
// Corners get ornaments; edges get studs that repeat along the frame.
function paintFrame(size, slice, colors) {
  const { outer, band, bandLight, bandDark, inner, corner, cornerLight, cornerDark, stud } = colors;
  return (g) => {
    const s = size, b = slice;
    // Border band on all four sides
    rect(g, 0, 0, s, b - 2, band);
    rect(g, 0, s - b + 2, s, b - 2, band);
    rect(g, 0, 0, b - 2, s, band);
    rect(g, s - b + 2, 0, b - 2, s, band);
    rect(g, 0, 0, s, 1, outer); rect(g, 0, s - 1, s, 1, outer);
    rect(g, 0, 0, 1, s, outer); rect(g, s - 1, 0, 1, s, outer);
    rect(g, 1, 1, s - 2, 1, bandLight); rect(g, 1, 1, 1, s - 2, bandLight);           // light from top-left
    rect(g, 1, s - 2, s - 2, 1, bandDark); rect(g, s - 2, 1, 1, s - 2, bandDark);
    rect(g, b - 2, b - 2, s - 2 * b + 4, 1, inner); rect(g, b - 2, s - b + 1, s - 2 * b + 4, 1, inner);
    rect(g, b - 2, b - 2, 1, s - 2 * b + 4, inner); rect(g, s - b + 1, b - 2, 1, s - 2 * b + 4, inner);
    // Studs in the middle of each edge piece (they repeat along the edges)
    if (stud) {
      const m = Math.floor(s / 2) - 1, c = Math.floor((b - 2) / 2) - 1;
      for (const [x, y] of [[m, c], [m, s - c - 2], [c, m], [s - c - 2, m]]) {
        rect(g, x, y, 2, 2, stud);
        rect(g, x, y, 1, 1, cornerLight);
      }
    }
    // Corner ornaments
    for (const [x, y] of [[0, 0], [s - b, 0], [0, s - b], [s - b, s - b]]) {
      rect(g, x, y, b, b, outer);
      rect(g, x + 1, y + 1, b - 2, b - 2, corner);
      rect(g, x + 1, y + 1, b - 2, 1, cornerLight);
      rect(g, x + 1, y + 1, 1, b - 2, cornerLight);
      rect(g, x + 1, y + b - 2, b - 2, 1, cornerDark);
      rect(g, x + b - 2, y + 1, 1, b - 2, cornerDark);
      const r = Math.floor(b / 2) - 1;
      rect(g, x + r, y + r, 2, 2, cornerDark);               // rivet
      rect(g, x + r, y + r, 1, 1, cornerLight);
    }
  };
}

// A cloth ribbon for titles: the middle stretches, the ends are notched tails.
function paintRibbon(main, light, dark, stitch) {
  return (g, random, w, h) => {
    rect(g, 0, 0, w, h, main);
    rect(g, 0, 1, w, 1, light);
    rect(g, 0, h - 2, w, 1, dark);
    rect(g, 0, 0, w, 1, "#1b120b");
    rect(g, 0, h - 1, w, 1, "#1b120b");
    for (let x = 12; x < w - 12; x += 3) { rect(g, x, 3, 2, 1, stitch); rect(g, x, h - 4, 2, 1, stitch); }
    // notched tails (cut out a V on each end)
    g.clearRect(0, 4, 1, h - 8); g.clearRect(1, 6, 1, h - 12); g.clearRect(2, 7, 1, h - 14);
    g.clearRect(w - 1, 4, 1, h - 8); g.clearRect(w - 2, 6, 1, h - 12); g.clearRect(w - 3, 7, 1, h - 14);
    rect(g, 10, 0, 1, h, dark);                               // folds where the tails start
    rect(g, w - 11, 0, 1, h, dark);
  };
}

// Pours all textures into CSS variables. Called once at start-up.
function applyUiArt() {
  const css = document.documentElement.style;
  const set = (name, value) => css.setProperty(name, value);

  set("--tex-parchment", paintArt(64, 64, 11, paintParchment("#e8d3a2", ["#dfc690", "#efdcae", "#d6bb82", "#f3e3b8"])));
  set("--tex-parchment-deep", paintArt(64, 64, 12, paintParchment("#d9be86", ["#cfb276", "#e2c994", "#c4a468", "#e8d3a2"])));
  set("--tex-wood", paintArt(64, 32, 13, paintPlanks(["#6e4829", "#744c2b", "#6a4527", "#78502e"], "#2e1d10", "#553820", "#8f6238", "#c8b89a")));
  set("--tex-wood-dark", paintArt(64, 32, 14, paintPlanks(["#3f2817", "#442b19", "#3b2615", "#47301c"], "#1b120b", "#2f1e10", "#5a3c22", "#9c8a6a")));
  set("--tex-stone", paintArt(64, 32, 15, paintBrickTexture(["#6b665c", "#726c61", "#655f56", "#777166"], "#3a3630", "#888276", "#4e4a43")));
  set("--tex-stone-dark", paintArt(64, 32, 16, paintBrickTexture(["#2f2a25", "#332e28", "#2b2622", "#37312a"], "#1a1612", "#3e3830", "#211c18")));
  set("--tex-hide", paintArt(64, 64, 17, (g, random, w, h) => {
    rect(g, 0, 0, w, h, "#6e4b2e");
    for (let i = 0; i < 40; i++) fillEllipse(g, random() * w, random() * h, 2 + random() * 5, 1 + random() * 3, random() < 0.5 ? "#5e3f26" : "#7a5636");
    speckle(g, random, w, h, ["#4e3420", "#86603c"], 0.12);
  }));
  set("--tex-cloth", paintArt(32, 32, 18, (g, random, w, h) => {
    for (let y = 0; y < h; y += 2) rect(g, 0, y, w, 1, "rgba(0, 0, 0, 0.08)");      // woven rows
    speckle(g, random, w, h, ["rgba(255,255,255,0.10)", "rgba(0,0,0,0.12)"], 0.25);
  }));

  set("--frame-gold", paintArt(24, 24, 1, paintFrame(24, 8, {
    outer: "#1b120b", band: "#8a5a22", bandLight: "#c08a3a", bandDark: "#5a3a16", inner: "#1b120b",
    corner: "#d9a53a", cornerLight: "#ffe08a", cornerDark: "#7a5216", stud: "#e8b64a" })));
  set("--frame-wood", paintArt(15, 15, 2, paintFrame(15, 5, {
    outer: "#1b120b", band: "#6e4829", bandLight: "#94653a", bandDark: "#3f2817", inner: "#2b1b0f",
    corner: "#8a8f9a", cornerLight: "#c8ccd4", cornerDark: "#4a4e56", stud: null })));
  set("--frame-stone", paintArt(36, 36, 3, (g, random) => {
    paintFrame(36, 12, { outer: "#1b120b", band: "#6b665c", bandLight: "#8d887c", bandDark: "#3e3a34", inner: "#1b120b",
      corner: "#7a756a", cornerLight: "#a29d90", cornerDark: "#3e3a34", stud: null })(g);
    for (let i = 0; i < 4; i++) {                                     // mortar lines in the stone band
      const v = 4 + i * 8;
      rect(g, 12, 3 + (i % 2) * 4, 1, 4, "#3e3a34");
      rect(g, v, 3, 1, 3, "#4e4a43");
      rect(g, v, 30, 1, 3, "#4e4a43");
      rect(g, 3, v, 3, 1, "#4e4a43");
      rect(g, 30, v, 3, 1, "#4e4a43");
    }
    for (const [x, y] of [[4, 4], [28, 4], [4, 28], [28, 28]]) {   // gold caps on the corners
      rect(g, x, y, 4, 4, "#d9a53a"); rect(g, x, y, 4, 1, "#ffe08a"); rect(g, x + 1, y + 1, 2, 2, "#9c6f22");
    }
  }));
  set("--frame-iron", paintArt(15, 15, 4, paintFrame(15, 5, {
    outer: "#1b120b", band: "#5a5e66", bandLight: "#8a8f9a", bandDark: "#33363c", inner: "#1b120b",
    corner: "#a8acb4", cornerLight: "#e0e4ea", cornerDark: "#4a4e56", stud: null })));
  set("--frame-hide", paintArt(15, 15, 5, paintFrame(15, 5, {
    outer: "#1b120b", band: "#64170f", bandLight: "#9e2b25", bandDark: "#3e0e08", inner: "#1b120b",
    corner: "#d8cbb0", cornerLight: "#fff4dc", cornerDark: "#8a7a5a", stud: null })));   // bone corners

  set("--ribbon", paintArt(32, 17, 6, paintRibbon("#9e2b25", "#c8442f", "#64170f", "#e8b64a")));
  set("--ribbon-blue", paintArt(32, 17, 7, paintRibbon("#2f4f8f", "#4a6fb8", "#1e335e", "#e8b64a")));
  set("--divider-line", paintArt(8, 8, 8, g => {
    rect(g, 0, 3, 8, 1, "#6b4a2a"); rect(g, 0, 4, 8, 1, "#c8a060");
  }));
  set("--divider-gem", paintArt(32, 8, 9, g => {
    rect(g, 4, 3, 24, 2, "#6b4a2a");
    fillPoly(g, [[16, 0], [21, 4], [16, 8], [11, 4]], "#1b120b");
    fillPoly(g, [[16, 1], [20, 4], [16, 7], [12, 4]], "#9e2b25");
    rect(g, 15, 2, 1, 2, "#e8665a");
    for (const x of [6, 25]) { rect(g, x, 2, 2, 4, "#1b120b"); rect(g, x, 3, 1, 1, "#e8b64a"); }
  }));
  set("--seal", paintArt(22, 22, 10, (g, random) => {
    fillEllipse(g, 11, 11, 11, 11, "#64170f");
    for (let a = 0; a < 12; a++) {                                     // wobbly wax edge
      const ang = (a / 12) * Math.PI * 2;
      fillEllipse(g, 11 + Math.cos(ang) * 9, 11 + Math.sin(ang) * 9, 2.5, 2.5, "#7e2018");
    }
    fillEllipse(g, 11, 11, 8, 8, "#9e2b25");
    fillEllipse(g, 10, 10, 7, 7, "#b8352b");
    fillEllipse(g, 11, 11, 6, 6, "#9e2b25");
    rect(g, 6, 5, 3, 1, "#e8665a");
  }));
  set("--socket", paintArt(19, 19, 20, g => {
    fillEllipse(g, 9.5, 9.5, 9.5, 9.5, "#1b120b");
    fillEllipse(g, 9.5, 9.5, 8.5, 8.5, "#9c6f22");
    fillEllipse(g, 9.5, 9.5, 7.5, 7.5, "#e8b64a");
    fillEllipse(g, 9.5, 10, 7, 7, "#7a5216");
    fillEllipse(g, 9.5, 9.5, 6.5, 6.5, "#2b1b0f");
    rect(g, 5, 3, 3, 1, "#ffe08a");
  }));
}

// Puts pixel icons into every <span class="icon-slot" data-icon="..."> in the page.
function fillIconSlots(root = document) {
  for (const slot of root.querySelectorAll(".icon-slot[data-icon]")) {
    if (slot.firstChild && slot.firstChild.tagName === "CANVAS") continue;
    const name = slot.dataset.icon;
    if (ICON_PIXELS[name]) slot.prepend(createPixelIcon(name));
  }
}

/* =============================================================
   7. USER INTERFACE
   ============================================================= */

// We look up the counter elements once and remember them, instead of
// searching the page 5 times per second.
const resourceElements = {};

// Builds the top bar: one counter per resource, plus population.
function buildResourceBar() {
  const bar = document.getElementById("resource-bar");
  bar.innerHTML = "";

  const entries = [...RESOURCES, { id: "population", name: "Citizens" }];

  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "resource";
    item.title = entry.name;
    const socket = document.createElement("span");
    socket.className = "res-socket";
    socket.appendChild(createPixelIcon(entry.id));
    item.appendChild(socket);

    const text = document.createElement("div");
    text.className = "resource-text";
    text.innerHTML =
      `<span class="resource-name">${entry.name}</span>` +
      `<span class="resource-amount">0</span>` +
      `<span class="resource-rate">+0/s</span>`;
    item.appendChild(text);
    bar.appendChild(item);

    resourceElements[entry.id] = {
      item, socket,
      amount: text.querySelector(".resource-amount"),
      rate: text.querySelector(".resource-rate"),
      lastValue: null, lastPulse: 0,
    };
  }
}

// "+12/min" for the resource bar.
function formatRatePerMinute(perMinute) {
  if (perMinute <= 0) return "+0/min";
  if (perMinute < 10) return "+" + (Math.round(perMinute * 10) / 10) + "/min";
  return "+" + formatNumber(perMinute) + "/min";
}

// Every 1.5 seconds, if a resource went up by at least 1, a little
// "+N" floats up from its plaque and the icon hops.
function showResourceGain(el, value) {
  const now = performance.now();
  if (el.lastValue === null) { el.lastValue = value; el.lastPulse = now; return; }
  if (now - el.lastPulse < 1500) return;
  const gained = Math.floor(value) - Math.floor(el.lastValue);
  el.lastValue = value;
  el.lastPulse = now;
  if (gained < 1 || document.hidden) return;
  const float = document.createElement("span");
  float.className = "gain-float";
  float.textContent = "+" + formatNumber(gained);
  el.item.appendChild(float);
  setTimeout(() => float.remove(), 1300);
  bumpElement(el.socket);
}

// Restarts a short CSS "bump" animation on an element.
function bumpElement(element, className = "bump") {
  element.classList.remove(className);
  void element.offsetWidth;            // forces the browser to restart the animation
  element.classList.add(className);
}

// I, II, III, IV ... for levels on wax seals.
function toRoman(n) {
  const table = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [value, letters] of table) while (n >= value) { out += letters; n -= value; }
  return out;
}

// Refreshes the numbers in the top bar.
function updateResourceBar() {
  const rates = getProductionPerSecond();

  for (const res of RESOURCES) {
    const el = resourceElements[res.id];
    el.amount.textContent = formatNumber(state.resources[res.id]);
    el.rate.textContent = formatRatePerMinute(rates[res.id] * 60);
    el.rate.classList.toggle("zero", rates[res.id] <= 0);
    showResourceGain(el, state.resources[res.id]);
  }

  const popEl = resourceElements.population;
  popEl.amount.textContent = `${formatNumber(state.population)}/${formatNumber(getHousingCapacity())}`;
  const status = getGrowthStatus();
  popEl.rate.textContent = status;
  popEl.rate.classList.toggle("zero", status !== "growing");
  popEl.rate.classList.toggle("warn", status !== "growing");

  document.getElementById("era-label").textContent = `Era ${ROMAN[state.era]} · ${ERA_NAMES[state.era]}`;
}

// ---------- Building panel ----------
// The cards are created ONCE. After that, updateBuildingPanel() only
// changes their text and enables/disables buttons. Rebuilding the
// cards 5 times a second would make buttons flicker and miss clicks.
const buildingCardElements = {};

function buildBuildingPanel() {
  const list = document.getElementById("building-list");
  list.innerHTML = "";

  for (const typeId in BUILDING_TYPES) {
    const type = BUILDING_TYPES[typeId];

    const card = document.createElement("li");
    card.className = "building-card";
    card.innerHTML =
      `<div class="building-art"></div>` +
      `<div class="level-seal"></div>` +
      `<div class="building-header">` +
        `<div class="building-info">` +
          `<div class="building-name">${type.name} <span class="building-count"></span></div>` +
          `<div class="building-meta">${type.description}</div>` +
          `<div class="building-output"></div>` +
        `</div>` +
      `</div>` +
      `<div class="lock-info">` +
        `<div class="lock-text"></div>` +
        `<div class="progress"><div class="progress-fill"></div></div>` +
      `</div>` +
      `<div class="building-actions">` +
        `<button class="btn btn-build">` +
          `<span class="btn-label">Build</span>` +
          `<span class="btn-gain"></span>` +
          `<span class="btn-cost"></span>` +
        `</button>` +
        `<button class="btn btn-upgrade">` +
          `<span class="btn-label">Upgrade</span>` +
          `<span class="btn-gain"></span>` +
          `<span class="btn-cost"></span>` +
        `</button>` +
      `</div>`;
    card.querySelector(".building-header").prepend(createPixelIcon(typeId));

    const buildBtn = card.querySelector(".btn-build");
    const upgradeBtn = card.querySelector(".btn-upgrade");
    buildBtn.addEventListener("click", () => buildBuilding(typeId));
    upgradeBtn.addEventListener("click", () => upgradeBuilding(typeId));

    list.appendChild(card);
    buildingCardElements[typeId] = {
      card,
      art: card.querySelector(".building-art"),
      seal: card.querySelector(".level-seal"),
      artKey: "",
      count: card.querySelector(".building-count"),
      output: card.querySelector(".building-output"),
      lockInfo: card.querySelector(".lock-info"),
      lockText: card.querySelector(".lock-text"),
      lockFill: card.querySelector(".progress-fill"),
      actions: card.querySelector(".building-actions"),
      buildBtn,
      buildGain: buildBtn.querySelector(".btn-gain"),
      buildCost: buildBtn.querySelector(".btn-cost"),
      upgradeBtn,
      upgradeLabel: upgradeBtn.querySelector(".btn-label"),
      upgradeGain: upgradeBtn.querySelector(".btn-gain"),
      upgradeCost: upgradeBtn.querySelector(".btn-cost"),
    };
  }
}

// Fills a cost element with small icons + amounts, e.g. [log]100 [rock]50.
// Amounts the player can't afford yet are marked with the "short" class (red).
function showCost(element, cost) {
  // Only rebuild if something changed (keeps the DOM calm).
  let key = "";
  for (const resourceId in cost) {
    key += resourceId + cost[resourceId] + (state.resources[resourceId] >= cost[resourceId]) + ";";
  }
  if (element.dataset.key === key) return;
  element.dataset.key = key;

  element.innerHTML = "";
  for (const resourceId in cost) {
    const part = document.createElement("span");
    part.className = "cost-part";
    if (state.resources[resourceId] < cost[resourceId]) part.classList.add("short");
    part.appendChild(createPixelIcon(resourceId));
    part.appendChild(document.createTextNode(formatNumber(cost[resourceId])));
    element.appendChild(part);
  }
}

// Text describing what a building does right now.
function getOutputText(typeId) {
  const type = BUILDING_TYPES[typeId];
  const owned = state.buildings[typeId];
  if (type.produces) {
    const resourceName = RESOURCES.find(r => r.id === type.produces).name;
    return owned.count > 0
      ? `Producing +${formatPerMinute(getBuildingRatePerSecond(typeId) * 60)} ${resourceName}`
      : `Not built yet · makes ${formatPerMinute(type.baseRatePerMinute)} ${resourceName}`;
  }
  if (type.housing) {
    return owned.count > 0
      ? `Housing ${formatNumber(calculateHousing(owned.count, owned.level))} citizens`
      : `Not built yet · each holds ${type.housing} citizens`;
  }
  const targets = type.boosts.map(id => BUILDING_TYPES[id].name).join(" & ");
  const boost = calculateBoost(typeId, Math.max(1, owned.count), owned.level);
  return owned.count > 0
    ? `Boosting ${targets} +${Math.round(boost * 100)}%`
    : `Not built yet · boosts ${targets} +${Math.round(boost * 100)}%`;
}

// "+10/min", "+5 room" or "+5%": what one more copy / level would add.
function getGainText(typeId, extraCount, extraLevel) {
  const type = BUILDING_TYPES[typeId];
  const owned = state.buildings[typeId];
  const count = owned.count + extraCount, level = owned.level + extraLevel;
  if (type.produces) {
    const gain = calculateRatePerSecond(typeId, count, level) - getBuildingRatePerSecond(typeId);
    return `+${formatPerMinute(gain * 60)}`;
  }
  if (type.housing) {
    return `+${calculateHousing(count, level) - calculateHousing(owned.count, owned.level)} room`;
  }
  const gain = calculateBoost(typeId, count, level) - calculateBoost(typeId, owned.count, owned.level);
  return `+${Math.round(gain * 1000) / 10}%`;
}

// Updates every card: counts, output, costs and button states.
function updateBuildingPanel() {
  for (const typeId in BUILDING_TYPES) {
    const type = BUILDING_TYPES[typeId];
    const owned = state.buildings[typeId];
    const el = buildingCardElements[typeId];

    // The illustration is redrawn only when its look changes
    const artKey = getBuildingTier(typeId) + ":" + (owned.count > 0);
    if (el.artKey !== artKey) {
      el.artKey = artKey;
      el.art.replaceChildren(renderBuildingArt(typeId));
    }
    el.seal.textContent = toRoman(owned.level);

    // Locked buildings show how close you are to unlocking them
    const unlocked = isBuildingUnlocked(typeId);
    el.card.classList.toggle("locked", !unlocked);
    el.lockInfo.hidden = unlocked;
    el.actions.hidden = !unlocked;
    if (!unlocked) {
      el.count.textContent = "";
      el.output.textContent = "Locked";
      el.lockText.textContent = `Unlocks at ${type.unlockPopulation} citizens (${state.population}/${type.unlockPopulation})`;
      el.lockFill.style.width = Math.min(100, (state.population / type.unlockPopulation) * 100) + "%";
      continue;
    }

    el.card.classList.toggle("not-owned", owned.count === 0);
    el.count.textContent = owned.count > 0 ? `×${owned.count} · Lv ${owned.level}` : "";
    el.output.textContent = getOutputText(typeId);

    el.card.classList.toggle("affordable", canAfford(getBuildCost(typeId)) ||
      (owned.count > 0 && canAfford(getUpgradeCost(typeId))));

    // Build button
    const buildCost = getBuildCost(typeId);
    el.buildGain.textContent = getGainText(typeId, 1, 0);
    showCost(el.buildCost, buildCost);
    el.buildBtn.disabled = !canAfford(buildCost);

    // Upgrade button (only possible once you own one)
    const upgradeCost = getUpgradeCost(typeId);
    el.upgradeLabel.textContent = "Upgrade";
    if (owned.count > 1) el.upgradeLabel.textContent = `Upgrade all ${owned.count}`;
    if (owned.count > 0) {
      el.upgradeGain.textContent = getGainText(typeId, 0, 1);
      el.upgradeBtn.disabled = !canAfford(upgradeCost);
    } else {
      el.upgradeGain.textContent = "build one first";
      el.upgradeBtn.disabled = true;
    }
    showCost(el.upgradeCost, upgradeCost);
  }
}

// ---------- Research screen ----------
const researchCardElements = {};

// Small emblem shown at the top of each research branch.
const BRANCH_EMBLEMS = { agriculture: "food", industry: "blacksmith", commerce: "gold" };

function buildResearchPanel() {
  const container = document.getElementById("research-branches");
  container.innerHTML = "";
  for (const branch of RESEARCH_BRANCHES) {
    const column = document.createElement("section");
    column.className = "research-branch";
    column.innerHTML = `<h3 class="branch-title"><span class="res-socket"></span>${branch.name}</h3><ul class="research-list"></ul>`;
    column.querySelector(".res-socket").appendChild(createPixelIcon(BRANCH_EMBLEMS[branch.id]));
    const list = column.querySelector(".research-list");

    for (const tech of RESEARCH.filter(t => t.branch === branch.id)) {
      const card = document.createElement("li");
      card.className = "research-card";
      card.innerHTML =
        `<div class="research-top">` +
          `<span class="res-socket"></span>` +
          `<h4 class="research-name">${tech.name}</h4>` +
          `<span class="status-badge"></span>` +
        `</div>` +
        `<p class="research-desc">${tech.description}</p>` +
        `<p class="research-effect">${tech.effectText}</p>` +
        `<p class="research-reqs"></p>` +
        `<button class="btn btn-primary research-btn" type="button">` +
          `<span class="btn-label">Research</span>` +
          `<span class="btn-cost"></span>` +
        `</button>`;
      card.querySelector(".research-top .res-socket").appendChild(createPixelIcon(tech.id));
      const button = card.querySelector(".research-btn");
      button.addEventListener("click", () => researchTech(tech.id));
      list.appendChild(card);
      researchCardElements[tech.id] = {
        card,
        badge: card.querySelector(".status-badge"),
        reqs: card.querySelector(".research-reqs"),
        button,
        label: button.querySelector(".btn-label"),
        cost: button.querySelector(".btn-cost"),
      };
    }
    container.appendChild(column);
  }
}

// A small dot on a tab means "something here is ready for you".
function setNavBadge(screen, on) {
  const button = document.querySelector(`.nav-btn[data-screen="${screen}"]`);
  if (button) button.classList.toggle("has-badge", on);
}

function updateResearchPanel() {
  setNavBadge("research", RESEARCH.some(t => getResearchStatus(t) === "available" && canAfford(t.cost)));
  const names = { done: "Researched", available: "Available", locked: "Locked" };
  for (const tech of RESEARCH) {
    const el = researchCardElements[tech.id];
    const status = getResearchStatus(tech);
    el.card.dataset.status = status;
    // The chain from the previous technology turns gold once it is learned
    const branchTechs = RESEARCH.filter(t => t.branch === tech.branch);
    const previous = branchTechs[branchTechs.indexOf(tech) - 1];
    el.card.dataset.prevDone = previous ? String(!!state.research[previous.id]) : "false";
    el.badge.textContent = names[status];

    // Requirements, each marked as met or not
    const reqKey = tech.requires.map(r => r + isRequirementMet(r)).join(",");
    if (el.reqs.dataset.key !== reqKey) {
      el.reqs.dataset.key = reqKey;
      el.reqs.innerHTML = tech.requires.length === 0
        ? `<span class="req met">No requirements</span>`
        : "Requires: " + tech.requires.map(r =>
            `<span class="req ${isRequirementMet(r) ? "met" : "unmet"}">${getRequirementLabel(r)}</span>`).join(", ");
    }

    if (status === "done") {
      el.label.textContent = "Complete";
      el.cost.hidden = true;
      el.button.disabled = true;
    } else {
      el.label.textContent = "Research";
      el.cost.hidden = false;
      showCost(el.cost, tech.cost);
      el.button.disabled = status !== "available" || !canAfford(tech.cost);
    }
  }
}

// ---------- Kingdom screen: milestones and castle ----------
function buildKingdomPanel() {
  const list = document.getElementById("milestone-list");
  list.innerHTML = "";
  for (const m of MILESTONES) {
    const row = document.createElement("li");
    row.className = "milestone";
    row.dataset.population = m.population;
    row.innerHTML =
      `<div class="milestone-head"><span class="milestone-title">${m.title}</span>` +
      `<span class="milestone-target">${m.population} citizens</span></div>` +
      `<div class="milestone-reward">${m.reward}</div>` +
      `<div class="progress"><div class="progress-fill"></div></div>`;
    list.appendChild(row);
  }
  document.getElementById("castle-button").addEventListener("click", upgradeCastle);
}

function updateKingdomPanel() {
  for (const row of document.querySelectorAll(".milestone")) {
    const target = Number(row.dataset.population);
    row.classList.toggle("reached", state.population >= target);
    row.querySelector(".progress-fill").style.width = Math.min(100, (state.population / target) * 100) + "%";
  }
  const done = state.castleLevel >= 2;
  setNavBadge("kingdom", !done && state.population >= CASTLE_UPGRADE.population && canAfford(CASTLE_UPGRADE.cost));
  const button = document.getElementById("castle-button");
  const status = document.getElementById("castle-status");
  const costEl = document.getElementById("castle-cost");
  if (done) {
    status.textContent = "Complete! Your castle towers over the land (+10% to all production).";
    button.hidden = true;
  } else {
    const ready = state.population >= CASTLE_UPGRADE.population;
    status.textContent = ready
      ? "Your people are ready to build a castle."
      : `Requires ${CASTLE_UPGRADE.population} citizens (${state.population}/${CASTLE_UPGRADE.population}).`;
    button.hidden = false;
    showCost(costEl, CASTLE_UPGRADE.cost);
    button.disabled = !ready || !canAfford(CASTLE_UPGRADE.cost);
  }
}

// Bottom navigation: show one screen, hide the others.
function setupNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");
  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.screen;
      buttons.forEach(b => b.classList.toggle("active", b === button));
      document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.toggle("active", screen.id === "screen-" + target);
      });
      if (target === "village") resizeVillageCanvas();
      playSound("click");
    });
  });
}


// ---------- Save status, buttons and pop-up windows ----------

function updateSaveStatus() {
  let text = "Not saved yet";
  if (state.lastSaved > 0) {
    const ago = (Date.now() - state.lastSaved) / 1000;
    text = ago < 5 ? "Saved just now" : `Saved ${formatDuration(ago)} ago`;
  }
  for (const el of document.querySelectorAll(".save-status")) el.textContent = text;
}

function openModal(id) {
  document.getElementById(id).hidden = false;
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
}

// A short message that pops up at the bottom and fades away.
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
}

// ---------- Announcements ----------
// Unlocks, milestones and discoveries slide in from the top with an
// illustration. They queue up so several never overlap.
const announcementQueue = [];
let announcementShowing = false;

function announce(kicker, title, text, art) {
  if (announcementQueue.length >= 4) return;          // don't flood the screen
  announcementQueue.push({ kicker, title, text, art });
  if (!announcementShowing) showNextAnnouncement();
}

function showNextAnnouncement() {
  const next = announcementQueue.shift();
  const box = document.getElementById("announcement");
  if (!next || !box) { announcementShowing = false; return; }
  announcementShowing = true;
  document.getElementById("announce-kicker").textContent = next.kicker;
  document.getElementById("announce-title").textContent = next.title;
  document.getElementById("announce-text").textContent = next.text;
  document.getElementById("announce-art").replaceChildren(next.art || createPixelIcon("crown"));
  box.classList.remove("leaving");
  box.hidden = false;
  setTimeout(() => {
    box.classList.add("leaving");
    setTimeout(() => { box.hidden = true; showNextAnnouncement(); }, 400);
  }, 3600);
}

// Totals shown in the welcome-back window. If the player leaves again
// before closing it, the new earnings are added on top.
let welcomeTotals = null;

function showWelcomeBack(secondsAway, secondsPaid, earned, battles = []) {
  if (!welcomeTotals) welcomeTotals = { away: 0, earned: {}, capped: false, battles: [] };
  welcomeTotals.battles.push(...battles);
  welcomeTotals.away += secondsAway;
  welcomeTotals.capped = welcomeTotals.capped || secondsAway > secondsPaid;
  for (const key of [...RESOURCES.map(r => r.id), "citizens", "knights"]) {
    welcomeTotals.earned[key] = (welcomeTotals.earned[key] || 0) + (earned[key] || 0);
  }

  document.getElementById("welcome-time").textContent = formatDuration(welcomeTotals.away);
  document.getElementById("welcome-cap").hidden = !welcomeTotals.capped;

  const list = document.getElementById("welcome-earnings");
  list.innerHTML = "";
  const rows = [...RESOURCES.map(r => ({ id: r.id, icon: r.id, name: r.name }))];
  if (welcomeTotals.earned.citizens > 0) rows.push({ id: "citizens", icon: "population", name: "New citizens" });
  if (welcomeTotals.earned.knights > 0) rows.push({ id: "knights", icon: "sword", name: "Knights trained" });
  for (const r of rows) {
    const value = welcomeTotals.earned[r.id];
    const row = document.createElement("li");
    row.className = "earning-row";
    row.appendChild(createPixelIcon(r.icon));
    const name = document.createElement("span");
    name.className = "earning-name";
    name.textContent = r.name;
    const amount = document.createElement("span");
    amount.className = "earning-amount";
    if (value < 0) amount.classList.add("negative");
    amount.textContent = (value < 0 ? "-" : "+") + formatNumber(Math.abs(value));
    row.append(name, amount);
    list.appendChild(row);
  }
  // Raids fought while you were away
  for (const b of welcomeTotals.battles) {
    const row = document.createElement("li");
    row.className = "earning-row";
    row.appendChild(createPixelIcon("sword"));
    const name = document.createElement("span");
    name.className = "earning-name";
    name.textContent = `Raid, wave ${b.wave}`;
    const amount = document.createElement("span");
    amount.className = "earning-amount" + (b.victory ? "" : " negative");
    amount.textContent = b.victory ? "Victory" : "Defeat";
    row.append(name, amount);
    list.appendChild(row);
  }
  openModal("welcome-modal");
}

// The earnings were already added when you returned (so nothing is
// lost if the page closes); this button just closes the window.
function collectWelcomeBack() {
  playSound("coins");
  welcomeTotals = null;
  closeModal("welcome-modal");
  refreshUI();
  processInvasions(false);
}

function setupSaveControls() {
  for (const button of document.querySelectorAll(".save-button")) {
    button.addEventListener("click", () => {
      updateGame();
      const ok = saveGame();
      updateSaveStatus();
      playSound("click");
      showToast(ok ? "Kingdom saved" : "Saving is blocked in this browser");
    });
  }
  document.getElementById("reset-button").addEventListener("click", () => openModal("reset-modal"));
  document.getElementById("reset-cancel").addEventListener("click", () => closeModal("reset-modal"));
  document.getElementById("reset-confirm").addEventListener("click", () => {
    closeModal("reset-modal");
    resetGame();
  });
  document.getElementById("welcome-collect").addEventListener("click", collectWelcomeBack);
}


/* =============================================================
   7c. ARMY SCREEN AND LIVE BATTLES
   ============================================================= */

let currentBattle = null;     // the battle playing on screen (if any)
let uiReady = false;          // true once the page is fully set up
let warnedForInvasionAt = 0;  // so the warning horn only sounds once per raid

function isModalOpen() {
  return [...document.querySelectorAll(".modal-backdrop")].some(m => !m.hidden);
}

// A small canvas showing a unit's battle sprite, for cards and lists.
function createUnitIcon(typeId) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  canvas.className = "pixel-icon unit-icon";
  drawUnitSprite(canvas.getContext("2d"), typeId, 8, 14, 1, { noShadow: true });
  return canvas;
}

function statLine(t) {
  const range = t.ranged ? ` · RANGE ${t.range}` : "";
  return `HP ${Math.round(t.hp)} · ATK ${Math.round(t.attack)} · DEF ${t.defense} · SPD ${t.attackSpeed}/s${range}`;
}

// A framed portrait: the unit's battle sprite on a banner backdrop.
function createPortrait(typeId) {
  const canvas = document.createElement("canvas");
  canvas.width = 26;
  canvas.height = 28;
  canvas.className = "portrait";
  const g = canvas.getContext("2d");
  const enemy = !KNIGHT_TYPES[typeId];
  const back = enemy ? "#5a3a24" : "#26407a", stripe = enemy ? "#7a4a2e" : "#3a5fa8";
  rect(g, 0, 0, 26, 28, back);
  for (let x = 0; x < 26; x += 6) rect(g, x, 0, 3, 28, stripe);           // banner stripes
  rect(g, 0, 22, 26, 6, enemy ? "#4a3a24" : "#4d8236");                  // ground
  rect(g, 0, 22, 26, 1, enemy ? "#6b5436" : "#72ab4e");
  rect(g, 4, 25, 18, 1, "rgba(0,0,0,0.3)");
  drawUnitSprite(g, typeId, 13, 25, 1, { noShadow: true });
  return canvas;
}

// Health, attack, defense and speed as little bars with icons.
function createStatBars(t) {
  const box = document.createElement("div");
  box.className = "stat-bars";
  const rows = [
    ["heart", "stat-hp", t.hp / 250, Math.round(t.hp)],
    ["sword", "stat-atk", t.attack / 30, Math.round(t.attack)],
    ["shield", "stat-def", t.defense / 10, t.defense],
    ["boot", "stat-spd", t.moveSpeed / 40, t.moveSpeed],
  ];
  for (const [icon, cls, ratio, value] of rows) {
    box.appendChild(createPixelIcon(icon));
    const bar = document.createElement("div");
    bar.className = "stat-bar " + cls;
    const fill = document.createElement("span");
    fill.style.width = Math.max(4, Math.min(100, ratio * 100)) + "%";
    bar.appendChild(fill);
    const label = document.createElement("span");
    label.className = "stat-value";
    label.textContent = value;
    box.append(bar, label);
  }
  const note = document.createElement("div");
  note.className = "knight-stats";
  note.style.gridColumn = "1 / -1";
  note.textContent = `${t.attackSpeed} hits/s` + (t.ranged ? ` · range ${t.range}` : "");
  box.appendChild(note);
  return box;
}

const armyElements = {};

function buildArmyPanel() {
  // Knight cards
  const list = document.getElementById("knight-list");
  list.innerHTML = "";
  for (const typeId in KNIGHT_TYPES) {
    const t = KNIGHT_TYPES[typeId];
    const card = document.createElement("li");
    card.className = "knight-card";
    card.innerHTML =
      `<div class="knight-head">` +
        `<div class="knight-info">` +
          `<div class="knight-name">${t.name} <span class="knight-count"></span></div>` +
          `<div class="knight-desc">${t.description}</div>` +
          `<div class="knight-ability">${t.abilityText}</div>` +
          `<div class="knight-stats">${statLine(t)}</div>` +
          `<div class="knight-train">Training time: ${t.trainSeconds}s · Requires Barracks Lv ${t.barracksLevel}</div>` +
        `</div>` +
      `</div>` +
      `<button class="btn btn-build recruit-btn" type="button">` +
        `<span class="btn-label">Recruit</span><span class="btn-cost"></span>` +
      `</button>`;
    card.querySelector(".knight-head").prepend(createPortrait(typeId));
    card.querySelector(".knight-stats").replaceWith(createStatBars(t));
    const button = card.querySelector(".recruit-btn");
    button.addEventListener("click", () => recruitKnight(typeId));
    list.appendChild(card);
    armyElements[typeId] = { card, button, label: button.querySelector(".btn-label"), cost: button.querySelector(".btn-cost"), count: card.querySelector(".knight-count") };
  }

  document.getElementById("barracks-build").addEventListener("click", buildBarracks);
  document.getElementById("barracks-upgrade").addEventListener("click", upgradeBarracks);
  document.getElementById("invasion-banner").addEventListener("click", () => {
    document.querySelector('.nav-btn[data-screen="army"]').click();
  });
  document.getElementById("battle-skip").addEventListener("click", skipLiveBattle);
  document.getElementById("battle-start").addEventListener("click", beginFight);
  document.getElementById("battle-continue").addEventListener("click", closeBattle);
}

function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function updateArmyPanel() {
  const m = state.military;
  const built = m.barracksLevel > 0;
  const unlocked = isBarracksUnlocked();

  // Barracks illustration (it grows with the barracks level)
  const art = document.getElementById("barracks-art");
  const artKey = (built ? getBuildingTier("barracks") : -1) + ":" + unlocked;
  if (art.dataset.key !== artKey) {
    art.dataset.key = artKey;
    art.replaceChildren(renderBuildingArt("barracks"));
    art.classList.toggle("locked", !built);
  }

  // Barracks: locked / ready to build / built
  document.getElementById("barracks-locked").hidden = unlocked;
  document.getElementById("barracks-buildable").hidden = !unlocked || built;
  document.getElementById("barracks-built").hidden = !built;
  document.getElementById("barracks-level-note").textContent = built
    ? `Level ${m.barracksLevel} of ${BARRACKS.maxLevel}` : "Train knights to defend your kingdom.";
  if (!unlocked) {
    document.getElementById("barracks-lock-text").textContent =
      `Unlocks at ${BARRACKS.unlockPopulation} citizens (${state.population}/${BARRACKS.unlockPopulation})`;
    document.getElementById("barracks-lock-fill").style.width =
      Math.min(100, (state.population / BARRACKS.unlockPopulation) * 100) + "%";
  }
  if (unlocked && !built) {
    showCost(document.getElementById("barracks-build-cost"), BARRACKS.buildCost);
    document.getElementById("barracks-build").disabled = !canAfford(BARRACKS.buildCost);
  }

  if (built) {
    const armySize = countKnights(m.army), wounded = countKnights(m.wounded);
    document.getElementById("army-size").textContent = armySize;
    document.getElementById("army-capacity").textContent = getArmyCapacity();
    document.getElementById("army-wounded").textContent = wounded > 0
      ? `${wounded} wounded (next recovers in ${Math.ceil((1 - m.healProgress) * INVASION.woundedHealSeconds)}s)`
      : "No wounded";

    // Training queue
    const queue = m.training.queue;
    const current = queue[0];
    document.getElementById("training-current").textContent = current
      ? `Training ${KNIGHT_TYPES[current].name}: ${Math.ceil(KNIGHT_TYPES[current].trainSeconds - m.training.progress)}s left`
      : "No knights in training";
    document.getElementById("training-fill").style.width = current
      ? (m.training.progress / KNIGHT_TYPES[current].trainSeconds) * 100 + "%" : "0%";
    document.getElementById("training-slots").textContent = `Queue ${queue.length}/${getQueueSize()}`;

    // Recruit buttons
    const space = getKnightSpace();
    for (const typeId in KNIGHT_TYPES) {
      const t = KNIGHT_TYPES[typeId], el = armyElements[typeId];
      el.count.textContent = `×${m.army[typeId]}`;
      el.card.classList.toggle("locked", !isKnightTypeUnlocked(typeId));
      showCost(el.cost, t.cost);
      const typeOpen = isKnightTypeUnlocked(typeId);
      el.label.textContent = !typeOpen ? `Needs Barracks Lv ${t.barracksLevel}`
        : space <= 0 ? "Army full" : queue.length >= getQueueSize() ? "Queue full" : "Recruit";
      el.button.disabled = !typeOpen || space <= 0 || queue.length >= getQueueSize() || !canAfford(t.cost);
    }

    // Barracks upgrade
    const upgradeButton = document.getElementById("barracks-upgrade");
    if (m.barracksLevel >= BARRACKS.maxLevel) {
      upgradeButton.disabled = true;
      upgradeButton.querySelector(".btn-label").textContent = "Max level";
      document.getElementById("barracks-upgrade-cost").hidden = true;
    } else {
      const cost = getBarracksUpgradeCost();
      upgradeButton.querySelector(".btn-label").textContent = `Upgrade to Lv ${m.barracksLevel + 1} (+${BARRACKS.capacityPerLevel} capacity, +1 slot)`;
      showCost(document.getElementById("barracks-upgrade-cost"), cost);
      upgradeButton.disabled = !canAfford(cost);
    }
  }

  // Defense panel: countdown and scouting report
  document.getElementById("defense-inactive").hidden = built;
  document.getElementById("defense-active").hidden = !built;
  const secondsLeft = getSecondsUntilInvasion();
  if (built) {
    document.getElementById("invasion-countdown").textContent =
      currentBattle ? "Under attack!" : secondsLeft > 0 ? formatClock(secondsLeft) : "Any moment...";
    document.getElementById("invasion-wave").textContent = `Wave ${m.invasion.wave}${isBossWave(m.invasion.wave) ? " (BOSS)" : ""}`;
    const previewKey = String(m.invasion.wave);
    const preview = document.getElementById("enemy-preview");
    if (preview.dataset.key !== previewKey) {
      preview.dataset.key = previewKey;
      preview.innerHTML = "";
      for (const group of getWaveEnemies(m.invasion.wave)) {
        const s = getEnemyStats(group.type, m.invasion.wave);
        const row = document.createElement("li");
        row.className = "enemy-row";
        row.dataset.civ = s.civilization;
        row.appendChild(createPortrait(group.type));
        const text = document.createElement("div");
        text.className = "knight-info";
        text.innerHTML = `<div class="enemy-name">${group.count} × ${s.name}</div>` +
          `<div class="enemy-desc">${s.description}</div>` +
          (s.abilityText ? `<div class="knight-ability">${s.abilityText}</div>` : "") +
          `<div class="knight-stats">${statLine(s)}</div>`;
        text.querySelector(".knight-stats").replaceWith(createStatBars(s));
        if (s.boss) row.classList.add("boss");
        row.appendChild(text);
        preview.appendChild(row);
      }
      const r = getWaveRewards(m.invasion.wave);
      document.getElementById("invasion-reward").textContent = `Victory reward: ${formatNumber(r.gold)} gold, ${formatNumber(r.food)} food`;
    }
    document.getElementById("battle-record").textContent =
      `Victories ${m.battlesWon} · Defeats ${m.battlesLost} · Army experience ${formatNumber(m.experience)}`;

    // Battle log
    const log = document.getElementById("battle-log");
    const logKey = m.log.map(l => l.time).join(",");
    if (log.dataset.key !== logKey) {
      log.dataset.key = logKey;
      log.innerHTML = m.log.length ? "" : "<li class='log-empty'>No battles yet.</li>";
      for (const entry of m.log) {
        const li = document.createElement("li");
        li.className = "log-entry " + (entry.victory ? "won" : "lost");
        li.textContent = `Wave ${entry.wave}: ${entry.victory ? (entry.timedOut ? "Raiders retreated" : "Victory") : "Defeat"} · ` +
          `${entry.enemiesDefeated}/${entry.enemiesTotal} raiders defeated · ${entry.wounded} knights wounded`;
        log.appendChild(li);
      }
    }
  }

  // Warning banner and horn in the last minutes before a raid
  const banner = document.getElementById("invasion-banner");
  const warning = built && !currentBattle && secondsLeft > 0 && secondsLeft <= INVASION.warningSeconds;
  banner.hidden = !warning;
  if (warning) {
    banner.textContent = `Barbarians approach! Raid in ${formatClock(secondsLeft)} · ${countKnights(m.army)} knights ready`;
    if (warnedForInvasionAt !== m.invasion.nextAt) {
      warnedForInvasionAt = m.invasion.nextAt;
      playSound("horn");
    }
  }
  setNavBadge("army", warning);
}


// ---------- Live battle window ----------

function startLiveBattle() {
  currentBattle = createBattle();
  battleView.accumulator = 0;
  battleView.lastMs = performance.now();
  battleView.lastHits = 0;
  battleView.phase = "prep";
  battleView.prepEndsAt = performance.now() + 7000;     // the battle starts by itself after 7 s
  document.getElementById("battle-title").textContent = isBossWave(currentBattle.wave)
    ? `The Chieftain Attacks! · Wave ${currentBattle.wave}` : `Barbarians at the Gates! · Wave ${currentBattle.wave}`;
  fillPrepList("prep-knights", currentBattle.units.filter(u => u.side === "knight"));
  fillPrepList("prep-enemies", currentBattle.units.filter(u => u.side === "enemy"));
  document.getElementById("prep-knights").closest(".prep-side").querySelector(".prep-title").textContent =
    `Your Knights (${currentBattle.units.filter(u => u.side === "knight").length})`;
  document.getElementById("battle-prep").hidden = false;
  document.getElementById("battle-summary").hidden = true;
  document.getElementById("battle-skip").hidden = false;
  document.getElementById("battle-continue").hidden = true;
  openModal("battle-modal");
  playSound("horn");
  requestAnimationFrame(battleFrame);
}

// Lists units by type with a sprite and a count, for the preparation screen.
function fillPrepList(id, units) {
  const list = document.getElementById(id);
  list.innerHTML = "";
  const counts = {};
  for (const u of units) counts[u.typeId] = (counts[u.typeId] || 0) + 1;
  if (units.length === 0) { list.innerHTML = "<li>No knights!</li>"; return; }
  for (const typeId in counts) {
    const li = document.createElement("li");
    li.title = (KNIGHT_TYPES[typeId] || ENEMY_TYPES[typeId]).name;
    li.appendChild(createUnitIcon(typeId));
    li.appendChild(document.createTextNode("×" + counts[typeId]));
    list.appendChild(li);
  }
}

function beginFight() {
  if (!currentBattle || battleView.phase !== "prep") return;
  battleView.phase = "fight";
  battleView.lastMs = performance.now();
  document.getElementById("battle-prep").hidden = true;
  playSound("clash");
}

function skipLiveBattle() {
  if (!currentBattle) return;
  beginFight();
  runBattleToEnd(currentBattle);
}

// Called once the on-screen battle has ended.
function finishLiveBattle() {
  const summary = applyBattleResult(currentBattle);
  saveGame();
  playSound(summary.victory ? "victory" : "defeat");
  showBattleSummary(summary);
  document.getElementById("battle-skip").hidden = true;
  document.getElementById("battle-continue").hidden = false;
  refreshUI();
}

function showBattleSummary(s) {
  const box = document.getElementById("battle-summary");
  const title = s.victory ? (s.timedOut ? "The Raiders Flee!" : "Victory!") : (s.timedOut ? "Your Knights Fall Back" : "Defeat");
  box.innerHTML = "";
  box.className = "battle-summary " + (s.victory ? "won" : "lost");

  const banner = document.createElement("div");
  banner.className = "result-banner";
  banner.textContent = title;
  box.appendChild(banner);

  const grid = document.createElement("div");
  grid.className = "result-grid";
  const stats = [
    ["Knights surviving", `${s.knightsSurviving} / ${s.knightsStart}`],
    ["Enemies defeated", `${s.enemiesDefeated} / ${s.enemiesTotal}`],
    ["Experience earned", formatNumber(s.experience)],
    ["Knights wounded", s.wounded > 0 ? `${s.wounded}` : "None"],
  ];
  for (const [label, value] of stats) {
    const cell = document.createElement("div");
    cell.className = "result-stat";
    const a = document.createElement("span"); a.textContent = label;
    const b = document.createElement("strong"); b.textContent = value;
    cell.append(a, b);
    grid.appendChild(cell);
  }
  box.appendChild(grid);

  // Spoils of war and repair bills, shown with resource icons
  const loot = document.createElement("div");
  loot.className = "loot-row";
  const addChips = (label, items, repair) => {
    const entries = Object.entries(items).filter(([, v]) => v > 0);
    if (!entries.length) return;
    const tag = document.createElement("span");
    tag.textContent = label;
    loot.appendChild(tag);
    for (const [id, value] of entries) {
      const chip = document.createElement("span");
      chip.className = "loot-chip" + (repair ? " repair" : "");
      chip.appendChild(createPixelIcon(id));
      chip.appendChild(document.createTextNode((repair ? "-" : "+") + formatNumber(value)));
      loot.appendChild(chip);
    }
  };
  addChips("Spoils of war:", s.rewards, false);
  addChips("Repairs:", s.repairs, true);
  if (loot.childNodes.length) box.appendChild(loot);

  if (s.wounded > 0) {
    const note = document.createElement("p");
    note.className = "modal-note";
    note.textContent = `${s.wounded} wounded knights are resting in the infirmary and will return soon.`;
    box.appendChild(note);
  }
  box.hidden = false;
}

function closeBattle() {
  currentBattle = null;
  closeModal("battle-modal");
  playSound("click");
  refreshUI();
}


/* =============================================================
   7b. SOUND & MUSIC
   -------------------------------------------------------------
   No audio files! Every sound is made by the browser's Web Audio
   API from simple waves (like an old game console):
     square / triangle / sine waves for notes, and white noise
     for thuds. An "envelope" makes each note start quickly and
     fade out, so it sounds plucked instead of beeping forever.
   Browsers only allow sound after the player clicks something,
   so audio starts on the first click.
   ============================================================= */

let audioCtx = null;
// Browsers block sound until the player has clicked or pressed a key.
let userHasInteracted = false;
for (const eventName of ["pointerdown", "keydown"]) {
  document.addEventListener(eventName, () => { userHasInteracted = true; }, { once: true, capture: true });
}
let sfxGain = null, musicGain = null;

// Creates the audio system the first time it's needed.
function ensureAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
    const master = audioCtx.createGain();
    master.gain.value = 0.5;
    master.connect(audioCtx.destination);
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(master);
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// One note. start = seconds from now. slideTo bends the pitch.
function tone(freq, start, duration, type, volume, output = sfxGain, slideTo = null) {
  const t = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);          // quick attack
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);      // fade out
  osc.connect(gain).connect(output);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

// A short burst of noise (hammer knocks, dust).
function noise(start, duration, volume, filterFreq) {
  const t = audioCtx.currentTime + start;
  const length = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const gain = audioCtx.createGain();
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(sfxGain);
  source.start(t);
}

// Note number -> frequency (69 = A4 = 440 Hz).
function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

const SOUNDS = {
  horn()      { tone(110, 0, 0.9, "sawtooth", 0.07, sfxGain, 147); tone(220, 0.05, 0.8, "square", 0.03, sfxGain, 294); },
  clash()     { noise(0, 0.05, 0.25, 4000); tone(1400 + Math.random() * 400, 0, 0.06, "square", 0.02); },
  victory()   { [[72, 0], [76, 0.15], [79, 0.3], [84, 0.45]].forEach(([n, t]) => { tone(midiToFreq(n), t, 0.5, "square", 0.06); tone(midiToFreq(n - 12), t, 0.5, "triangle", 0.1); }); },
  defeat()    { [[64, 0], [60, 0.25], [57, 0.5]].forEach(([n, t]) => tone(midiToFreq(n), t, 0.6, "triangle", 0.12)); },
  click()     { tone(880, 0, 0.05, "square", 0.05); },
  coins()     { tone(988, 0, 0.08, "square", 0.08); tone(1319, 0.07, 0.25, "square", 0.08); },
  build() {
    noise(0, 0.12, 0.5, 900); noise(0.14, 0.1, 0.4, 700);         // two hammer knocks
    tone(392, 0.22, 0.12, "triangle", 0.2); tone(523, 0.3, 0.25, "triangle", 0.2);
  },
  upgrade()   { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.06, 0.18, "square", 0.06)); },
  research()  { tone(1047, 0, 1.0, "sine", 0.15); tone(1568, 0.02, 0.8, "sine", 0.07); tone(784, 0.15, 0.9, "triangle", 0.08); },
  milestone() {
    const notes = [[67, 0, 0.18], [72, 0.18, 0.18], [76, 0.36, 0.18], [79, 0.54, 0.6]];
    for (const [n, t, d] of notes) { tone(midiToFreq(n), t, d, "square", 0.07); tone(midiToFreq(n - 12), t, d, "triangle", 0.12); }
  },
};

// Plays a sound effect if sound is switched on.
function playSound(name) {
  if (!state.settings.sound || !SOUNDS[name] || !userHasInteracted) return;
  if (!ensureAudio()) return;
  SOUNDS[name]();
}

// ---------- Music ----------
// A gentle lute-like tune in D dorian over a soft drone. Notes are
// [note number, length in beats]; 0 = rest. Phrases are picked at
// random, so the tune doesn't repeat exactly.
const MUSIC_BPM = 84;
const MUSIC_PHRASES = [
  [[62, 1], [65, 1], [69, 1], [67, 1], [65, 1], [64, 1], [62, 2]],
  [[69, 1], [72, 1], [71, 0.5], [69, 0.5], [67, 1], [69, 2], [0, 2]],
  [[65, 1.5], [67, 0.5], [69, 1], [74, 1], [72, 1], [69, 1], [67, 2]],
  [[62, 0.5], [64, 0.5], [65, 1], [62, 1], [60, 1], [62, 3], [0, 1]],
  [[74, 1], [72, 1], [69, 1], [71, 1], [67, 1], [69, 1], [62, 2]],
];
let musicTimer = null;
let musicNextTime = 0;
let musicNoteQueue = [];
let droneNodes = [];

// A plucked note: bright at first, then softer (like a lute string).
function pluck(note, time, duration) {
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.value = midiToFreq(note);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2400, time);
  filter.frequency.exponentialRampToValueAtTime(500, time + duration);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.35, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration * 1.6);
  osc.connect(filter).connect(gain).connect(musicGain);
  osc.start(time);
  osc.stop(time + duration * 1.7);
}

// Looks a little ahead and schedules the next notes on the audio clock,
// so the timing stays steady even if the page is busy.
function scheduleMusic() {
  const beat = 60 / MUSIC_BPM;
  while (musicNextTime < audioCtx.currentTime + 0.6) {
    if (musicNoteQueue.length === 0) {
      musicNoteQueue = MUSIC_PHRASES[Math.floor(Math.random() * MUSIC_PHRASES.length)].slice();
    }
    const [note, beats] = musicNoteQueue.shift();
    if (note) {
      pluck(note, musicNextTime, beats * beat);
      if (Math.random() < 0.35) pluck(note - 12, musicNextTime, beats * beat);   // occasional low octave
    }
    musicNextTime += beats * beat;
  }
}

function startMusic() {
  if (musicTimer || !ensureAudio()) return;
  musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
  musicGain.gain.setTargetAtTime(0.22, audioCtx.currentTime, 0.8);    // fade in
  // Soft drone on D and A
  droneNodes = [50, 57].map(note => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = midiToFreq(note);
    gain.gain.value = 0.08;
    osc.connect(gain).connect(musicGain);
    osc.start();
    return osc;
  });
  musicNextTime = audioCtx.currentTime + 0.3;
  musicNoteQueue = [];
  scheduleMusic();
  musicTimer = setInterval(scheduleMusic, 200);
}

function stopMusic() {
  if (!musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = null;
  musicGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);       // fade out
  const now = audioCtx.currentTime;
  for (const osc of droneNodes) osc.stop(now + 1.5);
  droneNodes = [];
}

// Applies the saved settings and updates the on/off buttons.
function applyAudioSettings() {
  if (state.settings.music) startMusic(); else stopMusic();
  for (const b of document.querySelectorAll(".toggle-sound")) {
    b.setAttribute("aria-pressed", state.settings.sound);
    b.querySelector(".toggle-state").textContent = state.settings.sound ? "On" : "Off";
  }
  for (const b of document.querySelectorAll(".toggle-music")) {
    b.setAttribute("aria-pressed", state.settings.music);
    b.querySelector(".toggle-state").textContent = state.settings.music ? "On" : "Off";
  }
}

function setupAudioControls() {
  for (const b of document.querySelectorAll(".toggle-sound")) {
    b.addEventListener("click", () => {
      state.settings.sound = !state.settings.sound;
      applyAudioSettings();
      playSound("click");
      saveGame();
    });
  }
  for (const b of document.querySelectorAll(".toggle-music")) {
    b.addEventListener("click", () => {
      state.settings.music = !state.settings.music;
      applyAudioSettings();
      saveGame();
    });
  }
  // Music can only start after a click, so if it was left on, start it
  // on the player's first click anywhere.
  document.addEventListener("pointerdown", () => {
    if (state.settings.music) startMusic();
  }, { once: true });
  // Pause all sound while the tab is hidden.
  document.addEventListener("visibilitychange", () => {
    if (!audioCtx) return;
    if (document.hidden) audioCtx.suspend();
    else if (state.settings.music || state.settings.sound) audioCtx.resume();
  });
  applyAudioSettings();
}


/* =============================================================
   8. VILLAGE DRAWING                                  (Stage 4)
   -------------------------------------------------------------
   The village is painted on a small 480x270 canvas, then CSS
   scales it up with nearest-neighbor ("pixelated") scaling so
   every pixel stays sharp.

   HOW THE 3D LOOK WORKS - "ISOMETRIC" VIEW
   The ground is a grid of diamond-shaped tiles (VILLAGE_MAP).
   The function iso(tx, ty, z) turns a grid position plus a
   height (z, in pixels) into a screen position:
       moving +1 in tx  ->  10 px right, 5 px down
       moving +1 in ty  ->  10 px left,  5 px down
       moving +1 in z   ->  1 px up
   Every building is a box: we see its LEFT wall (sunlit), its
   RIGHT wall (in shade) and its roof. Tiles have heights too,
   so hills and cliffs show their rocky sides, and the whole
   village sits on a thick floating island.

   Things further back are drawn first and nearer things later
   (the "painter's algorithm"), so nearer objects cover farther
   ones - even moving workers walking behind houses.

   WHAT IS CACHED
   Drawing thousands of pixels 30 times a second would be slow,
   so the ground and every building are painted ONCE into small
   hidden canvases ("sprites") and simply copied each frame.
   Only animated things (workers, smoke, flags, water, crops,
   day/night lighting) are drawn fresh every frame.
   ============================================================= */

// ---------- Settings you can tweak ----------
const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 270;
const TILE_W = 20;                   // width of one ground tile on screen
const TILE_H = 10;                   // height of one ground tile on screen
const MAP_SIZE = 20;                 // the map is 20 x 20 tiles
const LEVEL_HEIGHT = 6;              // pixels per terrain height level
const ISLAND_DEPTH = 24;             // thickness of the floating island
const ORIGIN_X = 240;                // screen position of the map's back corner
const ORIGIN_Y = 42;
const DAY_LENGTH_SECONDS = 480;      // one full day + night = 8 minutes
const CROP_CYCLE_SECONDS = 120;      // how long crops take to grow and be harvested
const FRAME_INTERVAL_MS = 1000 / 30; // redraw at most 30 times per second
const MAX_WORKERS = 16;

const PAL = {
  outline: "#2b1d14",
  // Sky (day / dusk / night versions are blended over time)
  daySky:   ["#3f86cc", "#4f95d6", "#62a6df", "#78b7e7", "#90c8ee", "#aad7f3"],
  duskSky:  ["#3b4f93", "#6a5ca0", "#a86a9a", "#e08a7a", "#f2a86a", "#f8c878"],
  nightSky: ["#0b1230", "#101a3e", "#16234c", "#1d2d5a", "#263a68", "#304676"],
  sun: "#fff3b0", sunGlow: "#ffe27a", moon: "#eef2ff", moonShade: "#c9d0ea", star: "#ffffff",
  cloud: "#ffffff", cloudShade: "#d5e2f0", cloudDeep: "#b9c9df",
  mountFar: "#8d9cc0", mountFarDark: "#7584ab", mountNear: "#7a8fae", mountNearDark: "#64789a",
  snow: "#f1f5fa", snowShade: "#c6d3e3",
  // Ground tops
  grass: "#5d9640", grassAlt: "#629b44", grassDark: "#4d8236", grassLight: "#76b052",
  grassDeep: "#3d6b2b", forestFloor: "#4f8538",
  flowerY: "#f2d04e", flowerW: "#f6ead0", flowerR: "#d8604a", flowerP: "#b688dc",
  dirt: "#a07a4a", dirtDark: "#7f5d36", dirtLight: "#b98f58",
  sand: "#d8c08a", sandDark: "#bca46e",
  cobble: "#a29c8e", cobbleLight: "#bdb7a8", cobbleDark: "#858074", cobbleGap: "#66615a",
  water: "#3f86c0", waterLight: "#9fd2f2", waterDark: "#2d6597", foam: "#e8f6ff",
  rock: "#a19d92", rockLight: "#c3bfb3", rockDark: "#7b776d", rockDeep: "#5a574f",
  // Island sides (lit left side / shaded right side)
  soilL: "#8d6542", soilDarkL: "#70502f", deepRockL: "#6c645a",
  soilR: "#6f4e30", soilDarkR: "#573c22", deepRockR: "#4f4941",
  // Buildings
  plaster: "#ece0c4", plasterShade: "#c5b391", timber: "#4f3220",
  wood: "#8a5a32", woodDark: "#5f3d22", woodLight: "#a87443", woodDeep: "#46301c",
  stone: "#aaa699", stoneDark: "#7d796f", stoneLight: "#cbc7ba", stoneDeep: "#5a574f",
  roofRed: "#b04a2e", roofRedDark: "#7c321f", roofRedLight: "#d06a44",
  thatch: "#d6a94c", thatchDark: "#a07a2c", thatchLight: "#f0cc70",
  slate: "#3f8070", slateDark: "#2b5a4f", slateLight: "#62a894",
  blueRoof: "#4b6290", blueRoofDark: "#34466a", blueRoofLight: "#6c84b2",
  barn: "#b43c2a", barnDark: "#82281a", barnLight: "#cf5a40",
  glass: "#f6d886", door: "#4a2f1d",
  banner: "#3a5fa8", bannerDark: "#26407a", gold: "#f2c14e", goldDark: "#b8862b",
  metal: "#c4c4cc", metalDark: "#7a7a84",
  cloth: "#f1e8d4", red: "#c8442f", blue: "#3a6fb5", green: "#4f9a4a", purple: "#8a5aa8",
  // Nature
  leaf: "#4a8a3a", leafDark: "#336a2b", leafDeep: "#24501f", leafLight: "#6aaa4a", leafBright: "#93cd62",
  pine: "#2f6a42", pineDark: "#1f4d30", pineLight: "#4a8a56",
  trunk: "#5c3a21", trunkDark: "#3f2716",
  soil: "#6b4a2a", soilDark: "#4f351d", soilLight: "#86603a",
  wheat: "#d9a441", wheatLight: "#f0cf6a", sprout: "#7fbf4f", crop: "#5fa04a", cropDark: "#3f7a34",
  pumpkin: "#e07a2a", cabbage: "#9ad372",
  logEnd: "#e0b77a", logRing: "#b98a4e",
  skin: "#e8b796", skinDark: "#c98f6c",
  fire: "#f08a2a", fireLight: "#ffd860",
};

// Semi-transparent shadow so it darkens whatever is underneath.
const SHADOW = "rgba(16, 32, 8, 0.32)";


// ---------- The map ----------
// One letter per tile. Row = ty (0 at the back), column = tx.
// On screen, rows run down-left and columns run down-right.
//   G grass   F forest   H castle hill   m/M mountain   q/Q quarry hill
//   h grassy hill   f forested hill (both one level up)
//   W water   B bridge   S sand   R road   P plaza   T stairs
const VILLAGE_MAP = [
  "MMMmmFFFFFFqQQqffffF",
  "MMmmFFGGGGGqQQqGffff",
  "MmmFGGGGGGGGqqGGGFff",
  "mmFGGGGGGGGGGGGGGGff",
  "mWGGHHHHHHGGGGGGGGff",
  "FWGGHHHHHHGGGGGGGGGf",
  "FWGGHHHHHHGGGGGGGGGF",
  "FWGGHHHHHHGGGGGGGGGF",
  "FWGGHHHHHHGGGGGGGGFF",
  "FWGGHHHHHHGGGGGGGGFF",
  "FWSGGGGTTGGGGGGRGGGF",
  "GWSGGGGRRPPPPGGRGGGF",
  "RBRRRRRRRPPPPRRRGGGF",
  "GWSGGGGGGPPPPGGGGGGG",
  "GWSGGGGGGGRRGGGGGGGG",
  "GWSGGGGGGGRRGGGGGGGF",
  "GWWSGGGGGGRRGGGGGGff",
  "hhWSGGGGGGRRGGGGGfff",
  "hhWWSGGGGGRRGGGGffff",
  "hhhWSGGGGGRRGGGfffff",
];

// What each letter means: the kind of ground and its height level.
const TILE_TYPES = {
  G: { kind: "grass",  level: 0 },
  F: { kind: "forest", level: 0 },
  h: { kind: "grass",  level: 1 },
  f: { kind: "forest", level: 1 },
  H: { kind: "grass",  level: 2 },
  m: { kind: "rock",   level: 3 },
  M: { kind: "snow",   level: 4 },
  q: { kind: "rock",   level: 2 },
  Q: { kind: "rock",   level: 3 },
  W: { kind: "water",  level: -0.5 },
  B: { kind: "water",  level: -0.5 },
  S: { kind: "sand",   level: 0 },
  R: { kind: "road",   level: 0 },
  T: { kind: "road",   level: 0 },
  P: { kind: "plaza",  level: 0 },
};

// Where buildings stand (in tiles). Fields appear one per farm.
const VILLAGE_LAYOUT = {
  barn:        { x: 3, y: 13 },
  farmFields:  [{ x: 6, y: 13, w: 3, d: 3 }, { x: 4, y: 16, w: 3, d: 2 }, { x: 7, y: 16, w: 3, d: 3 }, { x: 5, y: 18, w: 2, d: 2 }],
  lumberMill:  { x: 15, y: 8 },
  marketStalls: [{ x: 9, y: 11 }, { x: 12, y: 11 }, { x: 9, y: 13 }, { x: 12, y: 13 }],
  huts:        [{ x: 12, y: 7 }, { x: 13, y: 13 }, { x: 12, y: 15 }],
  // Plots for houses you build, filled in this order (2x2 tiles each)
  housePlots:  [{ x: 15, y: 14 }, { x: 17, y: 12 }, { x: 13, y: 17 }, { x: 15, y: 16 },
                { x: 10, y: 6 }, { x: 12, y: 5 }, { x: 15, y: 2 }, { x: 2, y: 8 }],
  blacksmith:  { x: 13, y: 9 },
  barracks:    { x: 2, y: 5 },
  academy:     { x: 16, y: 5 },
  quarryCut:   [[12, 1], [13, 1], [12, 2], [13, 2]],   // tiles dug out when a quarry is built
};

const FIELD_CROPS = ["wheat", "cabbage", "pumpkin", "wheat"];
const STALL_COLORS = [PAL.red, PAL.blue, PAL.green, PAL.purple];

// Paths the little workers walk along: [tx, ty, z] points.
// "needs" = only used once that building exists. "loop" = walk in a circle.
const WORKER_ROUTES = [
  { needs: null,         carry: null,    points: [[9.3, 12.5, 0], [0.3, 12.5, 0]] },
  { needs: null,         carry: "sack",  points: [[11, 13.8, 0], [11, 19.6, 0]] },
  { needs: null,         carry: null,    loop: true, points: [[9.4, 11.5, 0], [12.6, 11.5, 0], [12.6, 13.6, 0], [9.4, 13.6, 0]] },
  { needs: null,         carry: null,    points: [[9.2, 11.6, 0], [7.8, 11.6, 0], [7.8, 11.25, 0], [7.8, 10.05, 12], [7.8, 9.5, 12]] },
  { needs: "farm",       carry: "wheat", points: [[6.3, 14.5, 0], [8.8, 14.5, 0]] },
  { needs: "farm",       carry: "wheat", points: [[4.6, 15.3, 0], [2.6, 15.3, 0], [2.6, 12.7, 0]] },
  { needs: "lumberMill", carry: "log",   points: [[12.8, 12.5, 0], [15.5, 12.5, 0], [15.5, 10.2, 0]] },
  { needs: "lumberMill", carry: "log",   points: [[14.2, 10.5, 0], [18.2, 10.5, 0]] },
  { needs: "quarry",     carry: "stone", points: [[11.2, 3.6, 0], [14.8, 3.6, 0], [14.8, 6.8, 0]] },
  { needs: "blacksmith", carry: "stone", points: [[13.5, 11.4, 0], [15.4, 11.4, 0]] },
  { needs: "academy",    carry: "crate", points: [[15.5, 7.6, 0], [15.5, 9.6, 0]] },
  { needs: "market",     carry: "crate", points: [[9.6, 12.3, 0], [12.5, 12.6, 0]] },
];
const KNIGHT_DRILL_ROUTE = { needs: null, carry: "sword", points: [[2.2, 7.6, 0], [3.9, 7.6, 0]] };
const SHIRT_COLORS = ["#3a6fb5", "#c8442f", "#4f9a4a", "#8a5aa8", "#d9a441", "#e07a2a", "#5c8a9a"];
const HAIR_COLORS = ["#4a2f1d", "#2b1d14", "#a8642a", "#d9b25a", "#6b4528"];


// ---------- Scene state ----------
let villageCanvas, villageCtx;
let villageNeedsRedraw = true;   // true = rebuild cached art (e.g. after building)
let tiles = null;                // the tile map with heights
let terrainCanvas = null;        // cached ground
let backgroundCanvas = null;     // cached distant mountains + cloud sea
let islandMask = null;           // island shape, used for cloud shadows
let shadowLayer = null;          // scratch canvas for cloud shadows
let skyCache = { key: -1, canvas: null };
let sceneObjects = [];           // cached buildings, trees, props
let fx = null;                   // lights, chimneys, flags... found while drawing
let smokePuffs = [];
let burstParticles = [];      // dust and sparkles when you build or upgrade
let pendingBursts = [];       // bursts waiting for the scene to be rebuilt
let lastFrameMs = 0;

// Call this whenever something visible changes (e.g. a new building).
function markVillageDirty() {
  villageNeedsRedraw = true;
}


// ---------- Basic drawing tools ----------

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Fill any polygon one pixel-row at a time, for hard pixel edges.
function fillPoly(ctx, points, color) {
  ctx.fillStyle = color;
  const ys = points.map(p => p[1]);
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));
  for (let y = minY; y < maxY; y++) {
    const scanY = y + 0.5;
    const crossings = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY)) {
        crossings.push(x1 + ((scanY - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const left = Math.round(crossings[i]);
      const right = Math.round(crossings[i + 1]);
      if (right > left) ctx.fillRect(left, y, right - left, 1);
    }
  }
}

function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  const rows = Math.max(1, Math.round(ry));
  for (let dy = -rows; dy < rows; dy++) {
    const t = (dy + 0.5) / rows;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    if (half > 0) ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, 1);
  }
}

// A 1-pixel line with no blur (Bresenham's line algorithm).
function drawLine(ctx, x0, y0, x1, y1, color) {
  ctx.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 2000; guard++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoint(p, q, t) {
  return [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
}

// Blend two "#rrggbb" colors.
function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

// Repeatable "random" numbers: same seed, same village every time.
function makeRandom(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// Grid position (+ height in pixels) -> screen position.
function iso(tx, ty, z = 0) {
  return [ORIGIN_X + (tx - ty) * (TILE_W / 2), ORIGIN_Y + (tx + ty) * (TILE_H / 2) - z];
}

// A hidden canvas holding a pre-drawn picture. `bounds` is the area
// (in screen pixels) the drawing covers.
function makeSprite(bounds, drawFn) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(bounds.w));
  canvas.height = Math.max(1, Math.ceil(bounds.h));
  const ctx = canvas.getContext("2d");
  ctx.translate(-Math.floor(bounds.x), -Math.floor(bounds.y));
  drawFn(ctx);
  return { canvas, x: Math.floor(bounds.x), y: Math.floor(bounds.y) };
}

// Screen area covered by a box of the given height (plus padding).
function boxBounds(box, height, pad = 6) {
  const pts = [
    iso(box.x, box.y, box.z + height), iso(box.x + box.w, box.y, box.z + height),
    iso(box.x, box.y + box.d, box.z), iso(box.x + box.w, box.y + box.d, box.z),
    iso(box.x + box.w, box.y, box.z), iso(box.x, box.y + box.d, box.z + height),
  ];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

// Effects found while drawing (night lights, chimneys, flags...).
function newEffects() {
  return { lights: [], chimneys: [], flags: [], saws: [], fires: [], sparkles: [], falls: [], fireflies: [], shadows: [], groundDraws: [] };
}
function addLight(x, y, r = 5) { fx.lights.push({ x, y, r }); }


// ---------- 3D boxes, walls and roofs ----------
// A "box" is { x, y, w, d, z }: position and size in tiles, z in pixels.

function drawIsoBox(ctx, box, h, left, right, top) {
  const { x, y, w, d, z } = box;
  const zt = z + h;
  fillPoly(ctx, [iso(x, y + d, zt), iso(x + w, y + d, zt), iso(x + w, y + d, z), iso(x, y + d, z)], left);
  fillPoly(ctx, [iso(x + w, y + d, zt), iso(x + w, y, zt), iso(x + w, y, z), iso(x + w, y + d, z)], right);
  if (top) fillPoly(ctx, [iso(x, y, zt), iso(x + w, y, zt), iso(x + w, y + d, zt), iso(x, y + d, zt)], top);
}

// A patch on the LEFT wall: u = tiles from the wall's left end, v = pixels up.
function faceL(ctx, box, u, v, uw, vh, color) {
  const fy = box.y + box.d, z = box.z;
  fillPoly(ctx, [iso(box.x + u, fy, z + v), iso(box.x + u + uw, fy, z + v),
    iso(box.x + u + uw, fy, z + v + vh), iso(box.x + u, fy, z + v + vh)], color);
}

// A patch on the RIGHT wall: u = tiles from the wall's back end.
function faceR(ctx, box, u, v, uw, vh, color) {
  const fx2 = box.x + box.w, z = box.z;
  fillPoly(ctx, [iso(fx2, box.y + u, z + v), iso(fx2, box.y + u + uw, z + v),
    iso(fx2, box.y + u + uw, z + v + vh), iso(fx2, box.y + u, z + v + vh)], color);
}

// Horizontal line along a wall at height v.
function lineL(ctx, box, v, color) {
  drawLine(ctx, ...iso(box.x, box.y + box.d, box.z + v), ...iso(box.x + box.w, box.y + box.d, box.z + v), color);
}
function lineR(ctx, box, v, color) {
  drawLine(ctx, ...iso(box.x + box.w, box.y + box.d, box.z + v), ...iso(box.x + box.w, box.y, box.z + v), color);
}

// Vertical beam on a wall.
function postL(ctx, box, u, h, color) {
  const [px, py] = iso(box.x + u, box.y + box.d, box.z);
  rect(ctx, px, py - h, 1, h, color);
}
function postR(ctx, box, u, h, color) {
  const [px, py] = iso(box.x + box.w, box.y + u, box.z);
  rect(ctx, px, py - h, 1, h, color);
}

function windowL(ctx, box, u, v, uw = 0.3, vh = 4) {
  faceL(ctx, box, u - 0.07, v - 1, uw + 0.14, vh + 2, PAL.timber);
  faceL(ctx, box, u, v, uw, vh, PAL.glass);
  const [mx, my] = iso(box.x + u + uw / 2, box.y + box.d, box.z + v);
  rect(ctx, mx, my - vh, 1, vh, PAL.timber);
  addLight(mx, my - vh / 2, 6);
}
function windowR(ctx, box, u, v, uw = 0.3, vh = 4) {
  faceR(ctx, box, u - 0.07, v - 1, uw + 0.14, vh + 2, PAL.timber);
  faceR(ctx, box, u, v, uw, vh, PAL.glass);
  const [mx, my] = iso(box.x + box.w, box.y + u + uw / 2, box.z + v);
  rect(ctx, mx, my - vh, 1, vh, PAL.timber);
  addLight(mx, my - vh / 2, 6);
}
function doorL(ctx, box, u, uw = 0.32, vh = 8) {
  faceL(ctx, box, u - 0.07, 0, uw + 0.14, vh + 1, PAL.timber);
  faceL(ctx, box, u, 0, uw, vh, PAL.door);
  const [kx, ky] = iso(box.x + u + uw - 0.08, box.y + box.d, box.z + vh / 2);
  rect(ctx, kx, ky, 1, 1, PAL.gold);
}

// Brick lines on both visible walls.
function paintBricks(ctx, box, h, darkL, darkR) {
  for (let v = 3; v < h; v += 3) {
    lineL(ctx, box, v, darkL);
    lineR(ctx, box, v, darkR);
    const shift = (v / 3) % 2 ? 0.2 : 0;
    for (let u = 0.1 + shift; u < box.w; u += 0.4) faceL(ctx, box, u, v - 2, 0.05, 2, darkL);
    for (let u = 0.1 + shift; u < box.d; u += 0.4) faceR(ctx, box, u, v - 2, 0.05, 2, darkR);
  }
}

// Roof styles
const ROOF_THATCH = { roof: PAL.thatch, dark: PAL.thatchDark, light: PAL.thatchLight, kind: "thatch" };
const ROOF_RED    = { roof: PAL.roofRed, dark: PAL.roofRedDark, light: PAL.roofRedLight, kind: "shingle" };
const ROOF_BLUE   = { roof: PAL.blueRoof, dark: PAL.blueRoofDark, light: PAL.blueRoofLight, kind: "shingle" };
const ROOF_SLATE  = { roof: PAL.slate, dark: PAL.slateDark, light: PAL.slateLight, kind: "shingle" };
const ROOF_WOOD   = { roof: PAL.wood, dark: PAL.woodDark, light: PAL.woodLight, kind: "shingle" };

// Lines across a roof slope, parallel to its bottom edge (eave).
function paintRoofSlope(ctx, eaveA, eaveB, ridgeA, ridgeB, style, lineColor) {
  if (style.kind === "stripes") {
    const n = 6;
    for (let k = 1; k < n; k += 2) {
      fillPoly(ctx, [lerpPoint(eaveA, eaveB, k / n), lerpPoint(eaveA, eaveB, (k + 1) / n),
        lerpPoint(ridgeA, ridgeB, (k + 1) / n), lerpPoint(ridgeA, ridgeB, k / n)], style.stripe);
    }
    return;
  }
  const rows = 4;
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    drawLine(ctx, ...lerpPoint(eaveA, ridgeA, t), ...lerpPoint(eaveB, ridgeB, t), lineColor);
  }
  if (style.kind === "thatch") {
    for (let j = 0.1; j < 1; j += 0.14) {
      drawLine(ctx, ...lerpPoint(eaveA, eaveB, j), ...lerpPoint(ridgeA, ridgeB, j), style.light);
    }
  }
}

// A pitched roof on a box with walls `wallH` tall and a peak `rh` tall.
//   axis "x": the ridge runs toward the lower-right
//   axis "y": the ridge runs toward the lower-left
//   gable:    color of the triangle of wall under the roof's end
//   between:  optional function drawn between the back and front of
//             the roof (used for chimneys that poke through)
function drawRoof(ctx, box, wallH, rh, style, axis, gable, between) {
  const o = 0.12;
  const z = box.z + wallH;
  const x0 = box.x - o, x1 = box.x + box.w + o, y0 = box.y - o, y1 = box.y + box.d + o;
  if (axis === "x") {
    const ym = box.y + box.d / 2;
    const rL = iso(x0, ym, z + rh), rR = iso(x1, ym, z + rh);
    const backL = iso(x0, y0, z), backR = iso(x1, y0, z);
    const frontL = iso(x0, y1, z), frontR = iso(x1, y1, z);
    fillPoly(ctx, [backL, backR, rR, rL], style.dark);
    if (between) between();
    fillPoly(ctx, [iso(box.x + box.w, box.y, z), iso(box.x + box.w, box.y + box.d, z), iso(box.x + box.w, ym, z + rh)], gable);
    fillPoly(ctx, [frontL, frontR, rR, rL], style.roof);
    paintRoofSlope(ctx, frontL, frontR, rL, rR, style, style.dark);
    drawLine(ctx, ...rL, ...rR, style.light);
    drawLine(ctx, ...frontL, ...frontR, style.dark);
    drawLine(ctx, ...frontR, ...rR, style.dark);
    drawLine(ctx, ...rR, ...backR, style.dark);
  } else {
    const xm = box.x + box.w / 2;
    const rB = iso(xm, y0, z + rh), rF = iso(xm, y1, z + rh);
    const lF = iso(x0, y1, z), lB = iso(x0, y0, z);
    const rFe = iso(x1, y1, z), rBe = iso(x1, y0, z);
    fillPoly(ctx, [rFe, rBe, rB, rF], style.dark);
    fillPoly(ctx, [lF, lB, rB, rF], style.roof);
    paintRoofSlope(ctx, lF, lB, rF, rB, style, style.dark);
    paintRoofSlope(ctx, rFe, rBe, rF, rB, { ...style, light: style.dark }, PAL.outline);
    fillPoly(ctx, [iso(box.x, box.y + box.d, z), iso(box.x + box.w, box.y + box.d, z), iso(xm, box.y + box.d, z + rh)], gable);
    drawLine(ctx, ...rB, ...rF, style.light);
    drawLine(ctx, ...lF, ...rF, style.dark);
    drawLine(ctx, ...rF, ...rFe, style.dark);
    if (between) between();
  }
}

// Small stone chimney that also releases smoke.
function drawChimney(ctx, tx, ty, z, h) {
  const box = { x: tx, y: ty, w: 0.28, d: 0.28, z };
  drawIsoBox(ctx, box, h, PAL.stone, PAL.stoneDark, PAL.stoneDeep);
  const [cx, cy] = iso(tx + 0.14, ty + 0.14, z + h);
  fx.chimneys.push({ x: cx, y: cy - 1 });
}

// Upright cylinder (towers, wells). Shaded from light (left) to dark (right).
function drawCylinder(ctx, sx, sy, r, h, shades, bricks) {
  const ry = r / 2;
  for (let i = -r; i < r; i++) {
    const t = (i + r) / (2 * r);
    const c = t < 0.3 ? shades[0] : t < 0.65 ? shades[1] : t < 0.85 ? shades[2] : shades[3];
    const curve = Math.round(Math.sqrt(Math.max(0, 1 - ((i + 0.5) / r) ** 2)) * ry);
    rect(ctx, sx + i, sy - h + curve, 1, h, c);
    if (bricks) {
      for (let k = 3; k < h; k += 3) {
        rect(ctx, sx + i, sy - h + curve + k, 1, 1, shades[3]);
        if ((i + k) % 5 === 0) rect(ctx, sx + i, sy - h + curve + k - 2, 1, 2, shades[3]);
      }
    }
  }
  fillEllipse(ctx, sx, sy - h, r, ry, shades[0]);
}

// Pointed roof for a round tower.
function drawCone(ctx, sx, sy, r, coneH, light, dark) {
  const ry = Math.max(1, Math.round(r / 2));
  for (let dy = 0; dy < ry; dy++) {
    const t = (dy + 0.5) / ry;
    const half = Math.round(r * Math.sqrt(1 - t * t));
    rect(ctx, sx - half, sy + dy, half, 1, light);
    rect(ctx, sx, sy + dy, half, 1, dark);
  }
  fillPoly(ctx, [[sx - r, sy + 0.5], [sx, sy - coneH], [sx, sy + 0.5]], light);
  fillPoly(ctx, [[sx, sy - coneH], [sx + r, sy + 0.5], [sx, sy + 0.5]], dark);
  for (let y = sy - coneH + 4; y < sy; y += 3) {
    const half = Math.round(((y - (sy - coneH)) / coneH) * r);
    rect(ctx, sx - half, y, half * 2, 1, dark);
  }
}

// A round stone tower with a pointed roof and a flag.
function drawTower(ctx, tx, ty, z, r, h, coneH, flagColor = PAL.banner) {
  const [sx, sy] = iso(tx, ty, z);
  fillEllipse(ctx, sx + 4, sy + 2, r + 3, r / 2 + 1, SHADOW);
  drawCylinder(ctx, sx, sy, r, h, [PAL.stoneLight, PAL.stone, PAL.stoneDark, PAL.stoneDeep], true);
  for (let y = sy - h + 8; y < sy - 6; y += 10) {           // windows
    rect(ctx, sx - 2, y, 2, 4, PAL.outline);
    rect(ctx, sx - 2, y + 1, 2, 2, PAL.glass);
    addLight(sx - 1, y + 2, 5);
  }
  rect(ctx, sx - r - 1, sy - h - 1, 2 * r + 2, 2, PAL.stoneLight);   // rim
  drawCone(ctx, sx, sy - h, r + 2, coneH, PAL.slateLight, PAL.slateDark);
  rect(ctx, sx, sy - h - coneH - 8, 1, 8, PAL.outline);             // flagpole
  fx.flags.push({ x: sx + 1, y: sy - h - coneH - 8, color: flagColor });
}

// Low stone wall with battlements along the top.
function drawCastleWall(ctx, box, h) {
  drawIsoBox(ctx, box, h, PAL.stone, PAL.stoneDark, PAL.stoneLight);
  lineL(ctx, box, 3, PAL.stoneDark);
  lineL(ctx, box, 6, PAL.stoneDark);
  lineR(ctx, box, 3, PAL.stoneDeep);
  lineR(ctx, box, 6, PAL.stoneDeep);
  const alongX = box.w > box.d;
  const length = alongX ? box.w : box.d;
  for (let u = 0; u < length - 0.1; u += 0.5) {
    const merlon = alongX
      ? { x: box.x + u, y: box.y, w: 0.25, d: box.d, z: box.z + h }
      : { x: box.x, y: box.y + u, w: box.w, d: 0.25, z: box.z + h };
    drawIsoBox(ctx, merlon, 3, PAL.stone, PAL.stoneDark, PAL.stoneLight);
  }
}


// ---------- The ground ----------

// Builds the tile grid from VILLAGE_MAP plus changes from buildings.
function buildTileMap() {
  const grid = [];
  for (let ty = 0; ty < MAP_SIZE; ty++) {
    const row = [];
    for (let tx = 0; tx < MAP_SIZE; tx++) {
      const letter = VILLAGE_MAP[ty][tx];
      const type = TILE_TYPES[letter] || TILE_TYPES.G;
      row.push({ letter, kind: type.kind, z: type.level * LEVEL_HEIGHT });
    }
    grid.push(row);
  }
  if (state.buildings.quarry.count > 0) {
    for (const [tx, ty] of VILLAGE_LAYOUT.quarryCut) grid[ty][tx] = { letter: "c", kind: "cut", z: LEVEL_HEIGHT };
  }
  const fieldCount = Math.min(state.buildings.farm.count, VILLAGE_LAYOUT.farmFields.length);
  for (let i = 0; i < fieldCount; i++) {
    const f = VILLAGE_LAYOUT.farmFields[i];
    for (let ty = f.y; ty < f.y + f.d; ty++) {
      for (let tx = f.x; tx < f.x + f.w; tx++) grid[ty][tx] = { letter: "s", kind: "soil", z: 0 };
    }
  }
  return grid;
}

function tileZ(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_SIZE || ty >= MAP_SIZE) return null;
  return tiles[ty][tx].z;
}

// Colors for the top of each kind of tile.
function tileTopColor(tile, tx, ty) {
  const checker = (tx + ty) % 2 === 0;
  switch (tile.kind) {
    case "grass": return checker ? PAL.grass : PAL.grassAlt;
    case "forest": return PAL.forestFloor;
    case "rock": case "cut": return PAL.rock;
    case "snow": return PAL.snow;
    case "water": return PAL.water;
    case "sand": return PAL.sand;
    case "road": return PAL.cobbleGap;
    case "plaza": return PAL.cobbleGap;
    case "soil": return PAL.soil;
    default: return PAL.grass;
  }
}

// Paints the side of a tile (a cliff, river bank or the island's edge)
// in layers: grass lip, soil, darker soil, then rock.
function paintTileSide(g, side, tx, ty, zTop, zBottom, tile, random) {
  const a = side === "left" ? [tx, ty + 1] : [tx + 1, ty];
  const b = [tx + 1, ty + 1];
  const lit = side === "left";
  const band = (from, to, color) => {
    const z1 = zTop - from, z2 = Math.max(zBottom, zTop - to);
    if (z2 >= z1) return;
    fillPoly(g, [iso(a[0], a[1], z1), iso(b[0], b[1], z1), iso(b[0], b[1], z2), iso(a[0], a[1], z2)], color);
  };
  const rocky = tile.kind === "rock" || tile.kind === "snow" || tile.kind === "cut";
  if (rocky) {
    band(0, 99, lit ? PAL.rock : PAL.rockDark);
    band(0, 1, lit ? PAL.rockLight : PAL.rock);
    for (let s = 5; s < zTop - zBottom; s += 5) band(s, s + 1, lit ? PAL.rockDark : PAL.rockDeep);
  } else {
    const lip = tile.kind === "road" || tile.kind === "plaza" ? PAL.cobbleDark
      : tile.kind === "sand" ? PAL.sandDark : tile.kind === "soil" ? PAL.soilDark
      : lit ? PAL.grassDark : PAL.grassDeep;
    band(0, 99, lit ? PAL.deepRockL : PAL.deepRockR);
    band(0, 14, lit ? PAL.soilDarkL : PAL.soilDarkR);
    band(0, 8, lit ? PAL.soilL : PAL.soilR);
    band(0, 2, lip);
  }
  // Pebbles and roots for texture
  const height = zTop - zBottom;
  for (let i = 0; i < height / 3; i++) {
    const t = random();
    const [px, py] = iso(lerp(a[0], b[0], t), lerp(a[1], b[1], t), zTop - 3 - random() * (height - 4));
    rect(g, px, py, random() < 0.5 ? 2 : 1, 1, lit ? PAL.soilDarkL : PAL.deepRockR);
  }
}

// Draws a single ground tile: its visible sides, then its top.
function paintTile(g, tx, ty, random) {
  const tile = tiles[ty][tx];
  const z = tile.z;
  const edgeBottom = -ISLAND_DEPTH - Math.floor(random() * 6);

  const frontLeft = tileZ(tx, ty + 1);
  const leftBottom = frontLeft === null ? edgeBottom : frontLeft;
  if (leftBottom < z) paintTileSide(g, "left", tx, ty, z, leftBottom, tile, random);

  const frontRight = tileZ(tx + 1, ty);
  const rightBottom = frontRight === null ? edgeBottom : frontRight;
  if (rightBottom < z) paintTileSide(g, "right", tx, ty, z, rightBottom, tile, random);

  // Rocks hanging under the island's edge
  if (frontLeft === null || frontRight === null) {
    const side = frontLeft === null ? "left" : "right";
    const a = side === "left" ? [tx, ty + 1] : [tx + 1, ty];
    const b = [tx + 1, ty + 1];
    const t = 0.2 + random() * 0.6;
    const [mx, my] = iso(lerp(a[0], b[0], t), lerp(a[1], b[1], t), edgeBottom + 1);
    const len = 4 + Math.floor(random() * 10);
    const color = side === "left" ? PAL.deepRockL : PAL.deepRockR;
    fillPoly(g, [[mx - 4, my - 1], [mx + 4, my - 1], [mx + (random() - 0.5) * 3, my + len]], color);
    rect(g, mx - 3, my - 1, 2, 1, PAL.rockDark);
  }

  // The top surface
  const corners = [iso(tx, ty, z), iso(tx + 1, ty, z), iso(tx + 1, ty + 1, z), iso(tx, ty + 1, z)];
  fillPoly(g, corners, tileTopColor(tile, tx, ty));
  const spot = (u, v) => iso(tx + u, ty + v, z);
  const rnd = () => 0.08 + random() * 0.84;

  switch (tile.kind) {
    case "grass":
    case "forest":
      for (let i = 0; i < 4; i++) {
        const [px, py] = spot(rnd(), rnd());
        rect(g, px, py, 1, 1, PAL.grassDeep);
        rect(g, px + 1, py - 1, 1, 1, PAL.grassLight);
      }
      if (tile.kind === "grass" && random() < 0.18) {
        const colors = [PAL.flowerY, PAL.flowerW, PAL.flowerR, PAL.flowerP];
        const color = colors[Math.floor(random() * colors.length)];
        for (let i = 0; i < 3; i++) {
          const [px, py] = spot(rnd(), rnd());
          rect(g, px, py, 1, 1, color);
        }
      }
      break;
    case "road":
    case "plaza":
      for (let v = 0.12; v < 1; v += 0.25) {
        for (let u = 0.1 + (v * 4 % 2 ? 0.12 : 0); u < 0.95; u += 0.25) {
          const [px, py] = spot(u, v);
          const r = random();
          rect(g, px - 1, py, 3, 1, r < 0.3 ? PAL.cobbleDark : r < 0.75 ? PAL.cobble : PAL.cobbleLight);
          rect(g, px, py - 1, 1, 1, PAL.cobbleLight);
        }
      }
      break;
    case "water":
      for (let i = 0; i < 3; i++) {
        const [px, py] = spot(rnd(), rnd());
        fx.sparkles.push({ x: px, y: py, phase: random() * 6.28 });
      }
      rect(g, ...spot(0.3, 0.5), 3, 1, PAL.waterDark);
      break;
    case "sand":
      for (let i = 0; i < 4; i++) rect(g, ...spot(rnd(), rnd()), 1, 1, PAL.sandDark);
      break;
    case "rock":
    case "cut":
      for (let i = 0; i < 3; i++) {
        const [px, py] = spot(rnd(), rnd());
        rect(g, px, py, 2, 1, PAL.rockDark);
        rect(g, px, py - 1, 2, 1, PAL.rockLight);
      }
      if (tile.kind === "cut") {
        drawLine(g, ...spot(0, 0.5), ...spot(1, 0.5), PAL.rockDark);
        drawLine(g, ...spot(0.5, 0), ...spot(0.5, 1), PAL.rockDark);
      }
      break;
    case "snow":
      for (let i = 0; i < 4; i++) rect(g, ...spot(rnd(), rnd()), 2, 1, PAL.snowShade);
      break;
    case "soil":
      for (const v of [0.25, 0.5, 0.75]) drawLine(g, ...spot(0, v), ...spot(1, v), PAL.soilDark);
      for (let i = 0; i < 3; i++) rect(g, ...spot(rnd(), rnd()), 1, 1, PAL.soilLight);
      break;
  }
}

// Paints all the ground (back tiles first), plus shadows and flat details.
function paintTerrain() {
  const g = document.createElement("canvas").getContext("2d");
  g.canvas.width = VIEW_WIDTH;
  g.canvas.height = VIEW_HEIGHT;
  const random = makeRandom(1234);
  for (let sum = 0; sum <= 2 * (MAP_SIZE - 1); sum++) {
    for (let tx = 0; tx < MAP_SIZE; tx++) {
      const ty = sum - tx;
      if (ty >= 0 && ty < MAP_SIZE) paintTile(g, tx, ty, random);
    }
  }
  // Building shadows fall toward the lower-right
  for (const s of fx.shadows) {
    const { x, y, w, d, z } = s.box;
    const L = s.h / 16;
    fillPoly(g, [iso(x + w, y, z), iso(x + w + L, y, z), iso(x + w + L, y + d, z), iso(x + w, y + d, z)], SHADOW);
  }
  for (const draw of fx.groundDraws) draw(g);
  return g.canvas;
}

// Black island shape, used to keep cloud shadows on the ground only.
function paintIslandMask() {
  const g = document.createElement("canvas").getContext("2d");
  g.canvas.width = VIEW_WIDTH;
  g.canvas.height = VIEW_HEIGHT;
  for (let ty = 0; ty < MAP_SIZE; ty++) {
    for (let tx = 0; tx < MAP_SIZE; tx++) {
      const z = tiles[ty][tx].z;
      fillPoly(g, [iso(tx, ty, z), iso(tx + 1, ty, z), iso(tx + 1, ty + 1, z), iso(tx, ty + 1, z)], "#000");
    }
  }
  return g.canvas;
}

// Stone stairs from the plaza road up to the castle gate (drawn on the ground layer).
function paintStairs(g) {
  for (let i = 0; i < 6; i++) {
    const box = { x: 7.05, y: 10 + i * 0.2, w: 1.5, d: 0.2, z: 0 };
    drawIsoBox(g, box, 12 - i * 2, PAL.stone, PAL.stoneDark, PAL.stoneLight);
  }
}

function paintBridge(g) {
  const deck = { x: 0.9, y: 12.15, w: 1.2, d: 0.7, z: -2 };
  drawIsoBox(g, deck, 3, PAL.woodDark, PAL.woodDeep, PAL.wood);
  for (let u = 0.15; u < 1.2; u += 0.2) {
    drawLine(g, ...iso(deck.x + u, deck.y, 1), ...iso(deck.x + u, deck.y + deck.d, 1), PAL.woodDark);
  }
  for (const y of [deck.y + 0.05, deck.y + deck.d - 0.05]) {
    drawLine(g, ...iso(deck.x, y, 5), ...iso(deck.x + deck.w, y, 5), PAL.woodLight);
    for (let u = 0; u <= 1.2; u += 0.4) {
      const [px, py] = iso(deck.x + u, y, 1);
      rect(g, px, py - 4, 1, 4, PAL.woodDeep);
    }
  }
}


// ---------- Buildings ----------

// How grand the castle is: 0 = a wooden-walled keep (small settlement),
// 1 = stone walls and towers (from 25 citizens), 2 = mighty castle (Castle Upgrade).
function getCastleTier() {
  if (state.castleLevel >= 2) return 2;
  return state.population >= 25 ? 1 : 0;
}

// A wooden palisade of sharpened logs along the hill's edges (castle tier 0).
function drawPalisade(ctx, from, to, z) {
  const steps = Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.22);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(from[0], to[0], t), y = lerp(from[1], to[1], t);
    const [px, py] = iso(x, y, z);
    const h = 8 + (i % 3 === 0 ? 1 : 0);
    rect(ctx, px - 1, py - h, 2, h, i % 2 ? PAL.wood : PAL.woodDark);
    rect(ctx, px - 1, py - h - 1, 1, 1, PAL.woodLight);
  }
}

function drawCastle(ctx) {
  const Z = 2 * LEVEL_HEIGHT;   // the castle hill is 2 levels high
  const tier = getCastleTier();
  // After the Castle Upgrade the towers are taller and fly golden flags
  const big = state.castleLevel >= 2;
  const extra = big ? 12 : 0;
  const flag = big ? PAL.gold : PAL.banner;
  drawTower(ctx, 5.3, 5.3, Z, big ? 7 : 6, 46 + extra * 1.5, 18 + extra / 2, flag);   // tall back tower

  // The keep (main hall)
  const keep = { x: 5.8, y: 5.6, w: 2.6, d: 2.4, z: Z };
  fx.shadows.push({ box: keep, h: 26 });
  drawIsoBox(ctx, keep, 26, PAL.stone, PAL.stoneDark);
  paintBricks(ctx, keep, 26, PAL.stoneDark, PAL.stoneDeep);
  doorL(ctx, keep, 1.1, 0.45, 11);
  windowL(ctx, keep, 0.3, 14, 0.28, 6);
  windowL(ctx, keep, 2.0, 14, 0.28, 6);
  windowR(ctx, keep, 0.5, 14, 0.28, 6);
  windowR(ctx, keep, 1.6, 14, 0.28, 6);
  for (const u of [0.75, 1.65]) {                                // royal banners
    faceL(ctx, keep, u, 6, 0.28, 12, PAL.banner);
    faceL(ctx, keep, u + 0.08, 10, 0.12, 4, PAL.gold);
  }
  drawRoof(ctx, keep, 26, 14, tier === 0 ? ROOF_WOOD : ROOF_SLATE, "y", PAL.stone);

  if (tier === 0) {
    // A young settlement: just a wooden palisade with a log gate
    drawPalisade(ctx, [9.7, 4.4], [9.7, 9.7], Z);
    drawPalisade(ctx, [4.4, 9.7], [6.9, 9.7], Z);
    drawPalisade(ctx, [8.5, 9.7], [9.7, 9.7], Z);
    const gate = { x: 6.95, y: 9.45, w: 1.5, d: 0.35, z: Z };
    drawIsoBox(ctx, gate, 11, PAL.wood, PAL.woodDark, PAL.woodLight);
    faceL(ctx, gate, 0.4, 0, 0.7, 8, PAL.door);
    const [tx1, ty1] = iso(gate.x + 0.2, gate.y + gate.d, Z + 9);
    fx.fires.push({ x: tx1, y: ty1, small: true });
    rect(ctx, tx1, ty1, 1, 3, PAL.woodDeep);
    return;
  }

  // Curtain walls and towers along the hill's front edges
  drawTower(ctx, 9.6, 4.6, Z, 5, 26 + extra, 14, flag);
  drawCastleWall(ctx, { x: 9.45, y: 4.6, w: 0.45, d: 5.0, z: Z }, 9 + extra / 3);
  drawTower(ctx, 4.6, 9.6, Z, 5, 26 + extra, 14, flag);
  drawCastleWall(ctx, { x: 4.6, y: 9.45, w: 2.3, d: 0.45, z: Z }, 9 + extra / 3);
  drawCastleWall(ctx, { x: 8.5, y: 9.45, w: 1.1, d: 0.45, z: Z }, 9 + extra / 3);

  // Gatehouse above the stairs
  const gate = { x: 6.9, y: 9.25, w: 1.6, d: 0.7, z: Z };
  drawIsoBox(ctx, gate, 16, PAL.stone, PAL.stoneDark, PAL.stoneLight);
  paintBricks(ctx, gate, 16, PAL.stoneDark, PAL.stoneDeep);
  faceL(ctx, gate, 0.45, 0, 0.7, 10, PAL.outline);
  faceL(ctx, gate, 0.52, 0, 0.56, 9, PAL.door);
  for (let u = 0; u < 1.6; u += 0.4) {
    drawIsoBox(ctx, { x: gate.x + u, y: gate.y, w: 0.22, d: gate.d, z: Z + 16 }, 3, PAL.stone, PAL.stoneDark, PAL.stoneLight);
  }
  const [t1x, t1y] = iso(gate.x + 0.3, gate.y + gate.d, Z + 9);
  const [t2x, t2y] = iso(gate.x + 1.3, gate.y + gate.d, Z + 9);
  fx.fires.push({ x: t1x, y: t1y, small: true }, { x: t2x, y: t2y, small: true });
  rect(ctx, t1x, t1y, 1, 3, PAL.woodDeep);
  rect(ctx, t2x, t2y, 1, 3, PAL.woodDeep);

  drawTower(ctx, 9.6, 9.6, Z, 6, 30 + extra, 16, flag);          // front tower
}

// Timber-framed cottage. `variant` picks the roof.
function drawHouse(ctx, tx, ty, variant, tier = getBuildingTier("house")) {
  const box = { x: tx + 0.25, y: ty + 0.25, w: 1.5, d: 1.5, z: 0 };
  const h = tier >= 2 ? 17 : 13;                       // grander houses are taller
  fx.shadows.push({ box, h: h + 8 });
  drawIsoBox(ctx, box, h, PAL.plaster, PAL.plasterShade);
  if (tier >= 2) drawFoundation(ctx, box, 4);
  // Timber frame
  lineL(ctx, box, 6, PAL.timber); lineL(ctx, box, h - 1, PAL.timber); lineL(ctx, box, 0, PAL.timber);
  lineR(ctx, box, 6, PAL.timber); lineR(ctx, box, h - 1, PAL.timber); lineR(ctx, box, 0, PAL.timber);
  for (const u of [0, 0.75, 1.49]) { postL(ctx, box, u, h, PAL.timber); postR(ctx, box, u, h, PAL.timber); }
  doorL(ctx, box, 0.95, 0.32, 8);
  windowL(ctx, box, 0.25, 7, 0.3, 4);
  windowR(ctx, box, 0.55, 7, 0.32, 4);
  faceL(ctx, box, 0.2, 5, 0.4, 1, PAL.flowerR);                  // flower box
  const roofs = [
    [ROOF_THATCH, "x"], [ROOF_RED, "y"], [ROOF_BLUE, "x"],
  ];
  const [style, axis] = roofs[variant % roofs.length];
  const gable = axis === "x" ? PAL.plasterShade : PAL.plaster;
  const chimney = () => drawChimney(ctx, box.x + 1.0, box.y + 0.3, h, 13);
  drawRoof(ctx, box, h, 10, style, axis, gable, chimney);
  if (tier >= 1) drawGarden(ctx, tx, ty);
  if (tier >= 3) {
    const [fx1, fy1] = iso(box.x + 0.4, box.y + box.d / 2, h + 10);
    addRoofFlag(ctx, fx1, fy1 - 8, PAL.gold);
  }
}

function drawBarn(ctx, tx, ty, tier = getBuildingTier("farm")) {
  const box = { x: tx + 0.15, y: ty + 0.15, w: 2.7, d: 1.7, z: 0 };
  const h = 15;
  fx.shadows.push({ box, h: h + 10 });
  drawIsoBox(ctx, box, h, PAL.barn, PAL.barnDark);
  for (let u = 0.2; u < box.w; u += 0.25) postL(ctx, box, u, h, PAL.barnDark);
  for (let u = 0.2; u < box.d; u += 0.25) postR(ctx, box, u, h, "#6a1f14");
  postL(ctx, box, 0, h, PAL.cloth); postR(ctx, box, box.d - 0.02, h, PAL.cloth);
  // Big door with a white X
  const door = { u: 1.0, w: 0.8, h: 11 };
  faceL(ctx, box, door.u - 0.06, 0, door.w + 0.12, door.h + 1, PAL.cloth);
  faceL(ctx, box, door.u, 0, door.w, door.h, PAL.barnDark);
  const fy = box.y + box.d;
  drawLine(ctx, ...iso(box.x + door.u, fy, door.h), ...iso(box.x + door.u + door.w, fy, 0), PAL.cloth);
  drawLine(ctx, ...iso(box.x + door.u, fy, 0), ...iso(box.x + door.u + door.w, fy, door.h), PAL.cloth);
  windowL(ctx, box, 0.3, 7, 0.3, 4);
  windowL(ctx, box, 2.1, 7, 0.3, 4);
  windowR(ctx, box, 0.7, 7, 0.3, 4);
  drawRoof(ctx, box, h, 12, tier >= 2 ? ROOF_RED : ROOF_WOOD, "x", PAL.barnDark);
  if (tier >= 1) {
    const [vx, vy] = iso(box.x + box.w / 2 + 0.4, box.y + box.d / 2, h + 12);
    drawWeathervane(ctx, vx, vy);
  }
  if (tier >= 3) {
    const [fx1, fy1] = iso(box.x + 0.3, box.y + box.d / 2, h + 12);
    addRoofFlag(ctx, fx1, fy1 - 8, PAL.gold);
  }
}

// Stone smithy with a glowing forge, an anvil and a big chimney.
function drawBlacksmith(ctx, tx, ty, tier = getBuildingTier("blacksmith")) {
  const box = { x: tx + 0.25, y: ty + 0.25, w: 1.5, d: 1.5, z: 0 };
  const h = 11;
  fx.shadows.push({ box, h: h + 8 });
  drawIsoBox(ctx, box, h, PAL.stone, PAL.stoneDark);
  paintBricks(ctx, box, h, PAL.stoneDark, PAL.stoneDeep);
  doorL(ctx, box, 0.95, 0.35, 8);
  // Open forge on the right wall, glowing orange
  faceR(ctx, box, 0.35, 1, 0.6, 6, PAL.outline);
  faceR(ctx, box, 0.42, 1, 0.46, 4, PAL.fire);
  const [gx, gy] = iso(box.x + box.w, box.y + 0.65, 3);
  fx.fires.push({ x: gx, y: gy, small: true });
  addLight(gx, gy - 1, 7);
  windowL(ctx, box, 0.3, 6, 0.3, 3);
  drawRoof(ctx, box, h, 8, ROOF_SLATE, "x", PAL.stoneDark, () => {
    drawChimney(ctx, box.x + 0.9, box.y + 0.2, h, 16);
    if (tier >= 2) drawChimney(ctx, box.x + 0.3, box.y + 0.25, h, 12);
  });
  if (tier >= 1) {                                                   // weapon rack
    const [rx, ry] = iso(tx + 1.55, ty + 1.9, 0);
    rect(ctx, rx - 4, ry - 6, 9, 1, PAL.wood);
    for (let i = 0; i < 4; i++) rect(ctx, rx - 3 + i * 2, ry - 9, 1, 9, i % 2 ? PAL.metal : PAL.woodDark);
  }
  if (tier >= 3) {
    const [fx1, fy1] = iso(box.x + 1.2, box.y + box.d / 2, h + 8);
    addRoofFlag(ctx, fx1, fy1 - 8, PAL.red);
  }
  // Anvil outside
  const anvil = { x: tx + 0.4, y: ty + 1.85, w: 0.3, d: 0.18, z: 0 };
  drawIsoBox(ctx, anvil, 3, PAL.metalDark, PAL.stoneDeep, PAL.metal);
  drawIsoBox(ctx, { ...anvil, x: anvil.x - 0.08, w: 0.46, z: 3 }, 2, PAL.metalDark, PAL.stoneDeep, PAL.metal);
}

// Academy: a tall hall with a round library tower.
function drawAcademy(ctx, tx, ty, tier = getBuildingTier("academy")) {
  const box = { x: tx + 0.2, y: ty + 0.2, w: 1.6, d: 1.6, z: 0 };
  const h = 17;
  fx.shadows.push({ box, h: h + 12 });
  drawIsoBox(ctx, box, h, PAL.plaster, PAL.plasterShade);
  lineL(ctx, box, 0, PAL.stoneDark); lineR(ctx, box, 0, PAL.stoneDark);
  lineL(ctx, box, 8, PAL.stoneDark); lineR(ctx, box, 8, PAL.stoneDark);
  doorL(ctx, box, 0.65, 0.35, 8);
  for (const u of [0.2, 1.15]) windowL(ctx, box, u, 2, 0.25, 4);
  for (const u of [0.2, 0.7, 1.15]) windowL(ctx, box, u, 10, 0.25, 4);
  for (const u of [0.3, 0.9]) { windowR(ctx, box, u, 2, 0.25, 4); windowR(ctx, box, u, 10, 0.25, 4); }
  faceL(ctx, box, 0.62, 10, 0.4, 5, PAL.banner);                  // banner over the door
  drawRoof(ctx, box, h, 11, ROOF_BLUE, "y", PAL.plaster);
  // Library tower with a blue cone
  const [sx, sy] = iso(box.x + box.w, box.y + box.d, 0);
  drawCylinder(ctx, sx, sy, 5, 30, [PAL.plaster, PAL.plaster, PAL.plasterShade, "#a8977a"], false);
  for (const y of [sy - 24, sy - 14]) { rect(ctx, sx - 2, y, 2, 4, PAL.timber); rect(ctx, sx - 2, y + 1, 2, 2, PAL.glass); addLight(sx - 1, y + 2, 5); }
  if (tier >= 2) {
    // An observatory dome with a brass telescope
    fillEllipse(ctx, sx, sy - 30, 7, 2, PAL.blueRoofDark);
    for (let dy = 0; dy < 7; dy++) {
      const half = Math.round(7 * Math.sqrt(1 - (dy / 7) ** 2));
      rect(ctx, sx - half, sy - 31 - dy, half, 1, PAL.blueRoofLight);
      rect(ctx, sx, sy - 31 - dy, half, 1, PAL.blueRoof);
    }
    drawLine(ctx, sx + 1, sy - 36, sx + 7, sy - 41, PAL.goldDark);
    rect(ctx, sx + 6, sy - 42, 2, 2, PAL.gold);
    rect(ctx, sx, sy - 46, 1, 8, PAL.outline);
    fx.flags.push({ x: sx + 1, y: sy - 46, color: PAL.purple });
  } else {
    drawCone(ctx, sx, sy - 30, 7, 14, PAL.blueRoofLight, PAL.blueRoofDark);
    rect(ctx, sx, sy - 52, 1, 8, PAL.outline);
    fx.flags.push({ x: sx + 1, y: sy - 52, color: PAL.purple });
  }
}

function drawHay(ctx, tx, ty) {
  drawIsoBox(ctx, { x: tx, y: ty, w: 0.5, d: 0.35, z: 0 }, 4, PAL.thatch, PAL.thatchDark, PAL.thatchLight);
}

function drawLumberMill(ctx, tx, ty, tier = getBuildingTier("lumberMill")) {
  const box = { x: tx + 0.2, y: ty + 0.2, w: 1.6, d: 1.6, z: 0 };
  const h = tier >= 2 ? 16 : 12;
  fx.shadows.push({ box, h: h + 8 });
  drawIsoBox(ctx, box, h, PAL.wood, PAL.woodDark);
  for (let v = 2; v < h; v += 3) {                               // stacked logs
    lineL(ctx, box, v, PAL.woodDark);
    lineL(ctx, box, v + 1, PAL.woodLight);
    lineR(ctx, box, v, PAL.woodDeep);
    const [ex, ey] = iso(box.x, box.y + box.d, v + 1);
    rect(ctx, ex - 1, ey - 1, 2, 2, PAL.logEnd);
    const [rx, ry] = iso(box.x + box.w, box.y + box.d, v + 1);
    rect(ctx, rx - 1, ry - 1, 2, 2, PAL.logRing);
  }
  doorL(ctx, box, 0.9, 0.4, 9);
  windowL(ctx, box, 0.25, 6, 0.3, 4);
  windowR(ctx, box, 0.6, 6, 0.3, 4);
  drawRoof(ctx, box, h, 9, tier >= 2 ? ROOF_SLATE : ROOF_RED, "y", PAL.wood, () => drawChimney(ctx, box.x + 1.1, box.y + 0.25, h, 12));
  if (tier >= 1) drawLogPile(ctx, tx - 0.15, ty + 1.95);
  if (tier >= 3) {
    const [fx1, fy1] = iso(box.x + box.w / 2, box.y + 0.2, h + 9);
    addRoofFlag(ctx, fx1, fy1 - 8, PAL.gold);
  }

  // Open saw shed beside it
  const shed = { x: tx + 2.1, y: ty + 0.3, w: 0.9, d: 1.4, z: 0 };
  for (const [u, v] of [[0, 0], [0.85, 0], [0, 1.35], [0.85, 1.35]]) {
    const [px, py] = iso(shed.x + u, shed.y + v, 0);
    rect(ctx, px, py - 11, 1, 11, PAL.woodDeep);
  }
  drawIsoBox(ctx, { x: shed.x + 0.15, y: shed.y + 0.3, w: 0.6, d: 0.8, z: 0 }, 4, PAL.woodLight, PAL.wood, PAL.woodDark);
  const [bx, by] = iso(shed.x + 0.45, shed.y + 0.7, 4);
  fx.saws.push({ x: bx, y: by - 4 });
  drawIsoBox(ctx, { ...shed, z: 11 }, 1, PAL.roofRedDark, PAL.roofRedDark, PAL.roofRed);
}

// Logs lying front-to-back so you see their round ends.
function drawLogPile(ctx, tx, ty) {
  const logs = [[0, 0], [0.32, 0], [0.64, 0], [0.16, 3], [0.48, 3], [0.32, 6]];
  for (const [u, z] of logs) {
    const box = { x: tx + u, y: ty, w: 0.3, d: 0.8, z };
    drawIsoBox(ctx, box, 3, PAL.logEnd, PAL.woodDark, PAL.woodLight);
    const [cx, cy] = iso(box.x + 0.15, box.y + box.d, z + 1.5);
    rect(ctx, cx, cy, 1, 1, PAL.logRing);
  }
}

function drawQuarryWorks(ctx, tier = getBuildingTier("quarry")) {
  if (tier >= 1) {
    for (const [x, y] of [[11.15, 3.75], [11.55, 3.8]]) {
      drawIsoBox(ctx, { x, y, w: 0.35, d: 0.35, z: 0 }, 4, PAL.stoneLight, PAL.stone, PAL.cloth);
    }
  }
  if (tier >= 2) {                                                   // a second crane
    const [c2x, c2y] = iso(11.3, 2.9, 0);
    rect(ctx, c2x, c2y - 20, 2, 20, PAL.wood);
    drawLine(ctx, c2x + 1, c2y - 20, c2x + 16, c2y - 26, PAL.wood);
    rect(ctx, c2x + 14, c2y - 25, 1, 9, PAL.outline);
  }
  if (tier >= 3) {
    const [fx1, fy1] = iso(13, 1.5, 24);
    addRoofFlag(ctx, fx1, fy1 - 8, PAL.gold);
  }
  // Wooden crane
  const [cx, cy] = iso(14.7, 3.4, 0);
  rect(ctx, cx, cy - 26, 2, 26, PAL.wood);
  rect(ctx, cx + 2, cy - 26, 1, 26, PAL.woodDark);
  drawLine(ctx, cx + 1, cy - 26, cx - 22, cy - 34, PAL.wood);
  drawLine(ctx, cx + 1, cy - 25, cx - 22, cy - 33, PAL.woodDark);
  rect(ctx, cx - 20, cy - 32, 1, 14, PAL.outline);
  drawIsoBox(ctx, { x: 13.15, y: 2.75, w: 0.3, d: 0.3, z: 18 }, 3, PAL.stoneLight, PAL.stone, PAL.cloth);
  // Cut stone blocks
  for (const [x, y, z] of [[11.2, 3.3, 0], [11.6, 3.3, 0], [11.4, 3.25, 4]]) {
    drawIsoBox(ctx, { x, y, w: 0.35, d: 0.35, z }, 4, PAL.stoneLight, PAL.stone, PAL.cloth);
  }
  // Cart
  const cart = { x: 12.6, y: 3.6, w: 0.9, d: 0.5, z: 2 };
  drawIsoBox(ctx, cart, 4, PAL.wood, PAL.woodDark, PAL.woodDeep);
  drawIsoBox(ctx, { x: 12.75, y: 3.65, w: 0.3, d: 0.3, z: 6 }, 2, PAL.stoneLight, PAL.stone, PAL.cloth);
  for (const u of [0.15, 0.75]) {
    const [wx, wy] = iso(cart.x + u, cart.y + cart.d, 2);
    fillEllipse(ctx, wx, wy, 2, 2, PAL.woodDeep);
  }
}

function drawStall(ctx, tx, ty, color, tier = getBuildingTier("market")) {
  const box = { x: tx + 0.15, y: ty + 0.15, w: 0.7, d: 0.7, z: 0 };
  fx.shadows.push({ box, h: 10 });
  for (const [u, v] of [[0, 0], [0.7, 0], [0, 0.7], [0.7, 0.7]]) {
    const [px, py] = iso(box.x + u, box.y + v, 0);
    rect(ctx, px, py - 13, 1, 13, PAL.woodDeep);
  }
  drawIsoBox(ctx, box, 5, PAL.wood, PAL.woodDark, PAL.woodLight);
  const goods = [PAL.red, PAL.wheatLight, PAL.cabbage, PAL.pumpkin];
  goods.forEach((c, i) => {
    const [gx, gy] = iso(box.x + 0.12 + i * 0.15, box.y + 0.45, 5);
    rect(ctx, gx, gy - 1, 2, 2, c);
  });
  const roofBox = { x: box.x - 0.05, y: box.y - 0.05, w: 0.8, d: 0.8, z: 0 };
  const stripe = tier >= 3 ? PAL.gold : color;                    // golden awnings at the top tier
  drawRoof(ctx, roofBox, 13, 5, { roof: PAL.cloth, dark: "#cfc5ae", light: "#fffaf0", kind: "stripes", stripe }, "x", stripe);
  const [lx, ly] = iso(box.x + 0.35, box.y + box.d, 11);
  addLight(lx, ly, 6);
}

function drawWell(ctx, tx, ty) {
  const [sx, sy] = iso(tx, ty, 0);
  fillEllipse(ctx, sx + 3, sy + 1, 7, 3, SHADOW);
  drawCylinder(ctx, sx, sy, 5, 6, [PAL.stoneLight, PAL.stone, PAL.stoneDark, PAL.stoneDeep], true);
  fillEllipse(ctx, sx, sy - 6, 3, 1, PAL.waterDark);
  rect(ctx, sx - 5, sy - 16, 1, 11, PAL.woodDeep);
  rect(ctx, sx + 4, sy - 16, 1, 11, PAL.woodDeep);
  fillPoly(ctx, [[sx - 7, sy - 15], [sx, sy - 20], [sx, sy - 14]], PAL.roofRedLight);
  fillPoly(ctx, [[sx, sy - 20], [sx + 7, sy - 15], [sx, sy - 14]], PAL.roofRedDark);
  rect(ctx, sx, sy - 14, 1, 5, PAL.outline);
  rect(ctx, sx - 1, sy - 10, 3, 2, PAL.wood);
}

function drawLamp(ctx, sx, sy) {
  rect(ctx, sx, sy - 12, 1, 12, PAL.outline);
  rect(ctx, sx - 1, sy - 15, 3, 3, PAL.glass);
  rect(ctx, sx - 1, sy - 16, 3, 1, PAL.outline);
  rect(ctx, sx - 1, sy, 3, 1, PAL.stoneDeep);
  addLight(sx, sy - 14, 8);
}

function drawBarrel(ctx, sx, sy) {
  rect(ctx, sx, sy - 6, 5, 6, PAL.wood);
  rect(ctx, sx + 3, sy - 6, 2, 6, PAL.woodDark);
  rect(ctx, sx, sy - 5, 5, 1, PAL.metalDark);
  rect(ctx, sx, sy - 2, 5, 1, PAL.metalDark);
  fillEllipse(ctx, sx + 2.5, sy - 6, 2.5, 1, PAL.woodLight);
}

function drawCampfire(ctx, sx, sy) {
  fillEllipse(ctx, sx, sy, 5, 2, PAL.stoneDark);
  fillEllipse(ctx, sx, sy - 1, 3, 1, PAL.woodDeep);
  rect(ctx, sx - 3, sy - 2, 6, 1, PAL.wood);
  fx.fires.push({ x: sx, y: sy - 2, small: false });
}

function drawTree(ctx, x, y, s, seed, sway = 0) {
  fillEllipse(ctx, x + Math.round(s * 0.7), y, s, Math.max(2, Math.round(s * 0.35)), SHADOW);
  rect(ctx, x - 1, y - s - 2, 3, s + 2, PAL.trunk);
  rect(ctx, x + 1, y - s - 2, 1, s + 2, PAL.trunkDark);
  const cy = y - s - Math.round(s * 0.7);
  x += sway;                                   // the crown leans a little in the wind
  fillEllipse(ctx, x + 1, cy + 1, s + 1, Math.round(s * 0.9) + 1, PAL.leafDeep);
  fillEllipse(ctx, x, cy, s, Math.round(s * 0.9), PAL.leafDark);
  fillEllipse(ctx, x - Math.round(s * 0.2), cy - Math.round(s * 0.2), Math.round(s * 0.75), Math.round(s * 0.65), PAL.leaf);
  fillEllipse(ctx, x - Math.round(s * 0.4), cy - Math.round(s * 0.4), Math.round(s * 0.35), Math.round(s * 0.3), PAL.leafLight);
  rect(ctx, x - Math.round(s * 0.55), cy - Math.round(s * 0.55), 2, 1, PAL.leafBright);
  const random = makeRandom(seed);
  for (let i = 0; i < s * 2; i++) {
    const lx = x + Math.round((random() - 0.5) * s * 1.4);
    const ly = cy + Math.round((random() - 0.4) * s * 1.2);
    rect(ctx, lx, ly, 1, 1, random() < 0.5 ? PAL.leafDeep : PAL.leafLight);
  }
}

function drawPine(ctx, x, y, s, sway = 0) {
  fillEllipse(ctx, x + Math.round(s * 0.6), y, Math.round(s * 0.9), Math.max(2, Math.round(s * 0.3)), SHADOW);
  rect(ctx, x - 1, y - 4, 2, 4, PAL.trunk);
  const baseX = x;
  for (let t = 0; t < 3; t++) {
    x = baseX + (t === 2 ? sway : 0);          // the tip sways in the wind
    const bottom = y - 3 - Math.round(t * s * 0.75);
    const halfW = Math.round(s - t * s * 0.25);
    const height = Math.round(s * 1.0);
    fillPoly(ctx, [[x - halfW, bottom], [x, bottom - height], [x, bottom]], PAL.pine);
    fillPoly(ctx, [[x, bottom - height], [x + halfW, bottom], [x, bottom]], PAL.pineDark);
    rect(ctx, x - halfW + 1, bottom - 1, halfW * 2 - 2, 1, PAL.pineDark);
    rect(ctx, x - Math.round(halfW / 2), bottom - Math.round(height / 2), 2, 1, PAL.pineLight);
  }
}

function drawBush(ctx, x, y, s) {
  fillEllipse(ctx, x + 2, y, s + 1, Math.max(1, Math.round(s / 2)), SHADOW);
  fillEllipse(ctx, x, y - s + 1, s + 1, s, PAL.leafDark);
  fillEllipse(ctx, x - 1, y - s, s, s - 1, PAL.leaf);
  rect(ctx, x - Math.round(s / 2), y - s - 1, 2, 1, PAL.leafLight);
}

function drawBoulder(ctx, x, y, s) {
  fillEllipse(ctx, x + 2, y, s + 1, Math.max(1, s / 2), SHADOW);
  fillEllipse(ctx, x, y - s / 2, s, s * 0.7, PAL.rockDark);
  fillEllipse(ctx, x - 1, y - s / 2 - 1, s - 1, s * 0.55, PAL.rock);
  rect(ctx, x - s / 2, y - s, 2, 1, PAL.rockLight);
}


// ---------- Fields and crops ----------

// Fence rails along the field's back edges (drawn flat on the ground layer).
function paintFieldBackFence(g, f) {
  const z = 4;
  drawLine(g, ...iso(f.x, f.y, z), ...iso(f.x + f.w, f.y, z), PAL.woodLight);
  drawLine(g, ...iso(f.x, f.y, z), ...iso(f.x, f.y + f.d, z), PAL.woodLight);
  for (let u = 0; u <= f.w; u += 1) { const [px, py] = iso(f.x + u, f.y, 0); rect(g, px, py - 5, 1, 5, PAL.woodDeep); }
  for (let v = 1; v <= f.d; v += 1) { const [px, py] = iso(f.x, f.y + v, 0); rect(g, px, py - 5, 1, 5, PAL.woodDeep); }
}

function drawFieldFrontFence(ctx, f) {
  const z = 4;
  drawLine(ctx, ...iso(f.x, f.y + f.d, z), ...iso(f.x + f.w, f.y + f.d, z), PAL.woodLight);
  drawLine(ctx, ...iso(f.x + f.w, f.y, z), ...iso(f.x + f.w, f.y + f.d, z), PAL.woodDark);
  for (let u = 0; u <= f.w; u += 1) { const [px, py] = iso(f.x + u, f.y + f.d, 0); rect(ctx, px, py - 5, 1, 5, PAL.woodDeep); }
  for (let v = 0; v < f.d; v += 1) { const [px, py] = iso(f.x + f.w, f.y + v, 0); rect(ctx, px, py - 5, 1, 5, PAL.woodDeep); }
}

// One plant. stage: 0 sprout, 1 growing, 2 ripe, 3 just harvested.
// sway: 0 or 1, a tiny lean in the wind.
function drawPlant(ctx, x, y, crop, stage, sway) {
  if (stage === 3) { rect(ctx, x, y, 1, 1, PAL.thatchDark); return; }
  if (stage === 0) { rect(ctx, x, y - 1, 1, 2, PAL.sprout); return; }
  if (crop === "wheat") {
    const color = stage === 2 ? PAL.wheat : PAL.crop;
    const tip = stage === 2 ? PAL.wheatLight : PAL.sprout;
    rect(ctx, x, y - 3, 1, 4, color);
    rect(ctx, x + sway, y - 4, 1, 2, tip);
  } else if (crop === "cabbage") {
    const size = stage === 2 ? 2 : 1;
    rect(ctx, x, y - size, size + 1, size + 1, PAL.cabbage);
    rect(ctx, x + sway, y - size, 1, 1, PAL.leafBright);
  } else {
    rect(ctx, x - 1 + sway, y - 2, 3, 1, PAL.crop);
    if (stage === 2) rect(ctx, x, y - 1, 2, 2, PAL.pumpkin);
    else rect(ctx, x, y, 1, 1, PAL.cropDark);
  }
}

// One row of a field, cached for each growth stage and sway frame.
const cropRowCache = {};
function getCropRowSprite(f, row, crop, stage, sway) {
  const key = `${f.x},${f.y},${row},${crop},${stage},${sway}`;
  if (!cropRowCache[key]) {
    const box = { x: f.x, y: f.y + row, w: f.w, d: 1, z: 0 };
    cropRowCache[key] = makeSprite(boxBounds(box, 8), ctx => {
      for (const v of [0.3, 0.8]) {
        for (let u = 0.12; u < f.w; u += 0.25) {
          const [px, py] = iso(f.x + u, f.y + row + v, 0);
          drawPlant(ctx, px, py, crop, stage, sway);
        }
      }
    });
  }
  return cropRowCache[key];
}


// ---------- Upgrade extras (buildings look grander at higher levels) ----------

// A little flag on a pole (animated by drawFlags).
function addRoofFlag(ctx, x, y, color) {
  rect(ctx, x, y, 1, 9, PAL.outline);
  fx.flags.push({ x: x + 1, y, color });
}

// Picket fence and flowers in front of a house (tier 1+).
function drawGarden(ctx, tx, ty) {
  const y = ty + 1.95;
  drawLine(ctx, ...iso(tx + 0.15, y, 3), ...iso(tx + 1.85, y, 3), PAL.cloth);
  for (let u = 0.15; u <= 1.86; u += 0.28) {
    const [px, py] = iso(tx + u, y, 0);
    rect(ctx, px, py - 4, 1, 4, PAL.cloth);
  }
  const flowers = [PAL.flowerR, PAL.flowerY, PAL.flowerP, PAL.flowerW];
  for (let i = 0; i < 6; i++) {
    const [fx0, fy0] = iso(tx + 0.25 + i * 0.25, y - 0.12, 1);
    rect(ctx, fx0, fy0, 1, 1, flowers[i % flowers.length]);
    rect(ctx, fx0, fy0 + 1, 1, 1, PAL.leafDark);
  }
}

// Stone foundation on the bottom of a building (tier 2+).
function drawFoundation(ctx, box, height) {
  faceL(ctx, box, 0, 0, box.w, height, PAL.stone);
  faceR(ctx, box, 0, 0, box.d, height, PAL.stoneDark);
  lineL(ctx, box, height, PAL.stoneDeep);
  lineR(ctx, box, height, PAL.stoneDeep);
  for (let u = 0.2; u < box.w; u += 0.35) faceL(ctx, box, u, 0, 0.04, height, PAL.stoneDark);
}

// A tall grain silo next to the barn (farm tier 2+).
function drawSilo(ctx, tx, ty) {
  const [sx, sy] = iso(tx, ty, 0);
  fillEllipse(ctx, sx + 4, sy + 1, 7, 3, SHADOW);
  drawCylinder(ctx, sx, sy, 5, 24, [PAL.stoneLight, PAL.stone, PAL.stoneDark, PAL.stoneDeep], true);
  for (let y = sy - 22; y < sy; y += 6) rect(ctx, sx - 5, y, 10, 1, PAL.metalDark);   // iron hoops
  fillEllipse(ctx, sx, sy - 24, 6, 3, PAL.roofRed);
  fillEllipse(ctx, sx - 1, sy - 26, 4, 3, PAL.roofRedLight);
  rect(ctx, sx, sy - 31, 1, 4, PAL.outline);
}

// Rooster weathervane on a roof.
function drawWeathervane(ctx, x, y) {
  rect(ctx, x, y - 8, 1, 8, PAL.outline);
  rect(ctx, x - 2, y - 6, 5, 1, PAL.goldDark);
  rect(ctx, x - 1, y - 10, 3, 2, PAL.gold);
  rect(ctx, x + 1, y - 11, 1, 1, PAL.gold);
}

// Archery target for the barracks yard.
function drawArcheryTarget(ctx, x, y) {
  rect(ctx, x - 1, y - 9, 1, 9, PAL.woodDeep);
  rect(ctx, x + 2, y - 9, 1, 9, PAL.woodDeep);
  fillEllipse(ctx, x + 1, y - 10, 4, 4, PAL.cloth);
  fillEllipse(ctx, x + 1, y - 10, 3, 3, PAL.red);
  fillEllipse(ctx, x + 1, y - 10, 1.5, 1.5, PAL.cloth);
  rect(ctx, x + 1, y - 11, 1, 1, PAL.red);
}

// A horse at a hitching post (barracks tier 2+).
function drawHorse(ctx, x, y) {
  fillEllipse(ctx, x + 2, y, 7, 2, SHADOW);
  for (const lx of [-4, -2, 2, 4]) rect(ctx, x + lx, y - 3, 1, 3, "#4a2f1d");
  rect(ctx, x - 5, y - 7, 11, 4, "#8a5a32");
  rect(ctx, x - 5, y - 7, 11, 1, "#a87443");
  rect(ctx, x + 5, y - 10, 2, 4, "#8a5a32");
  rect(ctx, x + 6, y - 11, 3, 3, "#8a5a32");
  rect(ctx, x + 8, y - 10, 1, 1, PAL.outline);
  rect(ctx, x + 5, y - 11, 1, 4, "#3a2416");          // mane
  rect(ctx, x - 6, y - 7, 1, 4, "#3a2416");          // tail
  rect(ctx, x - 2, y - 8, 4, 2, PAL.banner);           // saddle cloth
}


// ---------- Hills ----------
// (letters h and f in VILLAGE_MAP are grass and forest one level up)


// ---------- Animals ----------
const ANIMAL_HERDS = [
  { kind: "chicken", needs: "farm",  anchor: [4.6, 15.45], radius: 0.4,  count: 4, speed: 0.55 },
  { kind: "cow",     needs: "farm",  anchor: [8.4, 19.45], radius: 0.45, count: 2, speed: 0.1 },
  { kind: "sheep",   needs: null,    anchor: [17.9, 14.9], radius: 0.55, count: 3, speed: 0.16 },
];

// Where an animal is right now: a slow, wandering loop around its anchor.
function getAnimalPosition(herd, index, time) {
  const phase = index * 2.17 + herd.anchor[0];
  const u = time * herd.speed + phase;
  const at = t => [
    herd.anchor[0] + Math.sin(t) * herd.radius * 0.8 + Math.sin(t * 0.37 + 1) * herd.radius * 0.2,
    herd.anchor[1] + Math.cos(t * 0.73) * herd.radius * 0.6,
  ];
  const [x, y] = at(u);
  const [nx, ny] = at(u + 0.05);
  const screenDx = (nx - x) - (ny - y);
  // Animals stop now and then (to graze or peck)
  const resting = Math.sin(u * 2.3) > 0.55;
  return { x, y, facing: screenDx >= 0 ? 1 : -1, resting };
}

function drawAnimal(ctx, kind, pos, time, index) {
  const [fx0, fy0] = iso(pos.x, pos.y, 0);
  const x = Math.round(fx0), y = Math.round(fy0), f = pos.facing;
  const step = pos.resting ? 0 : Math.floor(time * 6 + index) % 2;
  // px() mirrors drawing when the animal faces left
  const px = (dx, dy, w, h, color) => rect(ctx, f > 0 ? x + dx : x - dx - w + 1, y + dy, w, h, color);
  if (kind === "chicken") {
    const peck = pos.resting && Math.floor(time * 4 + index) % 2;
    rect(ctx, x - 2, y, 4, 1, SHADOW);
    px(-1, -1, 1, 1, PAL.gold); px(1, -1, 1, 1, PAL.gold);         // legs
    px(-2, -4, 4, 3, "#f6f2e6");                                   // body
    px(-2, -4, 1, 1, "#d8d0c0");
    if (peck) { px(2, -2, 2, 2, "#f6f2e6"); px(4, -1, 1, 1, PAL.gold); px(2, -3, 1, 1, PAL.red); }
    else { px(1, -6, 2, 2, "#f6f2e6"); px(3, -5, 1, 1, PAL.gold); px(1, -7, 1, 1, PAL.red); px(2, -6, 1, 1, PAL.outline); }
  } else if (kind === "cow") {
    rect(ctx, x - 5, y, 10, 1, SHADOW);
    for (const lx of [-4, -2, 1, 3]) px(lx, -3, 1, 3 - ((lx > 0) === !!step ? 1 : 0), "#3a3030");
    px(-5, -7, 9, 4, "#f2eee6");                                   // body
    px(-3, -7, 3, 2, "#2b2626"); px(1, -5, 2, 2, "#2b2626");       // patches
    px(-6, -7, 1, 3, "#3a3030");                                   // tail
    const graze = pos.resting ? 2 : 0;
    px(4, -8 + graze, 3, 3, "#f2eee6"); px(6, -7 + graze, 1, 1, "#e8a8a0");   // head and nose
    px(4, -9 + graze, 1, 1, "#d8d0c0");
  } else if (kind === "sheep") {
    rect(ctx, x - 4, y, 8, 1, SHADOW);
    for (const lx of [-3, -1, 1, 2]) px(lx, -2, 1, 2 - (step && lx > 0 ? 1 : 0), "#3a3030");
    px(-4, -6, 7, 4, "#f4f0e6");                                   // woolly body
    px(-3, -7, 5, 1, "#f4f0e6");
    px(-4, -6, 1, 1, "#d8d2c4"); px(0, -7, 1, 1, "#d8d2c4");
    const graze = pos.resting ? 2 : 0;
    px(3, -6 + graze, 2, 3, "#3a3030");                            // dark face
  }
}


// ---------- Workers at their jobs ----------
const WORK_STATIONS = [
  { job: "hoe",    needs: "farm",       field: 0, pos: [7.4, 14.2], facing: 1 },
  { job: "hoe",    needs: "farm",       field: 1, pos: [5.0, 16.5], facing: -1 },
  { job: "hoe",    needs: "farm",       field: 2, pos: [8.6, 17.4], facing: 1 },
  { job: "chop",   needs: "lumberMill",           pos: [14.45, 10.75], facing: -1 },
  { job: "mine",   needs: "quarry",               pos: [12.6, 3.25], facing: -1 },
  { job: "hammer", needs: "blacksmith",           pos: [13.95, 11.0], facing: -1 },
  { job: "sell",   needs: "market",               pos: [9.95, 11.55], facing: 1 },
];

function getActiveStations() {
  const b = state.buildings;
  const fields = Math.min(b.farm.count, VILLAGE_LAYOUT.farmFields.length);
  return WORK_STATIONS.filter(s => b[s.needs].count > 0 && (s.field === undefined || s.field < fields));
}

// A villager doing their job, with a looping tool animation.
function drawJobWorker(ctx, station, time, index) {
  const [fx0, fy0] = iso(station.pos[0], station.pos[1], 0);
  const x = Math.round(fx0), y = Math.round(fy0), f = station.facing;
  const px = (dx, dy, w, h, color) => rect(ctx, f > 0 ? x + dx : x - dx - w + 1, y + dy, w, h, color);
  const cycle = station.job === "hammer" ? 0.5 : station.job === "sell" ? 2.4 : 1.1;
  const t = ((time + index * 0.37) % cycle) / cycle;
  const down = t > 0.5;                                   // the tool comes down in the second half
  const shirts = { hoe: "#4f9a4a", chop: "#c8442f", mine: "#7a776c", hammer: "#5a3a24", sell: "#8a5aa8" };
  rect(ctx, x - 2, y, 5, 1, SHADOW);
  px(-1, -2, 1, 2, PAL.woodDeep); px(1, -2, 1, 2, PAL.woodDeep);              // legs
  const bend = down && station.job !== "sell" ? 1 : 0;
  px(-1, -5 + bend, 3, 3, shirts[station.job]);                                 // body
  px(-1, -7 + bend, 3, 2, PAL.skin);                                            // head
  px(-1, -8 + bend, 3, 1, station.job === "mine" ? PAL.gold : PAL.trunkDark);   // hair / miner's cap
  px(1, -6 + bend, 1, 1, PAL.outline);

  switch (station.job) {
    case "hoe":
      if (down) { px(2, -4, 3, 1, PAL.wood); px(5, -4, 1, 3, PAL.metalDark); }
      else { px(2, -8, 1, 5, PAL.wood); px(2, -9, 2, 1, PAL.metalDark); }
      if (down && t < 0.65) { px(5, -2, 1, 1, PAL.soilLight); px(6, -3, 1, 1, PAL.soil); }
      break;
    case "chop":
      px(3, -1, 4, 2, PAL.woodLight); px(3, -1, 4, 1, PAL.logEnd);              // log on the block
      if (down) { px(2, -4, 3, 1, PAL.wood); px(4, -5, 2, 2, PAL.metal); }
      else { px(1, -10, 1, 5, PAL.wood); px(1, -11, 2, 2, PAL.metal); }
      if (down && t < 0.62) { px(6, -4, 1, 1, PAL.logEnd); px(7, -2, 1, 1, PAL.woodLight); }   // wood chips
      break;
    case "mine":
      if (down) { px(2, -5, 3, 1, PAL.wood); px(4, -6, 1, 3, PAL.metalDark); }
      else { px(1, -10, 1, 5, PAL.wood); px(0, -11, 3, 1, PAL.metalDark); }
      if (down && t < 0.6) { px(5, -4, 1, 1, PAL.stoneLight); px(6, -6, 1, 1, PAL.fireLight); }
      break;
    case "hammer":
      if (down) { px(2, -4, 2, 1, PAL.wood); px(3, -5, 2, 2, PAL.metalDark); }
      else { px(2, -8, 1, 4, PAL.wood); px(2, -9, 2, 2, PAL.metalDark); }
      if (down && t < 0.7) {                                                  // sparks fly
        px(4, -6, 1, 1, PAL.fireLight); px(6, -7, 1, 1, PAL.fire); px(5, -9, 1, 1, PAL.fireLight);
        addLight(x + f * 4, y - 5, 4);
      }
      break;
    case "sell": {
      const wave = Math.floor(t * 8) % 2 && t < 0.4;
      if (wave) px(2, -9, 1, 3, PAL.skin); else px(2, -5, 1, 2, PAL.skin);
      break;
    }
  }
}


// ---------- Windmill (farm tier 3) and fountain (market tier 2) ----------

function drawWindmillBody(ctx, tx, ty) {
  const [sx, sy] = iso(tx, ty, 0);
  fillEllipse(ctx, sx + 5, sy + 1, 9, 3, SHADOW);
  fillPoly(ctx, [[sx - 6, sy], [sx - 3, sy - 26], [sx, sy - 26], [sx, sy + 2]], PAL.plaster);
  fillPoly(ctx, [[sx, sy - 26], [sx + 3, sy - 26], [sx + 6, sy], [sx, sy + 2]], PAL.plasterShade);
  for (let y = sy - 20; y < sy; y += 6) rect(ctx, sx - 5 + (sy - y) / 8, y, 10 - (sy - y) / 4, 1, PAL.plasterDeep);
  rect(ctx, sx - 2, sy - 7, 3, 7, PAL.door);
  rect(ctx, sx - 1, sy - 18, 2, 3, PAL.glass);
  addLight(sx, sy - 17, 5);
  fillPoly(ctx, [[sx - 5, sy - 26], [sx, sy - 34], [sx, sy - 26]], PAL.roofRedLight);
  fillPoly(ctx, [[sx, sy - 34], [sx + 5, sy - 26], [sx, sy - 26]], PAL.roofRedDark);
}

function drawWindmillSails(ctx, tx, ty, time) {
  const [sx, sy] = iso(tx, ty, 0);
  const cx = sx - 1, cy = sy - 27;
  const angle = time * 0.9;
  for (let k = 0; k < 4; k++) {
    const a = angle + (k * Math.PI) / 2;
    const ex = cx + Math.cos(a) * 15, ey = cy + Math.sin(a) * 15;
    drawLine(ctx, cx, cy, ex, ey, PAL.woodDark);
    // sail cloth beside each arm
    const nx = -Math.sin(a) * 3, ny = Math.cos(a) * 3;
    fillPoly(ctx, [[cx + Math.cos(a) * 5, cy + Math.sin(a) * 5], [ex, ey], [ex + nx, ey + ny], [cx + Math.cos(a) * 5 + nx, cy + Math.sin(a) * 5 + ny]], PAL.cloth);
  }
  rect(ctx, cx - 1, cy - 1, 3, 3, PAL.woodDeep);
}

function drawFountainBasin(ctx, tx, ty) {
  const [sx, sy] = iso(tx, ty, 0);
  fillEllipse(ctx, sx + 2, sy + 1, 11, 4, SHADOW);
  fillEllipse(ctx, sx, sy - 1, 10, 4, PAL.stoneDark);
  fillEllipse(ctx, sx, sy - 3, 10, 4, PAL.stoneLight);
  fillEllipse(ctx, sx, sy - 3, 8, 3, PAL.waterDark);
  fillEllipse(ctx, sx - 1, sy - 3, 6, 2, PAL.water);
  rect(ctx, sx - 1, sy - 12, 3, 9, PAL.stone);
  rect(ctx, sx + 1, sy - 12, 1, 9, PAL.stoneDark);
  fillEllipse(ctx, sx, sy - 12, 4, 1.5, PAL.stoneLight);
}

function drawFountainWater(ctx, tx, ty, time) {
  const [sx, sy] = iso(tx, ty, 0);
  for (let i = 0; i < 6; i++) {                      // arcs of falling droplets
    const t = ((time * 1.6 + i / 6) % 1);
    const side = i % 2 ? 1 : -1;
    const dx = side * t * 6, dy = -14 - Math.sin(t * Math.PI) * 5 + t * 10;
    rect(ctx, sx + dx, sy + dy, 1, 1, PAL.waterLight);
  }
  rect(ctx, sx, sy - 15 - (Math.floor(time * 6) % 2), 1, 2, PAL.foam);
  if (Math.floor(time * 3) % 2) rect(ctx, sx - 5, sy - 4, 2, 1, PAL.foam);
  else rect(ctx, sx + 4, sy - 3, 2, 1, PAL.foam);
}

// Strings of colorful flags across the plaza (market tier 1+).
function drawBunting(ctx, a, b) {
  const [x1, y1] = iso(a[0], a[1], 14), [x2, y2] = iso(b[0], b[1], 14);
  const colors = [PAL.red, PAL.gold, PAL.blue, PAL.green, PAL.purple];
  const steps = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 5));
  let last = [x1, y1];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = [lerp(x1, x2, t), lerp(y1, y2, t) + Math.sin(t * Math.PI) * 4];
    drawLine(ctx, ...last, ...p, PAL.woodDeep);
    if (i < steps) {
      const c = colors[i % colors.length];
      rect(ctx, p[0] - 1, p[1] + 1, 3, 1, c);
      rect(ctx, p[0], p[1] + 2, 1, 1, c);
    }
    last = p;
  }
}


// ---------- Butterflies ----------

const BUTTERFLIES = [
  { anchor: [6.5, 12.6], color: "#f6f2a0" }, { anchor: [14.2, 16.5], color: "#f6f6f0" },
  { anchor: [3.5, 9.5], color: "#f0a8d8" }, { anchor: [16.8, 6.8], color: "#a8d0f6" },
];

function drawButterflies(ctx, time, light) {
  if (light.darkness > 0.4) return;
  BUTTERFLIES.forEach((b, i) => {
    const u = time * 0.5 + i * 1.7;
    const [sx, sy] = iso(b.anchor[0] + Math.sin(u) * 0.8, b.anchor[1] + Math.cos(u * 1.3) * 0.6, 10 + Math.sin(u * 3) * 4);
    const flap = Math.floor(time * 10 + i) % 2;
    rect(ctx, sx - (flap ? 2 : 1), sy, flap ? 2 : 1, 1, b.color);
    rect(ctx, sx + 1, sy, flap ? 2 : 1, 1, b.color);
    rect(ctx, sx, sy, 1, 1, PAL.outline);
  });
}

// ---------- Building illustrations for the catalog ----------
// Each building is drawn on a small square plot of land, like a
// diorama, using the same drawing code as the village.

const BUILDING_ART = {
  farm:       { w: 3, d: 2, draw: (g, t) => { if (t >= 2) drawSilo(g, -0.15, 0.55); drawBarn(g, 0, 0, t); drawHay(g, 0.2, 2.05); } },
  lumberMill: { w: 3, d: 2, draw: (g, t) => { drawLumberMill(g, 0, 0, t); drawLogPile(g, 0.1, 1.95); } },
  quarry:     { w: 2, d: 2, draw: (g, t) => drawQuarryArt(g, t) },
  market:     { w: 2, d: 1, draw: (g, t) => { drawStall(g, 0, 0, PAL.red, t); drawStall(g, 1, 0.1, PAL.blue, t); } },
  house:      { w: 2, d: 2, draw: (g, t) => drawHouse(g, 0, 0, 1, t) },
  blacksmith: { w: 2, d: 2, draw: (g, t) => drawBlacksmith(g, 0, 0, t) },
  academy:    { w: 2, d: 2, draw: (g, t) => drawAcademy(g, 0, 0, t) },
  barracks:   { w: 2, d: 3, draw: (g, t) => drawBarracks(g, 0, 0, t) },
};

// A small rocky outcrop with a cut face, for the quarry illustration.
function drawQuarryArt(g, tier) {
  drawIsoBox(g, { x: 0.1, y: 0.1, w: 1.8, d: 1.2, z: 0 }, 16, PAL.rock, PAL.rockDark, PAL.rockLight);
  drawIsoBox(g, { x: 0.5, y: 0.2, w: 1.1, d: 0.7, z: 16 }, 8, PAL.rock, PAL.rockDark, PAL.rockLight);
  drawIsoBox(g, { x: 0.4, y: 1.3, w: 1.2, d: 0.5, z: 0 }, 6, PAL.rockLight, PAL.rock, PAL.rockLight);
  for (let i = 0; i < 2 + tier; i++) {
    drawIsoBox(g, { x: 0.15 + i * 0.4, y: 1.9, w: 0.3, d: 0.3, z: 0 }, 4, PAL.stoneLight, PAL.stone, PAL.cloth);
  }
  const [cx, cy] = iso(1.85, 1.6, 0);
  rect(g, cx, cy - 22, 2, 22, PAL.wood);
  drawLine(g, cx + 1, cy - 22, cx - 16, cy - 28, PAL.wood);
  rect(g, cx - 14, cy - 27, 1, 10, PAL.outline);
  if (tier >= 3) addRoofFlag(g, cx, cy - 31, PAL.gold);
}

// The patch of land under an illustrated building.
function drawPlot(g, plot) {
  const { x, y, w, d } = plot;
  const depth = 5;
  fillPoly(g, [iso(x, y + d, 0), iso(x + w, y + d, 0), iso(x + w, y + d, -depth), iso(x, y + d, -depth)], PAL.soilL);
  fillPoly(g, [iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x + w, y + d, -depth), iso(x + w, y, -depth)], PAL.soilR);
  drawLine(g, ...iso(x, y + d, 0), ...iso(x + w, y + d, 0), PAL.grassDark);
  fillPoly(g, [iso(x, y, 0), iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x, y + d, 0)], PAL.grass);
  const random = makeRandom(Math.round(w * 13 + d * 7));
  for (let i = 0; i < 18; i++) {
    const [px, py] = iso(x + random() * w, y + random() * d, 0);
    rect(g, px, py, 1, 1, random() < 0.5 ? PAL.grassDeep : PAL.grassLight);
  }
}

function renderBuildingArt(typeId) {
  const canvas = document.createElement("canvas");
  canvas.width = 88;
  canvas.height = 72;
  const spec = BUILDING_ART[typeId];
  if (!spec) return canvas;
  const g = canvas.getContext("2d");
  const tier = typeId === "barracks"
    ? (state.military.barracksLevel > 0 ? getBuildingTier("barracks") : 0)
    : getBuildingTier(typeId);
  const savedFx = fx;
  fx = newEffects();                                   // collect flags/fires just for this picture
  const plot = { x: -0.3, y: -0.3, w: spec.w + 0.6, d: spec.d + 0.6 };
  const left = iso(plot.x, plot.y + plot.d)[0], right = iso(plot.x + plot.w, plot.y)[0];
  const bottom = iso(plot.x + plot.w, plot.y + plot.d)[1] + 5;
  g.translate(Math.round(44 - (left + right) / 2), Math.round(70 - bottom));
  drawPlot(g, plot);
  spec.draw(g, tier);
  drawFlags(g, 0);
  drawSaws(g, 0);
  drawFires(g, 0);
  fx = savedFx;
  return canvas;
}

// ---------- Building the scene ----------

// Rebuilds all cached art from the current game state.
let sceneCastleTier = -1;

function buildScene() {
  sceneCastleTier = getCastleTier();
  fx = newEffects();
  tiles = buildTileMap();
  sceneObjects = buildSceneObjects();
  fx.groundDraws.push(paintStairs, paintBridge);
  terrainCanvas = paintTerrain();
  islandMask = paintIslandMask();
  findWaterfalls();
}

// Everything that stands on the ground. Each entry has a depth
// (bigger = nearer = drawn later) and either a cached sprite or a
// draw(ctx, time) function for animated things.
function buildSceneObjects() {
  const L = VILLAGE_LAYOUT;
  const b = state.buildings;
  const list = [];
  const occupied = new Set();
  const occupy = (x, y, w, d) => {
    for (let ty = y; ty < y + d; ty++) for (let tx = x; tx < x + w; tx++) occupied.add(tx + "," + ty);
  };
  const addSprite = (depth, bounds, drawFn, tag = null) => list.push({ depth, sprite: makeSprite(bounds, drawFn), tag });

  // Castle on its hill (depth chosen so the stairs and roads draw in front)
  addSprite(17, { x: 140, y: -30, w: 210, h: 170 }, drawCastle, "castle");
  occupy(4, 4, 6, 6);

  // Houses
  L.huts.forEach((h, i) => {
    occupy(h.x, h.y, 2, 2);
    addSprite(h.x + h.y + 3.4, boxBounds({ x: h.x, y: h.y, w: 2, d: 2, z: 0 }, 40), ctx => drawHouse(ctx, h.x, h.y, i));
  });

  // Houses you have built fill the plots one by one
  const houseCount = Math.min(b.house.count, L.housePlots.length);
  for (let i = 0; i < houseCount; i++) {
    const h = L.housePlots[i];
    occupy(h.x, h.y, 2, 2);
    addSprite(h.x + h.y + 3.4, boxBounds({ x: h.x, y: h.y, w: 2, d: 2, z: 0 }, 40), ctx => drawHouse(ctx, h.x, h.y, i + 1), "house");
  }

  if (state.military.barracksLevel > 0) {
    const r = L.barracks;
    occupy(r.x, r.y, 2, 3);
    addSprite(r.x + r.y + 3.4, boxBounds({ x: r.x, y: r.y, w: 2, d: 3, z: 0 }, 44), ctx => drawBarracks(ctx, r.x, r.y), "barracks");
  }

  if (b.blacksmith.count > 0) {
    const m = L.blacksmith;
    occupy(m.x, m.y, 2, 2);
    addSprite(m.x + m.y + 3.4, boxBounds({ x: m.x, y: m.y, w: 2, d: 2, z: 0 }, 44), ctx => drawBlacksmith(ctx, m.x, m.y), "blacksmith");
  }
  if (b.academy.count > 0) {
    const a = L.academy;
    occupy(a.x, a.y, 2, 2);
    addSprite(a.x + a.y + 3.4, boxBounds({ x: a.x, y: a.y, w: 2, d: 2, z: 0 }, 70), ctx => drawAcademy(ctx, a.x, a.y), "academy");
  }

  // Farm: barn + one field per farm
  if (b.farm.count > 0) {
    const barn = L.barn;
    occupy(barn.x, barn.y, 3, 2);
    addSprite(barn.x + barn.y + 4.6, boxBounds({ x: barn.x, y: barn.y, w: 3, d: 2, z: 0 }, 44), ctx => drawBarn(ctx, barn.x, barn.y));
    addSprite(barn.x + barn.y + 5.5, boxBounds({ x: barn.x, y: barn.y + 2, w: 1, d: 1, z: 0 }, 12), ctx => {
      drawHay(ctx, barn.x + 0.2, barn.y + 2.2);
      drawHay(ctx, barn.x + 0.25, barn.y + 2.15 - 0.05);
    });
  }
  const fieldCount = Math.min(b.farm.count, L.farmFields.length);
  for (let i = 0; i < fieldCount; i++) {
    const f = L.farmFields[i];
    occupy(f.x, f.y, f.w, f.d);
    fx.groundDraws.push(g => paintFieldBackFence(g, f));
    for (let row = 0; row < f.d; row++) {
      list.push({
        depth: f.x + f.y + row + 1.2,
        draw(ctx, time) {
          const cycle = (time / CROP_CYCLE_SECONDS + i * 0.27) % 1;
          const stage = cycle < 0.2 ? 0 : cycle < 0.5 ? 1 : cycle < 0.9 ? 2 : 3;
          const sway = Math.floor(time * 1.4 + row * 0.5 + i) % 2;
          const s = getCropRowSprite(f, row, FIELD_CROPS[i], stage, sway);
          ctx.drawImage(s.canvas, s.x, s.y);
        },
      });
    }
    addSprite(f.x + f.w + f.y + f.d, boxBounds({ ...f, z: 0 }, 8), ctx => drawFieldFrontFence(ctx, f), "farm");
  }

  // Lumber mill
  if (b.lumberMill.count > 0) {
    const m = L.lumberMill;
    occupy(m.x, m.y, 3, 2);
    addSprite(m.x + m.y + 3.6, boxBounds({ x: m.x, y: m.y, w: 3, d: 2, z: 0 }, 40), ctx => drawLumberMill(ctx, m.x, m.y), "lumberMill");
    addSprite(14.2 + 9.2 + 0.8, boxBounds({ x: 14.2, y: 9.2, w: 1, d: 0.8, z: 0 }, 12), ctx => drawLogPile(ctx, 14.15, 9.15));
    addSprite(17.2 + 10.2 + 0.8, boxBounds({ x: 17.2, y: 10.2, w: 1, d: 0.8, z: 0 }, 12), ctx => drawLogPile(ctx, 17.15, 10.15));
  }

  // Quarry works
  if (b.quarry.count > 0) {
    addSprite(15.2, { x: 280, y: 60, w: 120, h: 90 }, ctx => drawQuarryWorks(ctx), "quarry");
  }

  // Market stalls: one market = 2 stalls, each extra market adds one (max 4)
  const stallCount = b.market.count > 0 ? Math.min(L.marketStalls.length, b.market.count + 1) : 0;
  for (let i = 0; i < stallCount; i++) {
    const s = L.marketStalls[i];
    addSprite(s.x + s.y + 1.85, boxBounds({ x: s.x, y: s.y, w: 1, d: 1, z: 0 }, 26), ctx => drawStall(ctx, s.x, s.y, STALL_COLORS[i]), "market");
  }

  // Plaza: a well, or a fountain once the markets prosper
  const [wx, wy] = iso(11, 12.5, 0);
  const marketTier = b.market.count > 0 ? getBuildingTier("market") : 0;
  if (marketTier >= 2) {
    const basin = makeSprite({ x: wx - 14, y: wy - 18, w: 28, h: 24 }, ctx => drawFountainBasin(ctx, 11, 12.5));
    list.push({ depth: 23.5, draw(c, time) { c.drawImage(basin.canvas, basin.x, basin.y); drawFountainWater(c, 11, 12.5, time); } });
  } else {
    addSprite(23.5, { x: wx - 10, y: wy - 24, w: 22, h: 30 }, ctx => drawWell(ctx, 11, 12.5));
  }
  if (b.market.count > 0 && marketTier >= 1) {
    addSprite(22.2, { x: 190, y: 90, w: 110, h: 50 }, ctx => drawBunting(ctx, [9.05, 11.05], [12.95, 11.05]));
    addSprite(23.2, { x: 160, y: 90, w: 110, h: 70 }, ctx => drawBunting(ctx, [9.05, 11.05], [9.05, 13.95]));
  }

  // Farm extras: a grain silo, then a windmill with turning sails
  if (b.farm.count > 0 && getBuildingTier("farm") >= 2) {
    const [sx2, sy2] = iso(2.75, 13.65, 0);
    addSprite(16.3, { x: sx2 - 10, y: sy2 - 34, w: 22, h: 40 }, ctx => drawSilo(ctx, 2.75, 13.65));
  }
  if (b.farm.count > 0 && getBuildingTier("farm") >= 3) {
    occupy(3, 17, 1, 1);
    const [mx, my] = iso(3.4, 17.5, 0);
    const body = makeSprite({ x: mx - 12, y: my - 38, w: 26, h: 44 }, ctx => drawWindmillBody(ctx, 3.4, 17.5));
    list.push({ depth: 20.9, draw(c, time) { c.drawImage(body.canvas, body.x, body.y); drawWindmillSails(c, 3.4, 17.5, time); } });
  }
  for (const [lx, ly] of [[9.05, 11.05], [12.95, 11.05], [9.05, 13.95], [12.95, 13.95], [11.1, 16], [11.1, 19], [6, 12.05], [2.8, 12.05], [15.1, 12.05]]) {
    const [sx, sy] = iso(lx, ly, 0);
    addSprite(lx + ly, { x: sx - 8, y: sy - 18, w: 16, h: 22 }, ctx => drawLamp(ctx, sx, sy));
  }
  for (const [px, py, kind] of [[13.3, 11.3, "barrel"], [13.5, 11.5, "barrel"], [16.9, 9.4, "barrel"], [5.9, 14.9, "barrel"]]) {
    const [sx, sy] = iso(px, py, 0);
    addSprite(px + py, { x: sx - 2, y: sy - 10, w: 10, h: 12 }, ctx => drawBarrel(ctx, sx, sy));
  }
  {
    const [sx, sy] = iso(11.6, 9.6, 0);
    addSprite(21.2, { x: sx - 8, y: sy - 6, w: 16, h: 10 }, ctx => drawCampfire(ctx, sx, sy));
  }

  // Trees on forest tiles, pines on mountains, plus a few on the grass
  const random = makeRandom(77);
  const treeSprites = {};
  const addTree = (kind, tx, ty, z, size, seed) => {
    const [sx, sy] = iso(tx, ty, z);
    const key = kind + size + (seed % 4);
    if (!treeSprites[key]) {
      // Two pictures per tree: standing straight and leaning in the wind
      treeSprites[key] = [0, 1].map(sway => makeSprite({ x: -16, y: -size * 3 - 6, w: 34, h: size * 3 + 12 }, ctx => {
        if (kind === "pine") drawPine(ctx, 0, 0, size, sway);
        else if (kind === "bush") drawBush(ctx, 0, 0, size);
        else if (kind === "boulder") drawBoulder(ctx, 0, 0, size);
        else drawTree(ctx, 0, 0, size, seed % 4 + 3, sway);
      }));
    }
    if (kind === "tree" || kind === "pine") fx.fireflies.push({ x: sx, y: sy - size * 2 });
    const frames = treeSprites[key];
    const ax = Math.round(sx), ay = Math.round(sy), phase = tx * 0.9 + ty * 0.5;
    const sways = kind === "tree" || kind === "pine";
    list.push({
      depth: tx + ty,
      draw(c, time) {
        // a gentle gust rolls across the island from left to right
        const frame = sways && Math.sin(time * 1.1 - phase) > 0.75 ? 1 : 0;
        c.drawImage(frames[frame].canvas, ax + frames[frame].x, ay + frames[frame].y);
      },
    });
  };
  for (let ty = 0; ty < MAP_SIZE; ty++) {
    for (let tx = 0; tx < MAP_SIZE; tx++) {
      const tile = tiles[ty][tx];
      if (occupied.has(tx + "," + ty)) continue;
      // Skip spots hidden behind higher ground
      const blocked = [[1, 0], [0, 1], [1, 1]].some(([dx, dy]) => {
        const z = tileZ(tx + dx, ty + dy);
        return z !== null && z > tile.z;
      });
      if (blocked) continue;
      if (tile.kind === "forest") {
        const count = 1 + Math.floor(random() * 2);
        for (let i = 0; i < count; i++) {
          const kind = random() < 0.45 ? "pine" : "tree";
          addTree(kind, tx + 0.2 + random() * 0.6, ty + 0.2 + random() * 0.6, tile.z, kind === "pine" ? 6 + Math.floor(random() * 3) : 6 + Math.floor(random() * 3), Math.floor(random() * 100));
        }
      } else if ((tile.kind === "rock" || tile.kind === "snow") && random() < 0.35) {
        addTree(random() < 0.7 ? "pine" : "boulder", tx + 0.5, ty + 0.5, tile.z, 5, Math.floor(random() * 100));
      } else if (tile.kind === "grass" && tile.z === 0 && random() < 0.07) {
        addTree(random() < 0.5 ? "bush" : "tree", tx + 0.5, ty + 0.5, 0, random() < 0.5 ? 3 : 6, Math.floor(random() * 100));
      } else if (tile.kind === "grass" && tile.z > 0 && random() < 0.1) {
        addTree("bush", tx + 0.5, ty + 0.5, tile.z, 3, 1);
      }
    }
  }

  list.sort((a, b) => a.depth - b.depth);
  return list;
}

// Waterfalls where the river spills over a cliff or the island's edge.
function findWaterfalls() {
  for (let ty = 0; ty < MAP_SIZE; ty++) {
    for (let tx = 0; tx < MAP_SIZE; tx++) {
      const tile = tiles[ty][tx];
      // River flowing off the front-left edge of the island
      if (tile.kind === "water" && ty === MAP_SIZE - 1) {
        fx.falls.push({ a: iso(tx, ty + 1, tile.z), b: iso(tx + 1, ty + 1, tile.z), length: VIEW_HEIGHT });
      }
      // Spring pouring out of the mountain into the river
      if (tile.kind === "water" && ty > 0 && tileZ(tx, ty - 1) > tile.z + 6) {
        const top = tileZ(tx, ty - 1);
        fx.falls.push({ a: iso(tx + 0.2, ty, top), b: iso(tx + 0.8, ty, top), length: top - tile.z });
      }
    }
  }
}


// ---------- Sky, background and lighting ----------

// Where we are in the day: 0 = sunrise ... 0.55 sunset ... night ... 1.
function getDaylight(nowMs) {
  const p = ((nowMs / 1000) % DAY_LENGTH_SECONDS) / DAY_LENGTH_SECONDS;
  let darkness;
  if (p < 0.55) darkness = 0;
  else if (p < 0.65) darkness = (p - 0.55) / 0.1;
  else if (p < 0.9) darkness = 1;
  else darkness = 1 - (p - 0.9) / 0.1;
  darkness = darkness * darkness * (3 - 2 * darkness);     // smooth the change
  // Warm sunset / sunrise glow
  const distance = Math.min(Math.abs(p - 0.6), Math.abs(p - 0.95), Math.abs(p + 0.05));
  const glow = Math.max(0, 1 - distance / 0.08);
  return { p, darkness, glow };
}

function getSkyCanvas(light) {
  const key = Math.round(light.darkness * 40) * 100 + Math.round(light.glow * 40);
  if (skyCache.key === key) return skyCache.canvas;
  const canvas = skyCache.canvas || document.createElement("canvas");
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  const g = canvas.getContext("2d");
  const bandHeight = Math.ceil(VIEW_HEIGHT / 6 / 2);
  const colors = PAL.daySky.map((c, i) => {
    let color = lerpColor(c, PAL.nightSky[i], light.darkness);
    return lerpColor(color, PAL.duskSky[i], light.glow * 0.75);
  });
  for (let i = 0; i < 6; i++) rect(g, 0, i * bandHeight, VIEW_WIDTH, VIEW_HEIGHT, colors[i]);
  for (let i = 1; i < 6; i++) {                                   // dithered band edges
    const y = i * bandHeight - 1;
    for (let x = 0; x < VIEW_WIDTH; x += 2) {
      rect(g, x + (i % 2), y, 1, 1, colors[i]);
      rect(g, x + 1 - (i % 2), y + 1, 1, 1, colors[i - 1]);
    }
  }
  skyCache = { key, canvas };
  return canvas;
}

// Distant mountains and the sea of clouds below the island (cached).
function paintBackground() {
  const g = document.createElement("canvas").getContext("2d");
  g.canvas.width = VIEW_WIDTH;
  g.canvas.height = VIEW_HEIGHT;
  const peaks = [[20, 92, 46], [92, 104, 40], [160, 96, 44], [330, 98, 46], [400, 90, 48], [470, 102, 40]];
  for (const [px, py, hw] of peaks) {
    fillPoly(g, [[px - hw, 150], [px, py], [px, 150]], PAL.mountFar);
    fillPoly(g, [[px, py], [px + hw, 150], [px, 150]], PAL.mountFarDark);
    fillPoly(g, [[px - 7, py + 7], [px, py], [px, py + 8]], PAL.snow);
    fillPoly(g, [[px, py], [px + 7, py + 7], [px, py + 8]], PAL.snowShade);
  }
  for (const [px, py, hw] of [[56, 118, 40], [128, 124, 36], [370, 120, 40], [440, 116, 42]]) {
    fillPoly(g, [[px - hw, 152], [px, py], [px, 152]], PAL.mountNear);
    fillPoly(g, [[px, py], [px + hw, 152], [px, 152]], PAL.mountNearDark);
  }
  // Sea of clouds
  const random = makeRandom(5);
  rect(g, 0, 150, VIEW_WIDTH, VIEW_HEIGHT - 150, PAL.cloudShade);
  for (let row = 0; row < 6; row++) {
    const y = 146 + row * 22;
    for (let x = -20; x < VIEW_WIDTH + 30; x += 26 + Math.floor(random() * 10)) {
      const r = 14 + Math.floor(random() * 8);
      fillEllipse(g, x + 2, y + 3, r, r * 0.5, PAL.cloudDeep);
      fillEllipse(g, x, y, r, r * 0.5, PAL.cloud);
      fillEllipse(g, x - 3, y - 2, r * 0.6, r * 0.3, "#ffffff");
    }
  }
  return g.canvas;
}

function drawCloud(ctx, x, y, s) {
  fillEllipse(ctx, x + s * 0.5, y + 2, s * 1.9, s * 0.45, PAL.cloudShade);
  fillEllipse(ctx, x - s * 0.5, y, s * 0.9, s * 0.55, PAL.cloud);
  fillEllipse(ctx, x + s * 0.4, y - s * 0.35, s, s * 0.75, PAL.cloud);
  fillEllipse(ctx, x + s * 1.4, y, s * 0.8, s * 0.5, PAL.cloud);
}

const cloudSprites = {};
function getCloudSprite(size) {
  if (!cloudSprites[size]) {
    cloudSprites[size] = makeSprite({ x: -size * 2.2, y: -size * 1.4, w: size * 5, h: size * 2.6 }, ctx => drawCloud(ctx, 0, 0, size));
  }
  return cloudSprites[size];
}

// Clouds drifting across the sky.
const SKY_CLOUDS = [[30, 14, 9, 3], [170, 8, 7, 2], [300, 20, 11, 2.5], [420, 10, 7, 3.5], [520, 28, 8, 2.2]];
function drawSkyClouds(ctx, time) {
  for (const [x0, y, size, speed] of SKY_CLOUDS) {
    const span = VIEW_WIDTH + 120;
    const x = ((x0 + time * speed) % span + span) % span - 60;
    const s = getCloudSprite(size);
    ctx.drawImage(s.canvas, Math.round(x + s.x), Math.round(y + s.y));
  }
}

// Fluffy clouds in front of the island's underside.
function drawLowClouds(ctx, time) {
  for (const [x0, y, size, speed] of [[60, 254, 12, 4], [250, 262, 14, 3], [420, 250, 11, 5], [-80, 266, 13, 3.5]]) {
    const span = VIEW_WIDTH + 160;
    const x = ((x0 + time * speed) % span + span) % span - 80;
    const s = getCloudSprite(size);
    ctx.drawImage(s.canvas, Math.round(x + s.x), Math.round(y + s.y));
  }
}

function drawSunAndMoon(ctx, light) {
  const p = light.p;
  if (p < 0.64) {
    const t = p / 0.64;
    const x = 20 + t * 440, y = 70 - Math.sin(Math.PI * t) * 55;
    fillEllipse(ctx, x, y, 9, 9, "rgba(255, 230, 140, 0.35)");
    fillEllipse(ctx, x, y, 6, 6, PAL.sunGlow);
    fillEllipse(ctx, x - 1, y - 1, 4, 4, PAL.sun);
  }
  if (p > 0.56) {
    const t = (p - 0.56) / 0.44;
    const x = 20 + t * 440, y = 70 - Math.sin(Math.PI * t) * 50;
    fillEllipse(ctx, x, y, 5, 5, PAL.moon);
    fillEllipse(ctx, x + 2, y - 1, 4, 4, PAL.moonShade);
    fillEllipse(ctx, x + 3, y - 2, 3, 3, lerpColor(PAL.nightSky[1], PAL.daySky[1], 1 - light.darkness));
  }
}

const STARS = (() => {
  const random = makeRandom(99);
  return Array.from({ length: 70 }, () => ({ x: Math.floor(random() * VIEW_WIDTH), y: Math.floor(random() * 120), phase: random() * 6.28 }));
})();

function drawStars(ctx, light, time) {
  if (light.darkness < 0.2) return;
  ctx.globalAlpha = Math.min(1, (light.darkness - 0.2) * 1.5);
  for (const s of STARS) {
    if (Math.sin(time * 2 + s.phase) > -0.3) rect(ctx, s.x, s.y, 1, 1, PAL.star);
  }
  ctx.globalAlpha = 1;
}

// Shadows of clouds gliding over the island (kept on the ground by the mask).
function drawCloudShadows(ctx, time) {
  if (!shadowLayer) {
    shadowLayer = document.createElement("canvas");
    shadowLayer.width = VIEW_WIDTH;
    shadowLayer.height = VIEW_HEIGHT;
  }
  const g = shadowLayer.getContext("2d");
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  for (const [x0, y, rx, speed] of [[0, 120, 46, 5], [260, 190, 38, 4], [520, 90, 34, 6]]) {
    const span = VIEW_WIDTH + 200;
    const x = ((x0 + time * speed) % span + span) % span - 100;
    fillEllipse(g, x, y, rx, rx * 0.45, "rgba(20, 40, 30, 0.16)");
    fillEllipse(g, x + rx * 0.6, y - 6, rx * 0.6, rx * 0.3, "rgba(20, 40, 30, 0.16)");
  }
  g.globalCompositeOperation = "destination-in";
  g.drawImage(islandMask, 0, 0);
  ctx.drawImage(shadowLayer, 0, 0);
}

function drawBirds(ctx, time, light) {
  if (light.darkness > 0.5) return;
  const cycle = 45;
  const t = time % cycle;
  const x = -20 + t * 14;
  if (x > VIEW_WIDTH + 20) return;
  const flap = Math.floor(time * 5) % 2;
  for (const [dx, dy] of [[0, 0], [-7, 4], [-12, -2]]) {
    const bx = Math.round(x + dx), by = Math.round(30 + Math.sin(time * 0.7) * 6 + dy);
    rect(ctx, bx - 2, by - flap, 2, 1, PAL.outline);
    rect(ctx, bx + 1, by - flap, 2, 1, PAL.outline);
    rect(ctx, bx, by, 1, 1, PAL.outline);
  }
}


// ---------- Animated details ----------

// Shimmering water and falling waterfalls.
function drawWater(ctx, time) {
  for (const s of fx.sparkles) {
    // highlights drift slowly downstream so the river seems to flow
    const drift = ((time * 3 + s.phase * 4) % 6) - 3;
    if (Math.sin(time * 2.2 + s.phase) > 0.35) rect(ctx, s.x + drift, s.y + drift * 0.5, 2, 1, PAL.waterLight);
  }
  for (const f of fx.falls) {
    const width = Math.round(Math.abs(f.b[0] - f.a[0]));
    const dir = f.b[0] > f.a[0] ? 1 : -1;
    for (let i = 0; i <= width; i++) {
      const x = Math.round(f.a[0] + i * dir);
      const top = Math.round(lerp(f.a[1], f.b[1], width ? i / width : 0));
      const bottom = Math.min(VIEW_HEIGHT, top + f.length);
      rect(ctx, x, top, 1, bottom - top, PAL.water);
      for (let y = top; y < bottom; y += 6) {
        const offset = Math.floor(time * 30 + i * 3) % 6;
        rect(ctx, x, y + offset, 1, 2, i % 3 === 0 ? PAL.foam : PAL.waterLight);
      }
    }
    if (f.length < VIEW_HEIGHT) {                                 // splash at the bottom
      const bx = Math.round((f.a[0] + f.b[0]) / 2);
      const by = Math.round(Math.max(f.a[1], f.b[1]) + f.length);
      const puff = Math.floor(time * 6) % 2;
      rect(ctx, bx - 4 - puff, by - 1, 9 + puff * 2, 2, PAL.foam);
    }
  }
}

function drawFlags(ctx, time) {
  for (const f of fx.flags) {
    const frame = Math.floor(time * 4 + f.x * 0.3) % 2;
    rect(ctx, f.x, f.y, 6, 3, f.color);
    if (frame === 0) { rect(ctx, f.x + 6, f.y + 1, 2, 1, f.color); rect(ctx, f.x + 3, f.y + 3, 2, 1, PAL.bannerDark); }
    else { rect(ctx, f.x + 6, f.y, 1, 2, f.color); rect(ctx, f.x + 1, f.y + 3, 2, 1, PAL.bannerDark); }
    rect(ctx, f.x + 2, f.y + 1, 2, 1, PAL.gold);
  }
}

function drawSaws(ctx, time) {
  for (const s of fx.saws) {
    fillEllipse(ctx, s.x, s.y, 3, 3, PAL.metalDark);
    fillEllipse(ctx, s.x, s.y, 2, 2, PAL.metal);
    const angle = time * 12;
    for (let k = 0; k < 4; k++) {
      const a = angle + (k * Math.PI) / 2;
      rect(ctx, s.x + Math.round(Math.cos(a) * 3), s.y + Math.round(Math.sin(a) * 3), 1, 1, PAL.outline);
    }
  }
}

function drawFires(ctx, time) {
  for (const f of fx.fires) {
    const flicker = Math.floor(time * 10 + f.x) % 3;
    if (f.small) {
      rect(ctx, f.x, f.y - 2 - (flicker === 0 ? 1 : 0), 1, 2, PAL.fireLight);
      rect(ctx, f.x - 1, f.y - 1, 3, 1, PAL.fire);
    } else {
      rect(ctx, f.x - 2, f.y - 2, 5, 2, PAL.fire);
      rect(ctx, f.x - 1, f.y - 4 - flicker, 3, 3, PAL.fire);
      rect(ctx, f.x, f.y - 3 - flicker, 1, 3, PAL.fireLight);
    }
  }
}

// Called when something is built or upgraded: a cloud of dust
// (build) or golden sparkles (upgrade) appears at that building.
function requestVillageBurst(tag, kind) {
  pendingBursts.push({ tag, kind });
}

function spawnPendingBursts() {
  for (const { tag, kind } of pendingBursts) {
    // The newest building with this tag is the last one in the list
    const target = sceneObjects.filter(o => o.tag === tag).pop();
    if (!target) continue;
    const s = target.sprite;
    const cx = s.x + s.canvas.width / 2;
    const cy = s.y + s.canvas.height - 8;
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 14;
      burstParticles.push({
        x: cx + (Math.random() - 0.5) * 16,
        y: cy - Math.random() * 14,
        vx: Math.cos(angle) * speed,
        vy: kind === "build" ? -Math.abs(Math.sin(angle)) * speed * 0.6 : -10 - Math.random() * 14,
        age: 0,
        life: 0.9 + Math.random() * 0.6,
        color: kind === "build" ? (i % 2 ? "#d8c8a8" : "#b8a684") : (i % 3 ? PAL.gold : "#fff6c0"),
        kind,
      });
    }
  }
  pendingBursts = [];
}

function updateAndDrawBursts(ctx, dt, time) {
  const next = [];
  for (const p of burstParticles) {
    p.age += dt;
    if (p.age > p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    if (p.kind === "build") p.vy += 10 * dt;                  // dust settles
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    const size = p.kind === "build" ? 2 + Math.floor(p.age * 3) : (Math.sin(time * 20 + p.x) > 0 ? 2 : 1);
    rect(ctx, p.x, p.y, size, size, p.color);
    next.push(p);
  }
  ctx.globalAlpha = 1;
  burstParticles = next;
}

// Smoke puffs rising from chimneys and drifting with the wind.
function updateAndDrawSmoke(ctx, time, dt) {
  for (const c of fx.chimneys) {
    c.timer = (c.timer || Math.random()) - dt;
    if (c.timer <= 0) {
      c.timer = 0.7 + Math.random() * 0.5;
      smokePuffs.push({ x: c.x, y: c.y, age: 0 });
    }
  }
  const next = [];
  for (const p of smokePuffs) {
    p.age += dt;
    if (p.age > 3.2) continue;
    p.y -= dt * 7;
    p.x += dt * (3 + Math.sin(time + p.y * 0.1) * 2);
    const size = 1 + Math.floor(p.age * 1.1);
    ctx.globalAlpha = Math.max(0, 0.75 - p.age * 0.23);
    rect(ctx, p.x - size / 2, p.y - size / 2, size, size, p.age < 1 ? "#d8d4cc" : "#c2beb6");
    next.push(p);
  }
  ctx.globalAlpha = 1;
  smokePuffs = next.slice(-120);
}


// ---------- Workers ----------

// How many workers walk around: one per citizen plus one per extra building.
function getWorkers() {
  const b = state.buildings;
  let buildings = 0;
  for (const typeId in b) buildings += b[typeId].count;
  const count = Math.min(MAX_WORKERS, state.population + Math.max(0, buildings - 2));
  const routes = WORKER_ROUTES.filter(r => !r.needs || b[r.needs].count > 0);
  const workers = [];
  for (let i = 0; i < count; i++) {
    workers.push({ route: routes[i % routes.length], offset: i * 7.3, shirt: SHIRT_COLORS[i % SHIRT_COLORS.length], hair: HAIR_COLORS[(i * 3) % HAIR_COLORS.length], speed: 0.45 + (i % 3) * 0.08 });
  }
  // Knights drilling in front of the barracks (blue tabards, steel helmets)
  const knightCount = Math.min(4, countKnights(state.military.army));
  for (let i = 0; i < knightCount; i++) {
    workers.push({ route: KNIGHT_DRILL_ROUTE, offset: i * 2.7, shirt: "#3a5fa8", hair: "#cfd4dc", speed: 0.35 });
  }
  return workers;
}

// Works out where a worker is right now, purely from the time.
// Workers walk to the end of their route, rest, then walk back.
function getWorkerPosition(worker, time) {
  const pts = worker.route.points;
  const segments = [];
  let total = 0;
  const path = worker.route.loop ? [...pts, pts[0]] : pts;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay, az] = path[i], [bx, by, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, by - ay, (bz - az) / LEVEL_HEIGHT);
    segments.push({ a: path[i], b: path[i + 1], len });
    total += len;
  }
  const walkTime = total / worker.speed;
  const rest = 1.5;
  let distance, moving = true, forward = true;
  if (worker.route.loop) {
    distance = ((time + worker.offset) % walkTime) * worker.speed;
  } else {
    const cycle = 2 * walkTime + 2 * rest;
    const t = (time + worker.offset) % cycle;
    if (t < walkTime) distance = t * worker.speed;
    else if (t < walkTime + rest) { distance = total; moving = false; }
    else if (t < 2 * walkTime + rest) { distance = total - (t - walkTime - rest) * worker.speed; forward = false; }
    else { distance = 0; moving = false; }
  }
  for (const s of segments) {
    if (distance <= s.len || s === segments[segments.length - 1]) {
      const t = s.len ? Math.min(1, distance / s.len) : 0;
      const x = lerp(s.a[0], s.b[0], t), y = lerp(s.a[1], s.b[1], t), z = lerp(s.a[2], s.b[2], t);
      const screenDx = (s.b[0] - s.a[0]) - (s.b[1] - s.a[1]);
      return { x, y, z, moving, facing: (screenDx >= 0) === forward ? 1 : -1 };
    }
    distance -= s.len;
  }
  return { x: pts[0][0], y: pts[0][1], z: pts[0][2], moving: false, facing: 1 };
}

function drawWorker(ctx, worker, pos, time) {
  const [fx0, fy0] = iso(pos.x, pos.y, pos.z);
  const x = Math.round(fx0), y = Math.round(fy0);
  const step = pos.moving ? Math.floor(time * 8 + worker.offset) % 2 : 0;
  const bob = pos.moving && step ? -1 : 0;
  rect(ctx, x - 2, y, 5, 1, SHADOW);
  // Legs
  rect(ctx, x - 1, y - 2 + (step ? 0 : 0), 1, 2 - step, PAL.woodDeep);
  rect(ctx, x + 1, y - 2, 1, 1 + step, PAL.woodDeep);
  // Body and head
  rect(ctx, x - 1, y - 5 + bob, 3, 3, worker.shirt);
  rect(ctx, x + 1, y - 5 + bob, 1, 3, "rgba(0,0,0,0.25)");
  rect(ctx, x - 1, y - 7 + bob, 3, 2, PAL.skin);
  rect(ctx, x - 1, y - 8 + bob, 3, 1, worker.hair);
  rect(ctx, x + (pos.facing > 0 ? 1 : -1), y - 6 + bob, 1, 1, PAL.outline);
  // What they carry
  const side = pos.facing > 0 ? 2 : -2;
  switch (worker.route.carry) {
    case "log": rect(ctx, x - 3, y - 7 + bob, 7, 1, PAL.wood); rect(ctx, x + (pos.facing > 0 ? 3 : -3), y - 7 + bob, 1, 1, PAL.logEnd); break;
    case "wheat": rect(ctx, x + side, y - 6 + bob, 1, 4, PAL.wheat); rect(ctx, x + side, y - 7 + bob, 1, 1, PAL.wheatLight); break;
    case "stone": rect(ctx, x - 1, y - 10 + bob, 3, 2, PAL.stoneLight); break;
    case "crate": rect(ctx, x + side - (side > 0 ? 0 : 1), y - 5 + bob, 2, 2, PAL.woodLight); break;
    case "sack": rect(ctx, x - side, y - 6 + bob, 2, 3, PAL.cloth); break;
    case "sword": rect(ctx, x + side, y - 9 + bob, 1, 5, PAL.metal); rect(ctx, x + side - 1, y - 5 + bob, 3, 1, PAL.gold); break;
  }
}


// ---------- Drawing a frame ----------

function drawFrame(time, dt) {
  const ctx = villageCtx;
  const light = getDaylight(Date.now());

  // 1. Sky, sun/moon, stars, clouds, distant mountains and cloud sea
  ctx.drawImage(getSkyCanvas(light), 0, 0);
  drawStars(ctx, light, time);
  drawSunAndMoon(ctx, light);
  drawSkyClouds(ctx, time);
  ctx.drawImage(backgroundCanvas, 0, 0);
  drawBirds(ctx, time, light);

  // 2. The island's ground, water and passing cloud shadows
  ctx.drawImage(terrainCanvas, 0, 0);
  drawWater(ctx, time);
  drawCloudShadows(ctx, time);

  // 3. Buildings, trees and workers, back to front
  const workers = getWorkers().map(w => ({ w, pos: getWorkerPosition(w, time) }));
  const items = sceneObjects.concat(workers.map(({ w, pos }) => ({
    depth: pos.x + pos.y + (pos.z > 0 ? 1 : 0),
    draw: (c, t) => drawWorker(c, w, pos, t),
  })));
  // Villagers working at their stations
  getActiveStations().forEach((station, i) => items.push({
    depth: station.pos[0] + station.pos[1],
    draw: (c, t) => drawJobWorker(c, station, t, i),
  }));
  // Farm animals and sheep wandering about
  for (const herd of ANIMAL_HERDS) {
    if (herd.needs && state.buildings[herd.needs].count === 0) continue;
    for (let i = 0; i < herd.count; i++) {
      const pos = getAnimalPosition(herd, i, time);
      items.push({ depth: pos.x + pos.y, draw: (c, t) => drawAnimal(c, herd.kind, pos, t, i) });
    }
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const item of items) {
    if (item.sprite) ctx.drawImage(item.sprite.canvas, (item.ax || 0) + item.sprite.x, (item.ay || 0) + item.sprite.y);
    else item.draw(ctx, time);
  }

  // 4. Little moving details
  drawFlags(ctx, time);
  drawSaws(ctx, time);
  drawFires(ctx, time);
  updateAndDrawSmoke(ctx, time, dt);
  updateAndDrawBursts(ctx, dt, time);
  drawButterflies(ctx, time, light);
  drawLowClouds(ctx, time);

  // 5. Day/night lighting: tint everything, then add glowing lights
  if (light.glow > 0) {
    ctx.fillStyle = `rgba(255, 130, 60, ${0.15 * light.glow})`;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }
  if (light.darkness > 0) {
    ctx.fillStyle = `rgba(14, 20, 62, ${0.5 * light.darkness})`;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawNightLights(ctx, light, time);
  }
}

function drawNightLights(ctx, light, time) {
  const a = light.darkness;
  ctx.globalCompositeOperation = "lighter";
  for (const l of fx.lights) {
    fillEllipse(ctx, l.x, l.y, l.r, l.r * 0.7, `rgba(255, 170, 70, ${0.16 * a})`);
    rect(ctx, l.x - 1, l.y - 1, 2, 2, `rgba(255, 210, 120, ${0.55 * a})`);
  }
  for (const f of fx.fires) {
    const flicker = 0.85 + Math.sin(time * 13 + f.x) * 0.15;
    const r = f.small ? 7 : 12;
    fillEllipse(ctx, f.x, f.y - 2, r, r * 0.7, `rgba(255, 140, 50, ${0.22 * a * flicker})`);
  }
  // Fireflies near the trees
  for (let i = 0; i < fx.fireflies.length; i += 3) {
    const f = fx.fireflies[i];
    if (Math.sin(time * 3 + i) < 0.2) continue;
    const x = f.x + Math.sin(time * 0.8 + i) * 6, y = f.y + Math.cos(time * 0.6 + i * 2) * 4;
    rect(ctx, x, y, 1, 1, `rgba(220, 255, 120, ${0.9 * a})`);
  }
  ctx.globalCompositeOperation = "source-over";
}

// Scales the 480x270 canvas to fill its frame, while leaving room for
// the top bar and bottom navigation on short screens.
function resizeVillageCanvas() {
  const frame = document.getElementById("village-frame");
  if (!frame.offsetParent) return;                       // village tab is hidden
  const screenWidth = document.getElementById("screen-village").clientWidth;
  const frameExtra = frame.offsetWidth - frame.clientWidth + 2 * parseFloat(getComputedStyle(frame).paddingLeft) + 6;
  const availableWidth = screenWidth - frameExtra;
  const headerHeight = document.querySelector(".top-bar").offsetHeight;
  const navHeight = document.getElementById("bottom-nav").offsetHeight;
  const availableHeight = Math.max(200, window.innerHeight - headerHeight - navHeight - 48);

  const scale = Math.min(availableWidth / VIEW_WIDTH, availableHeight / VIEW_HEIGHT);
  villageCanvas.style.width = Math.floor(VIEW_WIDTH * scale) + "px";
  villageCanvas.style.height = Math.floor(VIEW_HEIGHT * scale) + "px";
}

// Prepares the art that never changes.
function setupVillageArt() {
  backgroundCanvas = paintBackground();
}

// The drawing loop: up to 30 frames per second. requestAnimationFrame
// pauses in hidden tabs, which is fine - resources are handled by the
// time-based game loop, not by drawing.
function renderLoop(now) {
  requestAnimationFrame(renderLoop);
  if (now - lastFrameMs < FRAME_INTERVAL_MS) return;
  const dt = Math.min(0.1, (now - lastFrameMs) / 1000);
  lastFrameMs = now;
  if (getCastleTier() !== sceneCastleTier) villageNeedsRedraw = true;   // the castle has grown
  if (villageNeedsRedraw) {
    buildScene();
    villageNeedsRedraw = false;
  }
  if (pendingBursts.length) spawnPendingBursts();
  drawFrame(now / 1000, dt);
}


/* =============================================================
   8b. BATTLE VIEW
   -------------------------------------------------------------
   The battlefield is its own small 320x160 canvas, drawn in the
   same pixel style as the village. Each frame we advance the
   battle simulation by the real time that passed (in fixed
   0.05 s steps), then draw every unit, health bar and damage
   number.
   ============================================================= */

const BATTLE_WIDTH = 320;
const BATTLE_HEIGHT = 160;
const BATTLE_PLAYBACK_SPEED = 1.5;   // battles play 1.5x faster than real time

const battleView = { canvas: null, ctx: null, background: null, accumulator: 0, lastMs: 0, lastHits: 0, lastClash: 0 };

// Main colors for each unit type (also used for fallen units).
const UNIT_COLORS = {
  swordsman: { body: "#3a5fa8", bodyDark: "#26407a", metal: "#cfd4dc", accent: "#f2c14e" },
  guardian:  { body: "#8a90a0", bodyDark: "#5e6474", metal: "#cfd4dc", accent: "#3a5fa8" },
  ranger:    { body: "#4f7a3a", bodyDark: "#35552a", metal: "#cfd4dc", accent: "#8a5a32" },
  cavalier:  { body: "#3a5fa8", bodyDark: "#26407a", metal: "#cfd4dc", accent: "#8a5a32" },
  paladin:   { body: "#ece6d6", bodyDark: "#c9bfa6", metal: "#f2c14e", accent: "#f2c14e" },
  raider:    { body: "#9a7448", bodyDark: "#6b4f2e", metal: "#a8a8b0", accent: "#7a4a24" },
  berserker: { body: "#e0a07a", bodyDark: "#b8785a", metal: "#a8a8b0", accent: "#c8442f" },
  marauder:  { body: "#5a4636", bodyDark: "#3e3026", metal: "#c8c8d0", accent: "#9a9aa2" },
  brute:     { body: "#c9946e", bodyDark: "#9a6e50", metal: "#8a5a32", accent: "#6b4f2e" },
  drummer:   { body: "#8a6a44", bodyDark: "#5e472c", metal: "#a8642a", accent: "#f1e8d4" },
  chieftain: { body: "#6b4f2e", bodyDark: "#4a3620", metal: "#b8b8c0", accent: "#8e2a20" },
};

// How tall each sprite is (so health bars sit just above its head).
const UNIT_HEIGHTS = { cavalier: 20, brute: 16, chieftain: 21, berserker: 13, guardian: 13 };

// Draws one unit standing at (x, y) = the spot between its feet.
// facing: 1 = looking right, -1 = looking left.
// o.step = walking frame, o.lunge = attacking, o.flash = just got hit.
function drawUnitSprite(ctx, typeId, x, y, facing, o = {}) {
  const c = UNIT_COLORS[typeId] || UNIT_COLORS.swordsman;
  const f = facing >= 0 ? 1 : -1;
  const lunge = o.lunge ? f * 2 : 0;
  // px() draws a rectangle relative to the feet, mirrored when facing left
  const px = (dx, dy, w, h, color) => {
    const rx = f > 0 ? x + dx + lunge : x - dx - w + 1 + lunge;
    ctx.fillStyle = o.flash ? "#ffffff" : color;
    ctx.fillRect(Math.round(rx), Math.round(y + dy), w, h);
  };
  const shadowWidth = typeId === "cavalier" || typeId === "chieftain" || typeId === "brute" ? 13 : 9;
  if (!o.noShadow) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.fillRect(Math.round(x - shadowWidth / 2), Math.round(y), shadowWidth, 1);
  }
  const step = o.step || 0;
  const skin = "#e8b796";
  const legs = (color, wide = false) => {
    px(wide ? -3 : -2, -3, 2, step ? 2 : 3, color);
    px(wide ? 2 : 1, -3, 2, step ? 3 : 2, color);
  };

  switch (typeId) {
    case "swordsman":
      legs("#3a3a44");
      px(-4, -8, 2, 5, c.bodyDark); px(-4, -8, 2, 1, c.accent);          // shield
      px(-2, -8, 5, 5, c.body);                                          // tabard
      px(0, -7, 1, 3, c.accent); px(-1, -6, 3, 1, c.accent);             // gold cross
      px(3, -8, 1, 3, c.metal);
      px(-2, -11, 5, 3, c.metal); px(1, -10, 2, 1, "#2b1d14");           // helmet
      px(-1, -12, 2, 1, "#c8442f");                                      // plume
      if (o.lunge) { px(4, -7, 5, 1, "#eef2f8"); px(4, -8, 1, 3, c.accent); }
      else { px(4, -12, 1, 5, "#eef2f8"); px(3, -7, 3, 1, c.accent); }
      break;
    case "guardian":
      legs("#4a4e5a", true);
      px(-3, -9, 6, 6, c.body);                                          // heavy plate
      px(-3, -9, 6, 1, c.metal);
      px(-2, -13, 5, 4, c.metal); px(0, -11, 3, 1, "#2b1d14");           // great helm
      px(3, -12, 3, 10, c.accent); px(3, -12, 3, 1, "#f2c14e");          // tower shield
      px(4, -9, 1, 4, "#f2c14e");
      break;
    case "ranger":
      legs("#5a3e26");
      px(-3, -9, 1, 5, c.accent);                                        // quiver
      px(-3, -10, 1, 1, "#e8e4d8");
      px(-2, -8, 4, 5, c.body);                                          // green tunic
      px(-2, -4, 4, 1, c.accent);
      px(-2, -11, 4, 3, c.bodyDark); px(0, -10, 2, 1, skin);             // hood and face
      px(4, -11, 1, 7, c.accent); px(3, -11, 1, 1, c.accent); px(3, -5, 1, 1, c.accent);   // bow
      px(o.lunge ? 2 : 3, -10, 1, 5, "#e8e4d8");                         // bowstring
      break;
    case "cavalier": {
      const gallop = step ? 1 : 0;
      px(-6, -3, 1, 3 - gallop, "#4a2f1d"); px(-4, -3, 1, 2 + gallop, "#4a2f1d");      // horse legs
      px(2, -3, 1, 2 + gallop, "#4a2f1d"); px(4, -3, 1, 3 - gallop, "#4a2f1d");
      px(-6, -7, 11, 4, "#8a5a32"); px(-6, -7, 11, 1, "#a87443");                       // horse body
      px(4, -10, 2, 4, "#8a5a32"); px(5, -11, 3, 3, "#8a5a32"); px(7, -10, 1, 1, "#2b1d14");   // neck, head
      px(-7, -7, 1, 4, "#4a2f1d");                                                      // tail
      px(-3, -7, 5, 3, c.body); px(-3, -5, 5, 1, c.accent);                             // saddle cloth
      px(-1, -12, 3, 5, c.body);                                                        // rider
      px(-1, -15, 3, 3, c.metal); px(0, -16, 1, 1, "#c8442f");
      if (o.lunge) px(2, -11, 8, 1, "#eef2f8");                                         // lance lowered
      else px(2, -19, 1, 9, "#eef2f8");
      break;
    }
    case "paladin":
      legs(c.bodyDark);
      px(-4, -9, 1, 7, "#f4f0e6");                                       // white cape
      px(-3, -9, 6, 6, c.body);                                          // shining armor
      px(-3, -9, 6, 1, c.accent); px(0, -8, 1, 4, c.accent);
      px(-2, -12, 5, 3, c.metal); px(1, -11, 2, 1, "#2b1d14");           // golden helm
      px(-1, -13, 3, 1, "#fff6c0");                                      // halo glint
      if (o.lunge) { px(4, -8, 4, 1, c.bodyDark); px(7, -10, 2, 4, "#cfd4dc"); }   // warhammer swing
      else { px(4, -13, 1, 6, c.bodyDark); px(3, -14, 3, 2, "#cfd4dc"); }
      break;
    case "raider":
      legs("#4a3220");
      px(-2, -8, 5, 5, c.body); px(-2, -4, 5, 1, c.bodyDark);
      px(-3, -8, 1, 3, skin); px(3, -8, 1, 3, skin);
      px(-2, -11, 4, 3, skin); px(-2, -12, 4, 1, "#6b4528"); px(-2, -9, 4, 1, "#6b4528");
      px(1, -10, 1, 1, "#2b1d14");
      if (o.lunge) { px(4, -7, 4, 1, c.accent); px(7, -8, 2, 3, c.metal); }
      else { px(4, -11, 1, 5, c.accent); px(4, -12, 2, 2, c.metal); }
      break;
    case "berserker":
      legs("#3a2a1a");
      px(-3, -9, 6, 6, c.body); px(-2, -8, 1, 3, c.accent); px(1, -8, 1, 3, c.accent);
      px(-3, -4, 6, 1, "#3a2a1a");
      px(-2, -12, 4, 3, c.body); px(-3, -13, 6, 2, c.accent); px(1, -11, 1, 1, "#2b1d14");
      if (o.lunge) { px(4, -8, 4, 1, "#7a4a24"); px(7, -9, 2, 3, c.metal); px(-5, -6, 2, 2, c.metal); }
      else { px(4, -12, 1, 5, "#7a4a24"); px(4, -13, 2, 2, c.metal); px(-4, -12, 1, 5, "#7a4a24"); px(-5, -13, 2, 2, c.metal); }
      break;
    case "marauder":
      legs("#3e3026");
      px(-2, -8, 4, 5, c.body);
      px(-3, -9, 6, 2, "#9a9aa2");                                       // wolf pelt
      px(-2, -12, 4, 3, "#8a8a92"); px(-2, -13, 1, 1, "#8a8a92"); px(1, -13, 1, 1, "#8a8a92");   // wolf hood + ears
      px(0, -11, 2, 1, skin); px(1, -11, 1, 1, "#2b1d14");
      if (o.lunge) { px(3, -7, 4, 1, c.metal); px(-5, -6, 3, 1, c.metal); }      // twin knives
      else { px(3, -8, 1, 3, c.metal); px(-3, -7, 1, 3, c.metal); }
      break;
    case "brute":
      legs("#4a3620", true);
      px(-4, -11, 9, 8, c.body);                                         // huge chest
      px(-4, -11, 9, 2, "#6b5a46"); px(-3, -5, 7, 1, "#4a3620");         // fur shoulders, belt
      px(-2, -14, 4, 3, c.body); px(1, -13, 1, 1, "#2b1d14");            // bald head
      if (o.lunge) { px(4, -9, 6, 2, c.metal); px(8, -10, 3, 4, c.accent); }     // club smash
      else { px(5, -15, 2, 9, c.metal); px(4, -16, 4, 3, c.accent); }
      break;
    case "drummer": {
      const beat = o.beat ? 1 : 0;
      legs("#4a3220");
      px(-2, -8, 4, 5, c.body);
      px(-2, -11, 4, 3, skin); px(-2, -12, 4, 1, "#c08040"); px(1, -10, 1, 1, "#2b1d14");
      px(2, -8, 4, 5, c.metal); px(2, -8, 4, 1, c.accent); px(2, -4, 4, 1, c.accent);   // war drum
      px(3, -10 + beat, 1, 2, "#e8e4d8"); px(5, -9 - beat, 1, 2, "#e8e4d8");            // drumsticks
      break;
    }
    case "chieftain":
      legs("#3a2a1a", true);
      px(-5, -13, 2, 11, c.accent);                                      // red fur cape
      px(-3, -13, 8, 9, c.body); px(-1, -13, 3, 1, "#f2c14e");           // armor, golden torc
      px(-3, -5, 8, 1, "#3a2a1a");
      px(-2, -17, 5, 4, skin); px(-2, -14, 5, 2, "#c08040"); px(2, -16, 1, 1, "#2b1d14");   // face, braided beard
      px(-3, -19, 7, 2, c.metal);                                        // horned helmet
      px(-4, -21, 1, 3, "#f0e8d0"); px(4, -21, 1, 3, "#f0e8d0");
      if (o.lunge) { px(5, -11, 7, 1, "#7a4a24"); px(10, -13, 3, 5, c.metal); }        // great axe swing
      else { px(5, -20, 1, 13, "#7a4a24"); px(5, -21, 4, 5, c.metal); px(6, -20, 2, 3, "#e8e8f0"); }
      break;
  }
}

// A fallen unit lying on the ground.
function drawFallenUnit(ctx, typeId, x, y, facing) {
  const c = UNIT_COLORS[typeId] || UNIT_COLORS.swordsman;
  const f = facing >= 0 ? -1 : 1;     // they fall backwards
  ctx.globalAlpha = 0.65;
  rect(ctx, x - 5, y - 2, 10, 2, c.body);
  rect(ctx, f > 0 ? x + 5 : x - 8, y - 3, 3, 3, KNIGHT_TYPES[typeId] ? c.metal : "#e8b796");
  rect(ctx, f > 0 ? x - 8 : x + 5, y - 1, 3, 1, "#3a3a44");
  ctx.globalAlpha = 1;
}

// Tiny 3x5 pixel digits for damage numbers (crisp at any scale).
const PIXEL_DIGITS = {
  0: ["111", "101", "101", "101", "111"], 1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"], 3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"], 7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"], 9: ["111", "101", "111", "001", "111"],
};

function drawPixelNumber(ctx, value, x, y, color) {
  const text = String(value);
  const startX = Math.round(x - (text.length * 4) / 2);
  for (const pass of [0, 1]) {                 // dark outline first, then the color
    for (let i = 0; i < text.length; i++) {
      const glyph = PIXEL_DIGITS[text[i]];
      if (!glyph) continue;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (glyph[row][col] !== "1") continue;
          const gx = startX + i * 4 + col, gy = Math.round(y) + row;
          if (pass === 0) rect(ctx, gx - 1, gy - 1, 3, 3, "#2b1d14");
          else rect(ctx, gx, gy, 1, 1, color);
        }
      }
    }
  }
}

// The battlefield in front of the castle walls (painted once).
function paintBattleBackground() {
  const g = document.createElement("canvas").getContext("2d");
  g.canvas.width = BATTLE_WIDTH;
  g.canvas.height = BATTLE_HEIGHT;
  const random = makeRandom(321);
  // Sky and distant hills
  const sky = ["#5a9fda", "#6cafe2", "#80bfe9", "#97cfef"];
  sky.forEach((color, i) => rect(g, 0, i * 8, BATTLE_WIDTH, 8, color));
  for (let x = -20; x < BATTLE_WIDTH + 40; x += 44) {
    fillEllipse(g, x, 44, 34, 14, PAL.mountNearDark);
    fillEllipse(g, x - 4, 44, 28, 12, PAL.mountNear);
  }
  rect(g, 0, 40, BATTLE_WIDTH, 12, PAL.forestFront);
  for (let x = 0; x < BATTLE_WIDTH; x += 6) {
    fillEllipse(g, x, 42 + Math.floor(random() * 3), 5, 4, PAL.forestFront);
    fillEllipse(g, x - 1, 41, 3, 2, PAL.forestFrontLight);
  }
  // Grass field
  rect(g, 0, 50, BATTLE_WIDTH, BATTLE_HEIGHT - 50, PAL.grass);
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(random() * BATTLE_WIDTH), y = 52 + Math.floor(random() * 106);
    rect(g, x, y, 1 + Math.floor(random() * 3), 1, random() < 0.5 ? PAL.grassDark : PAL.grassLight);
  }
  // Dirt road across the field
  for (let x = 0; x < BATTLE_WIDTH; x++) {
    const y = 100 + Math.round(Math.sin(x / 40) * 4);
    rect(g, x, y, 1, 10, PAL.dirt);
    rect(g, x, y, 1, 1, PAL.dirtDark);
    if (random() < 0.15) rect(g, x, y + 2 + Math.floor(random() * 6), 1, 1, PAL.dirtLight);
  }
  // Castle wall on the left
  rect(g, 0, 30, 18, 130, PAL.stone);
  rect(g, 14, 30, 4, 130, PAL.stoneDark);
  for (let y = 33; y < BATTLE_HEIGHT; y += 4) rect(g, 0, y, 14, 1, PAL.stoneDark);
  for (let y = 26; y < 30; y++) for (let x = 0; x < 18; x += 5) rect(g, x, 26, 3, 4, PAL.stoneLight);
  rect(g, 6, 92, 8, 22, PAL.door);
  rect(g, 2, 48, 6, 12, PAL.banner);
  rect(g, 4, 52, 2, 3, PAL.gold);
  // Forest on the right where the raiders come from
  for (let i = 0; i < 9; i++) {
    const tx = 300 + (i % 3) * 8 + Math.floor(random() * 4), ty = 70 + i * 10;
    if (i % 2) drawPine(g, tx, ty, 7);
    else drawTree(g, tx, ty, 6, i + 2);
  }
  return g.canvas;
}

function drawBattle(battle, time) {
  const ctx = battleView.ctx;
  if (!battleView.background) battleView.background = paintBattleBackground();
  ctx.drawImage(battleView.background, 0, 0);

  // Fallen units first, then the living sorted by y (lower = in front)
  for (const u of battle.units) if (!u.alive) drawFallenUnit(ctx, u.typeId, u.x, u.y, u.facing);
  const living = battle.units.filter(u => u.alive).sort((a, b) => a.y - b.y);
  const beat = Math.floor(time * 4) % 2;
  for (const u of living) {
    const step = u.moving ? Math.floor(time * 8 + u.x) % 2 : 0;
    // A soft ring shows who is inside a protective or war-drum aura
    if (u.protection > 0) rect(ctx, u.x - 3, u.y + 1, 7, 1, "rgba(120, 170, 255, 0.7)");
    if (u.attackBoost > 0) rect(ctx, u.x - 3, u.y + 1, 7, 1, "rgba(255, 120, 60, 0.7)");
    drawUnitSprite(ctx, u.typeId, u.x, u.y, u.facing, { step, beat, lunge: u.lunge > 0, flash: u.flash > 0 });
    // Health bar (bosses get a longer one)
    const height = UNIT_HEIGHTS[u.typeId] || 12;
    const width = u.boss ? 18 : 10;
    const ratio = u.hp / u.maxHp;
    rect(ctx, u.x - width / 2, u.y - height - 5, width, 2, "#2b1d14");
    rect(ctx, u.x - width / 2, u.y - height - 5, Math.max(1, Math.round(width * ratio)), 2, u.side === "knight" ? "#6fd16a" : "#e0503a");
    if (u.boss) {                                          // a little crown over the boss
      rect(ctx, u.x - 2, u.y - height - 9, 5, 2, PAL.gold);
      rect(ctx, u.x - 2, u.y - height - 10, 1, 1, PAL.gold);
      rect(ctx, u.x + 2, u.y - height - 10, 1, 1, PAL.gold);
    }
  }

  // Arrows flying, then floating damage (and green heal) numbers
  for (const e of battle.effects) {
    e.age += 1 / 30;
    if (e.arrow) {
      if (e.age > 0.25) continue;
      const t = e.age / 0.25;
      const ax = lerp(e.x1, e.x2, t), ay = lerp(e.y1, e.y2, t) - Math.sin(t * Math.PI) * 8;
      const dir = e.x2 >= e.x1 ? 1 : -1;
      rect(ctx, ax - 2 * dir, ay, 4, 1, "#e8e4d8");
      rect(ctx, ax + 2 * dir, ay, 1, 1, PAL.metalDark);
      continue;
    }
    if (e.age > 0.8) continue;
    ctx.globalAlpha = Math.max(0, 1 - e.age / 0.8);
    const color = e.heal ? "#7dff7a" : e.side === "knight" ? "#ff8a6a" : "#fff2a0";
    drawPixelNumber(ctx, e.value, e.x, e.y - e.age * 14, color);
  }
  ctx.globalAlpha = 1;
  battle.effects = battle.effects.filter(e => e.age <= (e.arrow ? 0.25 : 0.8));

  // Status line under the battlefield
  const knights = battle.units.filter(u => u.side === "knight" && u.alive).length;
  const enemies = battle.units.filter(u => u.side === "enemy" && u.alive).length;
  document.getElementById("battle-knights").textContent = `Knights: ${knights}`;
  document.getElementById("battle-enemies").textContent = `Barbarians: ${enemies}`;
  document.getElementById("battle-time").textContent = battle.over ? "Battle over" : `${Math.ceil(INVASION.battleTimeLimit - battle.time)}s`;
}

// Animation loop for the battle window.
function battleFrame(now) {
  const battle = currentBattle;
  if (!battle) return;
  // Preparation: the armies stand ready until the countdown ends
  if (battleView.phase === "prep") {
    const left = Math.ceil((battleView.prepEndsAt - now) / 1000);
    document.getElementById("battle-countdown").textContent = left > 0 ? `(${left})` : "";
    if (left <= 0) beginFight();
  }
  const dt = Math.min(0.1, (now - battleView.lastMs) / 1000);
  battleView.lastMs = now;
  if (battleView.phase === "prep") {
    drawBattle(battle, now / 1000);
    requestAnimationFrame(battleFrame);
    return;
  }
  battleView.accumulator += dt * BATTLE_PLAYBACK_SPEED;
  while (battleView.accumulator >= BATTLE_STEP && !battle.over) {
    stepBattle(battle, BATTLE_STEP);
    battleView.accumulator -= BATTLE_STEP;
  }
  // Clash sounds (not too many at once)
  if (battle.hits > battleView.lastHits && now - battleView.lastClash > 180) {
    battleView.lastClash = now;
    playSound("clash");
  }
  battleView.lastHits = battle.hits;
  drawBattle(battle, now / 1000);
  if (battle.over && !battle.resultApplied) finishLiveBattle();
  if (currentBattle === battle) requestAnimationFrame(battleFrame);
}

function setupBattleView() {
  battleView.canvas = document.getElementById("battle-canvas");
  battleView.ctx = battleView.canvas.getContext("2d");
  battleView.ctx.imageSmoothingEnabled = false;
}


// ---------- The barracks in the village ----------

function drawBarracks(ctx, tx, ty, tier = getBuildingTier("barracks")) {
  const box = { x: tx + 0.2, y: ty + 0.2, w: 1.6, d: 1.6, z: 0 };
  const h = 13;
  fx.shadows.push({ box, h: h + 8 });
  drawIsoBox(ctx, box, h, PAL.stone, PAL.stoneDark);
  paintBricks(ctx, box, h, PAL.stoneDark, PAL.stoneDeep);
  doorL(ctx, box, 0.6, 0.4, 9);
  windowR(ctx, box, 0.3, 6, 0.3, 4);
  windowR(ctx, box, 1.0, 6, 0.3, 4);
  for (const u of [0.15, 1.15]) {                               // red war banners
    faceL(ctx, box, u, 3, 0.25, 9, PAL.red);
    faceL(ctx, box, u + 0.07, 6, 0.1, 2, PAL.gold);
  }
  drawRoof(ctx, box, h, 9, ROOF_RED, "x", PAL.stoneDark);
  // Training dummy and weapon rack in the yard
  const [dx, dy] = iso(tx + 0.4, ty + 2.2, 0);
  rect(ctx, dx, dy - 10, 1, 10, PAL.woodDeep);
  rect(ctx, dx - 2, dy - 9, 5, 5, PAL.thatch);
  rect(ctx, dx - 1, dy - 12, 3, 3, PAL.thatchLight);
  rect(ctx, dx - 3, dy - 7, 7, 1, PAL.woodDark);
  const [rx, ry] = iso(tx + 1.6, ty + 2.1, 0);
  rect(ctx, rx - 4, ry - 6, 9, 1, PAL.wood);
  for (let i = 0; i < 4; i++) rect(ctx, rx - 3 + i * 2, ry - 9, 1, 9, i % 2 ? PAL.metal : PAL.woodDark);
  if (tier >= 1) drawArcheryTarget(ctx, ...iso(tx + 1.9, ty + 2.8, 0));
  if (tier >= 2) drawHorse(ctx, ...iso(tx + 0.9, ty + 2.75, 0));
  if (tier >= 3) {
    const [fx1, fy1] = iso(tx + 1.0, ty + 1.0, 22);
    addRoofFlag(ctx, fx1, fy1 - 8, PAL.red);
  }
}


/* =============================================================
   9. START THE GAME
   ============================================================= */

function initGame() {
  // Paint the interface textures and fill in the pixel icons first
  applyUiArt();
  fillIconSlots();
  // Set up the village canvas
  villageCanvas = document.getElementById("village-canvas");
  villageCtx = villageCanvas.getContext("2d");
  villageCtx.imageSmoothingEnabled = false; // keep pixels crisp
  setupVillageArt();

  // Load the saved kingdom (or keep the new one if there is no save)
  const saved = loadGame();
  if (saved) state = saved;

  // Build the interface
  buildResourceBar();
  buildBuildingPanel();
  buildResearchPanel();
  buildKingdomPanel();
  buildArmyPanel();
  setupBattleView();
  setupNavigation();
  setupSaveControls();
  setupAudioControls();
  resizeVillageCanvas();
  window.addEventListener("resize", resizeVillageCanvas);

  // Pay out any time away since the last save (shows "Welcome back")
  updateGame();
  saveGame();
  refreshUI();

  // Start the loops
  uiReady = true;
  setInterval(gameTick, LOGIC_INTERVAL_MS);
  setInterval(autoSave, AUTOSAVE_INTERVAL_MS);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", saveBeforeLeaving);
  window.addEventListener("beforeunload", saveBeforeLeaving);
  requestAnimationFrame(renderLoop);
}

// Wait until the HTML is ready, then start.
document.addEventListener("DOMContentLoaded", initGame);
