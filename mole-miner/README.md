# Mole Miner

A pixelated, turn-by-turn dig down a mine shaft, in the same style as Reckless Driver. Dig for gems, rope back up to sell them, and spend the cash on better gear for the next run.

Open `index.html` in a browser. It's a single self-contained file.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Dig / move | Arrow keys or WASD | ◀ ▶ ▲ ▼ |
| Rope up and sell | B | B |
| Start / continue | Enter or Space | Tap the screen |
| Shop (from the title) | Down | ▼ |
| Pause | P | |
| Back | Esc | |
| Mute | M | |

## How a run works

- **One action per turn.** Each step or dig is a turn. Nothing in the mine moves until you do, so you can stop and plan.
- **Stamina.** Every dig costs stamina, and so does climbing up. Walking sideways or down through open tunnel is free.

  | Rock | Stamina per dig |
  | --- | --- |
  | Dirt | 1 |
  | Clay | 2 |
  | Stone | 3 |
  | Loose rock | 3 |
  | Granite (needs the Drill upgrade) | 5 |

- **Gems.** Dig into one to bag it. Your bag holds 6 to start; gems you dig with a full bag crumble.

  | Gem | Value | Found from |
  | --- | --- | --- |
  | Coal | 10 | the top |
  | Copper | 25 | 4 m |
  | Silver | 60 | 14 m |
  | Gold | 140 | 26 m |
  | Ruby | 300 | 40 m |
  | Emerald | 650 | 58 m |
  | Diamond | 1,500 | 80 m |

- **Getting out.**
  - Press **B** to be hauled up by rope and sell everything.
  - Run out of stamina and you're hauled up anyway, but **half your gems** shake loose on the way.
  - Lose all your HP and you lose **the whole bag**.

## Hazards

- **Loose rocks** (from 10 m) shake for one turn when there's nothing under them, then fall. A rock landing on you costs 2 HP.
- **Cave-ins** (from 15 m): digging deep can bring the ceiling above you down as a falling rock. You get one turn to step aside.
- **Gas pockets** (from 22 m) hide inside the rock. Dig into one and a green cloud spreads through the tunnels for a few turns; every turn you end in it costs 1 HP. A Lantern upgrade shows pockets as a green shimmer before you dig.
- **Lava** (from 42 m) creeps into open tunnels, mostly downward. It lights up the dark, but ending a turn in it costs 2 HP.

## Shop

| Upgrade | Levels | Prices | Effect |
| --- | --- | --- | --- |
| Drill | 3 | 250 / 1,000 / 3,500 | Cheaper digs. Level 1 cuts granite. |
| Big Bag | 3 | 150 / 600 / 2,000 | +4 gem slots per level |
| Lantern | 3 | 200 / 800 / 2,500 | Wider light. Any level shows gas pockets. |
| Lunchbox | 3 | 150 / 600 / 2,000 | More stamina (50, 70, 95, 125) |
| Hard Hat | 2 | 300 / 1,200 | +1 HP per level (3 to start) |

Cash, gear and your best depth are saved in the browser.
