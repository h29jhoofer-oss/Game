# NEON SURVIVOR

A pixel-art arcade survival game built with plain HTML, CSS, and JavaScript. It has no frameworks and nothing to install.

**Current progress: Stage 1, the pixel-art foundation.** You can walk and dash around a neon arena. Enemies come in Stage 2.

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
| G | Toggle debug info (FPS, scale, position) |

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
| `player.js` | The `Player` class: movement, diagonal normalization, wall collision, dash, and animation frames. |
| `game.js` | The game loop, game state (playing or paused), the HUD, and the pause screen. |
| `main.js` | Starts everything and scales the canvas. |

### Key ideas

- **Low resolution, scaled up.** The game is drawn on a 320×180 canvas. `main.js` enlarges it by a *whole number* (×2, ×3, ×4…), measured in real screen pixels. CSS `image-rendering: pixelated` makes the browser copy pixels as hard squares instead of blurring them.
- **Delta time (`dt`).** Every frame, the loop measures how many seconds have passed. Movement is `speed × dt`, so the game runs at the same speed on 60 Hz and 144 Hz screens. `dt` is capped so a frozen tab doesn't make the player teleport.
- **Decimal positions, whole-pixel drawing.** The player's position keeps its decimals for smooth movement. When drawing, it's rounded with `Math.round`, so sprites always sit exactly on the pixel grid.
- **One game loop only.** `Game.start()` won't start a second loop if one is already running. Two loops would make the game run at double speed.
- **No blur effects.** Glows change through a few fixed palette colors in steps, and the pause overlay is a checkerboard "dither". There are no gradients or soft shadows.

### Drawing your own sprite

Open `js/sprites.js` and edit a grid in `PLAYER_SPRITE_DATA`. Each letter is a color from `PLAYER_COLORS`:

```
'..kkkk..',   k = dark outline
'.kcccck.',   c = cyan
'kcccwcwk',   w = white (eyes)
```

Save the file and refresh the browser to see the change.
