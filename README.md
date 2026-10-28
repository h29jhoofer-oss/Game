# One More Jump

A tiny pixel-art endless runner for the browser. Your little blob runs on its own — you just
jump over spikes, crates, gaps and tall barriers for as long as you can. Unlock new skins, each
with its own powers, while a chiptune soundtrack speeds up with you.

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
| `↓` or `S` (in the air) | Ground smash: drop straight down |
| `↓` or `S` (on a platform) | Drop down through the platform |
| `B`, `SHIFT`, right-click | Use your skin's ability |
| `V` | Use your bonus ability (a rare boost) |
| `1` `2` `3` | Pick a boost card |
| `ESC` or `P` | Pause / resume |
| `R` | Restart after a crash |
| `M` | Mute / unmute everything |
| `N` | Music on / off |
| `←` / `→` (start screen) | Change skin |
| `H` | Show hitboxes (for debugging) |

## Skins and their powers

Every skin has a **passive** perk (always on) and an **active** ability (press `B`). The meter in
the bottom-left corner shows when the ability is ready. Every run starts with it charged.

| Skin | Unlock at | Passive | Active (cooldown) |
| --- | --- | --- | --- |
| Classic | 0 | **Lucky Streak**: milestone bonus doubled | **Double Jump**: jump again in mid-air (4 s) |
| Minty | 100 | **Quick Feet**: extra-forgiving jump timing | **Dash**: zoom ahead, smashing obstacles (9 s) |
| Berry | 250 | **Sugar Rush**: +10% score | **Slow-Mo**: time runs at half speed for 3 s (15 s) |
| Ghost | 500 | **Second Chance**: survive one crash per run | **Phase**: float through anything for 1.2 s (10 s) |
| Ninja | 750 | **Slippery**: smaller hitbox | **Shuriken**: throw a star that breaks the next obstacle (6 s) |
| Golden | 1000 | **Midas Touch**: +25% score | **Shield**: a bubble that blocks one crash for 10 s (20 s) |
| Cosmic | 2000 | **Stardust**: abilities recharge 50% faster, +15% score | **Supernova**: blast away everything on screen (25 s) |

Abilities only ever help. Protection (Dash, Phase, Shield, Second Chance) never runs out while
you're over a pit or about to touch an obstacle, so it can't end in an unfair crash. Score
bonuses don't make the game speed up faster: difficulty follows distance travelled.

## Obstacles

| Obstacle | How to get past it |
| --- | --- |
| Spikes | Jump over. |
| Crate (1 or 2 high) | Jump over, or land on top and jump off. |
| Gap | Jump across. |
| Barrier | Tall: jump at the right moment. |
| Saw | A big spinning blade half-sunk in the ground, sliding side to side. Watch where it is and jump it. |
| Pop-up saw | A big blade that rises and sinks in the ground. Jump it, or time it and run over it while it's low. |
| Crusher | A spiked gunmetal block floating high up. It rattles as you approach, its yellow eyes turn red, then it slams down while still ahead of you. Jump it (or stand on it). |
| Crossbow | A big tower with a flaming arrow loaded. The tower is scenery; when nothing else is in the way, it fires the arrow along the ground: jump the arrow. |

Moving obstacles are still fair. The sliding saw never moves faster than the world, so it can't
chase you. The pop-up saw never rises higher than a normal jump clears. The crusher always slams before you reach it. The crossbow waits until nothing else is
between you, and its arrow always gives you at least ¾ of a second.

## Coins and boosts

Gold coins float along the path of a good jump, sit in rows on the ground, and line the tops of
platforms. The counter under your score shows how many you have toward the next boost.

When you have enough (25 for the first, then 10 more each time), the game waits for a calm
moment, pauses, and offers **three boost cards**. Press `1`, `2` or `3` (or click). SPACE never
picks a card, so you can't choose one by accident. Boosts last until the end of the run.

| Boost | Effect | Max |
| --- | --- | --- |
| Steady Pace | The world moves 7% slower | 3 |
| Spring Shoes | Jump higher and hang in the air longer | 3 |
| Coin Magnet | Nearby coins fly to you | 3 |
| Lucky Coins | Every coin counts double | 1 |
| Show-Off | +15% score | 5 |
| Quick Recharge | Abilities recharge 25% faster | 3 |
| Squeeze | Smaller hitbox | 1 |
| Cat Reflexes | Even more forgiving jump timing | 1 |
| Extra Life | Survive one more crash | 2 |
| Heavy Stomp | Ground-smash shockwaves hit bosses twice as hard | 1 |

Sometimes a gold **rare card** shows up instead: an active ability no skin has, used with `V`.
You can own one per run.

| Rare ability | Effect | Cooldown |
| --- | --- | --- |
| Rocket Jump | Blast sky-high; you can't crash until you land | 12 s |
| Blink | Teleport past the next obstacle | 10 s |
| Bulldozer | Smash through everything for 4 seconds | 18 s |

Fairness: Spring Shoes changes the jump that the spawner, the boss and the coin arcs all plan
around (`OMJ.Physics`), so obstacles space themselves out for your longer jumps.

## Wooden platforms

Floating wooden planks show up over spikes, saws and pits. Jump up through one from below and
you land on top; walk off the end or press `↓` to drop back down. They never hurt you, and
whatever is under them can always be jumped the normal way, so they're an optional high road.

## Ground smash

Press `↓` (or `S`) in the air to drop straight down. It lands you sooner, so you can set up
the next jump faster. It doesn't break obstacles. During a boss fight, each ground smash sends
a shockwave along the ground that hurts the boss.

## The boss: Big Bonk

When the first night ends (score 1500), normal obstacles stop and **Big Bonk**, a huge
crowned block, flies in. Its eyes turn red and it shakes just before every attack:

| Attack | What to do |
| --- | --- |
| Bomb | Drops and rolls toward you. Jump it. |
| Spiky ball | Drops and sits still. Jump it. |
| Fireball | Swoops down to the ground and flies at you. Jump it. |
| Fireball burst | Three fireballs, one after another. Jump each one. |
| Ground Pound | Big Bonk slams into the ground and a quake wave rolls at you. Jump it. |
| Crate drop | Drops a crate. Jump over it or land on top. |

- **Hurt it** with ground smash shockwaves (6 hits the first time). Shuriken hits it, and
  Supernova does double damage.
- **Beat it** for +250 points. It comes back after every night (score 3000, 4500…) with
  2 more health and a bigger reward.
- **Run out the clock** (40 seconds, the thin bar under its health) and it leaves with no bonus.

Fairness: the boss works out when each attack will reach you, and never lets two attacks
arrive closer together than one full jump plus reaction time. If an attack would be too soon,
it holds its wind-up and waits.

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
| `js/skins.js` | Unlockable characters: colors, passive perks, which ability they use |
| `js/messages.js` | The funny game-over lines |
| `js/audio.js` | Sound effects, synthesized with the Web Audio API (no sound files) |
| `js/music.js` | Background music: songs written as note lists, and a tiny sequencer |
| `js/player.js` | The player: jumping, gravity, landing, and how it's drawn |
| `js/obstacles.js` | Obstacle types (spike, crate, barrier, gap, saw, crusher, crossbow, boss attacks) and the obstacle pool |
| `js/spawner.js` | Obstacle patterns and when they appear |
| `js/abilities.js` | Active abilities, cooldowns, invulnerability, the ability meters |
| `js/coins.js` | Coins: moving, collecting (and the magnet), drawing |
| `js/boosts.js` | Boosts bought with coins, rare bonus abilities, and how cards are picked |
| `js/boss.js` | Big Bonk: when it appears, its attacks, health and drawing |
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
Copy an entry in `js/skins.js`, give it a new `id`, `name`, `unlockAt` score and colors. Keep the
list sorted by `unlockAt`. Pick its `active` ability from `OMJ.ABILITIES`, and give it a
`passive` that changes any of the values in `OMJ.PASSIVE_DEFAULTS`.

### Add an ability
Add an entry to `OMJ.ABILITIES` in `js/abilities.js` with `name`, `desc`, `cooldown`, `duration`
and an `activate(game, a)` function (and `canUse(game)` if it only works sometimes). Look at the
existing ones: most are a few lines that start a timer and play a sound.

### Change the music
Songs live at the top of `js/music.js`. Each word is one eighth-note step: a note like `C5` or
`F#4`, `-` to hold the previous note, `.` for silence. Drums use `K` (kick), `S` (snare) and
`h` (hi-hat). Keep the lead, bass and drum lines the same length (64 steps in the built-in songs).

### Add an obstacle
1. In `js/obstacles.js`, add an entry to `OMJ.ObstacleTypes` with `size`, `hitbox`, `draw` and
   `deathLines`. Use `solidTop: true` if you can stand on it. For something that moves, add
   `init(o)` and `update(o, dt, game, speed)`; the saw, crusher and crossbow are good examples.
2. In `js/spawner.js`, add a pattern to `OMJ.PATTERNS` that uses it with `api.place(...)`.
   Give it a `minDifficulty` (0 = from the start, 1 = only at max difficulty) and a `weight`.

### Tune coins and boosts
How many coins a boost costs and how often rare cards appear are in `OMJ.COINS` at the top of
`js/boosts.js`. Add a boost by copying an entry in `OMJ.BOOSTS`: its `apply(m)` changes one of
the run modifiers listed in `OMJ.newRunMods`. How often coins appear is in `js/spawner.js`
(search for `coinArc` and `coinRow`).

### Tune the boss
All of Big Bonk's numbers (when it appears, health, time limit, reward, warning time, size,
and how often it uses each attack) are in `OMJ.BOSS` at the top of `js/boss.js`. Its music is the `boss` song in `js/music.js`.

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
- Sliding saws appear after about 225 points, pop-up saws after 375, crushers after 450,
  crossbows after 600. Wooden platforms appear over spikes from the start, and over pits and
  saws later.
- Jumping up into a platform lands you on top; `↓` on a platform drops you through it.
- The crusher rattles, then slams down before you reach it. You can stand on it afterwards.
- The crossbow only fires when nothing else is between you; its flaming arrow dips to ground
  level and leaves a trail of fire and smoke.
- Nothing should ever be impossible. Press `H` to see hitboxes if a crash seems unfair.

**Stage 4: visuals, animation, particles, sound**
- Pixels stay sharp (not blurry) at any window size.
- Background layers scroll at different speeds. The sky turns to sunset at 500 points and
  night at 1000.
- Dust puffs when you jump and land. The character blinks, its scarf flaps, and it looks up
  while rising and down while falling.
- Sounds play for jumping, landing, passing obstacles, milestones, crashing, falling and every
  ability. `M` or the speaker button mutes everything, and the setting is remembered.
- Music plays on the start screen and during runs, speeds up as the game gets harder, slows during
  Slow-Mo, and pauses with the game. `N` or the note button turns it off.

**Stage 5: menus, pause, best score, unlocks, polish**
- The start screen shows the title, instructions, best score, skin picker and Play button.
- `ESC` pauses and resumes. Switching tabs or clicking outside the game pauses it.
- `R` restarts instantly after a crash. `SPACE` works too, after a short delay so you don't
  restart by accident.
- Reload the page: your best score, skin and mute setting are still there.
- Beating 100, 250, 500… unlocks new skins, announced mid-run.
- Each skin's passive and active show on the start screen, even while it's locked.
- `B` uses the ability; the meter fills while it recharges and says READY when it's charged.
- Coins appear in arcs over obstacles, in ground rows and on platforms; the counter under the
  score fills toward the next boost, then says BOOST! and the card screen opens at a calm moment.
- Picking a card shows its name, a short "GO!" pause, and the boost works right away. A rare
  card adds a second meter (gold, `V`) next to the first.
- `↓` in the air drops you fast with a thump and a dust cloud. On the ground it does nothing.
- At 1500 points Big Bonk arrives with its own music. Ground smash shockwaves shrink its health
  bar; beating it gives +250, and normal obstacles return afterwards.
  Double Jump and Shuriken buzz and stay charged if you press them when they can't work
  (on the ground, or with nothing to hit).

To reset your saved progress, open the browser console (F12) and run:

```js
localStorage.removeItem('oneMoreJump.save.v1')
```
