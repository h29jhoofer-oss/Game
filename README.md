# Tower Ascent

A 2D top-down dungeon crawler where you fight your way up a tower, one floor at a time.
It's plain HTML5 Canvas and JavaScript, so there's nothing to install or build.

## Play

Open `index.html` in any modern web browser.

| Action | Keys |
| ------ | ---- |
| Move   | WASD / Arrow keys |
| Attack | Space / J |
| Pause  | P / Esc |

## How it works

- Every floor has a locked staircase. Defeat **every monster** on the floor to unlock it, then step on the stairs to climb.
- You have 3 hearts. Red potions (and sometimes fallen monsters) heal you, and climbing to a new floor restores 1 heart.
- If you fall, you retry the current floor.

## Floors

1. **The Cellar**: slimes that hop toward you.
2. **The Barracks**: slimes, swooping bats and hard-hitting orcs.
3. **The Armory**: skeleton archers that keep their distance and shoot arrows (you can slash arrows out of the air), plus bats and orcs.

The boss at the top of the tower is coming soon.

## Adding floors

Floors are defined as 20×15 text maps in the `LEVELS` array in `game.js`:

```
#  wall     .  floor    P  player start   S  stairs
s  slime    b  bat      o  orc            k  skeleton archer
h  health potion
```
