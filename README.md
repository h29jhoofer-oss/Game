# NEON SURVIVOR

A pixel-art arcade survival game built with plain HTML, CSS, and JavaScript. It has no frameworks and nothing to install.

**Current progress: Stage 2, basic survival.** Red slimes hunt you down and you have three hearts. You can't fight back yet (shooting comes in Stage 3), so for now the goal is to dodge for as long as you can.

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
| G | Toggle debug info (FPS, scale, position) |

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
| `player.js` | The `Player` class: movement, diagonal normalization, wall collision, dash, health, invulnerability, and animation frames. |
| `enemies.js` | The shared `Enemy` class, the `Chaser`, enemy separation, and circle collision. |
| `spawner.js` | Decides when and where enemies appear and shows warning markers. It also controls the difficulty ramp. |
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
- **No blur effects.** Glows change through a few fixed palette colors in steps, and the pause overlay is a checkerboard "dither". There are no gradients or soft shadows.

### Drawing your own sprite

Open `js/sprites.js` and edit a grid in `PLAYER_SPRITE_DATA`. Each letter is a color from `PLAYER_COLORS`:

```
'..kkkk..',   k = dark outline
'.kcccck.',   c = cyan
'kcccwcwk',   w = white (eyes)
```

Save the file and refresh the browser to see the change.
