# One More Jump

A tiny pixel-art endless runner for the browser. Your little blob runs on its own — you just
jump over spikes, crates, gaps and tall barriers for as long as you can.

Plain HTML, CSS and JavaScript. No libraries, no build step, nothing to install.

## Play it

Open `index.html` in a desktop browser (Chrome, Firefox, Edge or Safari). That's it.

If your browser blocks something when opening the file directly, run a tiny local server
from this folder instead and open <http://localhost:8000>:

```bash
python3 -m http.server 8000
```

## Controls

| Key | Action |
| --- | --- |
| `SPACE`, `↑`, `W`, mouse click | Jump |
| `ESC` or `P` | Pause / resume |
| `R` | Restart after a crash |
| `M` | Mute / unmute |
| `←` / `→` (start screen) | Change skin |
| `H` | Show hitboxes (for debugging) |

## Project layout

Scripts load in this order (see the bottom of `index.html`). Each file has a short comment at
the top saying what it does.

| File | What's inside |
| --- | --- |
| `index.html` | The page: canvas, menus, script tags |
| `css/style.css` | Menu and button styles (all classes start with `omj-`) |
| `js/config.js` | **Every gameplay number** — gravity, jump, speed, spacing, scoring |
| `js/physics.js` | Jump math (air time, height) used to keep obstacles fair, plus small random helpers |
| `js/storage.js` | Saves best score, skin and mute setting in `localStorage` |
| `js/sprites.js` | Turns text "pictures" into pixel art; the color palette |
| `js/font.js` | The tiny pixel font used for the score and titles |
| `js/skins.js` | Unlockable character colors |
| `js/messages.js` | The funny game-over lines |
| `js/audio.js` | Sound effects, synthesized with the Web Audio API (no sound files) |
| `js/player.js` | The player: jumping, gravity, landing, and how it's drawn |
| `js/obstacles.js` | Obstacle types (spike, crate, barrier, gap) and the obstacle pool |
| `js/spawner.js` | Obstacle patterns and when they appear |
| `js/particles.js` | Dust and sparkle particles |
| `js/background.js` | Parallax sky, mountains, hills, town, ground; day/sunset/night themes |
| `js/input.js` | Keyboard and mouse |
| `js/ui.js` | Start, pause and game-over screens; resizing |
| `js/game.js` | The main game: states, game loop, collisions, scoring, drawing |

## How it works (the short version)

- **Game loop:** `requestAnimationFrame` calls `Game.frame()` once per screen refresh.
  Each frame's time is split into small steps of at most 1/120 s (`Game.step()`), and movement
  uses exact formulas, so jumps, speed and score are the same at 30, 60 or 144 FPS.
- **States:** `menu → playing ⇄ paused → dying → over → playing…`. Each state has its own
  update function in `game.js`.
- **Pixel art:** everything is drawn on a 384×216 canvas, then scaled up with
  `image-rendering: pixelated`. When the window is big enough the scale is a whole number,
  so every pixel is the same size.
- **Fairness:** before each pattern, `spawner.js` leaves at least *one full jump + reaction
  time* of empty ground, based on the current speed. Patterns that need one long jump check
  their width against `OMJ.Physics.clearDistance()`.
- **No garbage while playing:** obstacles and particles come from fixed pools that get
  re-used, so the browser doesn't stutter cleaning up memory.

## Making changes

### Change how the game feels
Edit `js/config.js`. Good ones to try: `JUMP_VELOCITY`, `GRAVITY`, `START_SPEED`, `MAX_SPEED`,
`DIFFICULTY_MAX_SCORE`, `REACTION_TIME_HARD`.

> If you make the jump weaker (lower `JUMP_VELOCITY` or higher `GRAVITY`), check that the
> tallest obstacles can still be cleared: barriers are up to 42 px tall and
> `OMJ.Physics.maxJumpHeight()` must stay well above that.

### Add a skin
Copy a line in `js/skins.js`, give it a new `id`, `name`, `unlockAt` score and colors. Keep the
list sorted by `unlockAt`.

### Add an obstacle
1. In `js/obstacles.js`, add an entry to `OMJ.ObstacleTypes` with `size`, `hitbox`, `draw` and
   `deathLines`. Use `solidTop: true` if you can stand on it.
2. In `js/spawner.js`, add a pattern to `OMJ.PATTERNS` that uses it with `api.place(...)`.
   Give it a `minDifficulty` (0 = from the start, 1 = only at max difficulty) and a `weight`.

### Add a background theme
Add an entry to `THEMES` in `js/background.js` (copy one and change the colors). Themes switch
every 500 points.

### Add funny messages
Add lines to `js/messages.js`, or to the `deathLines` of an obstacle type.

## Embedding in another website

Copy the `.omj` `<div>` from `index.html`, the stylesheet link and the script tags into your
page, remove the `omj--fullscreen` class, and give the div a width. Its height follows a 16:9
shape automatically.

```html
<div class="omj" tabindex="0" style="max-width: 960px">…</div>
<script>OMJ.createGame(document.querySelector('.omj'));</script>
```

The game only reacts to keys while it has focus (click it to focus), so it won't steal
`SPACE` or the arrow keys from the rest of your page. It pauses itself when it loses focus.
Everything lives under one global `OMJ` object, and every CSS class starts with `omj-`.

## Testing checklist

The game was built in five stages. If something breaks after a change, check the stage it
belongs to.

**Stage 1: canvas, player, ground, jumping, gravity**
- The game fills the window without stretching. Resize the window: it stays 16:9.
- `SPACE`, `↑`, `W` and clicking all jump. Holding the key gives exactly one jump.
- You can't jump in mid-air. You can jump again right after landing.
- Pressing jump just before you land still jumps (the "jump buffer").

**Stage 2: obstacles, collision, scoring, game over**
- Touching spikes, a barrier or a crate's side ends the run. Falling into a gap ends the run.
- Landing on top of a crate is safe, and you can jump off it.
- The score goes up smoothly, and you get a bonus plus a pop-up every 100 points.
- The game-over screen shows score, best and obstacles jumped.

**Stage 3: random spawning and difficulty**
- Obstacles are different every run, and the game slowly speeds up.
- Gaps show up after about 150 points, barriers after about 300, combos later.
- Nothing should ever be impossible. Press `H` to see hitboxes if a crash seems unfair.

**Stage 4: visuals, animation, particles, sound**
- Pixels stay sharp (not blurry) at any window size.
- Background layers scroll at different speeds. The sky turns to sunset at 500 points and
  night at 1000.
- Dust puffs when you jump and land. The character blinks, its scarf flaps, and it looks up
  while rising and down while falling.
- Sounds play for jumping, landing, passing obstacles, milestones and crashing. `M` or the
  speaker button mutes them, and the setting is remembered.

**Stage 5: menus, pause, best score, unlocks, polish**
- The start screen shows the title, instructions, best score, skin picker and Play button.
- `ESC` pauses and resumes. Switching tabs or clicking outside the game pauses it.
- `R` restarts instantly after a crash. `SPACE` works too, after a short delay so you don't
  restart by accident.
- Reload the page: your best score, skin and mute setting are still there.
- Beating 100, 250, 500… unlocks new skins, announced mid-run.

To reset your saved progress, open the browser console (F12) and run:

```js
localStorage.removeItem('oneMoreJump.save.v1')
```
