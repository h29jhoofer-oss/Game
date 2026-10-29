# NEON SURVIVOR

A pixel-art arcade survival game built with plain HTML, CSS, and JavaScript. It has no frameworks and nothing to install.

**Current progress: Stage 4, progression.** Energy fills your experience bar. Each level-up freezes the game and offers three random upgrade cards. Your score grows as you survive and defeat enemies, and the arena gets steadily harder, with periodic swarm surges.

## How to run it

**Option A: just open the file**

Double-click `index.html`, or drag it into Chrome, Firefox, or Edge.

**Option B: run a tiny local web server** (closer to how a real website behaves)

If you have Python installed, open a terminal in this folder and run:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000> in your browser.

## Controls

| Key | Action |
| --- | --- |
| W A S D / Arrow keys | Move |
| SPACE | Dash (short cooldown, shown by the DASH meter) |
| ESC | Pause / resume |
| ENTER or R | Restart from the game-over screen (or click RESTART) |
| 1 / 2 / 3 | Pick an upgrade card |
| ← → (or A D) then ENTER / SPACE | Choose a card with the keyboard (or hover and click with the mouse) |
| G | Toggle debug info (FPS, scale, position) |

## Stage 4 test checklist

1. **Experience bar:** the yellow bar next to `LV1` fills as you collect orbs. You need 5 energy for level 2, then 9, 13, 17… (4 more each time).
2. **Level-up freeze:** when the bar fills, a ring flashes around you and **everything stops**: enemies, shots, orbs, the timer, even the floor lights. "LEVEL UP!" appears and three cards rise in one after another.
3. **Choosing:** for the first 0.6 seconds the cards ignore input, so mashing SPACE can't pick one by accident. Then:
   - **1, 2, 3** pick a card right away
   - **← →** move the yellow highlight (the card lifts up and an arrow blinks above it), and **ENTER** or **SPACE** confirms
   - with the mouse, hover highlights a card and a click picks it

   The chosen card flashes white and the others go dark.
4. **Upgrades work:** press **G** and watch `FIRE`, `DMG`, and `PIERCE` change after taking Rapid Fire, Heavy Shots, or Piercing. Speed Boost makes you visibly faster. Magnet pulls orbs from farther away. Extra Health refills a heart.
5. **Card details:** each card shows `NEW!` or `LV 1 > 2`, plus pips for how many times it can be taken. Maxed upgrades stop appearing. Extra Health only appears when you're missing a heart.
6. **Double level-up:** if one pickup fills the bar twice, a second set of cards appears right after the first.
7. **Safety after choosing:** you blink for about half a second after picking, so a slime that crept close can't hit you instantly.
8. **Score:** the 7-digit score in the top-right goes up by 10 per second alive and 25 per slime defeated.
9. **Swarm surges:** at about 45 seconds, "SWARM INCOMING!" flashes and a ring of warning markers surrounds you. Dash out before it closes. Surges repeat every 40–55 seconds and get bigger each minute.
10. **Results:** the game-over panel now shows score, time, slimes defeated, and level.

## Stage 3 test checklist

1. **Auto-fire:** when a slime gets within range, the blaster fires a small cyan bolt at the *nearest* one about every 0.6 seconds. You'll see a tiny white flash at the muzzle. With no slime in range, it doesn't fire.
2. **Enemy damage:** a slime takes two hits. The first makes it flash white and knocks it back. The second makes it explode in a ring of pixels and chunky sparks, with a one-pixel screen bump.
3. **Energy orbs:** each defeated slime drops a bobbing yellow orb. Walk near one and it gets pulled in, sparkles, and the counter next to your hearts goes up.
4. **Orb timeout:** orbs you leave alone start blinking after 15 seconds and vanish at 18.
5. **Missed shots:** bolts that reach a wall fizzle with a small spark.
6. **Standing still loses:** groups of 2–3 slimes start appearing over time, so you can't win by standing in the middle. Move, kite, and grab orbs.
7. **Death:** your final hit makes a big cyan explosion. The results show time survived, slimes defeated, and energy collected.
8. **Debug (G):** shows live counts of shots, orbs, and particles. Leave the game running for a while and confirm the numbers go up and down rather than growing forever.

## Stage 2 test checklist

1. **Warning markers:** blinking red brackets appear near the walls about 0.7 seconds before each slime arrives. Slimes never appear right next to you.
2. **Chasers:** red slimes bounce toward you and spread out instead of stacking into one blob.
3. **Getting hit:** touching a slime flashes you white, removes a heart, shakes the screen, and knocks the slime back. For one second you blink and can't be hurt again.
4. **Dash through enemies:** you can't be hurt while dashing, so SPACE lets you slip through a gap.
5. **Difficulty:** slimes appear more often and move faster the longer you survive. Press **G** to watch `SPAWN EVERY` shrink over time.
6. **Game over:** after the last heart, you flicker and vanish, then the GAME OVER panel opens. It shows your survival time and a message.
7. **Restart:** click RESTART (the cursor turns into a hand) or press ENTER / R. Hearts, timer, and enemies all reset.
8. **Pause:** ESC still freezes everything, including the timer.

## Stage 1 test checklist

1. **Crisp pixels:** resize the browser window and zoom in and out (Ctrl + / Ctrl -). The game should snap to a bigger or smaller size, and every pixel should stay a sharp square. Press **G** to see the current scale (2X, 3X, 4X…).
2. **Movement:** hold W, A, S, D, or the arrow keys. The character walks with a stepping animation and faces left or right.
3. **Diagonal speed:** press G and hold two keys, such as W and D. `SPEED` should show about 80, the same as moving straight.
4. **Walls:** walk into every wall and corner. The player should never leave the arena.
5. **Dash:** press SPACE while moving. You zip forward with an after-image trail, and the DASH bar refills over about one second.
6. **Idle animation:** stand still. The character breathes and sometimes blinks.
7. **Pause:** press ESC. Everything freezes behind a pixel "PAUSED" panel. Press ESC again to resume. The game also pauses by itself when you click into another window.
8. **No page scrolling:** SPACE and the arrow keys should never scroll the page.

## How the code is organized

The scripts in `js/` load in this order. Each file has one job:

| File | What it does |
| --- | --- |
| `config.js` | All the tunable numbers (sizes, speeds) and the color palette. Start here if you want to tweak things. |
| `utils.js` | Small helpers: `clamp`, random numbers, off-screen canvases. |
| `input.js` | Remembers which keys are held and which were just pressed. It blocks page scrolling for game keys only. |
| `font.js` | A hand-made 3×5 pixel font, because normal fonts are smooth and look wrong in pixel art. |
| `sprites.js` | Pixel art written as text grids (`'.'` = empty, letters = colors). Each grid is "baked" once into a small canvas. |
| `arena.js` | Draws the space background, floor tiles, and walls once, then animates the glowing tiles and stars. |
| `effects.js` | Particles and pixel shockwave rings. Purely visual, with a hard cap on how many can exist. |
| `projectiles.js` | The `Weapon` (auto-aim, fire rate, damage, all in a `stats` object that upgrades will change) and the `Projectile` bolts. |
| `orbs.js` | Energy orbs: popping out, the magnet pull, collection, and the timeout. |
| `player.js` | The `Player` class: movement, diagonal normalization, wall collision, dash, health, invulnerability, and animation frames. |
| `enemies.js` | The shared `Enemy` class, the `Chaser`, enemy separation, and circle collision. |
| `spawner.js` | Decides when and where enemies appear and shows warning markers. It also controls the difficulty ramp. |
| `upgrades.js` | The list of upgrades: name, description, pixel icon, maximum level, and what each one does. Add a new upgrade by adding one entry. |
| `levelup.js` | The level-up screen: picking three random cards, keyboard and mouse selection, and the card animations. |
| `game.js` | The game loop, game states (playing, paused, dying, game over), collisions, screen shake, HUD, and menus. |
| `main.js` | Starts everything and scales the canvas. |

### Key ideas

- **Low resolution, scaled up.** The game is drawn on a 320×180 canvas. `main.js` enlarges it by a *whole number* (×2, ×3, ×4…), measured in real screen pixels. CSS `image-rendering: pixelated` makes the browser copy pixels as hard squares instead of blurring them.
- **Delta time (`dt`).** Every frame, the loop measures how many seconds have passed. Movement is `speed × dt`, so the game runs at the same speed on 60 Hz and 144 Hz screens. `dt` is capped so a frozen tab doesn't make the player teleport.
- **Decimal positions, whole-pixel drawing.** The player's position keeps its decimals for smooth movement. When drawing, it's rounded with `Math.round`, so sprites always sit exactly on the pixel grid.
- **One game loop only.** `Game.start()` won't start a second loop if one is already running. Two loops would make the game run at double speed.
- **Game states.** The game is always in exactly one state: `playing`, `paused`, `dying`, or `gameover`. `update()` checks the state and only runs the code for it, which keeps pausing and restarting reliable.
- **Circle hitboxes.** Collisions compare the distance between two centers with the sum of their radii. Hitboxes are slightly smaller than the sprites, so near-misses feel fair.
- **Enemy inheritance.** `Chaser extends Enemy`, so it only has to say *where it wants to go* (`think()`). Movement, knockback, and drawing are shared. New enemy types will reuse all of that.
- **Cleaning up.** Shots, orbs, particles, and enemies each get a `dead`, `collected`, or age flag. At the end of every frame, the game filters finished items out of their lists, so memory never piles up. Each list also has a maximum size in `config.js`.
- **Upgrade-ready weapon.** Every number the blaster uses lives in `weapon.stats`. A future "Rapid Fire" upgrade only needs to do `weapon.stats.fireInterval *= 0.85`.
- **Data-driven upgrades.** Each upgrade is a small object with an `apply(game)` function, for example `game.weapon.stats.damage += 1`. The level-up screen doesn't know what any upgrade does. It just shows the card and calls `apply`.
- **A difficulty curve you can tune.** Spawn rate, enemy speed, enemy health (+1 every 100 s), pack chance, and swarm surges all depend on survival time, and every number is in `config.js`.
- **No blur effects.** Glows change through a few fixed palette colors in steps, and the pause overlay is a checkerboard "dither". There are no gradients or soft shadows.

### Drawing your own sprite

Open `js/sprites.js` and edit a grid in `PLAYER_SPRITE_DATA`. Each letter is a color from `PLAYER_COLORS`:

```
'..kkkk..',   k = dark outline
'.kcccck.',   c = cyan
'kcccwcwk',   w = white (eyes)
```

Save the file and refresh the browser to see the change.
