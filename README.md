# NEON SURVIVOR

A pixel-art arcade survival game built with plain HTML, CSS, and JavaScript. It has no frameworks, no images, no audio files, and nothing to install. Every sprite is drawn from text grids and every sound is synthesized in code.

You're a tiny neon hero trapped in an arena. Your blaster fires on its own, so your job is to **move**: dodge slimes, drones, and brutes, grab the energy they drop, pick upgrades as you level up, and survive as long as you can.

## How to run it

**Option A: just open the file**

Double-click `index.html`, or drag it into Chrome, Firefox, or Edge.

**Option B: run a tiny local web server** (closer to how a real website behaves, and the most reliable way to save your best score)

If you have Python installed, open a terminal in this folder and run:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000> in your browser.

## Controls

**Touchscreen (phones and tablets, best in landscape):** drag on the left side of the screen to move (a joystick appears under your thumb), and tap the right side to dash. Tap menus, cards and buttons directly. The touch controls only appear once you touch the screen.

**Keyboard and mouse:**

| Key | Action |
| --- | --- |
| W A S D / Arrow keys | Move |
| SPACE | Dash (you can't be hurt while dashing) |
| ESC | Pause menu, or back to the title from the results |
| M | Mute or unmute sound |
| ENTER | Start, confirm menu choices, restart after game over |
| R | Restart from the results screen |
| 1 / 2 / 3 | Pick an upgrade card |
| G | Debug info (FPS, scale, enemy counts, weapon stats) |

The mouse works everywhere too: the PLAY button, menu buttons, upgrade cards, and the sound and pause icons in the bottom-right corner while playing.

## How to play

- **Survive.** You earn 10 points every second you're alive.
- **Defeat enemies.** Your blaster auto-aims at the nearest enemy in range. Chasers are worth 25 points, Toxic Slimes 30, Sprinters 40, Shooters 50, Brutes 120, and the boss 1000 per level.
- **Grab hearts.** Defeated monsters sometimes drop a heart: Chasers 5% of the time, Toxic Slimes 7.5%, Shooters 10%, Brutes 15%. Every heart you lose adds +5% to all of these for the rest of the run, up to a cap of 25%. While your hearts are full, every chance is halved. A dropped heart **disappears after 10 seconds** (it blinks for the last 3), and the magnet pulls it in like energy. While your hearts are full, dropped hearts stay where they are.
- **Collect energy.** Yellow orbs fill your experience bar. A full bar is a **level-up**: the game freezes and you choose one of three random upgrades.
- **Watch for warnings.** Blinking brackets show where enemies will appear (red for Chaser, green for Toxic Slime, purple for Shooter, orange for Brute). A Shooter's eye glows pink right before it fires. "SWARM INCOMING!" means a ring of enemies is about to surround you, so dash out.
- **Beat your best.** Your top score is saved in the browser and shown on the title screen.

### Heroes

After pressing PLAY you choose a hero with ← → and ENTER, keys 1–3, or the mouse. Your choice is remembered, and restarting keeps the same hero.

| Hero | Speed | Damage | Range | Hearts (start / max) | Dash perk |
| --- | --- | --- | --- | --- | --- |
| **Runner** (blue) | ×1 | ×1 | ×1 | 3 / 4 | — |
| **Brute** (orange) | ×0.75 | ×1.5 | ×1 | 3 / 5 | Rams: dashing into a monster deals 4 damage and knocks it back (once per monster per dash) |
| **Speeder** (purple) | ×1.75 | ×1 | ×1.5 | 3 / 3 | Dashes twice as far (twice as fast, so the untouchable moment stays the same length) |

The multipliers keep working on top of upgrades: the Brute's Heavy Shots hit for (1 + 1) × 1.5 = 3.

### Enemies

| Enemy | Appears | Behavior |
| --- | --- | --- |
| **Chaser** (red slime) | From the start | Hops straight at you. Comes in packs later on. |
| **Toxic Slime** (green slime) | After ~25 s | Hops at you like a Chaser with 3/4 of its health. When defeated it bursts into a **poison gas cloud** that stays for about 10 seconds. Touching the gas costs a heart, but it is harmless for the first half-second while it puffs up, and dashing or a shield protects you as usual. |
| **Sprinter** (yellow) | After ~60 s | Tiny and fragile (1 hit), but always **1.25× faster than you**. It checks your speed constantly, so you can't outrun it, even with Speed Boost. Shoot it or dash past it. |
| **Shooter** (purple drone) | After ~40 s | Keeps its distance, circles you, and fires slow pink shots. |
| **Brute** (orange monster) | After ~90 s | Slow, huge, very tough, and barely flinches when shot. |
| **King Slime** (boss) | Every 90 s | A crowned Chaser at **4× the size**. Moves at 0.75× a Chaser's speed, and touching it costs **2 hearts**. It gets a 2-second warning and appears on the far side of the arena. **It comes back every 90 seconds, stronger each time:** 60 health, then 90, 120… and 10% faster per return, with bigger rewards (1000 points × its level). Its health bar shows its level. If one is still alive, the next waits until it's defeated (and always at least 45 s). |

All enemies gain health every 100 seconds, and spawns speed up over time.

### Weapons

Every run starts with the **Blaster**. Any defeated monster has a **0.5% chance** to drop the **Shotgun**, the **Sniper** or the **SMG** (one you don't have yet). A dropped gun sits on the floor inside a pulsing ring until you pick it up, and it never disappears. **All the guns you own fire at the same time**, and the bottom bar shows which ones you have.

| Gun | Damage | Fire rate | Range | How it aims |
| --- | --- | --- | --- | --- |
| **Blaster** (cyan) | ×1 | ×1 | medium | At the nearest enemy |
| **Shotgun** (orange) | ×2 per pellet, 4 pellets | ×0.5 | short (pellets vanish close to you) | The way you're moving, whenever an enemy is close |
| **SMG** (purple) | ×0.5 per bullet (small purple bullets) | ×2 | medium | At the nearest enemy |
| **Sniper** (green) | ×1.5 | ×0.75 | long | At a Shooter if there is one, otherwise the farthest enemy. Bullets curve slightly toward their target. |

Hero and gun multipliers stack: a Brute hero's Shotgun pellets hit for 1 × 1.5 × 2 = 3.

### Upgrades

**For every gun you own** (a gun you pick up later catches up on the Rapid Fire and Heavy Shots you already have):

| Upgrade | Effect | Max |
| --- | --- | --- |
| Rapid Fire | Shoot 15% faster | 5 |
| Heavy Shots | +1 damage per shot | 4 |
| Speed Boost | Move 10% faster | 4 |
| Magnet | Pull energy from farther away | 4 |
| Shield | Blocks one hit, then recharges (faster each level) | 3 |

**Blaster only:**

| Upgrade | Effect | Max |
| --- | --- | --- |
| Piercing | Shots pass through +1 enemy | 3 |
| Multi-Shot | +1 bolt per shot, fanned out to cover a wider area | 3 |
| Twin Shot | +1 bolt fired right behind the first, in a line at the same target | 2 |

**Shotgun only** (offered once you've picked up the Shotgun):

| Upgrade | Effect | Max |
| --- | --- | --- |
| Extra Pellets | +2 pellets every blast | 3 |
| Long Barrel | Pellets fly 25% farther | 3 |
| Stopping Power | Blasts knock enemies much farther back | 2 |

**SMG only** (offered once you've picked up the SMG):

| Upgrade | Effect | Max |
| --- | --- | --- |
| Bullet Hose | SMG fires 20% faster | 3 |
| Hollow Points | SMG bullets hit 50% harder | 3 |
| Spray | +1 SMG bullet in a tight fan | 2 |

**Sniper only** (offered once you've picked up the Sniper):

| Upgrade | Effect | Max |
| --- | --- | --- |
| Seeker Rounds | Bullets curve harder toward their target | 3 |
| Penetrator | Bullets pierce +1 enemy | 3 |
| Critical Hit | 25% chance of triple damage (shows "CRIT!") | 2 |

## Final test checklist

1. **Title screen:** the logo drops in and a shine sweeps across it every few seconds. Four characters animate in a row, PLAY pulses, and your best score is shown (or "NO BEST SCORE YET").
2. **Start:** press ENTER or SPACE, or click PLAY. Dark squares wipe across the screen and the game begins.
3. **Sound:** after your first key press or click you'll hear sounds for:
   - shooting, hits, and enemy explosions
   - orb pickups, whose pitch climbs while you grab them quickly
   - dashing, level-ups, getting hurt, shield blocks, the swarm alarm, and the game-over jingle

   M, the speaker icon, or the pause menu toggles sound. The mute setting is remembered.
4. **Pause menu:** ESC or the pause icon opens it. Use ↑ ↓ (or W S) to choose and ENTER to confirm, or use the mouse. The options are Resume, Restart, Sound on/off, and Quit to title. ESC also resumes. The game also pauses by itself when you switch windows.
5. **Results:** GAME OVER shows score, time, enemies defeated, level, your best, and a message. Beating your record shows a flashing **NEW BEST!** badge with a fanfare.
6. **Quick restart:** ENTER or R restarts immediately. ESC (or MENU) goes back to the title.
7. **Best score persists:** refresh the page and your best is still on the title screen. Restarting never erases it.
8. **Crisp pixels:** resize the window or zoom the browser. The game always scales by a whole number and never blurs.

## How the code is organized

The scripts in `js/` load in this order. Each file has one job:

| File | What it does |
| --- | --- |
| `config.js` | All the tunable numbers (speeds, health, spawn rates, upgrade values) and the color palette. **Start here to tweak the game.** |
| `utils.js` | Small helpers: `clamp`, random numbers, off-screen canvases. |
| `storage.js` | Saves and loads the personal best and the mute setting with `localStorage`. |
| `audio.js` | Synthesized retro sounds. Each sound is a short "recipe" of beeps and noise. |
| `touch.js` | Touchscreen controls: the drag joystick, tap-to-dash, bigger tap areas for the small HUD icons, and drawing them. |
| `input.js` | Remembers which keys are held and which were just pressed. Blocks page scrolling for game keys only. |
| `guns.js` | The three guns: how each aims, how its bullets look, and its stats. Add a gun by adding one entry; it automatically becomes a possible drop. |
| `characters.js` | The playable heroes: name, colors, and stat multipliers. Add a hero by adding one entry. |
| `font.js` | A hand-made 3×5 pixel font. |
| `sprites.js` | All character pixel art, written as text grids and baked into tiny canvases at startup. |
| `arena.js` | The background, floor tiles, walls, glowing tiles, and stars. |
| `effects.js` | Particles, shockwave rings, and floating text. |
| `player.js` | Movement, dash, health, shield, and animation. |
| `projectiles.js` | The `Weapon` class (one per gun you own) and its bullets, including the Sniper's homing. |
| `orbs.js` | Energy orbs and the magnet pull. |
| `enemies.js` | The `Enemy` base class, `Chaser`, `ToxicSlime`, `Sprinter`, `Shooter`, `Brute`, the `Boss`, and enemy shots. |
| `hazards.js` | The Toxic Slime's gas cloud: its shape, three life phases (forming, active, fading), collision, and dithered drawing. |
| `spawner.js` | When, where, and which enemies appear, plus swarm surges and banners. |
| `upgrades.js` | The list of upgrades. Weapon upgrades describe how they change one gun's stats (`improveWeapon`), and one with a `weapons` list only appears once you own those guns. |
| `levelup.js` | The level-up card screen. |
| `ui.js` | Shared interface pieces: panels, bars, buttons, icons. |
| `transition.js` | The pixel wipe between screens. |
| `screens.js` | The title screen (with its big logo), the hero select screen, the pause menu, and the results screen. |
| `game.js` | The game loop, game states, combat, collisions, and HUD. It ties everything together. |
| `main.js` | Starts everything and scales the canvas. |

### Key ideas

- **Low resolution, scaled up.** The game is drawn on a 320×180 canvas. `main.js` enlarges it by a *whole number* (×2, ×3, ×4…), measured in real screen pixels. CSS `image-rendering: pixelated` makes the browser copy pixels as hard squares instead of blurring them.
- **Delta time (`dt`).** Every frame, the loop measures how many seconds have passed. Movement is `speed × dt`, so the game runs at the same speed on 60 Hz and 144 Hz screens. `dt` is capped so a frozen tab doesn't cause a jump.
- **Decimal positions, whole-pixel drawing.** Positions keep their decimals for smooth movement but are rounded with `Math.round` when drawn, so sprites always sit exactly on the pixel grid.
- **One game loop only.** `Game.start()` refuses to start a second loop.
- **Game states.** The game is always in exactly one state: `title`, `select`, `playing`, `paused`, `levelup`, `dying`, or `gameover`. `update()` runs only the code for that state. That's what makes pausing, level-ups, and restarting reliable.
- **Cleaning up.** Shots, orbs, particles, and enemies are flagged when finished and filtered out every frame. Each list also has a maximum size, so memory never piles up.
- **Inheritance for enemies.** `Chaser`, `Shooter`, and `Brute` all `extend Enemy`, and `ToxicSlime` extends `Chaser`, so it reuses all of the Chaser's movement and only changes its look, numbers, and what happens when it dies. Each only describes what makes it different, like where it wants to go (`think()`) or shooting.
- **Data-driven upgrades.** Each upgrade is a small object with an `apply(game)` function. Add a new one by adding one entry to the list in `upgrades.js`.
- **Weighted random spawns.** Each enemy type has a weight that grows with time. Picking a spawn is like drawing from a bag of tickets, so every run is different.
- **Telegraphs.** Every danger warns you first: spawn markers, the Shooter's pink charge-up, and the swarm banner. Hard but fair means you can always react.
- **Sound without files.** The Web Audio API creates waves and noise and shapes their pitch and volume, just like old arcade hardware. Browsers only allow sound after the player interacts, so audio starts on the first key press or click.
- **Saving safely.** `localStorage` can be unavailable (private windows, for example), so every read and write is wrapped in `try/catch`. The game works fine without it; it just won't remember your best.
- **Ordered dithering.** The gas cloud fades by drawing fewer pixels in a fixed 4×4 pattern (a "Bayer matrix") instead of becoming see-through. It's the same trick old consoles used, and it keeps every pixel crisp.
- **No blur effects.** Glows step through palette colors, overlays use a checkerboard "dither", and every effect lands on whole pixels.

### Ideas for changing the game

- **Make it easier or harder:** change `SPAWN_CONFIG`, `CHASER_CONFIG`, and the other values in `config.js`.
- **Redraw a character:** edit its grid in `sprites.js`. Each letter is a color from that sprite's color key. Every row must have the same length (the game shows an error if not).
- **Add an upgrade:** copy an entry in `upgrades.js` and change its name, icon, and `apply`.
- **Change a sound:** tweak a recipe in `audio.js`. Try different `type` values (`square`, `triangle`, `sawtooth`) or frequencies.

## Embedding in another website

Everything lives inside `#game-container`. Keyboard input ignores text boxes elsewhere on the page and only blocks scrolling for the game's own keys. To embed it, copy the container, the stylesheet, and the scripts into your page, and give the container a fixed size (for example `width: 960px; height: 540px`).
