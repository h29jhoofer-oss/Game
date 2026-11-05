/* =============================================================
   KINGDOM IDLE - GAME LOGIC                       (Stage 4)
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
//   W water   B bridge   S sand   R road   P plaza   T stairs
const VILLAGE_MAP = [
  "MMMmmFFFFFFqQQqFFFFF",
  "MMmmFFGGGGGqQQqGFFFF",
  "MmmFGGGGGGGGqqGGGFFF",
  "mmFGGGGGGGGGGGGGGGFF",
  "mWGGHHHHHHGGGGGGGGFF",
  "FWGGHHHHHHGGGGGGGGGF",
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
  "GWWSGGGGGGRRGGGGGGFF",
  "GGWSGGGGGGRRGGGGGFFF",
  "GGWWSGGGGGRRGGGGFFFF",
  "GGGWSGGGGGRRGGGFFFFF",
];

// What each letter means: the kind of ground and its height level.
const TILE_TYPES = {
  G: { kind: "grass",  level: 0 },
  F: { kind: "forest", level: 0 },
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
  { needs: "quarry",     carry: "stone", points: [[11.4, 4.3, 0], [14.6, 4.3, 0], [14.6, 6.5, 0]] },
  { needs: "market",     carry: "crate", points: [[9.6, 12.3, 0], [12.5, 12.6, 0]] },
];
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
function drawTower(ctx, tx, ty, z, r, h, coneH) {
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
  fx.flags.push({ x: sx + 1, y: sy - h - coneH - 8, color: PAL.banner });
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

function drawCastle(ctx) {
  const Z = 2 * LEVEL_HEIGHT;   // the castle hill is 2 levels high
  drawTower(ctx, 5.3, 5.3, Z, 6, 46, 18);                        // tall back tower

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
  drawRoof(ctx, keep, 26, 14, ROOF_SLATE, "y", PAL.stone);

  // Curtain walls and towers along the hill's front edges
  drawTower(ctx, 9.6, 4.6, Z, 5, 26, 14);
  drawCastleWall(ctx, { x: 9.45, y: 4.6, w: 0.45, d: 5.0, z: Z }, 9);
  drawTower(ctx, 4.6, 9.6, Z, 5, 26, 14);
  drawCastleWall(ctx, { x: 4.6, y: 9.45, w: 2.3, d: 0.45, z: Z }, 9);
  drawCastleWall(ctx, { x: 8.5, y: 9.45, w: 1.1, d: 0.45, z: Z }, 9);

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

  drawTower(ctx, 9.6, 9.6, Z, 6, 30, 16);                        // front tower
}

// Timber-framed cottage. `variant` picks the roof.
function drawHouse(ctx, tx, ty, variant) {
  const box = { x: tx + 0.25, y: ty + 0.25, w: 1.5, d: 1.5, z: 0 };
  const h = 13;
  fx.shadows.push({ box, h: h + 8 });
  drawIsoBox(ctx, box, h, PAL.plaster, PAL.plasterShade);
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
}

function drawBarn(ctx, tx, ty) {
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
  drawRoof(ctx, box, h, 12, ROOF_WOOD, "x", PAL.barnDark);
}

function drawHay(ctx, tx, ty) {
  drawIsoBox(ctx, { x: tx, y: ty, w: 0.5, d: 0.35, z: 0 }, 4, PAL.thatch, PAL.thatchDark, PAL.thatchLight);
}

function drawLumberMill(ctx, tx, ty) {
  const box = { x: tx + 0.2, y: ty + 0.2, w: 1.6, d: 1.6, z: 0 };
  const h = 12;
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
  drawRoof(ctx, box, h, 9, ROOF_RED, "y", PAL.wood, () => drawChimney(ctx, box.x + 1.1, box.y + 0.25, h, 12));

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

function drawQuarryWorks(ctx) {
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

function drawStall(ctx, tx, ty, color) {
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
  drawRoof(ctx, roofBox, 13, 5, { roof: PAL.cloth, dark: "#cfc5ae", light: "#fffaf0", kind: "stripes", stripe: color }, "x", color);
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

function drawTree(ctx, x, y, s, seed) {
  fillEllipse(ctx, x + Math.round(s * 0.7), y, s, Math.max(2, Math.round(s * 0.35)), SHADOW);
  rect(ctx, x - 1, y - s - 2, 3, s + 2, PAL.trunk);
  rect(ctx, x + 1, y - s - 2, 1, s + 2, PAL.trunkDark);
  const cy = y - s - Math.round(s * 0.7);
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


// ---------- Building the scene ----------

// Rebuilds all cached art from the current game state.
function buildScene() {
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
  const addSprite = (depth, bounds, drawFn) => list.push({ depth, sprite: makeSprite(bounds, drawFn) });

  // Castle on its hill (depth chosen so the stairs and roads draw in front)
  addSprite(17, { x: 140, y: 0, w: 210, h: 140 }, drawCastle);
  occupy(4, 4, 6, 6);

  // Houses
  L.huts.forEach((h, i) => {
    occupy(h.x, h.y, 2, 2);
    addSprite(h.x + h.y + 3.4, boxBounds({ x: h.x, y: h.y, w: 2, d: 2, z: 0 }, 40), ctx => drawHouse(ctx, h.x, h.y, i));
  });

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
    addSprite(f.x + f.w + f.y + f.d, boxBounds({ ...f, z: 0 }, 8), ctx => drawFieldFrontFence(ctx, f));
  }

  // Lumber mill
  if (b.lumberMill.count > 0) {
    const m = L.lumberMill;
    occupy(m.x, m.y, 3, 2);
    addSprite(m.x + m.y + 3.6, boxBounds({ x: m.x, y: m.y, w: 3, d: 2, z: 0 }, 40), ctx => drawLumberMill(ctx, m.x, m.y));
    addSprite(14.2 + 9.2 + 0.8, boxBounds({ x: 14.2, y: 9.2, w: 1, d: 0.8, z: 0 }, 12), ctx => drawLogPile(ctx, 14.15, 9.15));
    addSprite(17.2 + 10.2 + 0.8, boxBounds({ x: 17.2, y: 10.2, w: 1, d: 0.8, z: 0 }, 12), ctx => drawLogPile(ctx, 17.15, 10.15));
  }

  // Quarry works
  if (b.quarry.count > 0) {
    addSprite(15.2, { x: 290, y: 80, w: 100, h: 70 }, drawQuarryWorks);
  }

  // Market stalls: one market = 2 stalls, each extra market adds one (max 4)
  const stallCount = b.market.count > 0 ? Math.min(L.marketStalls.length, b.market.count + 1) : 0;
  for (let i = 0; i < stallCount; i++) {
    const s = L.marketStalls[i];
    addSprite(s.x + s.y + 1.85, boxBounds({ x: s.x, y: s.y, w: 1, d: 1, z: 0 }, 26), ctx => drawStall(ctx, s.x, s.y, STALL_COLORS[i]));
  }

  // Plaza well, lamps and props
  const [wx, wy] = iso(11, 12.5, 0);
  addSprite(23.5, { x: wx - 10, y: wy - 24, w: 22, h: 30 }, ctx => drawWell(ctx, 11, 12.5));
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
      treeSprites[key] = makeSprite({ x: -16, y: -size * 3 - 6, w: 34, h: size * 3 + 12 }, ctx => {
        if (kind === "pine") drawPine(ctx, 0, 0, size);
        else if (kind === "bush") drawBush(ctx, 0, 0, size);
        else if (kind === "boulder") drawBoulder(ctx, 0, 0, size);
        else drawTree(ctx, 0, 0, size, seed % 4 + 3);
      });
    }
    if (kind === "tree" || kind === "pine") fx.fireflies.push({ x: sx, y: sy - size * 2 });
    const s = treeSprites[key];
    list.push({ depth: tx + ty, sprite: s, ax: Math.round(sx), ay: Math.round(sy) });
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
    if (Math.sin(time * 2.2 + s.phase) > 0.55) rect(ctx, s.x, s.y, 2, 1, PAL.waterLight);
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
  if (villageNeedsRedraw) {
    buildScene();
    villageNeedsRedraw = false;
  }
  drawFrame(now / 1000, dt);
}


/* =============================================================
   9. START THE GAME
   ============================================================= */

function initGame() {
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
