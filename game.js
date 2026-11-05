/* =============================================================
   KINGDOM IDLE - GAME LOGIC                       (Stage 2)
   -------------------------------------------------------------
   This file is split into numbered sections:

     1. CONFIGURATION   - numbers & data you can tweak
     2. GAME STATE      - everything that changes while playing
     3. PRODUCTION      - how resources are generated
     3b. COSTS & ACTIONS - building and upgrading
     4. GAME LOOP       - time-based updates
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
    lastUpdate: Date.now(),                      // real-world time in ms
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

  applyProduction(elapsedSeconds);
  state.lastUpdate = now;
}

// Refreshes everything on screen that shows numbers.
function refreshUI() {
  updateResourceBar();
  updateBuildingPanel();
}

// Runs the logic and refreshes the numbers on screen.
function gameTick() {
  updateGame();
  refreshUI();
}

// When the player comes back to the tab, catch up immediately
// instead of waiting for the next timer.
function handleVisibilityChange() {
  if (!document.hidden) gameTick();
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


/* =============================================================
   8. VILLAGE DRAWING
   -------------------------------------------------------------
   The village is painted on a tiny 320x180 canvas using only
   solid rectangles (every rectangle = a block of pixels).
   CSS then scales the canvas up with nearest-neighbor
   ("pixelated") scaling so the pixels stay sharp.

   The ground (grass, roads, pond) never changes, so we paint
   it ONCE onto a hidden canvas and copy it every frame. This
   is fast and leaves room for animations in Stage 4.
   ============================================================= */

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 180;

const PAL = {
  outline: "#2b1d14",
  grass: "#5a8f3c", grassDark: "#4b7c32", grassLight: "#6fa64a", grassDeep: "#3e6b2a",
  flowerY: "#f2d04e", flowerW: "#f6ead0", flowerR: "#d8604a",
  dirt: "#a07a4a", dirtDark: "#7f5d36", dirtLight: "#b98f58",
  water: "#3f7fb5", waterLight: "#6fa8d8", waterDark: "#2c5c8a",
  wall: "#c9a26b", wallDark: "#9c7646",
  timber: "#5c3a21",
  roof: "#8e4a2a", roofDark: "#6a321c", roofLight: "#b0643a",
  thatch: "#d0a548", thatchDark: "#a37c2c", thatchLight: "#e8c46a",
  barn: "#b03a2a", barnDark: "#7e2418",
  stone: "#9a9a8e", stoneDark: "#6f6f66", stoneLight: "#c2c2b4",
  log: "#7a4e2a", logEnd: "#e0b77a", logRing: "#b98a4e",
  leaf: "#3f7a34", leafDark: "#2c5a26", leafLight: "#5f9c45",
  pine: "#2f6a3c", pineDark: "#214d2b",
  trunk: "#5c3a21",
  soil: "#6b4a2a", soilDark: "#523720",
  wheat: "#d9a441", wheatLight: "#f0cf6a", sprout: "#7fb84a",
  glass: "#f2d48a", door: "#4a2f1d",
  banner: "#3a5fa8", bannerGold: "#f2c14e",
  metal: "#b8b8c0", metalDark: "#7a7a84",
  fire: "#f08a2a", fireLight: "#f8d24a",
};

// Where things go in the village. Change numbers to move them.
const VILLAGE_LAYOUT = {
  townHall:   { x: 140, y: 40 },
  farm:       { x: 22,  y: 108 },
  lumberMill: { x: 214, y: 106 },
  quarry:     { x: 46,  y: 36 },
  market:     { x: 152, y: 118 },
  huts: [
    { x: 100, y: 58 },
    { x: 196, y: 56 },
    { x: 112, y: 132 },
  ],
  well:       { x: 186, y: 86 },
  campfire:   { x: 128, y: 92 },
};

let villageCanvas, villageCtx;
let groundCanvas; // the pre-painted ground layer

// Shortcut: fill a rectangle with a color on a given context.
function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// A tiny "random" number generator that always gives the same sequence
// for the same seed. This keeps grass tufts in the same place every time.
function makeRandom(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// ---------- Ground layer (painted once) ----------
function paintGround() {
  groundCanvas = document.createElement("canvas");
  groundCanvas.width = VIEW_WIDTH;
  groundCanvas.height = VIEW_HEIGHT;
  const g = groundCanvas.getContext("2d");
  const random = makeRandom(42);

  // Grass
  rect(g, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, PAL.grass);

  // Darker and lighter grass patches for texture
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(random() * VIEW_WIDTH);
    const y = Math.floor(random() * VIEW_HEIGHT);
    const w = 4 + Math.floor(random() * 12);
    rect(g, x, y, w, 2, random() < 0.5 ? PAL.grassDark : PAL.grassLight);
  }

  // Grass tufts: little "v" shapes
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(random() * VIEW_WIDTH);
    const y = Math.floor(random() * VIEW_HEIGHT);
    rect(g, x, y, 1, 1, PAL.grassDeep);
    rect(g, x + 2, y, 1, 1, PAL.grassDeep);
    rect(g, x + 1, y + 1, 1, 1, PAL.grassDeep);
  }

  // Flowers
  const flowerColors = [PAL.flowerY, PAL.flowerW, PAL.flowerR];
  for (let i = 0; i < 45; i++) {
    const x = Math.floor(random() * VIEW_WIDTH);
    const y = Math.floor(random() * VIEW_HEIGHT);
    rect(g, x, y, 1, 1, flowerColors[Math.floor(random() * 3)]);
  }

  paintRoads(g);
  paintPond(g, 266, 150);
}

// Dirt roads: one main road across the village, branches to buildings.
function paintRoads(g) {
  // Draw a road segment with darker edges
  function road(x, y, w, h) {
    rect(g, x - 1, y - 1, w + 2, h + 2, PAL.dirtDark);
    rect(g, x, y, w, h, PAL.dirt);
  }
  road(0, 100, VIEW_WIDTH, 8);     // main east-west road
  road(155, 68, 10, 33);           // up to the town hall

  // Pebbles and wheel ruts
  const random = makeRandom(7);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(random() * VIEW_WIDTH);
    rect(g, x, 101 + Math.floor(random() * 6), 1, 1,
      random() < 0.5 ? PAL.dirtLight : PAL.dirtDark);
  }
  for (let y = 70; y < 100; y += 3) {
    rect(g, 157 + Math.floor(random() * 6), y, 1, 1, PAL.dirtLight);
  }
}

// A small pond in the corner, built from stacked rows.
function paintPond(g, cx, cy) {
  const rows = [
    [-10, 20], [-15, 30], [-18, 36], [-20, 40], [-20, 40],
    [-19, 38], [-17, 34], [-13, 26], [-8, 16],
  ];
  rows.forEach(([offset, width], i) => {
    rect(g, cx + offset - 1, cy + i, width + 2, 1, PAL.dirtDark); // muddy edge
  });
  rows.forEach(([offset, width], i) => {
    if (i === 0 || i === rows.length - 1) return;
    rect(g, cx + offset, cy + i, width, 1, i < 3 ? PAL.waterDark : PAL.water);
  });
  // Light reflections
  rect(g, cx - 8, cy + 4, 6, 1, PAL.waterLight);
  rect(g, cx + 6, cy + 6, 4, 1, PAL.waterLight);
  // Reeds
  rect(g, cx + 16, cy - 2, 1, 4, PAL.leafDark);
  rect(g, cx + 18, cy - 3, 1, 5, PAL.leafDark);
  rect(g, cx - 19, cy - 1, 1, 3, PAL.leafDark);
}

// ---------- Reusable pieces ----------

// Soft dark oval under an object so it sits on the ground.
function drawShadow(ctx, x, y, w) {
  rect(ctx, x + 2, y, w - 4, 1, PAL.grassDeep);
  rect(ctx, x, y + 1, w, 1, PAL.grassDeep);
  rect(ctx, x + 2, y + 2, w - 4, 1, PAL.grassDeep);
}

// A hip roof: each row is 1 pixel wider on both sides than the one above.
function drawRoof(ctx, x, y, w, h, color, dark, light) {
  for (let i = 0; i < h; i++) {
    const inset = h - 1 - i;
    rect(ctx, x + inset, y + i, w - inset * 2, 1, color);
    rect(ctx, x + inset, y + i, 1, 1, light);              // left slope
    rect(ctx, x + w - inset - 1, y + i, 1, 1, dark);        // right slope
  }
  rect(ctx, x, y + h, w, 1, dark);                          // eave shadow
  // Texture lines across the roof
  for (let i = 2; i < h; i += 2) {
    const inset = h - 1 - i;
    for (let px = x + inset + 2; px < x + w - inset - 2; px += 3) {
      rect(ctx, px, y + i, 1, 1, dark);
    }
  }
}

// Round leafy tree, about 12x16 pixels. (x, y) is the top-left corner.
function drawTree(ctx, x, y) {
  drawShadow(ctx, x - 1, y + 14, 14);
  rect(ctx, x + 5, y + 10, 2, 6, PAL.trunk);
  const rows = [[3, 6], [1, 10], [0, 12], [0, 12], [0, 12], [0, 12], [0, 12], [1, 10], [2, 8], [4, 4]];
  rows.forEach(([o, w], i) => rect(ctx, x + o, y + i + 1, w, 1, PAL.leafDark));  // shadow side
  rows.forEach(([o, w], i) => rect(ctx, x + o, y + i, w - 1, 1, PAL.leaf));
  rect(ctx, x + 3, y + 2, 3, 2, PAL.leafLight);   // sunlight highlights
  rect(ctx, x + 2, y + 4, 2, 1, PAL.leafLight);
  rect(ctx, x + 7, y + 5, 2, 1, PAL.leafDark);
}

// Pointy pine tree, about 10x18 pixels.
function drawPine(ctx, x, y) {
  drawShadow(ctx, x - 1, y + 16, 12);
  rect(ctx, x + 4, y + 13, 2, 5, PAL.trunk);
  const tiers = [[4, 2], [3, 4], [2, 6], [3, 4], [2, 6], [1, 8], [2, 6], [1, 8], [0, 10], [1, 8], [0, 10], [0, 10], [1, 8], [3, 4]];
  tiers.forEach(([o, w], i) => {
    rect(ctx, x + o, y + i, w, 1, PAL.pine);
    rect(ctx, x + o + w - 2, y + i, 2, 1, PAL.pineDark);
  });
  rect(ctx, x + 4, y, 1, 3, PAL.leafLight);
}

// Small thatched cottage where citizens live.
function drawHut(ctx, x, y) {
  drawShadow(ctx, x - 1, y + 16, 20);
  rect(ctx, x + 1, y + 7, 16, 10, PAL.outline);         // wall outline
  rect(ctx, x + 2, y + 8, 14, 8, PAL.wall);              // walls
  rect(ctx, x + 2, y + 14, 14, 2, PAL.wallDark);
  rect(ctx, x + 2, y + 8, 1, 8, PAL.timber);             // timber frame
  rect(ctx, x + 15, y + 8, 1, 8, PAL.timber);
  rect(ctx, x + 7, y + 11, 4, 6, PAL.door);              // door
  rect(ctx, x + 10, y + 13, 1, 1, PAL.bannerGold);       // door knob
  rect(ctx, x + 3, y + 10, 3, 3, PAL.glass);             // window
  rect(ctx, x + 4, y + 10, 1, 3, PAL.timber);
  drawRoof(ctx, x, y, 18, 8, PAL.thatch, PAL.thatchDark, PAL.thatchLight);
  rect(ctx, x + 13, y - 2, 3, 5, PAL.stoneDark);         // chimney
  rect(ctx, x + 13, y - 2, 3, 1, PAL.stone);
}

// The settlement's wooden hall with a royal banner.
function drawTownHall(ctx, x, y) {
  drawShadow(ctx, x - 2, y + 30, 44);
  // Stone foundation
  rect(ctx, x, y + 26, 40, 5, PAL.stoneDark);
  for (let i = 0; i < 40; i += 5) rect(ctx, x + i + 1, y + 27, 3, 2, PAL.stone);
  // Walls
  rect(ctx, x + 1, y + 12, 38, 14, PAL.outline);
  rect(ctx, x + 2, y + 13, 36, 13, PAL.wall);
  rect(ctx, x + 2, y + 23, 36, 3, PAL.wallDark);
  for (const tx of [2, 12, 27, 37]) rect(ctx, x + tx, y + 13, 1, 13, PAL.timber);
  rect(ctx, x + 2, y + 17, 36, 1, PAL.timber);
  // Big double door
  rect(ctx, x + 16, y + 17, 8, 10, PAL.outline);
  rect(ctx, x + 17, y + 18, 6, 9, PAL.door);
  rect(ctx, x + 20, y + 18, 1, 9, PAL.outline);
  // Windows
  rect(ctx, x + 5, y + 19, 4, 3, PAL.glass);
  rect(ctx, x + 31, y + 19, 4, 3, PAL.glass);
  // Roof
  drawRoof(ctx, x - 2, y, 44, 12, PAL.roof, PAL.roofDark, PAL.roofLight);
  // Flag pole and banner
  rect(ctx, x + 20, y - 14, 1, 16, PAL.outline);
  rect(ctx, x + 20, y - 15, 1, 1, PAL.bannerGold);
  rect(ctx, x + 21, y - 13, 9, 6, PAL.banner);
  rect(ctx, x + 21, y - 7, 3, 1, PAL.banner);
  rect(ctx, x + 27, y - 7, 3, 1, PAL.banner);
  rect(ctx, x + 24, y - 11, 3, 2, PAL.bannerGold);       // crown emblem
}

// Barn plus a fenced wheat field.
function drawFarm(ctx, x, y) {
  // --- Field ---
  const fx = x + 30, fy = y + 6, fw = 54, fh = 46;
  rect(ctx, fx, fy, fw, fh, PAL.soilDark);
  for (let row = 0; row < fh; row += 6) {
    rect(ctx, fx, fy + row, fw, 4, PAL.soil);
    // wheat stalks along each furrow
    for (let col = 2; col < fw - 2; col += 3) {
      rect(ctx, fx + col, fy + row, 1, 3, PAL.wheat);
      rect(ctx, fx + col, fy + row, 1, 1, PAL.wheatLight);
    }
  }
  // Fence around the field
  rect(ctx, fx - 2, fy - 3, fw + 4, 1, PAL.timber);
  rect(ctx, fx - 2, fy + fh + 1, fw + 4, 1, PAL.timber);
  for (let px = fx - 2; px <= fx + fw + 2; px += 6) {
    rect(ctx, px, fy - 4, 1, 3, PAL.outline);
    rect(ctx, px, fy + fh, 1, 3, PAL.outline);
  }

  // --- Barn ---
  drawShadow(ctx, x - 1, y + 30, 30);
  rect(ctx, x + 1, y + 12, 26, 19, PAL.outline);
  rect(ctx, x + 2, y + 13, 24, 17, PAL.barn);
  rect(ctx, x + 2, y + 26, 24, 4, PAL.barnDark);
  for (let px = x + 4; px < x + 26; px += 4) rect(ctx, px, y + 13, 1, 17, PAL.barnDark); // planks
  // Barn door with white X
  rect(ctx, x + 9, y + 19, 10, 12, PAL.flowerW);
  rect(ctx, x + 10, y + 20, 8, 11, PAL.barnDark);
  for (let i = 0; i < 8; i++) {
    rect(ctx, x + 10 + i, y + 20 + i, 1, 1, PAL.flowerW);
    rect(ctx, x + 17 - i, y + 20 + i, 1, 1, PAL.flowerW);
  }
  drawRoof(ctx, x - 1, y + 2, 30, 10, PAL.roof, PAL.roofDark, PAL.roofLight);
  rect(ctx, x + 12, y + 5, 4, 3, PAL.glass);              // hayloft window

  // Hay bales
  rect(ctx, x + 2, y + 34, 6, 4, PAL.thatchDark);
  rect(ctx, x + 2, y + 34, 6, 1, PAL.thatchLight);
  rect(ctx, x + 9, y + 35, 6, 4, PAL.thatchDark);
  rect(ctx, x + 9, y + 35, 6, 1, PAL.thatchLight);
}

// Lumber mill: workshop, saw blade and a pile of logs.
function drawLumberMill(ctx, x, y) {
  drawShadow(ctx, x - 1, y + 26, 34);
  // Building
  rect(ctx, x + 1, y + 10, 30, 17, PAL.outline);
  rect(ctx, x + 2, y + 11, 28, 15, PAL.log);
  for (let py = y + 13; py < y + 26; py += 3) rect(ctx, x + 2, py, 28, 1, PAL.timber); // log walls
  rect(ctx, x + 12, y + 16, 8, 11, PAL.door);
  rect(ctx, x + 4, y + 15, 4, 3, PAL.glass);
  drawRoof(ctx, x - 1, y, 34, 10, PAL.roof, PAL.roofDark, PAL.roofLight);

  // Saw table with a round blade
  const sx = x + 34, sy = y + 16;
  rect(ctx, sx, sy + 6, 14, 2, PAL.timber);              // table top
  rect(ctx, sx + 1, sy + 8, 1, 4, PAL.outline);          // legs
  rect(ctx, sx + 12, sy + 8, 1, 4, PAL.outline);
  rect(ctx, sx + 4, sy, 6, 6, PAL.metalDark);            // blade
  rect(ctx, sx + 3, sy + 1, 8, 4, PAL.metalDark);
  rect(ctx, sx + 5, sy + 1, 4, 4, PAL.metal);
  rect(ctx, sx + 6, sy + 2, 2, 2, PAL.outline);          // axle

  // Log pile (logs seen from the end)
  const lx = x + 2, ly = y + 30;
  const logs = [[0, 6], [6, 6], [12, 6], [3, 1], [9, 1]];
  logs.forEach(([ox, oy]) => {
    rect(ctx, lx + ox, ly + oy, 6, 5, PAL.log);
    rect(ctx, lx + ox + 1, ly + oy + 1, 4, 3, PAL.logEnd);
    rect(ctx, lx + ox + 2, ly + oy + 2, 2, 1, PAL.logRing);
  });

  // Tree stumps nearby
  for (const [ox, oy] of [[30, 34], [42, 30]]) {
    rect(ctx, x + ox, y + oy, 5, 3, PAL.log);
    rect(ctx, x + ox, y + oy, 5, 1, PAL.logEnd);
  }
}

// Stone well.
function drawWell(ctx, x, y) {
  drawShadow(ctx, x - 1, y + 10, 12);
  rect(ctx, x, y + 5, 10, 6, PAL.stoneDark);
  rect(ctx, x + 1, y + 5, 8, 2, PAL.stone);
  rect(ctx, x + 2, y + 5, 6, 1, PAL.waterDark);
  rect(ctx, x, y - 3, 1, 8, PAL.timber);                 // posts
  rect(ctx, x + 9, y - 3, 1, 8, PAL.timber);
  rect(ctx, x - 1, y - 4, 12, 2, PAL.roof);              // little roof
  rect(ctx, x + 4, y - 2, 1, 4, PAL.outline);            // rope
  rect(ctx, x + 3, y + 1, 3, 2, PAL.log);                // bucket
}

// Campfire with stones (static for now - it will flicker in Stage 4).
function drawCampfire(ctx, x, y) {
  rect(ctx, x, y + 4, 8, 2, PAL.stoneDark);
  rect(ctx, x + 1, y + 3, 6, 1, PAL.log);
  rect(ctx, x + 2, y, 4, 3, PAL.fire);
  rect(ctx, x + 3, y - 1, 2, 3, PAL.fireLight);
}

// Quarry: a cut-stone pit in the hillside with blocks and a pickaxe.
function drawQuarry(ctx, x, y) {
  // Rocky hill
  const rows = [[10, 16], [6, 24], [3, 30], [1, 34], [0, 36], [0, 36], [0, 36], [0, 36], [1, 34]];
  rows.forEach(([o, w], i) => rect(ctx, x + o, y + i * 2, w, 2, PAL.stoneDark));
  rows.forEach(([o, w], i) => rect(ctx, x + o + 1, y + i * 2, w - 3, 1, PAL.stone));
  rect(ctx, x + 12, y + 1, 6, 1, PAL.stoneLight);
  rect(ctx, x + 6, y + 4, 4, 1, PAL.stoneLight);
  // Cut pit (stepped ledges)
  rect(ctx, x + 9, y + 7, 18, 10, PAL.outline);
  rect(ctx, x + 10, y + 8, 16, 3, PAL.stoneDark);
  rect(ctx, x + 10, y + 11, 16, 2, PAL.stone);
  rect(ctx, x + 11, y + 13, 14, 3, PAL.stoneDark);
  rect(ctx, x + 11, y + 16, 14, 1, PAL.stone);
  // Cut blocks stacked at the front
  for (const [ox, oy] of [[3, 20], [9, 20], [6, 16], [26, 20]]) {
    rect(ctx, x + ox, y + oy, 6, 4, PAL.outline);
    rect(ctx, x + ox, y + oy, 5, 3, PAL.stoneLight);
    rect(ctx, x + ox + 1, y + oy + 1, 3, 1, PAL.stone);
  }
  // Pickaxe leaning on the blocks
  rect(ctx, x + 18, y + 18, 1, 6, PAL.trunk);
  rect(ctx, x + 16, y + 17, 5, 1, PAL.metalDark);
  rect(ctx, x + 15, y + 18, 1, 1, PAL.metalDark);
  rect(ctx, x + 21, y + 18, 1, 1, PAL.metalDark);
}

// Market: a striped stall with goods on the counter.
function drawMarket(ctx, x, y) {
  drawShadow(ctx, x - 1, y + 20, 30);
  // Poles
  rect(ctx, x + 1, y + 6, 2, 15, PAL.timber);
  rect(ctx, x + 25, y + 6, 2, 15, PAL.timber);
  // Striped awning
  rect(ctx, x - 1, y, 30, 8, PAL.outline);
  for (let i = 0; i < 28; i += 4) {
    rect(ctx, x + i, y + 1, 2, 6, PAL.barn);
    rect(ctx, x + i + 2, y + 1, 2, 6, PAL.flowerW);
  }
  for (let i = 0; i < 28; i += 4) rect(ctx, x + i + 1, y + 7, 2, 2, PAL.barn); // scalloped edge
  // Counter
  rect(ctx, x + 1, y + 13, 26, 8, PAL.outline);
  rect(ctx, x + 2, y + 14, 24, 6, PAL.log);
  rect(ctx, x + 2, y + 14, 24, 1, PAL.wall);
  // Goods: apples, bread, gold coins, cloth
  rect(ctx, x + 4, y + 11, 4, 3, PAL.flowerR);
  rect(ctx, x + 10, y + 11, 5, 3, PAL.thatch);
  rect(ctx, x + 17, y + 12, 3, 2, PAL.bannerGold);
  rect(ctx, x + 18, y + 11, 1, 1, PAL.fireLight);
  rect(ctx, x + 21, y + 11, 4, 3, PAL.banner);
  // Barrel and crate beside the stall
  rect(ctx, x + 29, y + 13, 5, 7, PAL.outline);
  rect(ctx, x + 30, y + 14, 3, 5, PAL.log);
  rect(ctx, x + 30, y + 16, 3, 1, PAL.metalDark);
}

// Trees placed around the edges of the village.
const TREE_SPOTS = [
  // Forest along the top
  { kind: "pine", x: 4, y: 2 },   { kind: "tree", x: 16, y: 6 },  { kind: "pine", x: 30, y: 0 },
  { kind: "tree", x: 44, y: 8 },  { kind: "pine", x: 58, y: 2 },  { kind: "tree", x: 76, y: 14 },
  { kind: "pine", x: 242, y: 2 }, { kind: "tree", x: 256, y: 10 }, { kind: "pine", x: 270, y: 0 },
  { kind: "pine", x: 284, y: 6 }, { kind: "tree", x: 298, y: 2 },  { kind: "pine", x: 308, y: 16 },
  { kind: "tree", x: 226, y: 20 }, { kind: "pine", x: 290, y: 30 }, { kind: "tree", x: 302, y: 50 },
  { kind: "pine", x: 276, y: 44 }, { kind: "pine", x: 296, y: 74 },
  // Left side
  { kind: "tree", x: 2, y: 40 },  { kind: "pine", x: 14, y: 58 }, { kind: "tree", x: 26, y: 78 },
  // Near the lumber mill (the forest it cuts from)
  { kind: "pine", x: 280, y: 108 }, { kind: "tree", x: 296, y: 118 },
  // Bottom edge
  { kind: "tree", x: 4, y: 160 }, { kind: "pine", x: 196, y: 156 }, { kind: "tree", x: 214, y: 162 },
];

// Draws one complete frame of the village.
function drawVillage() {
  const ctx = villageCtx;
  ctx.drawImage(groundCanvas, 0, 0);

  // Objects are sorted by their bottom edge so things lower on the
  // screen are drawn on top (this fakes depth in a top-down view).
  const L = VILLAGE_LAYOUT;
  const objects = [
    { bottom: L.townHall.y + 31, draw: () => drawTownHall(ctx, L.townHall.x, L.townHall.y) },
    { bottom: L.well.y + 11, draw: () => drawWell(ctx, L.well.x, L.well.y) },
    { bottom: L.campfire.y + 6, draw: () => drawCampfire(ctx, L.campfire.x, L.campfire.y) },
  ];
  if (state.buildings.farm.count > 0) {
    objects.push({ bottom: L.farm.y + 40, draw: () => drawFarm(ctx, L.farm.x, L.farm.y) });
  }
  if (state.buildings.lumberMill.count > 0) {
    objects.push({ bottom: L.lumberMill.y + 34, draw: () => drawLumberMill(ctx, L.lumberMill.x, L.lumberMill.y) });
  }
  if (state.buildings.quarry.count > 0) {
    objects.push({ bottom: L.quarry.y + 24, draw: () => drawQuarry(ctx, L.quarry.x, L.quarry.y) });
  }
  if (state.buildings.market.count > 0) {
    objects.push({ bottom: L.market.y + 21, draw: () => drawMarket(ctx, L.market.x, L.market.y) });
  }
  for (const hut of L.huts) {
    objects.push({ bottom: hut.y + 17, draw: () => drawHut(ctx, hut.x, hut.y) });
  }
  for (const t of TREE_SPOTS) {
    const height = t.kind === "pine" ? 18 : 16;
    const fn = t.kind === "pine" ? drawPine : drawTree;
    objects.push({ bottom: t.y + height, draw: () => fn(ctx, t.x, t.y) });
  }

  objects.sort((a, b) => a.bottom - b.bottom);
  for (const obj of objects) obj.draw();
}

// Scales the 320x180 canvas to fit its frame.
// Whole-number scales (2x, 3x, 4x...) keep every pixel the same size.
// On very narrow screens we fall back to an exact fit.
function resizeVillageCanvas() {
  const screen = document.getElementById("screen-village");
  const sideBySide = window.innerWidth > 860;        // matches style.css
  // On wide screens, reserve room for the building panel (280px + gap).
  const panelSpace = sideBySide ? 288 : 0;
  const frameBorder = 16;                            // frame border + padding
  const availableWidth = screen.clientWidth - panelSpace - frameBorder;
  // On wide screens also fit the height, leaving room for the bars.
  const availableHeight = sideBySide ? Math.max(180, window.innerHeight - 220) : Infinity;

  let scale = Math.min(availableWidth / VIEW_WIDTH, availableHeight / VIEW_HEIGHT);
  if (scale >= 1) scale = Math.floor(scale);         // whole numbers = even pixels

  villageCanvas.style.width = Math.floor(VIEW_WIDTH * scale) + "px";
  villageCanvas.style.height = Math.floor(VIEW_HEIGHT * scale) + "px";
}

// The drawing loop. requestAnimationFrame pauses in hidden tabs,
// which is fine: drawing is only visual. Resources are handled by
// the time-based game loop in section 4.
function renderLoop() {
  drawVillage();
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
  paintGround();

  // Build the interface
  buildResourceBar();
  buildBuildingPanel();
  setupNavigation();
  resizeVillageCanvas();
  window.addEventListener("resize", resizeVillageCanvas);

  // Start the loops
  state.lastUpdate = Date.now();
  gameTick();
  setInterval(gameTick, LOGIC_INTERVAL_MS);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  requestAnimationFrame(renderLoop);
}

// Wait until the HTML is ready, then start.
document.addEventListener("DOMContentLoaded", initGame);
