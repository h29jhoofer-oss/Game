# Rampart Rush

A real-time, lane-based fantasy strategy card game. Deploy troops, buildings and spells,
manage your elixir, and tear down the enemy's towers before they tear down yours.

Everything is original: all characters, artwork (procedurally drawn vector sprites),
UI, music and sound effects (synthesized live with WebAudio) are built from code, so the
game has **no external assets and no dependencies**.

## Play

Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari). No build step and no server are needed.

If your browser blocks local files for some reason, serve the folder instead:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

**Controls**
- Drag a card from your hand onto your half of the arena, or tap a card and then tap the battlefield.
- Number keys `1`–`4` select a card; `Esc` deselects.
- Spells can be cast anywhere. Destroying an enemy Princess Tower opens a deeper deploy "pocket" on that side.

## Features

- **Real-time battles**: 18×32 tile arena, a river, two bridges, two Princess Towers and a King Tower per side.
  Troops path over the bridges, pick targets automatically, collide, and fight. Towers defend automatically.
  The King Tower wakes up when it is hit or a Princess Tower falls.
- **Match flow**: 3-minute match, double elixir in the final minute, then 1 minute of sudden-death overtime
  (triple elixir). If it's still tied, the side whose weakest tower has more health wins. Destroying the
  King Tower wins instantly.
- **Elixir**: max 10, regenerates over time, and cards cost 1–8.
- **33 collectible cards** (+1 token unit) across troops, buildings and spells, each with its own mechanics:
  splash, 360° spin attacks, chain lightning with stun, charge attacks, river jumping, burrowing to anywhere,
  spawners, healers, speed auras, death explosions, splitting on death, ramping beams, invisible traps,
  elixir generation, knockback, slow, rage, and a rolling wind wave.
- **Deck building**: 3 deck slots of 8 cards, average elixir display, full stat sheets, card upgrades (levels 1–10).
- **AI opponent**: three difficulties. It analyses threats per lane, scores counters, values spells by what
  they would kill, defends with buildings and pulls, builds pushes around win conditions, supports
  counter-attacks, finishes low towers with spells, manages elixir, and uses one of 6 deck archetypes.
- **Progression**: trophies and 6 arenas (each with its own look and new cards), gold, gems, XP and king levels
  (stronger towers), chests with unlock timers, a crown chest, 16 achievements, a 7-day login streak, and a daily shop.
- **Audio**: synthesized SFX for deploys, swords, arrows, spells, explosions and towers, plus marching footsteps,
  two music tracks (the battle track speeds up in double elixir), and volume settings.

## Project structure

```
index.html              Shell + script load order
css/style.css           All UI styling
js/core/util.js         Math, colour, RNG and DOM helpers (RR.U)
js/data/cards.js        Card definitions, rarities, upgrade tables, tower stats
js/data/arenas.js       Arena progression + battlefield themes
js/audio/audio.js       WebAudio SFX synthesizer + music sequencer
js/render/sprites.js    Procedural cartoon sprites for every unit, building, tower and spell icon
js/render/cardart.js    Card portrait renderer (cached)
js/battle/map.js        Arena geometry, river/bridge routing, deploy rules
js/battle/entities.js   Troops, buildings, towers, projectiles: targeting, movement, attacks, abilities
js/battle/spells.js     Spell zones (meteor, arrows, frost, gale, ...) + their visuals
js/battle/effects.js    Particles, shockwaves, lightning, damage numbers, screen shake
js/battle/battle.js     Battle state machine: clock, elixir, damage, deaths, crowns, victory
js/battle/renderer.js   Battlefield renderer (pre-rendered arena + depth-sorted entities)
js/ai/ai.js             AI opponent + archetype deck builder
js/progression/profile.js  Save data, chests, upgrades, achievements, daily rewards, shop
js/ui/components.js     Cards, chests, modals, toasts, chest-opening sequence
js/ui/menus.js          Home, Cards (deck builder), Shop, Quests, Profile/Settings
js/ui/battle-ui.js      Hand, drag/tap deploy, HUD, banners, end screen
js/main.js              Bootstrap + main loop
tests/sim.html          Headless harness: runSims() AI-vs-AI matches, runMechanics() ability checks
tests/run-tests.js      Playwright runner for both (node tests/run-tests.js)
```

Progress is saved in `localStorage`. Use **Profile → Reset Progress** to start over.
