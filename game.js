/* =============================================================
   KINGDOM IDLE - GAME LOGIC                       (Stage 3)
   -------------------------------------------------------------
   This file is split into numbered sections:

     1. CONFIGURATION   - numbers & data you can tweak
     2. GAME STATE      - everything that changes while playing
     3. PRODUCTION      - how resources are generated
     3b. COSTS & ACTIONS - building and upgrading
     4. GAME LOOP       - time-based updates
     4b. SAVING         - localStorage, offline earnings
     5. NUMBER FORMAT   - turning 12345 into "12.3K"
     6. PIXEL ICONS     - tiny hand-made pixel art for the UI
     7. USER INTERFACE  - resource bar, building panel, tabs
     8. VILLAGE DRAWING - the pixel-art village on the canvas
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
//   startingCount   - how many you own in a brand-new game
//   buildCost       - price of your first newly built copy
//   upgradeBaseCost - price of the FIRST upgrade (level 1 -> 2)
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
  quarry: {
    name: "Quarry",
    produces: "stone",
    baseRatePerMinute: 5,
    description: "Cuts sturdy stone from the hillside.",
    startingCount: 0,
    buildCost: { wood: 100 },
    upgradeBaseCost: { wood: 120, food: 40 },
  },
  market: {
    name: "Market",
    produces: "gold",
    baseRatePerMinute: 2,
    description: "Merchants trade goods for gold.",
    startingCount: 0,
    buildCost: { wood: 100, stone: 50 },
    upgradeBaseCost: { wood: 120, stone: 60 },
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
const TAX_GOLD_PER_CITIZEN_PER_MINUTE = 0.1;

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
    settings: {},
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
  if (!type || count <= 0) return 0;

  // Level 1 = 100%, level 2 = 115%, level 3 = 132.25%, ...
  const levelMultiplier = Math.pow(1 + LEVEL_PRODUCTION_BONUS, level - 1);
  const perMinute = type.baseRatePerMinute * count * levelMultiplier;
  return perMinute / 60;
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
    rates[resourceId] += getBuildingRatePerSecond(typeId);
  }

  // Taxes
  rates.gold += (state.population * TAX_GOLD_PER_CITIZEN_PER_MINUTE) / 60;

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
  return scaleCost(type.buildCost, Math.pow(BUILD_COST_GROWTH, extraCopies));
}

// Price of the next upgrade.
// Example (Farm): Lv1->2 = 60 wood, Lv2->3 = 75, Lv3->4 = 94 ...
function getUpgradeCost(typeId) {
  const type = BUILDING_TYPES[typeId];
  const level = state.buildings[typeId].level;
  return scaleCost(type.upgradeBaseCost, Math.pow(UPGRADE_COST_GROWTH, level - 1));
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

// Called by the "Build" button. Returns true if it worked.
function buildBuilding(typeId) {
  updateGame(); // bank all production up to this exact moment first
  const cost = getBuildCost(typeId);
  if (!canAfford(cost)) return false;

  spendResources(cost);
  state.buildings[typeId].count += 1;
  markVillageDirty();   // a new building appears in the village
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
  refreshUI();
  return true;
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
  }
}

// Pays out production for time spent away (up to OFFLINE_CAP_HOURS)
// and shows the welcome-back window.
function handleTimeAway(secondsAway) {
  const secondsPaid = Math.min(secondsAway, OFFLINE_CAP_HOURS * 3600);
  const rates = getProductionPerSecond();
  const earned = {};
  for (const res of RESOURCES) earned[res.id] = rates[res.id] * secondsPaid;

  applyProduction(secondsPaid);
  showWelcomeBack(secondsAway, secondsPaid, earned);
}

// Refreshes everything on screen that shows numbers.
function refreshUI() {
  updateResourceBar();
  updateBuildingPanel();
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
  if (isGoodNumber(data.era) && data.era >= 1) clean.era = Math.floor(data.era);
  for (const key of ["research", "unlocked", "settings"]) {
    if (data[key] && typeof data[key] === "object") clean[key] = { ...data[key] };
  }
  if (isGoodNumber(data.lastSaved)) clean.lastSaved = data.lastSaved;
  // A timestamp in the future (clock changed) is treated as "now".
  if (isGoodNumber(data.lastUpdate) && data.lastUpdate <= Date.now()) {
    clean.lastUpdate = data.lastUpdate;
  }
  return clean;
}

// Wipes the save and starts a brand-new kingdom.
function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (error) { /* ignore */ }
  state = createNewGameState();
  welcomeTotals = null;
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
    item.appendChild(createPixelIcon(entry.id));

    const text = document.createElement("div");
    text.className = "resource-text";
    text.innerHTML =
      `<span class="resource-name">${entry.name}</span>` +
      `<span class="resource-amount">0</span>` +
      `<span class="resource-rate">+0/s</span>`;
    item.appendChild(text);
    bar.appendChild(item);

    resourceElements[entry.id] = {
      amount: text.querySelector(".resource-amount"),
      rate: text.querySelector(".resource-rate"),
    };
  }
}

// Refreshes the numbers in the top bar.
function updateResourceBar() {
  const rates = getProductionPerSecond();

  for (const res of RESOURCES) {
    const el = resourceElements[res.id];
    el.amount.textContent = formatNumber(state.resources[res.id]);
    el.rate.textContent = formatRate(rates[res.id]);
    el.rate.classList.toggle("zero", rates[res.id] <= 0);
  }

  const popEl = resourceElements.population;
  popEl.amount.textContent = formatNumber(state.population);
  popEl.rate.textContent = "citizens";
  popEl.rate.classList.add("zero");
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
      `<div class="building-header">` +
        `<div class="building-info">` +
          `<div class="building-name">${type.name} <span class="building-count"></span></div>` +
          `<div class="building-meta">${type.description}</div>` +
          `<div class="building-output"></div>` +
        `</div>` +
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
      count: card.querySelector(".building-count"),
      output: card.querySelector(".building-output"),
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

// Updates every card: counts, output, costs and button states.
function updateBuildingPanel() {
  for (const typeId in BUILDING_TYPES) {
    const type = BUILDING_TYPES[typeId];
    const owned = state.buildings[typeId];
    const el = buildingCardElements[typeId];
    const resourceName = RESOURCES.find(r => r.id === type.produces).name;

    el.card.classList.toggle("not-owned", owned.count === 0);
    el.count.textContent = owned.count > 0 ? `×${owned.count} · Lv ${owned.level}` : "";
    el.output.textContent = owned.count > 0
      ? `Producing +${formatPerMinute(getBuildingRatePerSecond(typeId) * 60)} ${resourceName}`
      : `Not built yet · makes ${formatPerMinute(type.baseRatePerMinute)} ${resourceName}`;

    // Build button
    const buildCost = getBuildCost(typeId);
    el.buildGain.textContent = `+${formatPerMinute(getBuildGainPerSecond(typeId) * 60)}`;
    showCost(el.buildCost, buildCost);
    el.buildBtn.disabled = !canAfford(buildCost);

    // Upgrade button (only possible once you own one)
    const upgradeCost = getUpgradeCost(typeId);
    if (owned.count > 0) {
      el.upgradeLabel.textContent = "Upgrade";
      el.upgradeGain.textContent = `+${formatPerMinute(getUpgradeGainPerSecond(typeId) * 60)}`;
      el.upgradeBtn.disabled = !canAfford(upgradeCost);
    } else {
      el.upgradeLabel.textContent = "Upgrade";
      el.upgradeGain.textContent = "build one first";
      el.upgradeBtn.disabled = true;
    }
    showCost(el.upgradeCost, upgradeCost);
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

// Totals shown in the welcome-back window. If the player leaves again
// before closing it, the new earnings are added on top.
let welcomeTotals = null;

function showWelcomeBack(secondsAway, secondsPaid, earned) {
  if (!welcomeTotals) welcomeTotals = { away: 0, earned: {}, capped: false };
  welcomeTotals.away += secondsAway;
  welcomeTotals.capped = welcomeTotals.capped || secondsAway > secondsPaid;
  for (const res of RESOURCES) {
    welcomeTotals.earned[res.id] = (welcomeTotals.earned[res.id] || 0) + earned[res.id];
  }

  document.getElementById("welcome-time").textContent = formatDuration(welcomeTotals.away);
  document.getElementById("welcome-cap").hidden = !welcomeTotals.capped;

  const list = document.getElementById("welcome-earnings");
  list.innerHTML = "";
  for (const res of RESOURCES) {
    const row = document.createElement("li");
    row.className = "earning-row";
    row.appendChild(createPixelIcon(res.id));
    const name = document.createElement("span");
    name.className = "earning-name";
    name.textContent = res.name;
    const amount = document.createElement("span");
    amount.className = "earning-amount";
    amount.textContent = "+" + formatNumber(welcomeTotals.earned[res.id]);
    row.append(name, amount);
    list.appendChild(row);
  }
  openModal("welcome-modal");
}

// The earnings were already added when you returned (so nothing is
// lost if the page closes); this button just closes the window.
function collectWelcomeBack() {
  welcomeTotals = null;
  closeModal("welcome-modal");
  refreshUI();
}

function setupSaveControls() {
  for (const button of document.querySelectorAll(".save-button")) {
    button.addEventListener("click", () => {
      updateGame();
      const ok = saveGame();
      updateSaveStatus();
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
   8. VILLAGE DRAWING
   -------------------------------------------------------------
   The village is painted on a small 480x270 canvas. CSS then
   scales it up with nearest-neighbor ("pixelated") scaling so
   every pixel stays sharp.

   HOW THE 3D LOOK WORKS
   We use a "3/4 view" like many classic pixel-art games:
     * Every building is a BOX. We draw its front wall (facing
       you), its right-hand side wall (darker, because the sun
       shines from the upper-left) and a pitched roof on top.
     * Shadows fall to the lower-right on the ground.
     * Objects are sorted by where they touch the ground: things
       further back are drawn first, so nearer things cover them.
     * The keep stands on a raised hill with a cliff face, and
       far-away things (mountains, forest) are bluer and darker.

   The picture only changes when you build something, so we
   paint it once and keep it until something changes. Moving
   animations arrive in Stage 4.
   ============================================================= */

const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 270;

const PAL = {
  outline: "#2b1d14",
  // Sky and distance
  sky1: "#4a8fd0", sky2: "#5a9fda", sky3: "#6cafe2", sky4: "#80bfe9", sky5: "#97cfef", sky6: "#b2ddf3",
  cloud: "#ffffff", cloudShade: "#d3e2ef",
  mountFar: "#8a9ab5", mountFarDark: "#6c7c99", snow: "#f1f5fa", snowShade: "#c6d3e3",
  hill: "#6b8a72", hillDark: "#56735d",
  forestBack: "#2e5640", forestBackLight: "#3d6a50",
  forestFront: "#2a5a33", forestFrontLight: "#3c7444",
  // Ground
  grass: "#5d9640", grassHigh: "#67a446", grassDark: "#4d8236", grassLight: "#72ab4e", grassDeep: "#3d6b2b", grassFar: "#548b3e",
  flowerY: "#f2d04e", flowerW: "#f6ead0", flowerR: "#d8604a", flowerP: "#b688dc",
  dirt: "#a07a4a", dirtDark: "#7f5d36", dirtLight: "#b98f58",
  cobble: "#a29c8e", cobbleLight: "#bdb7a8", cobbleDark: "#8a8478", cobbleGap: "#615c52", curb: "#4a463e",
  water: "#3f86c0", waterLight: "#8cc6ec", waterDark: "#2d6597", bank: "#6b5a3a",
  cliff: "#8a6b4a", cliffDark: "#6b5036", cliffLight: "#a5845e", cliffDeep: "#4a3626",
  // Buildings
  plaster: "#ebdfc4", plasterShade: "#c7b592", plasterDeep: "#a8977a",
  timber: "#4f3220",
  wood: "#8a5a32", woodDark: "#5f3d22", woodLight: "#a87443", woodDeep: "#46301c",
  stone: "#a6a296", stoneDark: "#7a766c", stoneLight: "#c8c4b7", stoneDeep: "#57544c",
  roofRed: "#a8482e", roofRedDark: "#7a311f", roofRedLight: "#c9623f",
  thatch: "#d2a64a", thatchDark: "#9f7a2c", thatchLight: "#ecc76b",
  slate: "#3f7d6e", slateDark: "#2b5a4f", slateLight: "#5ea592",
  blueRoof: "#4a5f86", blueRoofDark: "#34445f", blueRoofLight: "#6a80a8",
  barn: "#b23c2a", barnDark: "#80271a", barnDeep: "#5e1b12",
  glass: "#f2d48a", door: "#4a2f1d",
  banner: "#3a5fa8", bannerDark: "#26407a", gold: "#f2c14e", goldDark: "#b8862b",
  metal: "#c4c4cc", metalDark: "#7a7a84",
  cloth: "#efe6d2", red: "#c8442f", blue: "#3a6fb5", green: "#4f9a4a", yellow: "#e8b83a", purple: "#8a5aa8",
  // Nature
  leaf: "#4a8a3a", leafDark: "#336a2b", leafDeep: "#24501f", leafLight: "#6aaa4a", leafBright: "#93cd62",
  pine: "#2f6a42", pineDark: "#1f4d30", pineLight: "#4a8a56",
  trunk: "#5c3a21", trunkDark: "#3f2716",
  soil: "#6b4a2a", soilDark: "#4f351d", soilLight: "#86603a",
  wheat: "#d9a441", wheatLight: "#f0cf6a", crop: "#5fa04a", cropDark: "#3f7a34",
  pumpkin: "#e07a2a", cabbage: "#9ad372",
  logEnd: "#e0b77a", logRing: "#b98a4e",
};

// Semi-transparent so it darkens whatever ground is underneath.
const SHADOW = "rgba(16, 32, 8, 0.33)";

// Where things go. (x, y) is usually the bottom-left corner of the
// front wall, where it meets the ground. Change numbers to move things.
const VILLAGE_LAYOUT = {
  townHall:     { x: 214, y: 108 },
  barn:         { x: 14,  y: 236 },
  farmFields:   [{ x: 66, y: 198 }, { x: 126, y: 198 }, { x: 66, y: 234 }, { x: 126, y: 234 }],
  lumberMill:   { x: 366, y: 228 },
  quarry:       { x: 350, y: 128 },
  marketStalls: [{ x: 192, y: 178 }, { x: 272, y: 178 }, { x: 194, y: 206 }, { x: 270, y: 206 }],
  huts:         [{ x: 128, y: 154 }, { x: 324, y: 158 }, { x: 184, y: 256 }],
  well:         { x: 238, y: 192 },
};

// Crops grown in each farm field (one field appears per farm, up to 4).
const FIELD_CROPS = ["wheat", "cabbage", "pumpkin", "wheat"];

// The raised hill the keep stands on.
const PLATEAU_TOP = [[172, 82], [306, 80], [326, 92], [320, 116], [176, 118], [162, 100]];
const PLATEAU_FRONT = [[162, 100], [176, 118], [320, 116], [326, 92]]; // edges facing you
const CLIFF_HEIGHT = 18;

// Cobblestone roads (each is a polygon: a list of [x, y] corners).
const ROADS = [
  [[234, 102], [254, 102], [254, 118], [234, 118]],                          // in front of the keep
  [[234, 134], [254, 134], [254, 152], [234, 152]],                          // below the stairs
  [[200, 150], [288, 150], [310, 164], [310, 196], [288, 212], [200, 212], [178, 196], [178, 164]], // plaza
  [[234, 210], [254, 210], [258, 270], [230, 270]],                          // south road
  [[30, 170], [180, 168], [180, 190], [30, 192]],                            // west road
  [[308, 168], [432, 170], [432, 190], [308, 190]],                          // east road
];

// Trees, bushes and props: [kind, x, y, size]
const SCENERY = [
  // West grove
  ["tree", 16, 100, 8], ["pine", 36, 114, 8], ["tree", 60, 96, 9], ["tree", 24, 140, 9],
  ["pine", 82, 108, 7], ["tree", 54, 134, 8], ["bush", 94, 130, 4], ["tree", 150, 108, 7],
  ["pine", 6, 164, 7], ["bush", 140, 124, 3],
  // Behind the hill
  ["pine", 158, 88, 7], ["tree", 338, 98, 8],
  // East forest beside the quarry and the lumber mill
  ["pine", 458, 102, 8], ["tree", 472, 126, 9], ["pine", 450, 150, 8], ["tree", 468, 172, 9],
  ["pine", 458, 204, 8], ["tree", 474, 230, 9], ["pine", 446, 256, 8], ["tree", 468, 268, 9],
  // South-east meadow
  ["tree", 302, 246, 9], ["pine", 328, 266, 7], ["bush", 286, 228, 4], ["tree", 352, 260, 8],
  // South-west corner
  ["bush", 8, 252, 4], ["tree", 12, 270, 8], ["bush", 214, 240, 3],
  // Plaza props
  ["lamp", 186, 160], ["lamp", 302, 160], ["lamp", 186, 210], ["lamp", 302, 210],
  ["barrel", 216, 186], ["barrel", 220, 188], ["crate", 296, 190], ["crate", 262, 160],
];

let villageCanvas, villageCtx;
let backdropCanvas;          // sky, hills, river, roads: painted once
let villageNeedsRedraw = true;

// Call this whenever something visible changes (e.g. a new building).
function markVillageDirty() {
  villageNeedsRedraw = true;
}


// ---------- Basic drawing tools ----------

// Fill a rectangle. Coordinates are rounded so pixels stay crisp.
function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Fill any polygon one pixel-row at a time. This gives hard pixel
// edges instead of the blurry anti-aliased edges of ctx.fill().
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

// Fill an oval, row by row (crisp pixel edges).
function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  const rows = Math.max(1, Math.round(ry));
  for (let dy = -rows; dy < rows; dy++) {
    const t = (dy + 0.5) / rows;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    if (half > 0) ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, 1);
  }
}

// Is the point (px, py) inside the polygon?
function pointInPoly(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A tiny "random" number generator that always gives the same sequence
// for the same seed, so the village looks the same every time.
function makeRandom(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}


// ---------- 3D building blocks ----------

// How far "back" an object reaches on screen. Depth goes up and to the
// right at 45 degrees, at half scale (depth 12 -> 6 px right, 6 px up).
function depthOffset(d) {
  return Math.round(d / 2);
}

// Shadow on the ground, falling to the lower-right of a box.
function drawGroundShadow(ctx, x, y, w, d) {
  const k = depthOffset(d);
  fillPoly(ctx, [
    [x + 1, y], [x + w, y], [x + w + k, y - k], [x + w + k + 8, y - k + 3],
    [x + w + 8, y + 4], [x + 3, y + 4],
  ], SHADOW);
}

// A plain box: front face, right side face and top face.
// (x, y) = bottom-left corner of the front face, on the ground.
function drawBox(ctx, x, y, w, h, d, front, side, top) {
  const k = depthOffset(d);
  fillPoly(ctx, [[x + w, y], [x + w + k, y - k], [x + w + k, y - h - k], [x + w, y - h]], side);
  fillPoly(ctx, [[x, y - h], [x + w, y - h], [x + w + k, y - h - k], [x + k, y - h - k]], top);
  rect(ctx, x, y - h, w, h, front);
}

// A building: box walls plus a pitched roof whose ridge runs left-right.
//   o.w, o.h, o.d   width, wall height, depth
//   o.roofH         how tall the roof is
//   o.wall / o.wallShade / o.side / o.sideDark   wall colors
//   o.roof / o.roofDark / o.roofLight / o.roofStyle   roof look
//   o.front(ctx, x, top, w, h)   draws doors/windows on the front wall
//   o.chimney       true to add a stone chimney
function drawBuildingBox(ctx, x, y, o) {
  const w = o.w;
  const top = y - o.h;                       // top edge of the front wall
  const k = depthOffset(o.d);
  const half = Math.round(k / 2);            // the ridge sits halfway back
  const ridgeY = top - o.roofH - half;
  const eaveY = top + 2;                     // roof overhangs the wall a bit

  drawGroundShadow(ctx, x, y, w, o.d);

  // Walls
  fillPoly(ctx, [[x + w, y], [x + w + k, y - k], [x + w + k, top - k], [x + w, top]], o.side);
  rect(ctx, x, top, w, o.h, o.wall);
  if (o.front) o.front(ctx, x, top, w, o.h);
  rect(ctx, x, eaveY, w, 1, o.wallShade);    // shadow under the roof edge
  rect(ctx, x, y - 1, w, 1, o.wallShade);    // dark line where wall meets ground

  // Roof: back slope (its edge peeks out on the right), side gable, front slope
  fillPoly(ctx, [[x - 1 + half, ridgeY], [x + w + 1 + half, ridgeY], [x + w + 1 + k, top - k + 1], [x - 1 + k, top - k + 1]], o.roofDark);
  fillPoly(ctx, [[x + w, top + 1], [x + w + k, top - k + 1], [x + w + half, ridgeY + 1]], o.sideDark);
  fillPoly(ctx, [[x - 2, eaveY], [x + w + 2, eaveY], [x + w + 1 + half, ridgeY], [x - 1 + half, ridgeY]], o.roof);
  paintRoofTexture(ctx, o, x, w, eaveY, ridgeY, half);

  if (o.chimney) {
    const cx = x + Math.round(w * 0.68) + half;
    drawBox(ctx, cx, ridgeY + 5, 4, 10, 4, PAL.stone, PAL.stoneDark, PAL.stoneLight);
    rect(ctx, cx, ridgeY - 5, 6, 1, PAL.stoneDeep);
  }
}

// Shingle lines or thatch straw on the front roof slope.
function paintRoofTexture(ctx, o, x, w, eaveY, ridgeY, half) {
  const height = eaveY - ridgeY;
  for (let yy = ridgeY; yy < eaveY; yy++) {
    const t = (eaveY - yy) / height;                    // 0 at the eave, 1 at the ridge
    const left = Math.round(x - 2 + t * (half + 1));
    const right = Math.round(x + w + 2 + t * (half - 1));
    const row = eaveY - yy;
    rect(ctx, left, yy, 1, 1, o.roofLight);             // sunlit left edge
    if (o.roofStyle === "thatch") {
      for (let xx = left + 1 + (row % 3); xx < right - 1; xx += 3) {
        rect(ctx, xx, yy, 1, 1, row % 2 ? o.roofDark : o.roofLight);
      }
    } else if (row % 3 === 0) {
      rect(ctx, left + 1, yy, right - left - 1, 1, o.roofDark);
    } else if (row % 3 === 1) {
      const offset = (Math.floor(row / 3) % 2) * 2;
      for (let xx = left + 2 + offset; xx < right - 1; xx += 4) rect(ctx, xx, yy, 1, 1, o.roofDark);
    }
  }
  rect(ctx, x - 1 + half, ridgeY, w + 2, 1, o.roofLight);   // ridge highlight
  rect(ctx, x - 2, eaveY - 1, w + 4, 1, o.roofDark);        // thick eave edge
}

// Stone brick pattern.
function paintBricks(ctx, x, y, w, h, base, dark, light) {
  rect(ctx, x, y, w, h, base);
  for (let row = 0; row * 3 < h; row++) {
    const yy = y + row * 3;
    rect(ctx, x, yy + 2, w, 1, dark);
    for (let xx = x + (row % 2) * 3; xx < x + w; xx += 6) {
      rect(ctx, xx, yy, 1, 2, dark);
      rect(ctx, xx + 1, yy, 2, 1, light);
    }
  }
}

// Dark wooden beams on a plaster wall (Tudor style).
function paintTimberFrame(ctx, x, top, w, h) {
  rect(ctx, x, top, 1, h, PAL.timber);
  rect(ctx, x + w - 1, top, 1, h, PAL.timber);
  rect(ctx, x, top + Math.floor(h / 2), w, 1, PAL.timber);
  rect(ctx, x, top + h - 2, w, 1, PAL.timber);
  for (let xx = x + 7; xx < x + w - 3; xx += 7) rect(ctx, xx, top, 1, h, PAL.timber);
}

function drawDoor(ctx, x, bottom, w, h) {
  rect(ctx, x - 1, bottom - h - 1, w + 2, h + 1, PAL.timber);
  rect(ctx, x, bottom - h, w, h, PAL.door);
  for (let xx = x + 2; xx < x + w; xx += 2) rect(ctx, xx, bottom - h, 1, h, PAL.woodDeep);
  rect(ctx, x + w - 2, bottom - Math.round(h / 2), 1, 1, PAL.gold);
  rect(ctx, x - 1, bottom, w + 2, 1, PAL.stone);          // doorstep
}

function drawWindow(ctx, x, y, w, h) {
  rect(ctx, x - 1, y - 1, w + 2, h + 2, PAL.timber);
  rect(ctx, x, y, w, h, PAL.glass);
  rect(ctx, x + Math.floor(w / 2), y, 1, h, PAL.timber);
  rect(ctx, x, y + Math.floor(h / 2), w, 1, PAL.timber);
  rect(ctx, x - 1, y + h + 1, w + 2, 1, PAL.woodLight);   // sill
}


// ---------- Backdrop (painted once) ----------

function paintBackdrop() {
  backdropCanvas = document.createElement("canvas");
  backdropCanvas.width = VIEW_WIDTH;
  backdropCanvas.height = VIEW_HEIGHT;
  const g = backdropCanvas.getContext("2d");
  const random = makeRandom(42);

  paintSky(g);
  paintMountains(g);
  paintGrass(g, random);
  paintForest(g, random);
  paintRiver(g, random);
  paintDirtPaths(g);
  paintPlateau(g, random);
  for (const road of ROADS) paintCobbles(g, road, random);
  paintStairs(g);
}

function paintSky(g) {
  // Flat color bands with a checkerboard "dither" between them:
  // the pixel-art way to make a smooth-looking sky without gradients.
  const bands = [PAL.sky1, PAL.sky2, PAL.sky3, PAL.sky4, PAL.sky5, PAL.sky6];
  const bandHeight = 10;
  bands.forEach((color, i) => rect(g, 0, i * bandHeight, VIEW_WIDTH, bandHeight, color));
  for (let i = 1; i < bands.length; i++) {
    const y = i * bandHeight - 1;
    for (let x = 0; x < VIEW_WIDTH; x += 2) rect(g, x + (i % 2), y, 1, 1, bands[i]);
    for (let x = 1; x < VIEW_WIDTH; x += 2) rect(g, x - (i % 2), y + 1, 1, 1, bands[i - 1]);
  }
  drawCloud(g, 50, 14, 10);
  drawCloud(g, 168, 8, 7);
  drawCloud(g, 342, 15, 12);
  drawCloud(g, 444, 7, 7);
}

function drawCloud(g, x, y, s) {
  fillEllipse(g, x + s * 0.5, y + 2, s * 1.9, s * 0.45, PAL.cloudShade);
  fillEllipse(g, x - s * 0.5, y, s * 0.9, s * 0.55, PAL.cloud);
  fillEllipse(g, x + s * 0.4, y - s * 0.35, s, s * 0.75, PAL.cloud);
  fillEllipse(g, x + s * 1.4, y, s * 0.8, s * 0.5, PAL.cloud);
  rect(g, x - s * 1.2, y + 1, s * 3.2, 1, PAL.cloudShade);
}

function paintMountains(g) {
  const baseY = 60;
  // [peak x, peak y, half width]
  const peaks = [[28, 26, 42], [96, 34, 36], [156, 20, 48], [232, 30, 40], [304, 18, 52], [384, 28, 44], [452, 22, 46]];
  for (const [px, py, hw] of peaks) {
    fillPoly(g, [[px - hw, baseY], [px, py], [px, baseY]], PAL.mountFar);        // sunny side
    fillPoly(g, [[px, py], [px + hw, baseY], [px, baseY]], PAL.mountFarDark);    // shady side
    if (py < 30) {                                                                // snow cap
      const s = 8;
      fillPoly(g, [[px - s, py + s], [px, py], [px, py + s + 1]], PAL.snow);
      fillPoly(g, [[px, py], [px + s, py + s], [px + 3, py + s - 2], [px, py + s + 1]], PAL.snowShade);
      rect(g, px - s + 2, py + s, 3, 1, PAL.snow);
    }
  }
  // Rolling foothills in front of the mountains
  for (let x = -20; x < VIEW_WIDTH + 40; x += 46) {
    fillEllipse(g, x, 60, 34, 12, PAL.hillDark);
    fillEllipse(g, x - 4, 60, 28, 10, PAL.hill);
  }
}

function paintGrass(g, random) {
  rect(g, 0, 56, VIEW_WIDTH, VIEW_HEIGHT - 56, PAL.grass);
  rect(g, 0, 56, VIEW_WIDTH, 40, PAL.grassFar);           // far-away grass is a bit duller
  for (let x = 0; x < VIEW_WIDTH; x += 2) rect(g, x, 96, 1, 1, PAL.grassFar);

  for (let i = 0; i < 140; i++) {                         // light and dark patches
    const x = Math.floor(random() * VIEW_WIDTH);
    const y = 60 + Math.floor(random() * (VIEW_HEIGHT - 60));
    rect(g, x, y, 4 + Math.floor(random() * 14), 2, random() < 0.5 ? PAL.grassDark : PAL.grassLight);
  }
  for (let i = 0; i < 520; i++) {                         // grass tufts
    const x = Math.floor(random() * VIEW_WIDTH);
    const y = 60 + Math.floor(random() * (VIEW_HEIGHT - 60));
    rect(g, x, y, 1, 1, PAL.grassDeep);
    rect(g, x + 2, y, 1, 1, PAL.grassDeep);
    rect(g, x + 1, y + 1, 1, 1, PAL.grassDeep);
    rect(g, x + 1, y - 1, 1, 1, PAL.grassLight);
  }
  const flowers = [PAL.flowerY, PAL.flowerW, PAL.flowerR, PAL.flowerP];
  for (let i = 0; i < 40; i++) {                          // little flower clusters
    const x = Math.floor(random() * VIEW_WIDTH);
    const y = 90 + Math.floor(random() * (VIEW_HEIGHT - 90));
    const color = flowers[Math.floor(random() * flowers.length)];
    for (let j = 0; j < 4; j++) rect(g, x + Math.floor(random() * 6), y + Math.floor(random() * 4), 1, 1, color);
  }
}

function paintForest(g, random) {
  // A thick band of treetops between the hills and the river.
  rect(g, 0, 56, VIEW_WIDTH, 10, PAL.forestBack);
  for (let x = -4; x < VIEW_WIDTH + 6; x += 5) {
    const y = 52 + Math.floor(random() * 4);
    const r = 5 + Math.floor(random() * 3);
    fillEllipse(g, x, y, r, r - 1, PAL.forestBack);
    fillEllipse(g, x - 1, y - 1, r - 2, r - 3, PAL.forestBackLight);
  }
  for (let x = -2; x < VIEW_WIDTH + 6; x += 6) {
    const y = 60 + Math.floor(random() * 3);
    const r = 5 + Math.floor(random() * 2);
    fillEllipse(g, x, y, r, r - 1, PAL.forestFront);
    fillEllipse(g, x - 1, y - 2, r - 2, r - 3, PAL.forestFrontLight);
    rect(g, x - 2, y - 4, 2, 1, PAL.leafLight);
  }
}

// The river's middle line wiggles gently across the map.
function riverCenterY(x) {
  return 72 + Math.round(Math.sin(x / 45) * 3);
}

function paintRiver(g, random) {
  for (let x = 0; x < VIEW_WIDTH; x++) {
    const c = riverCenterY(x);
    rect(g, x, c - 7, 1, 2, PAL.bank);
    rect(g, x, c - 5, 1, 10, PAL.water);
    rect(g, x, c - 5, 1, 2, PAL.waterDark);
    rect(g, x, c + 5, 1, 2, PAL.bank);
    rect(g, x, c + 7, 1, 1, PAL.grassDeep);
  }
  for (let i = 0; i < 40; i++) {                          // sparkles on the water
    const x = Math.floor(random() * VIEW_WIDTH);
    rect(g, x, riverCenterY(x) - 2 + Math.floor(random() * 5), 3 + Math.floor(random() * 4), 1, PAL.waterLight);
  }
  // Wooden footbridge
  const bx = 113;
  const c = riverCenterY(bx);
  rect(g, bx, c - 9, 12, 18, PAL.wood);
  for (let y = c - 9; y < c + 9; y += 2) rect(g, bx, y, 12, 1, PAL.woodDark);
  rect(g, bx - 1, c - 10, 1, 20, PAL.timber);
  rect(g, bx + 12, c - 10, 2, 20, PAL.woodDeep);
  for (let y = c - 10; y < c + 10; y += 5) {
    rect(g, bx - 1, y, 2, 2, PAL.woodLight);
    rect(g, bx + 12, y, 2, 2, PAL.woodDark);
  }
}

function paintDirtPaths(g) {
  const paths = [
    [[114, 80], [123, 80], [124, 170], [112, 170]],   // from the bridge down to the road
    [[26, 190], [40, 190], [42, 238], [28, 238]],     // to the barn
  ];
  for (const p of paths) {
    fillPoly(g, p.map(([x, y]) => [x + 1, y + 1]), PAL.dirtDark);
    fillPoly(g, p, PAL.dirt);
  }
}

// Top edge of the cliff at a given x (follows PLATEAU_FRONT).
function cliffTopY(x) {
  for (let i = 0; i < PLATEAU_FRONT.length - 1; i++) {
    const [x1, y1] = PLATEAU_FRONT[i];
    const [x2, y2] = PLATEAU_FRONT[i + 1];
    if (x >= x1 && x <= x2) return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
  }
  return null;
}

function paintPlateau(g, random) {
  const H = CLIFF_HEIGHT;
  // Shadow at the foot of the cliff
  fillPoly(g, [[164, 100 + H], [178, 118 + H + 3], [322, 116 + H + 3], [332, 92 + H + 4], [326, 92 + H]], SHADOW);

  // Cliff faces (left facet in light, front in mid-tone, right facet in shade)
  const faceColors = [PAL.cliffLight, PAL.cliff, PAL.cliffDark];
  for (let i = 0; i < PLATEAU_FRONT.length - 1; i++) {
    const a = PLATEAU_FRONT[i];
    const b = PLATEAU_FRONT[i + 1];
    fillPoly(g, [a, b, [b[0], b[1] + H], [a[0], a[1] + H]], faceColors[i]);
  }
  // Rock layers: horizontal ledges with sunlit tops, a few cracks
  for (let x = 163; x < 326; x++) {
    const top = Math.round(cliffTopY(x));
    for (const layer of [6, 12]) {
      const wobble = Math.round(Math.sin(x / 7 + layer) * 1.2);
      rect(g, x, top + layer + wobble, 1, 1, PAL.cliffDeep);
      rect(g, x, top + layer + wobble + 1, 1, 1, PAL.cliffLight);
    }
    if (random() < 0.08) rect(g, x, top + 3 + Math.floor(random() * 10), 1, 3, PAL.cliffDeep);
    rect(g, x, top + H - 2, 1, 2, PAL.cliffDeep);
  }

  // Grassy top of the hill (a little brighter: it's higher up, in the sun)
  fillPoly(g, PLATEAU_TOP, PAL.grassHigh);
  for (let i = 0; i < 160; i++) {
    const x = 162 + Math.floor(random() * 166);
    const y = 80 + Math.floor(random() * 38);
    if (!pointInPoly(x, y, PLATEAU_TOP)) continue;
    rect(g, x, y, 1, 1, random() < 0.5 ? PAL.grassDeep : PAL.grassLight);
  }
  // Grass hanging over the cliff edge
  for (let x = 163; x < 326; x++) {
    const top = Math.round(cliffTopY(x));
    rect(g, x, top - 1, 1, 2, PAL.grassDark);
    if (x % 3 === 0) rect(g, x, top + 1, 1, 1 + (x % 2), PAL.grassDeep);
  }
}

// Cobblestones: dark mortar first, then rows of little stones on top.
function paintCobbles(g, poly, random) {
  fillPoly(g, poly.map(([x, y]) => [x + 1, y + 2]), PAL.curb);   // curb edge for depth
  fillPoly(g, poly, PAL.cobbleGap);
  const xs = poly.map(p => p[0]);
  const ys = poly.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  for (let y = minY; y < maxY; y += 3) {
    const offset = (Math.floor(y / 3) % 2) * 2;
    for (let x = minX + offset; x < maxX; x += 4) {
      if (!pointInPoly(x + 1.5, y + 1, poly) || !pointInPoly(x + 2.5, y + 1.5, poly)) continue;
      const r = random();
      rect(g, x, y, 3, 2, r < 0.3 ? PAL.cobbleDark : r < 0.8 ? PAL.cobble : PAL.cobbleLight);
      rect(g, x, y, 2, 1, PAL.cobbleLight);
    }
  }
}

// Stone stairs cut into the cliff, leading up to the keep.
function paintStairs(g) {
  const x = 234, w = 20;
  const top = Math.round(cliffTopY(x + 10));
  for (let y = top; y < top + CLIFF_HEIGHT; y += 2) {
    rect(g, x, y, w, 1, PAL.stoneLight);
    rect(g, x, y + 1, w, 1, PAL.stoneDark);
  }
  rect(g, x - 2, top - 1, 2, CLIFF_HEIGHT + 1, PAL.stone);
  rect(g, x + w, top - 1, 2, CLIFF_HEIGHT + 1, PAL.stoneDeep);
}


// ---------- Buildings ----------

// A round stone tower with a pointed roof and a flag.
function drawTower(ctx, x, y, w, h, d, coneH) {
  const k = depthOffset(d);
  const top = y - h;
  drawGroundShadow(ctx, x, y, w, d);
  fillPoly(ctx, [[x + w, y], [x + w + k, y - k], [x + w + k, top - k], [x + w, top]], PAL.stoneDeep);
  paintBricks(ctx, x, top, w, h, PAL.stone, PAL.stoneDark, PAL.stoneLight);
  rect(ctx, x, top, 2, h, PAL.stoneLight);                       // rounded, sunlit edge
  rect(ctx, x + w - 2, top, 2, h, PAL.stoneDark);
  for (let yy = top + 8; yy < y - 10; yy += 12) {               // arrow slits
    rect(ctx, x + Math.floor(w / 2) - 1, yy, 2, 5, PAL.outline);
  }
  // Battlements
  rect(ctx, x - 1, top - 2, w + 2, 3, PAL.stoneLight);
  for (let xx = x - 1; xx < x + w; xx += 4) rect(ctx, xx, top - 4, 2, 2, PAL.stoneLight);
  // Pointed roof: left half sunlit, right half in shade
  const cx = x + Math.round(w / 2) + Math.round(k / 2);
  const apexY = top - coneH;
  fillPoly(ctx, [[x - 2, top - 1], [cx, apexY], [cx, top + 1]], PAL.slateLight);
  fillPoly(ctx, [[cx, apexY], [x + w + k + 2, top - k], [x + w + 2, top], [cx, top + 1]], PAL.slateDark);
  for (let yy = apexY + 4; yy < top; yy += 3) {
    const spread = Math.round(((yy - apexY) / (top - apexY)) * (w / 2 + 1));
    rect(ctx, cx - spread, yy, spread, 1, PAL.slate);
  }
  // Flag
  rect(ctx, cx, apexY - 9, 1, 9, PAL.outline);
  rect(ctx, cx + 1, apexY - 9, 7, 4, PAL.banner);
  rect(ctx, cx + 1, apexY - 5, 4, 1, PAL.bannerDark);
  rect(ctx, cx + 3, apexY - 8, 2, 2, PAL.gold);
}

// The keep: a stone hall with three towers.
function drawTownHall(ctx, x, y) {
  drawTower(ctx, x + 22, y - 12, 14, 56, 8, 22);                 // tall tower at the back
  drawBuildingBox(ctx, x, y, {
    w: 58, h: 24, d: 14, roofH: 12,
    wall: PAL.stone, wallShade: PAL.stoneDark, side: PAL.stoneDark, sideDark: PAL.stoneDeep,
    roof: PAL.slate, roofDark: PAL.slateDark, roofLight: PAL.slateLight, roofStyle: "shingle",
    front(ctx, x, top, w, h) {
      paintBricks(ctx, x, top, w, h, PAL.stone, PAL.stoneDark, PAL.stoneLight);
      // Arched gate
      const gx = x + Math.round(w / 2) - 5;
      rect(ctx, gx - 1, top + 8, 12, h - 8, PAL.stoneDeep);
      rect(ctx, gx + 1, top + 7, 8, 1, PAL.stoneDeep);
      rect(ctx, gx, top + 9, 10, h - 9, PAL.door);
      rect(ctx, gx + 1, top + 8, 8, 1, PAL.door);
      rect(ctx, gx + 5, top + 9, 1, h - 9, PAL.outline);
      for (let yy = top + 11; yy < top + h; yy += 3) rect(ctx, gx, yy, 10, 1, PAL.woodDeep);
      // Tall windows
      for (const wx of [x + 4, x + w - 8]) {
        rect(ctx, wx, top + 8, 4, 8, PAL.outline);
        rect(ctx, wx + 1, top + 9, 2, 6, PAL.glass);
        rect(ctx, wx + 1, top + 12, 2, 1, PAL.outline);
      }
      // Royal banners
      for (const bx of [x + 13, x + w - 18]) {
        rect(ctx, bx - 1, top + 4, 7, 1, PAL.woodDeep);
        rect(ctx, bx, top + 5, 5, 11, PAL.banner);
        rect(ctx, bx + 4, top + 5, 1, 11, PAL.bannerDark);
        rect(ctx, bx, top + 16, 2, 1, PAL.banner);
        rect(ctx, bx + 3, top + 16, 2, 1, PAL.bannerDark);
        rect(ctx, bx + 1, top + 8, 3, 3, PAL.gold);
        rect(ctx, bx + 2, top + 9, 1, 1, PAL.goldDark);
      }
    },
  });
  drawTower(ctx, x - 12, y + 4, 14, 38, 8, 18);                  // front-left tower
  drawTower(ctx, x + 56, y + 4, 14, 42, 8, 20);                  // front-right tower
}

// A timber-framed cottage. `variant` changes the roof.
function drawHut(ctx, x, y, variant) {
  const roofs = [
    { roof: PAL.thatch, roofDark: PAL.thatchDark, roofLight: PAL.thatchLight, roofStyle: "thatch" },
    { roof: PAL.roofRed, roofDark: PAL.roofRedDark, roofLight: PAL.roofRedLight, roofStyle: "shingle" },
    { roof: PAL.blueRoof, roofDark: PAL.blueRoofDark, roofLight: PAL.blueRoofLight, roofStyle: "shingle" },
  ];
  drawBuildingBox(ctx, x, y, {
    w: 24, h: 15, d: 12, roofH: 10,
    wall: PAL.plaster, wallShade: PAL.plasterShade, side: PAL.plasterShade, sideDark: PAL.plasterDeep,
    ...roofs[variant % roofs.length],
    chimney: true,
    front(ctx, x, top, w, h) {
      paintTimberFrame(ctx, x, top, w, h);
      drawDoor(ctx, x + 14, top + h, 5, 9);
      drawWindow(ctx, x + 3, top + 5, 6, 4);
      rect(ctx, x + 3, top + 11, 6, 1, PAL.flowerR);              // flower box
      rect(ctx, x + 4, top + 10, 1, 1, PAL.flowerY);
      rect(ctx, x + 7, top + 10, 1, 1, PAL.flowerP);
    },
  });
}

// Red barn with a white-crossed door and hay bales.
function drawBarn(ctx, x, y) {
  drawBuildingBox(ctx, x, y, {
    w: 40, h: 18, d: 14, roofH: 12,
    wall: PAL.barn, wallShade: PAL.barnDark, side: PAL.barnDark, sideDark: PAL.barnDeep,
    roof: PAL.wood, roofDark: PAL.woodDark, roofLight: PAL.woodLight, roofStyle: "shingle",
    front(ctx, x, top, w, h) {
      for (let px = x + 3; px < x + w; px += 4) rect(ctx, px, top, 1, h, PAL.barnDark);
      rect(ctx, x, top, 1, h, PAL.cloth);
      rect(ctx, x + w - 1, top, 1, h, PAL.cloth);
      const dx = x + 13, dy = top + 5, dw = 14, dh = h - 5;
      rect(ctx, dx - 1, dy - 1, dw + 2, dh + 1, PAL.cloth);
      rect(ctx, dx, dy, dw, dh, PAL.barnDeep);
      for (let i = 0; i < dh; i++) {
        const step = Math.round((i * (dw - 1)) / (dh - 1));
        rect(ctx, dx + step, dy + i, 1, 1, PAL.cloth);
        rect(ctx, dx + dw - 1 - step, dy + i, 1, 1, PAL.cloth);
      }
      drawWindow(ctx, x + 3, top + 4, 5, 4);
      drawWindow(ctx, x + w - 8, top + 4, 5, 4);
    },
  });
  drawBox(ctx, x + 44, y + 2, 8, 5, 6, PAL.thatch, PAL.thatchDark, PAL.thatchLight);   // hay bales
  drawBox(ctx, x + 46, y - 3, 8, 5, 6, PAL.thatch, PAL.thatchDark, PAL.thatchLight);
}

// A fenced field with rows of crops.
function drawField(ctx, x, y, crop) {
  const w = 50, h = 26;
  rect(ctx, x, y, w, h, PAL.soil);
  rect(ctx, x, y + h, w, 2, PAL.soilDark);                       // front edge of the raised bed
  for (let ry = y + 3; ry < y + h - 1; ry += 5) {
    rect(ctx, x + 1, ry + 2, w - 2, 1, PAL.soilDark);            // furrow
    rect(ctx, x + 1, ry - 1, w - 2, 1, PAL.soilLight);
    for (let px = x + 2; px < x + w - 2; px += 3) drawCrop(ctx, px, ry, crop);
  }
  // Fence: back rail, side rails, then the front rail and posts
  rect(ctx, x - 2, y - 3, w + 4, 1, PAL.woodLight);
  rect(ctx, x - 2, y - 3, 1, h + 6, PAL.woodLight);
  rect(ctx, x + w + 1, y - 3, 1, h + 6, PAL.woodDark);
  for (let px = x - 2; px <= x + w + 1; px += 6) rect(ctx, px, y - 5, 1, 3, PAL.timber);
  rect(ctx, x - 2, y + h + 2, w + 4, 1, PAL.woodLight);
  rect(ctx, x - 2, y + h + 3, w + 4, 1, PAL.woodDark);
  for (let px = x - 2; px <= x + w + 1; px += 6) {
    rect(ctx, px, y + h, 1, 5, PAL.timber);
    rect(ctx, px, y + h, 1, 1, PAL.woodLight);
  }
}

function drawCrop(ctx, x, y, crop) {
  if (crop === "wheat") {
    rect(ctx, x, y - 3, 1, 4, PAL.wheat);
    rect(ctx, x, y - 3, 1, 1, PAL.wheatLight);
    rect(ctx, x + 1, y - 1, 1, 2, PAL.thatchDark);
  } else if (crop === "cabbage") {
    rect(ctx, x, y - 1, 2, 2, PAL.cabbage);
    rect(ctx, x, y - 1, 1, 1, PAL.leafBright);
    rect(ctx, x + 1, y, 1, 1, PAL.cropDark);
  } else {
    rect(ctx, x, y - 2, 1, 1, PAL.crop);
    rect(ctx, x, y - 1, 2, 2, PAL.pumpkin);
    rect(ctx, x, y - 1, 1, 1, PAL.wheatLight);
  }
}

// Lumber mill: log house, open saw shed and piles of logs.
function drawLumberMill(ctx, x, y) {
  drawBuildingBox(ctx, x, y, {
    w: 34, h: 16, d: 12, roofH: 10,
    wall: PAL.wood, wallShade: PAL.woodDark, side: PAL.woodDark, sideDark: PAL.woodDeep,
    roof: PAL.roofRed, roofDark: PAL.roofRedDark, roofLight: PAL.roofRedLight, roofStyle: "shingle",
    front(ctx, x, top, w, h) {
      for (let yy = top + 3; yy < top + h; yy += 3) {             // stacked log walls
        rect(ctx, x, yy, w, 1, PAL.woodDark);
        rect(ctx, x, yy + 1, w, 1, PAL.woodLight);
        rect(ctx, x - 1, yy, 2, 2, PAL.logEnd);
        rect(ctx, x + w - 1, yy, 2, 2, PAL.logEnd);
      }
      drawDoor(ctx, x + 15, top + h, 8, 10);
      drawWindow(ctx, x + 4, top + 6, 5, 4);
    },
  });
  // Saw shed with a round blade
  const sx = x + 44, sy = y + 4;
  drawGroundShadow(ctx, sx, sy, 18, 8);
  rect(ctx, sx, sy - 16, 1, 16, PAL.timber);
  rect(ctx, sx + 17, sy - 16, 1, 16, PAL.timber);
  drawBox(ctx, sx + 1, sy, 16, 5, 8, PAL.wood, PAL.woodDark, PAL.woodLight);
  fillEllipse(ctx, sx + 9, sy - 8, 4, 4, PAL.metalDark);
  fillEllipse(ctx, sx + 9, sy - 8, 3, 3, PAL.metal);
  rect(ctx, sx + 8, sy - 9, 2, 2, PAL.outline);
  rect(ctx, sx + 2, sy - 7, 5, 2, PAL.woodLight);                // plank being cut
  drawBox(ctx, sx - 2, sy - 16, 22, 2, 10, PAL.roofRedDark, PAL.roofRedDark, PAL.roofRed);
  drawLogPile(ctx, x + 2, y + 16);
  drawLogPile(ctx, sx + 22, sy + 2);
  for (const [ox, oy] of [[40, 22], [70, 12]]) {                 // tree stumps
    drawBox(ctx, x + ox, y + oy, 5, 3, 4, PAL.wood, PAL.woodDark, PAL.logEnd);
  }
}

function drawLogPile(ctx, x, y) {
  const logs = [[0, 0], [6, 0], [12, 0], [3, -5], [9, -5], [6, -10]];
  for (const [ox, oy] of logs) {
    drawBox(ctx, x + ox, y + oy, 6, 5, 10, PAL.wood, PAL.woodDark, PAL.woodLight);
    rect(ctx, x + ox, y + oy - 5, 6, 5, PAL.logEnd);
    rect(ctx, x + ox, y + oy - 5, 1, 1, PAL.woodDark);
    rect(ctx, x + ox + 5, y + oy - 1, 1, 1, PAL.woodDark);
    rect(ctx, x + ox + 2, y + oy - 3, 2, 1, PAL.logRing);
  }
}

// The rocky hill. When a quarry is built it gets cut terraces, stone
// blocks and a wooden crane.
function drawQuarry(ctx, x, y, built) {
  fillPoly(ctx, [[x + 4, y], [x + 92, y], [x + 106, y - 8], [x + 100, y + 4], [x + 10, y + 5]], SHADOW);
  fillPoly(ctx, [[x - 4, y], [x + 92, y], [x + 98, y - 12], [x + 86, y - 36], [x + 62, y - 46], [x + 34, y - 44], [x + 10, y - 32], [x - 2, y - 14]], PAL.stone);
  fillPoly(ctx, [[x + 10, y - 32], [x + 34, y - 44], [x + 62, y - 46], [x + 86, y - 36], [x + 66, y - 30], [x + 36, y - 30]], PAL.stoneLight);
  fillPoly(ctx, [[x + 86, y - 36], [x + 98, y - 12], [x + 92, y], [x + 74, y], [x + 66, y - 30]], PAL.stoneDark);
  fillPoly(ctx, [[x - 4, y], [x - 2, y - 14], [x + 10, y - 32], [x + 8, y - 12], [x + 6, y]], PAL.stoneLight);
  const random = makeRandom(9);
  for (let i = 0; i < 30; i++) {                                  // cracks
    const cx = x + 4 + Math.floor(random() * 88);
    const cy = y - 4 - Math.floor(random() * 26);
    rect(ctx, cx, cy, 1 + Math.floor(random() * 4), 1, PAL.stoneDeep);
  }
  for (let i = 0; i < 18; i++) {                                  // grass on top
    rect(ctx, x + 22 + Math.floor(random() * 50), y - 44 + Math.floor(random() * 12), 2, 1, PAL.grassDark);
  }
  fillEllipse(ctx, x + 30, y - 40, 5, 3, PAL.leafDark);           // bushes on top
  fillEllipse(ctx, x + 29, y - 41, 3, 2, PAL.leaf);

  if (!built) return;

  // Cut terraces
  for (let i = 0; i < 3; i++) {
    const tx = x + 22 - i * 4, ty = y - 26 + i * 9, tw = 44 + i * 8;
    rect(ctx, tx, ty, tw, 2, PAL.stoneLight);
    rect(ctx, tx, ty + 2, tw, 7, PAL.stoneDark);
    for (let bx = tx + 2 + i * 2; bx < tx + tw; bx += 7) rect(ctx, bx, ty + 2, 1, 7, PAL.stoneDeep);
    rect(ctx, tx, ty + 8, tw, 1, PAL.stoneDeep);
  }
  // Wooden crane
  rect(ctx, x + 76, y - 30, 2, 30, PAL.wood);
  rect(ctx, x + 78, y - 30, 1, 30, PAL.woodDark);
  rect(ctx, x + 56, y - 30, 24, 2, PAL.wood);
  rect(ctx, x + 60, y - 28, 1, 12, PAL.outline);                  // rope
  drawBox(ctx, x + 58, y - 12, 5, 4, 4, PAL.stoneLight, PAL.stone, PAL.cloth);
  // Cut blocks waiting to be carted away
  drawBox(ctx, x + 6, y + 8, 7, 5, 6, PAL.stoneLight, PAL.stoneDark, PAL.cloth);
  drawBox(ctx, x + 14, y + 8, 7, 5, 6, PAL.stoneLight, PAL.stoneDark, PAL.cloth);
  drawBox(ctx, x + 10, y + 3, 7, 5, 6, PAL.stoneLight, PAL.stoneDark, PAL.cloth);
  // Cart
  drawBox(ctx, x + 30, y + 8, 14, 5, 8, PAL.wood, PAL.woodDark, PAL.woodLight);
  rect(ctx, x + 32, y + 3, 4, 2, PAL.stoneLight);
  rect(ctx, x + 37, y + 2, 4, 3, PAL.stone);
  fillEllipse(ctx, x + 33, y + 9, 3, 3, PAL.woodDeep);
  fillEllipse(ctx, x + 42, y + 9, 3, 3, PAL.woodDeep);
  rect(ctx, x + 32, y + 8, 2, 1, PAL.woodLight);
  rect(ctx, x + 41, y + 8, 2, 1, PAL.woodLight);
}

// A market stall with a striped awning.
function drawStall(ctx, x, y, color) {
  drawGroundShadow(ctx, x, y, 22, 8);
  rect(ctx, x + 1, y - 18, 1, 18, PAL.timber);                   // posts
  rect(ctx, x + 20, y - 18, 1, 18, PAL.timber);
  drawBox(ctx, x, y, 22, 7, 8, PAL.wood, PAL.woodDark, PAL.woodLight);
  // Goods on the counter
  const goods = [PAL.red, PAL.wheatLight, PAL.cabbage, PAL.pumpkin, PAL.gold];
  goods.forEach((c, i) => {
    rect(ctx, x + 2 + i * 4, y - 9, 3, 2, c);
    rect(ctx, x + 2 + i * 4, y - 9, 1, 1, PAL.cloth);
  });
  // Awning: sloped canvas with stripes, plus a dark side
  const front = [[x - 2, y - 15], [x + 24, y - 15], [x + 27, y - 22], [x + 1, y - 22]];
  fillPoly(ctx, [[x + 24, y - 15], [x + 28, y - 19], [x + 28, y - 22], [x + 27, y - 22]], PAL.woodDark);
  fillPoly(ctx, front, PAL.cloth);
  for (let i = 0; i < 26; i += 6) {
    fillPoly(ctx, [[x - 2 + i, y - 15], [x + 1 + i, y - 15], [x + 4 + i, y - 22], [x + 1 + i, y - 22]], color);
  }
  for (let i = 0; i < 26; i += 3) rect(ctx, x - 2 + i, y - 15, 2, 2, i % 6 === 0 ? color : PAL.cloth);   // scalloped edge
  rect(ctx, x + 1, y - 23, 26, 1, PAL.cloth);
}

const STALL_COLORS = [PAL.red, PAL.blue, PAL.green, PAL.purple];

function drawWell(ctx, x, y) {
  drawGroundShadow(ctx, x, y, 12, 8);
  paintBricks(ctx, x, y - 7, 12, 7, PAL.stone, PAL.stoneDark, PAL.stoneLight);
  fillEllipse(ctx, x + 6, y - 7, 6, 2, PAL.stoneLight);
  fillEllipse(ctx, x + 6, y - 7, 4, 1, PAL.waterDark);
  rect(ctx, x, y - 17, 1, 10, PAL.timber);
  rect(ctx, x + 11, y - 17, 1, 10, PAL.timber);
  drawBox(ctx, x - 2, y - 17, 16, 2, 6, PAL.roofRed, PAL.roofRedDark, PAL.roofRedLight);
  rect(ctx, x + 6, y - 15, 1, 5, PAL.outline);
  rect(ctx, x + 5, y - 11, 3, 3, PAL.wood);
}

function drawTree(ctx, x, y, s) {
  fillEllipse(ctx, x + Math.round(s * 0.7), y, s, Math.max(2, Math.round(s * 0.35)), SHADOW);
  rect(ctx, x - 1, y - s - 2, 3, s + 2, PAL.trunk);
  rect(ctx, x + 1, y - s - 2, 1, s + 2, PAL.trunkDark);
  const cy = y - s - Math.round(s * 0.7);
  fillEllipse(ctx, x + 1, cy + 1, s + 1, Math.round(s * 0.9) + 1, PAL.leafDeep);
  fillEllipse(ctx, x, cy, s, Math.round(s * 0.9), PAL.leafDark);
  fillEllipse(ctx, x - Math.round(s * 0.2), cy - Math.round(s * 0.2), Math.round(s * 0.75), Math.round(s * 0.65), PAL.leaf);
  fillEllipse(ctx, x - Math.round(s * 0.4), cy - Math.round(s * 0.4), Math.round(s * 0.35), Math.round(s * 0.3), PAL.leafLight);
  rect(ctx, x - Math.round(s * 0.55), cy - Math.round(s * 0.55), 2, 1, PAL.leafBright);
  const random = makeRandom(x * 31 + y * 17);
  for (let i = 0; i < s * 2; i++) {                               // leafy texture
    const lx = x + Math.round((random() - 0.5) * s * 1.4);
    const ly = cy + Math.round((random() - 0.4) * s * 1.2);
    rect(ctx, lx, ly, 1, 1, random() < 0.5 ? PAL.leafDeep : PAL.leafLight);
  }
}

function drawPine(ctx, x, y, s) {
  fillEllipse(ctx, x + Math.round(s * 0.6), y, Math.round(s * 0.9), Math.max(2, Math.round(s * 0.3)), SHADOW);
  rect(ctx, x - 1, y - 4, 2, 4, PAL.trunk);
  for (let t = 0; t < 3; t++) {
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

function drawLamp(ctx, x, y) {
  rect(ctx, x, y - 12, 1, 12, PAL.outline);
  rect(ctx, x - 1, y - 15, 3, 3, PAL.glass);
  rect(ctx, x - 1, y - 16, 3, 1, PAL.outline);
  rect(ctx, x - 1, y, 3, 1, PAL.stoneDeep);
}

function drawBarrel(ctx, x, y) {
  rect(ctx, x, y - 6, 5, 6, PAL.wood);
  rect(ctx, x + 4, y - 6, 1, 6, PAL.woodDark);
  rect(ctx, x, y - 5, 5, 1, PAL.metalDark);
  rect(ctx, x, y - 2, 5, 1, PAL.metalDark);
  fillEllipse(ctx, x + 2.5, y - 6, 2.5, 1, PAL.woodLight);
}


// ---------- Putting the scene together ----------

// Builds the list of everything standing in the village. Each entry
// knows where it touches the ground (baseY) and how to draw itself.
function getSceneObjects() {
  const L = VILLAGE_LAYOUT;
  const b = state.buildings;
  const objects = [];
  const add = (baseY, draw) => objects.push({ baseY, draw });

  add(L.townHall.y + 4, ctx => drawTownHall(ctx, L.townHall.x, L.townHall.y));

  const hasQuarry = b.quarry.count > 0;
  add(L.quarry.y + (hasQuarry ? 10 : 0), ctx => drawQuarry(ctx, L.quarry.x, L.quarry.y, hasQuarry));

  if (b.farm.count > 0) add(L.barn.y, ctx => drawBarn(ctx, L.barn.x, L.barn.y));
  const fieldCount = Math.min(b.farm.count, L.farmFields.length);
  for (let i = 0; i < fieldCount; i++) {
    const f = L.farmFields[i];
    add(f.y, ctx => drawField(ctx, f.x, f.y, FIELD_CROPS[i]));
  }

  if (b.lumberMill.count > 0) {
    add(L.lumberMill.y, ctx => drawLumberMill(ctx, L.lumberMill.x, L.lumberMill.y));
  }

  // One market = 2 stalls, every extra market adds a stall (up to 4)
  const stallCount = b.market.count > 0 ? Math.min(L.marketStalls.length, b.market.count + 1) : 0;
  for (let i = 0; i < stallCount; i++) {
    const s = L.marketStalls[i];
    add(s.y, ctx => drawStall(ctx, s.x, s.y, STALL_COLORS[i]));
  }

  L.huts.forEach((h, i) => add(h.y, ctx => drawHut(ctx, h.x, h.y, i)));
  add(L.well.y, ctx => drawWell(ctx, L.well.x, L.well.y));

  const painters = { tree: drawTree, pine: drawPine, bush: drawBush, lamp: drawLamp, barrel: drawBarrel };
  for (const [kind, x, y, size] of SCENERY) {
    if (kind === "crate") {
      add(y, ctx => drawBox(ctx, x, y, 6, 5, 6, PAL.wood, PAL.woodDark, PAL.woodLight));
    } else {
      add(y, ctx => painters[kind](ctx, x, y, size));
    }
  }

  objects.sort((a, b) => a.baseY - b.baseY);   // far first, near last
  return objects;
}

// Paints the whole village onto the visible canvas.
function drawVillage() {
  villageCtx.drawImage(backdropCanvas, 0, 0);
  for (const obj of getSceneObjects()) obj.draw(villageCtx);
}

// Scales the 480x270 canvas to fill its frame, while leaving room for
// the top bar and bottom navigation on short screens.
function resizeVillageCanvas() {
  const frame = document.getElementById("village-frame");
  if (!frame.offsetParent) return;                       // village tab is hidden
  // The frame hugs the canvas, so measure the space around the frame
  // and subtract the frame's own border and padding.
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

// The drawing loop. It only repaints when something changed.
// (requestAnimationFrame pauses in hidden tabs - that's fine, drawing
// is only visual. Resources are handled by the time-based game loop.)
function renderLoop() {
  if (villageNeedsRedraw) {
    drawVillage();
    villageNeedsRedraw = false;
  }
  requestAnimationFrame(renderLoop);
}


/* =============================================================
   9. START THE GAME
   ============================================================= */

function initGame() {
  // Set up the village canvas
  villageCanvas = document.getElementById("village-canvas");
  villageCtx = villageCanvas.getContext("2d");
  villageCtx.imageSmoothingEnabled = false; // keep pixels crisp
  paintBackdrop();

  // Load the saved kingdom (or keep the new one if there is no save)
  const saved = loadGame();
  if (saved) state = saved;

  // Build the interface
  buildResourceBar();
  buildBuildingPanel();
  setupNavigation();
  setupSaveControls();
  resizeVillageCanvas();
  window.addEventListener("resize", resizeVillageCanvas);

  // Pay out any time away since the last save (shows "Welcome back")
  updateGame();
  saveGame();
  refreshUI();

  // Start the loops
  setInterval(gameTick, LOGIC_INTERVAL_MS);
  setInterval(autoSave, AUTOSAVE_INTERVAL_MS);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", saveBeforeLeaving);
  window.addEventListener("beforeunload", saveBeforeLeaving);
  requestAnimationFrame(renderLoop);
}

// Wait until the HTML is ready, then start.
document.addEventListener("DOMContentLoaded", initGame);
